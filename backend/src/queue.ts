import { Queue, Worker } from 'bullmq';
import dotenv from 'dotenv';
import { dbRun } from './db';
import { validateAndAuditUrl } from './services/playwright';
import { runLighthouseAudit } from './services/pagespeed';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
let auditQueue: Queue | null = null;
let useLocalQueue = true;

// SSE updates callback hooks mapped by auditId
export const progressListeners = new Map<string, Array<(data: any) => void>>();

export function sendProgressUpdate(auditId: string, data: any) {
  const listeners = progressListeners.get(auditId);
  if (listeners) {
    listeners.forEach((listener) => listener(data));
  }
}

// In-memory queue implementation for fallback
interface LocalJob {
  auditId: string;
  urls: string[];
}
const localJobsQueue: LocalJob[] = [];
let localQueueRunning = false;

async function processLocalQueue() {
  if (localQueueRunning || localJobsQueue.length === 0) return;
  localQueueRunning = true;

  while (localJobsQueue.length > 0) {
    const job = localJobsQueue.shift();
    if (!job) continue;

    console.log(`Processing local queue job for Audit ${job.auditId}`);
    try {
      await processAuditJob(job.auditId, job.urls);
    } catch (err) {
      console.error(`Error executing local audit job ${job.auditId}:`, err);
    }
  }

  localQueueRunning = false;
}

// Initialize Queueing System
export function initQueue() {
  if (redisUrl) {
    try {
      console.log('Connecting to Redis for BullMQ...');
      // Use dynamic require to get ioredis without type conflicts
      const IORedis = require('ioredis');
      const connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
      });

      connection.on('connect', () => {
        console.log('Successfully connected to Redis. Initializing BullMQ...');
        useLocalQueue = false;
        
        auditQueue = new Queue('AuditQueue', { connection });

        // Initialize Worker
        const worker = new Worker(
          'AuditQueue',
          async (job) => {
            const { auditId, urls } = job.data;
            await processAuditJob(auditId, urls);
          },
          { connection, concurrency: 1 }
        );

        worker.on('failed', (job, err) => {
          console.error(`Job ${job?.id} failed:`, err);
        });
      });

      connection.on('error', (err: any) => {
        console.warn('Redis connection error. Falling back to in-memory queue:', err.message);
        useLocalQueue = true;
      });
    } catch (e) {
      console.warn('Failed to initialize Redis. Using in-memory fallback queue.');
      useLocalQueue = true;
    }
  } else {
    console.log('No REDIS_URL provided. Using in-memory fallback queue.');
    useLocalQueue = true;
  }
}

// Add audit batch to queue
export async function queueAudit(auditId: string, urls: string[]) {
  if (useLocalQueue || !auditQueue) {
    console.log(`Enqueuing audit job locally for Audit ID: ${auditId}`);
    localJobsQueue.push({ auditId, urls });
    processLocalQueue(); // Start executing async
  } else {
    console.log(`Enqueuing audit job on Redis for Audit ID: ${auditId}`);
    await auditQueue.add(`audit-${auditId}`, { auditId, urls });
  }
}

// The Core Job Processor
async function processAuditJob(auditId: string, urls: string[]) {
  console.log(`Starting execution for Audit ID: ${auditId}`);
  
  // Update overall audit status to RUNNING
  dbRun('UPDATE audits SET status = ? WHERE id = ?', ['RUNNING', auditId]);
  sendProgressUpdate(auditId, { type: 'status', status: 'RUNNING', completedCount: 0 });

  let completedCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const reportId = crypto.randomUUID();

    sendProgressUpdate(auditId, {
      type: 'url_progress',
      url,
      step: 'Starting audit',
      message: 'Validating website load with Playwright...',
      percentage: Math.round(((i) / urls.length) * 100),
    });

    try {
      // Step 1: Run load validation & screenshot capture
      const loadResult = await validateAndAuditUrl(url, (msg) => {
        sendProgressUpdate(auditId, {
          type: 'url_progress',
          url,
          step: 'Playwright Load Diagnostics',
          message: msg,
        });
      });

      let pageSpeedResult = {
        desktop: { perfScore: 0, accScore: 0, bestPracScore: 0, seoScore: 0, fcpMs: 0, lcpMs: 0, cls: 0, tbtMs: 0, speedIndexMs: 0, inpMs: 0 },
        mobile: { perfScore: 0, accScore: 0, bestPracScore: 0, seoScore: 0, fcpMs: 0, lcpMs: 0, cls: 0, tbtMs: 0, speedIndexMs: 0, inpMs: 0 },
        recommendations: [] as any[]
      };

      // Step 2: If Playwright succeeded or partially loaded, run Lighthouse/PageSpeed
      if (loadResult.status === 'SUCCESS' || loadResult.status === 'PARTIALLY_LOADED') {
        sendProgressUpdate(auditId, {
          type: 'url_progress',
          url,
          step: 'PageSpeed Insights',
          message: 'Running Google PageSpeed & Lighthouse analysis...',
        });

        pageSpeedResult = await runLighthouseAudit(url, (msg) => {
          sendProgressUpdate(auditId, {
            type: 'url_progress',
            url,
            step: 'PageSpeed Audits',
            message: msg,
          });
        });
      }

      // Step 3: Write report result to DB
      dbRun(
        `INSERT INTO reports (
          id, audit_id, url, status, load_time_ms, response_time_ms, dom_ready_ms,
          desktop_perf_score, desktop_acc_score, desktop_best_prac_score, desktop_seo_score,
          desktop_fcp_ms, desktop_lcp_ms, desktop_cls, desktop_tbt_ms, desktop_speed_index_ms, desktop_inp_ms,
          mobile_perf_score, mobile_acc_score, mobile_best_prac_score, mobile_seo_score,
          mobile_fcp_ms, mobile_lcp_ms, mobile_cls, mobile_tbt_ms, mobile_speed_index_ms, mobile_inp_ms,
          screenshot_desktop_full, screenshot_mobile_full, screenshot_desktop_above,
          recommendations, error_message
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )`,
        [
          reportId,
          auditId,
          url,
          loadResult.status,
          loadResult.loadTimeMs,
          loadResult.responseTimeMs,
          loadResult.domReadyMs,
          pageSpeedResult.desktop.perfScore,
          pageSpeedResult.desktop.accScore,
          pageSpeedResult.desktop.bestPracScore,
          pageSpeedResult.desktop.seoScore,
          pageSpeedResult.desktop.fcpMs,
          pageSpeedResult.desktop.lcpMs,
          pageSpeedResult.desktop.cls,
          pageSpeedResult.desktop.tbtMs,
          pageSpeedResult.desktop.speedIndexMs,
          pageSpeedResult.desktop.inpMs,
          pageSpeedResult.mobile.perfScore,
          pageSpeedResult.mobile.accScore,
          pageSpeedResult.mobile.bestPracScore,
          pageSpeedResult.mobile.seoScore,
          pageSpeedResult.mobile.fcpMs,
          pageSpeedResult.mobile.lcpMs,
          pageSpeedResult.mobile.cls,
          pageSpeedResult.mobile.tbtMs,
          pageSpeedResult.mobile.speedIndexMs,
          pageSpeedResult.mobile.inpMs,
          loadResult.screenshotDesktopFull || null,
          loadResult.screenshotMobileFull || null,
          loadResult.screenshotDesktopAbove || null,
          JSON.stringify(pageSpeedResult.recommendations),
          loadResult.errorMessage || null,
        ]
      );

      completedCount++;
      dbRun('UPDATE audits SET completed_urls = ? WHERE id = ?', [completedCount, auditId]);

      sendProgressUpdate(auditId, {
        type: 'url_complete',
        url,
        status: loadResult.status,
        completedCount,
        totalCount: urls.length,
      });

    } catch (err: any) {
      console.error(`Error processing URL ${url}:`, err);
      // Create a FAILED report entry
      dbRun(
        `INSERT INTO reports (id, audit_id, url, status, error_message) VALUES (?, ?, ?, ?, ?)`,
        [reportId, auditId, url, 'FAILED', err.message || String(err)]
      );

      completedCount++;
      dbRun('UPDATE audits SET completed_urls = ? WHERE id = ?', [completedCount, auditId]);
      
      sendProgressUpdate(auditId, {
        type: 'url_complete',
        url,
        status: 'FAILED',
        completedCount,
        totalCount: urls.length,
      });
    }
  }

  // Update audit status to COMPLETED
  dbRun('UPDATE audits SET status = ? WHERE id = ?', ['COMPLETED', auditId]);
  sendProgressUpdate(auditId, { type: 'status', status: 'COMPLETED', completedCount });
  console.log(`Audit job ${auditId} successfully completed.`);
}
