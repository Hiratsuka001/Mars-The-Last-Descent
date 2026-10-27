import { BiomeType } from '../world/biomes';

export interface ScienceSampleDefinition {
  id: string;
  name: string;
  category: 'mineral' | 'fossil' | 'meteorite' | 'cryo' | 'chemical';
  spriteKey: string;
  preferredBiomes: BiomeType[];
  description: string;
  scienceFact: string;
  rarity: 'common' | 'rare' | 'exotic';
}

export function getSampleResearchPoints(rarity: 'common' | 'rare' | 'exotic'): number {
  switch (rarity) {
    case 'exotic': return 3;
    case 'rare': return 2;
    case 'common':
    default: return 1;
  }
}

export const SCIENCE_SAMPLES: Record<string, ScienceSampleDefinition> = {
  sample_hematite_blueberry: {
    id: 'sample_hematite_blueberry',
    name: 'Hematite Spherule ("Blueberry")',
    category: 'mineral',
    spriteKey: 'sample_hematite_blueberry',
    preferredBiomes: ['rocky', 'desert'],
    description: 'Small spherical gray hematite concretion formed by percolation of ancient groundwater through porous rock.',
    scienceFact: 'Discovered in 2004 by NASA\'s Opportunity rover at Meridiani Planum, proving liquid water once saturated Mars.',
    rarity: 'common',
  },
  sample_olivine_crystal: {
    id: 'sample_olivine_crystal',
    name: 'Volcanic Olivine Crystal Geode',
    category: 'mineral',
    spriteKey: 'sample_olivine_crystal',
    preferredBiomes: ['rocky'],
    description: 'Vibrant magnesium-iron silicate crystal extracted from basaltic volcanic flows across Martian lava plains.',
    scienceFact: 'Olivine readily breaks down in acidic water; its widespread Martian presence proves Mars transitioned from wet to cold dry desert billions of years ago.',
    rarity: 'common',
  },
  sample_cryo_ice_core: {
    id: 'sample_cryo_ice_core',
    name: 'Polar Cryo-Ice Core',
    category: 'cryo',
    spriteKey: 'sample_cryo_ice_core',
    preferredBiomes: ['snow'],
    description: 'Pristine stratified core composed of compressed water-ice and solid carbon dioxide (dry ice) frost.',
    scienceFact: 'Phoenix Mars Lander (2008) directly scraped and sublimated subsurface polar ice sheets within centimeters of the regolith topsoil.',
    rarity: 'rare',
  },
  sample_chondrite_meteorite: {
    id: 'sample_chondrite_meteorite',
    name: 'Ancient Chondrite Meteorite',
    category: 'meteorite',
    spriteKey: 'sample_chondrite_meteorite',
    preferredBiomes: ['desert', 'rocky'],
    description: 'Primitive iron-nickel celestial fragment preserved intact within the gentle, unweathered Martian sands.',
    scienceFact: 'Because Mars has a thin atmosphere and low tectonic turnover, Opportunity and Curiosity discovered pristine iron meteorites (like Heat Shield Rock) resting on dunes.',
    rarity: 'rare',
  },
  sample_perchlorate_crust: {
    id: 'sample_perchlorate_crust',
    name: 'Perchlorate Salt Crust',
    category: 'chemical',
    spriteKey: 'sample_perchlorate_crust',
    preferredBiomes: ['desert', 'snow'],
    description: 'Bright crystalline salt crust capable of lowering the freezing point of brine down to -70°C.',
    scienceFact: 'Perchlorates in Martian soil act as natural antifreeze, permitting hypersaline liquid brines to briefly flow during Martian summer.',
    rarity: 'rare',
  },
  sample_stromatolite_fossil: {
    id: 'sample_stromatolite_fossil',
    name: 'Siliceous Micro-Laminate Slab',
    category: 'fossil',
    spriteKey: 'sample_stromatolite_fossil',
    preferredBiomes: ['grassland'],
    description: 'Delicately layered mineral sediment resembling prebiotic hydrothermal mats and fossilized stromatolites.',
    scienceFact: 'NASA\'s Perseverance rover currently gathers samples in Jezero Crater delta deposits to search for microscopic biosignatures in similar layered structures.',
    rarity: 'exotic',
  },
};
