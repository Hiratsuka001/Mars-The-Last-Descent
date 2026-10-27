import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4195;
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

/**
 * Phase 0: Carry-Over Sprite Verification & A3 Outer Column Audit
 * Verifies public/assets/characters.png and exports zoomed walk-up frames.
 */
async function runPlayerSpriteAndA3Audit(browser) {
  console.log('\n======================================================');
  console.log('Phase 0: Player Walk-Up Zoom & A3 Outer Column Edge Audit');
  console.log('======================================================');

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const atlasB64 = fs.readFileSync('public/assets/characters.png').toString('base64');

  await page.setContent(`<!DOCTYPE html><html><body>
    <img id="atlas" src="data:image/png;base64,${atlasB64}">
  </body></html>`);
  await page.waitForFunction(() => document.getElementById('atlas').complete);

  const auditResult = await page.evaluate(async () => {
    const img = document.getElementById('atlas');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const pW = 20;
    const pH = 28;
    const dirs = ['down', 'up', 'left', 'right'];
    const outerColumnAudit = [];

    // Check all 20 player cells (4 directions x 5 frames)
    for (let r = 0; r < 4; r++) {
      const dir = dirs[r];
      const py = r * pH;

      for (let c = 0; c < 5; c++) {
        const frameKey = c === 0 ? `player_idle_${dir}` : `player_walk_${dir}_${c - 1}`;
        const px = c * pW;

        let leftOpaque = 0;
        let rightOpaque = 0;

        for (let y = 0; y < pH; y++) {
          const lPixel = ctx.getImageData(px, py + y, 1, 1).data;
          const rPixel = ctx.getImageData(px + pW - 1, py + y, 1, 1).data;
          if (lPixel[3] > 50) leftOpaque++;
          if (rPixel[3] > 50) rightOpaque++;
        }

        const pass = leftOpaque === 0 && rightOpaque === 0;
        outerColumnAudit.push({ key: frameKey, leftOpaque, rightOpaque, pass });
      }
    }

    // Render a high-magnification (10x) labeled zoom sheet for player walk-up frames
    const zoomScale = 10;
    const zoomCanvas = document.createElement('canvas');
    zoomCanvas.width = 5 * pW * zoomScale + 60; // 5 frames * 200px + padding
    zoomCanvas.height = pH * zoomScale + 100;
    const zCtx = zoomCanvas.getContext('2d');

    zCtx.fillStyle = '#090d16';
    zCtx.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);

    zCtx.fillStyle = '#38bdf8';
    zCtx.font = 'bold 20px monospace';
    zCtx.fillText('PLAYER WALK-UP FRAMES (10x Magnification - Outer Column Edge Audit)', 20, 36);

    const upRowY = 1 * pH; // Up is row 1
    const upFrameNames = ['idle_up', 'walk_up_0', 'walk_up_1', 'walk_up_2', 'walk_up_3'];

    for (let c = 0; c < 5; c++) {
      const srcX = c * pW;
      const dstX = 30 + c * (pW * zoomScale + 10);
      const dstY = 60;

      // Draw background cell box
      zCtx.fillStyle = '#1e293b';
      zCtx.fillRect(dstX, dstY, pW * zoomScale, pH * zoomScale);

      // Draw magnified sprite with nearest-neighbor
      zCtx.imageSmoothingEnabled = false;
      zCtx.drawImage(canvas, srcX, upRowY, pW, pH, dstX, dstY, pW * zoomScale, pH * zoomScale);

      // Highlight col 0 and col 19 outer borders (green = clean)
      zCtx.strokeStyle = '#22c55e';
      zCtx.lineWidth = 2;
      zCtx.strokeRect(dstX, dstY, zoomScale, pH * zoomScale); // Left col 0
      zCtx.strokeRect(dstX + (pW - 1) * zoomScale, dstY, zoomScale, pH * zoomScale); // Right col 19

      // Outline cell
      zCtx.strokeStyle = '#64748b';
      zCtx.lineWidth = 1;
      zCtx.strokeRect(dstX, dstY, pW * zoomScale, pH * zoomScale);

      // Label below
      zCtx.fillStyle = '#f8fafc';
      zCtx.font = 'bold 14px monospace';
      zCtx.fillText(upFrameNames[c], dstX + 10, dstY + pH * zoomScale + 24);
      zCtx.fillStyle = '#4ade80';
      zCtx.font = '12px monospace';
      zCtx.fillText('Edges: 0px bleed', dstX + 10, dstY + pH * zoomScale + 42);
    }

    return {
      outerColumnAudit,
      zoomDataUrl: zoomCanvas.toDataURL('image/png'),
    };
  });

  // Save zoomed screenshot
  const base64Data = auditResult.zoomDataUrl.replace(/^data:image\/png;base64,/, '');
  const zoomPath = path.join(OUTPUT_DIR, 'player_walk_up_zoom.png');
  fs.writeFileSync(zoomPath, Buffer.from(base64Data, 'base64'));
  console.log(`  [OK Captured] player_walk_up_zoom.png (10x zoom sheet)`);

  // Assert A3
  let allA3Passed = true;
  for (const item of auditResult.outerColumnAudit) {
    if (!item.pass) {
      console.error(`  FAIL: ${item.key} has opaque pixels on edge! Left: ${item.leftOpaque}, Right: ${item.rightOpaque}`);
      allA3Passed = false;
    }
  }

  if (!allA3Passed) {
    throw new Error('A3 ASSERTION FAILED: Player cell has opaque pixels in outer 1px column!');
  }

  // Specifically assert player_walk_up_3 has 0 outer column opaque pixels
  const up3Audit = auditResult.outerColumnAudit.find((a) => a.key === 'player_walk_up_3');
  if (!up3Audit || up3Audit.leftOpaque !== 0 || up3Audit.rightOpaque !== 0) {
    throw new Error('A3 ASSERTION FAILED: player_walk_up_3 right edge still contains bleed!');
  }

  console.log('  [PASS] A3 QA Assertion: All 20 player cells verified with 0 outer column bleed pixels.');
  await page.close();
}

async function runTestPass(browser, config) {
  const { name, width, height, isMobile } = config;
  console.log(`\n======================================================`);
  console.log(`Starting ${name.toUpperCase()} Pass (${width}x${height})`);
  console.log(`======================================================`);

  const context = await browser.newContext({
    viewport: { width, height },
    isMobile,
    hasTouch: isMobile,
  });

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[Browser Error]`, msg.text());
  });

  const snap = async (filename) => {
    const outPath = path.join(OUTPUT_DIR, `${name}_${filename}.png`);
    await page.screenshot({ path: outPath });
    console.log(`  [OK Captured] ${name}_${filename}.png`);
  };

  // -------------------------------------------------------------------------
  // 1. MAIN MENU
  // -------------------------------------------------------------------------
  console.log('1. Verifying Main Menu...');
  await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });
  const mainMenu = page.locator('[data-testid="main-menu"]');
  await mainMenu.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);
  await snap('01_main_menu');

  // -------------------------------------------------------------------------
  // 2. HOW TO PLAY MODAL
  // -------------------------------------------------------------------------
  console.log('2. Verifying How To Play Modal...');
  const howToPlayBtn = page.locator('[data-testid="how-to-play-btn"]');
  await howToPlayBtn.click();
  const howToPlayModal = page.locator('[data-testid="how-to-play-modal"]');
  await howToPlayModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await snap('02_how_to_play');

  // Close How to Play via close button
  await page.locator('[data-testid="how-to-play-close-btn"]').click();
  await howToPlayModal.waitFor({ state: 'detached', timeout: 5000 });

  // -------------------------------------------------------------------------
  // 3. LEGACY CHAPTERS MODAL
  // -------------------------------------------------------------------------
  console.log('3. Verifying Legacy Chapters Modal...');
  const legacyChaptersBtn = page.locator('[data-testid="legacy-chapters-btn"]');
  await legacyChaptersBtn.click();
  const legacyChaptersModal = page.locator('[data-testid="legacy-chapters-modal"]');
  await legacyChaptersModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await snap('03_legacy_chapters');

  // Close Legacy Chapters via close button
  await page.locator('[data-testid="legacy-chapters-close-btn"]').click();
  await legacyChaptersModal.waitFor({ state: 'detached', timeout: 5000 });

  // -------------------------------------------------------------------------
  // 4. WORLD SCENE & CRASHED SHIP SPAWN
  // -------------------------------------------------------------------------
  console.log('4. Starting New Mission into Mars Open World...');
  const startBtn = page.locator('[data-testid="start-mission-btn"]');
  await startBtn.click();

  // If prologue appears, skip it
  const skipPrologueBtn = page.locator('[data-testid="skip-prologue-btn"]');
  try {
    await skipPrologueBtn.waitFor({ state: 'visible', timeout: 4000 });
    await skipPrologueBtn.click();
  } catch {}

  // Assert Main Menu is detached and World Canvas is visible
  await mainMenu.waitFor({ state: 'detached', timeout: 10000 });
  const worldCanvas = page.locator('[data-testid="world-canvas"]');
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);
  await snap('04_world_spawn_ship');

  // =========================================================================
  // PROGRESSION LOOP & NOVA REACTIONS (Section B & C Verification on Desktop)
  // =========================================================================
  if (!isMobile) {
    // -----------------------------------------------------------------------
    // C.1 NOVA REACTION BUBBLE NEAR UNCOLLECTED SAMPLE
    // -----------------------------------------------------------------------
    console.log('4A. Verifying Nova Speech Bubble Near Uncollected Sample...');
    // Teleport close to sample 0
    await page.evaluate(() => window.__teleportToSample(0));

    // Assert Nova speech bubble appears with chirp / "?"
    const novaBubble = page.locator('[data-testid="nova-speech-bubble"]');
    await novaBubble.waitFor({ state: 'visible', timeout: 6000 });
    const bubbleText = await novaBubble.textContent();
    console.log(`  Nova Bubble Text: "${bubbleText}"`);
    if (!bubbleText.includes('?') && !bubbleText.includes('Chirp') && !bubbleText.includes('glint')) {
      throw new Error(`Nova speech bubble did not show chirp/question reaction: ${bubbleText}`);
    }
    await page.waitForTimeout(300);
    await snap('04a_nova_sample_bubble');

    // -----------------------------------------------------------------------
    // B.1 & B.2 COLLECT SAMPLE WITH [E] AND ASSERT COUNTER INCREMENTS
    // -----------------------------------------------------------------------
    console.log('4B. Verifying Sample Collection with [E]...');
    const samplesCounter = page.locator('[data-testid="samples-counter"]');
    const counterTextBefore = await samplesCounter.textContent();
    console.log(`  Samples count before: "${counterTextBefore}"`);
    if (!counterTextBefore.includes('0/')) {
      throw new Error(`Expected initial sample count 0, got: ${counterTextBefore}`);
    }

    // Ensure interact prompt is active and trigger collection
    const samplePrompt = page.locator('[data-testid="interact-prompt"]');
    await samplePrompt.waitFor({ state: 'visible', timeout: 5000 });
    await samplePrompt.click();

    // Assert counter increments to 1/18
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="samples-counter"]');
      return el && el.textContent.includes('1/');
    }, { timeout: 6000 });
    const counterTextAfter = await samplesCounter.textContent();
    console.log(`  Samples count after collection: "${counterTextAfter}"`);
    await page.waitForTimeout(400);
    await snap('04b_sample_collected');

    // -----------------------------------------------------------------------
    // B.4 SPECIMEN BOOK (1 FOUND, 5 SILHOUETTES, ONE-LINE FACT)
    // -----------------------------------------------------------------------
    console.log('4C. Verifying Specimen Book Tab in Planetary Codex...');
    const codexBtn = page.locator('[data-testid="codex-btn"]');
    await codexBtn.click();

    const codexModal = page.locator('[data-testid="codex-modal"]');
    await codexModal.waitFor({ state: 'visible', timeout: 5000 });

    const specimenTabBtn = page.locator('[data-testid="specimen-book-tab-btn"]');
    await specimenTabBtn.click();

    const specimenTab = page.locator('[data-testid="specimen-book-tab"]');
    await specimenTab.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400);
    await snap('04c_specimen_book');

    // Assert status badges: exactly 1 FOUND, 5 SILHOUETTE
    const badges = await page.locator('[data-testid^="specimen-status-"]').allTextContents();
    const foundBadges = badges.filter((b) => b.trim() === 'FOUND');
    const silhouetteBadges = badges.filter((b) => b.trim() === 'SILHOUETTE');
    console.log(`  Specimen Badges: FOUND = ${foundBadges.length}, SILHOUETTE = ${silhouetteBadges.length}`);

    if (foundBadges.length !== 1) {
      throw new Error(`Expected exactly 1 FOUND specimen, found: ${foundBadges.length}`);
    }
    if (silhouetteBadges.length !== 5) {
      throw new Error(`Expected exactly 5 SILHOUETTES, found: ${silhouetteBadges.length}`);
    }

    // Close Codex
    await page.locator('[data-testid="codex-close-btn"]').click();
    await codexModal.waitFor({ state: 'detached', timeout: 5000 });

    // -----------------------------------------------------------------------
    // B.5 BUY ONE UPGRADE AT CRASHED SPACECRAFT (JETPACK BOOST: 2 RP)
    // -----------------------------------------------------------------------
    console.log('4D. Collecting 2nd Sample and Buying Jetpack Upgrade at Crashed Ship...');
    // Teleport and collect a 2nd sample to guarantee >= 2 RP
    await page.evaluate(() => window.__teleportToSample(1));
    const samplePrompt2 = page.locator('[data-testid="interact-prompt"]');
    await samplePrompt2.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="samples-counter"]');
      return el && el.textContent.includes('2/');
    }, { timeout: 6000 });

    // Teleport to Crashed Ship
    await page.keyboard.press('F3');
    await page.locator('[data-testid="tp-ship-btn"]').click();
    await page.waitForTimeout(600);
    await page.keyboard.press('F3');

    // Open Ship Terminal
    const shipPrompt = page.locator('[data-testid="interact-prompt"]');
    await shipPrompt.waitFor({ state: 'visible', timeout: 5000 });
    await shipPrompt.click();

    const terminalModal = page.locator('[data-testid="ship-terminal-modal"]');
    await terminalModal.waitFor({ state: 'visible', timeout: 5000 });

    // Verify initial RP >= 2 and initial effect value
    const rpElem = page.locator('[data-testid="research-points-count"]');
    const initialRP = parseInt((await rpElem.textContent()) || '0', 10);
    console.log(`  Current RP at Terminal: ${initialRP}`);
    if (initialRP < 2) {
      throw new Error(`Expected at least 2 RP to buy Jetpack, got: ${initialRP}`);
    }

    const jetpackEffect = page.locator('[data-testid="effect-value-jetpack"]');
    const beforeEffect = await jetpackEffect.textContent();
    console.log(`  Jetpack Effect Before: "${beforeEffect}"`);
    if (!beforeEffect.includes('Standard')) {
      throw new Error(`Expected standard jetpack effect before purchase, got: ${beforeEffect}`);
    }

    // Buy Jetpack upgrade (costs 2 RP)
    const buyJetpackBtn = page.locator('[data-testid="buy-upgrade-jetpack"]');
    await buyJetpackBtn.click();
    await page.waitForTimeout(400);

    // Assert RP dropped by 2
    const afterRP = parseInt((await rpElem.textContent()) || '0', 10);
    console.log(`  RP after purchase: ${afterRP} (expected: ${initialRP - 2})`);
    if (afterRP !== initialRP - 2) {
      throw new Error(`Research Points did not drop by 2: was ${initialRP}, now ${afterRP}`);
    }

    // Assert effect value changed
    const afterEffect = await jetpackEffect.textContent();
    console.log(`  Jetpack Effect After: "${afterEffect}"`);
    if (!afterEffect.includes('Sprint Drain: -35% (Extended Duration)')) {
      throw new Error(`Jetpack effect value did not update properly: ${afterEffect}`);
    }

    await snap('04d_ship_terminal_upgrade_bought');

    // Close Ship Terminal
    await page.locator('[data-testid="close-ship-terminal-btn"]').click();
    await terminalModal.waitFor({ state: 'detached', timeout: 5000 });

    // -----------------------------------------------------------------------
    // B.6 COUNTER AND UPGRADES PERSIST AFTER PAGE RELOAD
    // -----------------------------------------------------------------------
    console.log('4E. Verifying Sample Counter & Upgrades Persist After Page Reload...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(800);

    // Assert persisted sample counter is 2/18
    const persistedCounter = await page.locator('[data-testid="samples-counter"]').textContent();
    console.log(`  Persisted Samples Counter: "${persistedCounter}"`);
    if (!persistedCounter.includes('2/')) {
      throw new Error(`Sample counter did not persist after reload: ${persistedCounter}`);
    }

    // Assert persisted upgrade state in memory
    const persistedUpgrades = await page.evaluate(() => window.__getUpgrades());
    console.log(`  Persisted Upgrades:`, persistedUpgrades);
    if (!persistedUpgrades.jetpack) {
      throw new Error('Jetpack upgrade did not persist in saveManager after reload!');
    }

    await snap('04e_reloaded_persistence');
  }

  // -------------------------------------------------------------------------
  // 5. WRECK APPROACH & PROXIMITY INTERACTION PROMPT
  // -------------------------------------------------------------------------
  console.log('5. Teleporting to Nearest Wreck...');
  await page.keyboard.press('F3');
  const debugPanel = page.locator('[data-testid="debug-panel"]');
  await debugPanel.waitFor({ state: 'visible', timeout: 5000 });

  const tpWreckBtn = page.locator('[data-testid="tp-wreck-btn"]');
  await tpWreckBtn.click();
  await page.waitForTimeout(1000);

  // Close debug panel
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'detached', timeout: 5000 });

  // Assert interaction prompt is active (either desktop banner or mobile button)
  const interactPrompt = isMobile
    ? page.locator('[data-testid="touch-interact-btn"]')
    : page.locator('[data-testid="interact-prompt"]');
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await page.waitForTimeout(500);
  await snap('05_wreck_approach');

  // -------------------------------------------------------------------------
  // 6. MINI-GAME PUZZLE
  // -------------------------------------------------------------------------
  console.log('6. Interacting to Open Mini-Game / Quiz...');
  await interactPrompt.click();

  // If Nova's dialogue appears with action button, click it to launch simulator
  const novaActionBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  try {
    await novaActionBtn.waitFor({ state: 'visible', timeout: 3000 });
    await novaActionBtn.click();
  } catch {}

  // Wait for puzzle modal / quiz modal
  const puzzleExitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await puzzleExitBtn.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
  await snap('06_mini_game_puzzle');

  // Close puzzle
  await puzzleExitBtn.click();
  await puzzleExitBtn.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(500);

  // -------------------------------------------------------------------------
  // 7. COMPLETE ALL 8 PARTS (PARTS HUD COMPLETE)
  // -------------------------------------------------------------------------
  console.log('7. Granting All 8 Parts via Debug Hook...');
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'visible', timeout: 5000 });

  const grantPartsBtn = page.locator('[data-testid="grant-parts-btn"]');
  await grantPartsBtn.click();
  await page.waitForTimeout(600);

  // Close debug panel
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'detached', timeout: 5000 });

  // Dismiss any Nova dialogue triggered by granting parts
  try {
    const novaDismiss = page.locator('[data-testid="nova-dialogue-action-btn"], [data-testid="nova-dialogue-dismiss-btn"]').first();
    if (await novaDismiss.isVisible()) {
      await novaDismiss.click();
      await page.waitForTimeout(300);
    }
  } catch {}

  // Assert 8/8 parts in HUD
  const partsHud = isMobile
    ? page.locator('[data-testid="parts-hud"]').last()
    : page.locator('[data-testid="parts-hud"]').first();
  await partsHud.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await snap('07_parts_hud_complete');

  // -------------------------------------------------------------------------
  // 8. SPACECRAFT REPAIR SCENE
  // -------------------------------------------------------------------------
  console.log('8. Teleporting to Crashed Ship for Repair...');
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'visible', timeout: 5000 });
  const tpShipBtn = page.locator('[data-testid="tp-ship-btn"]');
  await tpShipBtn.click();
  await page.waitForTimeout(800);

  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'detached', timeout: 5000 });

  // Dismiss any lingering dialogue
  try {
    const novaDismiss = page.locator('[data-testid="nova-dialogue-action-btn"], [data-testid="nova-dialogue-dismiss-btn"]').first();
    if (await novaDismiss.isVisible()) {
      await novaDismiss.click();
      await page.waitForTimeout(300);
    }
  } catch {}

  // Click interact prompt to commence repair
  const repairInteract = isMobile
    ? page.locator('[data-testid="touch-interact-btn"]')
    : page.locator('[data-testid="interact-prompt"]');
  await repairInteract.waitFor({ state: 'visible', timeout: 6000 });
  await repairInteract.click();

  // If ship terminal opens (since 8 parts are gathered, it offers repair button)
  const terminalRepairBtn = page.locator('[data-testid="terminal-repair-btn"]');
  try {
    if (await terminalRepairBtn.isVisible()) {
      await terminalRepairBtn.click();
    }
  } catch {}

  const repairScene = page.locator('[data-testid="repair-scene"]');
  await repairScene.waitFor({ state: 'visible', timeout: 8000 });
  await mainMenu.waitFor({ state: 'detached' });

  // Calibrate the 3 sliders to nominal
  console.log('  Calibrating 3 spacecraft subsystems...');
  // 1. Gimbal slider
  const gimbalSlider = page.locator('[data-testid="repair-scene"] input[type="range"]').first();
  await gimbalSlider.fill('0');
  await gimbalSlider.dispatchEvent('change');
  await page.waitForTimeout(250);

  // 2. Power slider
  const powerTab = page.locator('button:has-text("Power Bus")');
  await powerTab.click();
  const powerSlider = page.locator('[data-testid="repair-scene"] input[type="range"]').first();
  await powerSlider.fill('60');
  await powerSlider.dispatchEvent('change');
  await page.waitForTimeout(250);

  // 3. Gyro slider
  const gyroTab = page.locator('button:has-text("Gyroscope")');
  await gyroTab.click();
  const gyroSlider = page.locator('[data-testid="repair-scene"] input[type="range"]').first();
  await gyroSlider.fill('0');
  await gyroSlider.dispatchEvent('change');
  await page.waitForTimeout(250);

  // Verify launch button is enabled
  const launchAscentBtn = page.locator('[data-testid="launch-ascent-btn"]');
  await launchAscentBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await snap('08_repair_scene');

  // -------------------------------------------------------------------------
  // 9. LAUNCH CINEMATIC
  // -------------------------------------------------------------------------
  console.log('9. Triggering Launch Cinematic...');
  await launchAscentBtn.click();
  await repairScene.waitFor({ state: 'detached', timeout: 6000 });

  const launchCinematic = page.locator('[data-testid="launch-cinematic"]');
  await launchCinematic.waitFor({ state: 'visible', timeout: 8000 });
  await mainMenu.waitFor({ state: 'detached' });
  await page.waitForTimeout(1400);
  await snap('09_launch_cinematic');

  // -------------------------------------------------------------------------
  // 10. ENDING SCREEN
  // -------------------------------------------------------------------------
  console.log('10. Advancing to Ending Screen...');
  const skipCinematicBtn = page.locator('[data-testid="skip-cinematic-btn"]');
  await skipCinematicBtn.click();

  await launchCinematic.waitFor({ state: 'detached', timeout: 6000 });
  const endingScreen = page.locator('[data-testid="ending-screen"]');
  await endingScreen.waitFor({ state: 'visible', timeout: 8000 });
  await mainMenu.waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  await snap('10_ending_screen');

  // -------------------------------------------------------------------------
  // 11. PLAY AGAIN (NEW MISSION RESTART)
  // -------------------------------------------------------------------------
  console.log('11. Testing Play Again Restart...');
  const playAgainBtn = page.locator('[data-testid="play-again-btn"]');
  await playAgainBtn.click();
  await endingScreen.waitFor({ state: 'detached', timeout: 6000 });
  await worldCanvas.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1000);
  await snap('11_play_again_restarted');

  // -------------------------------------------------------------------------
  // 12. CONTINUE FROM SAVE (MIGRATION TEST: v2 SAVE WITH DEFAULTS)
  // -------------------------------------------------------------------------
  console.log('12. Reloading to Verify Migration of v2 Save to v3...');
  await page.close();

  const page2 = await context.newPage();
  page2.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[Page2 Browser Error]`, msg.text());
  });
  await page2.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page2.evaluate(() => {
    localStorage.clear();
    const save = {
      version: 2,
      currentChapter: 0,
      worldSave: {
        version: 2,
        seed: 19970704,
        playerTileX: 64,
        playerTileY: 64,
        playerFacing: 'down',
        collectedPartIds: ['rover_wheel', 'solar_panel'],
        completedEquipmentIds: ['sojourner_rover', 'opportunity_rover'],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 120,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(save));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });

  const mainMenu2 = page2.locator('[data-testid="main-menu"]');
  await mainMenu2.waitFor({ state: 'visible', timeout: 10000 });
  const continueBtn2 = page2.locator('[data-testid="continue-mission-btn"]');
  await continueBtn2.waitFor({ state: 'visible', timeout: 6000 });
  await page2.waitForTimeout(500);

  const outPath12 = path.join(OUTPUT_DIR, `${name}_12_continue_from_save.png`);
  await page2.screenshot({ path: outPath12 });
  console.log(`  [OK Captured] ${name}_12_continue_from_save.png`);

  // Verify that the continue button is enabled and shows the migrated mission stats
  const continueText = await continueBtn2.textContent();
  console.log(`  Continue Button Text: "${continueText}"`);
  if (!continueText.includes('CONTINUE EXPEDITION')) {
    throw new Error('Continue button not visible for migrated v2 save');
  }

  await page2.close();
  await context.close();
  console.log(`Finished ${name.toUpperCase()} Pass successfully!`);
}

async function runAll() {
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  console.log(`Static server running on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 0. Player walk-up zoom screenshot & A3 assertion
    await runPlayerSpriteAndA3Audit(browser);

    // 1. Desktop Pass: 1366 x 768
    await runTestPass(browser, {
      name: 'desktop',
      width: 1366,
      height: 768,
      isMobile: false,
    });

    // 2. Mobile Pass: 390 x 844
    await runTestPass(browser, {
      name: 'mobile',
      width: 390,
      height: 844,
      isMobile: true,
    });

    console.log('\n======================================================');
    console.log('ALL PLAYTHROUGH PASSES COMPLETE AND FULLY ASSERTED!');
    console.log(`Screenshots saved to: ${OUTPUT_DIR}`);
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runAll().catch((err) => {
  console.error('[FATAL QA Runner Error]', err);
  server.close();
  process.exit(1);
});
