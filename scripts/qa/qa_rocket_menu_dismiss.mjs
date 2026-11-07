import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const PORT = 4181;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
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

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[Browser Error]`, msg.text());
    });

    await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });

    // Wait for main menu
    const mainMenu = page.locator('[data-testid="main-menu"]');
    await mainMenu.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Main menu loaded');

    // Start mission
    const startBtn = page.locator('[data-testid="start-mission-btn"]');
    await startBtn.click();

    // Skip prologue if present
    const skipPrologueBtn = page.locator('[data-testid="skip-prologue-btn"]');
    try {
      await skipPrologueBtn.waitFor({ state: 'visible', timeout: 3000 });
      await skipPrologueBtn.click();
    } catch {}

    // Skip Moon if present
    const moonSkipBtn = page.locator('[data-testid="moon-skip-btn"]');
    try {
      await moonSkipBtn.waitFor({ state: 'visible', timeout: 3000 });
      await moonSkipBtn.click();
    } catch {}

    // Skip crash interlude if present
    const crashSkipBtn = page.locator('[data-testid="crash-skip-btn"]');
    try {
      await crashSkipBtn.waitFor({ state: 'visible', timeout: 3000 });
      await crashSkipBtn.click();
    } catch {}

    // Wait for world canvas on Mars
    const worldCanvas = page.locator('[data-testid="world-canvas"]');
    await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ World canvas loaded on Mars');
    await page.waitForTimeout(600);

    // Dismiss any Nova dialogue if present
    try {
      const novaDialogue = page.locator('[data-testid="nova-dialogue"]');
      if (await novaDialogue.isVisible()) {
        const novaDismiss = page.locator('[data-testid="nova-dialogue-action-btn"], [data-testid="nova-dialogue-dismiss-btn"]').first();
        if (await novaDismiss.isVisible()) {
          await novaDismiss.click();
        } else {
          await page.keyboard.press('Space');
        }
        await novaDialogue.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}

    // Teleport directly to Crashed Ship landmark
    console.log('  Teleporting directly to Crashed Spaceship (Rocket)...');
    await page.keyboard.press('F3');
    const tpShipBtn = page.locator('[data-testid="tp-ship-btn"]');
    await tpShipBtn.waitFor({ state: 'visible', timeout: 3000 });
    await tpShipBtn.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('F3');
    await page.waitForTimeout(300);

    // Wait for proximity interact prompt near the crashed spaceship
    const shipPrompt = page.locator('[data-testid="interact-prompt"]');
    await shipPrompt.waitFor({ state: 'visible', timeout: 5000 });
    const promptText = await shipPrompt.textContent();
    console.log(`✓ Proximity interact prompt visible near rocket: "${promptText?.trim()}"`);

    // TEST 1: Click prompt to open terminal, then CLICK OFF (backdrop click) to dismiss
    console.log('\n--- TEST 1: Click off (backdrop click) to dismiss ---');
    await shipPrompt.click();
    const terminalModal = page.locator('[data-testid="ship-terminal-modal"]');
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Ship terminal modal opened');

    // Click outside the modal card (top-left backdrop at 20, 20)
    await page.mouse.click(20, 20);
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });
    console.log('✓ Successfully clicked off of the menu (backdrop click dismissed modal)');

    // TEST 2: Reopen terminal, press Escape to dismiss
    console.log('\n--- TEST 2: Escape key to dismiss ---');
    await shipPrompt.waitFor({ state: 'visible', timeout: 5000 });
    await shipPrompt.click();
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Ship terminal modal opened again');

    await page.keyboard.press('Escape');
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });
    console.log('✓ Escape key dismissed modal');

    // TEST 3: Reopen terminal, click [X] close button
    console.log('\n--- TEST 3: [X] close button to dismiss ---');
    await shipPrompt.waitFor({ state: 'visible', timeout: 5000 });
    await shipPrompt.click();
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });

    const closeBtn = page.locator('[data-testid="close-ship-terminal-btn"]');
    await closeBtn.waitFor({ state: 'visible', timeout: 3000 });
    await closeBtn.click();
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });
    console.log('✓ [X] close button dismissed modal');

    // TEST 4: Reopen terminal, click "Exit Terminal" button
    console.log('\n--- TEST 4: "Exit Terminal" button to dismiss ---');
    await shipPrompt.waitFor({ state: 'visible', timeout: 5000 });
    await shipPrompt.click();
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });

    const exitBtn = page.locator('[data-testid="exit-ship-terminal-btn"]');
    await exitBtn.waitFor({ state: 'visible', timeout: 3000 });
    await exitBtn.click();
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });
    console.log('✓ "Exit Terminal" button dismissed modal');

    // TEST 5: Small viewport (e.g. 800x480 landscape mobile / netbook)
    console.log('\n--- TEST 5: Small viewport (800x480) responsiveness & click off ---');
    await page.setViewportSize({ width: 800, height: 480 });
    await page.waitForTimeout(300);

    // Open terminal via E key
    await page.keyboard.press('KeyE');
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });

    // Verify [X] and "Exit Terminal" buttons are inside viewport bounds
    const closeBox = await closeBtn.boundingBox();
    const exitBox = await exitBtn.boundingBox();
    console.log(`  Close button position: y=${Math.round(closeBox.y)}, height=${Math.round(closeBox.height)}`);
    console.log(`  Exit button position: y=${Math.round(exitBox.y)}, height=${Math.round(exitBox.height)}`);

    if (closeBox.y < 0 || closeBox.y + closeBox.height > 480) {
      throw new Error(`Close button is outside viewport on small screen: y=${closeBox.y}`);
    }
    if (exitBox.y < 0 || exitBox.y + exitBox.height > 480) {
      throw new Error(`Exit button is outside viewport on small screen: y=${exitBox.y}`);
    }
    console.log('✓ Both close and exit buttons fit completely inside 480px viewport!');

    // Click off in small viewport (top-left backdrop at 20, 20)
    await page.mouse.click(20, 20);
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });
    console.log('✓ Click off on small viewport dismissed modal');

    console.log('\n========================================');
    console.log('ALL SHIP TERMINAL DISMISS TESTS PASSED!');
    console.log('========================================');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
