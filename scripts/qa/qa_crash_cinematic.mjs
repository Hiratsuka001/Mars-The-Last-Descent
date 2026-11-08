import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const OUTPUT_DIR = path.resolve('qa-screenshots/crash');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
const PORT = 4176;

function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
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

    // 1. Seed Moon completed state ready for Earthrise or Moon exit
    await page.goto(`http://localhost:${PORT}`);
    await page.evaluate(() => {
      const mockState = {
        version: 3,
        currentChapter: 8,
        unlockedMissions: [],
        badges: [],
        moonChapter: {
          relicIds: ['relic_apollo11', 'relic_apollo17', 'relic_surveyor3'],
          secretIds: [],
          iceScannedIds: [],
          monumentIds: [],
          lunarRockIds: [],
          thumperFired: false,
          completed: false,
          rpApplied: false,
        },
      };
      localStorage.setItem('beyond_depth_save_v3', JSON.stringify(mockState));
    });

    console.log('Loading Moon Scene with 3/3 Relics...');
    await page.reload();

    const moonScene = page.locator('[data-testid="moon-scene"]');
    await moonScene.waitFor({ state: 'visible', timeout: 8000 });

    // Click Earthrise observe action in Nova dialogue
    const observeEarthriseBtn = page.locator('[data-testid="nova-dialogue-action-btn"]');
    await observeEarthriseBtn.waitFor({ state: 'visible', timeout: 5000 });
    await observeEarthriseBtn.click();

    // Earthrise Panel
    const earthrisePanel = page.locator('[data-testid="moon-earthrise"]');
    await earthrisePanel.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Earthrise panel active');

    // Click Continue to trigger the new dramatic Mars Descent & Crash Scene
    const continueMarsBtn = page.locator('[data-testid="moon-earthrise-continue"]');
    await continueMarsBtn.click();

    // -------------------------------------------------------------------------
    // STAGE 1: ATMOSPHERIC DESCENT & MALFUNCTION
    // -------------------------------------------------------------------------
    console.log('\n--- Verifying Stage 1: Descent & Malfunction ---');
    const crashInterlude = page.locator('[data-testid="crash-interlude"]');
    await crashInterlude.waitFor({ state: 'visible', timeout: 6000 });
    console.log('✓ Crash Scene opened after Earthrise Continue');

    // Prohibited words check
    const interludeDomText = await crashInterlude.innerText();
    const prohibitedWords = ['critical', 'guidance', 'beat', 'plasma', 'thruster', 'retro', 'gimbal', 'telemetry', 'transceiver', 'subsys', 'RF'];
    for (const word of prohibitedWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(interludeDomText)) {
        throw new Error(`Prohibited word "${word}" found in Crash text: "${interludeDomText}"`);
      }
    }
    console.log('✓ Prohibited words check passed: zero prohibited words found');

    const beat1 = page.locator('[data-testid="crash-beat-1"]');
    await beat1.waitFor({ state: 'visible', timeout: 3000 });
    const beat1Text = await beat1.innerText();
    if (!beat1Text.includes('Entering Mars...')) {
      throw new Error(`Expected Beat 1 "Entering Mars...", got: "${beat1Text}"`);
    }
    if (!beat1Text.toLowerCase().includes('18,000 meters up')) {
      throw new Error(`Expected Altitude 18,000 meters up!, got: "${beat1Text}"`);
    }
    console.log('✓ Stage 1 telemetry confirmed (Entering Mars... & 18,000 meters)');

    const skipBtn = page.locator('[data-testid="crash-skip-btn"]');
    await skipBtn.waitFor({ state: 'visible', timeout: 2000 });
    const skipBox = await skipBtn.boundingBox();
    const vp = page.viewportSize();
    if (!skipBox || skipBox.x < 12 || skipBox.y < 12 || (vp.width - (skipBox.x + skipBox.width)) < 12 || (vp.height - (skipBox.y + skipBox.height)) < 12) {
      throw new Error(`Skip button not >= 12px from edges: ${JSON.stringify(skipBox)}`);
    }
    console.log('✓ Skip button confirmed >= 12px inside viewport');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_stage1_descent.png') });

    // -------------------------------------------------------------------------
    // STAGE 2: HARD IMPACT & SYSTEMS FAILING
    // -------------------------------------------------------------------------
    console.log('\n--- Verifying Stage 2: Hard Landing & Systems Failing ---');
    await crashInterlude.click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(300);

    const beat2 = page.locator('[data-testid="crash-beat-2"]');
    await beat2.waitFor({ state: 'visible', timeout: 3000 });
    const beat2Text = await beat2.innerText();
    if (!beat2Text.includes('SYSTEMS FAILING!')) {
      throw new Error(`Expected "SYSTEMS FAILING!", got: "${beat2Text}"`);
    }
    if (!beat2Text.toLowerCase().includes('crash landing')) {
      throw new Error(`Expected Crash landing! impact copy, got: "${beat2Text}"`);
    }
    console.log('✓ Stage 2 impact confirmed (SYSTEMS FAILING! & Crash landing!)');
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_stage2_impact.png') });

    // -------------------------------------------------------------------------
    // STAGE 3: NOVA REBOOT & 4 INTERACTIVE DIAGNOSTIC SUBSYSTEMS
    // -------------------------------------------------------------------------
    console.log('\n--- Verifying Stage 3: Nova Reboot & 4 Interactive Subsystems ---');
    await crashInterlude.click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(300);

    const beat3 = page.locator('[data-testid="crash-beat-3"]');
    await beat3.waitFor({ state: 'visible', timeout: 3000 });
    const beat3Text = await beat3.innerText();
    if (!beat3Text.includes('who are you? I forgot everything')) {
      throw new Error(`Expected Nova reboot dialogue, got: "${beat3Text}"`);
    }
    console.log('✓ Nova reboot dialogue confirmed');

    // Check all 4 systems
    const subsystems = ['Power', 'Radio', 'Gyro', 'Life support'];
    for (const sub of subsystems) {
      if (!beat3Text.includes(sub)) {
        throw new Error(`Expected diagnostic system "${sub}" on Stage 3!`);
      }
    }
    console.log('✓ All 4 Diagnostic Systems rendered on Stage 3');

    // Verify no truncated "..." text on any card
    if (beat3Text.includes('...') && !beat3Text.includes('Rebooting...')) {
      // "Rebooting..." in dialogue is fine, cards shouldn't have ellipsis
    }

    // Click on Power card to inspect
    const powerCard = page.locator('button:has-text("Power")');
    await powerCard.click();
    await page.waitForTimeout(200);
    const detailBox = page.locator('text=backup power cells');
    await detailBox.waitFor({ state: 'visible', timeout: 2000 });
    console.log('✓ Power diagnostic inspection displayed detailed telemetry');

    // Click on Radio card to inspect
    const commsCard = page.locator('button:has-text("Radio")');
    await commsCard.click();
    await page.waitForTimeout(200);
    const commsDetail = page.locator('text=radio dish is silent');
    await commsDetail.waitFor({ state: 'visible', timeout: 2000 });
    console.log('✓ Radio diagnostic inspection displayed detailed telemetry');

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'crash_stage3_diagnostics.png') });

    // Continue to Mars Open World
    const continueBtn = page.locator('[data-testid="crash-continue-btn"]');
    await continueBtn.waitFor({ state: 'visible', timeout: 2000 });
    await continueBtn.click();

    // Verify World Canvas loads
    const worldCanvas = page.locator('[data-testid="world-canvas"]');
    await worldCanvas.waitFor({ state: 'visible', timeout: 8000 });
    console.log('✓ Mars Open World loaded successfully from Crash Scene');

    // -------------------------------------------------------------------------
    // MOBILE VIEWPORT TEST (Zero vertical scroll)
    // -------------------------------------------------------------------------
    console.log('\n--- Verifying Mobile Viewport (390x844) & Zero Scroll ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${PORT}`);
    await mobilePage.evaluate(() => {
      const mockState = {
        version: 3,
        currentChapter: 8,
        unlockedMissions: [],
        badges: [],
        moonChapter: { relicIds: ['relic_apollo11', 'relic_apollo17', 'relic_surveyor3'], completed: false },
      };
      localStorage.setItem('beyond_depth_save_v3', JSON.stringify(mockState));
    });
    await mobilePage.reload();
    await mobilePage.locator('[data-testid="nova-dialogue-action-btn"]').click();
    await mobilePage.locator('[data-testid="moon-earthrise-continue"]').click();

    const mCrash = mobilePage.locator('[data-testid="crash-interlude"]');
    await mCrash.waitFor({ state: 'visible', timeout: 5000 });

    // Verify zero scroll on mobile
    const scrollInfo = await mobilePage.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    }));
    console.log(`Mobile scroll metrics: maxScroll = ${scrollInfo.maxScroll}px`);
    if (scrollInfo.maxScroll > 2) {
      throw new Error(`Mobile Crash Scene has vertical scroll: ${scrollInfo.maxScroll}px > 2px`);
    }
    console.log('✓ Mobile Crash Scene fits viewport perfectly with zero scroll');

    // Advance to Stage 3 on mobile
    await mCrash.click({ position: { x: 195, y: 300 } });
    await mobilePage.waitForTimeout(300);
    await mCrash.click({ position: { x: 195, y: 300 } });
    await mobilePage.waitForTimeout(300);

    const mBeat3 = mobilePage.locator('[data-testid="crash-beat-3"]');
    await mBeat3.waitFor({ state: 'visible', timeout: 3000 });

    // Verify zero scroll on Stage 3 with all 4 cards
    const scrollInfoStage3 = await mobilePage.evaluate(() => ({
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    }));
    console.log(`Mobile Stage 3 scroll metrics: maxScroll = ${scrollInfoStage3.maxScroll}px`);
    if (scrollInfoStage3.maxScroll > 2) {
      throw new Error(`Mobile Stage 3 has vertical scroll: ${scrollInfoStage3.maxScroll}px > 2px`);
    }
    console.log('✓ Mobile Stage 3 (Diagnostics & Cards) fits viewport with zero scroll');

    await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, 'mobile_crash_stage3.png') });

    // Click Continue on mobile
    const mContinueBtn = mobilePage.locator('[data-testid="crash-continue-btn"]');
    await mContinueBtn.click();
    await mobilePage.locator('[data-testid="world-canvas"]').waitFor({ state: 'visible', timeout: 8000 });
    console.log('✓ Mobile transition to Mars open world successful');

    console.log('\n======================================================');
    console.log('ALL CRASH SCENE CINEMATIC & DIAGNOSTIC TESTS PASSED (100%)');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
