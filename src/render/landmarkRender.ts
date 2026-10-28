import { PlacedLandmark } from '../world/placement';

/**
 * Procedural Pixel Art Renderers for the 5 Major Martian Landmarks
 * Each is 6-10 tiles wide, drawn in the same pixel style consistent with wreck art,
 * readable from 15+ tiles away, with soft contact shadows and dithered lighting.
 */
export function drawLandmark(c: CanvasRenderingContext2D, lm: PlacedLandmark, time: number): void {
  c.save();
  const x = lm.worldX;
  const y = lm.worldY;

  switch (lm.id) {
    case 'canyon_rim':
      drawCanyonRim(c, x, y, time);
      break;
    case 'shield_volcano':
      drawShieldVolcano(c, x, y, time);
      break;
    case 'river_delta':
      drawRiverDelta(c, x, y, time);
      break;
    case 'ice_cave':
      drawIceCave(c, x, y, time);
      break;
    case 'dust_devil':
      drawDustDevil(c, x, y, time);
      break;
    default:
      break;
  }
  c.restore();
}

/**
 * 1. Valles Marineris Chasm Rim (9 tiles wide x 4 tiles high)
 * A dark tectonic fracture cut INTO the ground:
 * - Soft ground contact shadow (no hard black parallelogram)
 * - Lit rim edge with sunlight highlights along the fracture lip
 * - Terraced, jagged strata walls inside descending into the abyss
 * - Deep depth gradient plunging into darkness
 * - Walkable around, not over
 */
function drawCanyonRim(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const w = 144;
  const left = Math.round(x - w / 2);
  const bottom = Math.round(y);

  // 1. Soft contact shadow on ground around the southern perimeter (matches prop contact shadow)
  c.fillStyle = 'rgba(0, 0, 0, 0.22)';
  c.beginPath();
  c.ellipse(x, bottom - 4, w * 0.46, 9, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = 'rgba(0, 0, 0, 0.12)';
  c.beginPath();
  c.ellipse(x, bottom - 4, w * 0.52, 13, 0, 0, Math.PI * 2);
  c.fill();

  // 2. Outer Fractured Rim Border (Ground Lip)
  c.fillStyle = '#9a3412';
  c.beginPath();
  c.ellipse(x, bottom - 26, w * 0.48, 22, 0, 0, Math.PI * 2);
  c.fill();

  // 3. Lit Rim Edge (Sunlit northern lip with jagged fractures)
  c.fillStyle = '#ea580c';
  c.beginPath();
  c.moveTo(left + 10, bottom - 28);
  const segments = 16;
  const segW = (w - 20) / segments;
  for (let s = 0; s <= segments; s++) {
    const sx = left + 10 + s * segW;
    const jag = ((s * 7) % 5) * 1.5 - 3;
    const curveY = Math.sin((s / segments) * Math.PI) * 8;
    c.lineTo(sx, bottom - 44 + jag - curveY);
  }
  c.lineTo(left + w - 10, bottom - 30);
  c.lineTo(left + w - 18, bottom - 24);
  c.lineTo(left + 18, bottom - 24);
  c.closePath();
  c.fill();

  // Crisp sunlit highlight flecks along top rim lip
  c.fillStyle = '#fed7aa';
  for (let s = 0; s < segments; s++) {
    if (s % 2 === 0) {
      const sx = left + 12 + s * segW;
      const curveY = Math.sin((s / segments) * Math.PI) * 8;
      c.fillRect(Math.round(sx), Math.round(bottom - 45 - curveY + ((s * 5) % 3)), Math.round(segW - 3), 2);
    }
  }

  // 4. Jagged Strata Walls Inside (Terraced descent into the canyon cut)
  // Tier A: Upper Oxidized Red Strata
  c.fillStyle = '#c2410c';
  c.beginPath();
  c.moveTo(left + 16, bottom - 34);
  for (let s = 0; s <= segments; s++) {
    const sx = left + 16 + s * (segW * 0.9);
    const jag = ((s * 11) % 5) * 1.8 - 4;
    c.lineTo(sx, bottom - 36 + jag);
  }
  c.lineTo(left + w - 20, bottom - 24);
  c.lineTo(left + 20, bottom - 24);
  c.closePath();
  c.fill();

  // Tier B: Middle Sandstone & Silt Strata (Burnt Sienna)
  c.fillStyle = '#7c2d12';
  c.fillRect(left + 20, bottom - 32, w - 40, 10);
  // Dithered horizontal bedding joints
  c.fillStyle = '#9a3412';
  for (let px = left + 22; px < left + w - 22; px += 4) {
    c.fillRect(px, bottom - 30, 2, 1);
    c.fillRect(px + 2, bottom - 27, 2, 1);
  }

  // Tier C: Deep Basalt Wall Bedrock
  c.fillStyle = '#431407';
  c.fillRect(left + 24, bottom - 26, w - 48, 12);
  c.fillStyle = '#270c04';
  for (let px = left + 26; px < left + w - 26; px += 4) {
    c.fillRect(px + ((px / 4) % 2) * 2, bottom - 20, 2, 3);
  }

  // 5. The Deep Abyss Trench (Depth gradient plunging into pitch black)
  const grad = c.createLinearGradient(x, bottom - 32, x, bottom - 12);
  grad.addColorStop(0, '#270c04');
  grad.addColorStop(0.35, '#120503');
  grad.addColorStop(0.7, '#070201');
  grad.addColorStop(1, 'rgba(5, 2, 2, 0.98)');
  c.fillStyle = grad;
  c.beginPath();
  c.ellipse(x, bottom - 20, w * 0.36, 9, 0, 0, Math.PI * 2);
  c.fill();

  // Center deepest fracture line (total pitch black void)
  c.fillStyle = '#020101';
  c.beginPath();
  c.ellipse(x, bottom - 19, w * 0.28, 5, 0, 0, Math.PI * 2);
  c.fill();

  // 6. Talus Scree & Protruding Bedrock Crags inside walls
  const wallRocks = [
    [-46, -24, 7, 4, '#7c2d12', '#ea580c'],
    [-24, -28, 8, 5, '#431407', '#9a3412'],
    [12, -26, 7, 4, '#7c2d12', '#ea580c'],
    [38, -25, 9, 5, '#431407', '#9a3412'],
    [-8, -22, 6, 3, '#270c04', '#7c2d12'],
    [26, -21, 6, 3, '#270c04', '#7c2d12'],
  ];
  for (const [rx, ry, rw, rh, baseCol, highCol] of wallRocks) {
    c.fillStyle = baseCol as string;
    c.fillRect(Math.round(x + (rx as number)), Math.round(bottom + (ry as number)), rw as number, rh as number);
    c.fillStyle = highCol as string;
    c.fillRect(Math.round(x + (rx as number) + 1), Math.round(bottom + (ry as number) - 1), (rw as number) - 2, 1);
  }

  // 7. Shimmering Thermal Abyss Mirage Haze
  const hazePulse = (Math.sin(time * 0.003) + 1) * 0.5;
  c.fillStyle = `rgba(154, 52, 18, ${0.10 + hazePulse * 0.08})`;
  c.beginPath();
  c.ellipse(x, bottom - 19, w * 0.32, 6, 0, 0, Math.PI * 2);
  c.fill();
}

/**
 * 2. Elysium Mons Shield Silhouette (10 tiles wide x 3 tiles high)
 * Wide, LOW red-brown shield mound with small dark caldera and dithered slope shading,
 * using the authentic Mars palette (terracotta, rust, burnt sienna, umber - no blue-grey).
 * Reads distinctly as a volcanic shield with summit crater from 15 tiles away.
 */
function drawShieldVolcano(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const w = 160;
  const left = Math.round(x - w / 2);
  const bottom = Math.round(y);

  // 1. Soft contact shadow on ground under broad shield base
  c.fillStyle = 'rgba(0, 0, 0, 0.28)';
  c.beginPath();
  c.ellipse(x, bottom - 3, w * 0.48, 10, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = 'rgba(0, 0, 0, 0.14)';
  c.beginPath();
  c.ellipse(x, bottom - 3, w * 0.52, 14, 0, 0, Math.PI * 2);
  c.fill();

  // 2. Base Dark Basalt Shield Apron (Deepest Umber / Basalt Foundation)
  c.fillStyle = '#3b1207';
  c.beginPath();
  c.moveTo(left + 8, bottom - 4);
  c.lineTo(left + 32, bottom - 16);
  c.lineTo(left + 58, bottom - 28);
  c.lineTo(left + 68, bottom - 33); // Summit Caldera West
  c.lineTo(left + w - 68, bottom - 33); // Summit Caldera East
  c.lineTo(left + w - 58, bottom - 28);
  c.lineTo(left + w - 32, bottom - 16);
  c.lineTo(left + w - 8, bottom - 4);
  c.closePath();
  c.fill();

  // 3. Sunlit Northwest Flank Facets (Oxidized Terracotta & Rust)
  c.fillStyle = '#7c2d12'; // Burnt sienna mid-slope
  c.beginPath();
  c.moveTo(left + 14, bottom - 6);
  c.lineTo(left + 36, bottom - 18);
  c.lineTo(left + 60, bottom - 30);
  c.lineTo(x, bottom - 33);
  c.lineTo(x, bottom - 6);
  c.closePath();
  c.fill();

  c.fillStyle = '#9a3412'; // Upper sunlit northwest flank
  c.beginPath();
  c.moveTo(left + 24, bottom - 10);
  c.lineTo(left + 44, bottom - 22);
  c.lineTo(left + 64, bottom - 32);
  c.lineTo(x - 6, bottom - 33);
  c.lineTo(x - 6, bottom - 8);
  c.closePath();
  c.fill();

  // 4. Dithered Slope Shading & Radial Basalt Lava Ribs
  // Sunlit northwest lava flow ribs
  c.fillStyle = '#c2410c';
  c.fillRect(left + 36, bottom - 18, 14, 8);
  c.fillRect(left + 54, bottom - 28, 12, 10);
  // Bright sunlit crest edges
  c.fillStyle = '#ea580c';
  c.fillRect(left + 36, bottom - 18, 2, 8);
  c.fillRect(left + 54, bottom - 28, 2, 10);

  // Southeast shadowed basalt flanks (deep umber shadow)
  c.fillStyle = '#541909';
  c.fillRect(left + w - 66, bottom - 28, 12, 10);
  c.fillRect(left + w - 50, bottom - 18, 14, 8);

  // Dithered transition between sunlit and shadowed slopes
  c.fillStyle = '#9a3412';
  for (let px = left + 28; px < left + w - 28; px += 4) {
    const py = bottom - 14 - Math.sin(((px - left) / w) * Math.PI) * 14;
    c.fillRect(px + ((Math.floor(px / 4) % 2) * 2), Math.round(py), 2, 2);
  }

  // Oxidized sulfur / iron-rust flow levees
  c.fillStyle = '#b45309';
  c.fillRect(left + 48, bottom - 25, 4, 12);
  c.fillRect(left + w - 52, bottom - 25, 4, 12);
  c.fillStyle = '#d97706';
  c.fillRect(left + 49, bottom - 23, 2, 8);

  // 5. Small Dark Caldera (Summit Volcanic Crater)
  // Outer caldera lip
  c.fillStyle = '#220904';
  c.beginPath();
  c.ellipse(x, bottom - 33, 18, 5.5, 0, 0, Math.PI * 2);
  c.fill();

  // Sunlit northern caldera rim lip (crisp highlight visible from distance)
  c.strokeStyle = '#ea580c';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(x, bottom - 33, 17, Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();

  c.fillStyle = '#fed7aa';
  c.fillRect(x - 8, bottom - 38, 16, 1);

  // Dark central caldera interior void (sunken pit)
  c.fillStyle = '#0a0201';
  c.beginPath();
  c.ellipse(x, bottom - 32.5, 12, 3.5, 0, 0, Math.PI * 2);
  c.fill();

  // Faint warm magma vent glow inside caldera
  const glow = (Math.sin(time * 0.005) + 1) * 0.5;
  c.fillStyle = `rgba(234, 88, 12, ${0.4 + glow * 0.35})`;
  c.beginPath();
  c.ellipse(x, bottom - 32.5, 6, 2, 0, 0, Math.PI * 2);
  c.fill();

  // 6. Subtle geothermal gas wisps
  for (let v = 0; v < 2; v++) {
    const ventOffset = (time * 0.02 + v * 18) % 25;
    const ventX = x - 4 + v * 8 + Math.sin(time * 0.004 + v) * 3;
    const ventY = bottom - 36 - ventOffset;
    const alpha = Math.max(0, 0.28 - ventOffset / 30);
    c.fillStyle = `rgba(254, 215, 170, ${alpha})`;
    c.beginPath();
    c.arc(ventX, ventY, 1.5 + ventOffset * 0.08, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * 3. Eberswalde Sinuous Delta (8 tiles wide x 4 tiles high)
 * Fan of branching channels spreading outward from a crater-wall notch,
 * rendered in two sand tones plus a darker channel line. No dome shape!
 */
function drawRiverDelta(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const w = 136;
  const left = Math.round(x - w / 2);
  const bottom = Math.round(y);

  // 1. Soft contact shadow on surrounding terrain around outer fan edge
  c.fillStyle = 'rgba(0, 0, 0, 0.16)';
  c.beginPath();
  c.ellipse(x, bottom - 4, w * 0.46, 8, 0, 0, Math.PI * 2);
  c.fill();

  // 2. Breached Crater-Wall Notch at Fan Apex (Top Escarpment)
  // Left crater rock wall
  c.fillStyle = '#431407';
  c.fillRect(left + 28, bottom - 50, 32, 8);
  c.fillStyle = '#7c2d12';
  c.fillRect(left + 30, bottom - 52, 28, 4);
  c.fillStyle = '#9a3412';
  c.fillRect(left + 32, bottom - 53, 24, 1);

  // Right crater rock wall
  c.fillStyle = '#431407';
  c.fillRect(x + 8, bottom - 50, 32, 8);
  c.fillStyle = '#7c2d12';
  c.fillRect(x + 10, bottom - 52, 28, 4);
  c.fillStyle = '#9a3412';
  c.fillRect(x + 12, bottom - 53, 24, 1);

  // The Breach Notch (gap between walls through which ancient water entered)
  c.fillStyle = '#270c04';
  c.fillRect(x - 7, bottom - 49, 14, 6);

  // 3. Spreading Alluvial Fan Bed - Sand Tone 1 (Base Alluvial Sand Deposit)
  c.fillStyle = '#b45309';
  c.beginPath();
  c.moveTo(x - 7, bottom - 46); // Notch Left
  c.lineTo(x + 7, bottom - 46); // Notch Right
  c.lineTo(left + w - 8, bottom - 6); // Bottom East
  c.lineTo(left + 8, bottom - 6);     // Bottom West
  c.closePath();
  c.fill();

  // 4. Layered Silt Terraces & Lobes - Sand Tone 2 (Outer Sandy Deposit & Silt Bars)
  c.fillStyle = '#d97706';
  c.beginPath();
  c.moveTo(x - 5, bottom - 38);
  c.lineTo(x + 5, bottom - 38);
  c.lineTo(left + w - 16, bottom - 8);
  c.lineTo(left + 16, bottom - 8);
  c.closePath();
  c.fill();

  // Dithered transition between Sand Tone 1 and Sand Tone 2
  c.fillStyle = '#b45309';
  for (let px = left + 18; px < left + w - 18; px += 4) {
    c.fillRect(px + ((px / 4) % 2) * 2, bottom - 12, 2, 2);
  }

  // 5. Darker Channel Lines (Branching Distributary Riverbed Network)
  // Deep incised channel beds
  c.strokeStyle = '#3b1408';
  c.lineWidth = 2.5;
  c.lineCap = 'round';

  // Inflow Trunk through Notch
  c.beginPath();
  c.moveTo(x, bottom - 48);
  c.lineTo(x - 1, bottom - 38);
  c.stroke();

  // West Branching Distributaries
  c.beginPath();
  c.moveTo(x - 1, bottom - 38);
  c.bezierCurveTo(x - 12, bottom - 32, x - 22, bottom - 24, x - 32, bottom - 16);
  c.stroke();

  // Distributary W1 (Far West Flank)
  c.beginPath();
  c.moveTo(x - 32, bottom - 16);
  c.bezierCurveTo(x - 38, bottom - 12, x - 44, bottom - 8, left + 14, bottom - 5);
  c.stroke();

  // Distributary W2 (Inner West)
  c.beginPath();
  c.moveTo(x - 32, bottom - 16);
  c.bezierCurveTo(x - 26, bottom - 12, x - 20, bottom - 8, x - 18, bottom - 5);
  c.stroke();

  // Central Channel
  c.beginPath();
  c.moveTo(x - 1, bottom - 38);
  c.bezierCurveTo(x - 2, bottom - 26, x + 2, bottom - 16, x - 2, bottom - 5);
  c.stroke();

  // East Branching Distributaries
  c.beginPath();
  c.moveTo(x - 1, bottom - 38);
  c.bezierCurveTo(x + 10, bottom - 32, x + 20, bottom - 24, x + 30, bottom - 16);
  c.stroke();

  // Distributary E1 (Inner East)
  c.beginPath();
  c.moveTo(x + 30, bottom - 16);
  c.bezierCurveTo(x + 24, bottom - 12, x + 18, bottom - 8, x + 16, bottom - 5);
  c.stroke();

  // Distributary E2 (Far East Flank)
  c.beginPath();
  c.moveTo(x + 30, bottom - 16);
  c.bezierCurveTo(x + 38, bottom - 12, x + 44, bottom - 8, left + w - 14, bottom - 5);
  c.stroke();

  // Inner Dark Centerline
  c.strokeStyle = '#1f0803';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, bottom - 48);
  c.lineTo(x - 1, bottom - 38);
  c.bezierCurveTo(x - 12, bottom - 32, x - 22, bottom - 24, x - 32, bottom - 16);
  c.moveTo(x - 1, bottom - 38);
  c.bezierCurveTo(x + 10, bottom - 32, x + 20, bottom - 24, x + 30, bottom - 16);
  c.stroke();

  // 6. Mid-Stream Sand Bar Islands (Tone 2 #d97706 with #f59e0b highlights)
  const sandBars = [
    [-18, -26, 10, 4],
    [16, -24, 12, 4.5],
    [-6, -18, 9, 3.5],
    [8, -14, 11, 4],
    [-28, -12, 10, 3.5],
    [26, -12, 10, 3.5],
  ];

  for (const [bx, by, bw, bh] of sandBars) {
    c.fillStyle = '#d97706';
    c.beginPath();
    c.ellipse(x + bx, bottom + by, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    c.fill();

    // Sunlit top edge highlight on sand bar
    c.fillStyle = '#f59e0b';
    c.fillRect(Math.round(x + bx - bw / 4), Math.round(bottom + by - 1), Math.round(bw / 2), 1);
  }
}

/**
 * 4. Planum Boreum Permafrost Chasm (9 tiles wide x 5 tiles high)
 * Massive layered ice archway into polar permafrost with glowing cyan stalactites.
 * Shaded with soft contact shadows and dithered glacial ice strata.
 */
function drawIceCave(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const w = 144;
  const bottom = Math.round(y);

  // 1. Soft contact shadow on snowy ground under arch
  c.fillStyle = 'rgba(15, 23, 42, 0.28)';
  c.beginPath();
  c.ellipse(x, bottom - 6, w * 0.46, 11, 0, 0, Math.PI * 2);
  c.fill();

  // 2. Polar Permafrost Outer Dome (Basalt-Regolith Dust Crust)
  c.fillStyle = '#334155';
  c.beginPath();
  c.arc(x, bottom - 10, w / 2 - 8, Math.PI, 0);
  c.fill();

  // 3. Glacial Blue Ice Strata
  c.fillStyle = '#0369a1';
  c.beginPath();
  c.arc(x, bottom - 10, w / 2 - 18, Math.PI, 0);
  c.fill();

  // Sunlit cyan ice crest
  c.fillStyle = '#38bdf8';
  c.beginPath();
  c.arc(x, bottom - 10, w / 2 - 20, Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();

  // Pure Permafrost Snow Cap
  c.fillStyle = '#e0f2fe';
  c.beginPath();
  c.arc(x, bottom - 10, w / 2 - 14, Math.PI * 1.15, Math.PI * 1.85);
  c.fill();

  // 4. Deep Chasm Cavern Entrance (Subsurface Abyss)
  c.fillStyle = '#082f49';
  c.beginPath();
  c.ellipse(x, bottom - 12, 34, 40, 0, Math.PI, 0);
  c.fill();

  // Cavern Core Abyss Void
  c.fillStyle = '#02131f';
  c.beginPath();
  c.ellipse(x, bottom - 10, 24, 28, 0, Math.PI, 0);
  c.fill();

  // 5. Stalactites (Hanging Ice Teeth)
  c.fillStyle = '#bae6fd';
  const icicles = [-28, -20, -12, -4, 4, 12, 20, 28];
  for (let i = 0; i < icicles.length; i++) {
    const ix = x + icicles[i];
    const len = ((i * 5) % 9) + 8;
    c.beginPath();
    c.moveTo(ix - 3, bottom - 46);
    c.lineTo(ix + 3, bottom - 46);
    c.lineTo(ix, bottom - 46 + len);
    c.closePath();
    c.fill();

    // Sharp glistening tip
    c.fillStyle = '#ffffff';
    c.fillRect(ix - 0.5, bottom - 46 + len - 1, 1, 1);
    c.fillStyle = '#bae6fd';
  }

  // 6. Crystalline Shimmer and Pulsing Frost Core
  const frostPulse = (Math.sin(time * 0.005) + 1) * 0.5;
  c.fillStyle = `rgba(56, 189, 248, ${0.35 + frostPulse * 0.35})`;
  c.beginPath();
  c.ellipse(x, bottom - 16, 18, 12, 0, 0, Math.PI * 2);
  c.fill();

  // Glint Stars
  c.fillStyle = '#ffffff';
  c.fillRect(Math.round(x - 16 + frostPulse * 4), bottom - 56, 2, 2);
  c.fillRect(Math.round(x + 18 - frostPulse * 3), bottom - 52, 2, 2);
}

/**
 * 5. Vortex Column Dust Devil (7 tiles wide x 6 tiles high)
 * Dynamic towering vortex of warm swirling Martian sand and spinning amber dust.
 * Shaded with soft contact shadows and wreck-consistent dithered bands.
 */
function drawDustDevil(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bottom = Math.round(y);

  // 1. Soft ground contact shadow & swirl imprint
  c.fillStyle = 'rgba(0, 0, 0, 0.22)';
  c.beginPath();
  c.ellipse(x, bottom - 2, 26, 8, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = 'rgba(120, 53, 15, 0.40)';
  c.beginPath();
  c.ellipse(x, bottom - 2, 20, 6, 0, 0, Math.PI * 2);
  c.fill();

  // 2. Spiraling Vortex Rings (5 tiers widening upwards)
  const tiers = [
    { yOff: -10, radiusX: 14, radiusY: 5, alpha: 0.70, speed: 0.009 },
    { yOff: -26, radiusX: 20, radiusY: 6, alpha: 0.65, speed: -0.008 },
    { yOff: -46, radiusX: 28, radiusY: 7, alpha: 0.60, speed: 0.007 },
    { yOff: -68, radiusX: 36, radiusY: 8, alpha: 0.50, speed: -0.006 },
    { yOff: -90, radiusX: 44, radiusY: 9, alpha: 0.40, speed: 0.005 },
  ];

  for (const t of tiers) {
    const rot = time * t.speed;
    const wobbleX = Math.sin(rot) * 5;

    c.fillStyle = `rgba(245, 158, 11, ${t.alpha})`;
    c.beginPath();
    c.ellipse(x + wobbleX, bottom + t.yOff, t.radiusX, t.radiusY, 0, 0, Math.PI * 2);
    c.fill();

    // Dense inner sand core
    c.fillStyle = `rgba(217, 119, 6, ${t.alpha + 0.15})`;
    c.beginPath();
    c.ellipse(x + wobbleX, bottom + t.yOff, t.radiusX * 0.6, t.radiusY * 0.6, 0, 0, Math.PI * 2);
    c.fill();

    // Highlighting swirl rim
    c.strokeStyle = '#fef08a';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x + wobbleX, bottom + t.yOff, t.radiusX * 0.85, rot, rot + Math.PI);
    c.stroke();
  }

  // 3. Orbiting Sand Grains
  for (let p = 0; p < 8; p++) {
    const orbitSpeed = 0.006 + p * 0.001;
    const orbitAngle = time * orbitSpeed + p * (Math.PI / 4);
    const orbitH = -16 - p * 9;
    const orbitW = 16 + p * 3.5;
    const px = x + Math.cos(orbitAngle) * orbitW;
    const py = bottom + orbitH + Math.sin(orbitAngle) * (orbitW * 0.25);

    c.fillStyle = p % 2 === 0 ? '#fbbf24' : '#f59e0b';
    c.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
}
