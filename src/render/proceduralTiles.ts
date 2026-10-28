import { WRECK_SPRITE_DEFS } from './wreckSprites';
import { CHARACTER_SPRITE_DEFS } from './characterSprites';

/**
 * Procedural 16x16 Ground Tile & Decoration Generator
 * Generates crisp, authentic 8-bit ground textures, transition borders, and ground details.
 * Eliminates transparent holes on ground, stray UI/banner icons, and flat empty landscapes.
 */

export interface ProceduralTileConfig {
  key: string;
  name: string;
  biome: string;
  baseColor?: string; // If omitted, transparent background for decoration overlays
  width?: number;     // default 16
  height?: number;    // default 16
  pixels?: { x: number; y: number; color: string }[];
  pattern?: (x: number, y: number, rng: () => number) => string | null;
}

// Seeded PRNG for deterministic tile patterns
function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 4x4 Bayer Dither Matrix for organic 8-bit gradient dithering
const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];

export function generateTileCanvas(config: ProceduralTileConfig, seed = 12345): HTMLCanvasElement {
  const w = config.width ?? 16;
  const h = config.height ?? 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  // 1. Fill solid base color if defined
  if (config.baseColor) {
    ctx.fillStyle = config.baseColor;
    ctx.fillRect(0, 0, w, h);
  }

  const rng = createRng(seed);

  // 2. Pattern callback if defined
  if (config.pattern) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = config.pattern(x, y, rng);
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // 3. Explicit pixel overlays
  if (config.pixels) {
    for (const p of config.pixels) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
  }

  return canvas;
}

/**
 * Procedural ground tiles, variation patches, transition borders, and ground decorations
 */
export const PROCEDURAL_TILE_DEFS: ProceduralTileConfig[] = [
  // ==========================================
  // MARS REGOLITH / ROCKY PLAINS (Default Spawn Terrain)
  // Palette: Rusty Mars red-orange ochre
  // ==========================================
  {
    key: 'tile_mars_regolith',
    name: 'Mars Regolith Base',
    biome: 'rocky',
    baseColor: '#9c3f25',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#88351e'; // subtle shadow speck
      if (r < 0.14) return '#ad4b2e'; // subtle highlight speck
      return null;
    },
  },
  {
    key: 'tile_mars_dark_rock',
    name: 'Mars Regolith Basalt Variant',
    biome: 'rocky',
    baseColor: '#9c3f25',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.10) return '#7a2d18'; // basalt grains
      if (r < 0.18) return '#ad4b2e';
      return null;
    },
    pixels: [
      { x: 4, y: 5, color: '#7a2d18' },
      { x: 5, y: 5, color: '#682412' },
      { x: 11, y: 12, color: '#7a2d18' },
    ],
  },
  {
    key: 'tile_mars_gravel',
    name: 'Mars Regolith Gravel Accent',
    biome: 'rocky',
    baseColor: '#9c3f25',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.06) return '#88351e';
      if (r < 0.12) return '#bd5838'; // weathered crumb
      return null;
    },
    pixels: [
      { x: 8, y: 7, color: '#bd5838' },
      { x: 9, y: 7, color: '#bd5838' },
      { x: 8, y: 8, color: '#682412' },
    ],
  },
  // Ground Variation Patches (breaks up large flat areas)
  {
    key: 'tile_mars_dark_patch',
    name: 'Mars Regolith Dark Tone Patch',
    biome: 'rocky',
    baseColor: '#8a341d', // deeper iron basalt
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.09) return '#762b17';
      if (r < 0.16) return '#993d23';
      return null;
    },
  },
  {
    key: 'tile_mars_light_patch',
    name: 'Mars Regolith Dust Dune Patch',
    biome: 'rocky',
    baseColor: '#a8472b', // windblown surface dust
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#963c22';
      if (r < 0.15) return '#b85435';
      return null;
    },
  },

  // ==========================================
  // MARTIAN DUNE DESERT
  // Palette: Warm golden-amber Martian sand
  // ==========================================
  {
    key: 'tile_sand_base',
    name: 'Martian Sand Base',
    biome: 'desert',
    baseColor: '#d99d57',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#c78d46'; // warm shadow speck
      if (r < 0.15) return '#e5ab66'; // warm light speck
      return null;
    },
  },
  {
    key: 'tile_sand_dune',
    name: 'Martian Sand Ripple Variant',
    biome: 'desert',
    baseColor: '#d99d57',
    pattern: (x, y, rng) => {
      if (y === 4 || y === 11) {
        if ((x + y) % 3 === 0) return '#e8b26e';
        if ((x + y) % 4 === 0) return '#c28842';
      }
      const r = rng();
      if (r < 0.06) return '#c78d46';
      if (r < 0.12) return '#e5ab66';
      return null;
    },
  },
  {
    key: 'tile_sand_pebble',
    name: 'Martian Sand Grit Accent',
    biome: 'desert',
    baseColor: '#d99d57',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.07) return '#c78d46';
      return null;
    },
    pixels: [
      { x: 6, y: 9, color: '#8c5324' },
      { x: 7, y: 9, color: '#6d3c14' },
      { x: 6, y: 8, color: '#eab673' },
    ],
  },
  {
    key: 'tile_sand_dark_patch',
    name: 'Martian Sand Shadow Patch',
    biome: 'desert',
    baseColor: '#c88e49',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#b77f3c';
      if (r < 0.15) return '#d49b55';
      return null;
    },
  },

  // ==========================================
  // TERRAFORMED SAVANNA / GRASSLAND
  // Palette: Grounded Martian lichen & hardy olive moss
  // ==========================================
  {
    key: 'tile_grass_base',
    name: 'Terraformed Grass Base',
    biome: 'grassland',
    baseColor: '#365314', // deep hardy olive lichen
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#283c0e'; // darker moss shadow
      if (r < 0.15) return '#4d7c0f'; // olive blade highlight
      return null;
    },
  },
  {
    key: 'tile_grass_variant',
    name: 'Terraformed Grass Tuft Variant',
    biome: 'grassland',
    baseColor: '#365314',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.06) return '#283c0e';
      if (r < 0.12) return '#4d7c0f';
      return null;
    },
    pixels: [
      { x: 5, y: 6, color: '#1e2e0a' },
      { x: 5, y: 7, color: '#1e2e0a' },
      { x: 6, y: 6, color: '#65a30d' },
      { x: 12, y: 11, color: '#1e2e0a' },
    ],
  },
  {
    key: 'tile_grass_path',
    name: 'Terraformed Soil / Trail Accent',
    biome: 'grassland',
    baseColor: '#365314', // Base olive grass color
    pattern: (x, y, rng) => {
      // Soft organic dithered soil patch inside grass (no hard rectangle edges)
      const dx = (x - 7.5) / 6.2;
      const dy = (y - 7.5) / 6.2;
      const dist = Math.hypot(dx, dy);
      const dither = BAYER_4X4[y % 4][x % 4];

      // Outer boundary: blend seamlessly into grass #365314 using Bayer 4x4 dither
      if (dist > 1.25) return null;
      if (dist > 0.82) {
        const blendThreshold = Math.round(((dist - 0.82) / 0.43) * 15);
        if (dither < blendThreshold) return null; // grass pixel
      }

      // Soil core with subtle organic variation
      const r = rng();
      if (r < 0.10) return '#5e2a0b';
      if (r < 0.22) return '#92400e';
      return '#78350f';
    },
  },
  {
    key: 'tile_grass_dark_patch',
    name: 'Terraformed Grass Grove Patch',
    biome: 'grassland',
    baseColor: '#283c0e',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#1e2e0a';
      if (r < 0.16) return '#365314';
      return null;
    },
  },

  // ==========================================
  // GLACIAL CRYO PLAIN / SNOW
  // Palette: Crisp cryo cyan-white
  // ==========================================
  {
    key: 'tile_snow_base',
    name: 'Cryo Snow Base',
    biome: 'snow',
    baseColor: '#dff0f8',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#cde5f0'; // crystal shadow
      if (r < 0.16) return '#f0f9ff'; // crystal glint
      return null;
    },
  },
  {
    key: 'tile_ice_sheet',
    name: 'Glacial Ice Sheet Variant',
    biome: 'snow',
    baseColor: '#c5e4f3',
    pattern: (x, y, rng) => {
      if ((x === y && x > 4 && x < 12) || (x === 15 - y && x > 8 && x < 14)) {
        return '#eaf6fd'; // ice crack highlight
      }
      const r = rng();
      if (r < 0.08) return '#b2d9ed';
      return null;
    },
  },
  {
    key: 'tile_snow_dark_patch',
    name: 'Glacial Ice Shading Patch',
    biome: 'snow',
    baseColor: '#cde4f0',
    pattern: (_x, _y, rng) => {
      const r = rng();
      if (r < 0.08) return '#bad7e6';
      if (r < 0.16) return '#dff0f8';
      return null;
    },
  },

  // ==========================================
  // PALEO WATER BASIN
  // Palette: Deep Martian ancient lake blue
  // ==========================================
  {
    key: 'tile_water_deep',
    name: 'Paleo Basin Deep Water',
    biome: 'water',
    baseColor: '#1d4ed8',
    pattern: (x, y, rng) => {
      if ((y === 3 || y === 10) && x % 4 === 0) return '#38bdf8';
      if ((y === 4 || y === 11) && x % 4 === 1) return '#2563eb';
      const r = rng();
      if (r < 0.05) return '#1e40af';
      return null;
    },
  },
  {
    key: 'tile_water_shallow',
    name: 'Paleo Basin Shallows Variant',
    biome: 'water',
    baseColor: '#2563eb',
    pattern: (x, y, rng) => {
      if ((y === 2 || y === 8 || y === 14) && (x + y) % 3 === 0) return '#60a5fa';
      const r = rng();
      if (r < 0.06) return '#1d4ed8';
      return null;
    },
  },
  {
    key: 'tile_shore_edge',
    name: 'Paleo Shoreline Transition',
    biome: 'water',
    baseColor: '#8a5c36', // wet shore soil
    pattern: (_x, y, _rng) => {
      if (y > 10) return '#1d4ed8'; // deep water border
      if (y > 7) return '#2563eb';  // shallows wave
      if (y > 5) return '#38bdf8';  // cyan foam crest
      if (y > 3) return '#744a29';  // wet mud
      return null;
    },
  },

  // ==========================================
  // BIOME TRANSITION BORDER TILES (Dithered & Natural)
  // Blends adjacent biomes smoothly to eliminate stair-stepped seams
  // ==========================================
  {
    key: 'tile_border_mars_sand',
    name: 'Transition: Mars Regolith to Sand',
    biome: 'rocky',
    baseColor: '#9c3f25', // Mars base
    pattern: (x, y, _rng) => {
      // 4x4 Bayer dither blending sand (#d99d57) into regolith (#9c3f25)
      const dither = BAYER_4X4[y % 4][x % 4];
      if (dither < 8) return '#d99d57';
      if (dither < 10) return '#c78d46';
      return null;
    },
  },
  {
    key: 'tile_border_mars_grass',
    name: 'Transition: Mars Regolith to Savanna',
    biome: 'rocky',
    baseColor: '#9c3f25',
    pattern: (x, y, _rng) => {
      const dither = BAYER_4X4[y % 4][x % 4];
      if (dither < 5) return '#365314';
      if (dither < 8) return '#4d7c0f';
      if (dither < 10) return '#6b3f20';
      return null;
    },
  },
  {
    key: 'tile_border_mars_snow',
    name: 'Transition: Mars Regolith to Cryo Snow',
    biome: 'rocky',
    baseColor: '#a88277', // Muted grey-pink permafrost dust buffer
    pattern: (x, y, _rng) => {
      // Soft organic scalloped permafrost edge (no noisy checker dither)
      const wave = Math.sin(x * 0.4) * 2.5 + Math.cos(y * 0.45) * 2.5 + Math.sin((x + y) * 0.3) * 1.5;
      if (wave > 2.0) return '#9c3f25'; // Mars regolith lobe
      if (wave > 0.8) return '#ab867c'; // warm dusty edge
      if (wave < -2.0) return '#c8d9e4'; // pale snow rime
      if (wave < -0.8) return '#b8c9d4'; // permafrost rime
      return null;
    },
  },
  {
    key: 'tile_border_snow_mars',
    name: 'Transition: Cryo Snow to Mars Regolith',
    biome: 'snow',
    baseColor: '#dbe7ee', // Soft pale permafrost snow base
    pattern: (x, y, _rng) => {
      const wave = Math.sin(x * 0.4) * 2.5 + Math.cos(y * 0.45) * 2.5 + Math.sin((x + y) * 0.3) * 1.5;
      if (wave > 2.2) return '#ab867c'; // muted dust tongue
      if (wave > 0.8) return '#b8c9d4'; // permafrost rim rime
      return null;
    },
  },
  {
    key: 'tile_border_sand_snow',
    name: 'Transition: Martian Sand to Cryo Snow',
    biome: 'desert',
    baseColor: '#b88950', // chilled dunes base
    pattern: (x, y, rng) => {
      const wave = Math.sin(x * 0.45) * 2 + Math.cos(y * 0.5) * 2;
      const dither = BAYER_4X4[y % 4][x % 4];
      const r = rng();
      if (wave + dither * 0.25 > 2.6) return '#c8d8e2';
      if (wave + dither * 0.25 > 1.6) return '#a2b4b8';
      if (r < 0.10) return '#d99d57';
      return null;
    },
  },
  {
    key: 'tile_border_sand_grass',
    name: 'Transition: Sand to Savanna',
    biome: 'desert',
    baseColor: '#d99d57',
    pattern: (x, y, _rng) => {
      const dither = BAYER_4X4[y % 4][x % 4];
      if (dither < 5) return '#365314';
      if (dither < 8) return '#4d7c0f';
      if (dither < 11) return '#857038';
      return null;
    },
  },

  // ==========================================
  // DECORATION LAYER: GROUND DETAILS (16x16 Transparent Overlays)
  // Non-blocking ground details placed in clustered patches
  // ==========================================
  {
    key: 'decor_mars_crater',
    name: 'Mars Impact Crater Detail',
    biome: 'rocky',
    // 8x6 small crater with raised rim and cast shadow
    pixels: [
      { x: 5, y: 5, color: '#bd5838' }, { x: 6, y: 5, color: '#bd5838' }, { x: 7, y: 5, color: '#bd5838' }, { x: 8, y: 5, color: '#bd5838' },
      { x: 4, y: 6, color: '#bd5838' }, { x: 5, y: 6, color: '#4a1508' }, { x: 6, y: 6, color: '#350e05' }, { x: 7, y: 6, color: '#350e05' }, { x: 8, y: 6, color: '#4a1508' }, { x: 9, y: 6, color: '#bd5838' },
      { x: 4, y: 7, color: '#bd5838' }, { x: 5, y: 7, color: '#350e05' }, { x: 6, y: 7, color: '#250803' }, { x: 7, y: 7, color: '#350e05' }, { x: 8, y: 7, color: '#7a2914' }, { x: 9, y: 7, color: '#bd5838' },
      { x: 5, y: 8, color: '#7a2914' }, { x: 6, y: 8, color: '#7a2914' }, { x: 7, y: 8, color: '#883119' }, { x: 8, y: 8, color: '#883119' },
    ],
  },
  {
    key: 'decor_mars_rubble',
    name: 'Mars Basalt Rubble Detail',
    biome: 'rocky',
    pixels: [
      { x: 4, y: 6, color: '#7a2d18' }, { x: 5, y: 6, color: '#5e1e0d' },
      { x: 4, y: 7, color: '#5e1e0d' }, { x: 10, y: 11, color: '#ad4b2e' },
      { x: 11, y: 11, color: '#7a2d18' }, { x: 11, y: 12, color: '#5e1e0d' },
      { x: 8, y: 4, color: '#ad4b2e' },
    ],
  },
  {
    key: 'decor_mars_fissure',
    name: 'Mars Soil Fracture Detail',
    biome: 'rocky',
    pixels: [
      { x: 3, y: 8, color: '#521808' }, { x: 4, y: 8, color: '#521808' },
      { x: 5, y: 9, color: '#521808' }, { x: 6, y: 9, color: '#521808' },
      { x: 7, y: 9, color: '#68200d' }, { x: 8, y: 10, color: '#521808' },
      { x: 9, y: 10, color: '#68200d' }, { x: 10, y: 11, color: '#521808' },
      { x: 7, y: 8, color: '#ad4b2e' }, { x: 8, y: 9, color: '#ad4b2e' },
    ],
  },

  // Desert Details
  {
    key: 'decor_sand_ripple',
    name: 'Desert Wind Ripple Detail',
    biome: 'desert',
    pixels: [
      { x: 3, y: 5, color: '#e8b26e' }, { x: 4, y: 5, color: '#e8b26e' }, { x: 5, y: 5, color: '#e8b26e' },
      { x: 6, y: 6, color: '#e8b26e' }, { x: 7, y: 6, color: '#e8b26e' }, { x: 8, y: 6, color: '#e8b26e' },
      { x: 9, y: 6, color: '#c28842' }, { x: 10, y: 6, color: '#c28842' }, { x: 11, y: 6, color: '#c28842' },
      { x: 12, y: 7, color: '#c28842' },
    ],
  },
  {
    key: 'decor_sand_pebbles',
    name: 'Desert Amber Grit Detail',
    biome: 'desert',
    pixels: [
      { x: 4, y: 7, color: '#8c5324' }, { x: 5, y: 7, color: '#6d3c14' },
      { x: 11, y: 12, color: '#eab673' }, { x: 12, y: 12, color: '#8c5324' },
      { x: 8, y: 4, color: '#8c5324' },
    ],
  },
  {
    key: 'decor_sand_scrub',
    name: 'Desert Dry Twig Detail',
    biome: 'desert',
    pixels: [
      { x: 6, y: 8, color: '#6d3c14' }, { x: 7, y: 8, color: '#8c5324' },
      { x: 8, y: 7, color: '#8c5324' }, { x: 9, y: 6, color: '#6d3c14' },
      { x: 8, y: 9, color: '#562f10' },
    ],
  },

  // Grassland Details
  {
    key: 'decor_grass_flower_red',
    name: 'Grassland Red Poppy Detail',
    biome: 'grassland',
    pixels: [
      { x: 6, y: 7, color: '#f43f5e' }, { x: 7, y: 7, color: '#f43f5e' },
      { x: 6, y: 8, color: '#be123c' }, { x: 7, y: 8, color: '#fef08a' },
      { x: 7, y: 9, color: '#2d5a1e' },
    ],
  },
  {
    key: 'decor_grass_flower_yellow',
    name: 'Grassland Yellow Buttercup Detail',
    biome: 'grassland',
    pixels: [
      { x: 9, y: 5, color: '#facc15' }, { x: 10, y: 5, color: '#facc15' },
      { x: 9, y: 6, color: '#ca8a04' }, { x: 10, y: 6, color: '#ffffff' },
      { x: 10, y: 7, color: '#2d5a1e' },
    ],
  },
  {
    key: 'decor_grass_flower_white',
    name: 'Grassland White Daisy Detail',
    biome: 'grassland',
    pixels: [
      { x: 4, y: 10, color: '#ffffff' }, { x: 5, y: 10, color: '#ffffff' },
      { x: 4, y: 11, color: '#e2e8f0' }, { x: 5, y: 11, color: '#fef08a' },
      { x: 5, y: 12, color: '#2d5a1e' },
    ],
  },
  {
    key: 'decor_grass_tuft',
    name: 'Grassland Grass Blade Detail',
    biome: 'grassland',
    pixels: [
      { x: 5, y: 6, color: '#2d5a1e' }, { x: 5, y: 7, color: '#387326' },
      { x: 6, y: 7, color: '#5eb04a' }, { x: 6, y: 8, color: '#2d5a1e' },
      { x: 7, y: 8, color: '#387326' },
    ],
  },

  // Snow Details
  {
    key: 'decor_snow_shard',
    name: 'Snow Cryo Ice Crystal Detail',
    biome: 'snow',
    pixels: [
      { x: 7, y: 5, color: '#ffffff' },
      { x: 6, y: 6, color: '#ffffff' }, { x: 7, y: 6, color: '#93c5fd' }, { x: 8, y: 6, color: '#ffffff' },
      { x: 7, y: 7, color: '#60a5fa' },
    ],
  },
  {
    key: 'decor_snow_mound',
    name: 'Snow Drift Mound Detail',
    biome: 'snow',
    pixels: [
      { x: 5, y: 8, color: '#f8fafc' }, { x: 6, y: 8, color: '#ffffff' }, { x: 7, y: 8, color: '#ffffff' }, { x: 8, y: 8, color: '#f8fafc' },
      { x: 4, y: 9, color: '#f8fafc' }, { x: 5, y: 9, color: '#cbd5e1' }, { x: 6, y: 9, color: '#94a3b8' }, { x: 7, y: 9, color: '#cbd5e1' }, { x: 8, y: 9, color: '#f8fafc' },
    ],
  },

  // ==========================================
  // WRECK & CRASH DEBRIS (Placed around equipment & spaceship)
  // ==========================================
  {
    key: 'decor_scorch_crater',
    name: 'Wreck Blast Scorch Mark',
    biome: 'debris',
    // 16x10 dark scorched blast ellipse
    pixels: [
      { x: 5, y: 4, color: '#381207' }, { x: 6, y: 4, color: '#280c05' }, { x: 7, y: 4, color: '#280c05' }, { x: 8, y: 4, color: '#280c05' }, { x: 9, y: 4, color: '#381207' },
      { x: 4, y: 5, color: '#381207' }, { x: 5, y: 5, color: '#200803' }, { x: 6, y: 5, color: '#160401' }, { x: 7, y: 5, color: '#160401' }, { x: 8, y: 5, color: '#200803' }, { x: 9, y: 5, color: '#381207' }, { x: 10, y: 5, color: '#4a190b' },
      { x: 3, y: 6, color: '#4a190b' }, { x: 4, y: 6, color: '#200803' }, { x: 5, y: 6, color: '#160401' }, { x: 6, y: 6, color: '#160401' }, { x: 7, y: 6, color: '#160401' }, { x: 8, y: 6, color: '#160401' }, { x: 9, y: 6, color: '#200803' }, { x: 10, y: 6, color: '#4a190b' },
      { x: 4, y: 7, color: '#4a190b' }, { x: 5, y: 7, color: '#200803' }, { x: 6, y: 7, color: '#160401' }, { x: 7, y: 7, color: '#160401' }, { x: 8, y: 7, color: '#200803' }, { x: 9, y: 7, color: '#4a190b' },
      { x: 5, y: 8, color: '#4a190b' }, { x: 6, y: 8, color: '#381207' }, { x: 7, y: 8, color: '#381207' }, { x: 8, y: 8, color: '#4a190b' },
    ],
  },
  {
    key: 'decor_metal_scrap',
    name: 'Wreck Metal Scrap Fragment',
    biome: 'debris',
    pixels: [
      { x: 7, y: 7, color: '#f1f5f9' }, { x: 8, y: 7, color: '#cbd5e1' },
      { x: 6, y: 8, color: '#94a3b8' }, { x: 7, y: 8, color: '#475569' }, { x: 8, y: 8, color: '#334155' },
      { x: 7, y: 9, color: '#1e293b' },
    ],
  },
  {
    key: 'decor_tire_track',
    name: 'Rover Wheel Rut',
    biome: 'debris',
    pixels: [
      { x: 4, y: 6, color: '#682412' }, { x: 5, y: 6, color: '#48170b' },
      { x: 7, y: 6, color: '#682412' }, { x: 8, y: 6, color: '#48170b' },
      { x: 4, y: 8, color: '#682412' }, { x: 5, y: 8, color: '#48170b' },
      { x: 7, y: 8, color: '#682412' }, { x: 8, y: 8, color: '#48170b' },
      { x: 4, y: 10, color: '#682412' }, { x: 5, y: 10, color: '#48170b' },
      { x: 7, y: 10, color: '#682412' }, { x: 8, y: 10, color: '#48170b' },
    ],
  },

  // ==========================================
  // PROCEDURAL PROPS & OBSTACLES (Replacing errant sheet slices)
  // ==========================================
  {
    key: 'prop_boulder_mars',
    name: 'Mars Basalt Boulder (Obstacle)',
    biome: 'rocky',
    width: 20,
    height: 20,
    pixels: [
      // Base ground shadow
      { x: 2, y: 18, color: '#2a0c05' }, { x: 3, y: 18, color: '#2a0c05' }, { x: 4, y: 18, color: '#2a0c05' }, { x: 5, y: 18, color: '#2a0c05' },
      { x: 6, y: 18, color: '#2a0c05' }, { x: 7, y: 18, color: '#2a0c05' }, { x: 8, y: 18, color: '#2a0c05' }, { x: 9, y: 18, color: '#2a0c05' },
      { x: 10, y: 18, color: '#2a0c05' }, { x: 11, y: 18, color: '#2a0c05' }, { x: 12, y: 18, color: '#2a0c05' }, { x: 13, y: 18, color: '#2a0c05' },
      { x: 14, y: 18, color: '#2a0c05' }, { x: 15, y: 18, color: '#2a0c05' }, { x: 16, y: 18, color: '#2a0c05' },
      // Top sun highlight rim
      { x: 6, y: 4, color: '#c86448' }, { x: 7, y: 4, color: '#c86448' }, { x: 8, y: 4, color: '#c86448' }, { x: 9, y: 4, color: '#c86448' },
      { x: 5, y: 5, color: '#c86448' }, { x: 6, y: 5, color: '#b24a30' }, { x: 7, y: 5, color: '#b24a30' }, { x: 8, y: 5, color: '#b24a30' }, { x: 9, y: 5, color: '#c86448' }, { x: 10, y: 5, color: '#b24a30' }, { x: 11, y: 5, color: '#b24a30' },
      { x: 4, y: 6, color: '#c86448' }, { x: 5, y: 6, color: '#b24a30' }, { x: 6, y: 6, color: '#9e3a22' }, { x: 7, y: 6, color: '#9e3a22' }, { x: 8, y: 6, color: '#b24a30' }, { x: 9, y: 6, color: '#9e3a22' }, { x: 10, y: 6, color: '#9e3a22' }, { x: 11, y: 6, color: '#88301a' }, { x: 12, y: 6, color: '#7a2a16' },
      // Boulder upper body
      { x: 3, y: 7, color: '#c86448' }, { x: 4, y: 7, color: '#b24a30' }, { x: 5, y: 7, color: '#9e3a22' }, { x: 6, y: 7, color: '#9e3a22' }, { x: 7, y: 7, color: '#9e3a22' }, { x: 8, y: 7, color: '#88301a' }, { x: 9, y: 7, color: '#88301a' }, { x: 10, y: 7, color: '#7a2a16' }, { x: 11, y: 7, color: '#682211' }, { x: 12, y: 7, color: '#561a0b' }, { x: 13, y: 7, color: '#441408' },
      { x: 3, y: 8, color: '#b24a30' }, { x: 4, y: 8, color: '#9e3a22' }, { x: 5, y: 8, color: '#9e3a22' }, { x: 6, y: 8, color: '#88301a' }, { x: 7, y: 8, color: '#88301a' }, { x: 8, y: 8, color: '#7a2a16' }, { x: 9, y: 8, color: '#7a2a16' }, { x: 10, y: 8, color: '#682211' }, { x: 11, y: 8, color: '#561a0b' }, { x: 12, y: 8, color: '#441408' }, { x: 13, y: 8, color: '#381006' }, { x: 14, y: 8, color: '#2a0c05' },
      // Mid body & fracture line
      { x: 2, y: 9, color: '#b24a30' }, { x: 3, y: 9, color: '#9e3a22' }, { x: 4, y: 9, color: '#9e3a22' }, { x: 5, y: 9, color: '#88301a' }, { x: 6, y: 9, color: '#441408' }, { x: 7, y: 9, color: '#381006' }, { x: 8, y: 9, color: '#7a2a16' }, { x: 9, y: 9, color: '#682211' }, { x: 10, y: 9, color: '#561a0b' }, { x: 11, y: 9, color: '#441408' }, { x: 12, y: 9, color: '#381006' }, { x: 13, y: 9, color: '#2a0c05' }, { x: 14, y: 9, color: '#2a0c05' },
      { x: 2, y: 10, color: '#9e3a22' }, { x: 3, y: 10, color: '#88301a' }, { x: 4, y: 10, color: '#88301a' }, { x: 5, y: 10, color: '#7a2a16' }, { x: 6, y: 10, color: '#441408' }, { x: 7, y: 10, color: '#682211' }, { x: 8, y: 10, color: '#561a0b' }, { x: 9, y: 10, color: '#561a0b' }, { x: 10, y: 10, color: '#441408' }, { x: 11, y: 10, color: '#381006' }, { x: 12, y: 10, color: '#2a0c05' }, { x: 13, y: 10, color: '#2a0c05' }, { x: 14, y: 10, color: '#2a0c05' },
      { x: 2, y: 11, color: '#88301a' }, { x: 3, y: 11, color: '#88301a' }, { x: 4, y: 11, color: '#7a2a16' }, { x: 5, y: 11, color: '#682211' }, { x: 6, y: 11, color: '#561a0b' }, { x: 7, y: 11, color: '#561a0b' }, { x: 8, y: 11, color: '#441408' }, { x: 9, y: 11, color: '#441408' }, { x: 10, y: 11, color: '#381006' }, { x: 11, y: 11, color: '#2a0c05' }, { x: 12, y: 11, color: '#2a0c05' }, { x: 13, y: 11, color: '#2a0c05' }, { x: 14, y: 11, color: '#2a0c05' }, { x: 15, y: 11, color: '#2a0c05' },
      // Lower body & base shading
      { x: 3, y: 12, color: '#7a2a16' }, { x: 4, y: 12, color: '#682211' }, { x: 5, y: 12, color: '#561a0b' }, { x: 6, y: 12, color: '#441408' }, { x: 7, y: 12, color: '#381006' }, { x: 8, y: 12, color: '#381006' }, { x: 9, y: 12, color: '#2a0c05' }, { x: 10, y: 12, color: '#2a0c05' }, { x: 11, y: 12, color: '#2a0c05' }, { x: 12, y: 12, color: '#2a0c05' }, { x: 13, y: 12, color: '#2a0c05' }, { x: 14, y: 12, color: '#2a0c05' },
      { x: 3, y: 13, color: '#682211' }, { x: 4, y: 13, color: '#561a0b' }, { x: 5, y: 13, color: '#441408' }, { x: 6, y: 13, color: '#381006' }, { x: 7, y: 13, color: '#2a0c05' }, { x: 8, y: 13, color: '#2a0c05' }, { x: 9, y: 13, color: '#2a0c05' }, { x: 10, y: 13, color: '#2a0c05' }, { x: 11, y: 13, color: '#2a0c05' }, { x: 12, y: 13, color: '#2a0c05' }, { x: 13, y: 13, color: '#2a0c05' },
      { x: 4, y: 14, color: '#441408' }, { x: 5, y: 14, color: '#381006' }, { x: 6, y: 14, color: '#2a0c05' }, { x: 7, y: 14, color: '#2a0c05' }, { x: 8, y: 14, color: '#2a0c05' }, { x: 9, y: 14, color: '#2a0c05' }, { x: 10, y: 14, color: '#2a0c05' }, { x: 11, y: 14, color: '#2a0c05' }, { x: 12, y: 14, color: '#2a0c05' },
      { x: 5, y: 15, color: '#2a0c05' }, { x: 6, y: 15, color: '#2a0c05' }, { x: 7, y: 15, color: '#2a0c05' }, { x: 8, y: 15, color: '#2a0c05' }, { x: 9, y: 15, color: '#2a0c05' }, { x: 10, y: 15, color: '#2a0c05' }, { x: 11, y: 15, color: '#2a0c05' },
    ],
  },
  {
    key: 'prop_rock_dark',
    name: 'Meteorite Fragment (Obstacle)',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      // Base shadow
      { x: 2, y: 14, color: '#160804' }, { x: 3, y: 14, color: '#160804' }, { x: 4, y: 14, color: '#160804' }, { x: 5, y: 14, color: '#160804' },
      { x: 6, y: 14, color: '#160804' }, { x: 7, y: 14, color: '#160804' }, { x: 8, y: 14, color: '#160804' }, { x: 9, y: 14, color: '#160804' },
      { x: 10, y: 14, color: '#160804' }, { x: 11, y: 14, color: '#160804' }, { x: 12, y: 14, color: '#160804' },
      // Rock faceted geometry
      { x: 5, y: 4, color: '#71717a' }, { x: 6, y: 4, color: '#71717a' }, { x: 7, y: 4, color: '#52525b' },
      { x: 4, y: 5, color: '#71717a' }, { x: 5, y: 5, color: '#52525b' }, { x: 6, y: 5, color: '#52525b' }, { x: 7, y: 5, color: '#3f3f46' }, { x: 8, y: 5, color: '#3f3f46' }, { x: 9, y: 5, color: '#27272a' },
      { x: 3, y: 6, color: '#71717a' }, { x: 4, y: 6, color: '#52525b' }, { x: 5, y: 6, color: '#3f3f46' }, { x: 6, y: 6, color: '#3f3f46' }, { x: 7, y: 6, color: '#27272a' }, { x: 8, y: 6, color: '#27272a' }, { x: 9, y: 6, color: '#18181b' }, { x: 10, y: 6, color: '#18181b' },
      { x: 3, y: 7, color: '#52525b' }, { x: 4, y: 7, color: '#3f3f46' }, { x: 5, y: 7, color: '#27272a' }, { x: 6, y: 7, color: '#27272a' }, { x: 7, y: 7, color: '#18181b' }, { x: 8, y: 7, color: '#18181b' }, { x: 9, y: 7, color: '#09090b' }, { x: 10, y: 7, color: '#09090b' }, { x: 11, y: 7, color: '#09090b' },
      { x: 2, y: 8, color: '#52525b' }, { x: 3, y: 8, color: '#3f3f46' }, { x: 4, y: 8, color: '#27272a' }, { x: 5, y: 8, color: '#18181b' }, { x: 6, y: 8, color: '#18181b' }, { x: 7, y: 8, color: '#09090b' }, { x: 8, y: 8, color: '#09090b' }, { x: 9, y: 8, color: '#09090b' }, { x: 10, y: 8, color: '#09090b' }, { x: 11, y: 8, color: '#09090b' },
      { x: 2, y: 9, color: '#3f3f46' }, { x: 3, y: 9, color: '#27272a' }, { x: 4, y: 9, color: '#18181b' }, { x: 5, y: 9, color: '#09090b' }, { x: 6, y: 9, color: '#09090b' }, { x: 7, y: 9, color: '#09090b' }, { x: 8, y: 9, color: '#09090b' }, { x: 9, y: 9, color: '#09090b' }, { x: 10, y: 9, color: '#09090b' }, { x: 11, y: 9, color: '#09090b' },
      { x: 3, y: 10, color: '#27272a' }, { x: 4, y: 10, color: '#18181b' }, { x: 5, y: 10, color: '#09090b' }, { x: 6, y: 10, color: '#09090b' }, { x: 7, y: 10, color: '#09090b' }, { x: 8, y: 10, color: '#09090b' }, { x: 9, y: 10, color: '#09090b' }, { x: 10, y: 10, color: '#09090b' },
      { x: 4, y: 11, color: '#18181b' }, { x: 5, y: 11, color: '#09090b' }, { x: 6, y: 11, color: '#09090b' }, { x: 7, y: 11, color: '#09090b' }, { x: 8, y: 11, color: '#09090b' }, { x: 9, y: 11, color: '#09090b' },
    ],
  },
  {
    key: 'prop_crater_small',
    name: 'Small Impact Crater',
    biome: 'rocky',
    width: 20,
    height: 20,
    pixels: [
      // Top rim highlight
      { x: 7, y: 4, color: '#bd5338' }, { x: 8, y: 4, color: '#bd5338' }, { x: 9, y: 4, color: '#bd5338' }, { x: 10, y: 4, color: '#bd5338' }, { x: 11, y: 4, color: '#bd5338' }, { x: 12, y: 4, color: '#bd5338' },
      { x: 5, y: 5, color: '#bd5338' }, { x: 6, y: 5, color: '#bd5338' }, { x: 7, y: 5, color: '#a03b22' }, { x: 8, y: 5, color: '#661f0f' }, { x: 9, y: 5, color: '#441408' }, { x: 10, y: 5, color: '#441408' }, { x: 11, y: 5, color: '#661f0f' }, { x: 12, y: 5, color: '#a03b22' }, { x: 13, y: 5, color: '#bd5338' }, { x: 14, y: 5, color: '#bd5338' },
      // Inner crater shadow bowl
      { x: 4, y: 6, color: '#bd5338' }, { x: 5, y: 6, color: '#a03b22' }, { x: 6, y: 6, color: '#661f0f' }, { x: 7, y: 6, color: '#381006' }, { x: 8, y: 6, color: '#280c05' }, { x: 9, y: 6, color: '#200803' }, { x: 10, y: 6, color: '#200803' }, { x: 11, y: 6, color: '#280c05' }, { x: 12, y: 6, color: '#381006' }, { x: 13, y: 6, color: '#661f0f' }, { x: 14, y: 6, color: '#a03b22' }, { x: 15, y: 6, color: '#bd5338' },
      { x: 4, y: 7, color: '#a03b22' }, { x: 5, y: 7, color: '#661f0f' }, { x: 6, y: 7, color: '#381006' }, { x: 7, y: 7, color: '#200803' }, { x: 8, y: 7, color: '#180502' }, { x: 9, y: 7, color: '#180502' }, { x: 10, y: 7, color: '#180502' }, { x: 11, y: 7, color: '#180502' }, { x: 12, y: 7, color: '#200803' }, { x: 13, y: 7, color: '#381006' }, { x: 14, y: 7, color: '#661f0f' }, { x: 15, y: 7, color: '#a03b22' },
      // Crater floor (red sandy bottom)
      { x: 3, y: 8, color: '#a03b22' }, { x: 4, y: 8, color: '#661f0f' }, { x: 5, y: 8, color: '#280c05' }, { x: 6, y: 8, color: '#180502' }, { x: 7, y: 8, color: '#441408' }, { x: 8, y: 8, color: '#551a0b' }, { x: 9, y: 8, color: '#551a0b' }, { x: 10, y: 8, color: '#551a0b' }, { x: 11, y: 8, color: '#441408' }, { x: 12, y: 8, color: '#200803' }, { x: 13, y: 8, color: '#280c05' }, { x: 14, y: 8, color: '#661f0f' }, { x: 15, y: 8, color: '#a03b22' }, { x: 16, y: 8, color: '#88301a' },
      { x: 4, y: 9, color: '#661f0f' }, { x: 5, y: 9, color: '#381006' }, { x: 6, y: 9, color: '#280c05' }, { x: 7, y: 9, color: '#551a0b' }, { x: 8, y: 9, color: '#7a2713' }, { x: 9, y: 9, color: '#7a2713' }, { x: 10, y: 9, color: '#7a2713' }, { x: 11, y: 9, color: '#551a0b' }, { x: 12, y: 9, color: '#381006' }, { x: 13, y: 9, color: '#441408' }, { x: 14, y: 9, color: '#661f0f' }, { x: 15, y: 9, color: '#88301a' },
      // Lower rim slope
      { x: 5, y: 10, color: '#441408' }, { x: 6, y: 10, color: '#381006' }, { x: 7, y: 10, color: '#441408' }, { x: 8, y: 10, color: '#551a0b' }, { x: 9, y: 10, color: '#551a0b' }, { x: 10, y: 10, color: '#551a0b' }, { x: 11, y: 10, color: '#441408' }, { x: 12, y: 10, color: '#381006' }, { x: 13, y: 10, color: '#441408' }, { x: 14, y: 10, color: '#661f0f' },
      { x: 6, y: 11, color: '#441408' }, { x: 7, y: 11, color: '#441408' }, { x: 8, y: 11, color: '#441408' }, { x: 9, y: 11, color: '#441408' }, { x: 10, y: 11, color: '#441408' }, { x: 11, y: 11, color: '#441408' }, { x: 12, y: 11, color: '#441408' }, { x: 13, y: 11, color: '#441408' },
    ],
  },

  // ==========================================
  // DESERT PROPS & FORMATIONS (Replacing errant lime cactus)
  // ==========================================
  {
    key: 'prop_sand_ventifact',
    name: 'Wind-Carved Desert Ventifact (Obstacle)',
    biome: 'desert',
    width: 16,
    height: 18,
    pixels: [
      // Base shadow on sand
      { x: 3, y: 16, color: '#5e2a0b' }, { x: 4, y: 16, color: '#5e2a0b' }, { x: 5, y: 16, color: '#5e2a0b' }, { x: 6, y: 16, color: '#5e2a0b' },
      { x: 7, y: 16, color: '#5e2a0b' }, { x: 8, y: 16, color: '#5e2a0b' }, { x: 9, y: 16, color: '#5e2a0b' }, { x: 10, y: 16, color: '#5e2a0b' },
      { x: 11, y: 16, color: '#5e2a0b' }, { x: 12, y: 16, color: '#5e2a0b' },
      // Aerodynamic wind-carved faceted rock
      { x: 7, y: 5, color: '#f59e0b' }, { x: 8, y: 5, color: '#d97706' },
      { x: 6, y: 6, color: '#f59e0b' }, { x: 7, y: 6, color: '#d97706' }, { x: 8, y: 6, color: '#b45309' }, { x: 9, y: 6, color: '#92400e' },
      { x: 5, y: 7, color: '#f59e0b' }, { x: 6, y: 7, color: '#d97706' }, { x: 7, y: 7, color: '#b45309' }, { x: 8, y: 7, color: '#92400e' }, { x: 9, y: 7, color: '#78350f' }, { x: 10, y: 7, color: '#78350f' },
      { x: 4, y: 8, color: '#fbbf24' }, { x: 5, y: 8, color: '#d97706' }, { x: 6, y: 8, color: '#b45309' }, { x: 7, y: 8, color: '#92400e' }, { x: 8, y: 8, color: '#78350f' }, { x: 9, y: 8, color: '#451a03' }, { x: 10, y: 8, color: '#451a03' }, { x: 11, y: 8, color: '#451a03' },
      { x: 4, y: 9, color: '#d97706' }, { x: 5, y: 9, color: '#b45309' }, { x: 6, y: 9, color: '#92400e' }, { x: 7, y: 9, color: '#78350f' }, { x: 8, y: 9, color: '#78350f' }, { x: 9, y: 9, color: '#451a03' }, { x: 10, y: 9, color: '#451a03' }, { x: 11, y: 9, color: '#451a03' }, { x: 12, y: 9, color: '#451a03' },
      { x: 3, y: 10, color: '#d97706' }, { x: 4, y: 10, color: '#b45309' }, { x: 5, y: 10, color: '#92400e' }, { x: 6, y: 10, color: '#78350f' }, { x: 7, y: 10, color: '#451a03' }, { x: 8, y: 10, color: '#451a03' }, { x: 9, y: 10, color: '#451a03' }, { x: 10, y: 10, color: '#451a03' }, { x: 11, y: 10, color: '#451a03' }, { x: 12, y: 10, color: '#451a03' },
      { x: 3, y: 11, color: '#b45309' }, { x: 4, y: 11, color: '#92400e' }, { x: 5, y: 11, color: '#78350f' }, { x: 6, y: 11, color: '#451a03' }, { x: 7, y: 11, color: '#451a03' }, { x: 8, y: 11, color: '#451a03' }, { x: 9, y: 11, color: '#451a03' }, { x: 10, y: 11, color: '#451a03' }, { x: 11, y: 11, color: '#451a03' }, { x: 12, y: 11, color: '#451a03' },
      { x: 4, y: 12, color: '#92400e' }, { x: 5, y: 12, color: '#78350f' }, { x: 6, y: 12, color: '#451a03' }, { x: 7, y: 12, color: '#451a03' }, { x: 8, y: 12, color: '#451a03' }, { x: 9, y: 12, color: '#451a03' }, { x: 10, y: 12, color: '#451a03' }, { x: 11, y: 12, color: '#451a03' },
      { x: 5, y: 13, color: '#78350f' }, { x: 6, y: 13, color: '#451a03' }, { x: 7, y: 13, color: '#451a03' }, { x: 8, y: 13, color: '#451a03' }, { x: 9, y: 13, color: '#451a03' }, { x: 10, y: 13, color: '#451a03' },
      { x: 6, y: 14, color: '#451a03' }, { x: 7, y: 14, color: '#451a03' }, { x: 8, y: 14, color: '#451a03' }, { x: 9, y: 14, color: '#451a03' },
    ],
  },

  // ==========================================
  // MARS PLAINS LANDMARKS & VARIETY DETAILS
  // ==========================================
  {
    key: 'decor_dune_ridge',
    name: 'Mars Wind-Sculpted Dune Ridge',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      // Sinuous ripple wave
      { x: 2, y: 7, color: '#bd5338' }, { x: 3, y: 7, color: '#bd5338' }, { x: 4, y: 6, color: '#bd5338' },
      { x: 5, y: 6, color: '#c86448' }, { x: 6, y: 5, color: '#c86448' }, { x: 7, y: 5, color: '#bd5338' },
      { x: 8, y: 6, color: '#bd5338' }, { x: 9, y: 6, color: '#c86448' }, { x: 10, y: 7, color: '#bd5338' },
      { x: 11, y: 7, color: '#bd5338' }, { x: 12, y: 8, color: '#bd5338' }, { x: 13, y: 8, color: '#bd5338' },
      // Shadow lee side
      { x: 2, y: 8, color: '#7a2a16' }, { x: 3, y: 8, color: '#7a2a16' }, { x: 4, y: 7, color: '#682211' },
      { x: 5, y: 7, color: '#682211' }, { x: 6, y: 6, color: '#682211' }, { x: 7, y: 6, color: '#7a2a16' },
      { x: 8, y: 7, color: '#7a2a16' }, { x: 9, y: 7, color: '#682211' }, { x: 10, y: 8, color: '#682211' },
      { x: 11, y: 8, color: '#7a2a16' }, { x: 12, y: 9, color: '#7a2a16' }, { x: 13, y: 9, color: '#682211' },
    ],
  },
  {
    key: 'decor_crater_ring',
    name: 'Mars Large Crater Ring with Raised Rim',
    biome: 'rocky',
    width: 20,
    height: 20,
    pixels: [
      // Top rim highlight
      { x: 7, y: 3, color: '#c86448' }, { x: 8, y: 3, color: '#c86448' }, { x: 9, y: 3, color: '#c86448' }, { x: 10, y: 3, color: '#c86448' }, { x: 11, y: 3, color: '#c86448' }, { x: 12, y: 3, color: '#c86448' },
      { x: 5, y: 4, color: '#c86448' }, { x: 6, y: 4, color: '#b24a30' }, { x: 13, y: 4, color: '#b24a30' }, { x: 14, y: 4, color: '#c86448' },
      { x: 4, y: 5, color: '#c86448' }, { x: 15, y: 5, color: '#c86448' },
      // Inner shadow bowl
      { x: 6, y: 5, color: '#682211' }, { x: 7, y: 5, color: '#441408' }, { x: 8, y: 5, color: '#381006' }, { x: 9, y: 5, color: '#381006' }, { x: 10, y: 5, color: '#441408' }, { x: 11, y: 5, color: '#682211' },
      { x: 5, y: 6, color: '#682211' }, { x: 6, y: 6, color: '#441408' }, { x: 7, y: 6, color: '#2a0c05' }, { x: 8, y: 6, color: '#2a0c05' }, { x: 9, y: 6, color: '#2a0c05' }, { x: 10, y: 6, color: '#2a0c05' }, { x: 11, y: 6, color: '#441408' }, { x: 12, y: 6, color: '#441408' }, { x: 13, y: 6, color: '#682211' },
      // Floor center & rim slope
      { x: 6, y: 7, color: '#441408' }, { x: 7, y: 7, color: '#2a0c05' }, { x: 8, y: 7, color: '#561a0b' }, { x: 9, y: 7, color: '#561a0b' }, { x: 10, y: 7, color: '#561a0b' }, { x: 11, y: 7, color: '#441408' }, { x: 12, y: 7, color: '#441408' },
      { x: 7, y: 8, color: '#561a0b' }, { x: 8, y: 8, color: '#7a2a16' }, { x: 9, y: 8, color: '#7a2a16' }, { x: 10, y: 8, color: '#7a2a16' }, { x: 11, y: 8, color: '#561a0b' },
      { x: 6, y: 9, color: '#682211' }, { x: 7, y: 9, color: '#7a2a16' }, { x: 8, y: 9, color: '#88301a' }, { x: 9, y: 9, color: '#88301a' }, { x: 10, y: 9, color: '#88301a' }, { x: 11, y: 9, color: '#7a2a16' }, { x: 12, y: 9, color: '#682211' },
      // Ejecta rays
      { x: 16, y: 3, color: '#b24a30' }, { x: 17, y: 2, color: '#ad4b2e' },
      { x: 3, y: 4, color: '#b24a30' }, { x: 2, y: 3, color: '#ad4b2e' },
      { x: 9, y: 12, color: '#682211' }, { x: 10, y: 13, color: '#561a0b' },
    ],
  },
  {
    key: 'decor_dust_devil_track',
    name: 'Mars Dust-Devil Dark Swirl Track',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      // Curved dark trail exposing basalt under dust
      { x: 3, y: 12, color: '#682211' }, { x: 4, y: 11, color: '#561a0b' }, { x: 5, y: 10, color: '#561a0b' },
      { x: 6, y: 9, color: '#561a0b' }, { x: 7, y: 8, color: '#441408' }, { x: 8, y: 8, color: '#441408' },
      { x: 9, y: 7, color: '#441408' }, { x: 10, y: 6, color: '#561a0b' }, { x: 11, y: 5, color: '#561a0b' },
      { x: 12, y: 4, color: '#682211' }, { x: 13, y: 3, color: '#7a2a16' },
      // Thin secondary vortex loop
      { x: 8, y: 9, color: '#561a0b' }, { x: 9, y: 9, color: '#561a0b' }, { x: 10, y: 8, color: '#682211' },
    ],
  },
  {
    key: 'decor_riverbed_gravel',
    name: 'Ancient Paleochannel Riverbed Gravel',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      { x: 4, y: 6, color: '#7a2a16' }, { x: 5, y: 6, color: '#561a0b' }, { x: 5, y: 7, color: '#381006' },
      { x: 9, y: 8, color: '#682211' }, { x: 10, y: 8, color: '#441408' }, { x: 10, y: 9, color: '#2a0c05' },
      { x: 7, y: 11, color: '#7a2a16' }, { x: 8, y: 11, color: '#561a0b' },
      { x: 12, y: 12, color: '#682211' }, { x: 13, y: 12, color: '#441408' },
      { x: 3, y: 13, color: '#561a0b' }, { x: 4, y: 13, color: '#381006' },
    ],
  },
  {
    key: 'prop_outcrop_cluster',
    name: 'Mars Basalt Outcrop Cluster (Obstacle)',
    biome: 'rocky',
    width: 24,
    height: 20,
    pixels: [
      // Ground shadow
      { x: 3, y: 17, color: '#2a0c05' }, { x: 4, y: 17, color: '#2a0c05' }, { x: 5, y: 17, color: '#2a0c05' }, { x: 6, y: 17, color: '#2a0c05' },
      { x: 7, y: 17, color: '#2a0c05' }, { x: 8, y: 17, color: '#2a0c05' }, { x: 9, y: 17, color: '#2a0c05' }, { x: 10, y: 17, color: '#2a0c05' },
      { x: 11, y: 17, color: '#2a0c05' }, { x: 12, y: 17, color: '#2a0c05' }, { x: 13, y: 17, color: '#2a0c05' }, { x: 14, y: 17, color: '#2a0c05' },
      { x: 15, y: 17, color: '#2a0c05' }, { x: 16, y: 17, color: '#2a0c05' }, { x: 17, y: 17, color: '#2a0c05' }, { x: 18, y: 17, color: '#2a0c05' },
      { x: 19, y: 17, color: '#2a0c05' }, { x: 20, y: 17, color: '#2a0c05' },
      // Left Spire
      { x: 6, y: 4, color: '#c86448' }, { x: 7, y: 4, color: '#b24a30' },
      { x: 5, y: 5, color: '#c86448' }, { x: 6, y: 5, color: '#b24a30' }, { x: 7, y: 5, color: '#9e3a22' }, { x: 8, y: 5, color: '#682211' },
      { x: 5, y: 6, color: '#b24a30' }, { x: 6, y: 6, color: '#9e3a22' }, { x: 7, y: 6, color: '#7a2a16' }, { x: 8, y: 6, color: '#561a0b' },
      { x: 4, y: 7, color: '#b24a30' }, { x: 5, y: 7, color: '#9e3a22' }, { x: 6, y: 7, color: '#7a2a16' }, { x: 7, y: 7, color: '#561a0b' }, { x: 8, y: 7, color: '#441408' },
      // Tall Center Spire
      { x: 12, y: 2, color: '#c86448' }, { x: 13, y: 2, color: '#b24a30' },
      { x: 11, y: 3, color: '#c86448' }, { x: 12, y: 3, color: '#b24a30' }, { x: 13, y: 3, color: '#9e3a22' }, { x: 14, y: 3, color: '#7a2a16' },
      { x: 11, y: 4, color: '#b24a30' }, { x: 12, y: 4, color: '#9e3a22' }, { x: 13, y: 4, color: '#88301a' }, { x: 14, y: 4, color: '#682211' }, { x: 15, y: 4, color: '#441408' },
      { x: 10, y: 5, color: '#b24a30' }, { x: 11, y: 5, color: '#9e3a22' }, { x: 12, y: 5, color: '#88301a' }, { x: 13, y: 5, color: '#682211' }, { x: 14, y: 5, color: '#561a0b' }, { x: 15, y: 5, color: '#441408' },
      // Right Spire
      { x: 17, y: 5, color: '#c86448' }, { x: 18, y: 5, color: '#b24a30' },
      { x: 16, y: 6, color: '#c86448' }, { x: 17, y: 6, color: '#9e3a22' }, { x: 18, y: 6, color: '#7a2a16' }, { x: 19, y: 6, color: '#561a0b' },
      { x: 16, y: 7, color: '#b24a30' }, { x: 17, y: 7, color: '#88301a' }, { x: 18, y: 7, color: '#682211' }, { x: 19, y: 7, color: '#441408' },
      // Massive Lower Body Connecting Formations
      { x: 4, y: 8, color: '#9e3a22' }, { x: 5, y: 8, color: '#88301a' }, { x: 6, y: 8, color: '#7a2a16' }, { x: 7, y: 8, color: '#682211' }, { x: 8, y: 8, color: '#561a0b' }, { x: 9, y: 8, color: '#561a0b' }, { x: 10, y: 8, color: '#682211' }, { x: 11, y: 8, color: '#7a2a16' }, { x: 12, y: 8, color: '#682211' }, { x: 13, y: 8, color: '#561a0b' }, { x: 14, y: 8, color: '#441408' }, { x: 15, y: 8, color: '#441408' }, { x: 16, y: 8, color: '#561a0b' }, { x: 17, y: 8, color: '#682211' }, { x: 18, y: 8, color: '#561a0b' }, { x: 19, y: 8, color: '#441408' },
      { x: 4, y: 9, color: '#88301a' }, { x: 5, y: 9, color: '#7a2a16' }, { x: 6, y: 9, color: '#682211' }, { x: 7, y: 9, color: '#561a0b' }, { x: 8, y: 9, color: '#441408' }, { x: 9, y: 9, color: '#441408' }, { x: 10, y: 9, color: '#561a0b' }, { x: 11, y: 9, color: '#682211' }, { x: 12, y: 9, color: '#561a0b' }, { x: 13, y: 9, color: '#441408' }, { x: 14, y: 9, color: '#381006' }, { x: 15, y: 9, color: '#381006' }, { x: 16, y: 9, color: '#441408' }, { x: 17, y: 9, color: '#561a0b' }, { x: 18, y: 9, color: '#441408' }, { x: 19, y: 9, color: '#381006' },
      { x: 4, y: 10, color: '#7a2a16' }, { x: 5, y: 10, color: '#682211' }, { x: 6, y: 10, color: '#561a0b' }, { x: 7, y: 10, color: '#441408' }, { x: 8, y: 10, color: '#381006' }, { x: 9, y: 10, color: '#381006' }, { x: 10, y: 10, color: '#441408' }, { x: 11, y: 10, color: '#561a0b' }, { x: 12, y: 10, color: '#441408' }, { x: 13, y: 10, color: '#381006' }, { x: 14, y: 10, color: '#2a0c05' }, { x: 15, y: 10, color: '#2a0c05' }, { x: 16, y: 10, color: '#381006' }, { x: 17, y: 10, color: '#441408' }, { x: 18, y: 10, color: '#381006' }, { x: 19, y: 10, color: '#2a0c05' },
      { x: 5, y: 11, color: '#682211' }, { x: 6, y: 11, color: '#561a0b' }, { x: 7, y: 11, color: '#441408' }, { x: 8, y: 11, color: '#381006' }, { x: 9, y: 11, color: '#2a0c05' }, { x: 10, y: 11, color: '#381006' }, { x: 11, y: 11, color: '#441408' }, { x: 12, y: 11, color: '#381006' }, { x: 13, y: 11, color: '#2a0c05' }, { x: 14, y: 11, color: '#2a0c05' }, { x: 15, y: 11, color: '#2a0c05' }, { x: 16, y: 11, color: '#2a0c05' }, { x: 17, y: 11, color: '#381006' }, { x: 18, y: 11, color: '#2a0c05' },
      { x: 5, y: 12, color: '#561a0b' }, { x: 6, y: 12, color: '#441408' }, { x: 7, y: 12, color: '#381006' }, { x: 8, y: 12, color: '#2a0c05' }, { x: 9, y: 12, color: '#2a0c05' }, { x: 10, y: 12, color: '#2a0c05' }, { x: 11, y: 12, color: '#381006' }, { x: 12, y: 12, color: '#2a0c05' }, { x: 13, y: 12, color: '#2a0c05' }, { x: 14, y: 12, color: '#2a0c05' }, { x: 15, y: 12, color: '#2a0c05' }, { x: 16, y: 12, color: '#2a0c05' }, { x: 17, y: 12, color: '#2a0c05' },
      { x: 6, y: 13, color: '#441408' }, { x: 7, y: 13, color: '#381006' }, { x: 8, y: 13, color: '#2a0c05' }, { x: 9, y: 13, color: '#2a0c05' }, { x: 10, y: 13, color: '#2a0c05' }, { x: 11, y: 13, color: '#2a0c05' }, { x: 12, y: 13, color: '#2a0c05' }, { x: 13, y: 13, color: '#2a0c05' }, { x: 14, y: 13, color: '#2a0c05' }, { x: 15, y: 13, color: '#2a0c05' }, { x: 16, y: 13, color: '#2a0c05' },
      { x: 6, y: 14, color: '#381006' }, { x: 7, y: 14, color: '#2a0c05' }, { x: 8, y: 14, color: '#2a0c05' }, { x: 9, y: 14, color: '#2a0c05' }, { x: 10, y: 14, color: '#2a0c05' }, { x: 11, y: 14, color: '#2a0c05' }, { x: 12, y: 14, color: '#2a0c05' }, { x: 13, y: 14, color: '#2a0c05' }, { x: 14, y: 14, color: '#2a0c05' }, { x: 15, y: 14, color: '#2a0c05' },
      { x: 7, y: 15, color: '#2a0c05' }, { x: 8, y: 15, color: '#2a0c05' }, { x: 9, y: 15, color: '#2a0c05' }, { x: 10, y: 15, color: '#2a0c05' }, { x: 11, y: 15, color: '#2a0c05' }, { x: 12, y: 15, color: '#2a0c05' }, { x: 13, y: 15, color: '#2a0c05' }, { x: 14, y: 15, color: '#2a0c05' },
    ],
  },

  // ==========================================
  // SNOW & CRYO BORDER DETAILS
  // ==========================================
  {
    key: 'decor_snow_drift',
    name: 'Glacial Cryo Snow Drift Ridge',
    biome: 'snow',
    width: 16,
    height: 16,
    pixels: [
      { x: 3, y: 8, color: '#f0f9ff' }, { x: 4, y: 8, color: '#ffffff' }, { x: 5, y: 7, color: '#ffffff' },
      { x: 6, y: 7, color: '#ffffff' }, { x: 7, y: 7, color: '#f0f9ff' }, { x: 8, y: 8, color: '#ffffff' },
      { x: 9, y: 8, color: '#ffffff' }, { x: 10, y: 8, color: '#f0f9ff' }, { x: 11, y: 9, color: '#f0f9ff' },
      { x: 3, y: 9, color: '#cde5f0' }, { x: 4, y: 9, color: '#bad7e6' }, { x: 5, y: 8, color: '#cde5f0' },
      { x: 6, y: 8, color: '#bad7e6' }, { x: 7, y: 8, color: '#cde5f0' }, { x: 8, y: 9, color: '#bad7e6' },
      { x: 9, y: 9, color: '#cde5f0' }, { x: 10, y: 9, color: '#bad7e6' }, { x: 11, y: 10, color: '#bad7e6' },
    ],
  },
  {
    key: 'decor_frost_rim',
    name: 'Permafrost Ice Rim Detail',
    biome: 'snow',
    width: 16,
    height: 16,
    pixels: [
      { x: 5, y: 6, color: '#ffffff' }, { x: 6, y: 6, color: '#93c5fd' }, { x: 7, y: 6, color: '#ffffff' },
      { x: 6, y: 7, color: '#60a5fa' }, { x: 10, y: 10, color: '#ffffff' }, { x: 11, y: 10, color: '#93c5fd' },
      { x: 10, y: 11, color: '#60a5fa' },
    ],
  },
  {
    key: 'prop_ice_crystal_cluster',
    name: 'Glacial Ice Crystal Spire (Obstacle)',
    biome: 'snow',
    width: 16,
    height: 20,
    pixels: [
      // Base shadow on snow
      { x: 3, y: 18, color: '#94a3b8' }, { x: 4, y: 18, color: '#94a3b8' }, { x: 5, y: 18, color: '#94a3b8' }, { x: 6, y: 18, color: '#94a3b8' },
      { x: 7, y: 18, color: '#94a3b8' }, { x: 8, y: 18, color: '#94a3b8' }, { x: 9, y: 18, color: '#94a3b8' }, { x: 10, y: 18, color: '#94a3b8' },
      { x: 11, y: 18, color: '#94a3b8' }, { x: 12, y: 18, color: '#94a3b8' },
      // Crystal Spire Apex
      { x: 8, y: 3, color: '#ffffff' },
      { x: 7, y: 4, color: '#ffffff' }, { x: 8, y: 4, color: '#e0f2fe' }, { x: 9, y: 4, color: '#bae6fd' },
      { x: 7, y: 5, color: '#ffffff' }, { x: 8, y: 5, color: '#bae6fd' }, { x: 9, y: 5, color: '#7dd3fc' },
      { x: 6, y: 6, color: '#ffffff' }, { x: 7, y: 6, color: '#e0f2fe' }, { x: 8, y: 6, color: '#7dd3fc' }, { x: 9, y: 6, color: '#38bdf8' }, { x: 10, y: 6, color: '#0284c7' },
      { x: 6, y: 7, color: '#e0f2fe' }, { x: 7, y: 7, color: '#bae6fd' }, { x: 8, y: 7, color: '#38bdf8' }, { x: 9, y: 7, color: '#0284c7' }, { x: 10, y: 7, color: '#0369a1' },
      { x: 5, y: 8, color: '#ffffff' }, { x: 6, y: 8, color: '#bae6fd' }, { x: 7, y: 8, color: '#38bdf8' }, { x: 8, y: 8, color: '#0284c7' }, { x: 9, y: 8, color: '#0369a1' }, { x: 10, y: 8, color: '#075985' },
      { x: 5, y: 9, color: '#e0f2fe' }, { x: 6, y: 9, color: '#7dd3fc' }, { x: 7, y: 9, color: '#0284c7' }, { x: 8, y: 9, color: '#0369a1' }, { x: 9, y: 9, color: '#075985' }, { x: 10, y: 9, color: '#0c4a6e' },
      // Secondary Crystal Flank
      { x: 3, y: 11, color: '#ffffff' }, { x: 4, y: 11, color: '#bae6fd' }, { x: 5, y: 11, color: '#38bdf8' }, { x: 6, y: 11, color: '#0284c7' }, { x: 7, y: 11, color: '#0369a1' }, { x: 8, y: 11, color: '#075985' }, { x: 9, y: 11, color: '#0c4a6e' }, { x: 10, y: 11, color: '#0c4a6e' }, { x: 11, y: 11, color: '#38bdf8' }, { x: 12, y: 11, color: '#0284c7' },
      { x: 3, y: 12, color: '#bae6fd' }, { x: 4, y: 12, color: '#7dd3fc' }, { x: 5, y: 12, color: '#0284c7' }, { x: 6, y: 12, color: '#0369a1' }, { x: 7, y: 12, color: '#075985' }, { x: 8, y: 12, color: '#0c4a6e' }, { x: 9, y: 12, color: '#0c4a6e' }, { x: 10, y: 12, color: '#0c4a6e' }, { x: 11, y: 12, color: '#0284c7' }, { x: 12, y: 12, color: '#0369a1' },
      { x: 4, y: 13, color: '#0284c7' }, { x: 5, y: 13, color: '#0369a1' }, { x: 6, y: 13, color: '#075985' }, { x: 7, y: 13, color: '#0c4a6e' }, { x: 8, y: 13, color: '#0c4a6e' }, { x: 9, y: 13, color: '#0c4a6e' }, { x: 10, y: 13, color: '#0c4a6e' }, { x: 11, y: 13, color: '#0369a1' },
      { x: 4, y: 14, color: '#0369a1' }, { x: 5, y: 14, color: '#075985' }, { x: 6, y: 14, color: '#0c4a6e' }, { x: 7, y: 14, color: '#0c4a6e' }, { x: 8, y: 14, color: '#0c4a6e' }, { x: 9, y: 14, color: '#0c4a6e' }, { x: 10, y: 14, color: '#0c4a6e' }, { x: 11, y: 14, color: '#075985' },
      { x: 5, y: 15, color: '#075985' }, { x: 6, y: 15, color: '#0c4a6e' }, { x: 7, y: 15, color: '#0c4a6e' }, { x: 8, y: 15, color: '#0c4a6e' }, { x: 9, y: 15, color: '#0c4a6e' }, { x: 10, y: 15, color: '#075985' },
      { x: 6, y: 16, color: '#0c4a6e' }, { x: 7, y: 16, color: '#0c4a6e' }, { x: 8, y: 16, color: '#0c4a6e' }, { x: 9, y: 16, color: '#0c4a6e' },
    ],
  },

  // ==========================================
  // UNIQUE WRECK SPRITES (8 MISSIONS: AVAILABLE + STRIPPED)
  // ==========================================
  ...WRECK_SPRITE_DEFS,

  // ==========================================
  // PROCEDURAL CHARACTERS, ICONS, & SPACESHIP (100% CC0)
  // ==========================================
  ...CHARACTER_SPRITE_DEFS,

  // ==========================================
  // MARTIAN FIELD SCIENCE SAMPLES (100% CC0)
  // ==========================================
  {
    key: 'sample_hematite_blueberry',
    name: 'Hematite Spherule Blueberry',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      { x: 5, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 10, y: 13, color: 'rgba(0,0,0,0.5)' },
      { x: 6, y: 6, color: '#475569' }, { x: 7, y: 6, color: '#64748b' }, { x: 8, y: 6, color: '#64748b' }, { x: 9, y: 6, color: '#475569' },
      { x: 5, y: 7, color: '#64748b' }, { x: 6, y: 7, color: '#94a3b8' }, { x: 7, y: 7, color: '#f8fafc' }, { x: 8, y: 7, color: '#cbd5e1' }, { x: 9, y: 7, color: '#64748b' }, { x: 10, y: 7, color: '#334155' },
      { x: 5, y: 8, color: '#64748b' }, { x: 6, y: 8, color: '#94a3b8' }, { x: 7, y: 8, color: '#94a3b8' }, { x: 8, y: 8, color: '#64748b' }, { x: 9, y: 8, color: '#475569' }, { x: 10, y: 8, color: '#1e293b' },
      { x: 5, y: 9, color: '#475569' }, { x: 6, y: 9, color: '#475569' }, { x: 7, y: 9, color: '#334155' }, { x: 8, y: 9, color: '#334155' }, { x: 9, y: 9, color: '#1e293b' }, { x: 10, y: 9, color: '#0f172a' },
      { x: 6, y: 10, color: '#334155' }, { x: 7, y: 10, color: '#1e293b' }, { x: 8, y: 10, color: '#1e293b' }, { x: 9, y: 10, color: '#0f172a' },
      { x: 7, y: 4, color: 'rgba(56,189,248,0.7)' }, { x: 8, y: 5, color: 'rgba(56,189,248,0.9)' },
    ],
  },
  {
    key: 'sample_olivine_crystal',
    name: 'Volcanic Olivine Geode',
    biome: 'rocky',
    width: 16,
    height: 16,
    pixels: [
      { x: 4, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 5, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 10, y: 13, color: 'rgba(0,0,0,0.5)' },
      { x: 7, y: 4, color: '#ecfccb' }, { x: 8, y: 4, color: '#ffffff' },
      { x: 6, y: 5, color: '#bef264' }, { x: 7, y: 5, color: '#a3e635' }, { x: 8, y: 5, color: '#84cc16' }, { x: 9, y: 5, color: '#65a30d' },
      { x: 5, y: 6, color: '#ecfccb' }, { x: 6, y: 6, color: '#a3e635' }, { x: 7, y: 6, color: '#84cc16' }, { x: 8, y: 6, color: '#4d7c0f' }, { x: 9, y: 6, color: '#365314' },
      { x: 5, y: 7, color: '#a3e635' }, { x: 6, y: 7, color: '#84cc16' }, { x: 7, y: 7, color: '#4d7c0f' }, { x: 8, y: 7, color: '#365314' }, { x: 9, y: 7, color: '#1a2e05' },
      { x: 4, y: 8, color: '#ecfccb' }, { x: 5, y: 8, color: '#84cc16' }, { x: 6, y: 8, color: '#4d7c0f' }, { x: 7, y: 8, color: '#365314' }, { x: 8, y: 8, color: '#1a2e05' }, { x: 10, y: 8, color: '#4d7c0f' },
      { x: 4, y: 9, color: '#84cc16' }, { x: 5, y: 9, color: '#4d7c0f' }, { x: 6, y: 9, color: '#365314' }, { x: 7, y: 9, color: '#1a2e05' }, { x: 8, y: 9, color: '#1a2e05' }, { x: 9, y: 9, color: '#365314' },
      { x: 5, y: 10, color: '#365314' }, { x: 6, y: 10, color: '#1a2e05' }, { x: 7, y: 10, color: '#1a2e05' }, { x: 8, y: 10, color: '#1a2e05' },
    ],
  },
  {
    key: 'sample_cryo_ice_core',
    name: 'Polar Cryo-Ice Core',
    biome: 'snow',
    width: 16,
    height: 16,
    pixels: [
      { x: 5, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.4)' },
      { x: 6, y: 4, color: '#ffffff' }, { x: 7, y: 4, color: '#f0f9ff' }, { x: 8, y: 4, color: '#e0f2fe' },
      { x: 5, y: 5, color: '#ffffff' }, { x: 6, y: 5, color: '#e0f2fe' }, { x: 7, y: 5, color: '#bae6fd' }, { x: 8, y: 5, color: '#7dd3fc' }, { x: 9, y: 5, color: '#38bdf8' },
      { x: 5, y: 6, color: '#f0f9ff' }, { x: 6, y: 6, color: '#bae6fd' }, { x: 7, y: 6, color: '#7dd3fc' }, { x: 8, y: 6, color: '#0284c7' }, { x: 9, y: 6, color: '#0369a1' },
      { x: 5, y: 7, color: '#ffffff' }, { x: 6, y: 7, color: '#f0f9ff' }, { x: 7, y: 7, color: '#bae6fd' }, { x: 8, y: 7, color: '#38bdf8' }, { x: 9, y: 7, color: '#0284c7' },
      { x: 5, y: 8, color: '#e0f2fe' }, { x: 6, y: 8, color: '#7dd3fc' }, { x: 7, y: 8, color: '#38bdf8' }, { x: 8, y: 8, color: '#0369a1' }, { x: 9, y: 8, color: '#075985' },
      { x: 5, y: 9, color: '#ffffff' }, { x: 6, y: 9, color: '#bae6fd' }, { x: 7, y: 9, color: '#7dd3fc' }, { x: 8, y: 9, color: '#0284c7' }, { x: 9, y: 9, color: '#0369a1' },
      { x: 5, y: 10, color: '#bae6fd' }, { x: 6, y: 10, color: '#7dd3fc' }, { x: 7, y: 10, color: '#0284c7' }, { x: 8, y: 10, color: '#0369a1' }, { x: 9, y: 10, color: '#0c4a6e' },
      { x: 6, y: 11, color: '#0284c7' }, { x: 7, y: 11, color: '#0369a1' }, { x: 8, y: 11, color: '#0c4a6e' },
    ],
  },
  {
    key: 'sample_chondrite_meteorite',
    name: 'Ancient Chondrite Meteorite',
    biome: 'desert',
    width: 16,
    height: 16,
    pixels: [
      { x: 4, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 5, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 10, y: 13, color: 'rgba(0,0,0,0.5)' },
      { x: 6, y: 5, color: '#78716c' }, { x: 7, y: 5, color: '#a8a29e' }, { x: 8, y: 5, color: '#d6d3d1' },
      { x: 5, y: 6, color: '#a8a29e' }, { x: 6, y: 6, color: '#fef08a' }, { x: 7, y: 6, color: '#78716c' }, { x: 8, y: 6, color: '#57534e' }, { x: 9, y: 6, color: '#44403c' },
      { x: 4, y: 7, color: '#78716c' }, { x: 5, y: 7, color: '#57534e' }, { x: 6, y: 7, color: '#44403c' }, { x: 7, y: 7, color: '#eab308' }, { x: 8, y: 7, color: '#292524' }, { x: 9, y: 7, color: '#1c1917' }, { x: 10, y: 7, color: '#1c1917' },
      { x: 4, y: 8, color: '#57534e' }, { x: 5, y: 8, color: '#44403c' }, { x: 6, y: 8, color: '#292524' }, { x: 7, y: 8, color: '#1c1917' }, { x: 8, y: 8, color: '#facc15' }, { x: 9, y: 8, color: '#1c1917' }, { x: 10, y: 8, color: '#0c0a09' },
      { x: 5, y: 9, color: '#44403c' }, { x: 6, y: 9, color: '#292524' }, { x: 7, y: 9, color: '#1c1917' }, { x: 8, y: 9, color: '#0c0a09' }, { x: 9, y: 9, color: '#0c0a09' },
      { x: 6, y: 10, color: '#1c1917' }, { x: 7, y: 10, color: '#0c0a09' }, { x: 8, y: 10, color: '#0c0a09' },
    ],
  },
  {
    key: 'sample_perchlorate_crust',
    name: 'Perchlorate Salt Crust',
    biome: 'snow',
    width: 16,
    height: 16,
    pixels: [
      { x: 4, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 5, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.4)' }, { x: 10, y: 13, color: 'rgba(0,0,0,0.4)' },
      { x: 7, y: 5, color: '#ffffff' }, { x: 8, y: 5, color: '#fae8ff' },
      { x: 5, y: 6, color: '#ffffff' }, { x: 6, y: 6, color: '#f5d0fe' }, { x: 7, y: 6, color: '#e879f9' }, { x: 8, y: 6, color: '#c084fc' }, { x: 9, y: 6, color: '#a855f7' },
      { x: 4, y: 7, color: '#f5d0fe' }, { x: 5, y: 7, color: '#e879f9' }, { x: 6, y: 7, color: '#c084fc' }, { x: 7, y: 7, color: '#ffffff' }, { x: 8, y: 7, color: '#9333ea' }, { x: 9, y: 7, color: '#7e22ce' }, { x: 10, y: 7, color: '#6b21a8' },
      { x: 4, y: 8, color: '#d8b4fe' }, { x: 5, y: 8, color: '#c084fc' }, { x: 6, y: 8, color: '#9333ea' }, { x: 7, y: 8, color: '#7e22ce' }, { x: 8, y: 8, color: '#6b21a8' }, { x: 9, y: 8, color: '#581c87' }, { x: 10, y: 8, color: '#3b0764' },
      { x: 5, y: 9, color: '#9333ea' }, { x: 6, y: 9, color: '#7e22ce' }, { x: 7, y: 9, color: '#581c87' }, { x: 8, y: 9, color: '#3b0764' }, { x: 9, y: 9, color: '#3b0764' },
    ],
  },
  {
    key: 'sample_stromatolite_fossil',
    name: 'Siliceous Micro-Laminate Slab',
    biome: 'grassland',
    width: 16,
    height: 16,
    pixels: [
      { x: 4, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 5, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 6, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 7, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 8, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 9, y: 13, color: 'rgba(0,0,0,0.5)' }, { x: 10, y: 13, color: 'rgba(0,0,0,0.5)' },
      { x: 6, y: 5, color: '#fed7aa' }, { x: 7, y: 5, color: '#fdba74' }, { x: 8, y: 5, color: '#fb923c' }, { x: 9, y: 5, color: '#f97316' },
      { x: 5, y: 6, color: '#ffedd5' }, { x: 6, y: 6, color: '#fed7aa' }, { x: 7, y: 6, color: '#ea580c' }, { x: 8, y: 6, color: '#c2410c' }, { x: 9, y: 6, color: '#9a3412' }, { x: 10, y: 6, color: '#7c2d12' },
      { x: 4, y: 7, color: '#fef3c7' }, { x: 5, y: 7, color: '#fde68a' }, { x: 6, y: 7, color: '#fed7aa' }, { x: 7, y: 7, color: '#ea580c' }, { x: 8, y: 7, color: '#9a3412' }, { x: 9, y: 7, color: '#7c2d12' }, { x: 10, y: 7, color: '#451a03' },
      { x: 4, y: 8, color: '#fed7aa' }, { x: 5, y: 8, color: '#ea580c' }, { x: 6, y: 8, color: '#c2410c' }, { x: 7, y: 8, color: '#7c2d12' }, { x: 8, y: 8, color: '#451a03' }, { x: 9, y: 8, color: '#451a03' },
      { x: 5, y: 9, color: '#c2410c' }, { x: 6, y: 9, color: '#9a3412' }, { x: 7, y: 9, color: '#7c2d12' }, { x: 8, y: 9, color: '#451a03' }, { x: 9, y: 9, color: '#451a03' },
    ],
  },
];
