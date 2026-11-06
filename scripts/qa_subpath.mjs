import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4197;
const DIST_DIR = path.resolve('dist');
const OUTPUT_DIR = path.resolve('qa-screenshots/final');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Static server supporting both root '/' and subpath '/some/sub/path/'
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  const subpathPrefix = '/some/sub/path';
  if (reqPath.startsWith(subpathPrefix)) {
    reqPath = reqPath.slice(subpathPrefix.length);
  }

  if (reqPath === '' || reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.join(DIST_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + req.url);
  }
});

async function testPath(browser, testConfig) {
  const { label, basePath, viewport, isMobile, blockFonts, captureScreenshotName } = testConfig;
  console.log(`\n--- Testing ${label} (Viewport: ${viewport.width}x${viewport.height}, blockFonts: ${blockFonts}) ---`);

  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const failedRequests = [];
  const externalRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore network errors caused specifically by font blocking
      if (blockFonts && (txt.includes('fonts.googleapis.com') || txt.includes('fonts.gstatic.com') || txt.includes('net::ERR_FAILED'))) {
        return;
      }
      consoleErrors.push(txt);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  page.on('response', (response) => {
    const url = response.url();
    if (!response.ok()) {
      if (blockFonts && (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))) {
        return;
      }
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (blockFonts && (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))) {
      return;
    }
    failedRequests.push(`${request.failure()?.errorText || 'failed'} ${url}`);
  });

  // Track all requests to ensure only local server and Google Fonts are contacted
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return;
    }
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      externalRequests.push(url);
      return;
    }
    externalRequests.push(`UNEXPECTED_EXTERNAL: ${url}`);
  });

  // Block Google Fonts if required to verify fallback rendering
  if (blockFonts) {
    await page.route('**fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**fonts.gstatic.com/**', (route) => route.abort());
  }

  const targetUrl = `http://127.0.0.1:${PORT}${basePath}`;
  console.log(`  Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  // 1. Verify Main Menu loads
  const mainMenu = page.locator('[data-testid="main-menu"]');
  await mainMenu.waitFor({ state: 'visible', timeout: 8000 });
  const startBtn = page.locator('[data-testid="start-mission-btn"]');
  await startBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Main menu loaded cleanly');

  // Capture screenshot if requested
  if (captureScreenshotName) {
    const shotPath = path.join(OUTPUT_DIR, captureScreenshotName);
    await page.screenshot({ path: shotPath });
    console.log(`  [OK Captured] ${captureScreenshotName} (${viewport.width}x${viewport.height})`);
  }

  // 2. Production Debug Hooks Audit (without ?debug=1)
  const exposedDebugHooks = await page.evaluate(() => {
    const hooks = Object.keys(window).filter((k) => k.startsWith('__'));
    return hooks;
  });
  console.log('  Exposed window.__* hooks without ?debug=1:', exposedDebugHooks);
  if (exposedDebugHooks.length > 0) {
    throw new Error(`Production build exposed debug hooks without ?debug=1: ${JSON.stringify(exposedDebugHooks)}`);
  }
  console.log('  [PASS] No debug hooks exposed without ?debug=1');

  // 3. Start New Game -> Prologue Scene
  console.log('  Clicking Start Mission...');
  await startBtn.click();
  const skipPrologueBtn = page.locator('[data-testid="skip-prologue-btn"]');
  await skipPrologueBtn.waitFor({ state: 'visible', timeout: 6000 });
  console.log('  [PASS] Prologue scene active');

  // 4. Skip Prologue -> Moon Scene
  console.log('  Skipping prologue...');
  await skipPrologueBtn.click();
  const moonScene = page.locator('[data-testid="moon-scene"]');
  await moonScene.waitFor({ state: 'visible', timeout: 6000 });
  console.log('  [PASS] Moon scene active (data-testid="moon-scene")');

  // 5. Check network errors and console errors
  const unexpectedExternal = externalRequests.filter((u) => u.startsWith('UNEXPECTED_EXTERNAL'));
  if (unexpectedExternal.length > 0) {
    throw new Error(`Unexpected external requests detected: ${JSON.stringify(unexpectedExternal)}`);
  }
  console.log('  [PASS] Only local server and Google Fonts requested (zero unexpected external endpoints)');

  if (failedResponses.length > 0) {
    throw new Error(`Failed responses (404/500): ${JSON.stringify(failedResponses)}`);
  }
  if (failedRequests.length > 0) {
    throw new Error(`Failed network requests: ${JSON.stringify(failedRequests)}`);
  }
  console.log('  [PASS] Zero failed network requests / 404s');

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${JSON.stringify(consoleErrors)}`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Uncaught page errors: ${JSON.stringify(pageErrors)}`);
  }
  console.log('  [PASS] Zero console errors / uncaught exceptions');

  await page.close();
  await context.close();
}

async function runSubpathQA() {
  console.log('======================================================');
  console.log('Deploy-1: Static Subpath & Fallback Fonts QA Suite');
  console.log('======================================================');

  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  console.log(`QA Static server listening on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Root path "/" - Desktop (1366x768) with fonts enabled
    await testPath(browser, {
      label: 'Root path "/" (Desktop)',
      basePath: '/',
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      blockFonts: false,
    });

    // 2. Root path "/" - Desktop (1366x768) with Google Fonts BLOCKED (fallback fonts test)
    await testPath(browser, {
      label: 'Root path "/" with Google Fonts BLOCKED',
      basePath: '/',
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      blockFonts: true,
    });

    // 3. Subpath "/some/sub/path/" - Desktop (1366x768)
    await testPath(browser, {
      label: 'Subpath "/some/sub/path/" (Desktop)',
      basePath: '/some/sub/path/',
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      blockFonts: false,
      captureScreenshotName: 'subpath_menu_desktop.png',
    });

    // 4. Subpath "/some/sub/path/" - Mobile (390x844)
    await testPath(browser, {
      label: 'Subpath "/some/sub/path/" (Mobile)',
      basePath: '/some/sub/path/',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      blockFonts: false,
      captureScreenshotName: 'subpath_menu_mobile.png',
    });

    // 5. Subpath "/some/sub/path/" - with Google Fonts BLOCKED
    await testPath(browser, {
      label: 'Subpath "/some/sub/path/" with Google Fonts BLOCKED',
      basePath: '/some/sub/path/',
      viewport: { width: 1366, height: 768 },
      isMobile: false,
      blockFonts: true,
    });

    console.log('\n======================================================');
    console.log('ALL DEPLOY-1 SUBPATH & HOSTING CHECKS PASSED PERFECTLY!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runSubpathQA().catch((err) => {
  console.error('[FATAL Subpath QA Error]', err);
  server.close();
  process.exit(1);
});
