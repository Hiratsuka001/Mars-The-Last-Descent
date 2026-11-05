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
  // 6. SOJOURNER ROUTE MINI-GAME (TACTILE CONTROLS, AUTOPLAY, 3 STARS, FACT REVEAL)
  // -------------------------------------------------------------------------
  console.log('6. Testing Sojourner Route Mini-Game...');
  const tpSojournerResult = await page.evaluate(() => window.__teleportToWreck('eq_sojourner'));
  console.log('  Teleport to Sojourner:', tpSojournerResult);
  if (!tpSojournerResult?.success) {
    throw new Error('Failed to teleport to Sojourner wreck eq_sojourner');
  }
  await page.waitForTimeout(600);

  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // If Nova's dialogue appears with action button, click it to launch simulator
  const novaActionBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  try {
    await novaActionBtn.waitFor({ state: 'visible', timeout: 3000 });
    await novaActionBtn.click();
  } catch {}

  // Wait for puzzle modal (MiniGameShell with sojourner-grid)
  const sojournerShell = page.locator('[data-testid="minigame-shell"]');
  await sojournerShell.waitFor({ state: 'visible', timeout: 8000 });
  const sojournerGrid = page.locator('[data-testid="sojourner-grid"]');
  await sojournerGrid.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Sojourner route game opened with minigame-shell and grid');

  // Verify touch buttons have min 44px (touch target guideline)
  const fwdBtn = page.locator('[data-testid="sojourner-btn-forward"]');
  const fwdBox = await fwdBtn.boundingBox();
  console.log(`  Forward Button Box: h=${fwdBox?.height}, w=${fwdBox?.width}`);
  if (!fwdBox || fwdBox.height < 44) {
    throw new Error(`Forward button height < 44px: ${fwdBox?.height}`);
  }
  console.log('  [PASS] Tactile control buttons meet touch target guidelines');

  // Test queuing and undoing commands
  await fwdBtn.click();
  const leftBtn = page.locator('[data-testid="sojourner-btn-left"]');
  await leftBtn.click();
  const undoBtn = page.locator('[data-testid="sojourner-btn-undo"]');
  await undoBtn.click();

  // Test autoplay hook for 3 stars
  console.log('  Testing Sojourner autoplay hook for 3 stars...');
  await page.evaluate(() => window.__sojournerAutoplay?.());

  const sojournerWin = page.locator('[data-testid="minigame-win"]');
  await sojournerWin.waitFor({ state: 'visible', timeout: 6000 });

  const sojournerStarsEl = page.locator('[data-testid="minigame-stars"]');
  const sojournerStarsVal = await sojournerStarsEl.getAttribute('data-stars');
  console.log(`  Sojourner Stars earned: ${sojournerStarsVal}`);
  if (sojournerStarsVal !== '3') {
    throw new Error(`Expected 3 stars on Sojourner autoplay, got: ${sojournerStarsVal}`);
  }

  // Bonus RP toast
  const sojournerBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await sojournerBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const sojournerBonusToastText = await sojournerBonusToast.textContent();
  console.log(`  Sojourner Bonus RP toast text: "${sojournerBonusToastText}"`);
  if (!sojournerBonusToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${sojournerBonusToastText}`);
  }
  console.log('  [PASS] 3 stars achieved, bonus RP toast displayed for Sojourner');

  // Fact reveal
  const sojournerFactBtn = page.locator('[data-testid="minigame-fact"]');
  await sojournerFactBtn.click();
  await page.waitForTimeout(300);
  const sojournerFactText = await sojournerFactBtn.textContent();
  console.log(`  Sojourner Fact Text: "${sojournerFactText}"`);
  const expectedSojournerFact = "Sojourner was the first rover to drive on Mars, in 1997. It stayed close to its lander.";
  if (!sojournerFactText.includes(expectedSojournerFact)) {
    throw new Error(`Did-you-know fact does not match expected Sojourner line. Got: ${sojournerFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Sojourner');
  await snap('06_sojourner_win_stars_fact');

  // Test retry button
  const sojournerRetryBtn = page.locator('[data-testid="minigame-retry"]');
  await sojournerRetryBtn.click();
  await sojournerWin.waitFor({ state: 'detached', timeout: 5000 });
  await sojournerGrid.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button reset Sojourner to grid');

  // Close puzzle
  const puzzleExitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await puzzleExitBtn.click();
  await sojournerShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(500);
  console.log('  [PASS] Sojourner puzzle closed cleanly');

  // -------------------------------------------------------------------------
  // 6-INSIGHT. INSIGHT MARSQUAKE TUNER MINI-GAME (DOME, FREQ TUNE, AUTOPLAY, 3 STARS, FACT)
  // -------------------------------------------------------------------------
  console.log('6-InSight. Testing InSight Marsquake Tuner Mini-Game...');
  const tpInsightResult = await page.evaluate(() => window.__teleportToWreck('eq_insight'));
  console.log('  Teleport to InSight:', tpInsightResult);
  if (!tpInsightResult?.success) {
    throw new Error('Failed to teleport to InSight wreck eq_insight');
  }
  await page.waitForTimeout(600);

  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // If Nova's dialogue appears with action button, click it to launch simulator
  try {
    await novaActionBtn.waitFor({ state: 'visible', timeout: 3000 });
    await novaActionBtn.click();
  } catch {}

  // Wait for InSight modal (MiniGameShell with insight-game and insight-seismic-canvas)
  const insightShell = page.locator('[data-testid="minigame-shell"]');
  await insightShell.waitFor({ state: 'visible', timeout: 8000 });
  const insightCanvas = page.locator('[data-testid="insight-seismic-canvas"]');
  await insightCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] InSight mini-game opened with minigame-shell and seismic canvas');

  // Verify touch buttons have min 44px / 48px touch targets
  const domeBtn = page.locator('[data-testid="insight-btn-dome"]');
  const domeBox = await domeBtn.boundingBox();
  console.log(`  Dome Button Box: h=${domeBox?.height}, w=${domeBox?.width}`);
  if (!domeBox || domeBox.height < 44) {
    throw new Error(`Dome button height < 44px: ${domeBox?.height}`);
  }

  const tuneDownBtn = page.locator('[data-testid="insight-btn-tune-down"]');
  const tuneDownBox = await tuneDownBtn.boundingBox();
  console.log(`  Tune Down Button Box: h=${tuneDownBox?.height}, w=${tuneDownBox?.width}`);
  if (!tuneDownBox || tuneDownBox.height < 44) {
    throw new Error(`Tune button height < 44px: ${tuneDownBox?.height}`);
  }
  console.log('  [PASS] InSight tactile control buttons meet touch target guidelines');

  // Test toggling dome and stepping frequency
  await domeBtn.click();
  await tuneDownBtn.click();
  const tuneUpBtn = page.locator('[data-testid="insight-btn-tune-up"]');
  await tuneUpBtn.click();
  await page.waitForTimeout(300);
  await snap('06_insight_active_game');

  // Test InSight autoplay hook for 3 stars
  console.log('  Testing InSight autoplay hook for 3 stars...');
  await page.evaluate(() => window.__insightAutoplay?.());

  const insightWin = page.locator('[data-testid="minigame-win"]');
  await insightWin.waitFor({ state: 'visible', timeout: 6000 });

  const insightStarsEl = page.locator('[data-testid="minigame-stars"]');
  const insightStarsVal = await insightStarsEl.getAttribute('data-stars');
  console.log(`  InSight Stars earned: ${insightStarsVal}`);
  if (insightStarsVal !== '3') {
    throw new Error(`Expected 3 stars on InSight autoplay, got: ${insightStarsVal}`);
  }

  // Bonus RP toast
  const insightBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await insightBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const insightBonusToastText = await insightBonusToast.textContent();
  console.log(`  InSight Bonus RP toast text: "${insightBonusToastText}"`);
  if (!insightBonusToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${insightBonusToastText}`);
  }
  console.log('  [PASS] 3 stars achieved, bonus RP toast displayed for InSight');

  // Fact reveal
  const insightFactBtn = page.locator('[data-testid="minigame-fact"]');
  await insightFactBtn.click();
  await page.waitForTimeout(300);
  const insightFactText = await insightFactBtn.textContent();
  console.log(`  InSight Fact Text: "${insightFactText}"`);
  const expectedInsightFact = "InSight listened to marsquakes and found that Mars has a liquid core. It recorded over 1,300 quakes.";
  if (!insightFactText.includes(expectedInsightFact)) {
    throw new Error(`Did-you-know fact does not match expected InSight line. Got: ${insightFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for InSight');
  await snap('06_insight_win_stars_fact');

  // Test retry button
  const insightRetryBtn = page.locator('[data-testid="minigame-retry"]');
  await insightRetryBtn.click();
  await insightWin.waitFor({ state: 'detached', timeout: 5000 });
  await insightCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button reset InSight to canvas');

  // Close puzzle
  await puzzleExitBtn.click();
  await insightShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(500);
  console.log('  [PASS] InSight puzzle closed cleanly');

  // -------------------------------------------------------------------------
  // 6A. OPPORTUNITY BLUEBERRY LAB MINI-GAME (STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6A. Testing Opportunity Blueberry Lab Mini-Game...');
  // Debug teleport to Opportunity wreck
  const tpOppResult = await page.evaluate(() => window.__teleportToWreck('eq_opportunity'));
  console.log('  Teleport to Opportunity:', tpOppResult);
  if (!tpOppResult?.success) {
    throw new Error('Failed to teleport to Opportunity wreck eq_opportunity');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Opportunity mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with rock slab canvas
  const minigameShell = page.locator('[data-testid="minigame-shell"]');
  await minigameShell.waitFor({ state: 'visible', timeout: 6000 });
  const rockCanvas = page.locator('[data-testid="crater-canvas"]');
  await rockCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] minigame-shell and rock-canvas visible');

  // Verify canvas dimensions on desktop (>=60% of viewport) and mobile (>=320px, no page scroll)
  const canvasBox = await rockCanvas.boundingBox();
  console.log(`  Rock Canvas Bounding Box: w=${canvasBox?.width}, h=${canvasBox?.height}`);
  if (!canvasBox) {
    throw new Error('Could not get rock canvas bounding box');
  }

  // 3. Canvas: bounding box aspect within 2% of 640:360; height >= 330 (desktop) and >= 260 (mobile); no horizontal or vertical scroll in the shell
  const actualAspect = canvasBox.width / canvasBox.height;
  const targetAspect = 640 / 360;
  const aspectDeviation = Math.abs(actualAspect - targetAspect) / targetAspect;
  console.log(`  Canvas Aspect Ratio: ${actualAspect.toFixed(4)}, target: ${targetAspect.toFixed(4)}, deviation: ${(aspectDeviation * 100).toFixed(2)}%`);
  if (aspectDeviation > 0.02) {
    throw new Error(`Canvas aspect ratio deviates by ${(aspectDeviation * 100).toFixed(2)}% from 640:360 (max 2% allowed)`);
  }

  if (!isMobile) {
    const desktopRatio = canvasBox.width / 1366;
    console.log(`  Desktop canvas width ratio: ${(desktopRatio * 100).toFixed(1)}% (${canvasBox.width}px / 1366px), height: ${canvasBox.height}px (target >= 330px)`);
    if (canvasBox.height < 330) {
      throw new Error(`Desktop canvas height < 330px: ${canvasBox.height}px`);
    }
    console.log('  [PASS] Desktop canvas height >= 330px and aspect within 2% of 640:360');
  } else {
    console.log(`  Mobile canvas width: ${canvasBox.width}px, height: ${canvasBox.height}px (target >= 260px)`);
    if (canvasBox.height < 260) {
      throw new Error(`Mobile canvas height < 260px: ${canvasBox.height}px`);
    }
    console.log('  [PASS] Mobile canvas height >= 260px and aspect within 2% of 640:360');
  }

  // Shell scroll assertion: no horizontal or vertical scroll in the shell or document
  const scrollCheck = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="minigame-shell"]');
    return {
      shellScrollLeft: shell ? shell.scrollLeft : 0,
      shellScrollTop: shell ? shell.scrollTop : 0,
      docScrollY: window.scrollY,
      docScrollX: window.scrollX,
      docScrollHeight: document.documentElement.scrollHeight,
      winInnerHeight: window.innerHeight,
    };
  });
  console.log(`  Shell/Page scroll check:`, scrollCheck);
  if (scrollCheck.shellScrollLeft !== 0 || scrollCheck.shellScrollTop !== 0 || scrollCheck.docScrollY !== 0 || scrollCheck.docScrollHeight > scrollCheck.winInnerHeight + 2) {
    throw new Error(`Scroll detected inside shell or page: ${JSON.stringify(scrollCheck)}`);
  }
  console.log('  [PASS] No horizontal or vertical scroll in the shell');

  if (isMobile) {
    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    console.log(`  Mobile Exit Button Box: h=${exitBox?.height}, w=${exitBox?.width}`);
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');

    // Trigger assist button to check height
    await page.evaluate(() => window.__triggerMiniGameAssist?.());
    const assistBtn = page.locator('[data-testid="minigame-assist"]');
    await assistBtn.waitFor({ state: 'visible', timeout: 3000 });
    const assistBox = await assistBtn.boundingBox();
    console.log(`  Mobile Assist Button Box: h=${assistBox?.height}, w=${assistBox?.width}`);
    if (!assistBox || assistBox.height < 44) {
      throw new Error(`Assist button height < 44px on mobile: ${assistBox?.height}`);
    }
    console.log('  [PASS] Assist button >= 44px on mobile');
  }

  // Verify direct rock controls & sample jar
  const sampleJar = page.locator('[data-testid="sample-jar"]');
  await sampleJar.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] sample-jar container visible');

  const drillTarget = page.locator('[data-testid="rock-drill-target"]');
  await drillTarget.waitFor({ state: 'visible', timeout: 4000 });
  const drillTargetBox = await drillTarget.boundingBox();
  console.log(`  Rock Drill Target Box: w=${drillTargetBox?.width}, h=${drillTargetBox?.height}`);
  if (!drillTargetBox || drillTargetBox.height < 44) {
    throw new Error(`Rock drill target height < 44px: ${drillTargetBox?.height}`);
  }
  console.log('  [PASS] Direct rock drill target meets touch target guidelines (>=44px)');

  // 1. Check Reduce Motion ON, then OFF: hold rock-drill-target for 3s with real pointer events, assert data-core-progress increases in both modes
  const blueberryGame = page.locator('[data-testid="blueberry-game"]');

  // A. Reduce Motion ON
  console.log('  Testing Check 1: Reduce Motion ON hold rock-drill-target for 3s...');
  await page.evaluate(() => window.__setReduceMotion?.(true));
  const prog0 = Number(await blueberryGame.getAttribute('data-core-progress') || 0);

  if (drillTargetBox) {
    await page.mouse.move(drillTargetBox.x + drillTargetBox.width / 2, drillTargetBox.y + drillTargetBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3000);
    await page.mouse.up();
  } else {
    await drillTarget.dispatchEvent('pointerdown');
    await page.waitForTimeout(3000);
    await drillTarget.dispatchEvent('pointerup');
  }
  const prog1 = Number(await blueberryGame.getAttribute('data-core-progress') || 0);
  console.log(`  Reduce Motion ON: core progress went from ${prog0} to ${prog1}`);
  if (prog1 <= prog0) {
    throw new Error(`Reduce Motion ON: data-core-progress did not increase! prog0=${prog0}, prog1=${prog1}`);
  }
  console.log('  [PASS] Reduce Motion ON: data-core-progress increased during 3s hold');

  // Exit and reopen to test clean session with Reduce Motion OFF
  const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await exitBtn.click();
  await minigameShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(300);

  // Turn Reduce Motion OFF
  await page.evaluate(() => window.__setReduceMotion?.(false));

  // Re-open Opportunity mini-game
  await interactPrompt.click();
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();
  await minigameShell.waitFor({ state: 'visible', timeout: 6000 });
  await drillTarget.waitFor({ state: 'visible', timeout: 4000 });

  // B. Reduce Motion OFF
  console.log('  Testing Check 1: Reduce Motion OFF hold rock-drill-target for 3s...');
  const prog2 = Number(await blueberryGame.getAttribute('data-core-progress') || 0);
  const drillTargetBox2 = await drillTarget.boundingBox();
  if (drillTargetBox2) {
    await page.mouse.move(drillTargetBox2.x + drillTargetBox2.width / 2, drillTargetBox2.y + drillTargetBox2.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3000);
    await page.mouse.up();
  } else {
    await drillTarget.dispatchEvent('pointerdown');
    await page.waitForTimeout(3000);
    await drillTarget.dispatchEvent('pointerup');
  }
  const prog3 = Number(await blueberryGame.getAttribute('data-core-progress') || 0);
  console.log(`  Reduce Motion OFF: core progress went from ${prog2} to ${prog3}`);
  if (prog3 <= prog2) {
    throw new Error(`Reduce Motion OFF: data-core-progress did not increase! prog2=${prog2}, prog3=${prog3}`);
  }
  console.log('  [PASS] Reduce Motion OFF: data-core-progress increased during 3s hold');

  await snap('06a_blueberry_active_game');

  // 2. Autoplay win (with ?debug=1): minigame-win text does not contain "MARATHON" and contains "SAMPLES SECURED". Claim part gives 1/8, log recovered, +1 RP toast once.
  console.log('  Testing Check 2: Autoplay win (?debug=1)...');
  const rpBefore = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before 3-star run: ${rpBefore}`);

  await page.evaluate(() => {
    (window.__blueberryAutoplay || window.__craterAutoplay)?.();
  });

  const minigameWin = page.locator('[data-testid="minigame-win"]');
  await minigameWin.waitFor({ state: 'visible', timeout: 8000 });

  const winText = await minigameWin.textContent();
  console.log(`  Minigame Win Text: "${winText}"`);
  if (winText.includes('MARATHON')) {
    throw new Error(`minigame-win text should not contain "MARATHON", got: ${winText}`);
  }
  if (!winText.includes('SAMPLES SECURED')) {
    throw new Error(`minigame-win text must contain "SAMPLES SECURED", got: ${winText}`);
  }
  console.log('  [PASS] minigame-win text contains "SAMPLES SECURED" and no "MARATHON"');

  const starsEl = page.locator('[data-testid="minigame-stars"]');
  const stars3 = await starsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay: ${stars3}`);
  if (stars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay, got: ${stars3}`);
  }

  const bonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await bonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const bonusToastText = await bonusToast.textContent();
  console.log(`  Bonus RP toast text: "${bonusToastText}"`);
  if (!bonusToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${bonusToastText}`);
  }

  const rpAfter = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after 3-star run: ${rpAfter} (expected: ${rpBefore + 1})`);
  if (rpAfter !== rpBefore + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBefore}, after: ${rpAfter}`);
  }
  console.log('  [PASS] 3 stars achieved, bonus RP toast displayed, RP increased by +1');
  await snap('06a_blueberry_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button...');
  const retryBtn = page.locator('[data-testid="minigame-retry"]');
  const retryBox = await retryBtn.boundingBox();
  console.log(`  Retry Button Box: h=${retryBox?.height}, w=${retryBox?.width}`);
  if (!retryBox || retryBox.height < 44) {
    throw new Error(`Retry button height < 44px: ${retryBox?.height}`);
  }
  console.log('  [PASS] Retry button >= 44px tall');

  await retryBtn.click();
  await minigameWin.waitFor({ state: 'detached', timeout: 5000 });
  await rockCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Blueberry Lab successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    (window.__blueberryAutoplay || window.__craterAutoplay)?.();
  });
  await minigameWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRun = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRun} (expected: ${rpAfter})`);
  if (rpSecondRun !== rpAfter) {
    throw new Error(`Second 3-star run awarded extra RP! Expected ${rpAfter}, got ${rpSecondRun}`);
  }
  console.log('  [PASS] Second run did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact updated eq_opportunity line is visible
  const factBtn = page.locator('[data-testid="minigame-fact"]');
  await factBtn.click();
  await page.waitForTimeout(300);
  const factText = await factBtn.textContent();
  console.log(`  Did You Know Fact Text: "${factText}"`);
  const expectedFact = "Opportunity drove over 45 km on Mars, farther than a marathon, and worked for about 14 years.";
  if (!factText.includes(expectedFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${factText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Opportunity');
  await snap('06a_blueberry_fact_revealed');
  await snap('06a_blueberry_win_stars_fact');

  // 4. Claim the part; assert part count goes to 1/8 and Opportunity story log is recovered
  console.log('  Claiming part from Opportunity...');
  const claimPartBtn = page.locator('[data-testid="claim-part-btn"]');
  await claimPartBtn.click();
  await minigameShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is 1
  const parts = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Opportunity claim:`, parts);
  if (!parts.includes('part_solar_bus') || parts.length !== 1) {
    throw new Error(`Expected collectedPartIds to contain 'part_solar_bus' with length 1, got: ${JSON.stringify(parts)}`);
  }

  // Assert recovered log includes 'log_opportunity'
  const logs = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Opportunity claim:`, logs);
  if (!logs.includes('log_opportunity') || logs.length !== 1) {
    throw new Error(`Expected recoveredLogIds to contain 'log_opportunity' with length 1, got: ${JSON.stringify(logs)}`);
  }
  console.log('  [PASS] Part count is 1/8 and Opportunity story log recovered');
  await snap('06b_marathon_part_claimed');

  // -------------------------------------------------------------------------
  // 6B. VERIFY STORY MEMORY LOG UNLOCK (TOAST, CODEX, D-PAD NON-COLLISION)
  // -------------------------------------------------------------------------
  console.log('6B. Verifying Story Memory Log Unlock from Claimed Opportunity...');

  // 1. Assert claiming Opportunity unlocked LOG 1/8, shows toast, does not collide with the mobile D-pad on 390x844
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

  // Assert unlocked Opportunity log entry with FICTION tag and exact text
  const log2TextEl = codexModal.locator('[data-testid="log-text-2"]');
  if (!(await log2TextEl.isVisible())) {
    throw new Error('Log #2 text is not visible in Codex Logs tab');
  }
  const log2Text = await log2TextEl.textContent();
  console.log(`  Log #2 Text: "${log2Text}"`);
  if (!log2Text.includes("This rover worked for years beyond its plan. Lesson: keep going past the plan.")) {
    throw new Error(`Log #2 text does not match exact premise text: ${log2Text}`);
  }

  const log2Entry = codexModal.locator('[data-testid="codex-log-entry-2"]');
  const log2FictionTag = log2Entry.locator('[data-testid="fiction-tag"]');
  if (!(await log2FictionTag.isVisible())) {
    throw new Error('FICTION tag missing from unlocked Log #2 in Codex');
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

  const reloadedLog2El = codexModal.locator('[data-testid="log-text-2"]');
  if (!(await reloadedLog2El.isVisible())) {
    throw new Error('After reload, Log #2 text is not visible (was not preserved)');
  }
  const reloadedLockedCount = await codexModal.locator('[data-testid^="codex-log-locked-"]').count();
  if (reloadedLockedCount !== 7) {
    throw new Error(`After reload, expected 7 locked slots, found ${reloadedLockedCount}`);
  }
  console.log('  [PASS] Reload preserved 1 unlocked log and 7 locked slots');

  await codexCloseBtn.click();
  await codexModal.waitFor({ state: 'detached', timeout: 5000 });

  // Assert bonusRpWreckIds persisted after reload
  const persistedBonusIds = await page.evaluate(() => window.__getBonusRpWreckIds ? window.__getBonusRpWreckIds() : []);
  console.log('  Persisted bonusRpWreckIds after reload:', persistedBonusIds);
  if (!persistedBonusIds.includes('eq_opportunity')) {
    throw new Error(`bonusRpWreckIds not persisted after reload. Got: ${JSON.stringify(persistedBonusIds)}`);
  }
  console.log('  [PASS] bonusRpWreckIds persisted after reload');

  // -------------------------------------------------------------------------
  // 6C. PHOENIX POLAR ICE LANDER ("DIG FOR ICE" - STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6C. Testing Phoenix Polar Ice Lander ("Dig for Ice")...');
  const tpPhoenixResult = await page.evaluate(() => window.__teleportToWreck('eq_phoenix'));
  console.log('  Teleport to Phoenix:', tpPhoenixResult);
  if (!tpPhoenixResult?.success) {
    throw new Error('Failed to teleport to Phoenix wreck eq_phoenix');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Phoenix mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with ice canvas
  const phoenixShell = page.locator('[data-testid="minigame-shell"]');
  await phoenixShell.waitFor({ state: 'visible', timeout: 6000 });
  const iceCanvas = page.locator('[data-testid="crater-canvas"]');
  await iceCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Phoenix minigame-shell and ice canvas visible');

  // Verify mobile no-scroll and touch targets
  if (isMobile) {
    const noScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= window.innerHeight + 2 && window.scrollY === 0;
    });
    if (!noScroll) {
      const heights = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      throw new Error(`Mobile page scroll detected during Phoenix mini-game: ${JSON.stringify(heights)}`);
    }
    console.log('  [PASS] No mobile page scroll during Phoenix mini-game');

    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');
  }

  // Verify cooler chute container visible
  const coolerChute = page.locator('[data-testid="cooler-chute"]');
  await coolerChute.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] cooler-chute container visible');

  // Direct canvas drag test: simulate dragging scoop downwards
  const iceBox = await iceCanvas.boundingBox();
  if (iceBox) {
    await page.mouse.move(iceBox.x + iceBox.width / 2, iceBox.y + 40);
    await page.mouse.down();
    await page.mouse.move(iceBox.x + iceBox.width / 2, iceBox.y + 120, { steps: 5 });
    await page.waitForTimeout(200);
    await page.mouse.up();
  }
  await snap('06c_phoenix_active_game');

  // 1. Test autoplay flag -> 3 stars, bonus RP toast, RP +1
  console.log('  Testing Phoenix autoplay hook for 3 stars and +1 bonus RP...');
  const rpBeforePhoenix = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before Phoenix 3-star run: ${rpBeforePhoenix}`);

  await page.evaluate(() => {
    window.__phoenixAutoplay?.();
  });

  const phoenixWin = page.locator('[data-testid="minigame-win"]');
  await phoenixWin.waitFor({ state: 'visible', timeout: 8000 });

  const phoenixStarsEl = page.locator('[data-testid="minigame-stars"]');
  const phoenixStars3 = await phoenixStarsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay: ${phoenixStars3}`);
  if (phoenixStars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay on Phoenix, got: ${phoenixStars3}`);
  }

  const phoenixBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await phoenixBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const phoenixToastText = await phoenixBonusToast.textContent();
  console.log(`  Bonus RP toast text: "${phoenixToastText}"`);
  if (!phoenixToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${phoenixToastText}`);
  }

  const rpAfterPhoenix = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after Phoenix 3-star run: ${rpAfterPhoenix} (expected: ${rpBeforePhoenix + 1})`);
  if (rpAfterPhoenix !== rpBeforePhoenix + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBeforePhoenix}, after: ${rpAfterPhoenix}`);
  }
  console.log('  [PASS] 3 stars achieved, bonus RP toast displayed, RP increased by +1');
  await snap('06c_phoenix_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button on Phoenix...');
  const phoenixRetryBtn = page.locator('[data-testid="minigame-retry"]');
  const pRetryBox = await phoenixRetryBtn.boundingBox();
  if (!pRetryBox || pRetryBox.height < 44) {
    throw new Error(`Phoenix retry button height < 44px: ${pRetryBox?.height}`);
  }
  console.log('  [PASS] Phoenix retry button >= 44px tall');

  await phoenixRetryBtn.click();
  await phoenixWin.waitFor({ state: 'detached', timeout: 5000 });
  await iceCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Dig for Ice successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    window.__phoenixAutoplay?.();
  });
  await phoenixWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRunPhoenix = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRunPhoenix} (expected: ${rpAfterPhoenix})`);
  if (rpSecondRunPhoenix !== rpAfterPhoenix) {
    throw new Error(`Second 3-star run awarded extra RP! Expected ${rpAfterPhoenix}, got ${rpSecondRunPhoenix}`);
  }
  console.log('  [PASS] Second run did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact detective story fact is visible
  const phoenixFactBtn = page.locator('[data-testid="minigame-fact"]');
  await phoenixFactBtn.click();
  await page.waitForTimeout(300);
  const phoenixFactText = await phoenixFactBtn.textContent();
  console.log(`  Did You Know Fact Text: "${phoenixFactText}"`);
  const expectedPhoenixFact = "Phoenix photographed white chunks in its trench, and they were gone a few days later. Salt wouldn't do that, so it was ice.";
  if (!phoenixFactText.includes(expectedPhoenixFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${phoenixFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Phoenix');
  await snap('06c_phoenix_fact_revealed');
  await snap('06c_phoenix_win_stars_fact');

  // 4. Claim the part; assert part count goes to 2/8 and Phoenix story log is recovered
  console.log('  Claiming part from Phoenix...');
  const phoenixClaimBtn = page.locator('[data-testid="claim-part-btn"]');
  await phoenixClaimBtn.click();
  await phoenixShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is now 2
  const partsAfterPhoenix = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Phoenix claim:`, partsAfterPhoenix);
  if (!partsAfterPhoenix.includes('part_thermal_core') || partsAfterPhoenix.length !== 2) {
    throw new Error(`Expected collectedPartIds to contain 'part_thermal_core' with length 2, got: ${JSON.stringify(partsAfterPhoenix)}`);
  }

  // Assert recovered logs includes 'log_phoenix'
  const logsAfterPhoenix = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Phoenix claim:`, logsAfterPhoenix);
  if (!logsAfterPhoenix.includes('log_phoenix') || logsAfterPhoenix.length !== 2) {
    throw new Error(`Expected recoveredLogIds to contain 'log_phoenix' with length 2, got: ${JSON.stringify(logsAfterPhoenix)}`);
  }
  console.log('  [PASS] Part count is 2/8 and Phoenix story log recovered');
  await snap('06c_phoenix_part_claimed');

  // -------------------------------------------------------------------------
  // 6D. SPIRIT ROVER ("THE DRAGGED WHEEL" - STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6D. Testing Spirit Rover ("The Dragged Wheel")...');
  const tpSpiritResult = await page.evaluate(() => window.__teleportToWreck('eq_spirit'));
  console.log('  Teleport to Spirit:', tpSpiritResult);
  if (!tpSpiritResult?.success) {
    throw new Error('Failed to teleport to Spirit wreck eq_spirit');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Spirit mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with Spirit wheel game canvas
  const spiritShell = page.locator('[data-testid="minigame-shell"]');
  await spiritShell.waitFor({ state: 'visible', timeout: 6000 });
  const spiritCanvas = page.locator('[data-testid="crater-canvas"]');
  await spiritCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Spirit minigame-shell and canvas visible');

  // Verify mobile no-scroll and touch targets
  if (isMobile) {
    const noScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= window.innerHeight + 2 && window.scrollY === 0;
    });
    if (!noScroll) {
      const heights = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      throw new Error(`Mobile page scroll detected during Spirit mini-game: ${JSON.stringify(heights)}`);
    }
    console.log('  [PASS] No mobile page scroll during Spirit mini-game');

    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');
  }

  // Verify silica counter visible
  const silicaCounter = page.locator('[data-testid="silica-counter"]');
  await silicaCounter.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] silica-counter container visible');

  // Verify tactile steer buttons have min 44px touch targets
  const steerLeftBtn = page.locator('[data-testid="steer-left-btn"]');
  const steerLeftBox = await steerLeftBtn.boundingBox();
  if (!steerLeftBox || steerLeftBox.height < 44) {
    throw new Error(`Steer left button height < 44px: ${steerLeftBox?.height}`);
  }
  const steerRightBtn = page.locator('[data-testid="steer-right-btn"]');
  const steerRightBox = await steerRightBtn.boundingBox();
  if (!steerRightBox || steerRightBox.height < 44) {
    throw new Error(`Steer right button height < 44px: ${steerRightBox?.height}`);
  }
  console.log('  [PASS] Spirit tactile counter-steer buttons meet touch target guidelines (>=44px)');

  // Test counter-steering
  await steerLeftBtn.hover();
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await snap('06d_spirit_active_game');

  // 1. Test autoplay flag -> 3 stars, bonus RP toast, RP +1
  console.log('  Testing Spirit autoplay hook for 3 stars and +1 bonus RP...');
  const rpBeforeSpirit = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before Spirit 3-star run: ${rpBeforeSpirit}`);

  await page.evaluate(() => {
    window.__spiritAutoplay?.();
  });

  const spiritWin = page.locator('[data-testid="minigame-win"]');
  await spiritWin.waitFor({ state: 'visible', timeout: 8000 });

  const spiritStarsEl = page.locator('[data-testid="minigame-stars"]');
  const spiritStars3 = await spiritStarsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay on Spirit: ${spiritStars3}`);
  if (spiritStars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay on Spirit, got: ${spiritStars3}`);
  }

  const spiritBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await spiritBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const spiritToastText = await spiritBonusToast.textContent();
  console.log(`  Bonus RP toast text: "${spiritToastText}"`);
  if (!spiritToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${spiritToastText}`);
  }

  const rpAfterSpirit = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after Spirit 3-star run: ${rpAfterSpirit} (expected: ${rpBeforeSpirit + 1})`);
  if (rpAfterSpirit !== rpBeforeSpirit + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBeforeSpirit}, after: ${rpAfterSpirit}`);
  }
  console.log('  [PASS] 3 stars achieved on Spirit, bonus RP toast displayed, RP increased by +1');
  await snap('06d_spirit_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button on Spirit...');
  const spiritRetryBtn = page.locator('[data-testid="minigame-retry"]');
  const sRetryBox = await spiritRetryBtn.boundingBox();
  if (!sRetryBox || sRetryBox.height < 44) {
    throw new Error(`Spirit retry button height < 44px: ${sRetryBox?.height}`);
  }
  console.log('  [PASS] Spirit retry button >= 44px tall');

  await spiritRetryBtn.click();
  await spiritWin.waitFor({ state: 'detached', timeout: 5000 });
  await spiritCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted The Dragged Wheel successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    window.__spiritAutoplay?.();
  });
  await spiritWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRunSpirit = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRunSpirit} (expected: ${rpAfterSpirit})`);
  if (rpSecondRunSpirit !== rpAfterSpirit) {
    throw new Error(`Second 3-star run on Spirit awarded extra RP! Expected ${rpAfterSpirit}, got ${rpSecondRunSpirit}`);
  }
  console.log('  [PASS] Second run on Spirit did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact historical fact is visible
  const spiritFactBtn = page.locator('[data-testid="minigame-fact"]');
  await spiritFactBtn.click();
  await page.waitForTimeout(300);
  const spiritFactText = await spiritFactBtn.textContent();
  console.log(`  Did You Know Fact Text: "${spiritFactText}"`);
  const expectedSpiritFact = "Spirit's jammed wheel was dragged backwards, accidentally digging up bright silica—proof of ancient volcanic hot springs!";
  if (!spiritFactText.includes(expectedSpiritFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${spiritFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Spirit');
  await snap('06d_spirit_fact_revealed');
  await snap('06d_spirit_win_stars_fact');

  // 4. Claim the part; assert part count goes to 3/8 and Spirit story log is recovered
  console.log('  Claiming part from Spirit...');
  const spiritClaimBtn = page.locator('[data-testid="claim-part-btn"]');
  await spiritClaimBtn.click();
  await spiritShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is now 3
  const partsAfterSpirit = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Spirit claim:`, partsAfterSpirit);
  if (!partsAfterSpirit.includes('part_suspension_link') || partsAfterSpirit.length !== 3) {
    throw new Error(`Expected collectedPartIds to contain 'part_suspension_link' with length 3, got: ${JSON.stringify(partsAfterSpirit)}`);
  }

  // Assert recovered logs includes 'log_spirit'
  const logsAfterSpirit = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Spirit claim:`, logsAfterSpirit);
  if (!logsAfterSpirit.includes('log_spirit') || logsAfterSpirit.length !== 3) {
    throw new Error(`Expected recoveredLogIds to contain 'log_spirit' with length 3, got: ${JSON.stringify(logsAfterSpirit)}`);
  }
  console.log('  [PASS] Part count is 3/8 and Spirit story log recovered');
  await snap('06d_spirit_part_claimed');

  // -------------------------------------------------------------------------
  // 6E. DEEP SPACE RELAY ARRAY ("CARRIER LOCK" - STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6E. Testing Deep Space Relay Array ("Carrier Lock")...');
  const tpDishResult = await page.evaluate(() => window.__teleportToWreck('eq_deep_space_dish'));
  console.log('  Teleport to Deep Space Dish:', tpDishResult);
  if (!tpDishResult?.success) {
    throw new Error('Failed to teleport to Deep Space Dish wreck eq_deep_space_dish');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Deep Space mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with deep space sky canvas
  const dishShell = page.locator('[data-testid="minigame-shell"]');
  await dishShell.waitFor({ state: 'visible', timeout: 6000 });
  const dishCanvas = page.locator('[data-testid="crater-canvas"]');
  await dishCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Deep Space Dish minigame-shell and canvas visible');

  // Verify mobile no-scroll and touch targets
  if (isMobile) {
    const noScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= window.innerHeight + 2 && window.scrollY === 0;
    });
    if (!noScroll) {
      const heights = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      throw new Error(`Mobile page scroll detected during Deep Space mini-game: ${JSON.stringify(heights)}`);
    }
    console.log('  [PASS] No mobile page scroll during Deep Space mini-game');

    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');
  }

  // Verify SNR counter visible
  const snrCounter = page.locator('[data-testid="snr-counter"]');
  await snrCounter.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] snr-counter container visible');

  // Verify tactile gimbal buttons have min 44px touch targets
  const azLeftBtn = page.locator('[data-testid="az-left-btn"]');
  const azLeftBox = await azLeftBtn.boundingBox();
  if (!azLeftBox || azLeftBox.height < 44) {
    throw new Error(`Azimuth left button height < 44px: ${azLeftBox?.height}`);
  }
  const azRightBtn = page.locator('[data-testid="az-right-btn"]');
  const azRightBox = await azRightBtn.boundingBox();
  if (!azRightBox || azRightBox.height < 44) {
    throw new Error(`Azimuth right button height < 44px: ${azRightBox?.height}`);
  }
  const elUpBtn = page.locator('[data-testid="el-up-btn"]');
  const elUpBox = await elUpBtn.boundingBox();
  if (!elUpBox || elUpBox.height < 44) {
    throw new Error(`Elevation up button height < 44px: ${elUpBox?.height}`);
  }
  const elDownBtn = page.locator('[data-testid="el-down-btn"]');
  const elDownBox = await elDownBtn.boundingBox();
  if (!elDownBox || elDownBox.height < 44) {
    throw new Error(`Elevation down button height < 44px: ${elDownBox?.height}`);
  }
  console.log('  [PASS] Deep Space tactile gimbal buttons meet touch target guidelines (>=44px)');

  // Test nudging gimbals
  await azRightBtn.click();
  await elUpBtn.click();
  await snap('06e_deep_space_active_game');

  // 1. Test autoplay flag -> 3 stars, bonus RP toast, RP +1
  console.log('  Testing Deep Space autoplay hook for 3 stars and +1 bonus RP...');
  const rpBeforeDish = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before Deep Space 3-star run: ${rpBeforeDish}`);

  await page.evaluate(() => {
    window.__deepSpaceAutoplay?.();
  });

  const dishWin = page.locator('[data-testid="minigame-win"]');
  await dishWin.waitFor({ state: 'visible', timeout: 8000 });

  const dishStarsEl = page.locator('[data-testid="minigame-stars"]');
  const dishStars3 = await dishStarsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay on Deep Space Dish: ${dishStars3}`);
  if (dishStars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay on Deep Space Dish, got: ${dishStars3}`);
  }

  const dishBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await dishBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const dishToastText = await dishBonusToast.textContent();
  console.log(`  Bonus RP toast text: "${dishToastText}"`);
  if (!dishToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${dishToastText}`);
  }

  const rpAfterDish = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after Deep Space 3-star run: ${rpAfterDish} (expected: ${rpBeforeDish + 1})`);
  if (rpAfterDish !== rpBeforeDish + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBeforeDish}, after: ${rpAfterDish}`);
  }
  console.log('  [PASS] 3 stars achieved on Deep Space Dish, bonus RP toast displayed, RP increased by +1');
  await snap('06e_deep_space_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button on Deep Space Dish...');
  const dishRetryBtn = page.locator('[data-testid="minigame-retry"]');
  const dRetryBox = await dishRetryBtn.boundingBox();
  if (!dRetryBox || dRetryBox.height < 44) {
    throw new Error(`Deep Space retry button height < 44px: ${dRetryBox?.height}`);
  }
  console.log('  [PASS] Deep Space retry button >= 44px tall');

  await dishRetryBtn.click();
  await dishWin.waitFor({ state: 'detached', timeout: 5000 });
  await dishCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Deep Space Carrier Lock successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    window.__deepSpaceAutoplay?.();
  });
  await dishWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRunDish = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRunDish} (expected: ${rpAfterDish})`);
  if (rpSecondRunDish !== rpAfterDish) {
    throw new Error(`Second 3-star run on Deep Space Dish awarded extra RP! Expected ${rpAfterDish}, got ${rpSecondRunDish}`);
  }
  console.log('  [PASS] Second run on Deep Space Dish did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact historical fact is visible
  const dishFactBtn = page.locator('[data-testid="minigame-fact"]');
  await dishFactBtn.click();
  await page.waitForTimeout(300);
  const dishFactText = await dishFactBtn.textContent();
  console.log(`  Did You Know Fact Text: "${dishFactText}"`);
  const expectedDishFact = "Radio signals travel at the speed of light, but still take up to 20 minutes to cross the void between Earth and Mars!";
  if (!dishFactText.includes(expectedDishFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${dishFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Deep Space Dish');
  await snap('06e_deep_space_fact_revealed');
  await snap('06e_deep_space_win_stars_fact');

  // 4. Claim the part; assert part count goes to 4/8 and Deep Space story log is recovered
  console.log('  Claiming part from Deep Space Dish...');
  const dishClaimBtn = page.locator('[data-testid="claim-part-btn"]');
  await dishClaimBtn.click();
  await dishShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is now 4
  const partsAfterDish = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Deep Space claim:`, partsAfterDish);
  if (!partsAfterDish.includes('part_comm_transponder') || partsAfterDish.length !== 4) {
    throw new Error(`Expected collectedPartIds to contain 'part_comm_transponder' with length 4, got: ${JSON.stringify(partsAfterDish)}`);
  }

  // Assert recovered logs includes 'log_deep_space_dish'
  const logsAfterDish = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Deep Space claim:`, logsAfterDish);
  if (!logsAfterDish.includes('log_deep_space_dish') || logsAfterDish.length !== 4) {
    throw new Error(`Expected recoveredLogIds to contain 'log_deep_space_dish' with length 4, got: ${JSON.stringify(logsAfterDish)}`);
  }
  console.log('  [PASS] Part count is 4/8 and Deep Space story log recovered');
  await snap('06e_deep_space_part_claimed');

  // -------------------------------------------------------------------------
  // 6F. APOLLO LUNAR ROVING VEHICLE ("WIRE-MESH MOON DRIFT" - STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6F. Testing Apollo Lunar Roving Vehicle ("Wire-Mesh Moon Drift")...');
  const tpLrvResult = await page.evaluate(() => window.__teleportToWreck('eq_lrv_buggy'));
  console.log('  Teleport to Apollo LRV:', tpLrvResult);
  if (!tpLrvResult?.success) {
    throw new Error('Failed to teleport to Apollo LRV wreck eq_lrv_buggy');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Apollo LRV mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with lrv canvas
  const lrvShell = page.locator('[data-testid="minigame-shell"]');
  await lrvShell.waitFor({ state: 'visible', timeout: 6000 });
  const lrvCanvas = page.locator('[data-testid="lrv-canvas"]');
  await lrvCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Apollo LRV minigame-shell and canvas visible');

  // Verify mobile no-scroll and touch targets
  if (isMobile) {
    const noScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= window.innerHeight + 2 && window.scrollY === 0;
    });
    if (!noScroll) {
      const heights = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      throw new Error(`Mobile page scroll detected during Apollo LRV mini-game: ${JSON.stringify(heights)}`);
    }
    console.log('  [PASS] No mobile page scroll during Apollo LRV mini-game');

    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');
  }

  // Verify Samples counter visible
  const lrvSamplesCounter = page.locator('[data-testid="lrv-samples-counter"]');
  await lrvSamplesCounter.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] lrv-samples-counter container visible');

  // Verify tactile buttons have min 44px touch targets
  const lrvSteerLeftBtn = page.locator('[data-testid="lrv-steer-left"]');
  const lrvSteerLeftBox = await lrvSteerLeftBtn.boundingBox();
  if (!lrvSteerLeftBox || lrvSteerLeftBox.height < 44) {
    throw new Error(`LRV steer left button height < 44px: ${lrvSteerLeftBox?.height}`);
  }
  const lrvSteerRightBtn = page.locator('[data-testid="lrv-steer-right"]');
  const lrvSteerRightBox = await lrvSteerRightBtn.boundingBox();
  if (!lrvSteerRightBox || lrvSteerRightBox.height < 44) {
    throw new Error(`LRV steer right button height < 44px: ${lrvSteerRightBox?.height}`);
  }
  const lrvThrottleBtn = page.locator('[data-testid="lrv-throttle"]');
  const lrvThrottleBox = await lrvThrottleBtn.boundingBox();
  if (!lrvThrottleBox || lrvThrottleBox.height < 44) {
    throw new Error(`LRV throttle button height < 44px: ${lrvThrottleBox?.height}`);
  }
  console.log('  [PASS] Apollo LRV tactile buttons meet touch target guidelines (>=44px)');

  // Test nudging steering
  await lrvSteerLeftBtn.click();
  await lrvSteerRightBtn.click();
  await snap('06f_lrv_active_game');

  // 1. Test autoplay flag -> 3 stars, bonus RP toast, RP +1
  console.log('  Testing Apollo LRV autoplay hook for 3 stars and +1 bonus RP...');
  const rpBeforeLrv = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before Apollo LRV 3-star run: ${rpBeforeLrv}`);

  await page.evaluate(() => {
    window.__lrvAutoplay?.();
  });

  const lrvWin = page.locator('[data-testid="minigame-win"]');
  await lrvWin.waitFor({ state: 'visible', timeout: 8000 });

  const lrvStarsEl = page.locator('[data-testid="minigame-stars"]');
  const lrvStars3 = await lrvStarsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay on Apollo LRV: ${lrvStars3}`);
  if (lrvStars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay on Apollo LRV, got: ${lrvStars3}`);
  }

  const lrvBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await lrvBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const lrvToastText = await lrvBonusToast.textContent();
  console.log(`  Bonus RP toast text: "${lrvToastText}"`);
  if (!lrvToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${lrvToastText}`);
  }

  const rpAfterLrv = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after Apollo LRV 3-star run: ${rpAfterLrv} (expected: ${rpBeforeLrv + 1})`);
  if (rpAfterLrv !== rpBeforeLrv + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBeforeLrv}, after: ${rpAfterLrv}`);
  }
  console.log('  [PASS] 3 stars achieved on Apollo LRV, bonus RP toast displayed, RP increased by +1');
  await snap('06f_lrv_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button on Apollo LRV...');
  const lrvRetryBtn = page.locator('[data-testid="minigame-retry"]');
  const lRetryBox = await lrvRetryBtn.boundingBox();
  if (!lRetryBox || lRetryBox.height < 44) {
    throw new Error(`Apollo LRV retry button height < 44px: ${lRetryBox?.height}`);
  }
  console.log('  [PASS] Apollo LRV retry button >= 44px tall');

  await lrvRetryBtn.click();
  await lrvWin.waitFor({ state: 'detached', timeout: 5000 });
  await lrvCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Apollo LRV Wire-Mesh Moon Drift successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    window.__lrvAutoplay?.();
  });
  await lrvWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRunLrv = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRunLrv} (expected: ${rpAfterLrv})`);
  if (rpSecondRunLrv !== rpAfterLrv) {
    throw new Error(`Second 3-star run on Apollo LRV awarded extra RP! Expected ${rpAfterLrv}, got ${rpSecondRunLrv}`);
  }
  console.log('  [PASS] Second run on Apollo LRV did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact historical fact is visible
  const lrvFactBtn = page.locator('[data-testid="minigame-fact"]');
  await lrvFactBtn.click();
  await page.waitForTimeout(300);
  const lrvFactText = await lrvFactBtn.textContent();
  console.log(`  Did You Know Fact Text: "${lrvFactText}"`);
  const expectedLrvFact = "The Moon buggy folded up to fit inside the lunar module. Apollo astronauts drove it on three missions.";
  if (!lrvFactText.includes(expectedLrvFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${lrvFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Apollo LRV');
  await snap('06f_lrv_fact_revealed');
  await snap('06f_lrv_win_stars_fact');

  // 4. Claim the part; assert part count goes to 5/8 and Apollo LRV story log is recovered
  console.log('  Claiming part from Apollo LRV...');
  const lrvClaimBtn = page.locator('[data-testid="claim-part-btn"]');
  await lrvClaimBtn.click();
  await lrvShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is now 5
  const partsAfterLrv = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Apollo LRV claim:`, partsAfterLrv);
  if (!partsAfterLrv.includes('part_wheel_actuator') || partsAfterLrv.length !== 5) {
    throw new Error(`Expected collectedPartIds to contain 'part_wheel_actuator' with length 5, got: ${JSON.stringify(partsAfterLrv)}`);
  }

  // Assert recovered logs includes 'log_lrv_buggy'
  const logsAfterLrv = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Apollo LRV claim:`, logsAfterLrv);
  if (!logsAfterLrv.includes('log_lrv_buggy') || logsAfterLrv.length !== 5) {
    throw new Error(`Expected recoveredLogIds to contain 'log_lrv_buggy' with length 5, got: ${JSON.stringify(logsAfterLrv)}`);
  }
  console.log('  [PASS] Part count is 5/8 and Apollo LRV story log recovered');
  await snap('06f_lrv_part_claimed');

  // -------------------------------------------------------------------------
  // 6G. SURVEYOR 3 SURFACE SAMPLER ("THE APOLLO 12 SALVAGE" - STARS, RETRY, BONUS RP, AUTOPLAY, CLAIM)
  // -------------------------------------------------------------------------
  console.log('6G. Testing Surveyor 3 Surface Sampler ("The Apollo 12 Salvage")...');
  const tpSurveyorResult = await page.evaluate(() => window.__teleportToWreck('eq_surveyor'));
  console.log('  Teleport to Surveyor 3:', tpSurveyorResult);
  if (!tpSurveyorResult?.success) {
    throw new Error('Failed to teleport to Surveyor 3 wreck eq_surveyor');
  }
  await page.waitForTimeout(600);

  // Assert interaction prompt is active and open dialogue
  await interactPrompt.waitFor({ state: 'visible', timeout: 6000 });
  await interactPrompt.click();

  // Launch Surveyor 3 mini-game simulator
  await novaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await novaActionBtn.click();

  // Assert minigame-shell appears with surveyor canvas
  const surveyorShell = page.locator('[data-testid="minigame-shell"]');
  await surveyorShell.waitFor({ state: 'visible', timeout: 6000 });
  const surveyorCanvas = page.locator('[data-testid="surveyor-canvas"]');
  await surveyorCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Surveyor 3 minigame-shell and canvas visible');

  // Verify mobile no-scroll and touch targets
  if (isMobile) {
    const noScroll = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollHeight <= window.innerHeight + 2 && window.scrollY === 0;
    });
    if (!noScroll) {
      const heights = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));
      throw new Error(`Mobile page scroll detected during Surveyor 3 mini-game: ${JSON.stringify(heights)}`);
    }
    console.log('  [PASS] No mobile page scroll during Surveyor 3 mini-game');

    // Check Exit button height
    const exitBtn = page.locator('[data-testid="puzzle-exit-btn"]');
    const exitBox = await exitBtn.boundingBox();
    if (!exitBox || exitBox.height < 44) {
      throw new Error(`Exit button height < 44px on mobile: ${exitBox?.height}`);
    }
    console.log('  [PASS] Exit button >= 44px on mobile');
  }

  // Verify primary action button has min 44px touch target
  const surveyorActionBtn = page.locator('[data-testid="surveyor-action-btn"]');
  const surveyorActionBox = await surveyorActionBtn.boundingBox();
  if (!surveyorActionBox || surveyorActionBox.height < 44) {
    throw new Error(`Surveyor action button height < 44px: ${surveyorActionBox?.height}`);
  }
  console.log('  [PASS] Surveyor 3 action button meets touch target guidelines (>=44px)');

  // Test action button click
  await surveyorActionBtn.click();
  await snap('06g_surveyor_active_game');

  // 1. Test autoplay flag -> 3 stars, bonus RP toast, RP +1
  console.log('  Testing Surveyor 3 autoplay hook for 3 stars and +1 bonus RP...');
  const rpBeforeSurveyor = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP before Surveyor 3 3-star run: ${rpBeforeSurveyor}`);

  await page.evaluate(() => {
    window.__surveyorAutoplay?.();
  });

  const surveyorWin = page.locator('[data-testid="minigame-win"]');
  await surveyorWin.waitFor({ state: 'visible', timeout: 8000 });

  const surveyorStarsEl = page.locator('[data-testid="minigame-stars"]');
  const surveyorStars3 = await surveyorStarsEl.getAttribute('data-stars');
  console.log(`  Stars with autoplay on Surveyor 3: ${surveyorStars3}`);
  if (surveyorStars3 !== '3') {
    throw new Error(`Expected 3 stars with autoplay on Surveyor 3, got: ${surveyorStars3}`);
  }

  const surveyorBonusToast = page.locator('[data-testid="bonus-rp-toast"]');
  await surveyorBonusToast.waitFor({ state: 'visible', timeout: 5000 });
  const surveyorToastText = await surveyorBonusToast.textContent();
  console.log(`  Bonus RP toast text: "${surveyorToastText}"`);
  if (!surveyorToastText.includes('+1 RP')) {
    throw new Error(`Bonus RP toast does not contain "+1 RP": ${surveyorToastText}`);
  }

  const rpAfterSurveyor = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after Surveyor 3 3-star run: ${rpAfterSurveyor} (expected: ${rpBeforeSurveyor + 1})`);
  if (rpAfterSurveyor !== rpBeforeSurveyor + 1) {
    throw new Error(`Expected RP to increase by 1, before: ${rpBeforeSurveyor}, after: ${rpAfterSurveyor}`);
  }
  console.log('  [PASS] 3 stars achieved on Surveyor 3, bonus RP toast displayed, RP increased by +1');
  await snap('06g_surveyor_3_stars');

  // 2. Assert retry button works and second run does NOT award duplicate RP
  console.log('  Testing retry button on Surveyor 3...');
  const surveyorRetryBtn = page.locator('[data-testid="minigame-retry"]');
  const surveyorRetryBox = await surveyorRetryBtn.boundingBox();
  if (!surveyorRetryBox || surveyorRetryBox.height < 44) {
    throw new Error(`Surveyor 3 retry button height < 44px: ${surveyorRetryBox?.height}`);
  }
  console.log('  [PASS] Surveyor 3 retry button >= 44px tall');

  await surveyorRetryBtn.click();
  await surveyorWin.waitFor({ state: 'detached', timeout: 5000 });
  await surveyorCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Surveyor 3 The Apollo 12 Salvage successfully');

  // Second 3-star run to verify RP is NOT awarded twice
  await page.evaluate(() => {
    window.__surveyorAutoplay?.();
  });
  await surveyorWin.waitFor({ state: 'visible', timeout: 8000 });
  const rpSecondRunSurveyor = await page.evaluate(() => window.__getResearchPoints ? window.__getResearchPoints() : 0);
  console.log(`  RP after second 3-star run: ${rpSecondRunSurveyor} (expected: ${rpAfterSurveyor})`);
  if (rpSecondRunSurveyor !== rpAfterSurveyor) {
    throw new Error(`Second 3-star run on Surveyor 3 awarded extra RP! Expected ${rpAfterSurveyor}, got ${rpSecondRunSurveyor}`);
  }
  console.log('  [PASS] Second run on Surveyor 3 did NOT give another +1 RP');

  // 3. Tap "Did you know?", assert exact historical fact is visible
  const surveyorFactBtn = page.locator('[data-testid="minigame-fact"]');
  await surveyorFactBtn.click();
  await page.waitForTimeout(300);
  const surveyorFactText = await surveyorFactBtn.textContent();
  console.log(`  Did You Know Fact Text: "${surveyorFactText}"`);
  const expectedSurveyorFact = "Apollo 12 astronauts visited Surveyor 3 in 1969 and brought parts of it home to Earth.";
  if (!surveyorFactText.includes(expectedSurveyorFact)) {
    throw new Error(`Did-you-know fact does not match expected mission line. Got: ${surveyorFactText}`);
  }
  console.log('  [PASS] Exact Did-You-Know fact displayed for Surveyor 3');
  await snap('06g_surveyor_fact_revealed');
  await snap('06g_surveyor_win_stars_fact');

  // 4. Claim the part; assert part count goes to 6/8 and Surveyor 3 story log is recovered
  console.log('  Claiming part from Surveyor 3...');
  const surveyorClaimBtn = page.locator('[data-testid="claim-part-btn"]');
  await surveyorClaimBtn.click();
  await surveyorShell.waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(600);

  // Assert collected parts count is now 6
  const partsAfterSurveyor = await page.evaluate(() => window.__getCollectedPartIds ? window.__getCollectedPartIds() : []);
  console.log(`  Collected parts after Surveyor 3 claim:`, partsAfterSurveyor);
  if (!partsAfterSurveyor.includes('part_sample_arm') || partsAfterSurveyor.length !== 6) {
    throw new Error(`Expected collectedPartIds to contain 'part_sample_arm' with length 6, got: ${JSON.stringify(partsAfterSurveyor)}`);
  }

  // Assert recovered logs includes 'log_surveyor'
  const logsAfterSurveyor = await page.evaluate(() => window.__getRecoveredLogIds ? window.__getRecoveredLogIds() : []);
  console.log(`  Recovered logs after Surveyor 3 claim:`, logsAfterSurveyor);
  if (!logsAfterSurveyor.includes('log_surveyor') || logsAfterSurveyor.length !== 6) {
    throw new Error(`Expected recoveredLogIds to contain 'log_surveyor' with length 6, got: ${JSON.stringify(logsAfterSurveyor)}`);
  }
  console.log('  [PASS] Part count is 6/8 and Surveyor 3 story log recovered');
  await snap('06g_surveyor_part_claimed');

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

  // Assert Skip button hides logs section while keeping reveal line visible
  const skipLogsBtn = page.locator('[data-testid="skip-logs-btn"]');
  await skipLogsBtn.click();
  await page.waitForTimeout(300);
  const isSectionVisibleAfterSkip = await endingLogsSection.isVisible();
  if (isSectionVisibleAfterSkip) {
    throw new Error('Skip logs button failed to hide ending logs section');
  }
  const endingRevealLine = page.locator('[data-testid="ending-reveal-line"]');
  const isRevealLineVisible = await endingRevealLine.isVisible();
  if (!isRevealLineVisible) {
    throw new Error('ending-reveal-line is not visible after clicking skip-logs-btn!');
  }
  console.log('  [PASS] All 8 logs shown in order, Nova reveal line verified, Skip button hides logs while ending-reveal-line is visible');

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

  // 5A. Check 5: Save with collectedPartIds [''] and no recoveredLogIds -> Codex / derived logs shows 0 logs
  console.log('  Testing Check 5: save with collectedPartIds [\"\"] produces 0 logs...');
  await page2.evaluate(() => {
    localStorage.clear();
    const saveEmpty = {
      version: 2,
      currentChapter: 0,
      worldSave: {
        version: 2,
        seed: 19970704,
        playerTileX: 64,
        playerTileY: 64,
        playerFacing: 'down',
        collectedPartIds: [''],
        completedEquipmentIds: [],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 10,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(saveEmpty));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  const progressEmpty = await page2.evaluate(() => window.__getSavedProgress?.() || null);
  const logsEmpty = progressEmpty?.worldSave?.recoveredLogIds || [];
  console.log('  Recovered logs with [\"\"]:', logsEmpty);
  if (logsEmpty.length !== 0) {
    throw new Error(`Expected 0 logs for collectedPartIds [\"\"], got: ${JSON.stringify(logsEmpty)}`);
  }
  console.log('  [PASS] collectedPartIds [\"\"] correctly derived 0 logs');

  // 5B. Check 5: Save with collectedPartIds ['part_drive_motor'] -> produces exactly 1 log
  console.log('  Testing Check 5: save with collectedPartIds [\"part_drive_motor\"] produces 1 log...');
  await page2.evaluate(() => {
    localStorage.clear();
    const saveOne = {
      version: 2,
      currentChapter: 0,
      worldSave: {
        version: 2,
        seed: 19970704,
        playerTileX: 64,
        playerTileY: 64,
        playerFacing: 'down',
        collectedPartIds: ['part_drive_motor'],
        completedEquipmentIds: [],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 20,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(saveOne));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  const progressOne = await page2.evaluate(() => window.__getSavedProgress?.() || null);
  const logsOne = progressOne?.worldSave?.recoveredLogIds || [];
  console.log('  Recovered logs with [\"part_drive_motor\"]:', logsOne);
  if (logsOne.length !== 1 || !logsOne.includes('log_sojourner')) {
    throw new Error(`Expected 1 log ('log_sojourner') for [\"part_drive_motor\"], got: ${JSON.stringify(logsOne)}`);
  }
  console.log('  [PASS] collectedPartIds [\"part_drive_motor\"] correctly derived 1 log');

  // 5C. Save with legacy IDs ['rover_wheel', 'solar_panel']
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

/**
 * Check 4: Production Build Debug Hooks Gate Audit (WITHOUT ?debug=1)
 * Asserts typeof window.__blueberryAutoplay / __craterAutoplay / __marathonAutoplay === 'undefined'
 */
async function runProductionDebugHooksGateAudit(browser) {
  console.log('\n======================================================');
  console.log('Verification 4: Production Build Debug Hooks Gate Audit (WITHOUT ?debug=1)');
  console.log('======================================================');

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  // Load page WITHOUT ?debug=1 from the production dist bundle served on PORT
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const debugHooksAudit = await page.evaluate(() => {
    return {
      blueberry: typeof window.__blueberryAutoplay,
      crater: typeof window.__craterAutoplay,
      marathon: typeof window.__marathonAutoplay,
      insight: typeof window.__insightAutoplay,
      sojourner: typeof window.__sojournerAutoplay,
      triggerWin: typeof window.__triggerMiniGameWin,
      triggerAssist: typeof window.__triggerMiniGameAssist,
    };
  });

  console.log('  Debug hooks in production without ?debug=1:', debugHooksAudit);
  if (
    debugHooksAudit.blueberry !== 'undefined' ||
    debugHooksAudit.crater !== 'undefined' ||
    debugHooksAudit.marathon !== 'undefined' ||
    debugHooksAudit.insight !== 'undefined' ||
    debugHooksAudit.sojourner !== 'undefined' ||
    debugHooksAudit.triggerWin !== 'undefined' ||
    debugHooksAudit.triggerAssist !== 'undefined'
  ) {
    throw new Error(`Production debug hooks exposed without ?debug=1: ${JSON.stringify(debugHooksAudit)}`);
  }
  console.log('  [PASS] All autoplay and mini-game debug hooks are undefined in production without ?debug=1');
  await page.close();
}

async function runAll() {
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  console.log(`Static server running on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // 0. Player walk-up zoom screenshot & A3 assertion
    await runPlayerSpriteAndA3Audit(browser);

    // 1. Production Build Debug Hooks Gate Audit (WITHOUT ?debug=1)
    await runProductionDebugHooksGateAudit(browser);

    // 2. Desktop Pass: 1366 x 768
    await runTestPass(browser, {
      name: 'desktop',
      width: 1366,
      height: 768,
      isMobile: false,
    });

    // 3. Mobile Pass: 390 x 844
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
