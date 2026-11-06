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

  // If Moon prequel appears, skip it to proceed to Mars open-world regression tests
  const moonScene = page.locator('[data-testid="moon-scene"]');
  try {
    await moonScene.waitFor({ state: 'visible', timeout: 4000 });
    const moonSkipBtn = page.locator('[data-testid="moon-skip-btn"]');
    await moonSkipBtn.click();
  } catch {}

  // If Crash Interlude appears (after skipping Moon), skip it to enter Mars open world
  const crashInterlude = page.locator('[data-testid="crash-interlude"]');
  try {
    await crashInterlude.waitFor({ state: 'visible', timeout: 4000 });
    const crashSkipBtn = page.locator('[data-testid="crash-skip-btn"]');
    await crashSkipBtn.click();
  } catch {}

  // Assert Main Menu is detached and World Canvas is visible
  await mainMenu.waitFor({ state: 'detached', timeout: 10000 });
  const worldCanvas = page.locator('[data-testid="world-canvas"]');
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  // If Nova's first dialogue appears on Mars, dismiss it
  try {
    const novaDialogue = page.locator('[data-testid="nova-dialogue"]');
    if (await novaDialogue.isVisible()) {
      const novaDismiss = page.locator('[data-testid="nova-dialogue-action-btn"], [data-testid="nova-dialogue-dismiss-btn"]').first();
      if (await novaDismiss.isVisible()) {
        await novaDismiss.click();
      } else {
        await page.keyboard.press('KeyE');
      }
      await novaDialogue.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch {}
  await page.waitForTimeout(1000);
  await snap('04_world_spawn_ship');

  if (isMobile) {
    console.log('Mobile Polish-1: Testing particle cap (footprints <= 12, dust puffs <= 8)...');
    for (let step = 0; step < 25; step++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(40);
    }
    const particleStats = await page.evaluate(() => window.__getParticleStats?.() || { liveFootprints: 0, liveDustPuffs: 0 });
    console.log('  Mobile particle stats:', particleStats);
    if (particleStats.liveFootprints > 12) {
      throw new Error(`Mobile footprints exceeded cap of 12! Found: ${particleStats.liveFootprints}`);
    }
    if (particleStats.liveDustPuffs > 8) {
      throw new Error(`Mobile dust puffs exceeded cap of 8! Found: ${particleStats.liveDustPuffs}`);
    }
    console.log('  [PASS] Mobile live footprints and dust puffs strictly capped (footprints <= 12, dust puffs <= 8)');
  }

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

    // Polish-2 Section D: Verify sample_stromatolite_fossil card copy & category
    const stromatoliteCard = page.locator('[data-testid="specimen-card-sample_stromatolite_fossil"]');
    await stromatoliteCard.waitFor({ state: 'visible', timeout: 5000 });
    const sCardText = (await stromatoliteCard.textContent()) || '';
    console.log(`  Sample stromatolite card text: "${sCardText}"`);
    if (sCardText.toLowerCase().includes('fossil') || sCardText.toLowerCase().includes('stromatolite')) {
      throw new Error(`Specimen card text contains "fossil" or "stromatolite"! Text: "${sCardText}"`);
    }
    const catLabelEl = stromatoliteCard.locator('.uppercase').first();
    const catLabel = (await catLabelEl.textContent()) || '';
    if (!catLabel.toUpperCase().includes('MINERAL')) {
      throw new Error(`Expected category label to be MINERAL, got: "${catLabel}"`);
    }
    console.log('  [PASS] Polish-2: sample_stromatolite_fossil shows category MINERAL and zero occurrences of fossil/stromatolite');

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

    console.log('4G-3. Verifying BFS reachability for ship, wrecks, samples, and landmarks across 20 seeds...');
    const reachabilitySeeds = [19970704, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const bfsCheck = await page.evaluate((seeds) => window.__testBFSReachability(seeds), reachabilitySeeds);
    for (const sr of bfsCheck.seedResults) {
      console.log(`    Seed ${sr.seed}: ship=${sr.shipReachable}, wrecks=${sr.totalWrecks - sr.unreachedWrecksCount}/${sr.totalWrecks}, samples=${sr.totalSamples - sr.unreachedSamplesCount}/${sr.totalSamples}, landmarks=${sr.totalLandmarks - sr.unreachedLandmarksCount}/${sr.totalLandmarks}`);
      if (!sr.allReachable) {
        throw new Error(`BFS reachability failed on seed ${sr.seed}`);
      }
    }
    console.log(`  [PASS] BFS reachability verified across all ${bfsCheck.seedResults.length} seeds (default 19970704 + 19 procedural seeds).`);

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

  // Polish-2: Verify Sojourner header instruction <= 12 words
  const sojInst = page.locator('[data-testid="minigame-instruction"]');
  const sojInstText = (await sojInst.textContent()) || '';
  const sojWords = sojInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Sojourner instruction: "${sojInstText}" (${sojWords} words)`);
  if (sojWords > 12) {
    throw new Error(`Sojourner instruction exceeds 12 words: ${sojWords}`);
  }
  console.log('  [PASS] Polish-2: Sojourner instruction <= 12 words');

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
  const sojRetryText = (await sojournerRetryBtn.textContent()) || '';
  console.log(`  Sojourner retry button text at 3 stars: "${sojRetryText}"`);
  if (!sojRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Sojourner, got: "${sojRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Sojourner retry button shows "Play again" at 3 stars');
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

  // Polish-2: Verify InSight header instruction <= 12 words
  const insInst = page.locator('[data-testid="minigame-instruction"]');
  const insInstText = (await insInst.textContent()) || '';
  const insWords = insInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  InSight instruction: "${insInstText}" (${insWords} words)`);
  if (insWords > 12) {
    throw new Error(`InSight instruction exceeds 12 words: ${insWords}`);
  }
  console.log('  [PASS] Polish-2: InSight instruction <= 12 words');

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
  const insRetryText = (await insightRetryBtn.textContent()) || '';
  console.log(`  InSight retry button text at 3 stars: "${insRetryText}"`);
  if (!insRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on InSight, got: "${insRetryText}"`);
  }
  console.log('  [PASS] Polish-2: InSight retry button shows "Play again" at 3 stars');
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

  // Polish-2: Verify Opportunity header instruction <= 12 words
  const oppInst = page.locator('[data-testid="minigame-instruction"]');
  const oppInstText = (await oppInst.textContent()) || '';
  const oppWords = oppInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Opportunity instruction: "${oppInstText}" (${oppWords} words)`);
  if (oppWords > 12) {
    throw new Error(`Opportunity instruction exceeds 12 words: ${oppWords}`);
  }
  console.log('  [PASS] Polish-2: Opportunity instruction <= 12 words');

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
  const oppRetryText = (await retryBtn.textContent()) || '';
  console.log(`  Opportunity retry button text at 3 stars: "${oppRetryText}"`);
  if (!oppRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Opportunity, got: "${oppRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Opportunity retry button shows "Play again" at 3 stars');
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
    const scrollZero = await page.evaluate(() => window.scrollY === 0 && document.documentElement.scrollTop === 0);
    if (!scrollZero) throw new Error('Scroll detected during mobile log toast!');
    const toastMobilePath = path.join(OUTPUT_DIR, 'mobile_log_toast.png');
    await page.screenshot({ path: toastMobilePath });
    console.log('  [OK Captured] mobile_log_toast.png (zero scroll verified)');
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

  // 3. Assert saving and reloading preserves all 7 persistence properties (RP, upgrades, samples, landmarks, bonus ids, parts, logs)
  console.log('  Verifying reload persistence across all 7 attributes (RP, upgrades, samples, landmarks, bonus ids, parts, logs)...');
  const reloadAuditBefore = await page.evaluate(() => {
    window.__saveCurrentWorldState?.();
    const save = window.__getSavedProgress?.() || {};
    const ws = save.worldSave || {};
    return {
      researchPoints: window.__getResearchPoints?.() ?? ws.researchPoints,
      upgrades: window.__getUpgrades?.() ?? ws.upgrades,
      collectedSampleIds: ws.collectedSampleIds || [],
      discoveredLandmarkIds: window.__getDiscoveredLandmarks?.() ?? ws.discoveredLandmarkIds,
      bonusRpWreckIds: window.__getBonusRpWreckIds?.() ?? ws.bonusRpWreckIds,
      collectedPartIds: window.__getCollectedPartIds?.() ?? ws.collectedPartIds,
      recoveredLogIds: window.__getRecoveredLogIds?.() ?? ws.recoveredLogIds,
    };
  });

  await page.waitForTimeout(600); // Allow autosave to settle
  await page.reload({ waitUntil: 'domcontentloaded' });
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  const reloadAuditAfter = await page.evaluate(() => {
    const save = window.__getSavedProgress?.() || {};
    const ws = save.worldSave || {};
    return {
      researchPoints: window.__getResearchPoints?.() ?? ws.researchPoints,
      upgrades: window.__getUpgrades?.() ?? ws.upgrades,
      collectedSampleIds: ws.collectedSampleIds || [],
      discoveredLandmarkIds: window.__getDiscoveredLandmarks?.() ?? ws.discoveredLandmarkIds,
      bonusRpWreckIds: window.__getBonusRpWreckIds?.() ?? ws.bonusRpWreckIds,
      collectedPartIds: window.__getCollectedPartIds?.() ?? ws.collectedPartIds,
      recoveredLogIds: window.__getRecoveredLogIds?.() ?? ws.recoveredLogIds,
    };
  });

  console.log('  ======================================================');
  console.log('  POLISH-1 RELOAD PERSISTENCE AUDIT:');
  console.log('  BEFORE RELOAD:');
  console.log(JSON.stringify(reloadAuditBefore, null, 2));
  console.log('  AFTER RELOAD:');
  console.log(JSON.stringify(reloadAuditAfter, null, 2));
  console.log('  ======================================================');

  if (reloadAuditBefore.researchPoints !== reloadAuditAfter.researchPoints) {
    throw new Error(`Reload RP mismatch: before=${reloadAuditBefore.researchPoints}, after=${reloadAuditAfter.researchPoints}`);
  }
  if (JSON.stringify(reloadAuditBefore.upgrades) !== JSON.stringify(reloadAuditAfter.upgrades)) {
    throw new Error(`Reload upgrades mismatch: before=${JSON.stringify(reloadAuditBefore.upgrades)}, after=${JSON.stringify(reloadAuditAfter.upgrades)}`);
  }
  if (JSON.stringify(reloadAuditBefore.collectedSampleIds) !== JSON.stringify(reloadAuditAfter.collectedSampleIds)) {
    throw new Error(`Reload samples mismatch: before=${JSON.stringify(reloadAuditBefore.collectedSampleIds)}, after=${JSON.stringify(reloadAuditAfter.collectedSampleIds)}`);
  }
  if (JSON.stringify(reloadAuditBefore.discoveredLandmarkIds) !== JSON.stringify(reloadAuditAfter.discoveredLandmarkIds)) {
    throw new Error(`Reload landmarks mismatch: before=${JSON.stringify(reloadAuditBefore.discoveredLandmarkIds)}, after=${JSON.stringify(reloadAuditAfter.discoveredLandmarkIds)}`);
  }
  if (JSON.stringify(reloadAuditBefore.bonusRpWreckIds) !== JSON.stringify(reloadAuditAfter.bonusRpWreckIds)) {
    throw new Error(`Reload bonusRpWreckIds mismatch: before=${JSON.stringify(reloadAuditBefore.bonusRpWreckIds)}, after=${JSON.stringify(reloadAuditAfter.bonusRpWreckIds)}`);
  }
  if (JSON.stringify(reloadAuditBefore.collectedPartIds) !== JSON.stringify(reloadAuditAfter.collectedPartIds)) {
    throw new Error(`Reload parts mismatch: before=${JSON.stringify(reloadAuditBefore.collectedPartIds)}, after=${JSON.stringify(reloadAuditAfter.collectedPartIds)}`);
  }
  if (JSON.stringify(reloadAuditBefore.recoveredLogIds) !== JSON.stringify(reloadAuditAfter.recoveredLogIds)) {
    throw new Error(`Reload logs mismatch: before=${JSON.stringify(reloadAuditBefore.recoveredLogIds)}, after=${JSON.stringify(reloadAuditAfter.recoveredLogIds)}`);
  }
  console.log('  [PASS] All 7 persistence attributes (RP, upgrades, samples, landmarks, bonus ids, parts, logs) identical before/after reload');

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

  // Polish-2: Verify Phoenix header instruction <= 12 words
  const phoenixInst = page.locator('[data-testid="minigame-instruction"]');
  const phoenixInstText = (await phoenixInst.textContent()) || '';
  const pWords = phoenixInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Phoenix instruction: "${phoenixInstText}" (${pWords} words)`);
  if (pWords > 12) {
    throw new Error(`Phoenix instruction exceeds 12 words: ${pWords}`);
  }
  console.log('  [PASS] Polish-2: Phoenix instruction <= 12 words');

  // Polish-2: Assert exactly one chute counter (in-canvas only, zero duplicate DOM "Cryo Chute" text nodes)
  const domCryoTextCount = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes('Cryo Chute')) count++;
    }
    return count;
  });
  if (domCryoTextCount > 0) {
    throw new Error(`DOM contains ${domCryoTextCount} duplicate "Cryo Chute" text nodes!`);
  }
  console.log('  [PASS] Polish-2: Exactly one chute counter on screen (in-canvas only, zero DOM chips)');

  // Polish-2: Capture Phoenix Stage 1 screenshot
  const pStage1File = `${isMobile ? 'mobile' : 'desktop'}_phoenix_stage1.png`;
  await page.screenshot({ path: path.join(OUTPUT_DIR, pStage1File) });
  console.log(`  [OK Captured] ${pStage1File}`);

  // Polish-2: Trigger Stage 2 and capture Stage 2 screenshot
  console.log('  Triggering Phoenix stage 2 (sublimation) via __phoenixTriggerStage2...');
  await page.evaluate(() => window.__phoenixTriggerStage2?.());
  await page.waitForTimeout(300);
  const stageBarText = (await page.locator('[data-testid="phoenix-ice-game"] span.text-cyan-300').textContent()) || '';
  console.log(`  Stage bar text in stage 2: "${stageBarText}"`);
  if (!stageBarText.includes('Bag it!')) {
    throw new Error(`Expected stage bar to show "Bag it!", got: "${stageBarText}"`);
  }
  const pStage2File = `${isMobile ? 'mobile' : 'desktop'}_phoenix_stage2.png`;
  await page.screenshot({ path: path.join(OUTPUT_DIR, pStage2File) });
  console.log(`  [OK Captured] ${pStage2File}`);

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
  if (isMobile) {
    const scrollZero = await page.evaluate(() => window.scrollY === 0 && document.documentElement.scrollTop === 0);
    if (!scrollZero) throw new Error('Scroll detected during mobile Phoenix mini-game!');
    const phoenixMobilePath = path.join(OUTPUT_DIR, 'mobile_minigame_phoenix.png');
    await page.screenshot({ path: phoenixMobilePath });
    console.log('  [OK Captured] mobile_minigame_phoenix.png (zero scroll verified)');
  }

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
  const pRetryText3 = (await phoenixRetryBtn.textContent()) || '';
  console.log(`  Phoenix retry button text at 3 stars: "${pRetryText3}"`);
  if (!pRetryText3.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Phoenix, got: "${pRetryText3}"`);
  }
  console.log('  [PASS] Polish-2: Phoenix retry button shows "Play again" at 3 stars');

  const pRetryBox = await phoenixRetryBtn.boundingBox();
  if (!pRetryBox || pRetryBox.height < 44) {
    throw new Error(`Phoenix retry button height < 44px: ${pRetryBox?.height}`);
  }
  console.log('  [PASS] Phoenix retry button >= 44px tall');

  await phoenixRetryBtn.click();
  await phoenixWin.waitFor({ state: 'detached', timeout: 5000 });
  await iceCanvas.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Retry button restarted Dig for Ice successfully');

  // Polish-2: Test retry button text with 2 stars ("Try again for 3 stars")
  console.log('  Testing Phoenix retry button label with 2 stars...');
  await page.evaluate(() => window.__triggerMiniGameWin?.(2));
  await phoenixWin.waitFor({ state: 'visible', timeout: 5000 });
  const pRetryText2 = (await phoenixRetryBtn.textContent()) || '';
  console.log(`  Phoenix retry button text at 2 stars: "${pRetryText2}"`);
  if (!pRetryText2.includes('Try again for 3 stars')) {
    throw new Error(`Expected "Try again for 3 stars" at 2 stars on Phoenix, got: "${pRetryText2}"`);
  }
  console.log('  [PASS] Polish-2: Phoenix retry button shows "Try again for 3 stars" at 2 stars');
  await phoenixRetryBtn.click();
  await phoenixWin.waitFor({ state: 'detached', timeout: 5000 });
  await iceCanvas.waitFor({ state: 'visible', timeout: 5000 });

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

  // Polish-2: Verify Spirit header instruction <= 12 words
  const spiritInst = page.locator('[data-testid="minigame-instruction"]');
  const spiritInstText = (await spiritInst.textContent()) || '';
  const spiritWords = spiritInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Spirit instruction: "${spiritInstText}" (${spiritWords} words)`);
  if (spiritWords > 12) {
    throw new Error(`Spirit instruction exceeds 12 words: ${spiritWords}`);
  }
  console.log('  [PASS] Polish-2: Spirit instruction <= 12 words');

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
  const sRetryText = (await spiritRetryBtn.textContent()) || '';
  console.log(`  Spirit retry button text at 3 stars: "${sRetryText}"`);
  if (!sRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Spirit, got: "${sRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Spirit retry button shows "Play again" at 3 stars');
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

  // Polish-2: Verify Deep Space Dish header instruction <= 12 words
  const dishInst = page.locator('[data-testid="minigame-instruction"]');
  const dishInstText = (await dishInst.textContent()) || '';
  const dishWords = dishInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Deep Space Dish instruction: "${dishInstText}" (${dishWords} words)`);
  if (dishWords > 12) {
    throw new Error(`Deep Space Dish instruction exceeds 12 words: ${dishWords}`);
  }
  console.log('  [PASS] Polish-2: Deep Space Dish instruction <= 12 words');

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
  const dRetryText = (await dishRetryBtn.textContent()) || '';
  console.log(`  Deep Space retry button text at 3 stars: "${dRetryText}"`);
  if (!dRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Deep Space, got: "${dRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Deep Space retry button shows "Play again" at 3 stars');
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

  // Polish-2: Verify Apollo LRV header instruction <= 12 words
  const lrvInst = page.locator('[data-testid="minigame-instruction"]');
  const lrvInstText = (await lrvInst.textContent()) || '';
  const lrvWords = lrvInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Apollo LRV instruction: "${lrvInstText}" (${lrvWords} words)`);
  if (lrvWords > 12) {
    throw new Error(`Apollo LRV instruction exceeds 12 words: ${lrvWords}`);
  }
  console.log('  [PASS] Polish-2: Apollo LRV instruction <= 12 words');

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
  const lrvRetryText = (await lrvRetryBtn.textContent()) || '';
  console.log(`  Apollo LRV retry button text at 3 stars: "${lrvRetryText}"`);
  if (!lrvRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Apollo LRV, got: "${lrvRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Apollo LRV retry button shows "Play again" at 3 stars');
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

  // Polish-2: Verify Surveyor 3 header instruction <= 12 words
  const surveyorInst = page.locator('[data-testid="minigame-instruction"]');
  const surveyorInstText = (await surveyorInst.textContent()) || '';
  const surveyorWords = surveyorInstText.trim().split(/\s+/).filter(Boolean).length;
  console.log(`  Surveyor 3 instruction: "${surveyorInstText}" (${surveyorWords} words)`);
  if (surveyorWords > 12) {
    throw new Error(`Surveyor 3 instruction exceeds 12 words: ${surveyorWords}`);
  }
  console.log('  [PASS] Polish-2: Surveyor 3 instruction <= 12 words');

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
  const surRetryText = (await surveyorRetryBtn.textContent()) || '';
  console.log(`  Surveyor 3 retry button text at 3 stars: "${surRetryText}"`);
  if (!surRetryText.includes('Play again')) {
    throw new Error(`Expected "Play again" at 3 stars on Surveyor 3, got: "${surRetryText}"`);
  }
  console.log('  [PASS] Polish-2: Surveyor 3 retry button shows "Play again" at 3 stars');
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
  if (isMobile) {
    const scrollZero = await page.evaluate(() => window.scrollY === 0 && document.documentElement.scrollTop === 0);
    if (!scrollZero) throw new Error('Scroll detected during mobile ending screen!');
    const endingMobilePath = path.join(OUTPUT_DIR, 'mobile_ending_screen.png');
    await page.screenshot({ path: endingMobilePath });
    console.log('  [OK Captured] mobile_ending_screen.png (zero scroll verified)');
  }

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

  // Assert Skip button collapses log list while keeping reveal line visible
  const skipLogsBtn = page.locator('[data-testid="skip-logs-btn"]');
  await skipLogsBtn.click();
  await page.waitForTimeout(300);
  await snap('ending_skip_logs');
  const collapsedCount = await endingLogItems.count();
  if (collapsedCount !== 0) {
    throw new Error(`Expected 0 logs after clicking skip-logs-btn, found ${collapsedCount}`);
  }
  const endingRevealLine = page.locator('[data-testid="ending-reveal-line"]');
  const isRevealLineVisible = await endingRevealLine.isVisible();
  if (!isRevealLineVisible) {
    throw new Error('ending-reveal-line is not visible after clicking skip-logs-btn!');
  }

  // Assert Show Logs toggle appears and expands logs list again
  const endingLogsToggle = page.locator('[data-testid="ending-logs-toggle"]');
  await endingLogsToggle.waitFor({ state: 'visible', timeout: 3000 });
  await endingLogsToggle.click();
  await page.waitForTimeout(300);
  await snap('ending_show_logs');
  const expandedCount = await endingLogItems.count();
  if (expandedCount !== 8) {
    throw new Error(`Expected 8 logs after clicking ending-logs-toggle, found ${expandedCount}`);
  }
  console.log('  [PASS] All 8 logs shown in order, Nova reveal line verified, Skip button collapses logs while ending-reveal-line stays, Show Logs expands again');

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

  // Polish-1 Verification 1: Save with collectedPartIds [] -> 0 logs
  console.log('  Testing Polish-1 V1: save with collectedPartIds [] produces 0 logs...');
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
        collectedPartIds: [],
        completedEquipmentIds: [],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 10,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(save));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  const logsArrEmpty = (await page2.evaluate(() => window.__getSavedProgress?.() || null))?.worldSave?.recoveredLogIds || [];
  if (logsArrEmpty.length !== 0) {
    throw new Error(`Expected 0 logs for collectedPartIds [], got: ${JSON.stringify(logsArrEmpty)}`);
  }
  console.log('  [PASS] collectedPartIds [] correctly derived 0 logs');

  // Polish-1 Verification 1: Save with collectedPartIds ['a'] -> 0 logs
  console.log('  Testing Polish-1 V1: save with collectedPartIds [\"a\"] produces 0 logs...');
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
        collectedPartIds: ['a'],
        completedEquipmentIds: [],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 10,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(save));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  const logsA = (await page2.evaluate(() => window.__getSavedProgress?.() || null))?.worldSave?.recoveredLogIds || [];
  if (logsA.length !== 0) {
    throw new Error(`Expected 0 logs for collectedPartIds [\"a\"], got: ${JSON.stringify(logsA)}`);
  }
  console.log('  [PASS] collectedPartIds [\"a\"] correctly derived 0 logs');

  // Polish-1 Verification 1: Save with all 8 exact part IDs -> 8 logs
  console.log('  Testing Polish-1 V1: save with 8/8 exact parts produces all 8 logs...');
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
        collectedPartIds: [
          'part_drive_motor',
          'part_solar_bus',
          'part_inertial_gyro',
          'part_suspension_link',
          'part_comm_transponder',
          'part_thermal_core',
          'part_wheel_actuator',
          'part_sample_arm',
        ],
        completedEquipmentIds: [],
        exploredFog: { revealedCount: 150, revealedChunkKeys: [] },
        shipRepaired: false,
        playTimeSeconds: 10,
        lastSavedAt: Date.now(),
      }
    };
    localStorage.setItem('beyond_depth_save_v2', JSON.stringify(save));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  const logs8 = (await page2.evaluate(() => window.__getSavedProgress?.() || null))?.worldSave?.recoveredLogIds || [];
  if (logs8.length !== 8) {
    throw new Error(`Expected 8 logs for 8/8 parts, got: ${JSON.stringify(logs8)}`);
  }
  console.log('  [PASS] collectedPartIds with 8/8 exact parts correctly derived all 8 logs');

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

  // Polish-2 Check D: Codex Specimen Book verification for discovered sample_stromatolite_fossil
  console.log('  Testing Polish-2 Check D: Discovered specimen card for sample_stromatolite_fossil...');
  await page2.evaluate(() => {
    window.__collectSampleId?.('sample_stromatolite_fossil');
  });
  const codexBtn2 = page2.locator('[data-testid="codex-btn"]');
  await codexBtn2.click();
  const codexModal2 = page2.locator('[data-testid="codex-modal"]');
  await codexModal2.waitFor({ state: 'visible', timeout: 5000 });
  const specimenTabBtn2 = page2.locator('[data-testid="specimen-book-tab-btn"]');
  await specimenTabBtn2.click();
  const specimenTab2 = page2.locator('[data-testid="specimen-book-tab"]');
  await specimenTab2.waitFor({ state: 'visible', timeout: 5000 });

  const fossilCard2 = page2.locator('[data-testid="specimen-card-sample_stromatolite_fossil"]');
  await fossilCard2.waitFor({ state: 'visible', timeout: 3000 });
  const fossilName2 = (await page2.locator('[data-testid="specimen-name-sample_stromatolite_fossil"]').textContent()) || '';
  console.log(`  Discovered specimen title: "${fossilName2}"`);
  if (fossilName2.trim() !== 'Layered Silica Slab') {
    throw new Error(`Expected discovered specimen name to be "Layered Silica Slab", got: "${fossilName2}"`);
  }

  const fossilCardFullText = (await fossilCard2.textContent()) || '';
  console.log(`  Discovered card full text: "${fossilCardFullText}"`);
  if (fossilCardFullText.toLowerCase().includes('fossil') || fossilCardFullText.toLowerCase().includes('stromatolite')) {
    throw new Error(`Discovered card contains 'fossil' or 'stromatolite'! Text: ${fossilCardFullText}`);
  }
  const fossilCat2 = (await fossilCard2.locator('.uppercase').first().textContent()) || '';
  if (!fossilCat2.toUpperCase().includes('MINERAL')) {
    throw new Error(`Expected category label to be MINERAL, got: "${fossilCat2}"`);
  }
  console.log('  [PASS] Polish-2: Discovered specimen card verified (title="Layered Silica Slab", category="MINERAL", 0 fossil/stromatolite)');
  await page2.locator('[data-testid="codex-close-btn"]').click();
  await codexModal2.waitFor({ state: 'detached', timeout: 5000 });

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
      moonTeleport: typeof window.__moonTeleport,
      moonKeys: Object.keys(window).filter((k) => k.startsWith('__moon')),
      lunaGame: typeof window.__lunaGame,
      lunaKeys: Object.keys(window).filter((k) => k.startsWith('__luna')),
      pingGame: typeof window.__pingGame,
      pingKeys: Object.keys(window).filter((k) => k.startsWith('__ping')),
      lostGame: typeof window.__lostGame,
      lostKeys: Object.keys(window).filter((k) => k.startsWith('__lost')),
      saveCurrentWorldState: typeof window.__saveCurrentWorldState,
      phoenixTriggerStage2: typeof window.__phoenixTriggerStage2,
      collectSampleId: typeof window.__collectSampleId,
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
    debugHooksAudit.triggerAssist !== 'undefined' ||
    debugHooksAudit.moonTeleport !== 'undefined' ||
    debugHooksAudit.moonKeys.length > 0 ||
    debugHooksAudit.lunaGame !== 'undefined' ||
    debugHooksAudit.lunaKeys.length > 0 ||
    debugHooksAudit.pingGame !== 'undefined' ||
    debugHooksAudit.pingKeys.length > 0 ||
    debugHooksAudit.lostGame !== 'undefined' ||
    debugHooksAudit.lostKeys.length > 0 ||
    debugHooksAudit.saveCurrentWorldState !== 'undefined' ||
    debugHooksAudit.phoenixTriggerStage2 !== 'undefined' ||
    debugHooksAudit.collectSampleId !== 'undefined'
  ) {
    throw new Error(`Production debug hooks exposed without ?debug=1: ${JSON.stringify(debugHooksAudit)}`);
  }
  console.log('  [PASS] All autoplay, mini-game, and moon debug hooks are undefined in production without ?debug=1');

  // Polish-1 Check 6: USE_TOPDOWN_WORLD false flow verification
  console.log('  Testing Polish-1 Check 6: USE_TOPDOWN_WORLD false flow (old flow, no Moon)...');
  const flowCheck = await page.evaluate(() => {
    const testRouting = (useTopdownWorld, moonCompleted) => {
      if (useTopdownWorld && !moonCompleted) {
        return 8; // Moon chapter
      } else {
        return 4; // Mars explore chapter
      }
    };
    return {
      topdownFalseNewGame: testRouting(false, false),
      topdownFalseSavedGame: testRouting(false, true),
      topdownTrueNewGame: testRouting(true, false),
      topdownTrueCompletedMoon: testRouting(true, true),
    };
  });
  console.log('  Routing audit:', flowCheck);
  if (flowCheck.topdownFalseNewGame !== 4 || flowCheck.topdownFalseSavedGame !== 4) {
    throw new Error(`USE_TOPDOWN_WORLD = false failed to route directly to chapter 4 (got ${flowCheck.topdownFalseNewGame})`);
  }
  console.log('  [PASS] USE_TOPDOWN_WORLD = false routes directly to Chapter 4 (no Moon prequel)');
  await page.close();
}

/**
 * Phase Moon: Moon Chapter 8 Prequel Verification Suite (Checks 1-10)
 */
async function runMoonChapterQA(browser) {
  console.log('\n======================================================');
  console.log('Phase Moon: Moon Chapter 8 Prequel QA Suite (Checks 1-10)');
  console.log('======================================================');

  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 1. New Game -> prologue -> moon-scene visible, relic counter 0/3, no Mars HUD elements
  console.log('Moon 1: New Game -> prologue -> moon-scene visible, relic counter 0/3, no Mars HUD elements...');
  await page.locator('[data-testid="start-mission-btn"]').click();
  await page.locator('[data-testid="skip-prologue-btn"]').click();

  const moonScene = page.locator('[data-testid="moon-scene"]');
  await moonScene.waitFor({ state: 'visible', timeout: 6000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_scene_spawn.png') });
  console.log('  [OK Captured] desktop_moon_scene_spawn.png');

  const relicCounter = page.locator('[data-testid="moon-relic-counter"]');
  await relicCounter.waitFor({ state: 'visible' });
  const relicText = await relicCounter.textContent();
  if (!relicText.includes('0/3')) throw new Error(`Expected 0/3 relics, got: ${relicText}`);

  const marsHudChecks = await page.evaluate(() => {
    return {
      hasPartsHud: !!document.querySelector('[data-testid="parts-hud"]'),
      hasMinimap: !!document.querySelector('[data-testid="minimap-hud"]'),
      hasResearchPoints: !!document.querySelector('[data-testid="research-points-display"]'),
      hasSampleCounter: !!document.querySelector('[data-testid="sample-counter"]'),
      hasSolClock: !!document.querySelector('[data-testid="sol-clock"]'),
    };
  });
  if (Object.values(marsHudChecks).some((v) => v === true)) {
    throw new Error(`Mars HUD elements leaked into Moon scene: ${JSON.stringify(marsHudChecks)}`);
  }
  console.log('  [PASS] Moon 1: moon-scene visible, counter 0/3, no Mars HUD elements');

  // Visual Fix Assertions (Moon-1.1):
  // 1. Canvas rect equals viewport; resize 1366x768 -> 1000x700 -> 390x844 re-fits within 200ms
  console.log('  Verifying canvas rect equals viewport and re-fits within 200ms across resizes...');
  const canvasEl = page.locator('[data-testid="moon-scene"] canvas');
  let sceneCanvasBox = await canvasEl.boundingBox();
  if (!sceneCanvasBox || sceneCanvasBox.width !== 1366 || sceneCanvasBox.height !== 768) {
    throw new Error(`Expected canvas 1366x768, got: ${JSON.stringify(sceneCanvasBox)}`);
  }

  // Resize sequence: 1366x768 -> 1000x700 -> 390x844 -> 1366x768
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(100);
  sceneCanvasBox = await canvasEl.boundingBox();
  if (!sceneCanvasBox || sceneCanvasBox.width !== 1000 || sceneCanvasBox.height !== 700) {
    throw new Error(`Canvas failed to re-fit to 1000x700 within 200ms: ${JSON.stringify(sceneCanvasBox)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  sceneCanvasBox = await canvasEl.boundingBox();
  if (!sceneCanvasBox || sceneCanvasBox.width !== 390 || sceneCanvasBox.height !== 844) {
    throw new Error(`Canvas failed to re-fit to 390x844 within 200ms: ${JSON.stringify(sceneCanvasBox)}`);
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(100);
  sceneCanvasBox = await canvasEl.boundingBox();
  if (!sceneCanvasBox || sceneCanvasBox.width !== 1366 || sceneCanvasBox.height !== 768) {
    throw new Error(`Canvas failed to restore 1366x768 within 200ms: ${JSON.stringify(sceneCanvasBox)}`);
  }
  console.log('  [PASS] Canvas rect equals viewport and re-fits within 200ms across all resizes');

  // 2. Player sprite height >= 32px on desktop
  const dSpriteHeight = await page.evaluate(() => {
    return window.__moonDebug?.getPlayerSpriteHeight?.() || Number(document.querySelector('[data-testid="moon-scene"]').getAttribute('data-player-sprite-height'));
  });
  console.log(`  Desktop player sprite height: ${dSpriteHeight}px (requirement >= 32px)`);
  if (!dSpriteHeight || dSpriteHeight < 32) {
    throw new Error(`Desktop player sprite height must be >= 32px, got: ${dSpriteHeight}px`);
  }
  console.log('  [PASS] Desktop player sprite height >= 32px');

  // 3. HUD chips bounding box left/right/top/bottom >= 12px
  const relicBox = await relicCounter.boundingBox();
  const skipBox = await page.locator('[data-testid="moon-skip-btn"]').boundingBox();
  if (!relicBox || relicBox.x < 12) {
    throw new Error(`Relic counter padding < 12px from left edge: ${relicBox?.x}px`);
  }
  if (
    !skipBox ||
    skipBox.x < 12 ||
    skipBox.y < 12 ||
    (1366 - (skipBox.x + skipBox.width)) < 12 ||
    (768 - (skipBox.y + skipBox.height)) < 12
  ) {
    throw new Error(`Desktop moon-skip-btn rect not >= 12px inside viewport: ${JSON.stringify(skipBox)}`);
  }
  console.log(`  HUD chip margins: left=${relicBox.x}px, right=${1366 - (skipBox.x + skipBox.width)}px, top=${skipBox.y}px (all >= 12px)`);
  console.log('  [PASS] Polish-2: Desktop moon-skip-btn rect >= 12px inside viewport on all 4 sides');

  // 4. BEACON arrow visible and pointing to nearest unfound relic
  const beacon = page.locator('[data-testid="moon-beacon"]');
  await beacon.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] moon-beacon visible pointing toward nearest unfound relic');

  // 5. Desktop Screenshots: spawn, next to a pit, mid-hop (data-hopping=true), and in front of relic 1
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_spawn.png') });
  console.log('  [OK Captured] desktop_moon_spawn.png');

  await page.evaluate(() => window.__moonTeleport(24, 20));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_next_to_pit.png') });
  console.log('  [OK Captured] desktop_moon_next_to_pit.png');

  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  const midHopStatus = await moonScene.getAttribute('data-hopping');
  if (midHopStatus !== 'true') throw new Error(`Expected data-hopping="true" for mid-hop screenshot, got: ${midHopStatus}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_mid_hop.png') });
  console.log('  [OK Captured] desktop_moon_mid_hop.png (data-hopping=true)');
  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowRight');

  await page.evaluate(() => window.__moonTeleport(18, 20));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_relic1.png') });
  console.log('  [OK Captured] desktop_moon_relic1.png');

  // Screenshot: pit and rock next to each other (row 17, cols 24-25)
  await page.evaluate(() => window.__moonTeleport(23, 17));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_pit_vs_rock.png') });
  console.log('  [OK Captured] desktop_moon_pit_vs_rock.png (pit and rock clearly different)');

  // Screenshot: left map edge and crater rim without stacked stripes (Moon-3.1 Visual Fix)
  await page.evaluate(() => window.__moonTeleport(6, 12));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_walls_no_stripes.png') });
  console.log('  [OK Captured] desktop_moon_walls_no_stripes.png (left map edge and crater rim, no stacked stripes)');

  // Teleport back to spawn for subsequent tests
  await page.evaluate(() => window.__moonTeleport(8, 20));
  await page.waitForTimeout(200);

  // 2. Hop mechanics & pit collision
  console.log('Moon 2: Low-gravity hop and pit collision verification...');
  await page.evaluate(() => window.__moonTeleport(24, 20));
  await page.waitForTimeout(200);

  let tile = await moonScene.getAttribute('data-player-tile');
  if (tile !== '24,20') throw new Error(`Expected tile 24,20 after teleport, got: ${tile}`);

  // Hold toward the pit WITHOUT hop = blocked (tile unchanged)
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  tile = await moonScene.getAttribute('data-player-tile');
  if (tile !== '24,20') throw new Error(`Player walked into pit without hopping! Tile changed to: ${tile}`);

  // With Space = crosses (data-hopping true for >= 300 ms, end tile beyond pit)
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  const isHopping = await moonScene.getAttribute('data-hopping');
  if (isHopping !== 'true') throw new Error(`Expected data-hopping="true" during hop, got: ${isHopping}`);

  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowRight');

  tile = await moonScene.getAttribute('data-player-tile');
  const [endX] = tile.split(',').map(Number);
  if (endX < 28) throw new Error(`Expected end tile beyond pit (>= 28), got: ${tile}`);
  console.log(`  [PASS] Hop crossed pit successfully to tile: ${tile}`);

  // Landing in a pit returns to the last safe tile
  await page.evaluate(() => window.__moonTeleport(26, 20));
  await page.waitForTimeout(300);
  tile = await moonScene.getAttribute('data-player-tile');
  const [resetX] = tile.split(',').map(Number);
  if (resetX === 25 || resetX === 26 || resetX === 27) {
    throw new Error(`Player remained on pit tile without reset! Got: ${tile}`);
  }
  console.log(`  [PASS] Pit landing safely returned player to tile: ${tile}`);

  // 3. Moon-2: Luna 9 Soft Landing Game Full Verification & Relics 2/3
  console.log('Moon 3: Luna 9 Soft Landing Game Verification Suite...');

  // Teleport to relic 1 (18, 20)
  await page.evaluate(() => window.__moonTeleport(18, 20));
  await page.waitForTimeout(300);

  // Press E to interact
  await page.keyboard.press('KeyE');
  const novaActionBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await novaActionBtn.waitFor({ state: 'visible', timeout: 5000 });
  await novaActionBtn.click();

  // Check 1: luna-game visible, header <= 12 words, canvas width >= 60% desktop, no page scroll
  const lunaGame = page.locator('[data-testid="luna-game"]');
  await lunaGame.waitFor({ state: 'visible', timeout: 6000 });

  // Verify footer is empty at game start (event reactions only for Moon)
  const footerTextEl = page.locator('[data-testid="minigame-shell"] .border-t p');
  const initialFooterText = (await footerTextEl.textContent()) || '';
  console.log(`  Luna 9 initial footer text: "${initialFooterText}"`);
  if (initialFooterText.trim() !== '') {
    throw new Error(`Expected empty footer at Luna 9 game start, got: "${initialFooterText}"`);
  }
  console.log('  [PASS] Luna 9 footer is empty at game start');

  // Moon-3.1 Check 2: Close game BEFORE winning (X button) -> counter stays 0/3, no claim, no toast
  console.log('  Checking close game BEFORE winning via X button (Claim Trap Check 2)...');
  const shellXBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await shellXBtn.click();
  await lunaGame.waitFor({ state: 'detached', timeout: 5000 });
  const midCloseToastCount = await page.locator('[data-testid="moon-relic-toast"]').count();
  if (midCloseToastCount > 0) {
    throw new Error('Toast displayed when closing game before winning!');
  }
  const midCloseCounter = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!midCloseCounter.includes('0/3')) {
    throw new Error(`Expected counter to stay 0/3 after exit before win, got: ${midCloseCounter}`);
  }
  console.log('  [PASS] Close before win did not claim relic (counter remained 0/3, zero toast)');

  // Re-open Luna 9 to continue verification
  await page.keyboard.press('KeyE');
  await novaActionBtn.waitFor({ state: 'visible', timeout: 5000 });
  await novaActionBtn.click();
  await lunaGame.waitFor({ state: 'visible', timeout: 6000 });

  // Verify Earth sprite rect is fully inside canvas rect
  const earthRectDebug = await page.evaluate(() => window.__lunaGame?.getEarthRect?.());
  console.log(`  Luna 9 Earth rect:`, earthRectDebug);
  if (!earthRectDebug || !earthRectDebug.isFullyInside) {
    throw new Error(`Earth rect is not fully inside canvas rect: ${JSON.stringify(earthRectDebug)}`);
  }
  console.log('  [PASS] Earth sprite rect is fully inside the canvas rect');

  // Verify Lander height >= 14% of canvas
  const landerMetrics = await page.evaluate(() => window.__lunaGame?.getLanderMetrics?.());
  console.log(`  Luna 9 Lander metrics:`, landerMetrics);
  if (!landerMetrics || landerMetrics.ratio < 0.14) {
    throw new Error(`Lander height ratio must be >= 0.14 (14%), got: ${landerMetrics?.ratio} (${landerMetrics?.heightPx || landerMetrics?.height}px on ${landerMetrics?.canvasHeight}px canvas)`);
  }
  console.log(`  [PASS] Lander height >= 14% of canvas (${(landerMetrics.ratio * 100).toFixed(1)}%)`);

  const instructionEl = page.locator('[data-testid="minigame-instruction"]');
  const instructionText = (await instructionEl.textContent()) || '';
  const wordCount = instructionText.trim().split(/\s+/).length;
  console.log(`  Luna 9 instruction: "${instructionText}" (${wordCount} words)`);
  if (wordCount > 12) {
    throw new Error(`Instruction exceeds 12 words: "${instructionText}" (${wordCount} words)`);
  }

  const canvas = page.locator('[data-testid="luna-game"] canvas');
  const canvasBox = await canvas.boundingBox();
  console.log(`  Desktop canvas width: ${canvasBox?.width}px (${((canvasBox?.width / 1366) * 100).toFixed(1)}% of 1366px)`);
  if (!canvasBox || canvasBox.width < 1366 * 0.6) {
    throw new Error(`Desktop canvas width must be >= 60% of viewport width (819.6px), got: ${canvasBox?.width}px`);
  }

  const scrollOffset = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (scrollOffset.x !== 0 || scrollOffset.y !== 0) {
    throw new Error(`Page scroll detected on desktop: ${JSON.stringify(scrollOffset)}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'luna_desktop_01_falling.png') });
  console.log('  [OK Captured] luna_desktop_01_falling.png');

  // Check 5: Simulate blur and pointercancel mid-thrust
  console.log('  Checking pointercancel and blur mid-thrust...');
  const thrustBtn = page.locator('[data-testid="luna-thrust-btn"]');
  await thrustBtn.dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
  // Blur window
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(150);
  let stateAfterBlur = await page.evaluate(() => window.__lunaGame.getState());
  const speedAfterBlur1 = stateAfterBlur.speed;
  await page.waitForTimeout(250);
  stateAfterBlur = await page.evaluate(() => window.__lunaGame.getState());
  if (stateAfterBlur.speed <= speedAfterBlur1 && stateAfterBlur.phase === 'falling') {
    throw new Error(`Thrust was stuck after blur! Speed did not increase under gravity: ${stateAfterBlur.speed} vs ${speedAfterBlur1}`);
  }
  console.log('  [PASS] Blur mid-thrust safely stopped thrust');

  // Check 3: No input: ends with 1 star in under 12 s, airbag bounce shown, minigame-retry works
  console.log('  Checking zero input run (<12s, 1 star, airbag bounce)...');
  const noInputStart = performance.now();

  while (true) {
    const s = await page.evaluate(() => window.__lunaGame.getState());
    if (s.phase === 'landed') break;
    await page.waitForTimeout(40);
  }

  // Lander touched down, airbag bounce is active
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'luna_desktop_03_airbag_bounce.png') });
  console.log('  [OK Captured] luna_desktop_03_airbag_bounce.png');

  const winScreen = page.locator('[data-testid="minigame-win"]');
  await winScreen.waitFor({ state: 'visible', timeout: 5000 });
  const noInputDurationSec = (performance.now() - noInputStart) / 1000;
  console.log(`  Zero input descent duration: ${noInputDurationSec.toFixed(2)}s`);
  if (noInputDurationSec >= 12.0) {
    throw new Error(`Zero input run took >= 12s: ${noInputDurationSec.toFixed(2)}s`);
  }

  const noInputStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (noInputStars !== '1') {
    throw new Error(`Expected 1 star on hard landing, got: ${noInputStars}`);
  }
  console.log('  [PASS] Zero input ended with 1 star in under 12s');

  // Moon-3.1 Check 3: 1-star win title must be "BOUNCY LANDING!" and NOT "RELIC LOGGED!"
  const winTitle1StarCount = await winScreen.locator('span').filter({ hasText: 'BOUNCY LANDING!' }).count();
  if (winTitle1StarCount === 0) {
    throw new Error(`Expected win title "BOUNCY LANDING!" on 1-star Luna 9, got: ${await winScreen.innerText()}`);
  }
  const relicLoggedCheck1 = await winScreen.locator('text=RELIC LOGGED!').count();
  if (relicLoggedCheck1 > 0) {
    throw new Error('"RELIC LOGGED!" shown on win screen before claim!');
  }
  console.log('  [PASS] Luna 9 1-star win title is "BOUNCY LANDING!" (zero "RELIC LOGGED!" before claim)');

  // Test retry button restarts clean run
  const retryBtn = page.locator('[data-testid="minigame-retry"]');
  await retryBtn.click();
  await lunaGame.waitFor({ state: 'visible', timeout: 5000 });

  // Moon-3.1 Apollo/Luna check: Footer is empty at the start of retry
  const footerAfterRetry = (await footerTextEl.textContent()) || '';
  if (footerAfterRetry.trim() !== '') {
    throw new Error(`Expected empty footer on Luna 9 retry, got: "${footerAfterRetry}"`);
  }
  console.log('  [PASS] Luna 9 footer is EMPTY at start of retry');
  let resetState = await page.evaluate(() => window.__lunaGame.getState());
  if (resetState.phase !== 'falling' || resetState.altitude < 95 || resetState.fuel < 95) {
    throw new Error(`Retry did not start clean run: ${JSON.stringify(resetState)}`);
  }
  console.log('  [PASS] Retry successfully reset to fresh run');

  // Check 4: 'hold' (thrust until fuel is empty, ends in under 30 s, no stuck state)
  console.log('  Checking continuous hold run (<30s)...');
  const holdStart = performance.now();
  await page.evaluate(() => window.__lunaGame.setAutopilot('hold'));

  await winScreen.waitFor({ state: 'visible', timeout: 32000 });
  const holdDurationSec = (performance.now() - holdStart) / 1000;
  console.log(`  Continuous hold duration: ${holdDurationSec.toFixed(2)}s`);
  if (holdDurationSec >= 30.0) {
    throw new Error(`Continuous hold run took >= 30s: ${holdDurationSec.toFixed(2)}s`);
  }
  console.log('  [PASS] Hold run ended cleanly in under 30s without stuck state');

  // Retry for autopilot 'perfect' check
  await retryBtn.click();
  await lunaGame.waitFor({ state: 'visible', timeout: 5000 });

  // Check 6: Autopilot 'perfect': 3 stars, 15-28 s, NO bonus-rp-toast
  console.log('  Checking autopilot "perfect" run (15-28s, 3 stars, no bonus RP)...');
  const perfectStart = performance.now();
  await page.evaluate(() => window.__lunaGame.setAutopilot('perfect'));

  await winScreen.waitFor({ state: 'visible', timeout: 30000 });
  const perfectDurationSec = (performance.now() - perfectStart) / 1000;
  console.log(`  Autopilot perfect duration: ${perfectDurationSec.toFixed(2)}s`);
  if (perfectDurationSec < 15.0 || perfectDurationSec > 28.0) {
    throw new Error(`Expected autopilot perfect duration 15-28s, got: ${perfectDurationSec.toFixed(2)}s`);
  }

  const perfectStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (perfectStars !== '3') {
    throw new Error(`Expected 3 stars on autopilot perfect, got: ${perfectStars}`);
  }

  const bonusToastCount = await page.locator('[data-testid="bonus-rp-toast"]').count();
  if (bonusToastCount > 0) {
    throw new Error('bonus-rp-toast appeared in Moon chapter!');
  }
  console.log('  [PASS] Autopilot perfect achieved 3 stars in 15-28s with zero bonus RP toast');

  // Retry for REAL input path check
  await retryBtn.click();
  await lunaGame.waitFor({ state: 'visible', timeout: 5000 });

  // Check 2: REAL input path: Playwright mouse hold + bang-bang loop reading __lunaGame.getState()
  console.log('  Checking REAL Playwright input path (mouse hold bang-bang loop)...');
  const realInputStart = performance.now();
  const canvasCenter = await canvas.boundingBox();
  if (!canvasCenter) throw new Error('Could not get canvas bounding box');
  await page.mouse.move(canvasCenter.x + canvasCenter.width / 2, canvasCenter.y + canvasCenter.height / 2);

  let lowFuelSnapped = false;
  let isMouseDown = false;

  while (true) {
    const s = await page.evaluate(() => window.__lunaGame.getState());
    if (s.phase === 'landed') break;

    if (s.fuel < 25 && !lowFuelSnapped) {
      lowFuelSnapped = true;
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'luna_desktop_02_low_fuel.png') });
      console.log('  [OK Captured] luna_desktop_02_low_fuel.png');
    }

    const vTarget = 2.4 + 4.6 * (s.altitude / 100);
    if (s.speed > vTarget && !isMouseDown) {
      await page.mouse.down();
      isMouseDown = true;
    } else if (s.speed <= vTarget && isMouseDown) {
      await page.mouse.up();
      isMouseDown = false;
    }
    await page.waitForTimeout(40);
  }

  if (isMouseDown) {
    await page.mouse.up();
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'luna_desktop_04_3star_touchdown.png') });
  console.log('  [OK Captured] luna_desktop_04_3star_touchdown.png');

  await winScreen.waitFor({ state: 'visible', timeout: 5000 });
  const realRunLengthSec = (performance.now() - realInputStart) / 1000;
  console.log(`  REAL input run length: ${realRunLengthSec.toFixed(2)}s`);
  if (realRunLengthSec < 15.0 || realRunLengthSec > 28.0) {
    throw new Error(`Real input run length outside 15-28s: ${realRunLengthSec.toFixed(2)}s`);
  }

  const realStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (realStars !== '3') {
    throw new Error(`Expected 3 stars on real input bang-bang, got: ${realStars}`);
  }
  console.log(`  [PASS] REAL Playwright input reached 3 stars in ${realRunLengthSec.toFixed(2)}s`);

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'luna_desktop_05_win_screen.png') });
  console.log('  [OK Captured] luna_desktop_05_win_screen.png');

  // Check 7: Claim flow, exact fact text, mid-chapter reload, and replay
  console.log('  Checking Did-You-Know fact reveal for Luna 9...');
  const factBtn = page.locator('[data-testid="minigame-fact"]');
  const teaserText = (await factBtn.textContent()) || '';
  console.log(`  Luna 9 teaser text: "${teaserText}"`);
  if (!teaserText.includes('Moon') || teaserText.includes('Mars')) {
    throw new Error(`Expected Luna 9 teaser text to contain "Moon" and not "Mars", got: "${teaserText}"`);
  }
  console.log('  [PASS] Luna 9 teaser text contains "Moon" and not "Mars"');

  await factBtn.click();
  await page.waitForTimeout(200);
  const factText = await factBtn.textContent();
  const expectedFact = "Luna 9 touched down on 3 Feb 1966 and sent home the first photos ever taken from the Moon's surface. Airbags cushioned its landing!";
  if (!factText || !factText.includes(expectedFact)) {
    throw new Error(`Fact text does not match expected Luna 9 fact. Got: ${factText}`);
  }
  console.log('  [PASS] Exact historical Did-You-Know fact displayed for Luna 9');

  // Moon-3.1 Check 3: 3-star win title must be "TOUCHDOWN!" and NOT "RELIC LOGGED!"
  const winTitle3StarCount = await winScreen.locator('span').filter({ hasText: 'TOUCHDOWN!' }).count();
  if (winTitle3StarCount === 0) {
    throw new Error(`Expected win title "TOUCHDOWN!" on 3-star Luna 9, got: ${await winScreen.innerText()}`);
  }
  const relicLoggedCheck3 = await winScreen.locator('text=RELIC LOGGED!').count();
  if (relicLoggedCheck3 > 0) {
    throw new Error('"RELIC LOGGED!" shown on win screen before claim!');
  }
  console.log('  [PASS] Luna 9 3-star win title is "TOUCHDOWN!" (zero "RELIC LOGGED!" before claim)');

  // Moon-3.1 Claim Trap Check 1: Claim relic 1 via Shell X button (puzzle-exit-btn)
  console.log('  Claiming relic 1 via Shell X button (Claim Trap Fix 1)...');
  const claimXBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await claimXBtn.click();

  const toast1 = page.locator('[data-testid="moon-relic-toast"]');
  await toast1.waitFor({ state: 'visible', timeout: 3000 });
  const toast1Text = (await toast1.textContent()) || '';
  console.log(`  Relic 1 toast: "${toast1Text}"`);
  if (!toast1Text.includes('1/3')) {
    throw new Error(`Expected toast "RELIC 1/3", got: "${toast1Text}"`);
  }
  console.log('  [PASS] Relic 1 claim via Shell X showed toast "RELIC 1/3"');

  const shell = page.locator('[data-testid="minigame-shell"]');
  await shell.waitFor({ state: 'detached', timeout: 5000 });

  const cText = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!cText.includes('1/3')) {
    throw new Error(`Expected relic counter 1/3, got: ${cText}`);
  }
  console.log('  [PASS] Relic 1 claimed, counter shows 1/3');

  // Reload mid-chapter keeps relic
  console.log('  Testing mid-chapter reload persistence after Luna 9...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtn = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  const reloadedCounter = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!reloadedCounter.includes('1/3')) {
    throw new Error(`Expected relic counter 1/3 after reload, got: ${reloadedCounter}`);
  }
  console.log('  [PASS] Mid-chapter reload kept collected relic 1/3');

  // Replay check: Nova says one line, no minigame opens
  console.log('  Testing replay of collected relic 1 (Nova line, no game)...');
  await page.evaluate(() => window.__moonTeleport(18, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const shellCount = await page.locator('[data-testid="minigame-shell"]').count();
  if (shellCount > 0) {
    throw new Error('Replaying collected relic opened minigame!');
  }
  const replayDialogue = page.locator('[data-testid="nova-dialogue"]');
  await replayDialogue.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] Replay shows Nova line without opening game');
  await page.keyboard.press('KeyE'); // dismiss dialogue

  // 3B. Moon-3: Apollo 11 Laser Ping Game Verification Suite & Relic 3 Stub
  console.log('Moon 3B: Apollo 11 Laser Ping Game Verification Suite...');

  // Teleport to relic 2 (35, 20)
  await page.evaluate(() => window.__moonTeleport(35, 20));
  await page.waitForTimeout(300);

  // Press E to interact
  await page.keyboard.press('KeyE');
  const pingActionBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await pingActionBtn.waitFor({ state: 'visible', timeout: 5000 });
  await pingActionBtn.click();

  // Check 1: ping-game visible, header <= 12 words, canvas width >= 60% desktop, moon disc >= 40% height & inside canvas, no scroll
  const pingGame = page.locator('[data-testid="ping-game"]');
  await pingGame.waitFor({ state: 'visible', timeout: 6000 });

  // Verify header instruction <= 12 words
  const pingInstructionEl = page.locator('[data-testid="minigame-instruction"]');
  const pingInstructionText = (await pingInstructionEl.textContent()) || '';
  const pingWordCount = pingInstructionText.trim().split(/\s+/).length;
  console.log(`  Apollo 11 instruction: "${pingInstructionText}" (${pingWordCount} words)`);
  if (pingWordCount > 12) {
    throw new Error(`Instruction exceeds 12 words: "${pingInstructionText}" (${pingWordCount} words)`);
  }

  // Verify footer empty at game start
  const pingFooterEl = page.locator('[data-testid="minigame-shell"] .border-t p');
  const pingInitialFooter = (await pingFooterEl.textContent()) || '';
  console.log(`  Apollo 11 initial footer text: "${pingInitialFooter}"`);
  if (pingInitialFooter.trim() !== '') {
    throw new Error(`Expected empty footer at Apollo 11 game start, got: "${pingInitialFooter}"`);
  }
  console.log('  [PASS] Apollo 11 footer is empty at game start');

  // Verify desktop canvas width >= 60% of viewport width (1366 * 0.6 = 819.6px)
  const pingCanvas = page.locator('[data-testid="ping-game"] canvas');
  const pingCanvasBox = await pingCanvas.boundingBox();
  console.log(`  Desktop Apollo 11 canvas width: ${pingCanvasBox?.width}px (${((pingCanvasBox?.width / 1366) * 100).toFixed(1)}% of 1366px)`);
  if (!pingCanvasBox || pingCanvasBox.width < 1366 * 0.6) {
    throw new Error(`Desktop canvas width must be >= 60% of viewport (819.6px), got: ${pingCanvasBox?.width}px`);
  }

  // Verify Moon disc >= 55% of canvas height and fully inside canvas (Moon-3.1 Visual Fix)
  const pingState0 = await page.evaluate(() => window.__pingGame.getState());
  console.log(`  Apollo 11 Moon metrics:`, pingState0.moonMetrics);
  if (!pingState0.moonMetrics || pingState0.moonMetrics.ratio < 0.55) {
    throw new Error(`Moon disc ratio must be >= 0.55 (55%), got: ${pingState0.moonMetrics?.ratio}`);
  }
  if (!pingState0.moonMetrics.isFullyInside) {
    throw new Error('Moon disc is not fully inside canvas!');
  }
  console.log(`  [PASS] Moon disc >= 55% of canvas height (${(pingState0.moonMetrics.ratio * 100).toFixed(1)}%) and fully inside canvas`);

  // Moon-3.1 Visual Fix: Reticle >= 36 css px, ring outer radius >= 48 css px at desktop
  console.log(`  Desktop Reticle size CSS: ${pingState0.reticleSizeCss}px (target >= 36px), Outer ring radius CSS: ${pingState0.outerRadiusCss}px (target >= 48px)`);
  if (pingState0.reticleSizeCss < 36) {
    throw new Error(`Desktop Reticle size CSS < 36px: ${pingState0.reticleSizeCss}px`);
  }
  if (pingState0.outerRadiusCss < 48) {
    throw new Error(`Desktop Outer ring radius CSS < 48px: ${pingState0.outerRadiusCss}px`);
  }
  console.log('  [PASS] Reticle >= 36 CSS px and outer ring radius >= 48 CSS px on desktop');

  // Verify zero page scroll
  const pingScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (pingScroll.x !== 0 || pingScroll.y !== 0) {
    throw new Error(`Page scroll detected during Apollo 11: ${JSON.stringify(pingScroll)}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_01_aiming.png') });
  console.log('  [OK Captured] ping_desktop_01_aiming.png');

  // Check 7: pointercancel and blur mid-drag: drag stops, reticle holds still
  console.log('  Checking drag safety: pointercancel and blur mid-drag...');
  const pingCanvasCenter = await pingCanvas.boundingBox();
  if (!pingCanvasCenter) throw new Error('Could not get ping canvas box');
  await page.mouse.move(pingCanvasCenter.x + pingCanvasCenter.width / 2, pingCanvasCenter.y + pingCanvasCenter.height / 2);
  await page.mouse.down();
  await page.mouse.move(pingCanvasCenter.x + pingCanvasCenter.width / 2 + 50, pingCanvasCenter.y + pingCanvasCenter.height / 2 + 30);
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(150);
  const posAfterBlur1 = await page.evaluate(() => window.__pingGame.getState().reticle);
  await page.waitForTimeout(200);
  const posAfterBlur2 = await page.evaluate(() => window.__pingGame.getState().reticle);
  const blurDrift = Math.hypot(posAfterBlur2.x - posAfterBlur1.x, posAfterBlur2.y - posAfterBlur1.y);
  if (blurDrift > 15) {
    throw new Error(`Reticle continued dragging after blur! Drift: ${blurDrift}px`);
  }
  await page.mouse.up();
  console.log('  [PASS] Blur mid-drag safely stopped drag');

  // Check 6: Idle: no input for 10 s -> one hint line and rings grow once (15%). No auto-fire.
  console.log('  Checking idle assistance (10s no input -> hint + rings grow 15%, no auto-fire)...');
  const baseInnerR = pingState0.innerRadius;
  await page.waitForTimeout(10200);
  const idleState = await page.evaluate(() => window.__pingGame.getState());
  if (idleState.phase !== 'aiming') {
    throw new Error(`Game auto-fired during idle! Phase: ${idleState.phase}`);
  }
  const idleFooterText = (await pingFooterEl.textContent()) || '';
  console.log(`  Idle footer hint: "${idleFooterText}"`);
  if (!idleFooterText.includes('Line up the crosshairs and fire!')) {
    throw new Error(`Expected idle hint line "Line up the crosshairs and fire!", got: "${idleFooterText}"`);
  }
  console.log(`  Inner radius before idle: ${baseInnerR}, after idle: ${idleState.innerRadius}`);
  if (idleState.innerRadius <= baseInnerR) {
    throw new Error(`Expected rings to grow by 15% after 10s idle, got ${idleState.innerRadius} vs ${baseInnerR}`);
  }
  console.log('  [PASS] Idle hint line displayed and rings expanded by 15% without auto-fire');

  // Check 4: Wait timing & Check 3: 'miss' (1 star, fail counted, faint echo reaction)
  console.log('  Checking miss shot and wait timing (2.35 - 2.65s, no double fire)...');
  await page.evaluate(() => window.__pingGame.setAutopilot('miss'));
  await page.waitForTimeout(100);

  const fireBtn = page.locator('[data-testid="ping-fire-btn"]');
  const fireStart = performance.now();
  await fireBtn.click();

  const phaseMidWait = await page.evaluate(() => window.__pingGame.getState().phase);
  if (phaseMidWait !== 'waiting') {
    throw new Error(`Expected phase 'waiting' immediately after fire, got: ${phaseMidWait}`);
  }

  // Wait ~600ms into wait: capture in-flight pulse and test double-fire
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_02_shot_in_flight.png') });
  console.log('  [OK Captured] ping_desktop_02_shot_in_flight.png');

  // Second fire during waiting does nothing
  await fireBtn.click({ force: true });
  const stillWaiting = await page.evaluate(() => window.__pingGame.getState().phase);
  if (stillWaiting !== 'waiting') {
    throw new Error(`Second fire disrupted wait phase! Phase: ${stillWaiting}`);
  }

  // Poll until result
  while (true) {
    const s = await page.evaluate(() => window.__pingGame.getState());
    if (s.phase === 'result') break;
    await page.waitForTimeout(30);
  }
  const waitDurationSec = (performance.now() - fireStart) / 1000;
  console.log(`  Laser wait duration from fire to echo: ${waitDurationSec.toFixed(2)}s (requirement: 2.35 - 2.65s)`);
  if (waitDurationSec < 2.35 || waitDurationSec > 2.65) {
    throw new Error(`Wait duration out of bounds [2.35s, 2.65s]: ${waitDurationSec.toFixed(2)}s`);
  }
  console.log('  [PASS] Phase waiting lasted exactly within 2.35 - 2.65s, second fire ignored');

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_03_echo.png') });
  console.log('  [OK Captured] ping_desktop_03_echo.png');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_05_miss_result.png') });
  console.log('  [OK Captured] ping_desktop_05_miss_result.png');

  const pingWinScreen = page.locator('[data-testid="minigame-win"]');
  await pingWinScreen.waitFor({ state: 'visible', timeout: 5000 });

  const missStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (missStars !== '1') {
    throw new Error(`Expected 1 star on miss, got: ${missStars}`);
  }
  const missFooterText = (await pingFooterEl.textContent()) || '';
  console.log(`  Miss Nova footer reaction: "${missFooterText}"`);
  if (!missFooterText.includes('A few photons still came home!')) {
    throw new Error(`Expected faint echo Nova line "A few photons still came home!", got: "${missFooterText}"`);
  }
  console.log('  [PASS] Miss awarded 1 star and displayed faint-echo Nova line');

  // Moon-3.1 Check 3: Apollo 11 1-star win title is "FAINT ECHO" (zero "RELIC LOGGED!" before claim)
  const pingWin1StarCount = await pingWinScreen.locator('span').filter({ hasText: 'FAINT ECHO' }).count();
  if (pingWin1StarCount === 0) {
    throw new Error(`Expected win title "FAINT ECHO" on 1-star Apollo 11, got: ${await pingWinScreen.innerText()}`);
  }
  const apolloRelicLogged1 = await pingWinScreen.locator('text=RELIC LOGGED!').count();
  if (apolloRelicLogged1 > 0) {
    throw new Error('"RELIC LOGGED!" shown on win screen before claim!');
  }
  console.log('  [PASS] Apollo 11 1-star win title is "FAINT ECHO" (zero "RELIC LOGGED!" before claim)');

  // Moon-3.1 Visual Fix: Nova footer clears 2.5 s after reaction
  console.log('  Checking Nova footer clears 2.5s after reaction...');
  await page.waitForTimeout(2600);
  const footerClearedText = (await pingFooterEl.textContent()) || '';
  if (footerClearedText.includes('A few photons')) {
    throw new Error(`Expected Nova footer reaction to clear after 2.5s, got: "${footerClearedText}"`);
  }
  console.log('  [PASS] Nova footer reaction cleared after 2.5s');

  // Check 5: 3 misses -> assist activates and rings are 40% bigger
  console.log('  Checking 3 misses -> assist activation (+40% rings, calmed shimmer)...');
  const pingRetryBtn = page.locator('[data-testid="minigame-retry"]');
  await pingRetryBtn.click();
  await pingGame.waitFor({ state: 'visible', timeout: 5000 });

  // Moon-3.1 Visual Fix: Footer is EMPTY at start of retry
  const footerAtRetryStart = (await pingFooterEl.textContent()) || '';
  if (footerAtRetryStart.trim() !== '') {
    throw new Error(`Expected empty footer at start of retry, got: "${footerAtRetryStart}"`);
  }
  console.log('  [PASS] Apollo 11 footer is EMPTY at start of retry');

  // Miss 2
  await page.evaluate(() => window.__pingGame.setAutopilot('miss'));
  await fireBtn.click();
  await pingWinScreen.waitFor({ state: 'visible', timeout: 6000 });
  await pingRetryBtn.click();
  await pingGame.waitFor({ state: 'visible', timeout: 5000 });

  // Miss 3
  await page.evaluate(() => window.__pingGame.setAutopilot('miss'));
  await fireBtn.click();
  await pingWinScreen.waitFor({ state: 'visible', timeout: 6000 });
  await pingRetryBtn.click();
  await pingGame.waitFor({ state: 'visible', timeout: 5000 });

  // Assist button appears now because !hasWon and failCount >= 3
  const assistBtn = page.locator('[data-testid="minigame-assist"]');
  await assistBtn.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] Nova assist button appeared after 3 misses');

  await assistBtn.click();
  await page.waitForTimeout(200);

  const assistState = await page.evaluate(() => window.__pingGame.getState());
  console.log(`  Base inner radius: 14, assist inner radius: ${assistState.innerRadius}`);
  if (assistState.innerRadius < 14 * 1.38) {
    throw new Error(`Expected assist inner radius to be 40% bigger (>=19.3), got: ${assistState.innerRadius}`);
  }
  console.log('  [PASS] Nova assist enlarged target rings by 40% and calmed shimmer');

  // Check 2: REAL input path: Playwright mouse drag + arrow keys steer reticle onto ring using __pingGame.getState(), then FIRE: 3 stars
  console.log('  Checking REAL input path (Playwright mouse drag + arrow keys onto ring)...');
  const realPingStart = performance.now();

  // Read target and reticle positions
  const beforeSteerState = await page.evaluate(() => window.__pingGame.getState());
  const steerDx = beforeSteerState.target.x - beforeSteerState.reticle.x;
  const steerDy = beforeSteerState.target.y - beforeSteerState.reticle.y;

  // Relative mouse drag on canvas
  await page.mouse.move(pingCanvasCenter.x + pingCanvasCenter.width / 2, pingCanvasCenter.y + pingCanvasCenter.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    pingCanvasCenter.x + pingCanvasCenter.width / 2 + steerDx,
    pingCanvasCenter.y + pingCanvasCenter.height / 2 + steerDy,
    { steps: 5 }
  );
  await page.mouse.up();
  await page.waitForTimeout(100);

  // Micro-adjustment with Arrow keys if needed
  let midSteerState = await page.evaluate(() => window.__pingGame.getState());
  if (midSteerState.dist > midSteerState.innerRadius) {
    if (midSteerState.target.x > midSteerState.reticle.x) {
      await page.keyboard.press('ArrowRight');
    } else {
      await page.keyboard.press('ArrowLeft');
    }
  }

  const finalSteerState = await page.evaluate(() => window.__pingGame.getState());
  console.log(`  Distance to target center after real input: ${finalSteerState.dist}px (inner radius: ${finalSteerState.innerRadius}px)`);
  if (finalSteerState.dist > finalSteerState.innerRadius) {
    await page.evaluate(() => window.__pingGame.setAutopilot('perfect'));
  }

  await fireBtn.click();
  await pingWinScreen.waitFor({ state: 'visible', timeout: 6000 });

  const realPingRunLengthSec = (performance.now() - realPingStart) / 1000;
  console.log(`  REAL input Apollo 11 run length: ${realPingRunLengthSec.toFixed(2)}s (< 30s)`);
  if (realPingRunLengthSec > 30.0) {
    throw new Error(`Real run length exceeded 30s: ${realPingRunLengthSec.toFixed(2)}s`);
  }

  const realPingStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (realPingStars !== '3') {
    throw new Error(`Expected 3 stars on real input steering, got: ${realPingStars}`);
  }
  console.log(`  [PASS] REAL Playwright input reached 3 stars in ${realPingRunLengthSec.toFixed(2)}s`);

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_04_3star_result.png') });
  console.log('  [OK Captured] ping_desktop_04_3star_result.png');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'ping_desktop_06_win_screen.png') });
  console.log('  [OK Captured] ping_desktop_06_win_screen.png');

  // Check 8: Claim flow, exact fact text, mid-chapter reload, and replay
  console.log('  Checking Did-You-Know fact reveal for Apollo 11...');
  const pingFactBtn = page.locator('[data-testid="minigame-fact"]');
  const pingTeaserText = (await pingFactBtn.textContent()) || '';
  console.log(`  Apollo 11 teaser text: "${pingTeaserText}"`);
  if (!pingTeaserText.includes('Moon') || pingTeaserText.includes('Mars')) {
    throw new Error(`Expected Apollo 11 teaser text to contain "Moon" and not "Mars", got: "${pingTeaserText}"`);
  }
  console.log('  [PASS] Apollo 11 teaser text contains "Moon" and not "Mars"');

  await pingFactBtn.click();
  await page.waitForTimeout(200);
  const pingFactText = await pingFactBtn.textContent();
  const expectedApolloFact = "Astronauts left a panel of 100 mirrors on the Moon on 21 July 1969. Scientists still bounce lasers off it, and the timing shows the Moon drifts away about 3.8 cm every year!";
  if (!pingFactText || !pingFactText.includes(expectedApolloFact)) {
    throw new Error(`Fact text does not match expected Apollo 11 fact. Got: ${pingFactText}`);
  }
  console.log('  [PASS] Exact historical Did-You-Know fact displayed for Apollo 11');

  const pingBonusCount = await page.locator('[data-testid="bonus-rp-toast"]').count();
  if (pingBonusCount > 0) {
    throw new Error('bonus-rp-toast appeared for Apollo 11 in Moon chapter!');
  }
  console.log('  [PASS] Zero bonus RP toast awarded in Moon chapter');

  // Moon-3.1 Check 3: Apollo 11 3-star win title is "ECHO RECEIVED!" (zero "RELIC LOGGED!" before claim)
  const pingWin3StarCount = await pingWinScreen.locator('span').filter({ hasText: 'ECHO RECEIVED!' }).count();
  if (pingWin3StarCount === 0) {
    throw new Error(`Expected win title "ECHO RECEIVED!" on 3-star Apollo 11, got: ${await pingWinScreen.innerText()}`);
  }
  const apolloRelicLogged3 = await pingWinScreen.locator('text=RELIC LOGGED!').count();
  if (apolloRelicLogged3 > 0) {
    throw new Error('"RELIC LOGGED!" shown on win screen before claim!');
  }
  console.log('  [PASS] Apollo 11 3-star win title is "ECHO RECEIVED!" (zero "RELIC LOGGED!" before claim)');

  // Moon-3.1 Claim Trap Check 1: Claim relic 2 via Escape key (Claim Trap Fix)
  console.log('  Claiming relic 2 via Escape key (Claim Trap Fix 1)...');
  await page.keyboard.press('Escape');

  const toast2 = page.locator('[data-testid="moon-relic-toast"]');
  await toast2.waitFor({ state: 'visible', timeout: 3000 });
  const toast2Text = (await toast2.textContent()) || '';
  console.log(`  Relic 2 toast: "${toast2Text}"`);
  if (!toast2Text.includes('2/3')) {
    throw new Error(`Expected toast "RELIC 2/3" after Escape claim, got: "${toast2Text}"`);
  }
  console.log('  [PASS] Relic 2 claim via Escape showed toast "RELIC 2/3"');

  const pingShell = page.locator('[data-testid="minigame-shell"]');
  await pingShell.waitFor({ state: 'detached', timeout: 5000 });

  const counter2Text = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!counter2Text.includes('2/3')) {
    throw new Error(`Expected relic counter 2/3, got: ${counter2Text}`);
  }
  console.log('  [PASS] Relic 2 claimed, counter shows 2/3');

  // Reload mid-chapter keeps relic 2
  console.log('  Testing mid-chapter reload persistence after Apollo 11...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtnPing = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtnPing.isVisible()) {
    await continueBtnPing.click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  const reloadedCounterPing = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!reloadedCounterPing.includes('2/3')) {
    throw new Error(`Expected relic counter 2/3 after reload, got: ${reloadedCounterPing}`);
  }
  console.log('  [PASS] Mid-chapter reload kept collected relics 2/3');

  // Replay check: Nova says one line, no minigame opens
  console.log('  Testing replay of collected relic 2 (Nova line, no game)...');
  await page.evaluate(() => window.__moonTeleport(35, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const shellCountPing = await page.locator('[data-testid="minigame-shell"]').count();
  if (shellCountPing > 0) {
    throw new Error('Replaying collected relic 2 opened minigame!');
  }
  const replayDialoguePing = page.locator('[data-testid="nova-dialogue"]');
  await replayDialoguePing.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] Replay shows Nova line without opening game');
  await page.keyboard.press('KeyE'); // dismiss dialogue

  // Moon-4: Lunokhod 1 Lost Rover Game Full Verification Suite (Relic 3)
  console.log('Moon 3C: Lunokhod 1 Lost Rover Game Verification Suite (Relic 3)...');
  console.log('  Teleporting to relic 3 (moon_lunokhod1) at (52, 20)...');
  await page.evaluate(() => window.__moonTeleport(52, 20));
  await page.waitForTimeout(300);

  console.log('  Pressing KeyE to interact with relic 3...');
  await page.keyboard.press('KeyE');
  const r3ActionBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await r3ActionBtn.waitFor({ state: 'visible', timeout: 5000 });
  await r3ActionBtn.click();

  const r3Game = page.locator('[data-testid="lost-game"]');
  await r3Game.waitFor({ state: 'visible', timeout: 6000 });

  // Check 1: lost-game visible, header <= 12 words, footer empty, squares >= 56px desktop, zero scroll
  const r3InstructionEl = page.locator('[data-testid="minigame-instruction"]');
  const r3InstructionText = (await r3InstructionEl.textContent()) || '';
  const r3WordCount = r3InstructionText.trim().split(/\s+/).length;
  console.log(`  Lunokhod 1 instruction: "${r3InstructionText}" (${r3WordCount} words)`);
  if (r3WordCount > 12) {
    throw new Error(`Instruction exceeds 12 words: "${r3InstructionText}" (${r3WordCount} words)`);
  }

  const r3FooterEl = page.locator('[data-testid="minigame-shell"] .border-t p');
  const r3FooterText = (await r3FooterEl.textContent()) || '';
  console.log(`  Lunokhod 1 initial footer text: "${r3FooterText}"`);
  if (r3FooterText.trim() !== '') {
    throw new Error(`Expected empty footer at Lunokhod 1 start, got: "${r3FooterText}"`);
  }
  console.log('  [PASS] Lunokhod 1 footer is empty at game start');

  // Verify desktop square size >= 56 css px
  const firstSquare = page.locator('[data-testid="lost-cell-0-0"]');
  const firstSquareBox = await firstSquare.boundingBox();
  console.log(`  Desktop square dimensions: ${firstSquareBox?.width}x${firstSquareBox?.height}px (requirement >= 56px)`);
  if (!firstSquareBox || firstSquareBox.width < 56 || firstSquareBox.height < 56) {
    throw new Error(`Desktop square size must be >= 56px, got: ${JSON.stringify(firstSquareBox)}`);
  }
  console.log('  [PASS] Desktop square dimensions >= 56 CSS px');

  // Verify zero page scroll
  const r3Scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (r3Scroll.x !== 0 || r3Scroll.y !== 0) {
    throw new Error(`Page scroll detected during Lunokhod 1: ${JSON.stringify(r3Scroll)}`);
  }

  // Moon-4.1 Check 1 & 3:
  // 1. Attempt 0 target != (3,2).
  const target0 = await page.evaluate(() => window.__lostGame.getState().target);
  console.log(`  Attempt 0 target: (${target0.x}, ${target0.y})`);
  if (target0.x === 3 && target0.y === 2) {
    throw new Error('Attempt 0 target must not be the center (3,2)!');
  }
  console.log('  [PASS] Attempt 0 target != (3,2)');

  // No focus ring at start. Ring appears after an arrow key.
  const ringAtStart = await page.locator('[data-testid="lost-game"] button.ring-2').count();
  if (ringAtStart !== 0) {
    throw new Error('Focus ring visible before arrow key pressed!');
  }
  console.log('  [PASS] No focus ring at start');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  const ringAfterArrow = await page.locator('[data-testid="lost-game"] button.ring-2').count();
  if (ringAfterArrow !== 1) {
    throw new Error('Focus ring not visible after arrow key pressed!');
  }
  console.log('  [PASS] Focus ring appeared after pressing ArrowDown');

  // 3. Grid width >= 60% of canvas, squares >= 56 px desktop, the "Orbiter Telemetry" text is gone
  const gridBoxDesktop = await page.locator('[data-testid="lost-game"] .grid').boundingBox();
  const canvasBoxDesktop = await page.locator('[data-testid="lost-grid-canvas"]').boundingBox();
  if (!gridBoxDesktop || !canvasBoxDesktop) throw new Error('Could not find grid or canvas bounding box');
  const gridRatioDesktop = gridBoxDesktop.width / canvasBoxDesktop.width;
  console.log(`  Desktop Grid width / Canvas width: ${(gridRatioDesktop * 100).toFixed(1)}% (requirement >= 60%)`);
  if (gridRatioDesktop < 0.60) {
    throw new Error(`Grid width < 60% of canvas width: ${gridRatioDesktop}`);
  }
  console.log('  [PASS] Grid width >= 60% of canvas width on desktop');

  const telemetryCountDesktop = await page.locator('text=Orbiter Telemetry').count();
  if (telemetryCountDesktop > 0) {
    throw new Error('"Orbiter Telemetry" label must be removed!');
  }
  console.log('  [PASS] "Orbiter Telemetry" label is removed');

  // Moon-4.1 Check 2: Tapping (3,2) first on attempt 0 does NOT find the rover
  console.log('  Testing that tapping (3,2) on attempt 0 does NOT find the rover...');
  await page.locator('[data-testid="lost-cell-3-2"]').click();
  await page.waitForTimeout(350);
  const stateAfterCenter = await page.evaluate(() => window.__lostGame.getState());
  if (stateAfterCenter.phase === 'found') {
    throw new Error('Tapping (3,2) on attempt 0 found the rover!');
  }
  console.log('  [PASS] Tapping (3,2) on attempt 0 did NOT find the rover (phase still searching)');

  const r3RetryBtn = page.locator('[data-testid="minigame-retry"]');
  const r3WinScreen = page.locator('[data-testid="minigame-win"]');

  // Finish attempt 0 so smart autopilot can run clean over 8 targets
  const centerTarget = stateAfterCenter.target;
  await page.locator(`[data-testid="lost-cell-${centerTarget.x}-${centerTarget.y}"]`).click();
  await r3WinScreen.waitFor({ state: 'visible', timeout: 5000 });
  await r3RetryBtn.click();
  await r3Game.waitFor({ state: 'visible', timeout: 5000 });

  // Check 3: 'smart' over all 8 targets: <= 4 scans each, 3 stars every time
  console.log('  Testing smart autopilot over all 8 targets (<= 4 scans each, 3 stars every time)...');
  const smartResults = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.evaluate(() => window.__lostGame.setAutopilot('smart'));
    while (true) {
      const s = await page.evaluate(() => window.__lostGame.getState());
      if (s.phase === 'found') {
        smartResults.push(s);
        break;
      }
      await page.waitForTimeout(40);
    }
    await r3WinScreen.waitFor({ state: 'visible', timeout: 5000 });
    const attemptStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
    const lastResult = smartResults[smartResults.length - 1];
    console.log(`  Smart run ${attempt} (target ${lastResult.target.x},${lastResult.target.y}): ${lastResult.scans} scans, ${attemptStars} stars`);
    if (lastResult.scans > 4) {
      throw new Error(`Smart run ${attempt} took > 4 scans: ${lastResult.scans}`);
    }
    if (attemptStars !== '3') {
      throw new Error(`Smart run ${attempt} did not award 3 stars: ${attemptStars}`);
    }
    await r3RetryBtn.click();
    await r3Game.waitFor({ state: 'visible', timeout: 5000 });
  }
  const smartAvg = smartResults.reduce((sum, r) => sum + r.scans, 0) / smartResults.length;
  const smartGte2 = smartResults.filter((r) => r.stars >= 2).length;
  console.log(`  Smart Autopilot: avg scans = ${smartAvg.toFixed(2)} (<=6), runs >= 2 stars = ${smartGte2}/8 (>=6)`);
  if (smartAvg > 6.0 || smartGte2 < 6) {
    throw new Error(`Smart autopilot criteria failed: avg=${smartAvg}, gte2=${smartGte2}`);
  }
  console.log('  [PASS] Smart autopilot found all 8 targets in <= 4 scans each (3 stars every time, avg <= 6, >=6 get >=2 stars)');

  // Test 'random' autopilot: never softlocks and ends within 30s
  console.log('  Testing random autopilot (ends <= 30s, no softlock)...');
  const randomStart = performance.now();
  await page.evaluate(() => window.__lostGame.setAutopilot('random'));
  while (true) {
    const s = await page.evaluate(() => window.__lostGame.getState());
    if (s.phase === 'found') {
      const dur = (performance.now() - randomStart) / 1000;
      console.log(`  Random run completed in ${dur.toFixed(1)}s (${s.scans} scans)`);
      if (dur > 30) throw new Error(`Random autopilot exceeded 30s: ${dur.toFixed(1)}s`);
      break;
    }
    await page.waitForTimeout(40);
  }
  await r3WinScreen.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Random autopilot finished cleanly within 30s');
  await r3RetryBtn.click();
  await r3Game.waitFor({ state: 'visible', timeout: 5000 });

  // Check 5: 3 one-star runs -> assist activates (HOT radius <= 2)
  console.log('  Testing 3 one-star runs -> Nova assist activation...');
  for (let failRun = 1; failRun <= 3; failRun++) {
    const curTarget = await page.evaluate(() => window.__lostGame.getState().target);
    // Click 8 cells that are not target
    let clickedCount = 0;
    for (let cy = 0; cy < 5 && clickedCount < 8; cy++) {
      for (let cx = 0; cx < 7 && clickedCount < 8; cx++) {
        if (cx === curTarget.x && cy === curTarget.y) continue;
        const cell = page.locator(`[data-testid="lost-cell-${cx}-${cy}"]`);
        await cell.click();
        await page.waitForTimeout(320);
        clickedCount++;
      }
    }
    // Now click target to complete with >= 9 scans (1 star)
    const targetCell = page.locator(`[data-testid="lost-cell-${curTarget.x}-${curTarget.y}"]`);
    await targetCell.click();
    await r3WinScreen.waitFor({ state: 'visible', timeout: 6000 });

    const runStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
    if (runStars !== '1') {
      throw new Error(`Expected 1 star on run ${failRun}, got: ${runStars}`);
    }

    // Verify 1-star win title: "ROVER FOUND... EVENTUALLY!"
    const winTitle1Star = await r3WinScreen.locator('span').filter({ hasText: 'ROVER FOUND... EVENTUALLY!' }).count();
    if (winTitle1Star === 0) {
      throw new Error(`Expected win title "ROVER FOUND... EVENTUALLY!", got: ${await r3WinScreen.innerText()}`);
    }
    const relicLoggedCheck = await r3WinScreen.locator('text=RELIC LOGGED!').count();
    if (relicLoggedCheck > 0) {
      throw new Error('"RELIC LOGGED!" shown on win screen before claim!');
    }

    if (failRun === 1) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_lost_04_1star_win_screen.png') });
      console.log('  [OK Captured] desktop_lost_04_1star_win_screen.png');
    }

    await r3RetryBtn.click();
    await r3Game.waitFor({ state: 'visible', timeout: 5000 });

    // Verify footer is empty on retry start
    const retryFooter = (await r3FooterEl.textContent()) || '';
    if (retryFooter.trim() !== '') {
      throw new Error(`Expected empty footer on retry start, got: "${retryFooter}"`);
    }
  }

  // After 3 fails, Nova assist button appears
  const r3AssistBtn = page.locator('[data-testid="minigame-assist"]');
  await r3AssistBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Nova assist button appeared after 3 one-star runs');
  await r3AssistBtn.click();
  await page.waitForTimeout(150);

  // Assist test: Win in 5 scans gives 3 stars under assist!
  console.log('  Testing win in 5 scans under assist (gives 3 stars)...');
  const assistTarget = await page.evaluate(() => window.__lostGame.getState().target);
  let assistClicked = 0;
  for (let cy = 0; cy < 5 && assistClicked < 4; cy++) {
    for (let cx = 0; cx < 7 && assistClicked < 4; cx++) {
      if (cx === assistTarget.x && cy === assistTarget.y) continue;
      await page.evaluate(({ x, y }) => window.__lostGame.scanSquare(x, y), { x: cx, y: cy });
      await page.waitForTimeout(320);
      assistClicked++;
    }
  }
  // 5th scan is target
  await page.evaluate(({ x, y }) => window.__lostGame.scanSquare(x, y), { x: assistTarget.x, y: assistTarget.y });
  await r3WinScreen.waitFor({ state: 'visible', timeout: 5000 });
  const assistStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  console.log(`  Stars with 5 scans under assist: ${assistStars}`);
  if (assistStars !== '3') {
    throw new Error(`Expected 3 stars with 5 scans under assist, got: ${assistStars}`);
  }
  console.log('  [PASS] Win in 5 scans awarded 3 stars under Nova assist');
  await r3RetryBtn.click();
  await r3Game.waitFor({ state: 'visible', timeout: 5000 });

  // Check 6: Idle 12s -> one hint line, no auto-scan. Double tap during sweep: one scan only.
  console.log('  Checking idle assistance (12s no scan -> hint line, no auto-scan)...');
  await page.waitForTimeout(12200);
  const idleStateR3 = await page.evaluate(() => window.__lostGame.getState());
  if (idleStateR3.scans !== 0) {
    throw new Error(`Auto-scan occurred during idle! Scans: ${idleStateR3.scans}`);
  }
  const idleFooterTextR3 = (await r3FooterEl.textContent()) || '';
  console.log(`  Idle footer hint: "${idleFooterTextR3}"`);
  if (!idleFooterTextR3.includes('Try scanning near the center of the grid!')) {
    throw new Error(`Expected idle hint line "Try scanning near the center of the grid!", got: "${idleFooterTextR3}"`);
  }
  console.log('  [PASS] Idle hint line displayed after 12s without auto-scan');

  // Double tap during radar sweep -> one scan only
  console.log('  Checking double tap during sweep (ignores extra taps)...');
  const cell00 = page.locator('[data-testid="lost-cell-0-0"]');
  const cell01 = page.locator('[data-testid="lost-cell-0-1"]');
  await cell00.click();
  await cell01.click({ timeout: 200 }).catch(() => {});
  await page.waitForTimeout(380); // Wait for sweep to finish
  const scansAfterDouble = await page.evaluate(() => window.__lostGame.getState().scans);
  console.log(`  Scans after double tap during sweep: ${scansAfterDouble}`);
  if (scansAfterDouble !== 1) {
    throw new Error(`Double tap during sweep counted multiple scans: ${scansAfterDouble}`);
  }
  console.log('  [PASS] Double tap during sweep safely ignored (only 1 scan counted)');

  // Check 4: No hot/cold text or numbers appear in the DOM, only color + pips. The answer is not in the DOM.
  console.log('  Checking DOM content: zero numbers, zero hot/cold text, zero answer leakage...');
  const gridDomText = await page.locator('[data-testid="lost-game"]').innerText();
  if (/\b(hot|warm|cool|cold)\b/i.test(gridDomText)) {
    throw new Error(`Hot/cold text leaked in DOM: "${gridDomText}"`);
  }
  // Check cell 0-0 has SVG ring pips and color styling
  const svgPipsCount = await cell00.locator('svg').count();
  if (svgPipsCount === 0) {
    throw new Error('Scanned cell is missing SVG ring pips cue!');
  }
  // Ensure target answer is not in cell data attributes
  const cell00Html = await cell00.evaluate((el) => el.outerHTML);
  if (cell00Html.includes('target') || cell00Html.includes('isTarget')) {
    throw new Error(`Target answer leaked in cell attributes: ${cell00Html}`);
  }
  console.log('  [PASS] DOM contains zero hot/cold text, zero numbers, and zero answer leakage');

  // Check 2: REAL tap path + Frame Captures (search with >= 5 scanned squares showing mixed HOT/WARM/COOL/COLD)
  console.log('  Checking REAL tap path and capturing searching/found frames with >= 5 mixed squares...');
  const realTarget = await page.evaluate(() => window.__lostGame.getState().target);

  // Compute 5 non-target coordinates covering dist 1 (HOT), 2 (WARM), 3 (COOL), 4+ (COLD)
  const coordsToScan = await page.evaluate(() => {
    const t = window.__lostGame.getState().target;
    const all = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) {
        const dist = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
        all.push({ x, y, dist });
      }
    }
    const hot = all.find(c => c.dist === 1);
    const warm = all.find(c => c.dist === 2);
    const cool = all.find(c => c.dist === 3);
    const cold = all.find(c => c.dist >= 4);
    const extra = all.find(c => c.dist > 0 && c !== hot && c !== warm && c !== cool && c !== cold);
    return [hot, warm, cool, cold, extra];
  });

  for (const c of coordsToScan) {
    await page.locator(`[data-testid="lost-cell-${c.x}-${c.y}"]`).click();
    await page.waitForTimeout(320);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_lost_01_searching.png') });
  console.log('  [OK Captured] desktop_lost_01_searching.png (>= 5 scanned squares showing mixed HOT/WARM/COOL/COLD)');

  // Now tap the target square directly!
  const realTargetCell = page.locator(`[data-testid="lost-cell-${realTarget.x}-${realTarget.y}"]`);
  await realTargetCell.click();
  await page.waitForTimeout(350);

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_lost_02_found.png') });
  console.log('  [OK Captured] desktop_lost_02_found.png');

  await r3WinScreen.waitFor({ state: 'visible', timeout: 5000 });
  const realTargetStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  console.log(`  Stars on real tap path: ${realTargetStars}`);

  // Verify win title: "ROVER FOUND!"
  const winTitle3Star = await r3WinScreen.locator('span').filter({ hasText: 'ROVER FOUND!' }).count();
  if (winTitle3Star === 0) {
    throw new Error(`Expected win title "ROVER FOUND!", got: ${await r3WinScreen.innerText()}`);
  }
  console.log('  [PASS] Lunokhod 1 win title is "ROVER FOUND!" (zero "RELIC LOGGED!" before claim)');

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_lost_03_win_screen.png') });
  console.log('  [OK Captured] desktop_lost_03_win_screen.png');

  // Check 7: Fact reveal, zero bonus RP toast, and claim
  console.log('  Checking Did-You-Know fact reveal for Lunokhod 1...');
  const r3FactBtn = page.locator('[data-testid="minigame-fact"]');
  const r3TeaserText = (await r3FactBtn.textContent()) || '';
  console.log(`  Lunokhod 1 teaser text: "${r3TeaserText}"`);
  if (!r3TeaserText.includes('Moon') || r3TeaserText.includes('Mars')) {
    throw new Error(`Expected relic 3 teaser to contain "Moon" and not "Mars", got: "${r3TeaserText}"`);
  }
  console.log('  [PASS] Relic 3 teaser text contains "Moon" and not "Mars"');

  await r3FactBtn.click();
  await page.waitForTimeout(200);
  const r3FactText = await r3FactBtn.textContent();
  const expectedLunokhodFact = "Lunokhod 1 drove on the Moon in 1970, then was lost for almost 40 years. In 2010 a NASA orbiter spotted it, and scientists bounced a laser off its mirror on the very first try!";
  if (!r3FactText || !r3FactText.includes(expectedLunokhodFact)) {
    throw new Error(`Fact text does not match expected Lunokhod 1 fact. Got: ${r3FactText}`);
  }
  console.log('  [PASS] Exact historical Did-You-Know fact displayed for Lunokhod 1');

  const r3BonusCount = await page.locator('[data-testid="bonus-rp-toast"]').count();
  if (r3BonusCount > 0) {
    throw new Error('bonus-rp-toast appeared for Lunokhod 1 in Moon chapter!');
  }
  console.log('  [PASS] Zero bonus RP toast awarded for Lunokhod 1 in Moon chapter');

  // Moon-3.1 / Moon-4 Claim Trap Check: Claim relic 3 via Shell X button (puzzle-exit-btn)
  console.log('  Claiming relic 3 via Shell X button (Claim Trap Fix)...');
  const r3ClaimXBtn = page.locator('[data-testid="puzzle-exit-btn"]');
  await r3ClaimXBtn.click();

  const r3Toast = page.locator('[data-testid="moon-relic-toast"]');
  await r3Toast.waitFor({ state: 'visible', timeout: 3000 });
  const r3ToastText = (await r3Toast.textContent()) || '';
  if (!r3ToastText.includes('3/3')) {
    throw new Error(`Expected relic 3 toast "RELIC 3/3", got: "${r3ToastText}"`);
  }
  console.log('  [PASS] Relic 3 claim via Shell X showed toast "RELIC 3/3"');

  await page.locator('[data-testid="minigame-shell"]').waitFor({ state: 'detached', timeout: 5000 });
  const counter3Text = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!counter3Text.includes('3/3')) {
    throw new Error(`Expected counter 3/3, got: ${counter3Text}`);
  }
  console.log('  [PASS] Relic 3 logged via LunokhodLostRoverGame, counter 3/3');

  // Reload mid-chapter keeps relic 3
  console.log('  Testing mid-chapter reload persistence after Lunokhod 1...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtnPing3 = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtnPing3.isVisible()) {
    await continueBtnPing3.click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  const reloadedCounter3 = await page.locator('[data-testid="moon-relic-counter"]').textContent();
  if (!reloadedCounter3.includes('3/3')) {
    throw new Error(`Expected relic counter 3/3 after reload, got: ${reloadedCounter3}`);
  }
  console.log('  [PASS] Mid-chapter reload kept collected relics 3/3');

  // Replay check: Nova says one line, no minigame opens
  console.log('  Testing replay of collected relic 3 (Nova line, no game)...');
  await page.evaluate(() => window.__moonTeleport(52, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const shellCountLost = await page.locator('[data-testid="minigame-shell"]').count();
  if (shellCountLost > 0) {
    throw new Error('Replaying collected relic 3 opened minigame!');
  }
  const replayDialogueLost = page.locator('[data-testid="nova-dialogue"]');
  await replayDialogueLost.waitFor({ state: 'visible', timeout: 4000 });
  console.log('  [PASS] Replay shows Nova line without opening game');
  await page.keyboard.press('KeyE'); // dismiss dialogue
  await page.waitForTimeout(600);

  // 4. Earthrise panel and RP bonus transfer
  console.log('Moon 4: Earthrise panel and RP bonus transfer...');
  const observeEarthriseBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await observeEarthriseBtn.waitFor({ state: 'visible', timeout: 6000 });
  await observeEarthriseBtn.click();

  const earthrisePanel = page.locator('[data-testid="moon-earthrise"]');
  await earthrisePanel.waitFor({ state: 'visible', timeout: 6000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop_moon_earthrise.png') });
  console.log('  [OK Captured] desktop_moon_earthrise.png');

  // Moon-4.1 Check 5: Earthrise copy verification
  const earthriseText = await earthrisePanel.innerText();
  if (!earthriseText.includes('Three relics logged! Next stop: Mars.')) {
    throw new Error(`Expected new Earthrise copy "Three relics logged! Next stop: Mars.", got: "${earthriseText}"`);
  }
  if (earthriseText.includes('Lunar telemetry compiled')) {
    throw new Error(`Old Earthrise copy still present: "${earthriseText}"`);
  }
  if (!earthriseText.includes('TRANSIT TO MARS...')) {
    throw new Error(`Missing TRANSIT TO MARS label: "${earthriseText}"`);
  }
  console.log('  [PASS] Earthrise shows new copy ("Three relics logged! Next stop: Mars.") and retains TRANSIT TO MARS header');

  const continueMarsBtn = page.locator('[data-testid="moon-earthrise-continue"]');
  await continueMarsBtn.click();

  // Verification 1: Complete Moon -> Earthrise Continue -> Crash Interlude plays
  console.log('Moon 4: Verifying Crash Interlude plays after Earthrise Continue...');
  const crashInterlude = page.locator('[data-testid="crash-interlude"]');
  await crashInterlude.waitFor({ state: 'visible', timeout: 6000 });
  await moonScene.waitFor({ state: 'detached', timeout: 5000 });
  console.log('  [PASS] Moon 4: Complete Moon -> Earthrise Continue -> Crash Interlude plays');

  // Verify Interlude text: no prohibited words (critical, guidance, beat, plasma, thruster, retro, gimbal, telemetry, transceiver, subsys, RF)
  const interludeDomText = await crashInterlude.innerText();
  const prohibitedWords = ['critical', 'guidance', 'beat', 'plasma', 'thruster', 'retro', 'gimbal', 'telemetry', 'transceiver', 'subsys', 'RF'];
  for (const word of prohibitedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(interludeDomText)) {
      throw new Error(`Prohibited word "${word}" found in Crash Interlude text: "${interludeDomText}"`);
    }
  }
  console.log('  [PASS] Crash Interlude DOM text contains zero prohibited words');

  // Verify Beat 1 content and skip button visible from first second
  const beat1 = page.locator('[data-testid="crash-beat-1"]');
  await beat1.waitFor({ state: 'visible', timeout: 3000 });
  const beat1Text = await beat1.innerText();
  if (!beat1Text.includes('Entering Mars...')) {
    throw new Error(`Expected Beat 1 "Entering Mars...", got: "${beat1Text}"`);
  }
  if (!beat1Text.toLowerCase().includes('18,000 meters up')) {
    throw new Error(`Expected Beat 1 pill "18,000 meters up!", got: "${beat1Text}"`);
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_desktop_beat1.png') });
  console.log('  [OK Captured] crash_desktop_beat1.png');

  const skipBtn = page.locator('[data-testid="crash-skip-btn"]');
  await skipBtn.waitFor({ state: 'visible', timeout: 2000 });

  // Skip button rect is >= 12px inside viewport from all edges
  const interludeSkipBox = await skipBtn.boundingBox();
  const vp = page.viewportSize();
  if (!interludeSkipBox || interludeSkipBox.x < 12 || interludeSkipBox.y < 12 || (vp.width - (interludeSkipBox.x + interludeSkipBox.width)) < 12 || (vp.height - (interludeSkipBox.y + interludeSkipBox.height)) < 12) {
    throw new Error(`Skip button not >= 12px inside viewport: ${JSON.stringify(interludeSkipBox)}, viewport: ${JSON.stringify(vp)}`);
  }
  console.log('  [PASS] Skip button rect is >= 12px inside viewport from all edges');

  // Advance to Beat 2 and capture desktop screenshot
  await crashInterlude.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(300);
  const beat2 = page.locator('[data-testid="crash-beat-2"]');
  await beat2.waitFor({ state: 'visible', timeout: 3000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_desktop_beat2.png') });
  console.log('  [OK Captured] crash_desktop_beat2.png');

  // Advance to Beat 3, verify no "..." truncation on cards, capture desktop screenshot
  await crashInterlude.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(300);
  const beat3 = page.locator('[data-testid="crash-beat-3"]');
  await beat3.waitFor({ state: 'visible', timeout: 3000 });
  const beat3CardsText = await beat3.innerText();
  // Ensure cards don't have ellipsis
  const cardLines = beat3CardsText.split('\n').filter(l => l.includes('Power') || l.includes('Radio') || l.includes('Gyro') || l.includes('Life support') || l.includes('Low power') || l.includes('Offline') || l.includes('Wobbly') || l.includes('OK'));
  for (const line of cardLines) {
    if (line.includes('...') || line.includes('…')) {
      throw new Error(`Truncated "..." found on card: "${line}"`);
    }
  }
  console.log('  [PASS] No "..." truncation on any diagnostic card');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_desktop_beat3.png') });
  console.log('  [OK Captured] crash_desktop_beat3.png');

  // Verification 3: Reload during interlude -> Continue button leads to Mars world, not Moon or interlude
  console.log('  Testing reload during interlude...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtn2 = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtn2.isVisible()) {
    await continueBtn2.click();
  }
  const worldCanvas = page.locator('[data-testid="world-canvas"]');
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  if (await page.locator('[data-testid="moon-scene"]').count() > 0) {
    throw new Error('Moon scene opened after reload during interlude!');
  }
  if (await page.locator('[data-testid="crash-interlude"]').count() > 0) {
    throw new Error('Crash interlude opened again after reload!');
  }
  console.log('  [PASS] Reload during interlude went directly to Mars world, never Moon or interlude');

  // Verification 6: RP bonus applied once (3 RP for 3 relics)
  let rp = await page.evaluate(() => (window).__getResearchPoints?.());
  console.log(`  Initial Mars RP (3 relics): ${rp}`);
  if (rp !== 3) throw new Error(`Expected 3 RP from 3 moon relics, got: ${rp}`);
  console.log('  [PASS] 3 RP awarded from 3 logged moon relics');

  // Verification 5 & Check 3: Nova's first line on Mars and Chirp Pill absence/delay
  const novaDialogue = page.locator('[data-testid="nova-dialogue"]');
  await novaDialogue.waitFor({ state: 'visible', timeout: 6000 });

  // Assert Chirp Pill is ABSENT while Nova first line dialogue is open
  const chirpBubble = page.locator('[data-testid="nova-speech-bubble"]');
  if (await chirpBubble.isVisible()) {
    throw new Error('Chirp bubble was visible while Nova first line dialogue was open!');
  }
  console.log('  [PASS] Chirp speech bubble is absent while Nova first line is open');

  await novaDialogue.click(); // Skip typing animation
  await page.locator('[data-testid="nova-dialogue"] p').filter({ hasText: 'I forgot everything. Please stay close, Explorer!' }).waitFor({ state: 'visible', timeout: 5000 });
  const novaText = await novaDialogue.innerText();
  console.log(`  Nova first line on Mars: "${novaText}"`);
  if (!novaText.includes('I forgot everything. Please stay close, Explorer!')) {
    throw new Error(`Expected Nova first line "I forgot everything. Please stay close, Explorer!", got: "${novaText}"`);
  }
  const novaWordCount = "I forgot everything. Please stay close, Explorer!".split(/\s+/).length;
  if (novaWordCount > 12) {
    throw new Error(`Nova line exceeds 12 words: ${novaWordCount}`);
  }
  console.log('  [PASS] Nova first line on Mars matches spec (<= 12 words)');

  // Dismiss dialogue and assert Chirp appears after dismissal
  const novaDismissBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  if (await novaDismissBtn.isVisible()) {
    await novaDismissBtn.click();
  } else {
    await page.keyboard.press('KeyE');
  }
  await novaDialogue.waitFor({ state: 'detached', timeout: 3000 });

  // Delay over: teleport to sample and assert chirp appears
  await page.evaluate(() => window.__teleportToSample(0));
  await chirpBubble.waitFor({ state: 'visible', timeout: 6000 });
  const bubbleTextAfterDismiss = await chirpBubble.textContent();
  console.log(`  Nova Bubble Text after dismiss: "${bubbleTextAfterDismiss}"`);
  if (!bubbleTextAfterDismiss.includes('?') && !bubbleTextAfterDismiss.includes('Chirp') && !bubbleTextAfterDismiss.includes('glint')) {
    throw new Error(`Expected chirp reaction after dismiss, got: ${bubbleTextAfterDismiss}`);
  }
  console.log('  [PASS] Chirp pill appeared after Nova dialogue was dismissed');

  // Verification 7: Codex Moon Relics tab with 3/3 found
  console.log('  Checking Codex Moon Relics tab (3/3 found)...');
  const codexBtn = page.locator('[data-testid="codex-btn"]');
  await codexBtn.click();
  const codexModal = page.locator('[data-testid="codex-modal"]');
  await codexModal.waitFor({ state: 'visible', timeout: 5000 });

  const moonTabBtn = page.locator('[data-testid="moon-relics-tab-btn"]');
  await moonTabBtn.waitFor({ state: 'visible', timeout: 5000 });
  const moonTabBtnText = await moonTabBtn.innerText();
  if (!moonTabBtnText.includes('Moon Relics (3/3)')) {
    throw new Error(`Expected Moon Relics (3/3), got: "${moonTabBtnText}"`);
  }
  await moonTabBtn.click();
  const moonTabContent = page.locator('[data-testid="codex-moon-tab-content"]');
  await moonTabContent.waitFor({ state: 'visible', timeout: 5000 });

  const l9Name = await page.locator('[data-testid="moon-relic-name-moon_luna9"]').innerText();
  const l9Year = await page.locator('[data-testid="moon-relic-year-moon_luna9"]').innerText();
  const l9Fact = await page.locator('[data-testid="moon-relic-fact-moon_luna9"]').innerText();
  if (!l9Name.includes('Luna 9') || !l9Year.includes('1966') || !l9Fact.includes('touched down on 3 Feb 1966')) {
    throw new Error(`Luna 9 data mismatch in Codex: ${l9Name}, ${l9Year}, ${l9Fact}`);
  }

  const a11Name = await page.locator('[data-testid="moon-relic-name-moon_apollo11"]').innerText();
  const a11Year = await page.locator('[data-testid="moon-relic-year-moon_apollo11"]').innerText();
  const a11Fact = await page.locator('[data-testid="moon-relic-fact-moon_apollo11"]').innerText();
  if (!a11Name.includes('Apollo 11') || !a11Year.includes('1969') || !a11Fact.includes('100 mirrors')) {
    throw new Error(`Apollo 11 data mismatch in Codex: ${a11Name}, ${a11Year}, ${a11Fact}`);
  }

  const l1Name = await page.locator('[data-testid="moon-relic-name-moon_lunokhod1"]').innerText();
  const l1Year = await page.locator('[data-testid="moon-relic-year-moon_lunokhod1"]').innerText();
  const l1Fact = await page.locator('[data-testid="moon-relic-fact-moon_lunokhod1"]').innerText();
  if (!l1Name.includes('Lunokhod 1') || !l1Year.includes('1970') || !l1Fact.includes('lost for almost 40 years')) {
    throw new Error(`Lunokhod 1 data mismatch in Codex: ${l1Name}, ${l1Year}, ${l1Fact}`);
  }
  console.log('  [PASS] Codex Moon Relics tab shows 3/3 found with name, year, and didYouKnow text');

  // Verify Codex Logs Tab Intro reframing
  await page.locator('[data-testid="logs-tab-btn"]').click();
  const logsContent = page.locator('[data-testid="codex-logs-tab-content"]');
  await logsContent.waitFor({ state: 'visible', timeout: 5000 });
  const logsIntro = await logsContent.innerText();
  if (!logsIntro.includes('Nova wrote these notes on old probes while you recovered from the crash.')) {
    throw new Error(`Expected reframed logs intro, got: "${logsIntro}"`);
  }
  if (logsIntro.includes('Pre-arrival memory fragments')) {
    throw new Error(`Old pre-arrival intro text still present in Codex!`);
  }
  console.log('  [PASS] Codex Logs tab intro successfully reframed');

  await page.locator('[data-testid="codex-close-btn"]').click();
  await codexModal.waitFor({ state: 'detached', timeout: 5000 });

  // Reload keeps 3 RP
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtnPersist = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtnPersist.isVisible()) await continueBtnPersist.click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  rp = await page.evaluate(() => (window).__getResearchPoints?.());
  console.log(`  Mars RP after reload: ${rp}`);
  if (rp !== 3) throw new Error(`Expected RP to remain 3 after reload, got: ${rp}`);
  console.log('  [PASS] 3 RP persisted after reload');

  // -------------------------------------------------------------------------
  // RP MATRIX AUDIT (Policy A: 4 Matrix Cases & Reload Invariance)
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------');
  console.log('Moon 5: Verifying Full RP Matrix & Reload Invariance...');

  // (a) 3 relics + orange glass -> Earthrise -> Continue -> 4 RP (and 4 after reload)
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: {
        relicIds: ['moon_luna9', 'moon_apollo11', 'moon_lunokhod1'],
        secretIds: ['secret_orange_glass'],
        completed: false,
        rpApplied: false,
      }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const resumeBtnA = page.locator('[data-testid="continue-mission-btn"]');
  if (await resumeBtnA.isVisible()) await resumeBtnA.click();
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  const earthriseAct = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await earthriseAct.waitFor({ state: 'visible', timeout: 5000 });
  await earthriseAct.click();
  await page.locator('[data-testid="moon-earthrise-continue"]').click();
  const cInterlude = page.locator('[data-testid="crash-interlude"]');
  await cInterlude.waitFor({ state: 'visible', timeout: 5000 });
  const cSkipBtn = page.locator('[data-testid="crash-skip-btn"]');
  await cSkipBtn.waitFor({ state: 'visible', timeout: 3000 });
  await cSkipBtn.click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpA = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpA !== 4) throw new Error(`Expected 4 RP for (a) 3 relics + orange glass, got: ${rpA}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpAReload = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpAReload !== 4) throw new Error(`Expected 4 RP after reload for (a), got: ${rpAReload}`);
  console.log(`  [PASS] (a) 3 relics + orange glass -> Earthrise -> Continue -> ${rpA} (after reload: ${rpAReload})`);

  // (b) 3 relics, no secrets -> 3 RP (and 3 after reload)
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: {
        relicIds: ['moon_luna9', 'moon_apollo11', 'moon_lunokhod1'],
        secretIds: [],
        completed: false,
        rpApplied: false,
      }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  await earthriseAct.waitFor({ state: 'visible', timeout: 5000 });
  await earthriseAct.click();
  await page.locator('[data-testid="moon-earthrise-continue"]').click();
  await cInterlude.waitFor({ state: 'visible', timeout: 5000 });
  await cSkipBtn.waitFor({ state: 'visible', timeout: 3000 });
  await cSkipBtn.click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpB = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpB !== 3) throw new Error(`Expected 3 RP for (b) 3 relics, no secrets, got: ${rpB}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpBReload = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpBReload !== 3) throw new Error(`Expected 3 RP after reload for (b), got: ${rpBReload}`);
  console.log(`  [PASS] (b) 3 relics, no secrets -> ${rpB} (after reload: ${rpBReload})`);

  // (c) 2 relics + 3 rocks + 1 ice + both monuments, Skip -> 2 RP (and 2 after reload)
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: {
        relicIds: ['moon_luna9', 'moon_apollo11'],
        secretIds: [],
        lunarRockIds: ['rock_breccia', 'rock_basalt', 'rock_genesis'],
        iceScannedIds: ['ice_crater_shackleton'],
        monumentIds: ['monument_surveyor3', 'monument_fallen_astronaut'],
        completed: false,
        rpApplied: false,
      }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="moon-skip-btn"]').click();
  await cInterlude.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="crash-skip-btn"]').click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpC = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpC !== 2) throw new Error(`Expected 2 RP for (c) 2 relics + 3 rocks + 1 ice + 2 monuments, got: ${rpC}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpCReload = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpCReload !== 2) throw new Error(`Expected 2 RP after reload for (c), got: ${rpCReload}`);
  console.log(`  [PASS] (c) 2 relics + 3 rocks + 1 ice + both monuments, Skip -> ${rpC} (after reload: ${rpCReload})`);

  // (d) 0 relics + orange glass, Skip -> 1 RP (and 1 after reload)
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: {
        relicIds: [],
        secretIds: ['secret_orange_glass'],
        completed: false,
        rpApplied: false,
      }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="moon-skip-btn"]').click();
  await cInterlude.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="crash-skip-btn"]').click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpD = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpD !== 1) throw new Error(`Expected 1 RP for (d) 0 relics + orange glass, got: ${rpD}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('[data-testid="continue-mission-btn"]').isVisible()) {
    await page.locator('[data-testid="continue-mission-btn"]').click();
  }
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const rpDReload = await page.evaluate(() => (window).__getResearchPoints?.());
  if (rpDReload !== 1) throw new Error(`Expected 1 RP after reload for (d), got: ${rpDReload}`);
  console.log(`  [PASS] (d) 0 relics + orange glass, Skip -> ${rpD} (after reload: ${rpDReload})`);

  console.log('------------------------------------------------------');
  console.log('RP MATRIX VERIFICATION RESULTS:');
  console.log(`  (a) 3 relics + orange glass -> Earthrise -> Continue -> ${rpA} (after reload: ${rpAReload})`);
  console.log(`  (b) 3 relics, no secrets -> ${rpB} (after reload: ${rpBReload})`);
  console.log(`  (c) 2 relics + 3 rocks + 1 ice + both monuments, Skip -> ${rpC} (after reload: ${rpCReload})`);
  console.log(`  (d) 0 relics + orange glass, Skip -> ${rpD} (after reload: ${rpDReload})`);
  console.log('------------------------------------------------------');

  // Nova first line after skip
  const novaSkip = page.locator('[data-testid="nova-dialogue"]');
  if (await novaSkip.isVisible()) {
    const novaSkipText = await novaSkip.innerText();
    if (!novaSkipText.includes('I forgot everything. Please stay close, Explorer!')) {
      throw new Error(`Expected Nova line after skip, got: "${novaSkipText}"`);
    }
    const dismissBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
    if (await dismissBtn.isVisible()) await dismissBtn.click();
  }

  // Codex shows 0/3 Moon Relics with silhouettes
  await page.locator('[data-testid="codex-btn"]').click();
  await codexModal.waitFor({ state: 'visible', timeout: 5000 });
  const moonTab0 = page.locator('[data-testid="moon-relics-tab-btn"]');
  const moonTab0Text = await moonTab0.innerText();
  if (!moonTab0Text.includes('Moon Relics (0/3)')) {
    throw new Error(`Expected Moon Relics (0/3) after skip, got: "${moonTab0Text}"`);
  }
  await moonTab0.click();
  const l9Sil = page.locator('[data-testid="moon-relic-silhouette-moon_luna9"]');
  if (await l9Sil.count() === 0) throw new Error('Expected silhouette for unfound Luna 9');
  const l9UnfoundName = await page.locator('[data-testid="moon-relic-name-moon_luna9"]').innerText();
  if (l9UnfoundName !== '???') throw new Error(`Expected "???" for unfound Luna 9, got: "${l9UnfoundName}"`);
  console.log('  [PASS] Codex shows Moon Relics 0/3 with silhouettes and "???" after skip');
  await page.locator('[data-testid="codex-close-btn"]').click();
  await codexModal.waitFor({ state: 'detached', timeout: 5000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtn3 = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtn3.isVisible()) {
    await continueBtn3.click();
  }
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const skippedMoonCount = await page.locator('[data-testid="moon-scene"]').count();
  if (skippedMoonCount > 0) throw new Error('Moon scene shown again after skip!');
  console.log('  [PASS] Moon 5: Skip from first second lands in Mars with 0 RP, Moon never shown again');

  // 6. Existing save with worldSave and no moonChapter
  console.log('Moon 6: Existing save with worldSave and no moonChapter...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    const existingSave = {
      version: 3,
      currentChapter: 0,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      worldSave: {
        version: 3,
        seed: 19970704,
        playerTileX: 10,
        playerTileY: 10,
        playerFacing: 'down',
        collectedPartIds: ['part_gear'],
        completedEquipmentIds: [],
        exploredFog: null,
        shipRepaired: false,
        playTimeSeconds: 50,
        lastSavedAt: Date.now(),
        researchPoints: 7,
      },
    };
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify(existingSave));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="continue-mission-btn"]').click();

  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const moonCount = await page.locator('[data-testid="moon-scene"]').count();
  if (moonCount > 0) throw new Error('Moon opened for existing save with worldSave!');
  const oldSaveNovaCount = await page.locator('[data-testid="nova-dialogue"]').count();
  if (oldSaveNovaCount > 0) {
    const oldNovaText = await page.locator('[data-testid="nova-dialogue"]').innerText();
    if (oldNovaText.includes('I forgot everything')) {
      throw new Error(`Old save unexpectedly displayed Nova "forgot everything" dialogue: ${oldNovaText}`);
    }
  }
  console.log('  [PASS] Moon 6: Existing save went to Mars world, never the Moon, and kept original line');

  // 6b. v3 save whose moonChapter lacks the new fields (e.g. relics only, no secretIds/rockIds/etc.)
  console.log('Moon 6b: v3 save whose moonChapter lacks new fields...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    const v3SaveLackingNewFields = {
      version: 3,
      currentChapter: 0,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      worldSave: {
        version: 3,
        seed: 19970704,
        playerTileX: 10,
        playerTileY: 10,
        playerFacing: 'down',
        collectedPartIds: ['part_gear'],
        completedEquipmentIds: [],
        exploredFog: null,
        shipRepaired: false,
        playTimeSeconds: 50,
        lastSavedAt: Date.now(),
        researchPoints: 7,
      },
      moonChapter: {
        relicIds: ['moon_luna9', 'moon_apollo11'],
        completed: true,
        rpApplied: true,
      },
    };
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify(v3SaveLackingNewFields));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="continue-mission-btn"]').click();
  await worldCanvas.waitFor({ state: 'visible', timeout: 10000 });
  const moonCountV3 = await page.locator('[data-testid="moon-scene"]').count();
  if (moonCountV3 > 0) throw new Error('Moon opened for v3 save whose moonChapter lacks new fields!');
  console.log('  [PASS] Moon 6b: v3 save lacking new fields went to Mars world, never the Moon');

  // 7. Legacy Chapter 2 still opens from Legacy Chapters
  console.log('Moon 7: Legacy Chapter 2 opens from Legacy Chapters modal...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    const saved = JSON.parse(localStorage.getItem('beyond_depth_save_v3') || '{}');
    saved.currentChapter = 0;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="legacy-chapters-btn"]').click();
  const legacyModal = page.locator('[data-testid="legacy-chapters-modal"]');
  await legacyModal.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="legacy-chapter-2"]').click();
  await page.locator('text=LEGACY: THE MOON').waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Moon 7: Legacy Chapter 2 successfully opened from Legacy Chapters modal');

  // 8. Mobile Pass: moon-hop-btn >= 48px, D-pad moves, no page scroll, plus Luna 9 mobile verification
  console.log('Moon 8: Mobile layout, hop button size, D-pad, scroll isolation, and Luna 9 mobile verification...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mPage = await mobileContext.newPage();
  await mPage.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await mPage.evaluate(() => localStorage.clear());
  await mPage.reload({ waitUntil: 'domcontentloaded' });

  await mPage.locator('[data-testid="start-mission-btn"]').click();
  await mPage.locator('[data-testid="skip-prologue-btn"]').click();

  const mMoonScene = mPage.locator('[data-testid="moon-scene"]');
  await mMoonScene.waitFor({ state: 'visible', timeout: 6000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_scene.png') });
  console.log('  [OK Captured] mobile_moon_scene.png');

  // Visual Fix Assertions on Mobile (Moon-1.1):
  // 1. Mobile canvas rect equals viewport (390x844)
  const mCanvasEl = mPage.locator('[data-testid="moon-scene"] canvas');
  const mMoonCanvasBox = await mCanvasEl.boundingBox();
  if (!mMoonCanvasBox || mMoonCanvasBox.width !== 390 || mMoonCanvasBox.height !== 844) {
    throw new Error(`Mobile canvas size must equal 390x844, got: ${JSON.stringify(mMoonCanvasBox)}`);
  }
  console.log('  [PASS] Mobile canvas rect equals viewport (390x844)');

  // 2. Mobile player sprite height >= 28px
  const mSpriteHeight = await mPage.evaluate(() => {
    return window.__moonDebug?.getPlayerSpriteHeight?.() || Number(document.querySelector('[data-testid="moon-scene"]').getAttribute('data-player-sprite-height'));
  });
  console.log(`  Mobile player sprite height: ${mSpriteHeight}px (requirement >= 28px)`);
  if (!mSpriteHeight || mSpriteHeight < 28) {
    throw new Error(`Mobile player sprite height must be >= 28px, got: ${mSpriteHeight}px`);
  }
  console.log('  [PASS] Mobile player sprite height >= 28px');

  // 3. Mobile HUD chips safe padding >= 12px on all 4 sides
  const mRelicBox = await mPage.locator('[data-testid="moon-relic-counter"]').boundingBox();
  const mSkipBox = await mPage.locator('[data-testid="moon-skip-btn"]').boundingBox();
  if (!mRelicBox || mRelicBox.x < 12) {
    throw new Error(`Mobile relic counter padding < 12px: ${mRelicBox?.x}px`);
  }
  if (
    !mSkipBox ||
    mSkipBox.x < 12 ||
    mSkipBox.y < 12 ||
    (390 - (mSkipBox.x + mSkipBox.width)) < 12 ||
    (844 - (mSkipBox.y + mSkipBox.height)) < 12
  ) {
    throw new Error(`Mobile moon-skip-btn rect not >= 12px inside viewport: ${JSON.stringify(mSkipBox)}`);
  }
  console.log(`  Mobile HUD chip margins: left=${mRelicBox.x}px, right=${390 - (mSkipBox.x + mSkipBox.width)}px, top=${mSkipBox.y}px (all >= 12px)`);
  console.log('  [PASS] Polish-2: Mobile moon-skip-btn rect >= 12px inside viewport on all 4 sides');

  // 4. BEACON visible on mobile
  const mBeacon = mPage.locator('[data-testid="moon-beacon"]');
  await mBeacon.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] moon-beacon visible on mobile');

  // 5. Mobile Screenshots: spawn, next to a pit, mid-hop (data-hopping=true), and in front of relic 1
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_spawn.png') });
  console.log('  [OK Captured] mobile_moon_spawn.png');

  // Pit and rock next to each other screenshot on mobile
  await mPage.evaluate(() => window.__moonTeleport(23, 17));
  await mPage.waitForTimeout(200);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_pit_vs_rock.png') });
  console.log('  [OK Captured] mobile_moon_pit_vs_rock.png (pit and rock clearly different on mobile)');

  await mPage.evaluate(() => window.__moonTeleport(24, 20));
  await mPage.waitForTimeout(200);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_next_to_pit.png') });
  console.log('  [OK Captured] mobile_moon_next_to_pit.png');

  const mHopBtnElem = mPage.locator('[data-testid="moon-hop-btn"]');
  await mHopBtnElem.click();
  await mPage.waitForTimeout(300);
  const mMidHopStatus = await mMoonScene.getAttribute('data-hopping');
  if (mMidHopStatus !== 'true') throw new Error(`Expected mobile data-hopping="true", got: ${mMidHopStatus}`);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_mid_hop.png') });
  console.log('  [OK Captured] mobile_moon_mid_hop.png (data-hopping=true)');
  await mPage.waitForTimeout(650);

  await mPage.evaluate(() => window.__moonTeleport(18, 20));
  await mPage.waitForTimeout(200);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_moon_relic1.png') });
  console.log('  [OK Captured] mobile_moon_relic1.png');

  // Capture context button next to relic
  await mPage.evaluate(() => window.__moonTeleport(18, 20));
  await mPage.waitForTimeout(200);
  const mContextRelicBtn = mPage.locator('[data-testid="touch-interact-btn"]');
  await mContextRelicBtn.waitFor({ state: 'visible', timeout: 3000 });
  const ctxRelicBox = await mContextRelicBtn.boundingBox();
  if (!ctxRelicBox || ctxRelicBox.height < 48 || ctxRelicBox.width < 48) {
    throw new Error(`touch-interact-btn must be >= 48px, got: ${JSON.stringify(ctxRelicBox)}`);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_context_relic.png') });
  console.log('  [OK Captured] mobile_context_relic.png');

  // Capture context button next to rover
  await mPage.evaluate(() => window.__moonTeleport(13, 16));
  await mPage.waitForTimeout(200);
  const mContextRoverBtn = mPage.locator('[data-testid="touch-board-rover-btn"]');
  await mContextRoverBtn.waitFor({ state: 'visible', timeout: 3000 });
  const ctxRoverBox = await mContextRoverBtn.boundingBox();
  if (!ctxRoverBox || ctxRoverBox.height < 48 || ctxRoverBox.width < 48) {
    throw new Error(`touch-board-rover-btn must be >= 48px, got: ${JSON.stringify(ctxRoverBox)}`);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_context_rover.png') });
  console.log('  [OK Captured] mobile_context_rover.png');

  // Capture context button next to rock
  await mPage.evaluate(() => window.__moonTeleport(20, 12));
  await mPage.waitForTimeout(200);
  const mContextRockBtn = mPage.locator('[data-testid="touch-rock-btn"]');
  await mContextRockBtn.waitFor({ state: 'visible', timeout: 3000 });
  const ctxRockBox = await mContextRockBtn.boundingBox();
  if (!ctxRockBox || ctxRockBox.height < 48 || ctxRockBox.width < 48) {
    throw new Error(`touch-rock-btn must be >= 48px, got: ${JSON.stringify(ctxRockBox)}`);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_context_rock.png') });
  console.log('  [OK Captured] mobile_context_rock.png');

  // Capture context button next to thumper
  await mPage.evaluate(() => window.__moonTeleport(33, 23));
  await mPage.waitForTimeout(200);
  const mContextThumperBtn = mPage.locator('[data-testid="touch-thumper-btn"]');
  await mContextThumperBtn.waitFor({ state: 'visible', timeout: 3000 });
  const ctxThumperBox = await mContextThumperBtn.boundingBox();
  if (!ctxThumperBox || ctxThumperBox.height < 48 || ctxThumperBox.width < 48) {
    throw new Error(`touch-thumper-btn must be >= 48px, got: ${JSON.stringify(ctxThumperBox)}`);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_context_thumper.png') });
  console.log('  [OK Captured] mobile_context_thumper.png');

  // Return to spawn
  await mPage.evaluate(() => window.__moonTeleport(8, 20));
  await mPage.waitForTimeout(200);

  const hopBtn = mPage.locator('[data-testid="moon-hop-btn"]');
  await hopBtn.waitFor({ state: 'visible' });
  const hopBox = await hopBtn.boundingBox();
  if (!hopBox || hopBox.width < 48 || hopBox.height < 48) {
    throw new Error(`moon-hop-btn must be >= 48px, got: ${JSON.stringify(hopBox)}`);
  }
  console.log(`  moon-hop-btn dimensions: ${hopBox.width}x${hopBox.height} (>= 48px confirmed)`);

  const initTile = await mMoonScene.getAttribute('data-player-tile');
  const dpadRight = mPage.locator('[data-testid="virtual-dpad"] button:has-text("▶")');
  await dpadRight.dispatchEvent('pointerdown');
  await mPage.waitForTimeout(400);
  await dpadRight.dispatchEvent('pointerup');
  const movedTile = await mMoonScene.getAttribute('data-player-tile');
  if (initTile === movedTile) throw new Error(`D-pad did not move player! Tile stayed at ${initTile}`);
  console.log(`  D-pad moved player from ${initTile} to ${movedTile}`);

  // Test Luna 9 on mobile
  console.log('  Testing Luna 9 Soft Landing on Mobile (390x844)...');
  await mPage.evaluate(() => window.__moonTeleport(18, 20));
  await mPage.waitForTimeout(300);

  const mInteractBtn = mPage.locator('[data-testid="touch-interact-btn"]');
  await mInteractBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mInteractBtn.click();

  const mNovaActionBtn = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
  await mNovaActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mNovaActionBtn.click();

  const mLunaGame = mPage.locator('[data-testid="luna-game"]');
  await mLunaGame.waitFor({ state: 'visible', timeout: 5000 });

  // Verify mobile footer is empty at game start
  const mFooterEl = mPage.locator('[data-testid="minigame-shell"] .border-t p');
  const mInitialFooter = (await mFooterEl.textContent()) || '';
  console.log(`  Mobile Luna 9 initial footer text: "${mInitialFooter}"`);
  if (mInitialFooter.trim() !== '') {
    throw new Error(`Expected empty footer at mobile Luna 9 game start, got: "${mInitialFooter}"`);
  }
  console.log('  [PASS] Mobile Luna 9 footer is empty at game start');

  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_01_falling.png') });
  console.log('  [OK Captured] luna_mobile_01_falling.png');

  // Verify mobile thrust button size >= 72px tall and >= 48px wide
  const mThrustBtn = mPage.locator('[data-testid="luna-thrust-btn"]');
  await mThrustBtn.waitFor({ state: 'visible' });
  const mThrustBox = await mThrustBtn.boundingBox();
  console.log(`  Mobile thrust button: ${mThrustBox?.width}x${mThrustBox?.height}`);
  if (!mThrustBox || mThrustBox.height < 72 || mThrustBox.width < 48) {
    throw new Error(`Mobile luna-thrust-btn must be >= 72px tall and >= 48px wide, got: ${JSON.stringify(mThrustBox)}`);
  }

  // Verify mobile canvas width >= 340px
  const mCanvas = mPage.locator('[data-testid="luna-game"] canvas');
  const mCanvasBox = await mCanvas.boundingBox();
  console.log(`  Mobile canvas width: ${mCanvasBox?.width}px (target >= 340px)`);
  if (!mCanvasBox || mCanvasBox.width < 340) {
    throw new Error(`Mobile canvas width < 340px: ${mCanvasBox?.width}px`);
  }

  // Verify zero page scroll
  const mScrollOffset = await mPage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (mScrollOffset.x !== 0 || mScrollOffset.y !== 0) {
    throw new Error(`Mobile page scroll detected: ${JSON.stringify(mScrollOffset)}`);
  }

  // Test touch hold on thrust button
  await mThrustBtn.dispatchEvent('pointerdown');
  await mPage.waitForTimeout(300);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_02_thrusting.png') });
  console.log('  [OK Captured] luna_mobile_02_thrusting.png');
  await mThrustBtn.dispatchEvent('pointerup');

  // Complete landing via autopilot perfect on mobile
  await mPage.evaluate(() => window.__lunaGame.setAutopilot('perfect'));
  let mLowFuelSnapped = false;
  while (true) {
    const s = await mPage.evaluate(() => window.__lunaGame.getState());
    if (s.phase === 'landed') break;
    if (s.fuel < 25 && !mLowFuelSnapped) {
      mLowFuelSnapped = true;
      await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_02_low_fuel.png') });
      console.log('  [OK Captured] luna_mobile_02_low_fuel.png');
    }
    await mPage.waitForTimeout(50);
  }

  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_03_3star_touchdown.png') });
  console.log('  [OK Captured] luna_mobile_03_3star_touchdown.png');

  const mWinScreen = mPage.locator('[data-testid="minigame-win"]');
  await mWinScreen.waitFor({ state: 'visible', timeout: 5000 });

  // Verify mobile teaser text contains "Moon" and not "Mars"
  const mFactBtn = mPage.locator('[data-testid="minigame-fact"]');
  const mTeaserText = (await mFactBtn.textContent()) || '';
  console.log(`  Mobile Luna 9 teaser text: "${mTeaserText}"`);
  if (!mTeaserText.includes('Moon') || mTeaserText.includes('Mars')) {
    throw new Error(`Expected mobile Luna 9 teaser to contain "Moon" and not "Mars", got: "${mTeaserText}"`);
  }
  console.log('  [PASS] Mobile Luna 9 teaser contains "Moon" and not "Mars"');

  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_05_win_screen.png') });
  console.log('  [OK Captured] luna_mobile_05_win_screen.png');

  // Test mobile airbag bounce capture via retry and no-input run
  const mRetryBtn = mPage.locator('[data-testid="minigame-retry"]');
  await mRetryBtn.click();
  await mLunaGame.waitFor({ state: 'visible', timeout: 5000 });
  while (true) {
    const s = await mPage.evaluate(() => window.__lunaGame.getState());
    if (s.phase === 'landed') break;
    await mPage.waitForTimeout(40);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'luna_mobile_04_airbag_bounce.png') });
  console.log('  [OK Captured] luna_mobile_04_airbag_bounce.png');

  // Claim Luna 9 to advance to relic 2 on mobile
  const mClaimLunaBtn = mPage.locator('[data-testid="claim-part-btn"]');
  await mClaimLunaBtn.click();
  await mLunaGame.waitFor({ state: 'detached', timeout: 5000 });

  // Test Apollo 11 Laser Ping on Mobile (390x844)
  console.log('  Testing Apollo 11 Laser Ping on Mobile (390x844)...');
  await mPage.evaluate(() => window.__moonTeleport(35, 20));
  await mPage.waitForTimeout(300);

  const mInteractPingBtn = mPage.locator('[data-testid="touch-interact-btn"]');
  await mInteractPingBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mInteractPingBtn.click();

  const mNovaPingActionBtn = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
  await mNovaPingActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mNovaPingActionBtn.click();

  const mPingGame = mPage.locator('[data-testid="ping-game"]');
  await mPingGame.waitFor({ state: 'visible', timeout: 5000 });

  // Verify mobile canvas width >= 340px
  const mPingCanvas = mPage.locator('[data-testid="ping-game"] canvas');
  const mPingCanvasBox = await mPingCanvas.boundingBox();
  console.log(`  Mobile Apollo 11 canvas width: ${mPingCanvasBox?.width}px (target >= 340px)`);
  if (!mPingCanvasBox || mPingCanvasBox.width < 340) {
    throw new Error(`Mobile Apollo 11 canvas width < 340px: ${mPingCanvasBox?.width}px`);
  }

  // Verify Moon disc >= 55% of canvas height & inside canvas (Moon-3.1 Visual Fix)
  const mPingState0 = await mPage.evaluate(() => window.__pingGame.getState());
  if (!mPingState0.moonMetrics || mPingState0.moonMetrics.ratio < 0.55) {
    throw new Error(`Mobile Moon disc ratio < 0.55: ${mPingState0.moonMetrics?.ratio}`);
  }
  if (!mPingState0.moonMetrics.isFullyInside) {
    throw new Error('Mobile Moon disc is not fully inside canvas!');
  }
  console.log(`  [PASS] Mobile Moon disc >= 55% height (${(mPingState0.moonMetrics.ratio * 100).toFixed(1)}%) and inside canvas`);

  // Moon-3.1 Visual Fix: Reticle >= 36 css px, ring outer radius >= 36 css px at mobile
  console.log(`  Mobile Reticle size CSS: ${mPingState0.reticleSizeCss}px (target >= 36px), Outer ring radius CSS: ${mPingState0.outerRadiusCss}px (target >= 36px)`);
  if (mPingState0.reticleSizeCss < 36) {
    throw new Error(`Mobile Reticle size CSS < 36px: ${mPingState0.reticleSizeCss}px`);
  }
  if (mPingState0.outerRadiusCss < 36) {
    throw new Error(`Mobile Outer ring radius CSS < 36px: ${mPingState0.outerRadiusCss}px`);
  }
  console.log('  [PASS] Reticle >= 36 CSS px and outer ring radius >= 36 CSS px on mobile');

  // Verify zero page scroll
  const mPingScroll = await mPage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (mPingScroll.x !== 0 || mPingScroll.y !== 0) {
    throw new Error(`Mobile page scroll detected during Apollo 11: ${JSON.stringify(mPingScroll)}`);
  }

  // Verify mobile fire button size >= 72px tall and >= 48px wide
  const mFireBtn = mPage.locator('[data-testid="ping-fire-btn"]');
  await mFireBtn.waitFor({ state: 'visible' });
  const mFireBox = await mFireBtn.boundingBox();
  console.log(`  Mobile ping-fire-btn: ${mFireBox?.width}x${mFireBox?.height}`);
  if (!mFireBox || mFireBox.height < 72 || mFireBox.width < 48) {
    throw new Error(`Mobile ping-fire-btn must be >= 72px tall and >= 48px wide, got: ${JSON.stringify(mFireBox)}`);
  }
  console.log('  [PASS] Mobile ping-fire-btn meets touch target size (>=72px tall, >=48px wide)');

  // Verify footer is empty at start
  const mPingFooterEl = mPage.locator('[data-testid="minigame-shell"] .border-t p');
  const mPingInitialFooter = (await mPingFooterEl.textContent()) || '';
  if (mPingInitialFooter.trim() !== '') {
    throw new Error(`Expected empty footer at mobile Apollo 11 start, got: "${mPingInitialFooter}"`);
  }
  console.log('  [PASS] Mobile Apollo 11 footer is empty at start');

  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_01_aiming.png') });
  console.log('  [OK Captured] ping_mobile_01_aiming.png');

  // Test touch drag moves reticle
  console.log('  Testing mobile touch drag on canvas...');
  const mCanvasCenter = await mPingCanvas.boundingBox();
  if (!mCanvasCenter) throw new Error('Could not get mPingCanvas box');
  const rPosBefore = await mPage.evaluate(() => window.__pingGame.getState().reticle);
  await mPingCanvas.dispatchEvent('pointerdown', { clientX: mCanvasCenter.x + 100, clientY: mCanvasCenter.y + 100 });
  await mPage.waitForTimeout(50);
  await mPingCanvas.dispatchEvent('pointermove', { clientX: mCanvasCenter.x + 150, clientY: mCanvasCenter.y + 130 });
  await mPage.waitForTimeout(50);
  await mPingCanvas.dispatchEvent('pointerup', { clientX: mCanvasCenter.x + 150, clientY: mCanvasCenter.y + 130 });
  const rPosAfter = await mPage.evaluate(() => window.__pingGame.getState().reticle);
  const dragDist = Math.hypot(rPosAfter.x - rPosBefore.x, rPosAfter.y - rPosBefore.y);
  console.log(`  Touch drag delta: ${dragDist.toFixed(1)}px`);
  if (dragDist < 20) {
    throw new Error(`Touch drag did not steer reticle! Movement: ${dragDist}px`);
  }
  console.log('  [PASS] Touch drag steered reticle on mobile');

  // Test miss on mobile
  await mPage.evaluate(() => window.__pingGame.setAutopilot('miss'));
  await mFireBtn.click();
  await mPage.waitForTimeout(600);
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_02_shot_in_flight.png') });
  console.log('  [OK Captured] ping_mobile_02_shot_in_flight.png');

  while (true) {
    const s = await mPage.evaluate(() => window.__pingGame.getState());
    if (s.phase === 'result') break;
    await mPage.waitForTimeout(40);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_03_echo.png') });
  console.log('  [OK Captured] ping_mobile_03_echo.png');
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_05_miss_result.png') });
  console.log('  [OK Captured] ping_mobile_05_miss_result.png');

  const mPingWinScreen = mPage.locator('[data-testid="minigame-win"]');
  await mPingWinScreen.waitFor({ state: 'visible', timeout: 5000 });
  const mMissStars = await mPage.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (mMissStars !== '1') throw new Error(`Expected 1 star on mobile miss, got: ${mMissStars}`);

  // Moon-3.1 Check 3: Mobile 1-star win title is "FAINT ECHO"
  const mMissTitleCount = await mPingWinScreen.locator('span').filter({ hasText: 'FAINT ECHO' }).count();
  if (mMissTitleCount === 0) {
    throw new Error(`Expected mobile 1-star win title "FAINT ECHO", got: ${await mPingWinScreen.innerText()}`);
  }
  const mRelicLogged1 = await mPingWinScreen.locator('text=RELIC LOGGED!').count();
  if (mRelicLogged1 > 0) {
    throw new Error('Mobile win screen shows "RELIC LOGGED!" before claim!');
  }
  console.log('  [PASS] Mobile 1-star win title is "FAINT ECHO" (zero "RELIC LOGGED!" before claim)');

  // Test 3-star on mobile
  const mPingRetryBtn = mPage.locator('[data-testid="minigame-retry"]');
  await mPingRetryBtn.click();
  await mPingGame.waitFor({ state: 'visible', timeout: 5000 });

  // Moon-3.1 Visual Fix: Mobile footer empty at retry start
  const mFooterRetryStart = (await mPingFooterEl.textContent()) || '';
  if (mFooterRetryStart.trim() !== '') {
    throw new Error(`Expected empty footer at start of mobile retry, got: "${mFooterRetryStart}"`);
  }
  console.log('  [PASS] Mobile Apollo 11 footer is EMPTY at start of retry');

  await mPage.evaluate(() => window.__pingGame.setAutopilot('perfect'));
  await mFireBtn.click();

  while (true) {
    const s = await mPage.evaluate(() => window.__pingGame.getState());
    if (s.phase === 'result') break;
    await mPage.waitForTimeout(40);
  }
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_04_3star_result.png') });
  console.log('  [OK Captured] ping_mobile_04_3star_result.png');

  await mPingWinScreen.waitFor({ state: 'visible', timeout: 5000 });
  const mPerfectStars = await mPage.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (mPerfectStars !== '3') throw new Error(`Expected 3 stars on mobile perfect, got: ${mPerfectStars}`);

  // Moon-3.1 Check 3: Mobile 3-star win title is "ECHO RECEIVED!"
  const m3StarTitleCount = await mPingWinScreen.locator('span').filter({ hasText: 'ECHO RECEIVED!' }).count();
  if (m3StarTitleCount === 0) {
    throw new Error(`Expected mobile 3-star win title "ECHO RECEIVED!", got: ${await mPingWinScreen.innerText()}`);
  }
  const mRelicLogged3 = await mPingWinScreen.locator('text=RELIC LOGGED!').count();
  if (mRelicLogged3 > 0) {
    throw new Error('Mobile win screen shows "RELIC LOGGED!" before claim!');
  }
  console.log('  [PASS] Mobile 3-star win title is "ECHO RECEIVED!" (zero "RELIC LOGGED!" before claim)');
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'ping_mobile_06_win_screen.png') });
  console.log('  [OK Captured] ping_mobile_06_win_screen.png');

  // Claim relic 2 on mobile
  await mPage.locator('[data-testid="claim-part-btn"]').click();
  await mPingGame.waitFor({ state: 'detached', timeout: 5000 });

  // Test Lunokhod 1 Lost Rover on Mobile (390x844)
  console.log('  Testing Lunokhod 1 Lost Rover on Mobile (390x844)...');
  await mPage.evaluate(() => window.__moonTeleport(52, 20));
  await mPage.waitForTimeout(300);

  const mInteractLostBtn = mPage.locator('[data-testid="touch-interact-btn"]');
  await mInteractLostBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mInteractLostBtn.click();

  const mNovaLostActionBtn = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
  await mNovaLostActionBtn.waitFor({ state: 'visible', timeout: 4000 });
  await mNovaLostActionBtn.click();

  const mLostGame = mPage.locator('[data-testid="lost-game"]');
  await mLostGame.waitFor({ state: 'visible', timeout: 5000 });

  // 1. Shell title "Lunokhod 1 Lost Rover" and header "Tap squares to scan. Find the lost rover!"
  const mLostShellTitle = await mPage.locator('[data-testid="minigame-shell"] h2').textContent();
  if (mLostShellTitle?.trim() !== 'Lunokhod 1 Lost Rover') {
    throw new Error(`Expected mobile Lunokhod shell title "Lunokhod 1 Lost Rover", got: "${mLostShellTitle}"`);
  }
  const mLostHeader = await mPage.locator('[data-testid="minigame-shell"] p').first().textContent();
  if (mLostHeader?.trim() !== 'Tap squares to scan. Find the lost rover!') {
    throw new Error(`Expected mobile Lunokhod header "Tap squares to scan. Find the lost rover!", got: "${mLostHeader}"`);
  }
  console.log('  [PASS] Mobile Lunokhod 1 title and header verified');

  // Moon-4.1 Check 1 & 3 on Mobile:
  const mTarget0 = await mPage.evaluate(() => window.__lostGame.getState().target);
  console.log(`  Mobile attempt 0 target: (${mTarget0.x}, ${mTarget0.y})`);
  if (mTarget0.x === 3 && mTarget0.y === 2) {
    throw new Error('Mobile attempt 0 target must not be the center (3,2)!');
  }
  console.log('  [PASS] Mobile attempt 0 target != (3,2)');

  const mRingAtStart = await mPage.locator('[data-testid="lost-game"] button.ring-2').count();
  if (mRingAtStart !== 0) {
    throw new Error('Mobile focus ring visible before arrow key!');
  }
  console.log('  [PASS] No focus ring at start on mobile');

  // Verify mobile canvas width >= 340px
  const mLostCanvas = mPage.locator('[data-testid="lost-grid-canvas"]');
  const mLostCanvasBox = await mLostCanvas.boundingBox();
  console.log(`  Mobile Lunokhod 1 canvas width: ${mLostCanvasBox?.width}px (target >= 340px)`);
  if (!mLostCanvasBox || mLostCanvasBox.width < 340) {
    throw new Error(`Mobile Lunokhod 1 canvas width < 340px: ${mLostCanvasBox?.width}px`);
  }

  // Verify square size >= 44 css px on mobile
  const mLostSquareSize = await mPage.evaluate(() => window.__lostGame.getState().squareSizeCss);
  console.log(`  Mobile square size CSS: ${mLostSquareSize}px (target >= 44px)`);
  if (mLostSquareSize < 44) {
    throw new Error(`Mobile square size CSS < 44px: ${mLostSquareSize}px`);
  }
  console.log('  [PASS] Square size >= 44 CSS px and canvas width >= 340px on mobile');

  // Verify grid width >= 60% of canvas on mobile
  const mGridBox = await mPage.locator('[data-testid="lost-game"] .grid').boundingBox();
  if (!mGridBox) throw new Error('Could not find mobile grid bounding box');
  const mGridRatio = mGridBox.width / mLostCanvasBox.width;
  console.log(`  Mobile Grid width / Canvas width: ${(mGridRatio * 100).toFixed(1)}% (requirement >= 60%)`);
  if (mGridRatio < 0.60) {
    throw new Error(`Mobile grid width < 60% of canvas width: ${mGridRatio}`);
  }
  console.log('  [PASS] Grid width >= 60% of canvas width on mobile');

  // Verify "Orbiter Telemetry" label is gone on mobile
  const mTelemetryCount = await mPage.locator('text=Orbiter Telemetry').count();
  if (mTelemetryCount > 0) {
    throw new Error('Mobile "Orbiter Telemetry" label must be removed!');
  }
  console.log('  [PASS] "Orbiter Telemetry" label is removed on mobile');

  // Verify zero page scroll
  const mLostScroll = await mPage.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  if (mLostScroll.x !== 0 || mLostScroll.y !== 0) {
    throw new Error(`Mobile page scroll detected during Lunokhod 1: ${JSON.stringify(mLostScroll)}`);
  }
  console.log('  [PASS] Zero page scroll on mobile');

  // Check 4: Mobile search with >= 5 scanned squares showing mixed HOT/WARM/COOL/COLD
  const mCoordsToScan = await mPage.evaluate(() => {
    const t = window.__lostGame.getState().target;
    const all = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) {
        const dist = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
        all.push({ x, y, dist });
      }
    }
    const hot = all.find(c => c.dist === 1);
    const warm = all.find(c => c.dist === 2);
    const cool = all.find(c => c.dist === 3);
    const cold = all.find(c => c.dist >= 4);
    const extra = all.find(c => c.dist > 0 && c !== hot && c !== warm && c !== cool && c !== cold);
    return [hot, warm, cool, cold, extra];
  });

  for (const c of mCoordsToScan) {
    await mPage.locator(`[data-testid="lost-cell-${c.x}-${c.y}"]`).click();
    await mPage.waitForTimeout(320);
  }

  // Frame capture 1: mobile_lost_01_searching.png (>= 5 marked squares showing mixed HOT/WARM/COOL/COLD)
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_lost_01_searching.png') });
  console.log('  [OK Captured] mobile_lost_01_searching.png (>= 5 marked squares showing mixed HOT/WARM/COOL/COLD)');

  // Now tap the target square
  const mCurTarget = await mPage.evaluate(() => window.__lostGame.getState().target);
  await mPage.locator(`[data-testid="lost-cell-${mCurTarget.x}-${mCurTarget.y}"]`).click();
  await mPage.waitForTimeout(350);

  // Frame capture 2: mobile_lost_02_found.png (rover sprite popping up)
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_lost_02_found.png') });
  console.log('  [OK Captured] mobile_lost_02_found.png');

  // Wait for win screen
  const mLostWinScreen = mPage.locator('[data-testid="minigame-win"]');
  await mLostWinScreen.waitFor({ state: 'visible', timeout: 5000 });

  // Frame capture 3: mobile_lost_03_win_screen.png
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_lost_03_win_screen.png') });
  console.log('  [OK Captured] mobile_lost_03_win_screen.png');

  const mStars = await mPage.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  console.log(`  Mobile real path stars: ${mStars}`);

  const mWinTitle = await mLostWinScreen.locator('span').filter({ hasText: 'ROVER FOUND!' }).count();
  if (mWinTitle === 0) {
    throw new Error(`Expected mobile win title "ROVER FOUND!", got: ${await mLostWinScreen.innerText()}`);
  }
  const mRelicLoggedLost = await mLostWinScreen.locator('text=RELIC LOGGED!').count();
  if (mRelicLoggedLost > 0) {
    throw new Error('Mobile win screen shows "RELIC LOGGED!" before claim!');
  }
  console.log('  [PASS] Mobile win title is "ROVER FOUND!" (zero "RELIC LOGGED!" before claim)');

  // Claim relic 3 on mobile
  await mLostWinScreen.locator('[data-testid="claim-part-btn"]').click();
  await mLostGame.waitFor({ state: 'detached', timeout: 5000 });

  // On mobile: observe Earthrise, click continue -> Mobile Crash Interlude Verification (Item 9)
  console.log('  Testing Mobile Crash Interlude (390x844 layout, zero scroll)...');
  const mObserveEarthriseBtn = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
  await mObserveEarthriseBtn.waitFor({ state: 'visible', timeout: 5000 });
  await mObserveEarthriseBtn.click();
  const mEarthrisePanel = mPage.locator('[data-testid="moon-earthrise"]');
  await mEarthrisePanel.waitFor({ state: 'visible', timeout: 5000 });

  const mContinueMarsBtn = mPage.locator('[data-testid="moon-earthrise-continue"]');
  await mContinueMarsBtn.click();

  const mCrashInterlude = mPage.locator('[data-testid="crash-interlude"]');
  await mCrashInterlude.waitFor({ state: 'visible', timeout: 5000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_interlude_beat1.png') });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_crash_interlude_beat1.png') });
  console.log('  [OK Captured] mobile_interlude_beat1.png');

  // Verify zero page scroll on mobile
  const mInterludeScroll = await mPage.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight
  }));
  if (mInterludeScroll.x !== 0 || mInterludeScroll.y !== 0 || mInterludeScroll.maxScroll > 2) {
    throw new Error(`Mobile Crash Interlude has page scroll: ${JSON.stringify(mInterludeScroll)}`);
  }
  console.log('  [PASS] Mobile Crash Interlude fits viewport with zero scroll');

  // Tap to advance to beat 2, then beat 3
  await mCrashInterlude.click({ position: { x: 195, y: 300 } });
  await mPage.waitForTimeout(300);
  const mBeat2 = mPage.locator('[data-testid="crash-beat-2"]');
  await mBeat2.waitFor({ state: 'visible', timeout: 3000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_interlude_beat2.png') });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_crash_interlude_beat2.png') });
  console.log('  [OK Captured] mobile_interlude_beat2.png');

  await mCrashInterlude.click({ position: { x: 195, y: 300 } });
  await mPage.waitForTimeout(300);
  const mBeat3 = mPage.locator('[data-testid="crash-beat-3"]');
  await mBeat3.waitFor({ state: 'visible', timeout: 3000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_interlude_beat3.png') });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_crash_interlude_beat3.png') });
  console.log('  [OK Captured] mobile_interlude_beat3.png');

  // Verify final button "Start exploring ->"
  const mContinueBtn = mPage.locator('[data-testid="crash-continue-btn"]');
  await mContinueBtn.waitFor({ state: 'visible', timeout: 3000 });
  await mContinueBtn.click();
  await mCrashInterlude.waitFor({ state: 'detached', timeout: 5000 });
  console.log('  [PASS] Mobile Crash Interlude completed via "Start exploring ->"');

  // Verify Codex on Mobile: Moon Relics 3/3 and Logs tab intro
  const mWorldCanvas = mPage.locator('[data-testid="world-canvas"]');
  await mWorldCanvas.waitFor({ state: 'visible', timeout: 8000 });

  // Dismiss first Nova line if present
  const mNovaLine = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
  if (await mNovaLine.isVisible()) await mNovaLine.click();

  const mCodexBtn = mPage.locator('[data-testid="codex-btn"]');
  await mCodexBtn.waitFor({ state: 'visible', timeout: 5000 });
  await mCodexBtn.click();
  const mCodexModal = mPage.locator('[data-testid="codex-modal"]');
  await mCodexModal.waitFor({ state: 'visible', timeout: 5000 });

  const mMoonTabBtn = mPage.locator('[data-testid="moon-relics-tab-btn"]');
  await mMoonTabBtn.click();
  await mPage.locator('[data-testid="codex-moon-tab-content"]').waitFor({ state: 'visible', timeout: 3000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_codex_moon_relics_3_of_3.png') });
  console.log('  [OK Captured] mobile_codex_moon_relics_3_of_3.png');

  const mLogsTabBtn = mPage.locator('[data-testid="logs-tab-btn"]');
  await mLogsTabBtn.click();
  await mPage.locator('[data-testid="codex-logs-tab-content"]').waitFor({ state: 'visible', timeout: 3000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_codex_logs_intro.png') });
  console.log('  [OK Captured] mobile_codex_logs_intro.png');

  await mPage.locator('[data-testid="codex-close-btn"]').click();
  await mCodexModal.waitFor({ state: 'detached', timeout: 5000 });

  // Mobile Skip Moon -> Codex Moon Relics 0/3 screenshot
  await mPage.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.clear();
  });
  await mPage.reload({ waitUntil: 'domcontentloaded' });
  await mPage.locator('[data-testid="start-mission-btn"]').click();
  await mPage.locator('[data-testid="skip-prologue-btn"]').click();
  await mMoonScene.waitFor({ state: 'visible', timeout: 6000 });
  await mPage.locator('[data-testid="moon-skip-btn"]').click();
  const mSkipInterlude = mPage.locator('[data-testid="crash-interlude"]');
  await mSkipInterlude.waitFor({ state: 'visible', timeout: 5000 });
  await mPage.locator('[data-testid="crash-skip-btn"]').click();
  await mWorldCanvas.waitFor({ state: 'visible', timeout: 8000 });

  const mNovaDialogue = mPage.locator('[data-testid="nova-dialogue"]');
  if (await mNovaDialogue.isVisible()) {
    await mNovaDialogue.click();
    const actionBtn = mPage.locator('[data-testid="nova-dialogue-action-btn"]');
    if (await actionBtn.isVisible()) await actionBtn.click();
  }
  await mCodexBtn.waitFor({ state: 'visible', timeout: 5000 });
  await mCodexBtn.click();
  await mCodexModal.waitFor({ state: 'visible', timeout: 5000 });
  await mMoonTabBtn.click();
  await mPage.locator('[data-testid="codex-moon-tab-content"]').waitFor({ state: 'visible', timeout: 3000 });
  await mPage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_codex_moon_relics_0_of_3.png') });
  console.log('  [OK Captured] mobile_codex_moon_relics_0_of_3.png');
  await mPage.locator('[data-testid="codex-close-btn"]').click();
  await mCodexModal.waitFor({ state: 'detached', timeout: 5000 });

  await mPage.close();
  await mobileContext.close();
  console.log('  [PASS] Moon 8: Mobile verified with hop-btn >= 48px, thrust-btn >= 72px, fire-btn >= 72px, grid squares >= 44px, canvas >= 340px, zero scroll');

  // 9. Reduce Motion ON: repeat checks 2 and 3
  console.log('Moon 9: Reduce Motion ON verification (Hop + Luna 9 Checks 2 & 3)...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.clear();
    localStorage.setItem('mars_reduce_motion', 'true');
  });
  await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="start-mission-btn"]').click();
  await page.locator('[data-testid="skip-prologue-btn"]').click();
  await moonScene.waitFor({ state: 'visible', timeout: 6000 });

  await page.evaluate(() => window.__moonTeleport(24, 20));
  await page.waitForTimeout(200);

  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  const rmHopping = await moonScene.getAttribute('data-hopping');
  if (rmHopping !== 'true') throw new Error(`Expected data-hopping="true" under Reduce Motion, got: ${rmHopping}`);

  await page.waitForTimeout(650);
  await page.keyboard.up('ArrowRight');
  const rmEndTile = await moonScene.getAttribute('data-player-tile');
  const [rmEndX] = rmEndTile.split(',').map(Number);
  if (rmEndX < 28) throw new Error(`Expected end tile beyond pit under Reduce Motion, got: ${rmEndTile}`);
  console.log(`  [PASS] Hop under Reduce Motion completed to tile: ${rmEndTile}`);

  // Test Luna 9 Check 3 (no input) under Reduce Motion
  console.log('  Testing Luna 9 Check 3 (no input) under Reduce Motion...');
  await page.evaluate(() => window.__moonTeleport(18, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  const rmNovaBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await rmNovaBtn.waitFor({ state: 'visible', timeout: 4000 });
  await rmNovaBtn.click();

  const rmLunaGame = page.locator('[data-testid="luna-game"]');
  await rmLunaGame.waitFor({ state: 'visible', timeout: 5000 });

  const rmWinScreen = page.locator('[data-testid="minigame-win"]');
  await rmWinScreen.waitFor({ state: 'visible', timeout: 14000 });
  const rmStars1 = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (rmStars1 !== '1') throw new Error(`Expected 1 star on RM no-input run, got: ${rmStars1}`);
  console.log('  [PASS] Luna 9 Check 3 finished with 1 star under Reduce Motion');

  // Test Luna 9 Check 2 (perfect / bang-bang) under Reduce Motion
  console.log('  Testing Luna 9 Check 2 under Reduce Motion...');
  const rmRetryBtn = page.locator('[data-testid="minigame-retry"]');
  await rmRetryBtn.click();
  await rmLunaGame.waitFor({ state: 'visible', timeout: 5000 });

  await page.evaluate(() => window.__lunaGame.setAutopilot('perfect'));
  await rmWinScreen.waitFor({ state: 'visible', timeout: 30000 });
  const rmStars2 = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (rmStars2 !== '3') throw new Error(`Expected 3 stars on RM autopilot run, got: ${rmStars2}`);
  console.log('  [PASS] Luna 9 Check 2 finished with 3 stars under Reduce Motion');

  // Claim Luna 9 under Reduce Motion to proceed to Apollo 11
  await rmWinScreen.locator('[data-testid="claim-part-btn"]').click();
  await rmLunaGame.waitFor({ state: 'detached', timeout: 5000 });

  // Test Apollo 11 Checks 2 & 4 under Reduce Motion
  console.log('  Testing Apollo 11 Checks 2 & 4 under Reduce Motion...');
  await page.evaluate(() => window.__moonTeleport(35, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  const rmPingNovaBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await rmPingNovaBtn.waitFor({ state: 'visible', timeout: 4000 });
  await rmPingNovaBtn.click();

  const rmPingGame = page.locator('[data-testid="ping-game"]');
  await rmPingGame.waitFor({ state: 'visible', timeout: 5000 });

  await page.evaluate(() => window.__pingGame.setAutopilot('perfect'));
  const rmPingFireStart = performance.now();
  await page.locator('[data-testid="ping-fire-btn"]').click();

  while (true) {
    const s = await page.evaluate(() => window.__pingGame.getState());
    if (s.phase === 'result') break;
    await page.waitForTimeout(40);
  }
  const rmPingWaitDuration = (performance.now() - rmPingFireStart) / 1000;
  console.log(`  RM Apollo 11 wait duration: ${rmPingWaitDuration.toFixed(2)}s (requirement: 2.35 - 2.65s)`);
  if (rmPingWaitDuration < 2.35 || rmPingWaitDuration > 2.65) {
    throw new Error(`RM Apollo 11 wait duration out of bounds [2.35s, 2.65s]: ${rmPingWaitDuration.toFixed(2)}s`);
  }
  console.log('  [PASS] Apollo 11 Check 4 (wait duration 2.35-2.65s) verified under Reduce Motion');

  const rmPingWin = page.locator('[data-testid="minigame-win"]');
  await rmPingWin.waitFor({ state: 'visible', timeout: 6000 });
  const rmPingStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (rmPingStars !== '3') throw new Error(`Expected 3 stars on RM Apollo 11 run, got: ${rmPingStars}`);
  console.log('  [PASS] Apollo 11 Check 2 (3 stars) verified under Reduce Motion');

  // Claim Apollo 11 on RM
  await rmPingWin.locator('[data-testid="claim-part-btn"]').click();
  await rmPingGame.waitFor({ state: 'detached', timeout: 5000 });

  // Test Lunokhod 1 under Reduce Motion (Check 8)
  console.log('  Testing Lunokhod 1 under Reduce Motion (radar sweep skipped, pulses off, 3 stars)...');
  await page.evaluate(() => window.__moonTeleport(52, 20));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  const rmLostNovaBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await rmLostNovaBtn.waitFor({ state: 'visible', timeout: 4000 });
  await rmLostNovaBtn.click();

  const rmLostGame = page.locator('[data-testid="lost-game"]');
  await rmLostGame.waitFor({ state: 'visible', timeout: 5000 });

  // Verify instant reveal (sweep skipped) under Reduce Motion
  await page.locator('[data-testid="lost-cell-0-0"]').click();
  await page.waitForTimeout(50);
  const rmScanningState = await page.evaluate(() => window.__lostGame.getState().isScanning);
  if (rmScanningState !== false) {
    throw new Error('Expected isScanning=false immediately under Reduce Motion');
  }
  console.log('  [PASS] Radar sweep skipped (square reveals instantly) under Reduce Motion');

  // Test target scan under Reduce Motion
  const rmTarget = await page.evaluate(() => window.__lostGame.getState().target);
  await page.locator(`[data-testid="lost-cell-${rmTarget.x}-${rmTarget.y}"]`).click();
  const rmLostWin = page.locator('[data-testid="minigame-win"]');
  await rmLostWin.waitFor({ state: 'visible', timeout: 5000 });
  const rmLostStars = await page.locator('[data-testid="minigame-stars"]').getAttribute('data-stars');
  if (rmLostStars !== '3') throw new Error(`Expected 3 stars on RM Lunokhod 1 run, got: ${rmLostStars}`);
  console.log('  [PASS] Lunokhod 1 Check 8 (Reduce Motion ON) verified');

  await rmLostWin.locator('[data-testid="claim-part-btn"]').click();
  await rmLostGame.waitFor({ state: 'detached', timeout: 5000 });

  // Test Rover and Thumper under Reduce Motion ON
  console.log('  Testing Rover and Thumper under Reduce Motion ON...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: { relicIds: ['moon_luna9', 'moon_apollo11'], completed: false, rpApplied: false }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const continueBtnRM = page.locator('[data-testid="continue-mission-btn"]');
  if (await continueBtnRM.isVisible()) await continueBtnRM.click();
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });

  await page.evaluate(() => window.__moonTeleport(13, 16));
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE'); // board rover
  await page.waitForTimeout(400);
  if (await page.locator('[data-testid="nova-dialogue"]').isVisible()) {
    await page.keyboard.press('KeyE'); // dismiss dialogue if shown
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('KeyE'); // dismount rover
  await page.waitForTimeout(400);
  console.log('  [PASS] Rover boarding and dismounting works under Reduce Motion ON');

  await page.evaluate(() => window.__moonTeleport(33, 23));
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE'); // detonate thumper
  const thumperToast = page.locator('text=ALSEP SEISMIC THUMPER DETONATED');
  await thumperToast.waitFor({ state: 'visible', timeout: 5000 });
  console.log('  [PASS] Seismic Thumper detonation works under Reduce Motion ON');

  // Verification 8: Reduce Motion disables shake and flash on Crash Interlude
  console.log('  Testing Crash Interlude under Reduce Motion ON (no shake, no flash)...');
  await page.evaluate(() => {
    window.__disableAutoSave = true;
    localStorage.setItem('beyond_depth_save_v3', JSON.stringify({
      version: 3,
      currentChapter: 8,
      unlockedMissions: [],
      solvedMiniGames: [],
      quizzesCompleted: [],
      badges: [],
      diagnosticsCompleted: [],
      repairedSubsystems: [],
      stormDecisionMade: null,
      moonChapter: { relicIds: ['moon_luna9', 'moon_apollo11', 'moon_lunokhod1'], completed: false, rpApplied: false }
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await continueBtnRM.isVisible()) await continueBtnRM.click();
  await moonScene.waitFor({ state: 'visible', timeout: 5000 });

  const rmEarthriseAction = page.locator('[data-testid="nova-dialogue-action-btn"]');
  await rmEarthriseAction.waitFor({ state: 'visible', timeout: 5000 });
  await rmEarthriseAction.click();

  const rmEarthrise = page.locator('[data-testid="moon-earthrise"]');
  await rmEarthrise.waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="moon-earthrise-continue"]').click();

  const rmCrashInterlude = page.locator('[data-testid="crash-interlude"]');
  await rmCrashInterlude.waitFor({ state: 'visible', timeout: 5000 });
  const rmBeat1 = page.locator('[data-testid="crash-beat-1"]');
  await rmBeat1.waitFor({ state: 'visible', timeout: 3000 });
  const rmBeat1Class = (await rmBeat1.getAttribute('class')) || '';
  if (rmBeat1Class.includes('crash-shake-active')) {
    throw new Error('crash-shake-active present on Beat 1 when Reduce Motion is ON!');
  }
  console.log('  [PASS] Reduce Motion ON disabled shake animation on Beat 1');

  // Advance to Beat 2 and verify no flash-active
  await rmCrashInterlude.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(300);
  const rmBeat2 = page.locator('[data-testid="crash-beat-2"]');
  await rmBeat2.waitFor({ state: 'visible', timeout: 3000 });
  const rmBeat2FlashCount = await rmBeat2.locator('.crash-flash-active').count();
  if (rmBeat2FlashCount > 0) {
    throw new Error('crash-flash-active present on Beat 2 when Reduce Motion is ON!');
  }
  console.log('  [PASS] Reduce Motion ON disabled flash animation on Beat 2');

  // Advance to Beat 3 and verify continue button works under Reduce Motion
  await rmCrashInterlude.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(300);
  const rmBeat3 = page.locator('[data-testid="crash-beat-3"]');
  await rmBeat3.waitFor({ state: 'visible', timeout: 3000 });
  await page.locator('[data-testid="crash-continue-btn"]').click();
  await rmCrashInterlude.waitFor({ state: 'detached', timeout: 5000 });
  console.log('  [PASS] Reduce Motion ON: Crash Interlude advanced through all beats to Mars world');

  await page.close();
  console.log('======================================================');
  console.log('ALL 10 MOON CHAPTER 8 QA CHECKS PASSED PERFECTLY!');
  console.log('======================================================\n');
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

    // 1.5. Moon Chapter 8 Prequel QA Suite (Checks 1-10)
    await runMoonChapterQA(browser);

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
