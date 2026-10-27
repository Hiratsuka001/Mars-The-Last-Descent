import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  const pB64 = fs.readFileSync('src/assets/new assets/player_walk4.png').toString('base64');
  const nB64 = fs.readFileSync('src/assets/new assets/nova_walk.png').toString('base64');

  await page.setContent(`<!DOCTYPE html><html><body>
    <img id="p" src="data:image/png;base64,${pB64}">
    <img id="n" src="data:image/png;base64,${nB64}">
  </body></html>`);
  await page.waitForFunction(() => document.getElementById('p').complete && document.getElementById('n').complete);

  const result = await page.evaluate(async () => {
    const pImg = document.getElementById('p');
    const nImg = document.getElementById('n');

    const pSrcCanvas = document.createElement('canvas');
    pSrcCanvas.width = pImg.naturalWidth;
    pSrcCanvas.height = pImg.naturalHeight;
    const pSrcCtx = pSrcCanvas.getContext('2d');
    pSrcCtx.drawImage(pImg, 0, 0);

    // Extraction function for Player with robust cluster bounding & edge isolation
    function extractPlayerSprite(cellX, cellY, cellW, cellH, targetW, targetH, mirrorX = false) {
      const ix = cellX + 15;
      const iy = cellY + 15;
      const iw = cellW - 30;
      const ih = cellH - 30;

      const d = pSrcCtx.getImageData(ix, iy, iw, ih).data;

      // Group columns with alpha > 150 into clusters
      const colCounts = new Array(iw).fill(0);
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          const idx = (y * iw + x) * 4;
          if (d[idx + 3] > 150) colCounts[x]++;
        }
      }

      // Find clusters separated by empty columns to discard border bleed lines
      const clusters = [];
      let cur = null;
      for (let x = 0; x < iw; x++) {
        if (colCounts[x] > 0) {
          if (!cur) cur = { minX: x, maxX: x, totalPixels: colCounts[x] };
          else { cur.maxX = x; cur.totalPixels += colCounts[x]; }
        } else if (cur) {
          clusters.push(cur);
          cur = null;
        }
      }
      if (cur) clusters.push(cur);

      if (clusters.length === 0) {
        return document.createElement('canvas');
      }

      // Select main character body cluster (highest pixel count)
      clusters.sort((a, b) => b.totalPixels - a.totalPixels);
      const main = clusters[0];
      const minX = main.minX;
      const maxX = main.maxX;

      // Find vertical bounds within main body cluster
      let minY = ih, maxY = 0;
      for (let y = 0; y < ih; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * iw + x) * 4;
          if (d[idx + 3] > 150) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const bodyW = maxX - minX + 1;
      const bodyH = maxY - minY + 1;

      // Extract body
      const bodyCanvas = document.createElement('canvas');
      bodyCanvas.width = bodyW;
      bodyCanvas.height = bodyH;
      const bCtx = bodyCanvas.getContext('2d');
      const bodyImgData = pSrcCtx.getImageData(ix + minX, iy + minY, bodyW, bodyH);
      const bd = bodyImgData.data;

      for (let i = 0; i < bd.length; i += 4) {
        if (bd[i + 3] < 140) {
          bd[i + 3] = 0;
        }
      }
      bCtx.putImageData(bodyImgData, 0, 0);

      // Draw onto target canvas
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = targetW;
      dstCanvas.height = targetH;
      const dstCtx = dstCanvas.getContext('2d');
      dstCtx.imageSmoothingEnabled = true;
      dstCtx.imageSmoothingQuality = 'high';

      if (mirrorX) {
        dstCtx.translate(targetW, 0);
        dstCtx.scale(-1, 1);
      }

      // Scale with guaranteed 1px padding on left/right outer columns
      const scale = Math.min((targetW - 2) / bodyW, (targetH - 1) / bodyH);
      const drawW = Math.max(1, Math.round(bodyW * scale));
      const drawH = Math.max(1, Math.round(bodyH * scale));
      const drawX = Math.round((targetW - drawW) / 2);
      const drawY = targetH - drawH; // bottom baseline grounded

      dstCtx.drawImage(bodyCanvas, drawX, drawY, drawW, drawH);
      return dstCanvas;
    }

    const pW = 20, pH = 28;
    const colW = (1180 - 60) / 4; // ~280
    const playerSprites = {};

    // 1. Walk Down (Row 1 Left Group, 0..3)
    for (let i = 0; i < 4; i++) {
      const rx = Math.round(60 + i * colW);
      playerSprites[`player_walk_down_${i}`] = extractPlayerSprite(rx, 170, Math.round(colW), 380, pW, pH);
    }
    // Idle Down: Row 3 Col 0 (Standing Front)
    playerSprites['player_idle_down'] = extractPlayerSprite(250, 1200, 300, 460, pW, pH);

    // 2. Walk Up (Row 1 Right Group, 0..3 with precise column starts to prevent 2320px border bleed)
    const walkUpStarts = [1290, 1555, 1810, 2075];
    for (let i = 0; i < 4; i++) {
      playerSprites[`player_walk_up_${i}`] = extractPlayerSprite(walkUpStarts[i], 170, 235, 380, pW, pH);
    }
    // Idle Up: Row 3 Col 1 (Standing Back)
    playerSprites['player_idle_up'] = extractPlayerSprite(785, 1200, 300, 460, pW, pH);

    // 3. Walk Right (Row 2 Left Group, 0..3 - visually verified 100% RIGHT facing)
    for (let i = 0; i < 4; i++) {
      const rx = Math.round(60 + i * colW);
      playerSprites[`player_walk_right_${i}`] = extractPlayerSprite(rx, 730, Math.round(colW), 340, pW, pH);
    }
    // Idle Right: Row 3 Col 2 (Standing Right)
    playerSprites['player_idle_right'] = extractPlayerSprite(1350, 1200, 260, 460, pW, pH);

    // 4. Walk Left: Row 2 Left Group mirrored horizontally (100% clean LEFT facing, zero mixed frames)
    for (let i = 0; i < 4; i++) {
      const rx = Math.round(60 + i * colW);
      playerSprites[`player_walk_left_${i}`] = extractPlayerSprite(rx, 730, Math.round(colW), 340, pW, pH, true);
    }
    // Idle Left: Row 3 Col 2 mirrored horizontally (guarantees perfect symmetry with idle right)
    playerSprites['player_idle_left'] = extractPlayerSprite(1350, 1200, 260, 460, pW, pH, true);

    // ----------------------------------------------------
    // NOVA SPRITES (18x16) - Topey from nova_walk.png
    // Fixed landmark anchoring & uniform scaling per direction (Zero Jitter)
    // Front-walk frames for "down", side-view frames reused for "up", same feet baseline (targetY=15)
    // ----------------------------------------------------
    const nW = 18, nH = 16;
    const novaSprites = {};

    const catFrameDefs = {
      down: [
        { x: 345, y: 389, w: 64, h: 128, anchorX: 345 + 31, anchorY: 516, targetX: 9, targetY: 15, scale: 0.120 },
        { x: 480, y: 385, w: 64, h: 133, anchorX: 480 + 30, anchorY: 517, targetX: 9, targetY: 15, scale: 0.120 },
        { x: 612, y: 386, w: 65, h: 132, anchorX: 612 + 31, anchorY: 517, targetX: 9, targetY: 15, scale: 0.120 },
      ],
      right: [
        { x: 304, y: 259, w: 116, h: 96, anchorX: 304 + 81, anchorY: 354, targetX: 13, targetY: 15, scale: 0.145 },
        { x: 441, y: 263, w: 124, h: 92, anchorX: 441 + 90, anchorY: 354, targetX: 13, targetY: 15, scale: 0.145 },
        { x: 596, y: 258, w: 116, h: 97, anchorX: 596 + 82, anchorY: 354, targetX: 13, targetY: 15, scale: 0.145 },
      ],
      left: [
        { x: 370, y: 103, w: 111, h: 114, anchorX: 370 + 29, anchorY: 216, targetX: 4, targetY: 15, scale: 0.140 },
        { x: 520, y: 102, w: 103, h: 114, anchorX: 520 + 30, anchorY: 215, targetX: 4, targetY: 15, scale: 0.140 },
      ]
    };

    function extractCatCell(def) {
      const cCanvas = document.createElement('canvas');
      cCanvas.width = nW;
      cCanvas.height = nH;
      const cCtx = cCanvas.getContext('2d');

      const sCanvas = document.createElement('canvas');
      sCanvas.width = def.w;
      sCanvas.height = def.h;
      const sCtx = sCanvas.getContext('2d');
      sCtx.drawImage(nImg, def.x, def.y, def.w, def.h, 0, 0, def.w, def.h);

      const dw = Math.round(def.w * def.scale);
      const dh = Math.round(def.h * def.scale);
      const relAnchorX = (def.anchorX - def.x) * def.scale;
      const relAnchorY = (def.anchorY - def.y) * def.scale;
      const dx = Math.round(def.targetX - relAnchorX);
      const dy = Math.round(def.targetY - relAnchorY);

      cCtx.imageSmoothingEnabled = false;
      cCtx.drawImage(sCanvas, 0, 0, def.w, def.h, dx, dy, dw, dh);
      return cCanvas;
    }

    // Down: Front 0, 1, 2, 1
    const catDownFrames = [
      extractCatCell(catFrameDefs.down[0]),
      extractCatCell(catFrameDefs.down[1]),
      extractCatCell(catFrameDefs.down[2]),
      extractCatCell(catFrameDefs.down[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_down_${i}`] = catDownFrames[i];
    novaSprites['nova_idle_down'] = catDownFrames[0];

    // Left: Left 0, 1, 0, 1 loop
    const catLeftFrames = [
      extractCatCell(catFrameDefs.left[0]),
      extractCatCell(catFrameDefs.left[1]),
      extractCatCell(catFrameDefs.left[0]),
      extractCatCell(catFrameDefs.left[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_left_${i}`] = catLeftFrames[i];
    novaSprites['nova_idle_left'] = catLeftFrames[0];

    // Right: Right 0, 1, 2, 1 ping-pong
    const catRightFrames = [
      extractCatCell(catFrameDefs.right[0]),
      extractCatCell(catFrameDefs.right[1]),
      extractCatCell(catFrameDefs.right[2]),
      extractCatCell(catFrameDefs.right[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_right_${i}`] = catRightFrames[i];
    novaSprites['nova_idle_right'] = catRightFrames[0];

    // Up: Reuse side-view frames for "up" (same feet baseline targetY=15, eliminates tall tail-up)
    const catUpFrames = [
      catRightFrames[0],
      catRightFrames[1],
      catRightFrames[2],
      catRightFrames[1],
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_up_${i}`] = catUpFrames[i];
    novaSprites['nova_idle_up'] = catRightFrames[0];

    // ----------------------------------------------------
    // ASSEMBLE MASTER ATLAS (200x120)
    // ----------------------------------------------------
    const masterCanvas = document.createElement('canvas');
    masterCanvas.width = 200;
    masterCanvas.height = 120;
    const mCtx = masterCanvas.getContext('2d');

    const manifestEntries = {};
    const dirs = ['down', 'up', 'left', 'right'];

    // Player Rows:
    // Row 0: Down (y: 0..28)
    // Row 1: Up (y: 28..56)
    // Row 2: Left (y: 56..84)
    // Row 3: Right (y: 84..112)
    for (let r = 0; r < 4; r++) {
      const dir = dirs[r];
      const py = r * pH;
      
      const idleKey = `player_idle_${dir}`;
      mCtx.drawImage(playerSprites[idleKey], 0, py);
      manifestEntries[idleKey] = { x: 0, y: py, w: pW, h: pH };

      for (let c = 0; c < 4; c++) {
        const walkKey = `player_walk_${dir}_${c}`;
        const px = (c + 1) * pW;
        mCtx.drawImage(playerSprites[walkKey], px, py);
        manifestEntries[walkKey] = { x: px, y: py, w: pW, h: pH };
      }
    }

    // Nova Rows:
    // Start X: 105
    // Row 0: Down (y: 0..16)
    // Row 1: Up (y: 16..32)
    // Row 2: Left (y: 32..48)
    // Row 3: Right (y: 48..64)
    const nStartX = 105;
    for (let r = 0; r < 4; r++) {
      const dir = dirs[r];
      const ny = r * nH;

      const idleKey = `nova_idle_${dir}`;
      mCtx.drawImage(novaSprites[idleKey], nStartX, ny);
      manifestEntries[idleKey] = { x: nStartX, y: ny, w: nW, h: nH };

      for (let c = 0; c < 4; c++) {
        const walkKey = `nova_walk_${dir}_${c}`;
        const nx = nStartX + (c + 1) * nW;
        mCtx.drawImage(novaSprites[walkKey], nx, ny);
        manifestEntries[walkKey] = { x: nx, y: ny, w: nW, h: nH };
      }
    }

    // ----------------------------------------------------
    // VISOR DIRECTION RIGOROUS AUDIT (Measured against Head Midpoint)
    // ----------------------------------------------------
    const visorAudit = [];
    const keysToCheck = [
      'player_idle_left', 'player_walk_left_0', 'player_walk_left_1', 'player_walk_left_2', 'player_walk_left_3',
      'player_idle_right', 'player_walk_right_0', 'player_walk_right_1', 'player_walk_right_2', 'player_walk_right_3',
    ];

    for (const key of keysToCheck) {
      const spriteCanvas = playerSprites[key];
      const sCtx = spriteCanvas.getContext('2d');
      const d = sCtx.getImageData(0, 0, pW, pH).data;

      let visorSumX = 0, visorCount = 0;
      let headMinX = pW, headMaxX = 0;

      // Head is in upper 40% (y = 0..11)
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < pW; x++) {
          const idx = (y * pW + x) * 4;
          const a = d[idx + 3];
          if (a > 120) {
            if (x < headMinX) headMinX = x;
            if (x > headMaxX) headMaxX = x;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2];
            // Dark visor pixels: low red/green, darker shade
            if (r < 80 && g < 100 && b > 30) {
              visorSumX += x;
              visorCount++;
            }
          }
        }
      }

      const headMid = (headMinX + headMaxX) / 2;
      const visorAvgX = visorCount > 0 ? visorSumX / visorCount : headMid;
      const expected = key.includes('left') ? 'LEFT' : 'RIGHT';
      const actual = visorAvgX < headMid - 0.2 ? 'LEFT' : (visorAvgX > headMid + 0.2 ? 'RIGHT' : 'CENTER');
      const pass = actual === expected;

      visorAudit.push({ key, expected, actual, visorAvgX, headMid, pass });
    }

    // ----------------------------------------------------
    // LABELED CONTACT SHEET FOR PLAYER (qa-screenshots/player_frames.png)
    // ----------------------------------------------------
    const contactCanvas = document.createElement('canvas');
    contactCanvas.width = 750;
    contactCanvas.height = 360;
    const cCtx = contactCanvas.getContext('2d');
    cCtx.fillStyle = '#0f172a';
    cCtx.fillRect(0, 0, contactCanvas.width, contactCanvas.height);

    cCtx.fillStyle = '#f8fafc';
    cCtx.font = 'bold 16px sans-serif';
    cCtx.fillText('Player Sprite Verification Sheet (Every Key & Direction)', 20, 30);

    const dirLabels = [
      { dir: 'down', title: 'DOWN (Front)' },
      { dir: 'up', title: 'UP (Back)' },
      { dir: 'left', title: 'LEFT (Facing Left)' },
      { dir: 'right', title: 'RIGHT (Facing Right)' },
    ];

    dirLabels.forEach((dl, r) => {
      const yBase = 60 + r * 72;
      cCtx.fillStyle = '#94a3b8';
      cCtx.font = 'bold 12px monospace';
      cCtx.fillText(dl.title, 20, yBase + 28);

      const frameKeys = [
        `player_idle_${dl.dir}`,
        `player_walk_${dl.dir}_0`,
        `player_walk_${dl.dir}_1`,
        `player_walk_${dl.dir}_2`,
        `player_walk_${dl.dir}_3`,
      ];

      frameKeys.forEach((key, c) => {
        const xBase = 180 + c * 110;
        const sprite = playerSprites[key];

        // Draw 2x magnified sprite
        const magW = pW * 2;
        const magH = pH * 2;
        cCtx.strokeStyle = '#334155';
        cCtx.strokeRect(xBase, yBase, magW, magH);
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(sprite, xBase, yBase, magW, magH);

        // Label below
        cCtx.fillStyle = '#38bdf8';
        cCtx.font = '10px monospace';
        const shortName = key.replace(`player_`, '').replace(`${dl.dir}_`, '');
        cCtx.fillText(shortName, xBase, yBase + magH + 12);
      });
    });

    // ----------------------------------------------------
    // A3 QA AUDIT: No player cell has opaque pixels in outer 1px columns (col 0 or col 19)
    // ----------------------------------------------------
    const outerColumnAudit = [];
    for (const [key, spriteCanvas] of Object.entries(playerSprites)) {
      const sCtx = spriteCanvas.getContext('2d');
      let leftOpaque = 0, rightOpaque = 0;
      for (let y = 0; y < pH; y++) {
        if (sCtx.getImageData(0, y, 1, 1).data[3] > 50) leftOpaque++;
        if (sCtx.getImageData(pW - 1, y, 1, 1).data[3] > 50) rightOpaque++;
      }
      const pass = leftOpaque === 0 && rightOpaque === 0;
      outerColumnAudit.push({ key, leftOpaque, rightOpaque, pass });
    }

    return {
      masterDataUrl: masterCanvas.toDataURL('image/png'),
      contactDataUrl: contactCanvas.toDataURL('image/png'),
      manifestEntries,
      visorAudit,
      outerColumnAudit,
    };
  });

  // Verify visor audit passes 100%
  console.log('--- VISOR DIRECTION AUDIT ---');
  let allPassed = true;
  for (const item of result.visorAudit) {
    console.log(`${item.key}: expected ${item.expected}, got ${item.actual} (visorAvgX=${item.visorAvgX.toFixed(2)}, headMid=${item.headMid.toFixed(2)}) -> ${item.pass ? 'PASS' : 'FAIL'}`);
    if (!item.pass) allPassed = false;
  }

  if (!allPassed) {
    throw new Error('VISOR AUDIT FAILED: one or more player frames faced the wrong direction!');
  }

  // Verify A3 Outer Column Audit passes 100%
  console.log('--- A3 OUTER COLUMN EDGE AUDIT (Zero Stray Bleed) ---');
  let a3Passed = true;
  for (const item of result.outerColumnAudit) {
    if (!item.pass) {
      console.error(`FAIL: ${item.key} has opaque pixels on edges! Left: ${item.leftOpaque}, Right: ${item.rightOpaque}`);
      a3Passed = false;
    }
  }
  if (!a3Passed) {
    throw new Error('A3 AUDIT FAILED: Player cell has opaque pixels in outer 1px column!');
  }
  console.log(`A3 PASS: All ${result.outerColumnAudit.length} player cells have completely clean outer 1px columns.`);

  // Save master sheet to public/assets/characters.png and src/assets/characters.png
  const masterBuf = Buffer.from(result.masterDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync('public/assets/characters.png', masterBuf);
  fs.writeFileSync('src/assets/characters.png', masterBuf);
  console.log('Saved public/assets/characters.png and src/assets/characters.png');

  // Save labeled contact sheet to qa-screenshots/player_frames.png
  const contactBuf = Buffer.from(result.contactDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync('qa-screenshots/player_frames.png', contactBuf);
  console.log('Saved qa-screenshots/player_frames.png');

  await browser.close();
  console.log('Atlas build completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
