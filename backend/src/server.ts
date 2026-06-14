import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, dbRun, dbAll, dbGet } from './db';
import { initQueue, queueAudit, progressListeners } from './queue';
import { generatePdfBuffer } from './services/pdf';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Performance Audit Hub API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: 'GET /health',
      startAudit: 'POST /audit/start',
      auditStatus: 'GET /audit/:id',
      auditHistory: 'GET /audit/history',
      auditStream: 'GET /audit/:id/stream',
      downloadPdf: 'GET /audit/report/:id/pdf',
      deleteAudit: 'DELETE /audit/:id',
    },
  });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// POST /audit/start - Enqueue a new batch of URLs
app.post('/audit/start', async (req, res) => {
  const { urls } = req.body;
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'An array of URLs is required' });
  }

  const sanitisedUrls = urls
    .map((u: string) => u.trim())
    .filter((u: string) => {
      try {
        new URL(u);
        return true;
      } catch (_) {
        return false;
      }
    });

  if (sanitisedUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided.' });
  }

  if (sanitisedUrls.length > 20) {
    return res.status(400).json({ error: 'Maximum batch limit is 20 URLs.' });
  }

  const auditId = crypto.randomUUID();

  try {
    // Write audit record
    dbRun(
      'INSERT INTO audits (id, status, total_urls) VALUES (?, ?, ?)',
      [auditId, 'PENDING', sanitisedUrls.length]
    );

    // Queue background jobs
    await queueAudit(auditId, sanitisedUrls);

    res.status(202).json({
      message: 'Audit job queued successfully.',
      auditId,
      urls: sanitisedUrls,
    });
  } catch (error: any) {
    console.error('Error starting audit:', error);
    res.status(500).json({ error: error.message || 'Failed to queue audit.' });
  }
});

// GET /audit/history - Fetch historical report results
// NOTE: This MUST be registered BEFORE /audit/:id so Express doesn't
// treat "history" as an :id parameter.
app.get('/audit/history', async (req, res) => {
  try {
    const rows = dbAll(`
      SELECT 
        a.id as audit_id,
        a.created_at,
        a.status as audit_status,
        a.total_urls,
        r.id as report_id,
        r.url,
        r.status as url_status,
        r.load_time_ms,
        r.desktop_perf_score,
        r.mobile_perf_score
      FROM audits a
      JOIN reports r ON r.audit_id = a.id
      ORDER BY a.created_at DESC, r.created_at ASC
    `);

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /audit/:id - Fetch current status & completed URL reports
app.get('/audit/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const audit = dbGet('SELECT * FROM audits WHERE id = ?', [id]);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found.' });
    }

    const reports = dbAll('SELECT * FROM reports WHERE audit_id = ? ORDER BY created_at ASC', [id]);

    res.json({
      audit,
      reports,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /audit/:id/stream - Server-Sent Events connection for real-time progress logs
app.get('/audit/:id/stream', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE stream connected.' })}\n\n`);

  // Define connection callback listener
  const listener = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Register listener
  if (!progressListeners.has(id)) {
    progressListeners.set(id, []);
  }
  progressListeners.get(id)!.push(listener);

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const listeners = progressListeners.get(id);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
      if (listeners.length === 0) {
        progressListeners.delete(id);
      }
    }
    console.log(`SSE connection closed for Audit ${id}`);
  });
});

// GET /audit/report/:id/pdf - Generate enterprise PDF report
app.get('/audit/report/:id/pdf', async (req, res) => {
  const { id } = req.params;

  try {
    const audit = dbGet('SELECT * FROM audits WHERE id = ?', [id]);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found.' });
    }

    const reports = dbAll('SELECT * FROM reports WHERE audit_id = ? ORDER BY created_at ASC', [id]);

    const pdfBuffer = await generatePdfBuffer({
      audit: audit as any,
      reports: reports as any[],
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="performance-report-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF Generation Failed:', error);
    res.status(500).json({ error: error.message || 'Failed to generate PDF.' });
  }
});

// DELETE /audit/:id - Delete audit and all its reports
app.delete('/audit/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Manually delete reports first since sql.js doesn't auto-cascade
    dbRun('DELETE FROM reports WHERE audit_id = ?', [id]);
    const result = dbRun('DELETE FROM audits WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Audit not found.' });
    }
    res.json({ message: 'Audit and its associated reports deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Server Initialization
async function startServer() {
  await initDb();
  initQueue();
  
  app.listen(PORT, () => {
    console.log(`Performance Audit Hub Backend running on port ${PORT}`);
  });
}

startServer();
