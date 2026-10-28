/**
 * Major Martian Natural & Geological Landmarks
 * 5 large procedural landmarks per world (6-10 tiles wide)
 * Discoverable once: awards +1 RP, toast notification, minimap icon, and Nova line.
 */

export interface LandmarkDefinition {
  id: string;
  name: string;
  category: string;
  scienceFact: string;
  preferredBiomes: string[];
  widthTiles: number;  // 6 to 10 tiles wide
  heightTiles: number; // 3 to 6 tiles high
  iconColor: string;
}

export const LANDMARK_DEFINITIONS: Record<string, LandmarkDefinition> = {
  canyon_rim: {
    id: 'canyon_rim',
    name: 'Valles Marineris Chasm Rim',
    category: 'Tectonic Fracture Zone',
    scienceFact: 'Deepest canyon system in the solar system, plunging over 7 km deep along ancient rift valleys.',
    preferredBiomes: ['rocky', 'desert'],
    widthTiles: 9,
    heightTiles: 4,
    iconColor: '#f97316',
  },
  shield_volcano: {
    id: 'shield_volcano',
    name: 'Elysium Mons Shield Silhouette',
    category: 'Extraterrestrial Volcanism',
    scienceFact: 'Low-viscosity basaltic lava flows built massive volcanic shields with gentle 2-degree slopes.',
    preferredBiomes: ['rocky', 'desert'],
    widthTiles: 10,
    heightTiles: 3,
    iconColor: '#ea580c',
  },
  river_delta: {
    id: 'river_delta',
    name: 'Eberswalde Sinuous Delta',
    category: 'Paleohydrological Basin',
    scienceFact: 'Fossilized meandering channel distributaries prove long-lived standing water once formed delta deposits.',
    preferredBiomes: ['grassland', 'rocky'],
    widthTiles: 8,
    heightTiles: 4,
    iconColor: '#10b981',
  },
  ice_cave: {
    id: 'ice_cave',
    name: 'Planum Boreum Permafrost Chasm',
    category: 'Glacial Permafrost Arch',
    scienceFact: 'Layered spiral ice scarps contain water ice and seasonal dry-ice deposits hundreds of meters thick.',
    preferredBiomes: ['snow'],
    widthTiles: 9,
    heightTiles: 5,
    iconColor: '#38bdf8',
  },
  dust_devil: {
    id: 'dust_devil',
    name: 'Vortex Column Dust Devil',
    category: 'Active Atmospheric Dynamic',
    scienceFact: 'Thermal updrafts spin warm surface dust into towering vortices that sweep clean rover solar panels.',
    preferredBiomes: ['desert', 'rocky'],
    widthTiles: 7,
    heightTiles: 6,
    iconColor: '#fbbf24',
  },
};
