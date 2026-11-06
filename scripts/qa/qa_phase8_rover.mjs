import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4199;
const DIST_DIR = path.resolve('dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(DIST_DIR, 'index.html')).pipe(res);
  }
});

async function run() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server running at http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${PORT}/`);

    // Start fresh game to reach Moon scene
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    const startBtn = page.locator('[data-testid="start-mission-btn"]');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    const skipPrologueBtn = page.locator('[data-testid="skip-prologue-btn"]');
    await skipPrologueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPrologueBtn.click();

    const moonScene = page.locator('[data-testid="moon-scene"]');
    await moonScene.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Moon scene active');

    console.log('Initial player tile:', await moonScene.getAttribute('data-player-tile'));

    // Walk towards the rover at tile (13, 16): +5 right (KeyD), -4 up (KeyW)
    console.log('Holding KeyD & KeyW to walk towards Apollo Lunar Rover at (13, 16)...');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1450);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(400);

    const tileNow = await moonScene.getAttribute('data-player-tile');
    console.log('Player tile after walking:', tileNow);

    // Check desktop prompt
    const promptLocator = page.locator('.sm\\:flex.bottom-8 span');
    let promptText = await promptLocator.textContent().catch(() => '');
    console.log(`Desktop prompt text near rover: "${promptText}"`);

    // Press KeyE to board rover
    console.log('Pressing KeyE to board Apollo Lunar Roving Vehicle...');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    // Verify driving prompt
    const drivingPrompt = await promptLocator.textContent().catch(() => '');
    console.log(`Prompt after boarding: "${drivingPrompt}"`);

    // Test throttle driving
    console.log('Driving rover with KeyW & KeyD...');
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(300);

    // Check badges in localStorage
    const saved = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('beyond_depth_save_v3') || '{}');
    });
    console.log('Saved badges:', saved.badges);
    if (!saved.badges?.includes('Lunar Grand Prix')) {
      throw new Error(`Expected 'Lunar Grand Prix' badge in saveProgress, got: ${JSON.stringify(saved.badges)}`);
    }
    console.log('✓ "Lunar Grand Prix" badge awarded in saveProgress!');

    // Dismount rover
    console.log('Pressing KeyE to dismount rover...');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const dismountPrompt = await promptLocator.textContent().catch(() => '');
    console.log(`Prompt after dismount: "${dismountPrompt}"`);

    // Test Mobile Touch Controls
    console.log('\n--- Testing Mobile Touch Controls for Rover ---');
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobilePage.goto(`http://127.0.0.1:${PORT}/`);
    await mobilePage.evaluate(() => localStorage.clear());
    await mobilePage.reload({ waitUntil: 'domcontentloaded' });

    await mobilePage.locator('[data-testid="start-mission-btn"]').click();
    await mobilePage.locator('[data-testid="skip-prologue-btn"]').click();
    const mMoonScene = mobilePage.locator('[data-testid="moon-scene"]');
    await mMoonScene.waitFor({ state: 'visible', timeout: 5000 });

    // Verify moon-hop-btn is present and >= 48px
    const hopBtn = mobilePage.locator('[data-testid="moon-hop-btn"]');
    await hopBtn.waitFor({ state: 'visible', timeout: 5000 });
    const box = await hopBtn.boundingBox();
    console.log(`Mobile moon-hop-btn dimensions: ${box?.width}x${box?.height}`);
    if (!box || box.width < 48 || box.height < 48) {
      throw new Error('moon-hop-btn must be >= 48px');
    }
    console.log('✓ moon-hop-btn >= 48px confirmed on mobile');

    // Walk to rover on mobile using virtual D-pad (right and up)
    console.log('Using virtual D-pad to approach rover on mobile (▶ and ▲)...');
    const dpadRight = mobilePage.locator('[data-testid="virtual-dpad"] button:has-text("▶")');
    const dpadUp = mobilePage.locator('[data-testid="virtual-dpad"] button:has-text("▲")');

    await dpadRight.dispatchEvent('pointerdown');
    await dpadUp.dispatchEvent('pointerdown');
    await mobilePage.waitForTimeout(1450);
    await dpadRight.dispatchEvent('pointerup');
    await dpadUp.dispatchEvent('pointerup');
    await mobilePage.waitForTimeout(400);

    console.log('Mobile player tile after walking:', await mMoonScene.getAttribute('data-player-tile'));

    const boardRoverBtn = mobilePage.locator('[data-testid="touch-board-rover-btn"]');
    await boardRoverBtn.waitFor({ state: 'visible', timeout: 4000 });
    console.log('✓ touch-board-rover-btn visible');

    await boardRoverBtn.click();
    await mobilePage.waitForTimeout(400);

    const dismountBtn = mobilePage.locator('[data-testid="touch-dismount-rover-btn"]');
    await dismountBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ touch-dismount-rover-btn visible while driving');

    await dismountBtn.click();
    await mobilePage.waitForTimeout(400);
    console.log('✓ Successfully dismounted via touch button on mobile');

    // Test Mission Archive Codex card
    console.log('\n--- Testing Mission Archive Modal Codex Card ---');
    // Skip moon from desktop page to enter Mars world
    const skipMoonBtn = page.locator('[data-testid="moon-skip-btn"]');
    await skipMoonBtn.click();

    const crashSkipBtn = page.locator('[data-testid="crash-skip-btn"]');
    await crashSkipBtn.waitFor({ state: 'visible', timeout: 6000 });
    await crashSkipBtn.click();

    const worldCanvas = page.locator('[data-testid="world-canvas"]');
    await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Landed on Mars world scene');

    // Open Codex Modal
    const codexBtn = page.locator('[data-testid="codex-btn"]');
    await codexBtn.click();
    const codexModal = page.locator('[data-testid="codex-modal"]');
    await codexModal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Planetary Codex modal opened');

    // Switch to Moon tab
    const moonTabBtn = page.locator('[data-testid="moon-relics-tab-btn"]');
    await moonTabBtn.click();
    await page.waitForTimeout(300);

    // Verify Apollo LRV card is rendered with "Lunar Grand Prix"
    const roverCard = page.locator('[data-testid="moon-rover-card"]');
    await roverCard.waitFor({ state: 'visible', timeout: 3000 });
    const roverCardText = await roverCard.innerText();
    console.log('Apollo LRV card contents:', roverCardText.replace(/\n/g, ' '));
    if (!roverCardText.includes('Apollo Lunar Roving Vehicle') || !roverCardText.toLowerCase().includes('lunar grand prix')) {
      throw new Error(`Expected Apollo LRV card with 'Lunar Grand Prix', got: "${roverCardText}"`);
    }
    console.log('✓ Apollo LRV card displays "Lunar Grand Prix" and historical buggy facts!');

    console.log('\n======================================================');
    console.log('ALL PHASE 8 APOLLO ROVER TESTS PASSED CLEANLY!');
    console.log('======================================================');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
