import { generateTileCanvas, PROCEDURAL_TILE_DEFS } from './proceduralTiles';
import charactersSheet from '../assets/characters.png';

/**
 * Sprite Sheet Atlas & Manifest System
 * Supports pixel-perfect integer slicing, caching, and graceful colored fallback rendering.
 */

export type AssetLicense = 'cc0' | 'restricted-placeholder' | 'custom';

export interface SpriteDefinition {
  sheet: string;          // Relative path to image in /assets/ or 'procedural'
  x: number;              // Source X on sheet
  y: number;              // Source Y on sheet
  w: number;              // Source width on sheet
  h: number;              // Source height on sheet
  license: AssetLicense;  // Licensing classification
  renderW?: number;       // Optional target render width (default = 16)
  renderH?: number;       // Optional target render height (default = 16)
  tint?: string;          // Optional color tint / overlay
  flipX?: boolean;        // Mirror horizontally
  offsetY?: number;       // Visual vertical offset for props (e.g. tree anchoring)
}

export const SPRITE_MANIFEST: Record<string, SpriteDefinition> = {
  // ==========================================
  // TERRAIN TILES (16x16 Procedural Clean 8-Bit Atlas)
  // 100% solid, opaque, coherent biomes with zero stray UI/structure tiles.
  // ==========================================
  
  // Mars Red Regolith / Rocky Plains Biome (Calm Default Surface)
  tile_mars_regolith: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_mars_dark_rock: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_mars_gravel: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },

  // Desert / Sand Biome
  tile_sand_base: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_sand_dune: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_sand_pebble: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },

  // Grassland Biome
  tile_grass_base: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_grass_variant: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_grass_path: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_dirt: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },

  // Snow / Ice Biome
  tile_snow_base: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_ice_sheet: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },

  // Ground Variation Patches
  tile_mars_dark_patch: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_mars_light_patch: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_sand_dark_patch: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_grass_dark_patch: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_snow_dark_patch: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },

  // Biome Transition Border Tiles (Dithered Blends)
  tile_border_mars_sand: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_border_mars_grass: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_border_mars_snow: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_border_snow_mars: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_border_sand_grass: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  tile_border_sand_snow: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },

  // Ground Decoration Overlays (Non-blocking detail layer)
  decor_mars_crater: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_mars_rubble: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_mars_fissure: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_dune_ridge: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_crater_ring: { sheet: 'procedural', x: 0, y: 0, w: 20, h: 20, renderW: 20, renderH: 20, license: 'cc0' },
  decor_dust_devil_track: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_riverbed_gravel: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_sand_ripple: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_sand_pebbles: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_sand_scrub: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_grass_flower_red: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_grass_flower_yellow: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_grass_flower_white: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_grass_tuft: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_snow_shard: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_snow_mound: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_snow_drift: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_frost_rim: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_scorch_crater: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_metal_scrap: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  decor_tire_track: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },

  // Water Biome (Impasse)
  tile_water_deep: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_water_shallow: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },
  tile_shore_edge: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    license: 'cc0',
  },

  // ==========================================
  // PROPS & OBSTACLES
  // ==========================================

  // Trees & Vegetation (Blocks movement, y-sorted)
  prop_tree_green: {
    sheet: 'procedural',
    x: 0, y: 0, w: 32, h: 36,
    renderW: 32, renderH: 36,
    offsetY: -20,
    license: 'cc0',
  },
  prop_tree_pine: {
    sheet: 'procedural',
    x: 0, y: 0, w: 24, h: 36,
    renderW: 24, renderH: 36,
    offsetY: -20,
    license: 'cc0',
  },
  prop_sand_ventifact: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 18,
    renderW: 16, renderH: 18,
    offsetY: -4,
    license: 'cc0',
  },
  prop_cactus: {
    // Aliased to clean ventifact to prevent lime green rectangle regression
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 18,
    renderW: 16, renderH: 18,
    offsetY: -4,
    license: 'cc0',
  },

  // Rocks & Boulders (Blocks movement, crisp procedural pixel art)
  prop_boulder_mars: {
    sheet: 'procedural',
    x: 0, y: 0, w: 20, h: 20,
    renderW: 20, renderH: 20,
    offsetY: -4,
    license: 'cc0',
  },
  prop_outcrop_cluster: {
    sheet: 'procedural',
    x: 0, y: 0, w: 24, h: 20,
    renderW: 24, renderH: 20,
    offsetY: -4,
    license: 'cc0',
  },
  prop_rock_dark: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 16,
    renderW: 16, renderH: 16,
    offsetY: 0,
    license: 'cc0',
  },
  prop_crater_small: {
    sheet: 'procedural',
    x: 0, y: 0, w: 20, h: 20,
    renderW: 20, renderH: 20,
    offsetY: 0,
    license: 'cc0',
  },
  prop_ice_crystal_cluster: {
    sheet: 'procedural',
    x: 0, y: 0, w: 16, h: 20,
    renderW: 16, renderH: 20,
    offsetY: -4,
    license: 'cc0',
  },

  // Walkable Ground Decor (Does not block movement)
  prop_flower_red: {
    sheet: 'procedural',
    x: 0, y: 0, w: 12, h: 12,
    renderW: 12, renderH: 12,
    offsetY: 2,
    license: 'cc0',
  },
  prop_flower_yellow: {
    sheet: 'procedural',
    x: 0, y: 0, w: 12, h: 12,
    renderW: 12, renderH: 12,
    offsetY: 2,
    license: 'cc0',
  },
  prop_flower_blue: {
    sheet: 'procedural',
    x: 0, y: 0, w: 12, h: 12,
    renderW: 12, renderH: 12,
    offsetY: 2,
    license: 'cc0',
  },
  prop_grass_tuft: {
    sheet: 'procedural',
    x: 0, y: 0, w: 14, h: 14,
    renderW: 14, renderH: 14,
    offsetY: 2,
    license: 'cc0',
  },

  // ==========================================
  // PLAYER SPRITES (Astronaut - User-provided spritesheet player_walk4)
  // Genuine 4-directional walk cycles (Down, Up, Left, Right)
  // ==========================================

  // South (Facing Down/Camera)
  player_idle_down: { sheet: charactersSheet, x: 0, y: 0, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_down_0: { sheet: charactersSheet, x: 20, y: 0, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_down_1: { sheet: charactersSheet, x: 40, y: 0, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_down_2: { sheet: charactersSheet, x: 60, y: 0, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_down_3: { sheet: charactersSheet, x: 80, y: 0, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },

  // West (Facing Left)
  player_idle_left: { sheet: charactersSheet, x: 0, y: 56, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_left_0: { sheet: charactersSheet, x: 20, y: 56, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_left_1: { sheet: charactersSheet, x: 40, y: 56, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_left_2: { sheet: charactersSheet, x: 60, y: 56, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_left_3: { sheet: charactersSheet, x: 80, y: 56, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },

  // East (Facing Right)
  player_idle_right: { sheet: charactersSheet, x: 0, y: 84, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_right_0: { sheet: charactersSheet, x: 20, y: 84, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_right_1: { sheet: charactersSheet, x: 40, y: 84, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_right_2: { sheet: charactersSheet, x: 60, y: 84, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_right_3: { sheet: charactersSheet, x: 80, y: 84, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },

  // North (Facing Up/Back)
  player_idle_up: { sheet: charactersSheet, x: 0, y: 28, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_up_0: { sheet: charactersSheet, x: 20, y: 28, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_up_1: { sheet: charactersSheet, x: 40, y: 28, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_up_2: { sheet: charactersSheet, x: 60, y: 28, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },
  player_walk_up_3: { sheet: charactersSheet, x: 80, y: 28, w: 20, h: 28, renderW: 20, renderH: 28, license: 'custom' },

  // ==========================================
  // NOVA COMPANION SPRITES (Cat - User-provided spritesheet nova_walk "Ginger & Topey Sprites")
  // Genuine 4-directional walk cycles (Down, Up, Left, Right)
  // ==========================================

  // Front / Down
  nova_idle_down: { sheet: charactersSheet, x: 105, y: 0, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_down_0: { sheet: charactersSheet, x: 123, y: 0, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_down_1: { sheet: charactersSheet, x: 141, y: 0, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_down_2: { sheet: charactersSheet, x: 159, y: 0, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_down_3: { sheet: charactersSheet, x: 177, y: 0, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },

  // Left / West
  nova_idle_left: { sheet: charactersSheet, x: 105, y: 32, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_left_0: { sheet: charactersSheet, x: 123, y: 32, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_left_1: { sheet: charactersSheet, x: 141, y: 32, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_left_2: { sheet: charactersSheet, x: 159, y: 32, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_left_3: { sheet: charactersSheet, x: 177, y: 32, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },

  // Right / East
  nova_idle_right: { sheet: charactersSheet, x: 105, y: 48, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_right_0: { sheet: charactersSheet, x: 123, y: 48, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_right_1: { sheet: charactersSheet, x: 141, y: 48, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_right_2: { sheet: charactersSheet, x: 159, y: 48, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_right_3: { sheet: charactersSheet, x: 177, y: 48, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },

  // Up / North (Rear)
  nova_idle_up: { sheet: charactersSheet, x: 105, y: 16, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_up_0: { sheet: charactersSheet, x: 123, y: 16, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_up_1: { sheet: charactersSheet, x: 141, y: 16, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_up_2: { sheet: charactersSheet, x: 159, y: 16, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },
  nova_walk_up_3: { sheet: charactersSheet, x: 177, y: 16, w: 18, h: 16, renderW: 18, renderH: 16, license: 'custom' },

  // ==========================================
  // SPACESHIP & MAJOR LANDMARKS (100% CC0 Procedural Pixel Art)
  // ==========================================
  ship_broken: { sheet: 'procedural', x: 0, y: 0, w: 64, h: 64, renderW: 64, renderH: 64, offsetY: 0, license: 'cc0' },
  ship_repaired: { sheet: 'procedural', x: 0, y: 0, w: 64, h: 64, renderW: 64, renderH: 64, offsetY: 0, license: 'cc0' },

  // ==========================================
  // UNIQUE WRECK SPRITES (8 MISSIONS: AVAILABLE + SALVAGED)
  // 100% Procedural Pixel Art (CC0)
  // ==========================================
  wreck_sojourner: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_sojourner_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_opportunity: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_opportunity_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_insight: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_insight_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_spirit: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_spirit_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_deep_space_dish: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_deep_space_dish_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_phoenix: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_phoenix_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_lrv_buggy: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_lrv_buggy_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_surveyor: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },
  wreck_surveyor_stripped: {
    sheet: 'procedural',
    x: 0, y: 0, w: 36, h: 36,
    renderW: 36, renderH: 36,
    license: 'cc0',
  },

  // Backward-compatibility aliases for legacy keys
  equipment_rover: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_rover_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_dome: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_dome_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_dish: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_dish_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_lander: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_lander_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_buggy: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_buggy_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_surveyor: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },
  equipment_surveyor_stripped: { sheet: 'procedural', x: 0, y: 0, w: 36, h: 36, renderW: 36, renderH: 36, license: 'cc0' },

  // ==========================================
  // SHIP PART INVENTORY ICONS (16x16 100% CC0 Procedural)
  // ==========================================
  icon_gear: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_solar_panel: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_chip: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_wrench: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_satellite: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_battery: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_fuel: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  icon_toolbox: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },

  // ==========================================
  // UI & PROMPTS (100% CC0 Procedural)
  // ==========================================
  key_e: { sheet: 'procedural', x: 0, y: 0, w: 24, h: 24, renderW: 24, renderH: 24, license: 'cc0' },
  key_w: { sheet: 'procedural', x: 0, y: 0, w: 24, h: 24, renderW: 24, renderH: 24, license: 'cc0' },
  key_a: { sheet: 'procedural', x: 0, y: 0, w: 24, h: 24, renderW: 24, renderH: 24, license: 'cc0' },
  key_s: { sheet: 'procedural', x: 0, y: 0, w: 24, h: 24, renderW: 24, renderH: 24, license: 'cc0' },
  key_d: { sheet: 'procedural', x: 0, y: 0, w: 24, h: 24, renderW: 24, renderH: 24, license: 'cc0' },

  // ==========================================
  // MARTIAN FIELD SCIENCE SAMPLES (100% CC0 Procedural)
  // ==========================================
  sample_hematite_blueberry: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  sample_olivine_crystal: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  sample_cryo_ice_core: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  sample_chondrite_meteorite: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  sample_perchlorate_crust: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
  sample_stromatolite_fossil: { sheet: 'procedural', x: 0, y: 0, w: 16, h: 16, renderW: 16, renderH: 16, license: 'cc0' },
};

/**
 * Image Cache Manager
 */
class ImageAtlasManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private loadPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  private proceduralCanvases: Map<string, HTMLCanvasElement> = new Map();
  private preScaledCanvases: Map<string, HTMLCanvasElement> = new Map();

  constructor() {
    this.initProceduralTiles();
  }

  private initProceduralTiles(): void {
    if (typeof document === 'undefined') return;
    for (const def of PROCEDURAL_TILE_DEFS) {
      const canvas = generateTileCanvas(def);
      this.proceduralCanvases.set(def.key, canvas);
    }
  }

  public getProceduralTile(key: string): HTMLCanvasElement | null {
    if (this.proceduralCanvases.size === 0) {
      this.initProceduralTiles();
    }
    return this.proceduralCanvases.get(key) ?? null;
  }

  public getImage(sheetPath: string): HTMLImageElement | null {
    if (sheetPath === 'procedural') return null;
    const cached = this.images.get(sheetPath);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return cached;
    }
    if (!this.loadPromises.has(sheetPath)) {
      this.loadImage(sheetPath);
    }
    return null;
  }

  public loadImage(sheetPath: string): Promise<HTMLImageElement> {
    if (sheetPath === 'procedural') {
      return Promise.reject(new Error('Cannot load procedural sheet as image'));
    }
    if (this.loadPromises.has(sheetPath)) {
      return this.loadPromises.get(sheetPath)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = sheetPath;
      img.onload = () => {
        this.images.set(sheetPath, img);
        resolve(img);
      };
      img.onerror = (e) => {
        console.warn(`[Atlas] Failed to load image: ${sheetPath}`, e);
        reject(e);
      };
    });

    this.loadPromises.set(sheetPath, promise);
    return promise;
  }

  public preloadAll(): Promise<HTMLImageElement[]> {
    const uniqueSheets = Array.from(
      new Set(
        Object.values(SPRITE_MANIFEST)
          .map((s) => s.sheet)
          .filter((sheet) => sheet !== 'procedural')
      )
    );
    return Promise.all(uniqueSheets.map((sheet) => this.loadImage(sheet)));
  }

  /**
   * Draw sprite with fallback placeholder
   */
  public drawSprite(
    ctx: CanvasRenderingContext2D,
    spriteKey: string,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number
  ): void {
    const def = SPRITE_MANIFEST[spriteKey];
    const targetW = dw ?? def?.renderW ?? 16;
    const targetH = dh ?? def?.renderH ?? 16;
    const offsetY = def?.offsetY ?? 0;

    // 1. Procedural ground tile & props check (instant offscreen canvas)
    const procCanvas = this.getProceduralTile(spriteKey);
    if (procCanvas) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(procCanvas, 0, 0, procCanvas.width, procCanvas.height, dx, dy + offsetY, targetW, targetH);
      ctx.restore();
      return;
    }

    // Graceful fallback for missing definition
    if (!def) {
      this.drawPlaceholder(ctx, spriteKey, dx, dy, targetW, targetH, '#f43f5e');
      return;
    }

    const img = this.getImage(def.sheet);
    if (!img) {
      // Loading placeholder
      this.drawPlaceholder(ctx, spriteKey, dx, dy + offsetY, targetW, targetH, '#0284c7');
      return;
    }

    // 2. Pre-scaled nearest-neighbor cache for crisp pixel art (eliminates blur on large sprites like ship/rover)
    const cacheKey = `${spriteKey}_${targetW}x${targetH}_${def.flipX ? 'flip' : 'norm'}_${def.tint || 'none'}`;
    let cachedCanvas = this.preScaledCanvases.get(cacheKey);

    if (!cachedCanvas && typeof document !== 'undefined') {
      cachedCanvas = document.createElement('canvas');
      cachedCanvas.width = targetW;
      cachedCanvas.height = targetH;
      const cCtx = cachedCanvas.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = false;
        if (def.flipX) {
          cCtx.translate(targetW, 0);
          cCtx.scale(-1, 1);
          cCtx.drawImage(img, def.x, def.y, def.w, def.h, 0, 0, targetW, targetH);
        } else {
          cCtx.drawImage(img, def.x, def.y, def.w, def.h, 0, 0, targetW, targetH);
        }

        // Apply tint overlay cleanly using source-atop
        if (def.tint) {
          cCtx.save();
          cCtx.globalCompositeOperation = 'source-atop';
          cCtx.fillStyle = def.tint;
          cCtx.fillRect(0, 0, targetW, targetH);
          cCtx.restore();
        }
      }
      this.preScaledCanvases.set(cacheKey, cachedCanvas);
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, dx, dy + offsetY);
    } else {
      if (def.flipX) {
        ctx.translate(dx + targetW, dy + offsetY);
        ctx.scale(-1, 1);
        ctx.drawImage(img, def.x, def.y, def.w, def.h, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(img, def.x, def.y, def.w, def.h, dx, dy + offsetY, targetW, targetH);
      }
      if (def.tint) {
        ctx.fillStyle = def.tint;
        ctx.fillRect(dx, dy + offsetY, targetW, targetH);
      }
    }
    ctx.restore();
  }

  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    key: string,
    dx: number,
    dy: number,
    w: number,
    h: number,
    color: string
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(dx, dy, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx, dy, w, h);
    
    // Draw tiny 6px key indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = key.slice(0, 4);
    ctx.fillText(label, dx + w / 2, dy + h / 2);
    ctx.restore();
  }
}

export const atlas = new ImageAtlasManager();

