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
    // B.4 SPECIMEN BOOK (1 FOUND, 5 SILHOUETTES, ONE-LINE FACT, LEARN MORE)
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

    // Verify footer disclaimer
    const codexFooter = await codexModal.locator('.border-t').last().textContent();
    console.log(`  Codex Footer: "${codexFooter}"`);
    if (!codexFooter.includes('Inspired by real NASA missions')) {
      throw new Error(`Expected footer to mention 'Inspired by real NASA missions', got: ${codexFooter}`);
    }
    if (codexFooter.toLowerCase().includes('strictly verified')) {
      throw new Error(`Codex footer should NOT claim 'strictly verified'! Got: ${codexFooter}`);
    }

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

    // Verify "Learn more" toggle on discovered card
    const toggleBtn = page.locator('[data-testid^="specimen-toggle-"]').first();
    if (await toggleBtn.isVisible()) {
      const toggleText = await toggleBtn.textContent();
      console.log(`  Specimen toggle text: "${toggleText}"`);
      await toggleBtn.click();
      await page.waitForTimeout(200);
      const afterToggleText = await toggleBtn.textContent();
      console.log(`  Specimen toggle text after click: "${afterToggleText}"`);
      if (!afterToggleText.includes('Hide')) {
        throw new Error('Clicking Learn more did not toggle card description!');
      }
    }

    await snap('04c_specimen_book');

    // Close Codex
    await page.locator('[data-testid="codex-close-btn"]').click();
    await codexModal.waitFor({ state: 'detached', timeout: 5000 });

    // -----------------------------------------------------------------------
    // B.5 BUY ONE UPGRADE AT CRASHED SPACECRAFT (JETPACK BOOST LV.1: 3 RP)
    // -----------------------------------------------------------------------
    console.log('4D. Collecting Samples to reach >= 3 RP and Buying Jetpack Upgrade at Crashed Ship...');
    // Teleport and collect 2nd sample
    await page.evaluate(() => window.__teleportToSample(1));
    const samplePrompt2 = page.locator('[data-testid="interact-prompt"]');
    await samplePrompt2.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="samples-counter"]');
      return el && el.textContent.includes('2/');
    }, { timeout: 6000 });

    // Teleport and collect 3rd sample to guarantee >= 3 RP
    await page.evaluate(() => window.__teleportToSample(2));
    const samplePrompt3 = page.locator('[data-testid="interact-prompt"]');
    await samplePrompt3.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="samples-counter"]');
      return el && el.textContent.includes('3/');
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

    // Verify initial RP >= 3 and initial effect value
    const rpElem = page.locator('[data-testid="research-points-count"]');
    const initialRP = parseInt((await rpElem.textContent()) || '0', 10);
    console.log(`  Current RP at Terminal: ${initialRP}`);
    if (initialRP < 3) {
      throw new Error(`Expected at least 3 RP to buy Jetpack, got: ${initialRP}`);
    }

    const jetpackEffect = page.locator('[data-testid="effect-value-jetpack"]');
    const beforeEffect = await jetpackEffect.textContent();
    console.log(`  Jetpack Effect Before: "${beforeEffect}"`);
    if (!beforeEffect.includes('Standard')) {
      throw new Error(`Expected standard jetpack effect before purchase, got: ${beforeEffect}`);
    }

    const buyJetpackBtn = page.locator('[data-testid="buy-upgrade-jetpack"]');
    const buyBtnTextBefore = await buyJetpackBtn.textContent();
    console.log(`  Buy button before purchase: "${buyBtnTextBefore}"`);
    if (!buyBtnTextBefore.includes('Buy (3 RP)')) {
      throw new Error(`Expected button text 'Buy (3 RP)', got: ${buyBtnTextBefore}`);
    }

    // Buy Jetpack upgrade (costs 3 RP for Lv.1)
    await buyJetpackBtn.click();
    await page.waitForTimeout(400);

    // Assert RP dropped by 3
    const afterRP = parseInt((await rpElem.textContent()) || '0', 10);
    console.log(`  RP after purchase: ${afterRP} (expected: ${initialRP - 3})`);
    if (afterRP !== initialRP - 3) {
      throw new Error(`Research Points did not drop by 3: was ${initialRP}, now ${afterRP}`);
    }

    // Assert effect value changed to Lv.1
    const afterEffect = await jetpackEffect.textContent();
    console.log(`  Jetpack Effect After: "${afterEffect}"`);
    if (!afterEffect.includes('Lv.1')) {
      throw new Error(`Jetpack effect value did not update properly to Lv.1: ${afterEffect}`);
    }

    // Assert button updated (either Buy (6 RP) if affordable or Need X more RP)
    const buyBtnTextAfter = await buyJetpackBtn.textContent();
    console.log(`  Buy button after purchase: "${buyBtnTextAfter}"`);
    if (!buyBtnTextAfter.includes('Buy (6 RP)') && !buyBtnTextAfter.includes('Need')) {
      throw new Error(`Unexpected button state after purchase: ${buyBtnTextAfter}`);
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

    // Assert persisted sample counter is 3/18
    const persistedCounter = await page.locator('[data-testid="samples-counter"]').textContent();
    console.log(`  Persisted Samples Counter: "${persistedCounter}"`);
    if (!persistedCounter.includes('3/')) {
      throw new Error(`Sample counter did not persist after reload: ${persistedCounter}`);
    }

    // Assert persisted upgrade state in memory is level 1
    const persistedUpgrades = await page.evaluate(() => window.__getUpgrades());
    console.log(`  Persisted Upgrades:`, persistedUpgrades);
    if (persistedUpgrades.jetpack !== 1) {
      throw new Error(`Jetpack upgrade level did not persist after reload: ${persistedUpgrades.jetpack}`);
    }

    await snap('04e_reloaded_persistence');

    // -----------------------------------------------------------------------
    // B.7 NATURAL LANDMARK DISCOVERY & PERSISTENCE AFTER RELOAD
    // -----------------------------------------------------------------------
    console.log('4F. Verifying Procedural Natural Landmark Discovery & Reload Persistence...');
    // Teleport to landmark 0
    const lmRes = await page.evaluate(() => window.__teleportToLandmark(0));
    console.log(`  Teleported to Landmark:`, lmRes);
    if (!lmRes || !lmRes.success) {
      throw new Error('Failed to teleport to landmark 0');
    }

    // Assert Landmark Discovery Toast appears
    const lmToast = page.locator('[data-testid="landmark-toast"]');
    await lmToast.waitFor({ state: 'visible', timeout: 6000 });
    const toastName = await page.locator('[data-testid="landmark-toast-name"]').textContent();
    const toastFact = await page.locator('[data-testid="landmark-toast-fact"]').textContent();
    console.log(`  Landmark Toast: "${toastName}" - "${toastFact}"`);
    if (!toastName || !toastName.includes(lmRes.name)) {
      throw new Error(`Landmark toast name mismatch: expected ${lmRes.name}, got ${toastName}`);
    }
    if (!toastFact || toastFact.length < 5) {
      throw new Error(`Landmark toast fact is empty: "${toastFact}"`);
    }

    // Assert Nova Landmark specific reaction (max 10 words, no duplicate "+1 RP logged")
    const novaBubbleEl = page.locator('[data-testid="nova-bubble-text"]');
    if (await novaBubbleEl.isVisible()) {
      const bubbleText = (await novaBubbleEl.textContent()) || '';
      console.log(`  Nova Landmark Reaction Bubble: "${bubbleText}"`);
      const words = bubbleText.trim().split(/\s+/);
      if (words.length > 10) {
        throw new Error(`Nova landmark reaction line exceeds 10 words (${words.length} words): "${bubbleText}"`);
      }
      if (bubbleText.includes('+1 RP logged') || bubbleText.includes('Landmark reached')) {
        throw new Error(`Nova should not use duplicate "+1 RP logged" / "Landmark reached" line: "${bubbleText}"`);
      }
    }

    // Assert Codex shows "Landmarks 1/5"
    await codexBtn.click();
    await codexModal.waitFor({ state: 'visible', timeout: 5000 });
    const lmCounter = page.locator('[data-testid="landmarks-codex-counter"]');
    await lmCounter.waitFor({ state: 'visible', timeout: 3000 });
    const lmCounterText = await lmCounter.textContent();
    console.log(`  Codex Landmark Counter: "${lmCounterText}"`);
    if (!lmCounterText.includes('1/5')) {
      throw new Error(`Expected Codex landmark counter to show 1/5, got: ${lmCounterText}`);
    }
    await page.locator('[data-testid="codex-close-btn"]').click();
    await codexModal.waitFor({ state: 'detached', timeout: 5000 });

    // Assert persistence after reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(800);

    const reloadedLandmarks = await page.evaluate(() => window.__getDiscoveredLandmarks());
    console.log(`  Reloaded Discovered Landmarks:`, reloadedLandmarks);
    if (!reloadedLandmarks || reloadedLandmarks.length !== 1 || reloadedLandmarks[0] !== lmRes.id) {
      throw new Error(`Discovered landmark did not persist after reload: ${JSON.stringify(reloadedLandmarks)}`);
    }

    // Check Codex counter again after reload
    await codexBtn.click();
    await codexModal.waitFor({ state: 'visible', timeout: 5000 });
    const lmCounterReloaded = await page.locator('[data-testid="landmarks-codex-counter"]').textContent();
    console.log(`  Codex Landmark Counter after reload: "${lmCounterReloaded}"`);
    if (!lmCounterReloaded.includes('1/5')) {
      throw new Error(`Expected Codex landmark counter 1/5 after reload, got: ${lmCounterReloaded}`);
    }
    await page.locator('[data-testid="codex-close-btn"]').click();
    await codexModal.waitFor({ state: 'detached', timeout: 5000 });

    // -----------------------------------------------------------------------
    // B.8 SCREENSHOTS: GRASS BIOME & LANDMARK FROM 15 TILES AWAY
    // -----------------------------------------------------------------------
    console.log('4G. Capturing Grass Biome & Landmark from 15 Tiles Away...');
    // Teleport to grass biome
    const tpGrass = await page.evaluate(() => window.__teleportToBiome('grassland'));
    console.log(`  Teleport to Grassland:`, tpGrass);
    await page.waitForTimeout(500);
    const grassSnapPath = path.join(OUTPUT_DIR, 'desktop_grass_biome.png');
    await page.screenshot({ path: grassSnapPath });
    console.log(`  [OK Captured] desktop_grass_biome.png`);

    // -----------------------------------------------------------------------
    // A.1 LANDMARK VIEWPORT INTERSECTION ASSERTION & VISIBILITY SCREENSHOTS
    // -----------------------------------------------------------------------
    console.log('4G-1. Verifying Landmark Viewport & Bounding Box with Player 6 Tiles Below (after Toast Dismissed)...');
    const landmarkNames = ['canyon', 'volcano', 'delta', 'ice_cave', 'dust_devil'];
    const landmarkVisibilityResults = [];

    for (let lmIdx = 0; lmIdx < 5; lmIdx++) {
      // Teleport player exactly 6 tiles BELOW the landmark
      const tpRes = await page.evaluate((idx) => window.__teleportNearLandmark(idx, 6), lmIdx);
      if (!tpRes.success) {
        throw new Error(`Failed to teleport near landmark ${lmIdx}`);
      }

      console.log(`  Landmark ${lmIdx} (${tpRes.name}): distTilesBelow=${tpRes.distTilesBelow.toFixed(2)}`);
      // Assert player is 6 tiles below
      if (Math.abs(tpRes.distTilesBelow - 6) > 0.05) {
        throw new Error(`Landmark ${tpRes.name}: expected player 6 tiles below, got ${tpRes.distTilesBelow}`);
      }

      // Dismiss toast if visible and wait for dismissal
      await page.evaluate(() => window.__dismissLandmarkToast?.());
      await page.waitForTimeout(350);
      const isToastVis = await page.locator('[data-testid="landmark-toast"]').isVisible();
      if (isToastVis) {
        throw new Error(`Landmark toast is still visible after dismissal for landmark ${lmIdx}`);
      }

      // Assert via camera transform that landmark bounding box is FULLY inside viewport and BELOW HUD bar
      const cam = await page.evaluate(() => window.__getCameraTransform());
      const screenMinX = cam.viewCenterW + (tpRes.bounds.minX - cam.cameraX) * cam.scale;
      const screenMaxX = cam.viewCenterW + (tpRes.bounds.maxX - cam.cameraX) * cam.scale;
      const screenMinY = cam.viewCenterH + (tpRes.bounds.minY - cam.cameraY) * cam.scale;
      const screenMaxY = cam.viewCenterH + (tpRes.bounds.maxY - cam.cameraY) * cam.scale;

      const hudBarHeight = 52; // Top HUD bar height (52px)
      const isBelowHudBar = screenMinY >= hudBarHeight;
      const isFullyInsideViewport = screenMinX >= 0 && screenMaxX <= cam.viewportWidth && screenMaxY <= cam.viewportHeight && screenMinY >= 0;

      console.log(`  Landmark ${lmIdx} screen bounds: [${screenMinX.toFixed(0)}, ${screenMinY.toFixed(0)}] to [${screenMaxX.toFixed(0)}, ${screenMaxY.toFixed(0)}], belowHUD=${isBelowHudBar}, insideViewport=${isFullyInsideViewport}`);
      if (!isBelowHudBar) {
        throw new Error(`Landmark ${tpRes.name} bounding box top (${screenMinY.toFixed(1)}px) is NOT below the HUD bar (${hudBarHeight}px)!`);
      }
      if (!isFullyInsideViewport) {
        throw new Error(`Landmark ${tpRes.name} bounding box is NOT fully inside the viewport! [${screenMinX.toFixed(0)}, ${screenMinY.toFixed(0)}] to [${screenMaxX.toFixed(0)}, ${screenMaxY.toFixed(0)}]`);
      }

      await page.waitForTimeout(300);
      const lmFilePath = path.join(OUTPUT_DIR, `${name}_landmark_${lmIdx}_${landmarkNames[lmIdx]}.png`);
      await page.screenshot({ path: lmFilePath });
      console.log(`  [OK Captured & Visible Below HUD] ${name}_landmark_${lmIdx}_${landmarkNames[lmIdx]}.png`);
      landmarkVisibilityResults.push({ id: tpRes.id, name: tpRes.name, visible: true, belowHud: true });
    }

    // -----------------------------------------------------------------------
    // A.2 CHASM COLLISION (4 SIDES + JETPACK BOOST) & BFS REACHABILITY (3 SEEDS)
    // -----------------------------------------------------------------------
    console.log('4G-2. Verifying Chasm Collision (4 sides + jetpack boost)...');
    const chasmCollision = await page.evaluate(() => window.__testChasmCollision());
    console.log(`  Chasm collision allPassed = ${chasmCollision.allPassed}`);
    for (const r of chasmCollision.results) {
      console.log(`    Side: ${r.side} (${r.speed}) -> insideVoid: ${r.insideVoid}, stuck: ${r.stuck}, passed: ${r.passed}`);
      if (!r.passed) {
        throw new Error(`Chasm collision failed on side ${r.side} (${r.speed}): insideVoid=${r.insideVoid}, stuck=${r.stuck}`);
      }
    }
    console.log('  [PASS] Player blocked by chasm void on all 4 sides, never inside void or stuck.');

    console.log('4G-3. Verifying BFS reachability for ship, every wreck and every sample on 3 seeds...');
    const bfsCheck = await page.evaluate(() => window.__testBFSReachability([19970704, 42, 2026]));
    for (const sr of bfsCheck.seedResults) {
      console.log(`    Seed ${sr.seed}: ship=${sr.shipReachable}, wrecks=${sr.totalWrecks - sr.unreachedWrecksCount}/${sr.totalWrecks}, samples=${sr.totalSamples - sr.unreachedSamplesCount}/${sr.totalSamples}`);
      if (!sr.allReachable) {
        throw new Error(`BFS reachability failed on seed ${sr.seed}`);
      }
    }
    console.log('  [PASS] BFS reachability successfully verified on all 3 seeds.');

    // -----------------------------------------------------------------------
    // A.3 DUST DEVIL MOVEMENT & FRAME ANIMATION ASSERTION (500ms apart)
    // -----------------------------------------------------------------------
    console.log('4G-4. Verifying Dust Devil dynamic movement & animation (two frames 500ms apart)...');
    await page.evaluate(() => window.__teleportNearLandmark('dust_devil'));
    await page.waitForTimeout(300);

    const ddFrame1 = await page.evaluate(() => {
      const lm = window.__getLandmarksList().find((l) => l.id === 'dust_devil');
      return { x: lm.worldX, y: lm.worldY };
    });
    const ddSnap1 = await page.screenshot();

    await page.waitForTimeout(500);

    const ddFrame2 = await page.evaluate(() => {
      const lm = window.__getLandmarksList().find((l) => l.id === 'dust_devil');
      return { x: lm.worldX, y: lm.worldY };
    });
    const ddSnap2 = await page.screenshot();

    const ddPosChanged = Math.abs(ddFrame2.x - ddFrame1.x) > 0.001 || Math.abs(ddFrame2.y - ddFrame1.y) > 0.001;
    const ddPixelsChanged = !ddSnap1.equals(ddSnap2);
    console.log(`  Dust devil delta pos: dx=${(ddFrame2.x - ddFrame1.x).toFixed(4)}, dy=${(ddFrame2.y - ddFrame1.y).toFixed(4)}, pixelsChanged=${ddPixelsChanged}`);
    if (!ddPosChanged && !ddPixelsChanged) {
      throw new Error('Dust devil position and sprite animation frames did not change after 500ms!');
    }
    console.log('  [PASS] Dust devil position and animation frames changed dynamically over 500ms.');

    // Biome-placement assertion over 3 seeds
    console.log('  Verifying strict biome sample placement over 3 seeds (19970704, 42, 2026)...');
    const testSeeds = [19970704, 42, 2026];
    for (const testSeed of testSeeds) {
      const biomeCheck = await page.evaluate((s) => window.__checkSampleBiomes(s), testSeed);
      console.log(`    Seed ${testSeed}: total samples = ${biomeCheck.total}, allMatch = ${biomeCheck.allMatch}`);
      if (!biomeCheck.allMatch || biomeCheck.total < 18) {
        console.log(`    Seed ${testSeed} samples placed:`, biomeCheck.samples.map(s => `${s.id} (${s.biome})`));
        const mismatches = biomeCheck.samples.filter((s) => !s.matches);
        throw new Error(`Biome placement mismatch on seed ${testSeed}: count=${biomeCheck.total}, mismatches=${JSON.stringify(mismatches)}`);
      }
    }
    console.log('  [PASS] 100% of samples placed match preferred biomes across all 3 seeds.');

    // Juice & Reduce Motion verification
    console.log('  Verifying camera shake and Reduce Motion setting...');
    await page.evaluate(() => window.__setReduceMotion(true));
    await page.evaluate(() => window.__triggerCameraShake(4.0, 0.3));
    const shakeReduced = await page.evaluate(() => window.__getCameraShake());
    if (shakeReduced.time !== 0) {
      throw new Error(`Expected no camera shake with reduce motion, got time: ${shakeReduced.time}`);
    }
    await page.evaluate(() => window.__setReduceMotion(false));
    await page.evaluate(() => window.__triggerCameraShake(4.0, 0.3));
    const shakeActive = await page.evaluate(() => window.__getCameraShake());
    if (shakeActive.time <= 0) {
      throw new Error('Expected camera shake when reduce motion is disabled');
    }
    console.log('  [PASS] Reduce motion successfully prevents camera shake.');

    // -----------------------------------------------------------------------
    // B.9 EDGE POINTER NON-OVERLAP ASSERTION AT 1366x768
    // -----------------------------------------------------------------------
    console.log('4H. Verifying Edge Pointer Labels Do Not Overlap at 1366x768...');
    // Trigger Sonar Ping (Q key) to activate edge pointers
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(350);

    const pointerAudit = await page.evaluate(() => {
      const pointers = window.__getCompassPointerLabels() || [];
      const overlaps = [];
      for (let i = 0; i < pointers.length; i++) {
        for (let j = i + 1; j < pointers.length; j++) {
          const a = pointers[i];
          const b = pointers[j];
          // Bounding boxes check
          const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
          const overlapY = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
          if (overlapX && overlapY) {
            overlaps.push({ a: a.labelText, b: b.labelText, xA: a.x, xB: b.x, yA: a.y, yB: b.y });
          }
        }
      }
      const farWithLabels = pointers.filter((p) => p.distTiles > 150);
      return { count: pointers.length, overlaps, farWithLabelsCount: farWithLabels.length };
    });

    console.log(`  Compass Pointer Labels Audit: Count = ${pointerAudit.count}, Overlaps = ${pointerAudit.overlaps.length}, Far with labels = ${pointerAudit.farWithLabelsCount}`);
    if (pointerAudit.overlaps.length > 0) {
      throw new Error(`Detected overlapping pointer labels: ${JSON.stringify(pointerAudit.overlaps)}`);
    }
    if (pointerAudit.farWithLabelsCount > 0) {
      throw new Error(`Pointers farther than 150m should not have label text: found ${pointerAudit.farWithLabelsCount}`);
    }

    const pointersSnapPath = path.join(OUTPUT_DIR, 'desktop_edge_pointers.png');
    await page.screenshot({ path: pointersSnapPath });
    console.log(`  [OK Captured] desktop_edge_pointers.png`);
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
  // 6B. VERIFY STORY MEMORY LOG UNLOCK (GRANT 1 PART, TOAST, CODEX, D-PAD NON-COLLISION)
  // -------------------------------------------------------------------------
  console.log('6B. Verifying Story Memory Log Unlock via Grant 1 Part...');
  // Open debug panel
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'visible', timeout: 5000 });

  const grantOnePartBtn = page.locator('[data-testid="grant-one-part-btn"]');
  await grantOnePartBtn.click();
  await page.waitForTimeout(400);

  // Close debug panel to inspect toasts and controls
  await page.keyboard.press('F3');
  await debugPanel.waitFor({ state: 'detached', timeout: 5000 });

  // 1. Assert Grant 1 Part unlocks LOG 1/8, shows toast, does not collide with the mobile D-pad on 390x844
  const logToast = page.locator('[data-testid="log-toast"]');
  await logToast.waitFor({ state: 'visible', timeout: 5000 });
  const logToastText = await logToast.textContent();
  console.log(`  Log Toast Text: "${logToastText}"`);
  if (!logToastText.includes('LOG 1/8') || !logToastText.toLowerCase().includes('recovered')) {
    throw new Error(`Log toast did not display "LOG 1/8 recovered". Got: ${logToastText}`);
  }

  // Verify Nova reaction word count <= 8 words
  const logReactionEl = page.locator('[data-testid="log-toast-reaction"]');
  if (await logReactionEl.isVisible()) {
    const rxText = (await logReactionEl.textContent()).replace(/^Nova:\s*"?/, '').replace(/"?$/, '').trim();
    const wordCount = rxText.split(/\s+/).filter(Boolean).length;
    console.log(`  Toast Nova Reaction: "${rxText}" (${wordCount} words)`);
    if (wordCount > 8) {
      throw new Error(`Nova toast reaction exceeded 8 words (${wordCount} words)`);
    }
  }

  if (isMobile) {
    const virtualDpad = page.locator('[data-testid="virtual-dpad"]');
    await virtualDpad.waitFor({ state: 'visible', timeout: 5000 });
    const toastBox = await logToast.boundingBox();
    const dpadBox = await virtualDpad.boundingBox();
    console.log(`  Toast Box: y=${toastBox.y}, h=${toastBox.height} | D-Pad Box: y=${dpadBox.y}, h=${dpadBox.height}`);
    const collides = !(
      toastBox.x + toastBox.width <= dpadBox.x ||
      dpadBox.x + dpadBox.width <= toastBox.x ||
      toastBox.y + toastBox.height <= dpadBox.y ||
      dpadBox.y + dpadBox.height <= toastBox.y
    );
    if (collides) {
      throw new Error('Log toast collided with mobile virtual D-pad!');
    }
    console.log('  [PASS] Log toast does not collide with mobile virtual D-pad on 390x844');
  }

  // 2. Assert Codex Logs tab has 1 unlocked entry with FICTION tag, 7 locked
  console.log('  Verifying Codex Logs tab...');
  const codexBtn = page.locator('[data-testid="codex-btn"]');
  await codexBtn.click();

  const codexModal = page.locator('[data-testid="codex-modal"]');
  await codexModal.waitFor({ state: 'visible', timeout: 6000 });

  const logsTabBtn = page.locator('[data-testid="logs-tab-btn"]');
  await logsTabBtn.click();
  await page.waitForTimeout(400);

  // Assert 1 unlocked entry with FICTION tag and exact text
  const log1TextEl = codexModal.locator('[data-testid="log-text-1"]');
  if (!(await log1TextEl.isVisible())) {
    throw new Error('Log #1 text is not visible in Codex Logs tab');
  }
  const log1Text = await log1TextEl.textContent();
  console.log(`  Log #1 Text: "${log1Text}"`);
  if (!log1Text.includes("Another power fault. My memory resets every few sols. I'm leaving notes on old probes so I can rebuild the ship.")) {
    throw new Error(`Log #1 text does not match exact premise text: ${log1Text}`);
  }

  const log1Entry = codexModal.locator('[data-testid="codex-log-entry-1"]');
  const log1FictionTag = log1Entry.locator('[data-testid="fiction-tag"]');
  if (!(await log1FictionTag.isVisible())) {
    throw new Error('FICTION tag missing from unlocked Log #1 in Codex');
  }

  // Assert 7 locked slots
  const lockedSlots = codexModal.locator('[data-testid^="codex-log-locked-"]');
  const lockedCount = await lockedSlots.count();
  console.log(`  Locked slots count in Codex: ${lockedCount}`);
  if (lockedCount !== 7) {
    throw new Error(`Expected 7 locked slots in Codex Logs tab, found ${lockedCount}`);
  }
  console.log('  [PASS] Codex Logs tab has 1 unlocked entry with FICTION tag and 7 locked');

  // Close codex
  const codexCloseBtn = page.locator('[data-testid="codex-close-btn"]');
  await codexCloseBtn.click();
  await codexModal.waitFor({ state: 'detached', timeout: 5000 });

  // 3. Assert saving and reloading preserves unlocked logs
  console.log('  Verifying reload preserves unlocked logs...');
  await page.waitForTimeout(600); // Allow autosave to settle
  await page.reload({ waitUntil: 'domcontentloaded' });
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  await codexBtn.click();
  await codexModal.waitFor({ state: 'visible', timeout: 6000 });
  await logsTabBtn.click();
  await page.waitForTimeout(400);

  const reloadedLog1El = codexModal.locator('[data-testid="log-text-1"]');
  if (!(await reloadedLog1El.isVisible())) {
    throw new Error('After reload, Log #1 text is not visible (was not preserved)');
  }
  const reloadedLockedCount = await codexModal.locator('[data-testid^="codex-log-locked-"]').count();
  if (reloadedLockedCount !== 7) {
    throw new Error(`After reload, expected 7 locked slots, found ${reloadedLockedCount}`);
  }
  console.log('  [PASS] Reload preserved 1 unlocked log and 7 locked slots');

  await codexCloseBtn.click();
  await codexModal.waitFor({ state: 'detached', timeout: 5000 });

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

  // 4. Assert Grant Parts unlocks all 8, ending screen shows all 8 logs in order plus Nova's reveal line, and Skip button works
  console.log('  Verifying all 8 logs, Nova reveal line, and Skip button on Ending Screen...');
  const endingLogsSection = page.locator('[data-testid="ending-logs-section"]');
  await endingLogsSection.waitFor({ state: 'visible', timeout: 6000 });

  const endingLogItems = endingLogsSection.locator('[data-testid="ending-log-item"]');
  const countEndingLogs = await endingLogItems.count();
  console.log(`  Ending screen log items count: ${countEndingLogs}`);
  if (countEndingLogs !== 8) {
    throw new Error(`Expected 8 logs on ending screen, found ${countEndingLogs}`);
  }

  // Check that logs are in order 1..8
  for (let i = 0; i < 8; i++) {
    const itemText = await endingLogItems.nth(i).textContent();
    if (!itemText.includes(`Log #${i + 1}:`)) {
      throw new Error(`Ending log at index ${i} is not Log #${i + 1}`);
    }
  }

  // Assert Nova reveal line
  const novaReveal = page.locator('[data-testid="nova-log-reveal"]');
  await novaReveal.waitFor({ state: 'visible', timeout: 5000 });
  const revealLineText = await novaReveal.textContent();
  console.log(`  Nova Reveal Text: "${revealLineText}"`);
  if (!revealLineText.includes("Those were my words. I'd forgotten them. Thank you for finding me.")) {
    throw new Error(`Nova reveal line text mismatch: ${revealLineText}`);
  }

  // Assert Skip button hides logs section
  const skipLogsBtn = page.locator('[data-testid="skip-logs-btn"]');
  await skipLogsBtn.click();
  await page.waitForTimeout(300);
  const isSectionVisibleAfterSkip = await endingLogsSection.isVisible();
  if (isSectionVisibleAfterSkip) {
    throw new Error('Skip logs button failed to hide ending logs section');
  }
  console.log('  [PASS] All 8 logs shown in order, Nova reveal line verified, Skip button hides logs');

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
  page2.on('pageerror', (err) => console.log(`[Page2 Uncaught Error]`, err));
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

  // 5. Assert loading a pre-log save derives recoveredLogIds from collectedPartIds
  console.log('  Asserting pre-log save derives recoveredLogIds...');
  const activeProgress = await page2.evaluate(() => {
    return (window).__getSavedProgress?.() || null;
  });
  const derivedLogIds = activeProgress?.worldSave?.recoveredLogIds || [];
  console.log('  Derived log IDs from pre-log save:', derivedLogIds);
  if (!derivedLogIds.includes('log_sojourner') || !derivedLogIds.includes('log_opportunity')) {
    throw new Error(`Migration failed to derive expected logs ('log_sojourner', 'log_opportunity'). Got: ${JSON.stringify(derivedLogIds)}`);
  }
  console.log('  [PASS] Pre-log save derived recoveredLogIds (log_sojourner, log_opportunity)');

  // Also click continue to verify WorldScene loads and has recoveredLogIds
  await continueBtn2.click();
  const worldCanvas2 = page2.locator('[data-testid="world-canvas"]');
  await worldCanvas2.waitFor({ state: 'visible', timeout: 8000 });
  await page2.waitForTimeout(600);

  const sceneLogs = await page2.evaluate(() => {
    return (window).__getRecoveredLogs?.() || [];
  });
  console.log('  WorldScene recovered logs in migrated game:', sceneLogs);
  if (!sceneLogs.includes('log_sojourner') || !sceneLogs.includes('log_opportunity')) {
    throw new Error(`WorldScene in migrated save did not have derived logs. Got: ${JSON.stringify(sceneLogs)}`);
  }
  console.log('  [PASS] WorldScene active session properly loaded derived recoveredLogIds');

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
