import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4202;
const DIST_DIR = path.resolve('dist');
const OUTPUT_DIR = path.resolve('qa-screenshots/monuments');

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
    console.log('Phase 9: Historical Lunar Monuments & Pioneers QA Test');
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

    // 1. Visit Surveyor 3 Robotic Probe at (31, 14)
    console.log('\n--- 1. Testing Surveyor 3 (Apollo 12 / Ocean of Storms) ---');
    await page.evaluate(() => window.__moonTeleport(31, 14));
    await page.waitForTimeout(400);

    const promptLocator = page.locator('.sm\\:flex.bottom-8 span');
    const surveyorPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Surveyor 3: "${surveyorPrompt}"`);
    if (!surveyorPrompt?.includes('Surveyor 3') || !surveyorPrompt?.includes('INSPECT')) {
      throw new Error(`Expected prompt for Surveyor 3, got: "${surveyorPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies Surveyor 3');

    // Interact with Surveyor 3
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    // Verify toast
    const toast = page.locator('[data-testid="moon-relic-toast"]');
    const toastText = await toast.textContent().catch(() => '');
    console.log(`Toast displayed: "${toastText}"`);
    if (!toastText?.includes('SURVEYOR 3')) {
      throw new Error(`Expected toast mentioning SURVEYOR 3, got: "${toastText}"`);
    }
    console.log('✓ Toast confirmed: SURVEYOR 3');

    // Verify Nova dialogue
    const dialogue = page.locator('[data-testid="nova-dialogue"]');
    await dialogue.waitFor({ state: 'visible', timeout: 3000 });
    const dialogueText = await dialogue.textContent();
    console.log(`Dialogue text: "${dialogueText}"`);
    if (!dialogueText?.includes('Streptococcus') && !dialogueText?.includes('Surveyor 3')) {
      throw new Error(`Expected dialogue mentioning Streptococcus/Surveyor 3, got: "${dialogueText}"`);
    }
    console.log('✓ Dialogue confirmed with Streptococcus survival telemetry');

    // Dismiss dialogue
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);

    // Verify Monuments Counter in HUD
    const monumentsCounter = page.locator('[data-testid="moon-monuments-counter"]');
    await monumentsCounter.waitFor({ state: 'visible', timeout: 3000 });
    const counterText = await monumentsCounter.textContent();
    console.log(`Monuments HUD counter: "${counterText}"`);
    if (!counterText?.includes('1/2')) {
      throw new Error(`Expected Monuments 1/2 in HUD, got: "${counterText}"`);
    }
    console.log('✓ HUD counter updated: Monuments 1/2');

    // Verify Silent Surveyor badge in localStorage
    let savedProgress = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('beyond_depth_save_v3') || '{}');
    });
    console.log('Saved badges so far:', savedProgress.badges);
    if (!savedProgress.badges?.includes('Silent Surveyor')) {
      throw new Error(`Expected 'Silent Surveyor' badge, got: ${JSON.stringify(savedProgress.badges)}`);
    }
    console.log('✓ "Silent Surveyor" badge awarded and persisted');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'surveyor3_visited.png') });

    // 2. Visit The "Fallen Astronaut" Memorial at (52, 8)
    console.log('\n--- 2. Testing The "Fallen Astronaut" Memorial (Apollo 15 / Hadley Rille) ---');
    await page.evaluate(() => window.__moonTeleport(52, 8));
    await page.waitForTimeout(400);

    // If northern horizon transmission triggers, dismiss it
    const dismissBtn = page.locator('[data-testid="nova-dialogue-dismiss-btn"]');
    if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Dismissing northern horizon terminator transmission...');
      await dismissBtn.click();
      await page.waitForTimeout(300);
    }

    const fallenPrompt = await promptLocator.textContent();
    console.log(`Desktop prompt near Fallen Astronaut: "${fallenPrompt}"`);
    if (!fallenPrompt?.includes('Fallen Astronaut') || !fallenPrompt?.includes('PAY RESPECTS')) {
      throw new Error(`Expected prompt for Fallen Astronaut, got: "${fallenPrompt}"`);
    }
    console.log('✓ Desktop prompt correctly identifies The "Fallen Astronaut"');

    // Interact with Fallen Astronaut
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);

    const memorialToastText = await toast.textContent().catch(() => '');
    console.log(`Toast displayed: "${memorialToastText}"`);
    if (!memorialToastText?.includes('FALLEN ASTRONAUT')) {
      throw new Error(`Expected toast mentioning FALLEN ASTRONAUT, got: "${memorialToastText}"`);
    }
    console.log('✓ Toast confirmed: THE FALLEN ASTRONAUT');

    const memorialDialogueText = await dialogue.textContent();
    console.log(`Dialogue text: "${memorialDialogueText}"`);
    if (!memorialDialogueText?.includes('solemn moment') && !memorialDialogueText?.includes('14')) {
      throw new Error(`Expected dialogue mentioning solemn moment / 14 space pioneers, got: "${memorialDialogueText}"`);
    }
    console.log('✓ Dialogue confirmed with solemn memorial text');

    // Dismiss dialogue
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);

    const counterText2 = await monumentsCounter.textContent();
    console.log(`Monuments HUD counter: "${counterText2}"`);
    if (!counterText2?.includes('2/2')) {
      throw new Error(`Expected Monuments 2/2 in HUD, got: "${counterText2}"`);
    }
    console.log('✓ HUD counter updated: Monuments 2/2');

    savedProgress = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('beyond_depth_save_v3') || '{}');
    });
    console.log('Saved badges now:', savedProgress.badges);
    if (!savedProgress.badges?.includes('Cosmic Vanguard')) {
      throw new Error(`Expected 'Cosmic Vanguard' badge, got: ${JSON.stringify(savedProgress.badges)}`);
    }
    console.log('✓ "Cosmic Vanguard" badge awarded and persisted');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'fallen_astronaut_visited.png') });

    // 3. Test Mobile Touch Controls for Monuments
    console.log('\n--- 3. Testing Mobile Touch Controls for Monuments ---');
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobilePage.goto(`http://127.0.0.1:${PORT}/?debug=1`);
    await mobilePage.evaluate(() => localStorage.clear());
    await mobilePage.reload({ waitUntil: 'domcontentloaded' });

    await mobilePage.locator('[data-testid="start-mission-btn"]').click();
    await mobilePage.locator('[data-testid="skip-prologue-btn"]').click();
    const mMoonScene = mobilePage.locator('[data-testid="moon-scene"]');
    await mMoonScene.waitFor({ state: 'visible', timeout: 5000 });

    // Teleport to Surveyor 3 on mobile
    await mobilePage.evaluate(() => window.__moonTeleport(31, 14));
    await mobilePage.waitForTimeout(400);

    const touchMonumentBtn = mobilePage.locator('[data-testid="touch-monument-btn"]');
    await touchMonumentBtn.waitFor({ state: 'visible', timeout: 3000 });
    const btnText = await touchMonumentBtn.textContent();
    console.log(`Mobile touch-monument-btn text: "${btnText}"`);
    if (!btnText?.includes('INSPECT SURVEYOR 3')) {
      throw new Error(`Expected touch-monument-btn with text INSPECT SURVEYOR 3, got: "${btnText}"`);
    }
    console.log('✓ touch-monument-btn visible with proper action label');

    await touchMonumentBtn.click();
    await mobilePage.waitForTimeout(400);

    const mDialogue = mobilePage.locator('[data-testid="nova-dialogue"]');
    await mDialogue.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Dialogue opened via touch-monument-btn on mobile');

    await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_touch_monument.png') });
    await mobilePage.close();

    // 4. Test Codex / MissionArchiveModal Entries
    console.log('\n--- 4. Testing Planetary Exploration Codex Integration ---');
    const skipMoonBtn = page.locator('[data-testid="moon-skip-btn"]');
    await skipMoonBtn.click();
    await page.waitForTimeout(500);

    // Handle crash interlude beats if present
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

    const codexModal = page.locator('[data-testid="codex-modal"]');
    await codexModal.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Codex modal opened');

    // Click Moon tab
    const moonTabBtn = page.locator('[data-testid="moon-relics-tab-btn"]');
    await moonTabBtn.waitFor({ state: 'visible', timeout: 3000 });
    await moonTabBtn.click();
    await page.waitForTimeout(300);

    // Verify Fallen Astronaut Card
    const fallenCard = page.locator('[data-testid="moon-monument-fallen-astronaut"]');
    await fallenCard.waitFor({ state: 'visible', timeout: 3000 });
    const fallenCardText = await fallenCard.textContent();
    console.log(`Fallen Astronaut Codex card: "${fallenCardText?.slice(0, 100)}..."`);
    if (!fallenCardText?.includes('Cosmic Vanguard') || !fallenCardText?.includes('Fallen Astronaut')) {
      throw new Error(`Expected Fallen Astronaut card to show Cosmic Vanguard badge, got: "${fallenCardText}"`);
    }
    console.log('✓ Fallen Astronaut card verified with "Cosmic Vanguard" badge');

    // Verify Surveyor 3 Card
    const surveyorCard = page.locator('[data-testid="moon-monument-surveyor3"]');
    await surveyorCard.waitFor({ state: 'visible', timeout: 3000 });
    const surveyorCardText = await surveyorCard.textContent();
    console.log(`Surveyor 3 Codex card: "${surveyorCardText?.slice(0, 100)}..."`);
    if (!surveyorCardText?.includes('Silent Surveyor') || !surveyorCardText?.includes('Surveyor 3')) {
      throw new Error(`Expected Surveyor 3 card to show Silent Surveyor badge, got: "${surveyorCardText}"`);
    }
    console.log('✓ Surveyor 3 card verified with "Silent Surveyor" badge');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'codex_monuments_verified.png') });

    console.log('\n======================================================');
    console.log('ALL PHASE 9 MONUMENT QA CHECKS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('\nQA TEST FAILED:', err);
  process.exit(1);
});
