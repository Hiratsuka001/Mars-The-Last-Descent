import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  const pB64 = fs.readFileSync('src/assets/new assets/player_sheet_user.jpg').toString('base64');
  const nB64 = fs.readFileSync('src/assets/new assets/nova_walk.png').toString('base64');

  await page.setContent(`<!DOCTYPE html><html><body>
    <img id="p" src="data:image/jpeg;base64,${pB64}">
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

    const W = pSrcCanvas.width;
    const H = pSrcCanvas.height;
    const pData = pSrcCtx.getImageData(0, 0, W, H).data;

    function isBg(r, g, b) {
      if (Math.hypot(r - 57, g - 70, b - 90) < 30) return true;
      if (Math.hypot(r - 78, g - 95, b - 116) < 30) return true;
      if (r >= 45 && r <= 88 && g >= 58 && g <= 108 && b >= 75 && b <= 135) {
        if (b > g + 8 && g > r + 6) return true;
      }
      return false;
    }

    function extractBody(x0, y0, w0, h0) {
      let minX = w0, maxX = 0, minY = h0, maxY = 0;
      for (let y = 0; y < h0; y++) {
        for (let x = 0; x < w0; x++) {
          const idx = ((y0 + y) * W + (x0 + x)) * 4;
          const r = pData[idx], g = pData[idx+1], b = pData[idx+2];
          if (!isBg(r, g, b)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const sw = maxX - minX + 1;
      const sh = maxY - minY + 1;
      const c = document.createElement('canvas');
      c.width = sw;
      c.height = sh;
      const cCtx = c.getContext('2d');
      const out = cCtx.createImageData(sw, sh);
      const od = out.data;

      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const sIdx = ((y0 + minY + y) * W + (x0 + minX + x)) * 4;
          const oIdx = (y * sw + x) * 4;
          const r = pData[sIdx], g = pData[sIdx+1], b = pData[sIdx+2];
          if (!isBg(r, g, b)) {
            od[oIdx] = r;
            od[oIdx+1] = g;
            od[oIdx+2] = b;
            od[oIdx+3] = 255;
          } else {
            od[oIdx+3] = 0;
          }
        }
      }
      cCtx.putImageData(out, 0, 0);
      return { canvas: c, w: sw, h: sh };
    }

    // Downscale sprite onto 20x28 with crisp pixel art palette snapping & 100% opacity
    function renderCrispSprite(raw, targetW = 20, targetH = 28, targetDrawH = 26, mirrorX = false) {
      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      const cCtx = c.getContext('2d');

      const scale = targetDrawH / raw.h;
      const drawW = Math.min(targetW - 2, Math.round(raw.w * scale));
      const drawH = Math.min(targetH, Math.round(raw.h * scale));
      const drawX = Math.round((targetW - drawW) / 2);
      const drawY = targetH - drawH; // bottom baseline grounded

      const srcCtx = raw.canvas.getContext('2d');
      const sd = srcCtx.getImageData(0, 0, raw.w, raw.h).data;
      const out = cCtx.createImageData(targetW, targetH);
      const od = out.data;

      for (let dy = 0; dy < drawH; dy++) {
        for (let dx = 0; dx < drawW; dx++) {
          const actualDx = mirrorX ? (drawW - 1 - dx) : dx;
          const sx0 = Math.floor(actualDx / scale);
          const sx1 = Math.min(raw.w - 1, Math.floor((actualDx + 1) / scale) - 1);
          const sy0 = Math.floor(dy / scale);
          const sy1 = Math.min(raw.h - 1, Math.floor((dy + 1) / scale) - 1);

          let rSum = 0, gSum = 0, bSum = 0, count = 0, opaqueCount = 0;

          for (let sy = sy0; sy <= sy1; sy++) {
            for (let sx = sx0; sx <= sx1; sx++) {
              count++;
              const idx = (sy * raw.w + sx) * 4;
              if (sd[idx + 3] > 100) {
                opaqueCount++;
                rSum += sd[idx];
                gSum += sd[idx + 1];
                bSum += sd[idx + 2];
              }
            }
          }

          if (opaqueCount / count >= 0.28) {
            let r = Math.round(rSum / opaqueCount);
            let g = Math.round(gSum / opaqueCount);
            let b = Math.round(bSum / opaqueCount);

            // Palette snapping for authentic 16-bit pixel art
            if (r < 40 && g < 40 && b < 40) {
              // Solid dark outline
              r = 10; g = 12; b = 18;
            } else if (r > 190 && g > 190 && b > 190) {
              // White spacesuit
              r = 250; g = 252; b = 255;
            } else if (r > 130 && g < 80 && b < 80) {
              // Red mission stripe / patch
              r = 220; g = 38; b = 38;
            } else if (b > r + 15 && b > g + 10 && (r + g + b) < 160) {
              // Dark navy visor interior
              r = 25; g = 36; b = 58;
            } else if (b > r + 20 && b > g + 15 && (r + g + b) >= 160 && (r + g + b) < 320) {
              // Cyan/blue visor highlight
              r = 75; g = 110; b = 160;
            } else if (r > 130 && g > 130 && b > 130 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
              // Grey suit shading
              r = 160; g = 165; b = 175;
            }

            const oIdx = ((drawY + dy) * targetW + (drawX + dx)) * 4;
            od[oIdx] = r;
            od[oIdx + 1] = g;
            od[oIdx + 2] = b;
            od[oIdx + 3] = 255;
          }
        }
      }

      cCtx.putImageData(out, 0, 0);
      return c;
    }

    const pW = 20, pH = 28;
    const playerSprites = {};

    // 1. Walk Down & Idle Down
    const rawWalkDown = [
      extractBody(46, 80, 87, 149),
      extractBody(158, 80, 88, 149),
      extractBody(266, 80, 93, 149),
      extractBody(384, 80, 87, 149),
    ];
    const rawIdleDown = extractBody(107, 515, 119, 190);

    for (let i = 0; i < 4; i++) {
      playerSprites[`player_walk_down_${i}`] = renderCrispSprite(rawWalkDown[i], pW, pH, 26);
    }
    playerSprites['player_idle_down'] = renderCrispSprite(rawIdleDown, pW, pH, 26);

    // 2. Walk Up & Idle Up
    const rawWalkUp = [
      extractBody(553, 80, 92, 149),
      extractBody(670, 80, 83, 149),
      extractBody(778, 80, 87, 149),
      extractBody(891, 80, 87, 149),
    ];
    const rawIdleUp = extractBody(338, 510, 118, 195);

    for (let i = 0; i < 4; i++) {
      playerSprites[`player_walk_up_${i}`] = renderCrispSprite(rawWalkUp[i], pW, pH, 26);
    }
    playerSprites['player_idle_up'] = renderCrispSprite(rawIdleUp, pW, pH, 26);

    // 3. Walk Right & Idle Right
    const rawWalkRight = [
      extractBody(56, 321, 72, 123),
      extractBody(164, 321, 72, 123),
      extractBody(271, 321, 72, 123),
      extractBody(389, 321, 72, 123),
    ];
    const rawIdleRight = extractBody(573, 510, 108, 195);

    for (let i = 0; i < 4; i++) {
      playerSprites[`player_walk_right_${i}`] = renderCrispSprite(rawWalkRight[i], pW, pH, 22);
    }
    playerSprites['player_idle_right'] = renderCrispSprite(rawIdleRight, pW, pH, 26);

    // 4. Walk Left & Idle Left (Mirrored from Right for 100% clean left-facing & zero jitter)
    for (let i = 0; i < 4; i++) {
      playerSprites[`player_walk_left_${i}`] = renderCrispSprite(rawWalkRight[i], pW, pH, 22, true);
    }
    playerSprites['player_idle_left'] = renderCrispSprite(rawIdleRight, pW, pH, 26, true);

    // ----------------------------------------------------
    // NOVA SPRITES (18x16) - Intact from nova_walk.png
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

    const catDownFrames = [
      extractCatCell(catFrameDefs.down[0]),
      extractCatCell(catFrameDefs.down[1]),
      extractCatCell(catFrameDefs.down[2]),
      extractCatCell(catFrameDefs.down[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_down_${i}`] = catDownFrames[i];
    novaSprites['nova_idle_down'] = catDownFrames[0];

    const catLeftFrames = [
      extractCatCell(catFrameDefs.left[0]),
      extractCatCell(catFrameDefs.left[1]),
      extractCatCell(catFrameDefs.left[0]),
      extractCatCell(catFrameDefs.left[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_left_${i}`] = catLeftFrames[i];
    novaSprites['nova_idle_left'] = catLeftFrames[0];

    const catRightFrames = [
      extractCatCell(catFrameDefs.right[0]),
      extractCatCell(catFrameDefs.right[1]),
      extractCatCell(catFrameDefs.right[2]),
      extractCatCell(catFrameDefs.right[1]),
    ];
    for (let i = 0; i < 4; i++) novaSprites[`nova_walk_right_${i}`] = catRightFrames[i];
    novaSprites['nova_idle_right'] = catRightFrames[0];

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

      // Head is in upper 40% (y = 0..12)
      for (let y = 0; y < 13; y++) {
        for (let x = 0; x < pW; x++) {
          const idx = (y * pW + x) * 4;
          const a = d[idx + 3];
          if (a > 120) {
            if (x < headMinX) headMinX = x;
            if (x > headMaxX) headMaxX = x;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2];
            // Visor pixels: dark navy or cyan highlight
            if ((r < 80 && g < 100 && b > 30) || (b > r + 15 && b > g + 10)) {
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

        const magW = pW * 2;
        const magH = pH * 2;
        cCtx.strokeStyle = '#334155';
        cCtx.strokeRect(xBase, yBase, magW, magH);
        cCtx.imageSmoothingEnabled = false;
        cCtx.drawImage(sprite, xBase, yBase, magW, magH);

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
