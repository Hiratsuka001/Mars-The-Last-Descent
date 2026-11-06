import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4203;
const DIST_DIR = path.resolve('dist');
const OUTPUT_DIR = path.resolve('qa-screenshots/geology');

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
    console.log('\n======================================================');
    console.log('Phase 10: Geological Prospecting & Seismic Thumper QA');
    console.log('======================================================');

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${PORT}/?debug=1`);

    // Reset progress to clean state
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Start mission
    const startBtn = page.locator('[data-testid="start-mission-btn"]');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    // Skip prologue
    const skipPrologueBtn = page.locator('[data-testid="skip-prologue-btn"]');
    await skipPrologueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipPrologueBtn.click();

    const moonScene = page.locator('[data-testid="moon-scene"]');
    await moonScene.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Moon scene loaded successfully');

    // 1. Test Rock 1: Descartes Impact Melt Breccia at (20, 12)
    console.log('\n--- 1. Testing Descartes Impact Melt Breccia at (20, 12) ---');
    await page.evaluate(() => window.__moonTeleport(20, 12));
    await page.waitForTimeout(400);

    const promptLocator = page.locator('.sm\\:flex.bottom-8 span');
    const brecciaPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Breccia: "${brecciaPrompt}"`);
    if (!brecciaPrompt?.includes('Breccia') || !brecciaPrompt?.includes('Sample')) {
      throw new Error(`Expected prompt for Breccia, got: "${brecciaPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies Breccia');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_breccia_prompt.png') });

    // Sample Breccia
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const toast = page.locator('[data-testid="moon-relic-toast"]');
    const toastText1 = await toast.textContent().catch(() => '');
    console.log(`Toast 1 displayed: "${toastText1}"`);
    if (!toastText1?.includes('BRECCIA')) {
      throw new Error(`Expected toast mentioning BRECCIA, got: "${toastText1}"`);
    }
    console.log('✓ Toast confirmed: BRECCIA');

    const dialogue = page.locator('[data-testid="nova-dialogue"]');
    await dialogue.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Nova dialogue opened for Breccia');
    await page.keyboard.press('KeyE'); // Dismiss
    await page.waitForTimeout(400);

    // Verify HUD rocks counter: Rocks 1/3
    const rocksCounter = page.locator('[data-testid="moon-rocks-counter"]');
    await rocksCounter.waitFor({ state: 'visible', timeout: 3000 });
    const countText1 = await rocksCounter.textContent();
    console.log(`Rocks counter: "${countText1}"`);
    if (!countText1?.includes('1/3')) {
      throw new Error(`Expected Rocks 1/3, got: "${countText1}"`);
    }
    console.log('✓ Rocks counter reads 1/3');

    // 2. Test Rock 2: Mare Tranquillitatis Basalt at (38, 15)
    console.log('\n--- 2. Testing Mare Tranquillitatis Basalt at (38, 15) ---');
    await page.evaluate(() => window.__moonTeleport(38, 15));
    await page.waitForTimeout(400);

    const basaltPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Basalt: "${basaltPrompt}"`);
    if (!basaltPrompt?.includes('Basalt') || !basaltPrompt?.includes('Sample')) {
      throw new Error(`Expected prompt for Basalt, got: "${basaltPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies Basalt');

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const toastText2 = await toast.textContent().catch(() => '');
    console.log(`Toast 2 displayed: "${toastText2}"`);
    if (!toastText2?.includes('BASALT')) {
      throw new Error(`Expected toast mentioning BASALT, got: "${toastText2}"`);
    }
    console.log('✓ Toast confirmed: BASALT');

    await page.keyboard.press('KeyE'); // Dismiss dialogue
    await page.waitForTimeout(400);

    const countText2 = await rocksCounter.textContent();
    console.log(`Rocks counter: "${countText2}"`);
    if (!countText2?.includes('2/3')) {
      throw new Error(`Expected Rocks 2/3, got: "${countText2}"`);
    }
    console.log('✓ Rocks counter reads 2/3');

    // 3. Test Rock 3: The Genesis Rock at (57, 16)
    console.log('\n--- 3. Testing Genesis Rock at (57, 16) ---');
    await page.evaluate(() => window.__moonTeleport(57, 16));
    await page.waitForTimeout(400);

    const genesisPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Genesis Rock: "${genesisPrompt}"`);
    if (!genesisPrompt?.includes('Genesis Rock') || !genesisPrompt?.includes('Sample')) {
      throw new Error(`Expected prompt for Genesis Rock, got: "${genesisPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies Genesis Rock');

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const toastText3 = await toast.textContent().catch(() => '');
    console.log(`Toast 3 displayed: "${toastText3}"`);
    if (!toastText3?.includes('GEOLOGY KIT COMPLETE')) {
      throw new Error(`Expected completion toast, got: "${toastText3}"`);
    }
    console.log('✓ Toast confirmed: GEOLOGY KIT COMPLETE');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_geology_complete.png') });

    await page.keyboard.press('KeyE'); // Dismiss dialogue
    await page.waitForTimeout(400);

    const countText3 = await rocksCounter.textContent();
    console.log(`Rocks counter: "${countText3}"`);
    if (!countText3?.includes('3/3')) {
      throw new Error(`Expected Rocks 3/3, got: "${countText3}"`);
    }
    console.log('✓ Rocks counter reads 3/3');

    // 4. Test ALSEP Active Seismic Thumper at (33, 23)
    console.log('\n--- 4. Testing ALSEP Active Seismic Thumper at (33, 23) ---');
    await page.evaluate(() => window.__moonTeleport(33, 23));
    await page.waitForTimeout(400);

    const thumperPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Thumper: "${thumperPrompt}"`);
    if (!thumperPrompt?.includes('Active Seismic') || !thumperPrompt?.includes('Thumper')) {
      throw new Error(`Expected prompt for Thumper, got: "${thumperPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies Seismic Thumper');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_thumper_prompt.png') });

    // Detonate Thumper
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const thumperToast = await toast.textContent().catch(() => '');
    console.log(`Thumper Toast displayed: "${thumperToast}"`);
    if (!thumperToast?.includes('THUMPER DETONATED')) {
      throw new Error(`Expected detonation toast, got: "${thumperToast}"`);
    }
    console.log('✓ Toast confirmed: ALSEP SEISMIC THUMPER DETONATED');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_thumper_detonated.png') });

    await page.keyboard.press('KeyE'); // Dismiss dialogue
    await page.waitForTimeout(400);

    // 5. Verify Badges & Progress in localStorage
    console.log('\n--- 5. Verifying Badges & Stored Progress ---');
    const progress = await page.evaluate(() => {
      const raw = localStorage.getItem('beyond_depth_save_v3');
      return raw ? JSON.parse(raw) : null;
    });

    console.log('Badges in progress:', progress?.badges);
    console.log('MoonChapter data:', progress?.moonChapter);

    const expectedBadges = [
      'Impact Geologist',
      'Mare Vulcanologist',
      'Genesis Prospector',
      'Lunar Petrologist',
      'Seismic Sounder',
    ];
    for (const b of expectedBadges) {
      if (!progress?.badges?.includes(b)) {
        throw new Error(`Missing expected badge: "${b}"`);
      }
      console.log(`✓ Badge verified: "${b}"`);
    }

    if (progress?.moonChapter?.lunarRockIds?.length !== 3) {
      throw new Error(`Expected 3 lunarRockIds, got: ${progress?.moonChapter?.lunarRockIds?.length}`);
    }
    console.log('✓ 3 rock IDs persisted in moonChapter.lunarRockIds');

    if (!progress?.moonChapter?.thumperFired) {
      throw new Error('Expected thumperFired: true in moonChapter');
    }
    console.log('✓ thumperFired: true persisted in moonChapter');

    // 6. Test Mobile Touch Buttons
    console.log('\n--- 6. Testing Mobile Touch Controls ---');
    await page.setViewportSize({ width: 412, height: 915 });
    await page.waitForTimeout(300);

    // Teleport near rock
    await page.evaluate(() => window.__moonTeleport(20, 12));
    await page.waitForTimeout(400);
    const touchRockBtn = page.locator('[data-testid="touch-rock-btn"]');
    await touchRockBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Mobile touch-rock-btn is visible near rock');

    // Teleport near thumper
    await page.evaluate(() => window.__moonTeleport(33, 23));
    await page.waitForTimeout(400);
    const touchThumperBtn = page.locator('[data-testid="touch-thumper-btn"]');
    await touchThumperBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Mobile touch-thumper-btn is visible near seismic thumper');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_mobile_touch_controls.png') });

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);

    // 7. Verify Codex Modal (MissionArchiveModal) Moon Tab
    console.log('\n--- 7. Testing Codex Integration (Mission Archive Modal) ---');
    // Skip Moon to transition to Chapter 1
    const skipBtn = page.locator('[data-testid="moon-skip-btn"]');
    await skipBtn.click();
    await page.waitForTimeout(1000);

    const crashInterlude = page.locator('[data-testid="crash-interlude"]');
    if (await crashInterlude.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Tap to beat 2, then beat 3
      await crashInterlude.click();
      await page.waitForTimeout(300);
      await crashInterlude.click();
      await page.waitForTimeout(300);

      const continueBtn = page.locator('[data-testid="crash-continue-btn"]');
      await continueBtn.waitFor({ state: 'visible', timeout: 4000 });
      await continueBtn.click();
      await crashInterlude.waitFor({ state: 'detached', timeout: 5000 });
    }

    // Wait for world scene
    const worldScene = page.locator('[data-testid="world-scene"]');
    await worldScene.waitFor({ state: 'visible', timeout: 8000 });

    // Open Codex via HUD
    const codexBtn = page.locator('[data-testid="codex-btn"]');
    await codexBtn.waitFor({ state: 'visible', timeout: 5000 });
    await codexBtn.click();
    await page.waitForTimeout(500);

    // Switch to Moon Tab
    const moonTab = page.locator('[data-testid="moon-relics-tab-btn"]');
    await moonTab.waitFor({ state: 'visible', timeout: 3000 });
    await moonTab.click();
    await page.waitForTimeout(500);

    // Verify Thumper Card
    const thumperCard = page.locator('[data-testid="moon-seismic-thumper-card"]');
    await thumperCard.waitFor({ state: 'visible', timeout: 3000 });
    const thumperCardText = await thumperCard.textContent();
    console.log(`Thumper Card Text snippet: ${thumperCardText?.slice(0, 120)}...`);
    if (!thumperCardText?.includes('Active Seismic') || !thumperCardText?.includes('Seismic Sounder')) {
      throw new Error(`Thumper card missing seismic data: "${thumperCardText}"`);
    }
    console.log('✓ Codex Active Seismic Experiment Card confirmed');

    // Verify 3 Rock Cards
    const expectedBadgesByRock = {
      rock_breccia: 'Impact Geologist',
      rock_basalt: 'Mare Vulcanologist',
      rock_genesis: 'Genesis Prospector',
    };
    for (const rkId of ['rock_breccia', 'rock_basalt', 'rock_genesis']) {
      const rockCard = page.locator(`[data-testid="moon-rock-card-${rkId}"]`);
      await rockCard.waitFor({ state: 'visible', timeout: 3000 });
      const rockCardText = await rockCard.textContent();
      console.log(`Rock Card [${rkId}]: ${rockCardText?.slice(0, 100)}...`);
      if (!rockCardText?.includes(expectedBadgesByRock[rkId])) {
        throw new Error(`Expected ${expectedBadgesByRock[rkId]} on rock card [${rkId}]`);
      }
      console.log(`✓ Rock Card [${rkId}] confirmed`);
    }

    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_codex_moon_geology.png') });

    console.log('\n======================================================');
    console.log('Phase 10: ALL GEOLOGY & SEISMIC CHECKS PASSED (100%)');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ QA TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

run();
