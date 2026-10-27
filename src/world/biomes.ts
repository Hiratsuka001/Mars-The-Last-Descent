/**
 * Biome Definitions & Environmental Configurations
 */

export type BiomeType = 'grassland' | 'desert' | 'rocky' | 'snow' | 'water';

export interface PropSpawnRule {
  spriteKey: string;
  weight: number;          // relative spawn chance
  blocksMovement: boolean;
  width: number;
  height: number;
  offsetY?: number;
}

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  baseTile: string;
  variantTile: string;
  accentTile?: string;
  walkSpeed: number;
  propDensity: number;     // 0 to 1 chance of a prop on a tile
  props: PropSpawnRule[];
  dustColor?: string;
}

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  water: {
    id: 'water',
    name: 'Paleo Water Basin',
    baseTile: 'tile_water_deep',
    variantTile: 'tile_water_shallow',
    accentTile: 'tile_shore_edge',
    walkSpeed: 0, // Impassable
    propDensity: 0,
    props: [],
    dustColor: 'rgba(56, 189, 248, 0.2)',
  },

  grassland: {
    id: 'grassland',
    name: 'Terraformed Savanna',
    baseTile: 'tile_grass_base',
    variantTile: 'tile_grass_variant',
    accentTile: 'tile_grass_path',
    walkSpeed: 1.0,
    propDensity: 0.05,
    props: [
      { spriteKey: 'prop_tree_green', weight: 3, blocksMovement: true, width: 32, height: 36, offsetY: -20 },
      { spriteKey: 'prop_tree_pine', weight: 2, blocksMovement: true, width: 24, height: 36, offsetY: -20 },
      { spriteKey: 'prop_flower_red', weight: 4, blocksMovement: false, width: 12, height: 12, offsetY: 2 },
      { spriteKey: 'prop_flower_yellow', weight: 4, blocksMovement: false, width: 12, height: 12, offsetY: 2 },
      { spriteKey: 'prop_flower_blue', weight: 4, blocksMovement: false, width: 12, height: 12, offsetY: 2 },
      { spriteKey: 'prop_grass_tuft', weight: 5, blocksMovement: false, width: 14, height: 14, offsetY: 2 },
    ],
    dustColor: 'rgba(77, 124, 15, 0.15)',
  },

  desert: {
    id: 'desert',
    name: 'Martian Dune Desert',
    baseTile: 'tile_sand_base',
    variantTile: 'tile_sand_dune',
    accentTile: 'tile_sand_pebble',
    walkSpeed: 0.92,
    propDensity: 0.035,
    props: [
      { spriteKey: 'prop_sand_ventifact', weight: 4, blocksMovement: true, width: 16, height: 18, offsetY: -4 },
      { spriteKey: 'prop_rock_dark', weight: 3, blocksMovement: true, width: 16, height: 16, offsetY: 0 },
      { spriteKey: 'prop_crater_small', weight: 2, blocksMovement: false, width: 20, height: 20, offsetY: 0 },
    ],
    dustColor: 'rgba(234, 179, 8, 0.25)',
  },

  rocky: {
    id: 'rocky',
    name: 'Red Regolith Wastes',
    baseTile: 'tile_mars_regolith',
    variantTile: 'tile_mars_dark_rock',
    accentTile: 'tile_mars_gravel',
    walkSpeed: 1.0,
    propDensity: 0.04,
    props: [
      { spriteKey: 'prop_boulder_mars', weight: 4, blocksMovement: true, width: 20, height: 20, offsetY: -4 },
      { spriteKey: 'prop_outcrop_cluster', weight: 2, blocksMovement: true, width: 24, height: 20, offsetY: -4 },
      { spriteKey: 'prop_rock_dark', weight: 3, blocksMovement: true, width: 16, height: 16, offsetY: 0 },
      { spriteKey: 'prop_crater_small', weight: 2, blocksMovement: false, width: 20, height: 20, offsetY: 0 },
    ],
    dustColor: 'rgba(234, 88, 12, 0.3)',
  },

  snow: {
    id: 'snow',
    name: 'Glacial Cryo Plain',
    baseTile: 'tile_snow_base',
    variantTile: 'tile_ice_sheet',
    accentTile: 'tile_snow_base',
    walkSpeed: 0.88,
    propDensity: 0.03,
    props: [
      { spriteKey: 'prop_ice_crystal_cluster', weight: 3, blocksMovement: true, width: 16, height: 20, offsetY: -4 },
      { spriteKey: 'prop_rock_dark', weight: 3, blocksMovement: true, width: 16, height: 16, offsetY: 0 },
      { spriteKey: 'prop_tree_pine', weight: 2, blocksMovement: true, width: 24, height: 36, offsetY: -20 },
    ],
    dustColor: 'rgba(224, 242, 254, 0.25)',
  },
};

/**
 * Determine biome given elevation, moisture, and temperature sampled in [0, 1]
 * Creates broad, continent-scale coherent biomes
 */
export function getBiomeAt(elevation: number, moisture: number, temperature: number): BiomeConfig {
  // Deep lake basins at low elevation troughs
  if (elevation < 0.28) {
    return BIOMES.water;
  }
  // Cryo polar cap / snow plains at high elevations with low temperature
  if (elevation > 0.65 && temperature < 0.44) {
    return BIOMES.snow;
  }
  // Warm + arid = golden Martian sand dunes
  if (moisture < 0.40 && temperature > 0.46) {
    return BIOMES.desert;
  }
  // High moisture = terraformed green biosphere savanna
  if (moisture > 0.54 && temperature > 0.30 && temperature < 0.78) {
    return BIOMES.grassland;
  }
  // Default Martian surface: calm, uncluttered reddish-brown regolith
  return BIOMES.rocky;
}

