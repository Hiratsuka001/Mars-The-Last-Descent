/**
 * Moon Prequel Map Definition (Chapter 8)
 * Fixed 64x40 ASCII layout for the lunar surface prequel.
 * 
 * Legend:
 * . ground (lunar regolith)
 * # rock, boulder, or crater-rim wall (impassable)
 * ~ pit gap (chasm crater void, hop required)
 * S start (lunar lander)
 * 1 relic site 1 (Luna 9)
 * 2 relic site 2 (Apollo 11)
 * 3 relic site 3 (Lunokhod 1)
 */

export interface RelicDef {
  id: string;
  name: string;
  historicYear: number;
  tileX: number;
  tileY: number;
  placeholderSprite: string; // Placeholder until Moon-2/3/4
  oneLineHint: string;
  replayLine: string;
}

export const MOON_MAP_WIDTH = 64;
export const MOON_MAP_HEIGHT = 40;

// 64 chars per row. 40 rows.
// Cols: Zone 1 (0..24, 25 chars), Pit 1 (25..27, 3 chars), Zone 2 (28..41, 14 chars), Pit 2 (42..44, 3 chars), Zone 3 (45..63, 19 chars)
export const MOON_MAP_RAW: string[] = [
  /* 00 */ "################################################################",
  /* 01 */ "################################################################",
  /* 02 */ "################################################################",
  /* 03 */ "#########################~~~##############~~~###################",
  /* 04 */ "#######..###############.~~~..##########..~~~...################",
  /* 05 */ "#####......############..~~~....######....~~~.....##############",
  /* 06 */ "####........##########...~~~..............~~~.......############",
  /* 07 */ "####.........########....~~~..............~~~.........##########",
  /* 08 */ "####.....................~~~..............~~~...............####",
  /* 09 */ "####.....................~~~..............~~~...............####",
  /* 10 */ "####......#####..........~~~..............~~~.....#####.....####",
  /* 11 */ "####....#########........~~~..............~~~...#########...####",
  /* 12 */ "####...###########.......~~~..............~~~..###########..####",
  /* 13 */ "####....#########........~~~..............~~~...#########...####",
  /* 14 */ "####......#####..........~~~..............~~~.....#####.....####",
  /* 15 */ "####..##.................~~~........#.....~~~..........#....####",
  /* 16 */ "####.....................~~~..............~~~...............####",
  /* 17 */ "####.............#......#~~~...##.........~~~...............####",
  /* 18 */ "####.....................~~~..............~~~...............####",
  /* 19 */ "####.....................~~~..............~~~...............####",
  /* 20 */ "####....S.........1......~~~.......2......~~~.......3.......####",
  /* 21 */ "####.....................~~~..............~~~...............####",
  /* 22 */ "####.....................~~~..............~~~...............####",
  /* 23 */ "####.......##............~~~..............~~~....##.........####",
  /* 24 */ "####................#....~~~.....#####....~~~...............####",
  /* 25 */ "####.....................~~~...#########..~~~...............####",
  /* 26 */ "####................#....~~~..###########.~~~..........#....####",
  /* 27 */ "####.....................~~~...#########..~~~...............####",
  /* 28 */ "####.....................~~~.....#####....~~~...............####",
  /* 29 */ "####.....................~~~..............~~~...............####",
  /* 30 */ "####......##.............~~~.......##.....~~~.........##....####",
  /* 31 */ "####.....................~~~..............~~~...............####",
  /* 32 */ "####.........########....~~~..............~~~.........##########",
  /* 33 */ "####........##########...~~~..............~~~.......############",
  /* 34 */ "#####......############..~~~....######....~~~.....##############",
  /* 35 */ "#######..###############.~~~..##########..~~~...################",
  /* 36 */ "#########################~~~##############~~~###################",
  /* 37 */ "################################################################",
  /* 38 */ "################################################################",
  /* 39 */ "################################################################",
];

export interface MoonMapData {
  width: number;
  height: number;
  tiles: string[][];
  startTile: { x: number; y: number };
  relics: RelicDef[];
  secrets: SecretDef[];
  psrAreas: PSRArea[];
  iceDeposits: IceDepositDef[];
}

export interface PSRArea {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  description: string;
}

export interface IceDepositDef {
  id: string;
  name: string;
  tileX: number;
  tileY: number;
  description: string;
}

export const MOON_PSR_AREAS: PSRArea[] = [
  {
    id: 'psr_south_zone1',
    name: 'Cabeus Shadow Basin',
    minX: 4,
    maxX: 18,
    minY: 28,
    maxY: 34,
    description: 'Permanently shadowed cold trap. Cryogenic temperatures preserve pristine volatiles.',
  },
  {
    id: 'psr_south_zone2',
    name: 'Shorty Shadow Depths',
    minX: 28,
    maxX: 41,
    minY: 27,
    maxY: 34,
    description: 'Deep southern crater depression enveloped in eternal darkness.',
  },
  {
    id: 'psr_south_zone3',
    name: 'Shoemaker Polar Basin',
    minX: 46,
    maxX: 60,
    minY: 28,
    maxY: 34,
    description: 'Ancient cryogenic basin untouched by sunlight for billions of years.',
  },
];

export const MOON_ICE_DEPOSITS: IceDepositDef[] = [
  {
    id: 'ice_1',
    name: 'Cabeus Subsurface Ice Vein',
    tileX: 8,
    tileY: 31,
    description: 'Subsurface crystalline water-ice trapped in cryogenic regolith.',
  },
  {
    id: 'ice_2',
    name: 'Cabeus Glacial Pocket',
    tileX: 14,
    tileY: 31,
    description: 'Pristine volatile frost shielded from solar sublimation.',
  },
  {
    id: 'ice_3',
    name: 'Shorty Permafrost Glint',
    tileX: 33,
    tileY: 32,
    description: 'Water-ice grains cemented into pyroclastic volcanic soil.',
  },
  {
    id: 'ice_4',
    name: 'Shorty Cold-Trap Frost',
    tileX: 38,
    tileY: 30,
    description: 'Dense crystal clusters reflecting deep-space starlight.',
  },
  {
    id: 'ice_5',
    name: 'Shoemaker Polar Ice Shard',
    tileX: 50,
    tileY: 31,
    description: 'Ancient cometary volatiles locked at 40 Kelvin.',
  },
  {
    id: 'ice_6',
    name: 'Shoemaker Glacial Matrix',
    tileX: 56,
    tileY: 31,
    description: 'High-purity lunar ice: potential feedstock for hydrogen rocket propellant.',
  },
];

export interface SecretDef {
  id: string;
  name: string;
  historicYear: number;
  tileX: number;
  tileY: number;
  type: 'golf_ball' | 'orange_glass' | 'apollo_flag';
  oneLineHint: string;
  interactionPrompt: string;
  discoveredLine: string;
  badge: string;
}

export const MOON_SECRETS: SecretDef[] = [
  {
    id: 'secret_golf_ball',
    name: "Alan Shepard's Golf Ball (Apollo 14)",
    historicYear: 1971,
    tileX: 10,
    tileY: 8,
    type: 'golf_ball',
    oneLineHint: 'Look closely at the regolith... is that a golf ball resting by the crater?!',
    interactionPrompt: '[E] WHACK GOLF BALL',
    discoveredLine: '"Miles and miles and miles!" The golf ball arcs cleanly into low-lunar orbit!',
    badge: 'Lunar Golfer',
  },
  {
    id: 'secret_apollo_flag',
    name: 'Bleached Apollo 11 Flag',
    historicYear: 1969,
    tileX: 35,
    tileY: 8,
    type: 'apollo_flag',
    oneLineHint: 'An American flag standing on the ridge... but something looks different.',
    interactionPrompt: '[E] INSPECT FLAG',
    discoveredLine: 'The nylon flag has been bleached pure white by 50+ years of unfiltered solar UV radiation.',
    badge: 'Solar UV Scout',
  },
  {
    id: 'secret_orange_glass',
    name: 'Shorty Crater Orange Soil',
    historicYear: 1972,
    tileX: 35,
    tileY: 31,
    type: 'orange_glass',
    oneLineHint: 'Gleaming orange regolith! Pyroclastic volcanic glass from ancient lunar fire fountains!',
    interactionPrompt: '[E] SAMPLE ORANGE SOIL',
    discoveredLine: 'Orange volcanic glass beads sampled! +1 Bonus Research Point for Mars transit!',
    badge: 'Fire Fountain Geologist',
  },
];

export const MOON_RELICS: RelicDef[] = [
  {
    id: 'moon_luna9',
    name: 'Luna 9 Lander (1966)',
    historicYear: 1966,
    tileX: 18,
    tileY: 20,
    placeholderSprite: 'wreck_phoenix',
    oneLineHint: 'Look, Luna 9! The very first probe to soft-land here!',
    replayLine: 'Luna 9 telemetry is already safely stored in our codex.',
  },
  {
    id: 'moon_apollo11',
    name: 'Apollo 11 ALSEP Site (1969)',
    historicYear: 1969,
    tileX: 35,
    tileY: 20,
    placeholderSprite: 'wreck_surveyor',
    oneLineHint: "Historic Apollo 11 site! Humanity's giant leap began right here.",
    replayLine: 'Apollo 11 data recorded. What an incredible milestone for exploration!',
  },
  {
    id: 'moon_lunokhod1',
    name: 'Lunokhod 1 Rover (1970)',
    historicYear: 1970,
    tileX: 52,
    tileY: 20,
    placeholderSprite: 'wreck_sojourner',
    oneLineHint: 'Lunokhod 1! The pioneering robotic moon rover from 1970!',
    replayLine: 'Lunokhod 1 logged! A remarkable rover that paved the way.',
  },
];

export function getMoonMapData(): MoonMapData {
  let startTile = { x: 8, y: 20 };
  const tiles: string[][] = [];

  for (let y = 0; y < MOON_MAP_RAW.length; y++) {
    const row = MOON_MAP_RAW[y];
    const rowTiles: string[] = [];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === 'S') {
        startTile = { x, y };
        rowTiles.push('.');
      } else if (ch === '1' || ch === '2' || ch === '3') {
        rowTiles.push('.');
      } else {
        rowTiles.push(ch);
      }
    }
    tiles.push(rowTiles);
  }

  return {
    width: MOON_MAP_WIDTH,
    height: MOON_MAP_HEIGHT,
    tiles,
    startTile,
    relics: MOON_RELICS,
    secrets: MOON_SECRETS,
    psrAreas: MOON_PSR_AREAS,
    iceDeposits: MOON_ICE_DEPOSITS,
  };
}
