import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple static server for dist
const DIST_DIR = path.resolve('dist');
const PORT = 4174;

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
      console.log(`Test server running at http://localhost:${PORT}`);
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

    // Seed localStorage with Chapter 8 Moon unlocked
    await page.goto(`http://localhost:${PORT}`);
    await page.evaluate(() => {
      const mockState = {
        currentChapter: 8,
        discoveredCraters: [],
        collectedWater: 0,
        unlockedCodexEntries: [],
        scannedAnomalies: [],
        quizScores: {},
        didYouKnowRead: [],
        badges: [],
        inventory: [],
        activeMissionId: null,
        completedMissions: [],
        moonChapter: {
          relicIds: [],
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

    console.log('Reloading with Moon Chapter active...');
    await page.reload();

    const moonScene = page.locator('[data-testid="moon-scene"]');
    await moonScene.waitFor({ state: 'visible', timeout: 8000 });
    console.log('✓ Moon scene loaded successfully');

    // 1. Initial stand still (1 second) - Pet Nova should NOT be on screen
    await page.waitForTimeout(1000);
    const petPromptText = page.locator('text=Pet Nova (Purr in 1/6th G)');
    const isPromptVisibleInitially = await petPromptText.isVisible();
    console.log(`Prompt visible at 1.0s: ${isPromptVisibleInitially} (Expected: false)`);
    if (isPromptVisibleInitially) {
      throw new Error('Pet Nova prompt was immediately visible on screen! Expected it NOT to be always visible.');
    }

    // 2. Wait until 3.8s total (entering 3.0s - 7.0s cuddle window)
    console.log('Waiting for Nova cuddle window (3.0s - 7.0s)...');
    await page.waitForTimeout(2800);
    const isPromptVisibleInWindow = await petPromptText.isVisible();
    console.log(`Prompt visible during cuddle window (3.8s): ${isPromptVisibleInWindow} (Expected: true)`);
    if (!isPromptVisibleInWindow) {
      throw new Error('Pet Nova prompt did not appear during the affectionate cuddle window!');
    }

    // Take screenshot during cuddle window
    await page.screenshot({ path: 'scripts/01_cuddle_window_prompt.png' });

    // 3. Wait until 8.0s total (exiting 7.0s cuddle window)
    console.log('Waiting for Nova cuddle window to expire (8.0s total)...');
    await page.waitForTimeout(4200);
    const isPromptVisibleAfterWindow = await petPromptText.isVisible();
    console.log(`Prompt visible after window expires (8.0s): ${isPromptVisibleAfterWindow} (Expected: false)`);
    if (isPromptVisibleAfterWindow) {
      throw new Error('Pet Nova prompt did not disappear after cuddle window expired!');
    }

    // 4. Test dedicated 'P' shortcut to pet Nova anytime
    console.log('Testing [P] key to pet Nova...');
    await page.keyboard.press('KeyP');
    const toast = page.locator('text=NOVA PURRS IN 1/6TH GRAVITY');
    await toast.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Toast appeared on pressing [P]: NOVA PURRS IN 1/6TH GRAVITY');
    await page.screenshot({ path: 'scripts/02_p_key_pet_nova.png' });

    // Verify Cosmic Companion badge is awarded in localStorage
    const savedAfterP = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('beyond_depth_save_v3') || '{}');
      return data.badges || [];
    });
    console.log('Badges awarded after [P]:', savedAfterP);
    if (!savedAfterP.includes('Cosmic Companion')) {
      throw new Error('Cosmic Companion badge was not awarded after pressing [P]');
    }

    // 5. Test Mobile viewport touch controls
    console.log('Testing Mobile Viewport...');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${PORT}`);
    await mobilePage.evaluate(() => {
      const mockState = {
        currentChapter: 8,
        badges: [],
        moonChapter: { relicIds: [], secretIds: [], iceScannedIds: [], monumentIds: [], lunarRockIds: [], thumperFired: false, completed: false, rpApplied: false },
      };
      localStorage.setItem('beyond_depth_save_v3', JSON.stringify(mockState));
    });
    await mobilePage.reload();
    await mobilePage.locator('[data-testid="moon-scene"]').waitFor({ state: 'visible', timeout: 8000 });

    const touchPetBtn = mobilePage.locator('[data-testid="touch-pet-btn"]');
    // Initially not visible
    await mobilePage.waitForTimeout(1000);
    const isMobileBtnInitial = await touchPetBtn.isVisible();
    console.log(`Mobile touch-pet-btn visible at 1.0s: ${isMobileBtnInitial} (Expected: false)`);
    if (isMobileBtnInitial) {
      throw new Error('touch-pet-btn was immediately visible on mobile! Expected clean screen.');
    }

    // In cuddle window
    await mobilePage.waitForTimeout(2800);
    const isMobileBtnInWindow = await touchPetBtn.isVisible();
    console.log(`Mobile touch-pet-btn visible in cuddle window: ${isMobileBtnInWindow} (Expected: true)`);
    if (!isMobileBtnInWindow) {
      throw new Error('touch-pet-btn did not appear in cuddle window on mobile!');
    }

    // Tap touch-pet-btn
    await touchPetBtn.click();
    const mobileToast = mobilePage.locator('text=NOVA PURRS IN 1/6TH GRAVITY');
    await mobileToast.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ Mobile touch-pet-btn successfully petted Nova!');
    await mobilePage.screenshot({ path: 'scripts/03_mobile_pet_nova.png' });

    console.log('ALL PET NOVA CLEANUP TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
