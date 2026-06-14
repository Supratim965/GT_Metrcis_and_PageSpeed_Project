import puppeteer from 'puppeteer';

export interface AuditReportData {
  audit: {
    id: string;
    created_at: string;
    status: string;
    total_urls: number;
  };
  reports: Array<{
    url: string;
    status: string;
    load_time_ms: number;
    response_time_ms: number;
    dom_ready_ms: number;
    desktop_perf_score: number;
    desktop_acc_score: number;
    desktop_best_prac_score: number;
    desktop_seo_score: number;
    desktop_fcp_ms: number;
    desktop_lcp_ms: number;
    desktop_cls: number;
    desktop_tbt_ms: number;
    desktop_speed_index_ms: number;
    desktop_inp_ms: number;
    mobile_perf_score: number;
    mobile_acc_score: number;
    mobile_best_prac_score: number;
    mobile_seo_score: number;
    mobile_fcp_ms: number;
    mobile_lcp_ms: number;
    mobile_cls: number;
    mobile_tbt_ms: number;
    mobile_speed_index_ms: number;
    mobile_inp_ms: number;
    screenshot_desktop_full?: string;
    screenshot_mobile_full?: string;
    screenshot_desktop_above?: string;
    recommendations?: string; // stringified JSON
    error_message?: string;
  }>;
}

export async function generatePdfBuffer(data: AuditReportData): Promise<Buffer> {
  const { audit, reports } = data;
  const timestamp = new Date(audit.created_at).toLocaleString();

  // Calculate stats for Final Summary
  const successReports = reports.filter(r => r.status === 'SUCCESS' || r.status === 'PARTIALLY_LOADED');
  const avgDesktop = successReports.length > 0 
    ? Math.round(successReports.reduce((acc, r) => acc + Number(r.desktop_perf_score), 0) / successReports.length)
    : 0;
  const avgMobile = successReports.length > 0 
    ? Math.round(successReports.reduce((acc, r) => acc + Number(r.mobile_perf_score), 0) / successReports.length)
    : 0;

  let bestSite = 'N/A';
  let worstSite = 'N/A';
  if (successReports.length > 0) {
    const sorted = [...successReports].sort((a, b) => Number(b.desktop_perf_score) - Number(a.desktop_perf_score));
    bestSite = `${sorted[0].url} (${sorted[0].desktop_perf_score}%)`;
    worstSite = `${sorted[sorted.length - 1].url} (${sorted[sorted.length - 1].desktop_perf_score}%)`;
  }

  // Construct HTML
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
  
  body {
    font-family: 'Outfit', sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    line-height: 1.5;
  }
  .page {
    padding: 40px;
    page-break-after: always;
    box-sizing: border-box;
    position: relative;
    min-height: 100vh;
  }
  .page:last-child {
    page-break-after: avoid;
  }
  
  /* Cover Page Styles */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
    padding: 80px 40px;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    color: white;
  }
  .cover-logo {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 20px;
    letter-spacing: -1px;
    background: linear-gradient(90deg, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .cover-title {
    font-size: 48px;
    font-weight: 700;
    margin-top: 40px;
    margin-bottom: 10px;
  }
  .cover-subtitle {
    font-size: 18px;
    color: #94a3b8;
    margin-bottom: 60px;
  }
  .cover-meta {
    font-size: 14px;
    color: #cbd5e1;
    border-top: 1px solid #334155;
    padding-top: 20px;
    width: 80%;
  }

  /* Grid Layouts */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #475569;
    margin-top: 0;
    margin-bottom: 15px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Metrics Styling */
  .score-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    color: white;
    font-weight: 700;
    font-size: 20px;
  }
  .score-good { background-color: #22c55e; }
  .score-average { background-color: #eab308; }
  .score-poor { background-color: #ef4444; }

  .metric-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px dashed #e2e8f0;
  }
  .metric-row:last-child {
    border-bottom: none;
  }
  .metric-label {
    font-weight: 500;
    color: #64748b;
  }
  .metric-value {
    font-weight: 600;
    color: #0f172a;
  }

  /* Screenshot Previews */
  .screenshot-container {
    display: flex;
    gap: 15px;
    margin: 20px 0;
  }
  .screenshot-wrapper {
    flex: 1;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    background: #f1f5f9;
  }
  .screenshot-wrapper img {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }
  .screenshot-label {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    padding: 5px;
    background: #e2e8f0;
    color: #475569;
  }

  h2 {
    font-size: 24px;
    color: #0f172a;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 20px;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
  }
  .summary-table th, .summary-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  .summary-table th {
    background-color: #f1f5f9;
    color: #475569;
    font-weight: 600;
  }
</style>
</head>
<body>

  <!-- PAGE 1: COVER PAGE -->
  <div class="cover">
    <div class="cover-logo">PERFORMANCE AUDIT HUB</div>
    <div class="cover-title">Enterprise Website Audit Report</div>
    <div class="cover-subtitle">Automated Multi-URL Performance & Core Web Vitals Analysis</div>
    <div class="cover-meta">
      <p><strong>Audit ID:</strong> ${audit.id}</p>
      <p><strong>Generated At:</strong> ${timestamp}</p>
      <p><strong>Total URLs Audited:</strong> ${audit.total_urls}</p>
    </div>
  </div>

  <!-- PAGE 2: EXECUTIVE SUMMARY & ANALYTICS -->
  <div class="page">
    <h2>Executive Performance Summary</h2>
    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">Overall Metrics</h3>
        <div class="metric-row">
          <span class="metric-label">Average Desktop Score</span>
          <span class="metric-value">${avgDesktop}%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Average Mobile Score</span>
          <span class="metric-value">${avgMobile}%</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Best Performing Site</span>
          <span class="metric-value" style="font-size:12px;">${bestSite}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Worst Performing Site</span>
          <span class="metric-value" style="font-size:12px;">${worstSite}</span>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">Audit Log</h3>
        <div class="metric-row">
          <span class="metric-label">Success Count</span>
          <span class="metric-value">${reports.filter(r => r.status === 'SUCCESS').length}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Warnings / Partial Loads</span>
          <span class="metric-value">${reports.filter(r => r.status === 'PARTIALLY_LOADED').length}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Failed Audits</span>
          <span class="metric-value">${reports.filter(r => r.status !== 'SUCCESS' && r.status !== 'PARTIALLY_LOADED').length}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">URL Comparison Table</h3>
      <table class="summary-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>Desktop Score</th>
            <th>Mobile Score</th>
            <th>Load Duration</th>
          </tr>
        </thead>
        <tbody>
          ${reports.map(r => `
            <tr>
              <td style="font-size:13px; font-weight:600; color:#2563eb; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.url}</td>
              <td><span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; background:${r.status === 'SUCCESS' ? '#dcfce7; color:#166534;' : r.status === 'PARTIALLY_LOADED' ? '#fef9c3; color:#854d0e;' : '#fee2e2; color:#991b1b;'}">${r.status}</span></td>
              <td><strong>${r.desktop_perf_score ?? 'N/A'}${r.desktop_perf_score ? '%' : ''}</strong></td>
              <td><strong>${r.mobile_perf_score ?? 'N/A'}${r.mobile_perf_score ? '%' : ''}</strong></td>
              <td>${r.load_time_ms ? (r.load_time_ms / 1000).toFixed(2) + 's' : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- REPORTS SECTIONS -->
  ${reports.map((report, index) => {
    const isSuccess = report.status === 'SUCCESS' || report.status === 'PARTIALLY_LOADED';
    const recs = isSuccess && report.recommendations ? JSON.parse(report.recommendations) : [];

    const getScoreClass = (score: number) => {
      if (score >= 90) return 'score-good';
      if (score >= 50) return 'score-average';
      return 'score-poor';
    };

    return `
    <div class="page">
      <h2 style="display:flex; justify-content:space-between; align-items:center;">
        <span>#${index + 1} Audit Report: ${report.url}</span>
        <span style="font-size:13px; font-weight:400; color:#64748b;">Status: ${report.status}</span>
      </h2>

      ${!isSuccess ? `
        <div class="card" style="background:#fee2e2; border:1px solid #fca5a5;">
          <h3 class="card-title" style="color:#991b1b;">Audit Run Failed</h3>
          <p style="color:#b91c1c; font-family:monospace; margin-bottom:0;">${report.error_message || 'An unknown execution error occurred during browser validation.'}</p>
        </div>
      ` : `
        <div class="grid-2">
          <!-- Desktop Scores & Metrics -->
          <div class="card">
            <h3 class="card-title" style="color:#2563eb;">Desktop Performance</h3>
            <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center;">
              <div class="score-badge ${getScoreClass(report.desktop_perf_score)}">${report.desktop_perf_score}</div>
              <div>
                <div style="font-weight:700;">Performance Score</div>
                <div style="font-size:12px; color:#64748b;">PageSpeed Lighthouse Desktop</div>
              </div>
            </div>
            <div class="metric-row">
              <span class="metric-label">First Contentful Paint (FCP)</span>
              <span class="metric-value">${(report.desktop_fcp_ms / 1000).toFixed(2)}s</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Largest Contentful Paint (LCP)</span>
              <span class="metric-value">${(report.desktop_lcp_ms / 1000).toFixed(2)}s</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Blocking Time (TBT)</span>
              <span class="metric-value">${report.desktop_tbt_ms}ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Cumulative Layout Shift (CLS)</span>
              <span class="metric-value">${report.desktop_cls}</span>
            </div>
          </div>

          <!-- Mobile Scores & Metrics -->
          <div class="card">
            <h3 class="card-title" style="color:#db2777;">Mobile Performance</h3>
            <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center;">
              <div class="score-badge ${getScoreClass(report.mobile_perf_score)}">${report.mobile_perf_score}</div>
              <div>
                <div style="font-weight:700;">Performance Score</div>
                <div style="font-size:12px; color:#64748b;">PageSpeed Lighthouse Mobile</div>
              </div>
            </div>
            <div class="metric-row">
              <span class="metric-label">First Contentful Paint (FCP)</span>
              <span class="metric-value">${(report.mobile_fcp_ms / 1000).toFixed(2)}s</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Largest Contentful Paint (LCP)</span>
              <span class="metric-value">${(report.mobile_lcp_ms / 1000).toFixed(2)}s</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Total Blocking Time (TBT)</span>
              <span class="metric-value">${report.mobile_tbt_ms}ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Cumulative Layout Shift (CLS)</span>
              <span class="metric-value">${report.mobile_cls}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">Load Connection Diagnostics</h3>
          <div class="grid-2" style="margin-bottom: 0;">
            <div class="metric-row"><span class="metric-label">Server Response Time</span><span class="metric-value">${report.response_time_ms}ms</span></div>
            <div class="metric-row"><span class="metric-label">DOM Ready Time</span><span class="metric-value">${report.dom_ready_ms}ms</span></div>
            <div class="metric-row"><span class="metric-label">Actual Page Load Duration</span><span class="metric-value">${(report.load_time_ms / 1000).toFixed(2)}s</span></div>
            <div class="metric-row"><span class="metric-label">Lighthouse Scores</span><span class="metric-value">SEO: ${report.desktop_seo_score}%, Acc: ${report.desktop_acc_score}%</span></div>
          </div>
        </div>

        <div class="screenshot-container">
          ${report.screenshot_desktop_above ? `
            <div class="screenshot-wrapper">
              <img src="data:image/png;base64,${report.screenshot_desktop_above}" alt="Desktop Above the Fold" />
              <div class="screenshot-label">Desktop Viewport (Above the Fold)</div>
            </div>
          ` : ''}
          ${report.screenshot_mobile_full ? `
            <div class="screenshot-wrapper">
              <img src="data:image/png;base64,${report.screenshot_mobile_full}" alt="Mobile Full View" />
              <div class="screenshot-label">Mobile Emulation (Full View)</div>
            </div>
          ` : ''}
        </div>

        ${recs.length > 0 ? `
          <div class="card">
            <h3 class="card-title">Top Improvement Opportunities</h3>
            <table class="summary-table">
              <thead>
                <tr>
                  <th style="width: 70%">Opportunity Description</th>
                  <th style="width: 30%">Potential Impact</th>
                </tr>
              </thead>
              <tbody>
                ${recs.slice(0, 4).map((rec: any) => `
                  <tr>
                    <td>
                      <strong>${rec.title}</strong>
                      <div style="font-size:11px; color:#64748b; margin-top:2px;">${rec.description}</div>
                    </td>
                    <td><span style="font-weight:700; color:#ef4444;">${rec.displayValue || 'High'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `}
    </div>
    `;
  }).join('')}

</body>
</html>
  `;

  // Launch Puppeteer to render to PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0px',
      bottom: '0px',
      left: '0px',
      right: '0px',
    },
  });

  await browser.close();
  return pdfBuffer;
}
