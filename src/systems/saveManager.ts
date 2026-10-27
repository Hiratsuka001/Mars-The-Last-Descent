/**
 * Save Manager & Persistence System
 * Handles versioned local storage saves for campaign and open-world Mars exploration runs.
 * Backward compatible with v1 saves.
 */

import { SerializedFogOfWar } from '../render/minimap';

export interface PlayerUpgrades {
  jetpack?: boolean;
  scan?: boolean;
  minimap?: boolean;
}

export interface WorldSaveData {
  version: 3;
  seed: number | string;
  playerTileX: number;
  playerTileY: number;
  playerFacing: 'up' | 'down' | 'left' | 'right';
  collectedPartIds: string[];
  completedEquipmentIds: string[];
  exploredFog: SerializedFogOfWar | null;
  shipRepaired: boolean;
  playTimeSeconds: number;
  lastSavedAt: number;
  collectedSampleIds?: string[];
  solTime?: number;
  researchPoints?: number;
  upgrades?: PlayerUpgrades;
}

export interface GameProgress {
  version?: number;
  currentChapter: number; // 0: Main Menu, 1: Prologue, 2: Moon, 3: Mars Crash, 4: Mars Explore, 5: Storm Challenge, 6: Spacecraft Repair, 7: Final Launch, 8: Mission Complete
  unlockedMissions: string[];
  solvedMiniGames: string[];
  quizzesCompleted: string[];
  badges: string[];
  diagnosticsCompleted: string[];
  repairedSubsystems: string[];
  stormDecisionMade: string | null;
  isMuted?: boolean;
  worldSave?: WorldSaveData;
}

const STORAGE_KEY_V3 = 'beyond_depth_save_v3';
const STORAGE_KEY_V2 = 'beyond_depth_save_v2';
const STORAGE_KEY_V1 = 'beyond_depth_save_v1';

const defaultProgress: GameProgress = {
  version: 3,
  currentChapter: 0,
  unlockedMissions: [],
  solvedMiniGames: [],
  quizzesCompleted: [],
  badges: [],
  diagnosticsCompleted: [],
  repairedSubsystems: [],
  stormDecisionMade: null,
  isMuted: false,
};

let lastSaveTimestamp = 0;
const SAVE_THROTTLE_MS = 800; // Throttle frequent auto-saves

/**
 * Format play time in seconds into human-readable string (e.g. "12m 34s")
 */
export function formatPlayTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Migrate legacy WorldSaveData (v1/v2) to v3
 */
function migrateWorldSave(world: any): WorldSaveData {
  return {
    ...world,
    version: 3,
    collectedSampleIds: world.collectedSampleIds || [],
    solTime: typeof world.solTime === 'number' ? world.solTime : 0.35,
    researchPoints: typeof world.researchPoints === 'number' ? world.researchPoints : 0,
    upgrades: {
      jetpack: !!world.upgrades?.jetpack,
      scan: !!world.upgrades?.scan,
      minimap: !!world.upgrades?.minimap,
    },
  };
}

/**
 * Retrieve saved progress with v1 & v2 backward compatibility and migration to v3
 */
export const getSavedProgress = (): GameProgress => {
  try {
    // 1. Try modern v3 save first
    const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed.worldSave) {
        parsed.worldSave = migrateWorldSave(parsed.worldSave);
      }
      return { ...defaultProgress, ...parsed, version: 3 };
    }

    // 2. Try v2 save and migrate
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed.worldSave) {
        parsed.worldSave = migrateWorldSave(parsed.worldSave);
      }
      return { ...defaultProgress, ...parsed, version: 3 };
    }

    // 3. Fall back to legacy v1 save if available
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (parsed.worldSave) {
        parsed.worldSave = migrateWorldSave(parsed.worldSave);
      }
      return { ...defaultProgress, ...parsed, version: 3 };
    }

    return { ...defaultProgress };
  } catch (err) {
    console.warn('[SaveManager] Failed to read save from localStorage:', err);
    return { ...defaultProgress };
  }
};

/**
 * Save progress with optional throttling and storage error handling
 */
export const saveProgress = (progress: GameProgress, force = false): boolean => {
  const now = Date.now();
  if (!force && now - lastSaveTimestamp < SAVE_THROTTLE_MS) {
    return false;
  }

  try {
    const payload = JSON.stringify({ ...progress, version: 3 });
    localStorage.setItem(STORAGE_KEY_V3, payload);
    lastSaveTimestamp = now;
    return true;
  } catch (err) {
    console.error('[SaveManager] Failed to write save to localStorage (storage full?):', err);
    return false;
  }
};

/**
 * Convenience helper to save or update open-world Mars exploration progress
 */
export const saveWorldProgress = (worldData: Partial<WorldSaveData>, force = false): boolean => {
  const current = getSavedProgress();
  const existingWorld = current.worldSave || {
    version: 3 as const,
    seed: 19970704,
    playerTileX: 0,
    playerTileY: 0,
    playerFacing: 'down' as const,
    collectedPartIds: [],
    completedEquipmentIds: [],
    exploredFog: null,
    shipRepaired: false,
    playTimeSeconds: 0,
    lastSavedAt: Date.now(),
    collectedSampleIds: [],
    solTime: 0.35,
    researchPoints: 0,
    upgrades: { jetpack: false, scan: false, minimap: false },
  };

  const updatedWorld: WorldSaveData = {
    ...existingWorld,
    ...worldData,
    version: 3,
    lastSavedAt: Date.now(),
  };

  const updatedProgress: GameProgress = {
    ...current,
    currentChapter: 4,
    worldSave: updatedWorld,
  };

  return saveProgress(updatedProgress, force);
};

/**
 * Check if a playable saved open-world run exists
 */
export const hasSavedWorldRun = (): boolean => {
  const progress = getSavedProgress();
  return (
    !!progress.worldSave &&
    (progress.worldSave.collectedPartIds.length > 0 ||
      progress.worldSave.playTimeSeconds > 5 ||
      (progress.worldSave.exploredFog?.revealedCount ?? 0) > 20)
  );
};

/**
 * Reset all progress (New Game)
 */
export const resetProgress = (): GameProgress => {
  try {
    localStorage.removeItem(STORAGE_KEY_V3);
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(STORAGE_KEY_V1);
  } catch (err) {
    console.warn('[SaveManager] Failed to remove save from localStorage:', err);
  }
  return { ...defaultProgress };
};
