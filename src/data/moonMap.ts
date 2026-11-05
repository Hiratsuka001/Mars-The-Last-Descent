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
  /* 17 */ "####.............#.......~~~...##.........~~~...............####",
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
}

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
  };
}
