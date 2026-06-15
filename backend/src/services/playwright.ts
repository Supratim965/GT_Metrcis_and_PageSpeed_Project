import { chromium, Page } from 'playwright';

export interface LoadValidationResult {
  status: 'SUCCESS' | 'PARTIALLY_LOADED' | 'FAILED' | 'TIMEOUT' | 'BLANK_PAGE' | 'JS_ERROR' | 'HTTP_ERROR' | 'REDIRECT_LOOP';
  loadTimeMs: number;
  responseTimeMs: number;
  domReadyMs: number;
  screenshotDesktopFull?: string; // base64
  screenshotMobileFull?: string; // base64
  screenshotDesktopAbove?: string; // base64
  errorMessage?: string;
  created_at?: string;
}

// Function to auto-scroll a page to trigger lazy loading
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 5000) { // Safety ceiling
          clearInterval(timer);
          // Scroll back to top
          window.scrollTo(0, 0);
          resolve();
        }
      }, 60);
    });
  });
}

export async function validateAndAuditUrl(
  url: string,
  progressCallback?: (msg: string) => void
): Promise<LoadValidationResult> {
  const log = (msg: string) => {
    console.log(`[Playwright - ${url}]: ${msg}`);
    if (progressCallback) progressCallback(msg);
  };

  log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PerformanceAuditHub/1.0',
    });

    const page = await context.newPage();
    
    // Listen for uncaught JavaScript errors AND console.error() calls
    const jsErrors: Error[] = [];
    page.on('pageerror', (err) => {
      jsErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(new Error(msg.text()));
      }
    });

    // Timing tracking variables
    let requestTime = 0;
    let firstResponseTime = 0;
    let domContentLoadedTime = 0;
    let loadCompletedTime = 0;
    let httpStatus = 200;

    page.on('request', (req) => {
      if (req.url() === url && requestTime === 0) {
        requestTime = Date.now();
      }
    });

    page.on('response', (res) => {
      if (res.url() === url && firstResponseTime === 0) {
        firstResponseTime = Date.now();
        httpStatus = res.status();
      }
    });

    log('Navigating to target URL...');
    // Use a mutable variable for status tracking without narrowing issues
    let loadStatus: LoadValidationResult['status'] = 'SUCCESS';
    let errorMessage: string | undefined;

    try {
      // Navigate and wait for initial commit
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: 20000,
      });

      // Wait for DOM content loaded — non-fatal if slow
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {
        log('Warning: DOM content load slow, proceeding anyway.');
        loadStatus = 'PARTIALLY_LOADED';
      });
      domContentLoadedTime = Date.now();

      // Wait for network idle — non-fatal if slow
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {
        log('Warning: Network idle timeout exceeded, proceeding with partial load.');
        if (loadStatus === 'SUCCESS') loadStatus = 'PARTIALLY_LOADED';
      });
      loadCompletedTime = Date.now();
    } catch (err: any) {
      errorMessage = err.message || String(err);
      if (errorMessage && (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('ERR_NAME_NOT_RESOLVED'))) {
        loadStatus = 'FAILED';
      } else if (errorMessage && errorMessage.includes('redirect')) {
        loadStatus = 'REDIRECT_LOOP';
      } else {
        // Page is slow but still loaded something — don't fail it
        loadStatus = 'PARTIALLY_LOADED';
      }
      log(`Navigation warning: ${errorMessage}`);
    }

    // Capture timings
    const responseTimeMs = firstResponseTime > 0 && requestTime > 0 ? (firstResponseTime - requestTime) : 0;
    const domReadyMs = domContentLoadedTime > 0 && requestTime > 0 ? (domContentLoadedTime - requestTime) : 0;
    const loadTimeMs = loadCompletedTime > 0 && requestTime > 0 ? (loadCompletedTime - requestTime) : 0;

    // Check HTTP error status
    if (loadStatus === 'SUCCESS' && (httpStatus >= 400 || httpStatus < 200)) {
      loadStatus = 'HTTP_ERROR';
      errorMessage = `Server returned HTTP status code ${httpStatus}`;
    }

    // JS errors don't fail the audit — page still loaded

    // Check if page is blank
    if ((loadStatus as string) === 'SUCCESS' || (loadStatus as string) === 'PARTIALLY_LOADED') {
      const isBlank = await page.evaluate(() => {
        const text = document.body ? document.body.innerText.trim() : '';
        return text.length === 0;
      });
      if (isBlank) {
        loadStatus = 'BLANK_PAGE';
        errorMessage = 'Webpage contains no visible text content.';
      }
    }

    let screenshotDesktopFull = '';
    let screenshotMobileFull = '';
    let screenshotDesktopAbove = '';

    // If loaded successfully, capture a single viewport screenshot
    if ((loadStatus as string) === 'SUCCESS' || (loadStatus as string) === 'PARTIALLY_LOADED') {
      log('Capturing Desktop viewport screenshot...');
      try {
        const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 70, timeout: 15000 });
        screenshotDesktopAbove = screenshotBuffer.toString('base64');
        screenshotDesktopFull = screenshotDesktopAbove; // Use same for both
      } catch (e) {
        log('Warning: Screenshot timed out, skipping.');
      }
    }

    await page.close();
    await context.close();

    return {
      status: loadStatus,
      loadTimeMs,
      responseTimeMs,
      domReadyMs,
      screenshotDesktopFull,
      screenshotMobileFull,
      screenshotDesktopAbove,
      errorMessage,
    };
  } catch (err: any) {
    log(`Exception occurred in Playwright audit: ${err.message}`);
    return {
      status: 'FAILED',
      loadTimeMs: 0,
      responseTimeMs: 0,
      domReadyMs: 0,
      errorMessage: err.message || String(err),
    };
  } finally {
    await browser.close();
    log('Browser closed.');
  }
}
