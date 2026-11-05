import { BiomeType } from '../world/biomes';

export interface ShipPart {
  id: string;
  name: string;
  iconKey: string;
  description: string;
}

export interface QuizChallenge {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  spriteKey: string;
  strippedSpriteKey: string;
  preferredBiomes: BiomeType[];
  miniGameType: 'sojourner' | 'opportunity' | 'insight' | 'quiz' | 'marathon' | 'phoenix' | 'spirit' | 'deep_space' | 'lrv_buggy' | 'surveyor';
  miniGameParams?: {
    difficulty?: 'easy' | 'normal' | 'hard';
    quiz?: QuizChallenge;
  };
  rewardPartId: string;
  oneLineHint: string;
  codex?: {
    year: string;
    status: string;
    location: string;
    summary: string;
  };
}

export const SHIP_PARTS: Record<string, ShipPart> = {
  part_drive_motor: {
    id: 'part_drive_motor',
    name: 'Rocker-Bogie Drive Motor',
    iconKey: 'icon_gear',
    description: 'High-torque brushless DC motor salvaged from Sojourner’s rocker-bogie chassis.',
  },
  part_solar_bus: {
    id: 'part_solar_bus',
    name: 'Photovoltaic Power Bus',
    iconKey: 'icon_solar_panel',
    description: 'Gallium arsenide solar bus converter designed for enduring Martian dust storms.',
  },
  part_inertial_gyro: {
    id: 'part_inertial_gyro',
    name: 'Inertial Gyroscope Stabilizer',
    iconKey: 'icon_chip',
    description: 'Ultra-sensitive seismological feedback gyro capable of measuring planetary oscillations.',
  },
  part_suspension_link: {
    id: 'part_suspension_link',
    name: 'Titanium Suspension Arm',
    iconKey: 'icon_wrench',
    description: 'Reinforced titanium linkage engineered to distribute weight across uneven terrain.',
  },
  part_comm_transponder: {
    id: 'part_comm_transponder',
    name: 'High-Gain Comm Transponder',
    iconKey: 'icon_satellite',
    description: 'Deep Space Network microwave transceiver for interplanetary uplink.',
  },
  part_thermal_core: {
    id: 'part_thermal_core',
    name: 'Cryogenic Thermal Core',
    iconKey: 'icon_battery',
    description: 'Radioisotope thermal distribution unit suited for sub-zero polar regions.',
  },
  part_wheel_actuator: {
    id: 'part_wheel_actuator',
    name: 'High-Torque Wheel Actuator',
    iconKey: 'icon_fuel',
    description: 'Sealed planetary gearset extracted from the Apollo electric roving vehicle.',
  },
  part_sample_arm: {
    id: 'part_sample_arm',
    name: 'Robotic Articulated Servo Arm',
    iconKey: 'icon_toolbox',
    description: 'Motorized precision scoop arm designed to collect regolith on foreign worlds.',
  },
};

export const EQUIPMENT_DEFINITIONS: Record<string, EquipmentDefinition> = {
  eq_sojourner: {
    id: 'eq_sojourner',
    name: 'Pathfinder & Sojourner Wreck (1997)',
    spriteKey: 'wreck_sojourner',
    strippedSpriteKey: 'wreck_sojourner_stripped',
    preferredBiomes: ['rocky', 'desert'],
    miniGameType: 'sojourner',
    rewardPartId: 'part_drive_motor',
    oneLineHint: 'Pathfinder’s microrover chassis is intact! Program its guidance sequence around Ares Vallis to claim the drive motor.',
    codex: {
      year: '1997',
      status: 'Completed',
      location: 'Ares Vallis',
      summary: 'Humanity’s first wheeled vehicle on Mars, proving rocker-bogie mobility across rugged alien terrain.',
    },
  },

  eq_opportunity: {
    id: 'eq_opportunity',
    name: 'Opportunity Rover (2004)',
    spriteKey: 'wreck_opportunity',
    strippedSpriteKey: 'wreck_opportunity_stripped',
    preferredBiomes: ['desert', 'rocky'],
    miniGameType: 'marathon',
    rewardPartId: 'part_solar_bus',
    oneLineHint: 'Opportunity explored Meridiani for 14 years. Abrade its sulfate outcrop and zap the Martian Blueberries to extract the solar power bus!',
    codex: {
      year: '2004 – 2018',
      status: 'Completed',
      location: 'Meridiani Planum',
      summary: 'Definitively confirmed past standing and groundwater on Mars through hematite concretions and ripple bedding.',
    },
  },

  eq_insight: {
    id: 'eq_insight',
    name: 'InSight Geophysical Station (2018)',
    spriteKey: 'wreck_insight',
    strippedSpriteKey: 'wreck_insight_stripped',
    preferredBiomes: ['rocky', 'grassland'],
    miniGameType: 'insight',
    rewardPartId: 'part_inertial_gyro',
    oneLineHint: 'InSight’s dome shielded seismometer is humming! Dial out atmospheric surface wind vibrations to unlock the inertial gyro.',
    codex: {
      year: '2018 – 2022',
      status: 'Completed',
      location: 'Elysium Planitia',
      summary: 'Listened to the pulse of Mars, discovering a liquid core and measuring over 1,300 marsquakes.',
    },
  },

  eq_spirit: {
    id: 'eq_spirit',
    name: 'Spirit Rover at Gusev Crater (2004)',
    spriteKey: 'wreck_spirit',
    strippedSpriteKey: 'wreck_spirit_stripped',
    preferredBiomes: ['rocky', 'desert'],
    miniGameType: 'spirit',
    miniGameParams: { difficulty: 'normal' },
    rewardPartId: 'part_suspension_link',
    oneLineHint: 'Spirit dragged a locked wheel backwards across Gusev. Counter-steer the drift to gouge the silica trench and claim the suspension link!',
    codex: {
      year: '2004 – 2010',
      status: 'Completed',
      location: 'Gusev Crater',
      summary: 'Uncovered evidence of hydrothermal hot springs on early Mars before becoming immobilized in a sand drift.',
    },
  },

  eq_deep_space_dish: {
    id: 'eq_deep_space_dish',
    name: 'Deep Space Relay Array',
    spriteKey: 'wreck_deep_space_dish',
    strippedSpriteKey: 'wreck_deep_space_dish_stripped',
    preferredBiomes: ['grassland', 'rocky'],
    miniGameType: 'deep_space',
    miniGameParams: { difficulty: 'easy' },
    rewardPartId: 'part_comm_transponder',
    oneLineHint: 'A massive 70-meter parabolic dish! Aim across deep space to lock onto Earth’s carrier beacon and claim the transponder!',
    codex: {
      year: '1963 – Present',
      status: 'Active',
      location: 'Planetary Relay Grid',
      summary: 'High-gain microwave antenna linking deep space exploration craft to Earth mission controllers.',
    },
  },

  eq_phoenix: {
    id: 'eq_phoenix',
    name: 'Phoenix Polar Ice Lander (2008)',
    spriteKey: 'wreck_phoenix',
    strippedSpriteKey: 'wreck_phoenix_stripped',
    preferredBiomes: ['snow', 'rocky'],
    miniGameType: 'phoenix',
    miniGameParams: { difficulty: 'easy' },
    rewardPartId: 'part_thermal_core',
    oneLineHint: 'Phoenix verified subsurface water ice in the northern plains. Steer the scoop down to the ice and bag the chunks before they sublimate!',
    codex: {
      year: '2008',
      status: 'Completed',
      location: 'Vastitas Borealis',
      summary: 'Dug into arctic permafrost, directly observing sublimating subsurface water ice crystals.',
    },
  },

  eq_lrv_buggy: {
    id: 'eq_lrv_buggy',
    name: 'Apollo Lunar Roving Vehicle (1972)',
    spriteKey: 'wreck_lrv_buggy',
    strippedSpriteKey: 'wreck_lrv_buggy_stripped',
    preferredBiomes: ['rocky', 'grassland'],
    miniGameType: 'lrv_buggy',
    miniGameParams: {
      difficulty: 'normal',
    },
    rewardPartId: 'part_wheel_actuator',
    oneLineHint: 'The Apollo Moon buggy! Drift its wire-mesh wheels over lunar craters to collect historical Apollo sample boxes.',
    codex: {
      year: '1971 – 1972',
      status: 'Decommissioned',
      location: 'Taurus-Littrow Valley',
      summary: 'Expanded astronaut exploration radius from 1 km to over 7 km during Apollo 15, 16, and 17.',
    },
  },

  eq_surveyor: {
    id: 'eq_surveyor',
    name: 'Surveyor 3 Surface Sampler (1967)',
    spriteKey: 'wreck_surveyor',
    strippedSpriteKey: 'wreck_surveyor_stripped',
    preferredBiomes: ['desert', 'rocky'],
    miniGameType: 'surveyor',
    miniGameParams: {
      difficulty: 'normal',
    },
    rewardPartId: 'part_sample_arm',
    oneLineHint: 'Surveyor 3’s robotic scoop proved foreign soil was firm. Salvage its motorized pantograph arm for Earth return!',
    codex: {
      year: '1967 – 1969',
      status: 'Completed',
      location: 'Oceanus Procellarum',
      summary: 'The only robotic spacecraft on another world ever visited, inspected, and partially brought home by humans.',
    },
  },
};

