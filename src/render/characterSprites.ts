import { ProceduralTileConfig } from './proceduralTiles';

/**
 * 100% CC0 Procedural Pixel-Art Characters, Icons, & Spaceship
 * Fully replaces all restricted-license stock/pngtree prototype sheets.
 * Integer-scaled, nearest-neighbor, authentic sci-fi pixel art.
 */

type Pixel = { x: number; y: number; color: string };

function box(x1: number, y1: number, x2: number, y2: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      pxs.push({ x, y, color });
    }
  }
  return pxs;
}

function lineH(x1: number, x2: number, y: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    pxs.push({ x, y, color });
  }
  return pxs;
}

function lineV(x: number, y1: number, y2: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    pxs.push({ x, y, color });
  }
  return pxs;
}

// ============================================================================
// CHARACTER SPRITES
// Note: Astronaut Player and NOVA Companion character walk cycles and idle frames
// are loaded from the dedicated characters atlas sheet (src/assets/characters.png).
// ============================================================================

// ============================================================================
// PART INVENTORY ICONS (16x16)
// Crisp procedural pixel art for ship parts
// ============================================================================

function buildIconGear(): Pixel[] {
  const pxs: Pixel[] = [];
  // Steampunk titanium cogwheel
  pxs.push(...box(5, 5, 10, 10, '#94a3b8'));
  pxs.push(...box(6, 6, 9, 9, '#334155')); // Hole
  pxs.push(...box(7, 7, 8, 8, '#f8fafc')); // Axle
  // Teeth
  pxs.push(...lineH(6, 9, 3, '#cbd5e1'));
  pxs.push(...lineH(6, 9, 12, '#cbd5e1'));
  pxs.push(...lineV(3, 6, 9, '#cbd5e1'));
  pxs.push(...lineV(12, 6, 9, '#cbd5e1'));
  return pxs;
}

function buildIconSolarPanel(): Pixel[] {
  const pxs: Pixel[] = [];
  // Silicon blue grid
  pxs.push(...box(2, 4, 13, 11, '#1e3a8a'));
  pxs.push(...box(3, 5, 12, 10, '#2563eb'));
  pxs.push(...lineH(3, 12, 7, '#60a5fa')); // Grid line
  pxs.push(...lineV(6, 5, 10, '#60a5fa'));
  pxs.push(...lineV(9, 5, 10, '#60a5fa'));
  // Mount frame
  pxs.push(...lineH(2, 13, 4, '#e2e8f0'));
  pxs.push(...lineH(2, 13, 11, '#e2e8f0'));
  return pxs;
}

function buildIconChip(): Pixel[] {
  const pxs: Pixel[] = [];
  // Dark silicon IC package
  pxs.push(...box(4, 4, 11, 11, '#0f172a'));
  pxs.push(...box(5, 5, 10, 10, '#1e293b'));
  // Gold pins
  pxs.push(...lineH(5, 10, 2, '#fbbf24'));
  pxs.push(...lineH(5, 10, 13, '#fbbf24'));
  pxs.push(...lineV(2, 5, 10, '#fbbf24'));
  pxs.push(...lineV(13, 5, 10, '#fbbf24'));
  // Microcircuit trace
  pxs.push({ x: 7, y: 7, color: '#38bdf8' });
  pxs.push({ x: 8, y: 8, color: '#38bdf8' });
  return pxs;
}

function buildIconWrench(): Pixel[] {
  const pxs: Pixel[] = [];
  // Titanium tool with glowing cyan head
  pxs.push(...lineH(3, 6, 3, '#06b6d4'));
  pxs.push(...lineV(3, 3, 6, '#06b6d4'));
  pxs.push(...lineH(3, 5, 5, '#06b6d4'));
  // Shaft diagonal
  for (let i = 0; i < 7; i++) {
    pxs.push({ x: 6 + i, y: 6 + i, color: '#cbd5e1' });
    pxs.push({ x: 7 + i, y: 6 + i, color: '#64748b' });
  }
  return pxs;
}

function buildIconSatellite(): Pixel[] {
  const pxs: Pixel[] = [];
  // Parabolic dish
  pxs.push(...lineH(4, 11, 9, '#e2e8f0'));
  pxs.push(...lineH(3, 12, 10, '#94a3b8'));
  pxs.push(...lineH(5, 10, 8, '#cbd5e1'));
  // Antenna feed horn
  pxs.push(...lineV(7, 4, 8, '#f59e0b'));
  pxs.push({ x: 7, y: 3, color: '#ef4444' }); // Pulse beacon
  // Base tripod
  pxs.push({ x: 5, y: 12, color: '#334155' });
  pxs.push({ x: 9, y: 12, color: '#334155' });
  return pxs;
}

function buildIconBattery(): Pixel[] {
  const pxs: Pixel[] = [];
  // Cell casing
  pxs.push(...box(4, 5, 11, 12, '#334155'));
  pxs.push(...box(5, 6, 10, 11, '#0f172a'));
  // Terminal
  pxs.push(...lineH(6, 9, 3, '#cbd5e1'));
  // Green charge levels
  pxs.push(...lineH(6, 9, 7, '#22c55e'));
  pxs.push(...lineH(6, 9, 9, '#22c55e'));
  return pxs;
}

function buildIconFuel(): Pixel[] {
  const pxs: Pixel[] = [];
  // Pressurized tank
  pxs.push(...box(4, 3, 11, 13, '#b91c1c'));
  pxs.push(...box(5, 4, 10, 12, '#ef4444'));
  // Hazard stripe
  pxs.push(...lineH(5, 10, 7, '#fef08a'));
  pxs.push(...lineH(5, 10, 9, '#fef08a'));
  pxs.push({ x: 7, y: 2, color: '#94a3b8' }); // Valve
  return pxs;
}

function buildIconToolbox(): Pixel[] {
  const pxs: Pixel[] = [];
  // Orange nanotech kit
  pxs.push(...box(3, 5, 12, 12, '#c2410c'));
  pxs.push(...box(4, 6, 11, 11, '#ea580c'));
  // Handle
  pxs.push(...lineH(6, 9, 3, '#94a3b8'));
  pxs.push({ x: 6, y: 4, color: '#94a3b8' });
  pxs.push({ x: 9, y: 4, color: '#94a3b8' });
  // Latch
  pxs.push(...lineH(7, 8, 8, '#fef08a'));
  return pxs;
}

// ============================================================================
// UI KEYBOARD KEYCAP PROMPTS (24x24)
// High-contrast sci-fi keycap tiles: key_e, key_w, key_a, key_s, key_d
// ============================================================================

function buildKeycap(letter: 'E' | 'W' | 'A' | 'S' | 'D'): Pixel[] {
  const pxs: Pixel[] = [];
  // Rounded button body
  pxs.push(...box(3, 3, 20, 20, '#0f172a'));
  // Cyan border
  pxs.push(...lineH(5, 18, 2, '#06b6d4'));
  pxs.push(...lineH(5, 18, 21, '#0891b2'));
  pxs.push(...lineV(2, 5, 18, '#06b6d4'));
  pxs.push(...lineV(21, 5, 18, '#0891b2'));
  // Inner gradient
  pxs.push(...box(5, 5, 18, 18, '#1e293b'));

  const C_FONT = '#ffffff';

  if (letter === 'E') {
    pxs.push(...lineV(9, 8, 15, C_FONT));
    pxs.push(...lineH(9, 14, 8, C_FONT));
    pxs.push(...lineH(9, 13, 11, C_FONT));
    pxs.push(...lineH(9, 14, 15, C_FONT));
  } else if (letter === 'W') {
    pxs.push(...lineV(8, 8, 15, C_FONT));
    pxs.push(...lineV(15, 8, 15, C_FONT));
    pxs.push({ x: 10, y: 13, color: C_FONT });
    pxs.push({ x: 11, y: 14, color: C_FONT });
    pxs.push({ x: 12, y: 14, color: C_FONT });
    pxs.push({ x: 13, y: 13, color: C_FONT });
  } else if (letter === 'A') {
    pxs.push(...lineV(8, 10, 15, C_FONT));
    pxs.push(...lineV(15, 10, 15, C_FONT));
    pxs.push(...lineH(9, 14, 8, C_FONT));
    pxs.push(...lineH(8, 15, 12, C_FONT));
  } else if (letter === 'S') {
    pxs.push(...lineH(9, 14, 8, C_FONT));
    pxs.push(...lineV(8, 9, 11, C_FONT));
    pxs.push(...lineH(9, 14, 11, C_FONT));
    pxs.push(...lineV(15, 12, 14, C_FONT));
    pxs.push(...lineH(9, 14, 15, C_FONT));
  } else if (letter === 'D') {
    pxs.push(...lineV(8, 8, 15, C_FONT));
    pxs.push(...lineH(8, 13, 8, C_FONT));
    pxs.push(...lineH(8, 13, 15, C_FONT));
    pxs.push(...lineV(14, 9, 14, C_FONT));
  }

  return pxs;
}

// ============================================================================
// SPACESHIP SPRITES (64x64)
// Procedural Mars Lander: broken vs repaired
// ============================================================================

function buildSpaceship(repaired: boolean): Pixel[] {
  const pxs: Pixel[] = [];

  // 1. Hydraulic Landing Legs & Pads
  const legColor = repaired ? '#94a3b8' : '#475569';
  pxs.push(...box(8, 48, 14, 56, legColor)); // Left leg
  pxs.push(...box(49, 48, 55, 56, legColor)); // Right leg
  pxs.push(...box(6, 56, 16, 59, '#1e293b')); // Footpad
  pxs.push(...box(47, 56, 57, 59, '#1e293b'));

  // 2. Conical Command Module (Ascent Vehicle)
  pxs.push(...box(26, 10, 37, 24, '#f8fafc'));
  pxs.push(...lineH(28, 35, 8, '#f8fafc'));
  pxs.push(...lineH(30, 33, 6, '#f8fafc')); // Nose cone
  pxs.push(...lineH(31, 32, 4, '#e2e8f0')); // Docking probe

  // Cockpit Viewport (Cyan or Amber)
  const windowColor = repaired ? '#38bdf8' : '#f59e0b';
  pxs.push(...box(28, 14, 35, 17, windowColor));
  pxs.push({ x: 29, y: 15, color: '#ffffff' });

  // 3. Service / Propulsion Module (Mid-Deck)
  pxs.push(...box(20, 24, 43, 44, '#cbd5e1'));
  pxs.push(...box(22, 26, 41, 42, '#334155')); // Heat shield band
  pxs.push(...lineH(20, 43, 30, '#0284c7')); // Mission livery stripe

  // 4. Solar Wings
  if (repaired) {
    // Intact, glistening deep blue solar panels
    pxs.push(...box(6, 26, 19, 36, '#1e3a8a'));
    pxs.push(...box(44, 26, 57, 36, '#1e3a8a'));
    pxs.push(...box(7, 27, 18, 35, '#2563eb'));
    pxs.push(...box(45, 27, 56, 35, '#2563eb'));
    // Gold bus bars
    pxs.push(...lineH(7, 18, 31, '#fbbf24'));
    pxs.push(...lineH(45, 56, 31, '#fbbf24'));
    // Telemetry Green Beacon
    pxs.push({ x: 31, y: 3, color: '#22c55e' });
    pxs.push({ x: 32, y: 3, color: '#4ade80' });
  } else {
    // Damaged, scorched panels
    pxs.push(...box(8, 28, 19, 36, '#1e293b'));
    pxs.push(...box(44, 27, 54, 34, '#1e3a8a'));
    pxs.push(...lineH(10, 18, 33, '#78350f')); // Crack
    // Scorch blast mark
    pxs.push(...box(12, 38, 22, 46, '#451a03'));
    // Warning red LED
    pxs.push({ x: 31, y: 3, color: '#ef4444' });
  }

  // 5. Main Ascent Rocket Bell
  pxs.push(...box(27, 44, 36, 49, '#475569'));
  pxs.push(...lineH(25, 38, 50, '#1e293b'));

  return pxs;
}

// ============================================================================
// NATURE PROPS (Trees, Flowers, Grass Tuft)
// ============================================================================

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];

function buildTreeGreen(): Pixel[] {
  const pxs: Pixel[] = [];

  // 1. Soft contact shadow on ground (dithered ellipse under trunk base)
  for (let y = 32; y <= 35; y++) {
    for (let x = 6; x <= 26; x++) {
      const dx = (x - 16) / 10;
      const dy = (y - 33.5) / 1.8;
      const d = dx * dx + dy * dy;
      if (d <= 1.0) {
        const dither = BAYER_4X4[y % 4][x % 4];
        if (d < 0.5) {
          pxs.push({ x, y, color: 'rgba(0, 0, 0, 0.40)' });
        } else if (dither < 10) {
          pxs.push({ x, y, color: 'rgba(0, 0, 0, 0.22)' });
        }
      }
    }
  }

  // 2. Trunk with flared roots and bark texture
  pxs.push(...box(14, 20, 17, 33, '#78350f'));
  pxs.push(...lineV(15, 20, 33, '#451a03'));
  pxs.push(...lineV(16, 21, 32, '#5c2b09'));
  pxs.push({ x: 13, y: 32, color: '#5c2b09' }); // Root left flare
  pxs.push({ x: 13, y: 33, color: '#451a03' });
  pxs.push({ x: 18, y: 32, color: '#92400e' }); // Root right flare
  pxs.push({ x: 18, y: 33, color: '#78350f' });

  // 3. Clustered organic rounded canopy lobes (No flat square canopies)
  const lobes = [
    { cx: 16, cy: 11, r: 10.5 },
    { cx: 10, cy: 14, r: 7.2 },
    { cx: 22, cy: 13, r: 7.5 },
    { cx: 16, cy: 6, r: 6.2 },
    { cx: 12, cy: 8, r: 5.5 },
    { cx: 20, cy: 8, r: 5.5 },
  ];

  for (let y = 1; y <= 24; y++) {
    for (let x = 2; x <= 29; x++) {
      let inFoliage = false;
      let minNormDist = 999;
      let lobeWeight = 0;

      for (const lobe of lobes) {
        const dx = (x - lobe.cx) / lobe.r;
        const dy = (y - lobe.cy) / lobe.r;
        const normDist = dx * dx + dy * dy;
        if (normDist <= 1.0) {
          inFoliage = true;
          if (normDist < minNormDist) minNormDist = normDist;
          lobeWeight += (1 - normDist);
        }
      }

      if (!inFoliage) continue;

      // Directional light from upper-left (sun vector)
      const lightFactor = ((16 - x) * 0.45 + (16 - y) * 0.70) / 16;
      const dither = BAYER_4X4[y % 4][x % 4];

      if (lightFactor > 0.42) {
        // Bright sunlight highlight (toned-down olive highlight)
        pxs.push({ x, y, color: dither < 6 ? '#a3e635' : '#84cc16' });
      } else if (lightFactor > 0.05) {
        // Upper canopy midtone (savanna olive)
        pxs.push({ x, y, color: dither < 8 ? '#65a30d' : '#4d7c0f' });
      } else if (lightFactor > -0.35) {
        // Core grounded olive green
        pxs.push({ x, y, color: dither < 7 ? '#3f6212' : '#365314' });
      } else {
        // Underside deep canopy shadow
        pxs.push({ x, y, color: dither < 9 ? '#273a0e' : '#1a2608' });
      }
    }
  }

  return pxs;
}

function buildTreePine(): Pixel[] {
  const pxs: Pixel[] = [];

  // 1. Soft contact shadow on ground (dithered ellipse under trunk base)
  for (let y = 32; y <= 35; y++) {
    for (let x = 6; x <= 18; x++) {
      const dx = (x - 12) / 6;
      const dy = (y - 33.5) / 1.6;
      const d = dx * dx + dy * dy;
      if (d <= 1.0) {
        const dither = BAYER_4X4[y % 4][x % 4];
        if (d < 0.5) {
          pxs.push({ x, y, color: 'rgba(0, 0, 0, 0.40)' });
        } else if (dither < 10) {
          pxs.push({ x, y, color: 'rgba(0, 0, 0, 0.20)' });
        }
      }
    }
  }

  // 2. Trunk with bark texture
  pxs.push(...box(11, 24, 13, 33, '#5c2b09'));
  pxs.push(...lineV(11, 24, 33, '#3b1a03'));
  pxs.push(...lineV(12, 25, 33, '#78350f'));

  // 3. Tapered conical evergreen silhouette with serrated needle boughs & dithered shading
  const tiers = [
    { startY: 2, endY: 7, startW: 0.5, endW: 3.5 },
    { startY: 6, endY: 13, startW: 2.0, endW: 6.5 },
    { startY: 12, endY: 20, startW: 3.5, endW: 9.0 },
    { startY: 18, endY: 27, startW: 4.5, endW: 11.0 },
  ];

  for (let y = 2; y <= 27; y++) {
    for (let x = 1; x <= 23; x++) {
      let insideTier = false;

      for (const t of tiers) {
        if (y >= t.startY && y <= t.endY) {
          const progress = (y - t.startY) / (t.endY - t.startY);
          let w = t.startW + progress * (t.endW - t.startW);
          // Serrate needle bough tips
          if (y % 2 === 0) w += 0.8;
          if (Math.abs(x - 12) <= w) {
            insideTier = true;
            break;
          }
        }
      }

      if (!insideTier) continue;

      const relX = (x - 12);
      const dither = BAYER_4X4[y % 4][x % 4];

      if (y <= 3) {
        // Soft pale lichen tip at crown
        pxs.push({ x, y, color: '#bef264' });
      } else if (relX < -3) {
        // Lit left needle bough (sunlit olive)
        pxs.push({ x, y, color: dither < 6 ? '#84cc16' : '#65a30d' });
      } else if (relX < 2) {
        // Center pine midtone (forest olive)
        pxs.push({ x, y, color: dither < 8 ? '#4d7c0f' : '#3f6212' });
      } else if (relX < 6) {
        // Shadowed right bough (deep olive)
        pxs.push({ x, y, color: dither < 8 ? '#365314' : '#273a0e' });
      } else {
        // Deep under-bough shadow
        pxs.push({ x, y, color: '#162007' });
      }
    }
  }

  return pxs;
}

function buildFlower(color: string): Pixel[] {
  const pxs: Pixel[] = [];
  pxs.push(...lineV(6, 6, 11, '#16a34a'));
  pxs.push({ x: 5, y: 4, color });
  pxs.push({ x: 7, y: 4, color });
  pxs.push({ x: 6, y: 3, color });
  pxs.push({ x: 6, y: 5, color });
  pxs.push({ x: 6, y: 4, color: '#fde047' });
  return pxs;
}

function buildGrassTuft(): Pixel[] {
  const pxs: Pixel[] = [];
  pxs.push(...lineV(6, 6, 12, '#16a34a'));
  pxs.push({ x: 5, y: 5, color: '#4ade80' });
  pxs.push({ x: 4, y: 7, color: '#16a34a' });
  pxs.push({ x: 7, y: 5, color: '#4ade80' });
  pxs.push({ x: 8, y: 7, color: '#16a34a' });
  return pxs;
}

// ============================================================================
// EXPORT ALL CHARACTER & ICON PROCEDURAL TILE CONFIGS
// ============================================================================

export const CHARACTER_SPRITE_DEFS: ProceduralTileConfig[] = [
  // PART INVENTORY ICONS
  { key: 'icon_gear', name: 'Icon Gear', biome: 'icon', width: 16, height: 16, pixels: buildIconGear() },
  { key: 'icon_solar_panel', name: 'Icon Solar Panel', biome: 'icon', width: 16, height: 16, pixels: buildIconSolarPanel() },
  { key: 'icon_chip', name: 'Icon Chip', biome: 'icon', width: 16, height: 16, pixels: buildIconChip() },
  { key: 'icon_wrench', name: 'Icon Wrench', biome: 'icon', width: 16, height: 16, pixels: buildIconWrench() },
  { key: 'icon_satellite', name: 'Icon Satellite', biome: 'icon', width: 16, height: 16, pixels: buildIconSatellite() },
  { key: 'icon_battery', name: 'Icon Battery', biome: 'icon', width: 16, height: 16, pixels: buildIconBattery() },
  { key: 'icon_fuel', name: 'Icon Fuel', biome: 'icon', width: 16, height: 16, pixels: buildIconFuel() },
  { key: 'icon_toolbox', name: 'Icon Toolbox', biome: 'icon', width: 16, height: 16, pixels: buildIconToolbox() },

  // UI KEYCAP PROMPTS
  { key: 'key_e', name: 'Keycap [E]', biome: 'ui', width: 24, height: 24, pixels: buildKeycap('E') },
  { key: 'key_w', name: 'Keycap [W]', biome: 'ui', width: 24, height: 24, pixels: buildKeycap('W') },
  { key: 'key_a', name: 'Keycap [A]', biome: 'ui', width: 24, height: 24, pixels: buildKeycap('A') },
  { key: 'key_s', name: 'Keycap [S]', biome: 'ui', width: 24, height: 24, pixels: buildKeycap('S') },
  { key: 'key_d', name: 'Keycap [D]', biome: 'ui', width: 24, height: 24, pixels: buildKeycap('D') },

  // SPACESHIP
  { key: 'ship_broken', name: 'Spaceship Crash Site', biome: 'ship', width: 64, height: 64, pixels: buildSpaceship(false) },
  { key: 'ship_repaired', name: 'Spaceship Flight Ready', biome: 'ship', width: 64, height: 64, pixels: buildSpaceship(true) },

  // NATURE PROPS
  { key: 'prop_tree_green', name: 'Lush Alien Tree', biome: 'prop', width: 32, height: 36, pixels: buildTreeGreen() },
  { key: 'prop_tree_pine', name: 'Spruce Pine Tree', biome: 'prop', width: 24, height: 36, pixels: buildTreePine() },
  { key: 'prop_flower_red', name: 'Red Lichen Bloom', biome: 'prop', width: 12, height: 12, pixels: buildFlower('#ef4444') },
  { key: 'prop_flower_yellow', name: 'Yellow Dust Flower', biome: 'prop', width: 12, height: 12, pixels: buildFlower('#eab308') },
  { key: 'prop_flower_blue', name: 'Cyan Frost Bloom', biome: 'prop', width: 12, height: 12, pixels: buildFlower('#06b6d4') },
  { key: 'prop_grass_tuft', name: 'Terraformed Grass Tuft', biome: 'prop', width: 14, height: 14, pixels: buildGrassTuft() },
];
