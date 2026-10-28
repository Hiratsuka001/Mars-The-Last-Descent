/**
 * Story Logs Data: "Memory Fragments"
 * Pre-arrival telemetry notes left by Nova across the 8 historical wrecks.
 * Fiction is strictly demarcated from real NASA mission history.
 */

export interface LogEntry {
  id: string;
  wreckId: string;
  partId: string;
  probeName: string;
  order: number;
  text: string;
  reaction: string;
}

export const LOG_ENTRIES: Record<string, LogEntry> = {
  eq_sojourner: {
    id: 'log_sojourner',
    wreckId: 'eq_sojourner',
    partId: 'part_drive_motor',
    probeName: 'Pathfinder & Sojourner',
    order: 1,
    text: "Another power fault. My memory resets every few sols. I'm leaving notes on old probes so I can rebuild the ship.",
    reaction: "A note left behind... but who?",
  },
  eq_opportunity: {
    id: 'log_opportunity',
    wreckId: 'eq_opportunity',
    partId: 'part_solar_bus',
    probeName: 'Opportunity',
    order: 2,
    text: "This rover worked for years beyond its plan. Lesson: keep going past the plan.",
    reaction: "Keep going past the plan... agreed.",
  },
  eq_insight: {
    id: 'log_insight',
    wreckId: 'eq_insight',
    partId: 'part_inertial_gyro',
    probeName: 'InSight',
    order: 3,
    text: "A lander that only listened. The planet isn't silent. I just had to hold still.",
    reaction: "Hold still and listen. Good advice.",
  },
  eq_spirit: {
    id: 'log_spirit',
    wreckId: 'eq_spirit',
    partId: 'part_suspension_link',
    probeName: 'Spirit',
    order: 4,
    text: "Stuck in soft sand, and still working. Being stuck isn't the end.",
    reaction: "Being stuck isn't the end... true.",
  },
  eq_deep_space_dish: {
    id: 'log_deep_space_dish',
    wreckId: 'eq_deep_space_dish',
    partId: 'part_comm_transponder',
    probeName: 'Deep Space Relay Array',
    order: 5,
    text: "I can still hear Earth, faintly. Somebody is listening. I hope it's someone kind.",
    reaction: "Somebody is listening. I hope so.",
  },
  eq_phoenix: {
    id: 'log_phoenix',
    wreckId: 'eq_phoenix',
    partId: 'part_thermal_core',
    probeName: 'Phoenix',
    order: 6,
    text: "Found ice under the dust. Where there is ice, there is time. No need to hurry.",
    reaction: "No need to hurry... copy that.",
  },
  eq_lrv_buggy: {
    id: 'log_lrv_buggy',
    wreckId: 'eq_lrv_buggy',
    partId: 'part_wheel_actuator',
    probeName: 'Apollo LRV',
    order: 7,
    text: "People drove on the Moon first. Everything we build is a note for the next traveller.",
    reaction: "A note for the next traveller.",
  },
  eq_surveyor: {
    id: 'log_surveyor',
    wreckId: 'eq_surveyor',
    partId: 'part_sample_arm',
    probeName: 'Surveyor 3',
    order: 8,
    text: "If you found all eight: the ship isn't the broken one, I am. Take me home anyway.",
    reaction: "Take me home anyway... will do.",
  },
};

export const ORDERED_LOGS: LogEntry[] = Object.values(LOG_ENTRIES).sort((a, b) => a.order - b.order);

export function getLogForWreck(wreckId: string): LogEntry | undefined {
  return LOG_ENTRIES[wreckId];
}

export function getLogForPart(partId: string): LogEntry | undefined {
  return Object.values(LOG_ENTRIES).find((l) => l.partId === partId);
}

export function deriveLogIdsFromParts(partIds: string[] = [], wreckIds: string[] = []): string[] {
  const result: string[] = [];
  for (const log of ORDERED_LOGS) {
    const hasPart = partIds.some(
      (p) => p === log.partId || p.includes(log.wreckId.replace('eq_', '')) || log.partId.includes(p)
    );
    const hasWreck = wreckIds.some(
      (w) => w === log.wreckId || w.includes(log.wreckId.replace('eq_', '')) || log.wreckId.includes(w)
    );
    if (hasPart || hasWreck) {
      if (!result.includes(log.id)) {
        result.push(log.id);
      }
    }
  }
  return result;
}
