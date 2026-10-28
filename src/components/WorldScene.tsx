import React, { useRef, useEffect, useState, useCallback } from 'react';
import { atlas } from '../render/atlas';
import { WorldChunkManager, CHUNK_PIXEL_SIZE, WorldProp } from '../world/chunk';
import { CollisionSystem } from '../world/collision';
import { EquipmentPlacementSystem, PlacedEquipment, PlacedSample, PlacedLandmark } from '../world/placement';
import { SHIP_PARTS, EquipmentDefinition } from '../data/equipment';
import { SCIENCE_SAMPLES } from '../data/samples';
import { LANDMARK_DEFINITIONS } from '../data/landmarks';
import { drawLandmark } from '../render/landmarkRender';
import { ORDERED_LOGS, getLogForPart, getLogForWreck, deriveLogIdsFromParts } from '../data/logs';
import { PartsHUD } from './PartsHUD';
import { NovaDialogue } from './NovaDialogue';
import { SojournerRoverPuzzle } from './MiniGames/SojournerRoverPuzzle';
import { OpportunityWaterPuzzle } from './MiniGames/OpportunityWaterPuzzle';
import { InSightSeismicPuzzle } from './MiniGames/InSightSeismicPuzzle';
import { FieldQuizModal } from './FieldQuizModal';
import { TileDebugModal } from './TileDebugModal';
import { MinimapHUD } from './MinimapHUD';
import { SpacecraftRepairScene } from './SpacecraftRepairScene';
import { LaunchCinematic } from './LaunchCinematic';
import { EndingScreen } from './EndingScreen';
import { CreditsModal } from './CreditsModal';
import { MissionArchiveModal } from './MissionArchiveModal';
import { FogOfWarSystem, MinimapRenderer, MINIMAP_VIEW_RADIUS, REVEAL_RADIUS_TILES } from '../render/minimap';
import { saveWorldProgress, getSavedProgress, resetProgress, formatPlayTime, PlayerUpgrades, isReduceMotionEnabled, setReduceMotionEnabled } from '../systems/saveManager';
import { getSampleResearchPoints } from '../data/samples';
import { sound } from '../systems/audio';
import { Sparkles, CheckCircle2, Wrench, RotateCcw, Save, ShieldCheck, Zap, Radio, Sun, Moon, Heart, Flame, Microscope, Compass, X } from 'lucide-react';

export interface WorldSceneConfig {
  seed: number | string;
  shipTileX?: number;
  shipTileY?: number;
}

interface WorldSceneProps {
  config?: WorldSceneConfig;
  onExitToMenu?: () => void;
  onOpenArchive?: () => void;
  onOpenSettings?: () => void;
  onRestartWithSeed?: (seed: number | string) => void;
  isMuted?: boolean;
  onToggleSound?: () => void;
}

export const CAMERA_SCALE = 3;

export const isDebugMode = Boolean(
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1')
);

interface RenderEntity {
  type: 'prop' | 'player' | 'nova' | 'ship' | 'equipment' | 'sample';
  sortY: number;
  render: (ctx: CanvasRenderingContext2D) => void;
}

interface FootprintDecal {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  type: 'boot' | 'paw';
  color: string;
  lifetime: number;
  maxLifetime: number;
}

interface WorldParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'heart' | 'spark';
}

export const WorldScene: React.FC<WorldSceneProps> = ({
  config = { seed: 19970704 },
  onExitToMenu,
  onOpenArchive,
  onRestartWithSeed,
  isMuted,
  onToggleSound,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Debug HUD overlay (Toggle with F3) & Tile Debugger (Toggle with F4)
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showTileDebug, setShowTileDebug] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState({
    fps: 60,
    seed: config.seed,
    tileX: 0,
    tileY: 0,
    biome: 'rocky',
    chunksLoaded: 0,
    playerFacing: 'down',
    playerSprite: 'player_idle_down',
    novaFacing: 'down',
    novaSprite: 'nova_idle_down',
    heldKeysList: '',
    exploredTiles: 0,
    exploredChunks: 0,
    viewRadius: MINIMAP_VIEW_RADIUS,
    revealRadius: REVEAL_RADIUS_TILES,
  });

  // World, Collision, and Placement managers
  const worldRef = useRef<WorldChunkManager>(new WorldChunkManager(config.seed));
  const collisionRef = useRef<CollisionSystem>(new CollisionSystem(worldRef.current));
  const placementRef = useRef<EquipmentPlacementSystem | null>(null);
  const equipmentListRef = useRef<PlacedEquipment[]>([]);
  const samplesListRef = useRef<PlacedSample[]>([]);

  // Minimap & Fog-of-War Systems
  const fogRef = useRef<FogOfWarSystem>(new FogOfWarSystem());
  const minimapRendererRef = useRef<MinimapRenderer>(new MinimapRenderer());
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Enlarged Full Map Overlay state (Toggle with M or Minimap tap)
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const isMapOpenRef = useRef<boolean>(false);
  isMapOpenRef.current = isMapOpen;

  // Nova Hint on first full map open
  const hasSeenMapHintRef = useRef<boolean>(false);
  const hasSeenAllPartsHintRef = useRef<boolean>(false);

  // Gameplay State: Completed Equipment & Collected Ship Parts
  const [completedEquipmentIds, setCompletedEquipmentIds] = useState<string[]>([]);
  const [collectedPartIds, setCollectedPartIds] = useState<string[]>([]);
  const completedRef = useRef<string[]>([]);
  completedRef.current = completedEquipmentIds;
  const collectedPartIdsRef = useRef<string[]>([]);
  collectedPartIdsRef.current = collectedPartIds;

  // Field Science Samples State
  const [collectedSampleIds, setCollectedSampleIds] = useState<string[]>([]);
  const collectedSamplesRef = useRef<string[]>([]);
  collectedSamplesRef.current = collectedSampleIds;
  const [nearbySample, setNearbySample] = useState<PlacedSample | null>(null);
  const [sampleToast, setSampleToast] = useState<{ name: string; fact: string } | null>(null);

  // Procedural Natural Landmarks State (5 per world)
  const landmarksListRef = useRef<PlacedLandmark[]>([]);
  const [discoveredLandmarkIds, setDiscoveredLandmarkIds] = useState<string[]>([]);
  const discoveredLandmarksRef = useRef<string[]>([]);
  discoveredLandmarksRef.current = discoveredLandmarkIds;
  const [landmarkToast, setLandmarkToast] = useState<{ name: string; fact: string } | null>(null);
  const lastPlayerTileRef = useRef<{ x: number; y: number } | null>(null);

  // Story Memory Logs State (8 logs tied to historical wreck relics)
  const [recoveredLogIds, setRecoveredLogIds] = useState<string[]>([]);
  const recoveredLogIdsRef = useRef<string[]>([]);
  recoveredLogIdsRef.current = recoveredLogIds;
  const [logToast, setLogToast] = useState<{ number: number; reaction: string; probeName: string } | null>(null);

  // Astronaut Sprint & Jetpack Thruster State
  const [sprintEnergy, setSprintEnergy] = useState<number>(100);
  const sprintEnergyRef = useRef<number>(100);
  const isSprintingRef = useRef<boolean>(false);
  const boostSoundCooldownRef = useRef<number>(0);
  const moraleBoostTimerRef = useRef<number>(0);

  // NOVA Sonar Ping & Compass Navigation State
  const [sonarCooldown, setSonarCooldown] = useState<number>(0);
  const sonarCooldownRef = useRef<number>(0);
  const sonarWaveRef = useRef<{ active: boolean; x: number; y: number; radius: number; maxRadius: number } | null>(null);
  const compassTimerRef = useRef<number>(0);
  const sampleGlintTimerRef = useRef<number>(0); // Glint reveal timer ~6s on Sonar
  const lastCompassPointersRef = useRef<any[]>([]);

  // Research Points & Upgrades Progression Loop (2 levels each)
  const [researchPoints, setResearchPoints] = useState<number>(0);
  const researchPointsRef = useRef<number>(0);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>({
    jetpack: 0,
    scan: 0,
    minimap: 0,
  });
  const upgradesRef = useRef<PlayerUpgrades>({
    jetpack: 0,
    scan: 0,
    minimap: 0,
  });
  const [isShipTerminalOpen, setIsShipTerminalOpen] = useState<boolean>(false);

  // Nova Floating Speech Bubble (Non-Modal, No movement block)
  const [novaBubble, setNovaBubble] = useState<{ text: string; mood?: string } | null>(null);
  const novaBubbleTimerRef = useRef<number>(0);
  const sampleBubbleCooldownRef = useRef<number>(0);
  const generalBubbleCooldownRef = useRef<number>(0);
  const visitedBiomesRef = useRef<Set<string>>(new Set());
  const approachedWrecksRef = useRef<Set<string>>(new Set());
  const novaTrotTargetRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  const novaBubbleElementRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Martian Sol Day/Night Cycle State
  const solTimeRef = useRef<number>(0.35); // 0.0 to 1.0 (start at 0.35 = mid morning)
  const [solTimeDisplay, setSolTimeDisplay] = useState<{ sol: number; timeStr: string; isNight: boolean }>({
    sol: 1,
    timeStr: '08:24',
    isNight: false,
  });

  // Reusable Lighting & Darkness Canvas
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Footprints & Particle Engine
  const footprintsRef = useRef<FootprintDecal[]>([]);
  const particlesRef = useRef<WorldParticle[]>([]);

  // Camera Shake & Juice System (Respects Reduce Motion)
  const cameraShakeRef = useRef<{ time: number; duration: number; intensity: number }>({
    time: 0,
    duration: 0,
    intensity: 0,
  });

  const triggerCameraShake = useCallback((intensity: number = 3.0, duration: number = 0.2) => {
    if (isReduceMotionEnabled()) return;
    cameraShakeRef.current = { time: duration, duration, intensity };
  }, []);

  // Spacecraft Repair, Launch Cinematic & Ending Screen States
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [isShipRepaired, setIsShipRepaired] = useState<boolean>(false);
  const isShipRepairedRef = useRef<boolean>(false);
  isShipRepairedRef.current = isShipRepaired;
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [showEnding, setShowEnding] = useState<boolean>(false);
  const [showCredits, setShowCredits] = useState<boolean>(false);
  const [showCodex, setShowCodex] = useState<boolean>(false);

  // Play Time & Autosave State
  const [playTimeSeconds, setPlayTimeSeconds] = useState<number>(0);
  const playTimeRef = useRef<number>(0);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Active Interactive Proximity State
  const [nearbyEquipment, setNearbyEquipment] = useState<PlacedEquipment | null>(null);
  const [isNearShip, setIsNearShip] = useState<boolean>(false);
  const isNearShipRef = useRef<boolean>(false);
  isNearShipRef.current = isNearShip;

  // Active Modals & Dialogues
  const [novaDialogue, setNovaDialogue] = useState<{
    text: string;
    mood?: 'idle' | 'happy' | 'curious' | 'warning' | 'scanning' | 'celebrate';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const [activeMiniGame, setActiveMiniGame] = useState<{
    equipId: string;
    type: 'sojourner' | 'opportunity' | 'insight' | 'quiz';
    def: EquipmentDefinition;
  } | null>(null);

  // Part Pickup Toast Notification
  const [partToast, setPartToast] = useState<{
    partName: string;
    iconKey: string;
  } | null>(null);

  // Player state (world pixels)
  const playerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: 'down' as 'down' | 'up' | 'left' | 'right',
    isMoving: false,
    walkFrame: 0,
    stepTimer: 0,
  });

  // Active rendered sprite keys for F3 debug inspection
  const debugSpritesRef = useRef({
    playerSprite: 'player_idle_down',
    novaSprite: 'nova_idle_down',
  });

  // Pause movement when dialogue, mini-game, tile debugger, map overlay, repair, launch, ship terminal, or ending is open
  const isPausedRef = useRef(false);
  isPausedRef.current =
    !!activeMiniGame ||
    !!novaDialogue ||
    showTileDebug ||
    isMapOpen ||
    isRepairing ||
    isLaunching ||
    showEnding ||
    showCredits ||
    showCodex ||
    isShipTerminalOpen;

  // NOVA companion state
  const novaRef = useRef({
    x: 0,
    y: 0,
    facing: 'down' as 'down' | 'up' | 'left' | 'right',
    isMoving: false,
    walkFrame: 0,
    trail: [] as { x: number; y: number; facing: 'down' | 'up' | 'left' | 'right' }[],
  });

  // Crashed Spaceship landmark
  const shipPosRef = useRef({
    x: 0,
    y: 0,
    tileX: 0,
    tileY: 0,
  });

  // Camera state (world pixels)
  const cameraRef = useRef({
    x: 0,
    y: 0,
  });

  // Single Held Keys Set (handles e.code: KeyW, KeyA, KeyS, KeyD, ArrowDown, etc.)
  const heldKeysRef = useRef<Set<string>>(new Set());

  // Touch controls state
  const touchStateRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
    boost: false,
  });

  // Stable refs for keyboard event listeners (avoids listener churn on re-renders)
  const showDebugRef = useRef(false);
  showDebugRef.current = showDebug;
  const teleportNearestRef = useRef<() => void>(() => {});

  // Clear keys on any modal or dialogue state change
  useEffect(() => {
    heldKeysRef.current.clear();
  }, [activeMiniGame, novaDialogue, showTileDebug]);

  // Initialize World, Spawn Point, and Deterministic Equipment Scatter
  useEffect(() => {
    worldRef.current = new WorldChunkManager(config.seed);
    collisionRef.current = new CollisionSystem(worldRef.current);

    // Find safe spawn point
    const safeSpawn = collisionRef.current.findSafeSpawnPoint();
    playerRef.current.x = safeSpawn.x;
    playerRef.current.y = safeSpawn.y;
    cameraRef.current.x = safeSpawn.x;
    cameraRef.current.y = safeSpawn.y;

    // Place crashed ship near spawn
    const shipTx = safeSpawn.tileX + 3;
    const shipTy = safeSpawn.tileY + 2;
    shipPosRef.current = {
      tileX: shipTx,
      tileY: shipTy,
      x: shipTx * 16 + 8,
      y: shipTy * 16 + 16,
    };

    // Initialize Equipment & Sample Placement System
    placementRef.current = new EquipmentPlacementSystem(
      config.seed,
      worldRef.current,
      safeSpawn.tileX,
      safeSpawn.tileY
    );
    equipmentListRef.current = placementRef.current.generate();
    samplesListRef.current = placementRef.current.generateSamples();
    landmarksListRef.current = placementRef.current.generateLandmarks();

    // Register obstacle box for canyon rim chasm (walkable around, not over)
    const canyonObstacleBoxes = landmarksListRef.current
      .filter((lm) => lm.id === 'canyon_rim')
      .map((lm) => ({
        x: lm.worldX,
        y: lm.worldY - 26,
        width: 104,
        height: 24,
      }));
    collisionRef.current.setObstacleBoxes(canyonObstacleBoxes);

    // Restore saved open-world progress if available
    const saved = getSavedProgress();
    const worldSave = saved.worldSave;

    if (worldSave && String(worldSave.seed) === String(config.seed)) {
      setCollectedPartIds(worldSave.collectedPartIds || []);
      collectedPartIdsRef.current = worldSave.collectedPartIds || [];
      setCompletedEquipmentIds(worldSave.completedEquipmentIds || []);
      completedRef.current = worldSave.completedEquipmentIds || [];
      setCollectedSampleIds(worldSave.collectedSampleIds || []);
      collectedSamplesRef.current = worldSave.collectedSampleIds || [];
      setDiscoveredLandmarkIds(worldSave.discoveredLandmarkIds || []);
      discoveredLandmarksRef.current = worldSave.discoveredLandmarkIds || [];
      const loadedLogs = Array.isArray(worldSave.recoveredLogIds)
        ? worldSave.recoveredLogIds
        : deriveLogIdsFromParts(worldSave.collectedPartIds || [], worldSave.completedEquipmentIds || []);
      setRecoveredLogIds(loadedLogs);
      recoveredLogIdsRef.current = loadedLogs;
      setResearchPoints(worldSave.researchPoints || 0);
      researchPointsRef.current = worldSave.researchPoints || 0;
      const parseUpgradeLvl = (v: any): number => {
        if (typeof v === 'number') return Math.min(2, Math.max(0, Math.floor(v)));
        return v ? 1 : 0;
      };
      const loadedUpgrades: PlayerUpgrades = {
        jetpack: parseUpgradeLvl(worldSave.upgrades?.jetpack),
        scan: parseUpgradeLvl(worldSave.upgrades?.scan),
        minimap: parseUpgradeLvl(worldSave.upgrades?.minimap),
      };
      setUpgrades(loadedUpgrades);
      upgradesRef.current = loadedUpgrades;
      if (typeof worldSave.solTime === 'number') {
        solTimeRef.current = worldSave.solTime;
      }
      setIsShipRepaired(!!worldSave.shipRepaired);
      isShipRepairedRef.current = !!worldSave.shipRepaired;
      playTimeRef.current = worldSave.playTimeSeconds || 0;
      setPlayTimeSeconds(worldSave.playTimeSeconds || 0);

      if (worldSave.exploredFog) {
        fogRef.current.deserialize(worldSave.exploredFog);
      } else {
        fogRef.current.revealArea(safeSpawn.tileX, safeSpawn.tileY, REVEAL_RADIUS_TILES);
      }

      // Verify walkable tile before restoring position
      const hasValidPos =
        typeof worldSave.playerTileX === 'number' &&
        typeof worldSave.playerTileY === 'number' &&
        !isNaN(worldSave.playerTileX) &&
        !isNaN(worldSave.playerTileY);
      const isWalkable = hasValidPos && collisionRef.current.isTileWalkable(worldSave.playerTileX, worldSave.playerTileY);
      if (isWalkable) {
        playerRef.current.x = worldSave.playerTileX * 16 + 8;
        playerRef.current.y = worldSave.playerTileY * 16 + 12;
        playerRef.current.facing = worldSave.playerFacing || 'down';
      } else {
        playerRef.current.x = safeSpawn.x;
        playerRef.current.y = safeSpawn.y;
      }
    } else {
      playerRef.current.x = safeSpawn.x;
      playerRef.current.y = safeSpawn.y;
      fogRef.current.revealArea(safeSpawn.tileX, safeSpawn.tileY, REVEAL_RADIUS_TILES);
    }

    cameraRef.current.x = playerRef.current.x;
    cameraRef.current.y = playerRef.current.y;

    // Nova starts next to player
    novaRef.current.x = playerRef.current.x - 16;
    novaRef.current.y = playerRef.current.y + 4;
    novaRef.current.trail = [
      { x: playerRef.current.x - 16, y: playerRef.current.y + 4, facing: playerRef.current.facing },
    ];

    // Preload image atlas and re-render chunks on load
    atlas.preloadAll().then(() => {
      worldRef.current.invalidateAllCanvases();
    });
  }, [config.seed]);

  // Teleport Debug Helper (for F3 overlay)
  const teleportToShip = useCallback(() => {
    const ship = shipPosRef.current;
    playerRef.current.x = ship.x - 16;
    playerRef.current.y = ship.y;
    novaRef.current.x = ship.x - 32;
    novaRef.current.y = ship.y;
    novaRef.current.isMoving = false;
    novaRef.current.trail = [
      { x: ship.x - 32, y: ship.y, facing: playerRef.current.facing }
    ];
    cameraRef.current.x = playerRef.current.x;
    cameraRef.current.y = playerRef.current.y;
    setNovaBubble(null);
    novaBubbleTimerRef.current = 0;
    fogRef.current.revealArea(ship.tileX, ship.tileY, REVEAL_RADIUS_TILES);
    sound.playHover();
  }, []);

  const teleportToEquipment = useCallback((targetTileX: number, targetTileY: number) => {
    playerRef.current.x = targetTileX * 16 + 28; // stand to the right of equipment
    playerRef.current.y = targetTileY * 16 + 20;
    playerRef.current.facing = 'left';
    novaRef.current.x = playerRef.current.x + 18;
    novaRef.current.y = playerRef.current.y;
    novaRef.current.facing = 'left';
    novaRef.current.isMoving = false;
    novaRef.current.trail = [
      { x: playerRef.current.x + 18, y: playerRef.current.y, facing: 'left' }
    ];
    cameraRef.current.x = playerRef.current.x;
    cameraRef.current.y = playerRef.current.y;
    setNovaBubble(null);
    novaBubbleTimerRef.current = 0;
    fogRef.current.revealArea(targetTileX, targetTileY, REVEAL_RADIUS_TILES);
    sound.playHover();
  }, []);

  useEffect(() => {
    (window as any).__teleportPlayer = (targetTileX: number, targetTileY: number) => {
      teleportToEquipment(targetTileX, targetTileY);
    };
    (window as any).__getWorld = () => worldRef.current;
    (window as any).__getEquipmentList = () => equipmentListRef.current;
    (window as any).__setPlayerFacing = (facing: 'down' | 'up' | 'left' | 'right') => {
      playerRef.current.facing = facing;
      playerRef.current.isMoving = false;
      playerRef.current.walkFrame = 0;
    };
    (window as any).__setPlayerMoving = (moving: boolean, frame: number = 1.5) => {
      playerRef.current.isMoving = moving;
      playerRef.current.walkFrame = frame;
    };
    (window as any).__setNovaFacing = (facing: 'down' | 'up' | 'left' | 'right', relX: number = -20, relY: number = 0) => {
      novaRef.current.facing = facing;
      novaRef.current.isMoving = false;
      novaRef.current.walkFrame = 0;
      novaRef.current.x = playerRef.current.x + relX;
      novaRef.current.y = playerRef.current.y + relY;
      novaRef.current.trail = [
        { x: novaRef.current.x, y: novaRef.current.y, facing }
      ];
    };
    (window as any).__setNovaMoving = (moving: boolean, frame: number = 1) => {
      novaRef.current.isMoving = moving;
      novaRef.current.walkFrame = frame;
    };
    (window as any).__getPlayer = () => playerRef.current;
    (window as any).__getNova = () => novaRef.current;
    (window as any).__getSamplesList = () => samplesListRef.current;
    (window as any).__getLandmarksList = () => landmarksListRef.current;
    (window as any).__getDiscoveredLandmarks = () => discoveredLandmarksRef.current;
    (window as any).__getResearchPoints = () => researchPointsRef.current;
    (window as any).__getUpgrades = () => upgradesRef.current;
    (window as any).__teleportToSample = (index: number = 0) => {
      const uncollected = samplesListRef.current.filter((s) => !collectedSamplesRef.current.includes(s.id));
      const target = uncollected[index] || samplesListRef.current[index];
      if (target) {
        playerRef.current.x = target.worldX + 14;
        playerRef.current.y = target.worldY;
        playerRef.current.facing = 'left';
        novaRef.current.x = playerRef.current.x + 16;
        novaRef.current.y = playerRef.current.y;
        cameraRef.current.x = playerRef.current.x;
        cameraRef.current.y = playerRef.current.y;
        fogRef.current.revealArea(target.tileX, target.tileY, 18);
        sound.playHover();
      }
    };
    (window as any).__teleportToLandmark = (indexOrId: number | string = 0) => {
      const landmarks = landmarksListRef.current;
      const target = typeof indexOrId === 'number'
        ? landmarks[indexOrId]
        : landmarks.find((l) => l.id === indexOrId);
      if (target) {
        playerRef.current.x = target.worldX;
        playerRef.current.y = target.worldY;
        playerRef.current.facing = 'down';
        novaRef.current.x = playerRef.current.x - 16;
        novaRef.current.y = playerRef.current.y;
        cameraRef.current.x = playerRef.current.x;
        cameraRef.current.y = playerRef.current.y;
        setNovaBubble(null);
        novaBubbleTimerRef.current = 0;
        fogRef.current.revealArea(target.tileX, target.tileY, 20);
        sound.playHover();
        return { success: true, name: target.def.name, id: target.id };
      }
      return { success: false };
    };
    (window as any).__teleportNearLandmark = (indexOrId: number | string = 0, offsetTilesBelow: number = 6) => {
      const landmarks = landmarksListRef.current;
      const target = typeof indexOrId === 'number'
        ? landmarks[indexOrId]
        : landmarks.find((l) => l.id === indexOrId);
      if (target) {
        const wPx = target.def.widthTiles * 16;
        const hPx = target.def.heightTiles * 16;
        const centerWorldX = target.worldX;
        const centerWorldY = target.worldY - hPx / 2;

        const minY = target.worldY - hPx;

        // Player placed exactly 6 tiles BELOW the landmark
        playerRef.current.x = centerWorldX;
        playerRef.current.y = target.worldY + offsetTilesBelow * 16;
        playerRef.current.facing = 'up';
        novaRef.current.x = playerRef.current.x - 16;
        novaRef.current.y = playerRef.current.y;

        // Frame camera so landmark top is safely below HUD bar and player is inside viewport
        cameraRef.current.x = centerWorldX;
        cameraRef.current.y = Math.round(minY + 80);

        // Clear any pending bubbles
        setNovaBubble(null);
        novaBubbleTimerRef.current = 0;

        // Reveal fog of war and set sol daylight
        const tileCX = Math.floor(centerWorldX / 16);
        const tileCY = Math.floor(centerWorldY / 16);
        fogRef.current.revealArea(tileCX, tileCY, 24);
        solTimeRef.current = 0.35;

        sound.playHover();
        return {
          success: true,
          name: target.def.name,
          id: target.id,
          bounds: {
            minX: target.worldX - wPx / 2,
            maxX: target.worldX + wPx / 2,
            minY: target.worldY - hPx,
            maxY: target.worldY,
            centerX: centerWorldX,
            centerY: centerWorldY,
            wPx,
            hPx,
          },
          playerPos: { x: playerRef.current.x, y: playerRef.current.y },
          distTilesBelow: (playerRef.current.y - target.worldY) / 16,
          distTilesX: Math.abs(playerRef.current.x - centerWorldX) / 16,
          distTilesY: Math.abs(playerRef.current.y - centerWorldY) / 16,
        };
      }
      return { success: false };
    };
    (window as any).__dismissLandmarkToast = () => {
      setLandmarkToast(null);
    };
    (window as any).__getRecoveredLogs = () => recoveredLogIdsRef.current;
    (window as any).__grantPart = () => handleGrantOnePart();
    (window as any).__grantAllParts = () => handleGrantAllParts();
    (window as any).__getCameraTransform = () => {
      const canvas = canvasRef.current;
      const width = canvas ? canvas.width : 1366;
      const height = canvas ? canvas.height : 768;
      return {
        cameraX: cameraRef.current.x,
        cameraY: cameraRef.current.y,
        scale: CAMERA_SCALE,
        viewportWidth: width,
        viewportHeight: height,
        viewCenterW: width / 2,
        viewCenterH: height / 2,
      };
    };
    (window as any).__testChasmCollision = () => {
      const collision = collisionRef.current;
      const lm = landmarksListRef.current.find((l) => l.id === 'canyon_rim');
      if (!lm) return { success: false, reason: 'canyon_rim not found' };

      const box = {
        x: lm.worldX,
        y: lm.worldY - 26,
        width: 104,
        height: 24,
      };
      const voidMinX = box.x - box.width / 2;
      const voidMaxX = box.x + box.width / 2;
      const voidMinY = box.y - box.height / 2;
      const voidMaxY = box.y + box.height / 2;

      const results: any[] = [];
      const speeds = [
        { name: 'normal', step: 95 * 0.016 },
        { name: 'jetpack_boost', step: 95 * 1.6 * 0.016 },
      ];

      for (const sp of speeds) {
        // 1. North: Approach from above (y < voidMinY), walking South (+Y)
        {
          let px = box.x;
          let py = voidMinY - 20;
          for (let i = 0; i < 40; i++) {
            const res = collision.resolveMovement(px, py, 0, sp.step, 6, 4);
            px = res.x;
            py = res.y;
          }
          const insideVoid = px > voidMinX && px < voidMaxX && py > voidMinY && py < voidMaxY;
          const hitY = py;
          for (let i = 0; i < 20; i++) {
            const res = collision.resolveMovement(px, py, 0, -sp.step, 6, 4);
            px = res.x;
            py = res.y;
          }
          const movedAway = (hitY - py) >= 12;
          results.push({
            side: 'North',
            speed: sp.name,
            insideVoid,
            stuck: !movedAway,
            passed: !insideVoid && movedAway,
          });
        }

        // 2. South: Approach from below (y > voidMaxY), walking North (-Y)
        {
          let px = box.x;
          let py = voidMaxY + 20;
          for (let i = 0; i < 40; i++) {
            const res = collision.resolveMovement(px, py, 0, -sp.step, 6, 4);
            px = res.x;
            py = res.y;
          }
          const insideVoid = px > voidMinX && px < voidMaxX && py > voidMinY && py < voidMaxY;
          const hitY = py;
          for (let i = 0; i < 20; i++) {
            const res = collision.resolveMovement(px, py, 0, sp.step, 6, 4);
            px = res.x;
            py = res.y;
          }
          const movedAway = (py - hitY) >= 12;
          results.push({
            side: 'South',
            speed: sp.name,
            insideVoid,
            stuck: !movedAway,
            passed: !insideVoid && movedAway,
          });
        }

        // 3. West: Approach from left (x < voidMinX), walking East (+X)
        {
          let px = voidMinX - 20;
          let py = box.y;
          for (let i = 0; i < 40; i++) {
            const res = collision.resolveMovement(px, py, sp.step, 0, 6, 4);
            px = res.x;
            py = res.y;
          }
          const insideVoid = px > voidMinX && px < voidMaxX && py > voidMinY && py < voidMaxY;
          const hitX = px;
          for (let i = 0; i < 20; i++) {
            const res = collision.resolveMovement(px, py, -sp.step, 0, 6, 4);
            px = res.x;
            py = res.y;
          }
          const movedAway = (hitX - px) >= 12;
          results.push({
            side: 'West',
            speed: sp.name,
            insideVoid,
            stuck: !movedAway,
            passed: !insideVoid && movedAway,
          });
        }

        // 4. East: Approach from right (x > voidMaxX), walking West (-X)
        {
          let px = voidMaxX + 20;
          let py = box.y;
          for (let i = 0; i < 40; i++) {
            const res = collision.resolveMovement(px, py, -sp.step, 0, 6, 4);
            px = res.x;
            py = res.y;
          }
          const insideVoid = px > voidMinX && px < voidMaxX && py > voidMinY && py < voidMaxY;
          const hitX = px;
          for (let i = 0; i < 20; i++) {
            const res = collision.resolveMovement(px, py, sp.step, 0, 6, 4);
            px = res.x;
            py = res.y;
          }
          const movedAway = (px - hitX) >= 12;
          results.push({
            side: 'East',
            speed: sp.name,
            insideVoid,
            stuck: !movedAway,
            passed: !insideVoid && movedAway,
          });
        }
      }

      const allPassed = results.every((r) => r.passed);
      return { success: true, allPassed, results };
    };
    (window as any).__testBFSReachability = (seeds?: (string | number)[]) => {
      const targetSeeds = seeds || [19970704, 42, 2026];
      const seedResults: any[] = [];

      for (const s of targetSeeds) {
        const testWorld = new WorldChunkManager(s);
        const testCollision = new CollisionSystem(testWorld);
        const safeSpawn = testCollision.findSafeSpawnPoint();
        const testPlacement = new EquipmentPlacementSystem(s, testWorld, safeSpawn.tileX, safeSpawn.tileY);
        const wrecks = testPlacement.generate();
        const samples = testPlacement.generateSamples();
        const landmarks = testPlacement.generateLandmarks();

        const canyonBoxes = landmarks
          .filter((lm) => lm.id === 'canyon_rim')
          .map((lm) => ({ x: lm.worldX, y: lm.worldY - 26, width: 104, height: 24 }));
        testCollision.setObstacleBoxes(canyonBoxes);

        const visited = new Set<string>();
        const queue: [number, number][] = [[safeSpawn.tileX, safeSpawn.tileY]];
        visited.add(`${safeSpawn.tileX},${safeSpawn.tileY}`);

        const dirs = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [-1, 1], [1, -1], [-1, -1]
        ];

        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const d = Math.hypot(cx - safeSpawn.tileX, cy - safeSpawn.tileY);
          if (d >= 320) continue;

          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            const key = `${nx},${ny}`;
            if (!visited.has(key)) {
              if (testCollision.isTileWalkable(nx, ny)) {
                visited.add(key);
                queue.push([nx, ny]);
              }
            }
          }
        }

        const unreachedWrecks = wrecks.filter((w) => {
          if (visited.has(`${w.tileX},${w.tileY}`)) return false;
          return !dirs.some(([dx, dy]) => visited.has(`${w.tileX + dx},${w.tileY + dy}`));
        });
        const unreachedSamples = samples.filter((sp) => {
          if (visited.has(`${sp.tileX},${sp.tileY}`)) return false;
          return !dirs.some(([dx, dy]) => visited.has(`${sp.tileX + dx},${sp.tileY + dy}`));
        });
        const shipReachable = visited.has(`${safeSpawn.tileX},${safeSpawn.tileY}`);

        seedResults.push({
          seed: s,
          shipReachable,
          totalWrecks: wrecks.length,
          unreachedWrecksCount: unreachedWrecks.length,
          totalSamples: samples.length,
          unreachedSamplesCount: unreachedSamples.length,
          allReachable: shipReachable && unreachedWrecks.length === 0 && unreachedSamples.length === 0,
        });
      }

      const allSeedsPassed = seedResults.every((sr) => sr.allReachable);
      return { allSeedsPassed, seedResults };
    };
    (window as any).__teleportToBiome = (biomeName: string) => {
      const world = worldRef.current;
      const centerTx = Math.floor(playerRef.current.x / 16);
      const centerTy = Math.floor(playerRef.current.y / 16);
      for (let r = 1; r <= 80; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const tx = centerTx + dx;
            const ty = centerTy + dy;
            if (world.getTileBiome(tx, ty) === biomeName && collisionRef.current.isTileWalkable(tx, ty)) {
              playerRef.current.x = tx * 16 + 8;
              playerRef.current.y = ty * 16 + 8;
              cameraRef.current.x = playerRef.current.x;
              cameraRef.current.y = playerRef.current.y;
              setNovaBubble(null);
              novaBubbleTimerRef.current = 0;
              fogRef.current.revealArea(tx, ty, 20);
              return { success: true, tileX: tx, tileY: ty };
            }
          }
        }
      }
      return { success: false };
    };
    (window as any).__getCompassPointerLabels = () => lastCompassPointersRef.current;
    (window as any).__setReduceMotion = (enabled: boolean) => {
      setReduceMotionEnabled(enabled);
    };
    (window as any).__isReduceMotion = () => {
      return isReduceMotionEnabled();
    };
    (window as any).__getCameraShake = () => {
      return cameraShakeRef.current;
    };
    (window as any).__triggerCameraShake = (intensity = 3, duration = 0.2) => {
      triggerCameraShake(intensity, duration);
    };
    (window as any).__checkSampleBiomes = (targetSeed?: number | string) => {
      const s = targetSeed !== undefined ? targetSeed : config.seed;
      const testWorld = new WorldChunkManager(s);
      const testCollision = new CollisionSystem(testWorld);
      const safeSpawn = testCollision.findSafeSpawnPoint();
      const testPlacement = new EquipmentPlacementSystem(s, testWorld, safeSpawn.tileX, safeSpawn.tileY);
      testPlacement.generate();
      const samples = testPlacement.generateSamples();
      const results = samples.map((sample) => {
        const biome = testWorld.getTileBiome(sample.tileX, sample.tileY);
        const matches = sample.def.preferredBiomes.includes(biome);
        return {
          id: sample.id,
          name: sample.def.name,
          rarity: sample.def.rarity,
          biome,
          preferredBiomes: sample.def.preferredBiomes,
          matches,
        };
      });
      const allMatch = results.every((r) => r.matches);
      return { seed: s, allMatch, total: results.length, samples: results };
    };
    return () => {
      delete (window as any).__teleportPlayer;
      delete (window as any).__getWorld;
      delete (window as any).__getEquipmentList;
      delete (window as any).__setPlayerFacing;
      delete (window as any).__setPlayerMoving;
      delete (window as any).__setNovaFacing;
      delete (window as any).__setNovaMoving;
      delete (window as any).__getPlayer;
      delete (window as any).__getNova;
      delete (window as any).__getSamplesList;
      delete (window as any).__getLandmarksList;
      delete (window as any).__getDiscoveredLandmarks;
      delete (window as any).__getRecoveredLogs;
      delete (window as any).__grantPart;
      delete (window as any).__grantAllParts;
      delete (window as any).__getResearchPoints;
      delete (window as any).__getUpgrades;
      delete (window as any).__teleportToSample;
      delete (window as any).__teleportToLandmark;
      delete (window as any).__teleportNearLandmark;
      delete (window as any).__dismissLandmarkToast;
      delete (window as any).__teleportToBiome;
      delete (window as any).__getCompassPointerLabels;
      delete (window as any).__setReduceMotion;
      delete (window as any).__isReduceMotion;
      delete (window as any).__getCameraShake;
      delete (window as any).__triggerCameraShake;
      delete (window as any).__checkSampleBiomes;
      delete (window as any).__getCameraTransform;
      delete (window as any).__testChasmCollision;
      delete (window as any).__testBFSReachability;
    };
  }, [teleportToEquipment]);

  const teleportToNearestUncompleted = useCallback(() => {
    const player = playerRef.current;
    const uncompleted = equipmentListRef.current.filter(
      (e) => !completedRef.current.includes(e.def.id)
    );
    if (uncompleted.length === 0) return;

    // Find nearest
    let nearest = uncompleted[0];
    let minDist = Infinity;
    for (const e of uncompleted) {
      const dist = Math.hypot(player.x - e.worldX, player.y - e.worldY);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    teleportToEquipment(nearest.tileX, nearest.tileY);
  }, [teleportToEquipment]);
  teleportNearestRef.current = teleportToNearestUncompleted;

  const teleportToNearestSample = useCallback(() => {
    const player = playerRef.current;
    const uncollected = samplesListRef.current.filter((s) => !collectedSamplesRef.current.includes(s.id));
    if (uncollected.length === 0) return;
    let nearest = uncollected[0];
    let minDist = Infinity;
    for (const s of uncollected) {
      const dist = Math.hypot(player.x - s.worldX, player.y - s.worldY);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    playerRef.current.x = nearest.worldX + 14;
    playerRef.current.y = nearest.worldY;
    playerRef.current.facing = 'left';
    novaRef.current.x = playerRef.current.x + 16;
    novaRef.current.y = playerRef.current.y;
    cameraRef.current.x = playerRef.current.x;
    cameraRef.current.y = playerRef.current.y;
    setNovaBubble(null);
    novaBubbleTimerRef.current = 0;
    fogRef.current.revealArea(nearest.tileX, nearest.tileY, 18);
    sound.playHover();
  }, []);

  // Autosave Helper
  const triggerAutoSave = useCallback((force = false): boolean => {
    const player = playerRef.current;
    const tileX = Math.floor(player.x / 16);
    const tileY = Math.floor(player.y / 16);

    const ok = saveWorldProgress(
      {
        seed: config.seed,
        playerTileX: tileX,
        playerTileY: tileY,
        playerFacing: player.facing,
        collectedPartIds: collectedPartIdsRef.current,
        completedEquipmentIds: completedRef.current,
        exploredFog: fogRef.current.serialize(),
        shipRepaired: isShipRepairedRef.current,
        playTimeSeconds: playTimeRef.current,
        collectedSampleIds: collectedSamplesRef.current,
        discoveredLandmarkIds: discoveredLandmarksRef.current,
        recoveredLogIds: recoveredLogIdsRef.current,
        solTime: solTimeRef.current,
        researchPoints: researchPointsRef.current,
        upgrades: upgradesRef.current,
      },
      force
    );

    if (force && ok) {
      setSaveToast('Progress Saved');
      setTimeout(() => setSaveToast(null), 2000);
    }
    return ok;
  }, [config.seed]);

  // Play Time Clock & 30-Second Periodic Autosave
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPausedRef.current) {
        playTimeRef.current += 1;
        setPlayTimeSeconds(playTimeRef.current);

        if (playTimeRef.current % 30 === 0) {
          triggerAutoSave(false);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [triggerAutoSave]);

  // Window beforeunload autosave
  useEffect(() => {
    const handleBeforeUnload = () => {
      triggerAutoSave(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [triggerAutoSave]);

  // Debug Helpers for F3 Panel
  const handleManualSave = useCallback(() => {
    sound.playClick();
    triggerAutoSave(true);
  }, [triggerAutoSave]);

  const handleManualLoad = useCallback(() => {
    sound.playClick();
    const saved = getSavedProgress().worldSave;
    if (saved && String(saved.seed) === String(config.seed)) {
      setCollectedPartIds(saved.collectedPartIds || []);
      collectedPartIdsRef.current = saved.collectedPartIds || [];
      setCompletedEquipmentIds(saved.completedEquipmentIds || []);
      completedRef.current = saved.completedEquipmentIds || [];
      setCollectedSampleIds(saved.collectedSampleIds || []);
      collectedSamplesRef.current = saved.collectedSampleIds || [];
      setDiscoveredLandmarkIds(saved.discoveredLandmarkIds || []);
      discoveredLandmarksRef.current = saved.discoveredLandmarkIds || [];
      const loadedLogs = Array.isArray(saved.recoveredLogIds)
        ? saved.recoveredLogIds
        : deriveLogIdsFromParts(saved.collectedPartIds || [], saved.completedEquipmentIds || []);
      setRecoveredLogIds(loadedLogs);
      recoveredLogIdsRef.current = loadedLogs;
      setResearchPoints(saved.researchPoints || 0);
      researchPointsRef.current = saved.researchPoints || 0;
      const parseUpgradeLvl = (v: any): number => {
        if (typeof v === 'number') return Math.min(2, Math.max(0, Math.floor(v)));
        return v ? 1 : 0;
      };
      const loadedUpgrades: PlayerUpgrades = {
        jetpack: parseUpgradeLvl(saved.upgrades?.jetpack),
        scan: parseUpgradeLvl(saved.upgrades?.scan),
        minimap: parseUpgradeLvl(saved.upgrades?.minimap),
      };
      setUpgrades(loadedUpgrades);
      upgradesRef.current = loadedUpgrades;
      if (typeof saved.solTime === 'number') {
        solTimeRef.current = saved.solTime;
      }
      setIsShipRepaired(!!saved.shipRepaired);
      isShipRepairedRef.current = !!saved.shipRepaired;
      playTimeRef.current = saved.playTimeSeconds || 0;
      setPlayTimeSeconds(saved.playTimeSeconds || 0);

      if (saved.exploredFog) {
        fogRef.current.deserialize(saved.exploredFog);
      }

      playerRef.current.x = saved.playerTileX * 16 + 8;
      playerRef.current.y = saved.playerTileY * 16 + 12;
      playerRef.current.facing = saved.playerFacing || 'down';
      cameraRef.current.x = playerRef.current.x;
      cameraRef.current.y = playerRef.current.y;

      setSaveToast('Save Loaded');
      setTimeout(() => setSaveToast(null), 2000);
    }
  }, [config.seed]);

  const handleManualReset = useCallback(() => {
    sound.playClick();
    resetProgress();
    setCollectedPartIds([]);
    collectedPartIdsRef.current = [];
    setCompletedEquipmentIds([]);
    completedRef.current = [];
    setCollectedSampleIds([]);
    collectedSamplesRef.current = [];
    setDiscoveredLandmarkIds([]);
    discoveredLandmarksRef.current = [];
    setRecoveredLogIds([]);
    recoveredLogIdsRef.current = [];
    setResearchPoints(0);
    researchPointsRef.current = 0;
    setUpgrades({ jetpack: 0, scan: 0, minimap: 0 });
    upgradesRef.current = { jetpack: 0, scan: 0, minimap: 0 };
    solTimeRef.current = 0.35;
    sprintEnergyRef.current = 100;
    setSprintEnergy(100);
    setIsShipRepaired(false);
    isShipRepairedRef.current = false;
    playTimeRef.current = 0;
    setPlayTimeSeconds(0);
    setSaveToast('Save Reset');
    setTimeout(() => setSaveToast(null), 2000);
  }, []);

  // NOVA Sonar Radar Scan
  const triggerSonarScan = useCallback(() => {
    if (sonarCooldownRef.current > 0) return;
    sound.playSonarPing();
    sonarCooldownRef.current = 5.0;
    setSonarCooldown(5.0);
    compassTimerRef.current = 5.5;
    sampleGlintTimerRef.current = 6.0; // Sonar scan reveals sample glints for ~6s

    const player = playerRef.current;
    const scanLvl = typeof upgradesRef.current.scan === 'number' ? upgradesRef.current.scan : (upgradesRef.current.scan ? 1 : 0);
    const maxRadius = scanLvl === 2 ? 420 : scanLvl === 1 ? 350 : 280; // +25% Scan Radius per level
    sonarWaveRef.current = {
      active: true,
      x: player.x,
      y: player.y,
      radius: 8,
      maxRadius,
    };

    // Temporarily reveal wide area in fog of war
    const currentTileX = Math.floor(player.x / 16);
    const currentTileY = Math.floor(player.y / 16);
    const minimapLvl = typeof upgradesRef.current.minimap === 'number' ? upgradesRef.current.minimap : (upgradesRef.current.minimap ? 1 : 0);
    const currentRevealRadius = minimapLvl === 2 ? 26 : minimapLvl === 1 ? 22 : 18;
    fogRef.current.revealArea(currentTileX, currentTileY, currentRevealRadius + 8);
  }, []);

  // Pet NOVA Companion & Activate Morale Boost
  const triggerPetNova = useCallback(() => {
    const player = playerRef.current;
    const nova = novaRef.current;
    const dist = Math.hypot(player.x - nova.x, player.y - nova.y);

    if (dist > 45) {
      setNovaBubble({
        text: 'NOVA is too far away to pet! Move closer.',
        mood: 'curious',
      });
      novaBubbleTimerRef.current = 3.5;
      return;
    }

    sound.playNovaPurr();
    moraleBoostTimerRef.current = 6.0;

    // Spawn floating heart particles over NOVA
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: nova.x + (Math.random() - 0.5) * 14,
        y: nova.y - 12 - Math.random() * 8,
        vx: (Math.random() - 0.5) * 15,
        vy: -15 - Math.random() * 20,
        alpha: 1.0,
        size: 8,
        color: '#f43f5e',
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        shape: 'heart',
      });
    }

    setNovaBubble({
      text: 'Purrrrr... *meow*! Morale Overdrive engaged (+15% Speed)!',
      mood: 'happy',
    });
    novaBubbleTimerRef.current = 4.0;
  }, []);

  // Collect Martian Field Science Sample
  const triggerSampleCollect = useCallback((sample: PlacedSample) => {
    if (collectedSamplesRef.current.includes(sample.id)) return;
    sound.playCollectSample();
    triggerCameraShake(2.5, 0.18);

    const nextSamples = Array.from(new Set([...collectedSamplesRef.current, sample.id]));
    setCollectedSampleIds(nextSamples);
    collectedSamplesRef.current = nextSamples;

    // Award Research Points: common 1, rare 2, exotic 3
    const earnedPoints = getSampleResearchPoints(sample.def.rarity);
    const nextPoints = researchPointsRef.current + earnedPoints;
    setResearchPoints(nextPoints);
    researchPointsRef.current = nextPoints;

    triggerAutoSave(true);

    setSampleToast({
      name: sample.def.name,
      fact: sample.def.scienceFact,
    });
    setTimeout(() => {
      setSampleToast(null);
    }, 4500);

    // Nova Reaction Bubble (C.2 - max 12 words)
    setNovaBubble({
      text: `${sample.def.name} secured! +${earnedPoints} RP recorded.`,
      mood: 'happy',
    });
    novaBubbleTimerRef.current = 4.0;
    generalBubbleCooldownRef.current = 15.0;
  }, [triggerAutoSave]);

  // Buy Subsystem Upgrade at Crashed Spaceship (2 levels each: costs 3/6, 4/8, 5/10 RP)
  const handleBuyUpgrade = useCallback((key: 'jetpack' | 'scan' | 'minimap') => {
    const costs: Record<'jetpack' | 'scan' | 'minimap', [number, number]> = {
      jetpack: [3, 6],
      scan: [4, 8],
      minimap: [5, 10],
    };
    const currentVal = upgradesRef.current[key];
    const currentLvl = typeof currentVal === 'number' ? currentVal : (currentVal ? 1 : 0);
    if (currentLvl >= 2) return;

    const cost = costs[key][currentLvl];
    if (researchPointsRef.current < cost) return;

    sound.playSuccess();
    const nextPoints = researchPointsRef.current - cost;
    const nextLvl = currentLvl + 1;
    const nextUpgrades: PlayerUpgrades = { ...upgradesRef.current, [key]: nextLvl };

    setResearchPoints(nextPoints);
    researchPointsRef.current = nextPoints;
    setUpgrades(nextUpgrades);
    upgradesRef.current = nextUpgrades;

    triggerAutoSave(true);
  }, [triggerAutoSave]);

  // Debug Shortcut: Grant 1 Part to test incremental unlocks & story log toasts
  const handleGrantOnePart = useCallback(() => {
    sound.playSuccess();
    for (const log of ORDERED_LOGS) {
      if (!recoveredLogIdsRef.current.includes(log.id) || !collectedPartIdsRef.current.includes(log.partId)) {
        const nextParts = Array.from(new Set([...collectedPartIdsRef.current, log.partId]));
        const nextCompleted = Array.from(new Set([...completedRef.current, log.wreckId]));
        const nextLogs = Array.from(new Set([...recoveredLogIdsRef.current, log.id]));

        setCollectedPartIds(nextParts);
        collectedPartIdsRef.current = nextParts;
        setCompletedEquipmentIds(nextCompleted);
        completedRef.current = nextCompleted;
        setRecoveredLogIds(nextLogs);
        recoveredLogIdsRef.current = nextLogs;

        setLogToast({
          number: nextLogs.length,
          reaction: log.reaction,
          probeName: log.probeName,
        });
        setTimeout(() => {
          setLogToast(null);
        }, 4000);

        triggerAutoSave(true);
        return;
      }
    }
  }, [triggerAutoSave]);

  // Debug Shortcut: Instantly Grant All 8 Parts to test Ship Repair & Launch
  const handleGrantAllParts = useCallback(() => {
    sound.playSuccess();
    const allPartIds = Object.keys(SHIP_PARTS);
    const allEquipIds = equipmentListRef.current.map((e) => e.def.id);
    const allLogIds = ORDERED_LOGS.map((l) => l.id);

    setCollectedPartIds(allPartIds);
    collectedPartIdsRef.current = allPartIds;
    setCompletedEquipmentIds(allEquipIds);
    completedRef.current = allEquipIds;
    setRecoveredLogIds(allLogIds);
    recoveredLogIdsRef.current = allLogIds;
    setResearchPoints(10);
    researchPointsRef.current = 10;

    const lastLog = ORDERED_LOGS[ORDERED_LOGS.length - 1];
    setLogToast({
      number: allLogIds.length,
      reaction: lastLog.reaction,
      probeName: lastLog.probeName,
    });
    setTimeout(() => {
      setLogToast(null);
    }, 4000);

    triggerAutoSave(true);
    setNovaDialogue({
      text: 'DEBUG: All 8 parts unlocked! Return to our ship to commence the repair sequence.',
      mood: 'celebrate',
      actionLabel: 'Return to Ship',
      onAction: () => setNovaDialogue(null),
    });
  }, [triggerAutoSave]);

  // Game control key codes (KeyW, KeyA, KeyS, KeyD, Arrow keys, KeyE, KeyT, KeyM, Escape, Shift, KeyQ, KeyP, etc.)
  const GAME_KEY_CODES = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyE', 'KeyT', 'KeyM', 'Escape', 'Space', 'Enter',
    'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyP',
  ]);

  // Robust Keyboard Event Listeners with single heldKeys Set and window blur cleanup
  useEffect(() => {
    const clearHeldKeys = () => {
      heldKeysRef.current.clear();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Debug Overlay with F3 (Dev or ?debug=1 only)
      if (e.code === 'F3') {
        e.preventDefault();
        if (isDebugMode) {
          setShowDebug((prev) => !prev);
        }
        return;
      }

      // Toggle Tile Debugger Modal with F4 (Dev or ?debug=1 only)
      if (e.code === 'F4') {
        e.preventDefault();
        if (isDebugMode) {
          setShowTileDebug((prev) => !prev);
        }
        return;
      }

      // Toggle Enlarged Map Overlay with M
      if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMapOpen((prev) => {
          const next = !prev;
          if (next && !hasSeenMapHintRef.current) {
            hasSeenMapHintRef.current = true;
            setNovaDialogue({
              text: 'Orange blips are signals from wrecks nearby, explorer.',
              actionLabel: 'Understood',
              onAction: () => setNovaDialogue(null),
            });
          }
          return next;
        });
        return;
      }

      // Close Enlarged Map Overlay with Escape
      if (e.code === 'Escape' && isMapOpenRef.current) {
        e.preventDefault();
        setIsMapOpen(false);
        return;
      }

      // Quick teleport shortcut with T when F3 debug is active
      if (isDebugMode && showDebugRef.current && (e.code === 'KeyT' || e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        teleportNearestRef.current();
        return;
      }

      // Pet NOVA Companion Shortcut with P
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (!isPausedRef.current) {
          triggerPetNova();
        }
        return;
      }

      // Sonar Radar Scan Shortcut with Q
      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        if (!isPausedRef.current) {
          triggerSonarScan();
        }
        return;
      }

      // Control keys: call preventDefault to avoid scrolling or hotkey collisions
      if (GAME_KEY_CODES.has(e.code)) {
        e.preventDefault();
        heldKeysRef.current.add(e.code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (GAME_KEY_CODES.has(e.code)) {
        e.preventDefault();
        // Do not drop momentary action keys (KeyE, Enter, Space) before the render frame consumes them
        if (e.code !== 'KeyE' && e.code !== 'Enter' && e.code !== 'Space') {
          heldKeysRef.current.delete(e.code);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearHeldKeys);
    const handleVisChange = () => {
      if (document.hidden) clearHeldKeys();
    };
    document.addEventListener('visibilitychange', handleVisChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeldKeys);
      document.removeEventListener('visibilitychange', handleVisChange);
    };
  }, [triggerPetNova, triggerSonarScan]);

  // Launch interaction sequence with equipment
  const triggerEquipmentInteract = useCallback((eq: PlacedEquipment) => {
    if (completedRef.current.includes(eq.def.id)) return;

    sound.playClick();
    heldKeysRef.current.delete('KeyE');
    heldKeysRef.current.delete('Enter');

    // Show brief 1-line Nova dialogue hint, then launch mini-game
    setNovaDialogue({
      text: eq.def.oneLineHint,
      actionLabel: 'Deploy Engineering Simulator →',
      onAction: () => {
        setNovaDialogue(null);
        setActiveMiniGame({
          equipId: eq.def.id,
          type: eq.def.miniGameType,
          def: eq.def,
        });
      },
    });
  }, []);

  // Launch interaction sequence with crashed spaceship terminal
  const triggerShipInteract = useCallback(() => {
    sound.playClick();
    heldKeysRef.current.delete('KeyE');
    heldKeysRef.current.delete('Enter');
    setIsShipTerminalOpen(true);
  }, []);

  // Mini-Game Success Callback
  const handleMiniGameSuccess = useCallback(() => {
    if (!activeMiniGame) return;
    const { equipId, def } = activeMiniGame;

    sound.playSuccess();
    const part = SHIP_PARTS[def.rewardPartId];

    // Mark equipment completed and award part
    const nextCompleted = Array.from(new Set([...completedRef.current, equipId]));
    const nextParts = Array.from(new Set([...collectedPartIdsRef.current, def.rewardPartId]));

    setCompletedEquipmentIds(nextCompleted);
    completedRef.current = nextCompleted;
    setCollectedPartIds(nextParts);
    collectedPartIdsRef.current = nextParts;

    // Check if a story memory log unlocks with this part/wreck
    const log = getLogForPart(def.rewardPartId) || getLogForWreck(equipId);
    let logUnlocked = false;
    if (log && !recoveredLogIdsRef.current.includes(log.id)) {
      const nextLogs = Array.from(new Set([...recoveredLogIdsRef.current, log.id]));
      setRecoveredLogIds(nextLogs);
      recoveredLogIdsRef.current = nextLogs;
      logUnlocked = true;

      setLogToast({
        number: nextLogs.length,
        reaction: log.reaction,
        probeName: log.probeName,
      });
      setTimeout(() => {
        setLogToast(null);
      }, 4000);
    }

    // Trigger immediate autosave on part collected
    triggerAutoSave(true);

    // Show Part Pickup Toast only if no story log toast is shown
    if (part && !logUnlocked) {
      setPartToast({
        partName: part.name,
        iconKey: part.iconKey,
      });
      setTimeout(() => {
        setPartToast(null);
      }, 2000);
    }

    setActiveMiniGame(null);

    // If all 8 parts now collected, trigger Nova celebratory dialogue
    if (nextParts.length >= 8 && !hasSeenAllPartsHintRef.current) {
      hasSeenAllPartsHintRef.current = true;
      setTimeout(() => {
        setNovaDialogue({
          text: "All parts found! Let's return to our ship and fix the ascent module.",
          mood: 'celebrate',
          actionLabel: 'Return to Ship',
          onAction: () => setNovaDialogue(null),
        });
      }, 1000);
    }
  }, [activeMiniGame, triggerAutoSave]);

  // Mini-Game Close Callback (Failure / Exit without penalty)
  const handleMiniGameClose = useCallback(() => {
    setActiveMiniGame(null);
  }, []);

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;
    let currentFps = 60;

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        currentFps = Math.round(frameCount / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Pause loop & save resources when browser tab is hidden
      if (document.hidden) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      ctx.imageSmoothingEnabled = false;

      const player = playerRef.current;
      const nova = novaRef.current;
      const camera = cameraRef.current;
      const collision = collisionRef.current;
      const world = worldRef.current;
      const equipmentList = equipmentListRef.current;
      const isPaused = isPausedRef.current;

      // ==========================================
      // 1. INPUT & PLAYER MOVEMENT
      // ==========================================
      let inputX = 0;
      let inputY = 0;

      if (!isPaused) {
        const keys = heldKeysRef.current;
        const touch = touchStateRef.current;
        if (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left) inputX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight') || touch.right) inputX += 1;
        if (keys.has('KeyW') || keys.has('ArrowUp') || touch.up) inputY -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown') || touch.down) inputY += 1;
      }

      const isMoving = inputX !== 0 || inputY !== 0;
      player.isMoving = isMoving;

      if (inputY > 0) player.facing = 'down';
      else if (inputY < 0) player.facing = 'up';
      else if (inputX < 0) player.facing = 'left';
      else if (inputX > 0) player.facing = 'right';

      const currentTileX = Math.floor(player.x / 16);
      const currentTileY = Math.floor(player.y / 16);
      const biomeType = world.getTileBiome(currentTileX, currentTileY);

      // Check Sprint / Thruster Boost
      const keys = heldKeysRef.current;
      const touch = touchStateRef.current;
      const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost) && isMoving;
      let isSprinting = false;

      if (wantsSprint && sprintEnergyRef.current > 5) {
        isSprinting = true;
        const jetpackLvl = typeof upgradesRef.current.jetpack === 'number' ? upgradesRef.current.jetpack : (upgradesRef.current.jetpack ? 1 : 0);
        const drainRate = jetpackLvl === 2 ? 14 : jetpackLvl === 1 ? 20 : 28; // Longer duration with Jetpack upgrade
        sprintEnergyRef.current = Math.max(0, sprintEnergyRef.current - dt * drainRate);
      } else {
        sprintEnergyRef.current = Math.min(100, sprintEnergyRef.current + dt * 20);
      }
      isSprintingRef.current = isSprinting;
      setSprintEnergy(Math.round(sprintEnergyRef.current));

      // Morale boost from Petting NOVA
      if (moraleBoostTimerRef.current > 0) {
        moraleBoostTimerRef.current = Math.max(0, moraleBoostTimerRef.current - dt);
      }
      const moraleMult = moraleBoostTimerRef.current > 0 ? 1.15 : 1.0;
      const sprintMult = isSprinting ? 1.6 : 1.0;
      const speedMultiplier = (biomeType === 'desert' ? 0.92 : biomeType === 'snow' ? 0.88 : 1.0) * sprintMult * moraleMult;
      const baseSpeed = 75 * speedMultiplier;

      if (isMoving && !isPaused) {
        const length = Math.hypot(inputX, inputY) || 1;
        const vx = (inputX / length) * baseSpeed * dt;
        const vy = (inputY / length) * baseSpeed * dt;

        const moveResult = collision.resolveMovement(player.x, player.y, vx, vy, 6, 4);
        player.x = moveResult.x;
        player.y = moveResult.y;

        // Thruster sparks and exhaust audio while sprinting
        if (isSprinting) {
          boostSoundCooldownRef.current -= dt;
          if (boostSoundCooldownRef.current <= 0) {
            sound.playJetpackBoost();
            boostSoundCooldownRef.current = 0.28;
          }

          const fx = player.facing === 'left' ? player.x + 8 : player.facing === 'right' ? player.x - 8 : player.x;
          const fy = player.facing === 'up' ? player.y + 2 : player.y - 14;
          particlesRef.current.push({
            x: fx + (Math.random() - 0.5) * 6,
            y: fy + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 20,
            vy: Math.random() * 20 + 10,
            alpha: 0.9,
            size: 2.5,
            color: Math.random() > 0.4 ? '#38bdf8' : '#f97316',
            life: 0,
            maxLife: 0.25,
            shape: 'spark',
          });

          // Ground dust puffs kicked up by thruster downblast (Juice C.2)
          if (Math.random() < 0.65) {
            const dustColor =
              biomeType === 'snow'
                ? 'rgba(226, 232, 240, 0.65)'
                : biomeType === 'desert'
                ? 'rgba(217, 119, 6, 0.65)'
                : biomeType === 'grassland'
                ? 'rgba(101, 163, 13, 0.55)'
                : 'rgba(194, 65, 12, 0.65)';
            const puffAngle = Math.random() * Math.PI * 2;
            const puffSpeed = 10 + Math.random() * 22;
            particlesRef.current.push({
              x: player.x + (Math.random() - 0.5) * 8,
              y: player.y + 2 + (Math.random() - 0.5) * 4,
              vx: Math.cos(puffAngle) * puffSpeed,
              vy: Math.sin(puffAngle) * puffSpeed * 0.4 - 3,
              alpha: 0.65,
              size: 2.2 + Math.random() * 1.8,
              color: dustColor,
              life: 0,
              maxLife: 0.35 + Math.random() * 0.25,
              shape: 'circle',
            });
          }
        }

        player.walkFrame += dt * (isSprinting ? 12 : 8);
        player.stepTimer += dt;
        const stepInterval = isSprinting ? 0.22 : 0.35;

        if (player.stepTimer >= stepInterval) {
          player.stepTimer = 0;
          const distToShip = Math.hypot(player.x - shipPosRef.current.x, player.y - shipPosRef.current.y);
          if (distToShip < 36) {
            sound.playFootstep('metal');
          } else if (biomeType === 'desert') {
            sound.playFootstep('sand');
          } else if (biomeType === 'snow') {
            sound.playFootstep('snow');
          } else if (biomeType === 'grassland') {
            sound.playFootstep('grass');
          } else {
            sound.playFootstep('regolith');
          }

          // Leave Footprint Decals on terrain
          if (biomeType !== 'water' && biomeType !== 'grassland') {
            const fpColor =
              biomeType === 'snow'
                ? 'rgba(148, 163, 184, 0.45)'
                : biomeType === 'desert'
                ? 'rgba(180, 83, 9, 0.35)'
                : 'rgba(124, 45, 18, 0.4)';
            footprintsRef.current.push({
              x: player.x,
              y: player.y,
              angle:
                player.facing === 'right'
                  ? 0
                  : player.facing === 'down'
                  ? Math.PI / 2
                  : player.facing === 'left'
                  ? Math.PI
                  : -Math.PI / 2,
              alpha: 0.6,
              type: 'boot',
              color: fpColor,
              lifetime: 4.0,
              maxLifetime: 4.0,
            });
            if (footprintsRef.current.length > 200) {
              footprintsRef.current.shift();
            }
          }
        }

        const lastTrail = nova.trail[nova.trail.length - 1];
        if (!lastTrail || Math.hypot(player.x - lastTrail.x, player.y - lastTrail.y) > 4) {
          nova.trail.push({ x: player.x, y: player.y, facing: player.facing });
          if (nova.trail.length > 30) {
            nova.trail.shift();
          }
        }
      }

      // Update ambient wind loop to current biome
      if (!isPaused && !isLaunching && !showEnding) {
        sound.startBiomeWind(biomeType);
      }

      // Prune distant offscreen chunks periodically to cap memory
      const currentCx = Math.floor(currentTileX / 32);
      const currentCy = Math.floor(currentTileY / 32);
      world.cleanupDistantChunks(currentCx, currentCy, 4);

      // ==========================================
      // 2. NOVA COMPANION FOLLOWING LOGIC (Jitter-Free Hysteresis & Continuous Path)
      // ==========================================
      const distToPlayer = Math.hypot(player.x - nova.x, player.y - nova.y);

      // Record player breadcrumbs while player is moving
      if (player.isMoving) {
        const lastPoint = nova.trail[nova.trail.length - 1];
        if (!lastPoint || Math.hypot(player.x - lastPoint.x, player.y - lastPoint.y) >= 6) {
          nova.trail.push({ x: player.x, y: player.y, facing: player.facing });
          if (nova.trail.length > 25) {
            nova.trail.shift();
          }
        }
      }

      // Hysteresis deadband: Start following at 28px, stop following at 18px
      const FOLLOW_START_DIST = 28;
      const FOLLOW_STOP_DIST = 18;

      if (!isPaused) {
        if (distToPlayer > 120) {
          // Snap if teleported or too far away
          nova.x = player.x - 20;
          nova.y = player.y;
          nova.trail = [{ x: nova.x, y: nova.y, facing: player.facing }];
          nova.isMoving = false;
        } else if (nova.isMoving ? distToPlayer > FOLLOW_STOP_DIST : distToPlayer > FOLLOW_START_DIST) {
          nova.isMoving = true;

          // Prune waypoints Nova has already reached
          while (nova.trail.length > 1 && Math.hypot(nova.trail[0].x - nova.x, nova.trail[0].y - nova.y) < 6) {
            nova.trail.shift();
          }

          const target = nova.trail.length > 0 ? nova.trail[0] : player;
          const tdx = target.x - nova.x;
          const tdy = target.y - nova.y;
          const tDist = Math.hypot(tdx, tdy);

          if (tDist > 0.5) {
            // Smooth speed matching player speed
            const followSpeed = distToPlayer > 45 ? 90 : 75;
            const step = Math.min(tDist, followSpeed * dt);
            nova.x += (tdx / tDist) * step;
            nova.y += (tdy / tDist) * step;

            // Facing direction from movement vector
            if (Math.abs(tdx) > Math.abs(tdy) * 1.2) {
              nova.facing = tdx > 0 ? 'right' : 'left';
            } else if (Math.abs(tdy) > Math.abs(tdx) * 1.2) {
              nova.facing = tdy > 0 ? 'down' : 'up';
            } else {
              nova.facing = target.facing;
            }

            nova.walkFrame += dt * 6.5;

            // Occasional pawprint in sand/snow/regolith
            if (Math.random() < 0.22 && biomeType !== 'water' && biomeType !== 'grassland') {
              const fpColor =
                biomeType === 'snow'
                  ? 'rgba(148, 163, 184, 0.35)'
                  : biomeType === 'desert'
                  ? 'rgba(180, 83, 9, 0.28)'
                  : 'rgba(124, 45, 18, 0.3)';
              footprintsRef.current.push({
                x: nova.x,
                y: nova.y,
                angle: 0,
                alpha: 0.45,
                type: 'paw',
                color: fpColor,
                lifetime: 4.0,
                maxLifetime: 4.0,
              });
              if (footprintsRef.current.length > 200) {
                footprintsRef.current.shift();
              }
            }
          }
        } else {
          nova.isMoving = false;
          nova.walkFrame = 0;
          if (nova.trail.length > 2) {
            nova.trail = nova.trail.slice(-2);
          }

          // C.1: Nova Trot toward nearby uncollected sample if player is idle
          if (novaTrotTargetRef.current && novaTrotTargetRef.current.timer > 0) {
            const trot = novaTrotTargetRef.current;
            trot.timer -= dt;
            const tdx = trot.x - nova.x;
            const tdy = trot.y - nova.y;
            const tDist = Math.hypot(tdx, tdy);
            if (tDist > 2) {
              nova.isMoving = true;
              nova.walkFrame += dt * 6.0;
              nova.x += (tdx / tDist) * Math.min(tDist, 35 * dt);
              nova.y += (tdy / tDist) * Math.min(tDist, 35 * dt);
              nova.facing = Math.abs(tdx) > Math.abs(tdy) ? (tdx > 0 ? 'right' : 'left') : (tdy > 0 ? 'down' : 'up');
            } else {
              novaTrotTargetRef.current = null;
            }
          }
        }
      }

      // Decrement bubble and cooldown timers
      if (novaBubbleTimerRef.current > 0) {
        novaBubbleTimerRef.current -= dt;
        if (novaBubbleTimerRef.current <= 0) {
          setNovaBubble(null);
        }
      }
      if (sampleBubbleCooldownRef.current > 0) sampleBubbleCooldownRef.current -= dt;
      if (generalBubbleCooldownRef.current > 0) generalBubbleCooldownRef.current -= dt;
      if (sampleGlintTimerRef.current > 0) sampleGlintTimerRef.current -= dt;

      // B.4: Clear any pending biome-comment bubble when player teleports or changes chunk by > 10 tiles
      const curTileX = Math.floor(player.x / 16);
      const curTileY = Math.floor(player.y / 16);
      if (lastPlayerTileRef.current) {
        const dTilesX = Math.abs(curTileX - lastPlayerTileRef.current.x);
        const dTilesY = Math.abs(curTileY - lastPlayerTileRef.current.y);
        if (dTilesX > 10 || dTilesY > 10) {
          setNovaBubble(null);
          novaBubbleTimerRef.current = 0;
        }
      }
      lastPlayerTileRef.current = { x: curTileX, y: curTileY };

      // C.1: If uncollected sample within ~20 tiles (320px), Nova trots a few tiles toward it with chirp/"?"
      if (sampleBubbleCooldownRef.current <= 0 && !isPaused) {
        const samples = samplesListRef.current;
        let nearSample: PlacedSample | null = null;
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          if (collectedSamplesRef.current.includes(s.id)) continue;
          const dist = Math.hypot(player.x - s.worldX, player.y - s.worldY);
          if (dist <= 320) {
            nearSample = s;
            break;
          }
        }
        if (nearSample) {
          const angle = Math.atan2(nearSample.worldY - nova.y, nearSample.worldX - nova.x);
          novaTrotTargetRef.current = {
            x: nova.x + Math.cos(angle) * 36,
            y: nova.y + Math.sin(angle) * 36,
            timer: 1.5,
          };
          setNovaBubble({
            text: '? Chirp! Mineral glint detected nearby...',
            mood: 'curious',
          });
          novaBubbleTimerRef.current = 4.0;
          sampleBubbleCooldownRef.current = 25.0; // Cooldown 25s
          generalBubbleCooldownRef.current = 15.0; // Max one bubble per 15s
          sound.playHover();
        }
      }

      // C.2: One-line comment on entering a new biome (once per biome per run, max 12 words)
      if (!visitedBiomesRef.current.has(biomeType)) {
        visitedBiomesRef.current.add(biomeType);
        if (visitedBiomesRef.current.size > 1 && generalBubbleCooldownRef.current <= 0) {
          const biomeMsgs: Record<string, string> = {
            desert: 'Vast dunes detected. Sand might slow our stride.',
            snow: 'Subsurface polar frost detected. Extreme cold ahead!',
            grassland: 'Terraformed vegetation verified. Liquid water must exist!',
            rocky: 'Regolith plains detected. High concentration of minerals.',
          };
          const msg = biomeMsgs[biomeType];
          if (msg) {
            setNovaBubble({ text: msg, mood: 'curious' });
            novaBubbleTimerRef.current = 4.0;
            generalBubbleCooldownRef.current = 15.0;
          }
        }
      }

      // C.2: One-line comment on approaching a wreck (within 96px, once per wreck, max 12 words)
      if (generalBubbleCooldownRef.current <= 0 && !isPaused) {
        for (let i = 0; i < equipmentList.length; i++) {
          const eq = equipmentList[i];
          if (completedRef.current.includes(eq.def.id)) continue;
          if (approachedWrecksRef.current.has(eq.def.id)) continue;
          const dist = Math.hypot(player.x - eq.worldX, player.y - eq.worldY);
          if (dist <= 96) {
            approachedWrecksRef.current.add(eq.def.id);
            setNovaBubble({
              text: "Historical telemetry locked! Let's inspect the rover.",
              mood: 'curious',
            });
            novaBubbleTimerRef.current = 4.0;
            generalBubbleCooldownRef.current = 15.0;
            break;
          }
        }
      }

      // Slow-moving dust devil animation drift
      const dustDevil = landmarksListRef.current.find((lm) => lm.id === 'dust_devil');
      if (dustDevil) {
        if ((dustDevil as any).baseWorldX === undefined) {
          (dustDevil as any).baseWorldX = dustDevil.worldX;
          (dustDevil as any).baseWorldY = dustDevil.worldY;
        }
        dustDevil.worldX = (dustDevil as any).baseWorldX + Math.sin(time * 0.0006) * 36;
        dustDevil.worldY = (dustDevil as any).baseWorldY + Math.cos(time * 0.0004) * 28;
      }

      // Landmark Discovery Check (walking within 5 tiles = 80px discovers once)
      if (!isPaused) {
        const landmarks = landmarksListRef.current;
        for (let lIdx = 0; lIdx < landmarks.length; lIdx++) {
          const lm = landmarks[lIdx];
          if (discoveredLandmarksRef.current.includes(lm.id)) continue;
          const dist = Math.hypot(player.x - lm.worldX, player.y - lm.worldY);
          if (dist <= 80) {
            const nextDiscovered = [...discoveredLandmarksRef.current, lm.id];
            discoveredLandmarksRef.current = nextDiscovered;
            setDiscoveredLandmarkIds(nextDiscovered);

            const nextRP = researchPointsRef.current + 1;
            researchPointsRef.current = nextRP;
            setResearchPoints(nextRP);

            setLandmarkToast({
              name: lm.def.name,
              fact: lm.def.scienceFact,
            });
            setTimeout(() => {
              setLandmarkToast(null);
            }, 5000);

            const novaLines: Record<string, string> = {
              canyon_rim: "Dizzying abyss... watch your step near the chasm edge!",
              shield_volcano: "Ancient basalt caldera ahead. Low slopes, colossal scale.",
              river_delta: "Branching channels! Ancient river systems once flowed here.",
              ice_cave: "Subzero glacial cavern archway. Watch for falling icicles!",
              dust_devil: "Spinning thermal dust vortex! Keep your visor seal tight.",
            };
            setNovaBubble({
              text: novaLines[lm.id] || `Fascinating Martian geology: ${lm.def.name}!`,
              mood: 'celebrate',
            });
            novaBubbleTimerRef.current = 4.5;
            generalBubbleCooldownRef.current = 15.0;

            sound.playLandmarkDiscovery();
            triggerCameraShake(3.5, 0.28);
            triggerAutoSave(true);
            break;
          }
        }
      }

      // ==========================================
      // 3. PROXIMITY CHECK TO EQUIPMENT, SHIP & SAMPLES
      // ==========================================
      let nearestActive: PlacedEquipment | null = null;
      let minDistance = 34; // 34px interaction range (~2 tiles)

      for (let i = 0; i < equipmentList.length; i++) {
        const eq = equipmentList[i];
        if (completedRef.current.includes(eq.def.id)) continue;

        const dist = Math.hypot(player.x - eq.worldX, player.y - eq.worldY);
        if (dist < minDistance) {
          minDistance = dist;
          nearestActive = eq;
        }
      }

      setNearbyEquipment(nearestActive);

      // Check proximity to Crashed Spaceship Landmark
      const ship = shipPosRef.current;
      const distToShip = Math.hypot(player.x - ship.x, player.y - ship.y);
      const nearShip = distToShip < 55;
      setIsNearShip(nearShip);
      isNearShipRef.current = nearShip;

      // Check proximity to uncollected Science Samples
      const samplesList = samplesListRef.current;
      let nearestSample: PlacedSample | null = null;
      let minSampleDist = 28;

      for (let i = 0; i < samplesList.length; i++) {
        const s = samplesList[i];
        if (collectedSamplesRef.current.includes(s.id)) continue;
        const dist = Math.hypot(player.x - s.worldX, player.y - s.worldY);
        if (dist < minSampleDist) {
          minSampleDist = dist;
          nearestSample = s;
        }
      }
      setNearbySample(nearestSample);

      // Check [E] / Enter key interaction trigger
      const isInteract = heldKeysRef.current.has('KeyE') || heldKeysRef.current.has('Enter') || touchStateRef.current.interact;
      if (isInteract) {
        heldKeysRef.current.delete('KeyE');
        heldKeysRef.current.delete('Enter');
        touchStateRef.current.interact = false;

        if (!isPaused) {
          if (nearestActive) {
            triggerEquipmentInteract(nearestActive);
          } else if (nearShip) {
            triggerShipInteract();
          } else if (nearestSample) {
            triggerSampleCollect(nearestSample);
          }
        }
      }

      // Check Space key: if near interactable, interact; otherwise trigger sonar scan
      if (heldKeysRef.current.has('Space')) {
        heldKeysRef.current.delete('Space');
        if (!isPaused) {
          if (nearestActive) {
            triggerEquipmentInteract(nearestActive);
          } else if (nearShip) {
            triggerShipInteract();
          } else if (nearestSample) {
            triggerSampleCollect(nearestSample);
          } else {
            triggerSonarScan();
          }
        }
      }

      // Update Sol Day/Night progression
      if (!isPaused) {
        solTimeRef.current = (solTimeRef.current + dt / 180) % 1.0;
        const solHour = solTimeRef.current * 24;
        const hours = Math.floor(solHour);
        const mins = Math.floor((solHour % 1) * 60);
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        const isNight = solTimeRef.current > 0.75 || solTimeRef.current < 0.22;
        const currentSolNumber = 1 + Math.floor(playTimeRef.current / 180);
        setSolTimeDisplay({ sol: currentSolNumber, timeStr, isNight });
      }

      // Update Sonar & Compass Cooldowns
      if (sonarCooldownRef.current > 0) {
        sonarCooldownRef.current = Math.max(0, sonarCooldownRef.current - dt);
        setSonarCooldown(Math.round(sonarCooldownRef.current * 10) / 10);
      }
      if (compassTimerRef.current > 0) {
        compassTimerRef.current = Math.max(0, compassTimerRef.current - dt);
      }
      if (sonarWaveRef.current && sonarWaveRef.current.active) {
        sonarWaveRef.current.radius += dt * 300;
        if (sonarWaveRef.current.radius >= sonarWaveRef.current.maxRadius) {
          sonarWaveRef.current.active = false;
        }
      }

      // Update Footprints (Fade and remove after ~4s - Juice C.1)
      for (let fIdx = footprintsRef.current.length - 1; fIdx >= 0; fIdx--) {
        const fp = footprintsRef.current[fIdx];
        fp.lifetime -= dt;
        if (fp.lifetime <= 0) {
          footprintsRef.current.splice(fIdx, 1);
        }
      }

      // Update Particles (Dust puffs expand as they dissipate - Juice C.2)
      for (let pIdx = particlesRef.current.length - 1; pIdx >= 0; pIdx--) {
        const p = particlesRef.current[pIdx];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.shape === 'circle') {
          p.size += dt * 3.5;
        }
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.life >= p.maxLife) {
          particlesRef.current.splice(pIdx, 1);
        }
      }

      // ==========================================
      // 4. CAMERA (Nudge / Shake - Juice C.3 & C.4)
      // ==========================================
      let targetCamX = player.x;
      let targetCamY = player.y;

      // When near a landmark (within 12 tiles), frame smoothly between player and landmark center
      const nearbyLandmark = landmarksListRef.current.find((lm) => {
        const lmCenterY = lm.worldY - (lm.def.heightTiles * 16) / 2;
        return Math.hypot(player.x - lm.worldX, player.y - lmCenterY) <= 12 * 16;
      });
      if (nearbyLandmark) {
        const lmMinY = nearbyLandmark.worldY - (nearbyLandmark.def.heightTiles * 16);
        targetCamX = nearbyLandmark.worldX;
        targetCamY = Math.round(lmMinY + 80);
      }

      camera.x += (targetCamX - camera.x) * 0.15;
      camera.y += (targetCamY - camera.y) * 0.15;

      if (cameraShakeRef.current.time > 0) {
        cameraShakeRef.current.time -= dt;
        if (cameraShakeRef.current.time < 0) cameraShakeRef.current.time = 0;
      }

      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (cameraShakeRef.current.time > 0 && !isReduceMotionEnabled()) {
        const progress = cameraShakeRef.current.time / cameraShakeRef.current.duration;
        const currentMag = cameraShakeRef.current.intensity * progress;
        shakeOffsetX = (Math.random() - 0.5) * 2 * currentMag;
        shakeOffsetY = (Math.random() - 0.5) * 2 * currentMag;
      }

      const camRenderX = Math.round(camera.x + shakeOffsetX);
      const camRenderY = Math.round(camera.y + shakeOffsetY);

      // ==========================================
      // 5. RENDERING PIPELINE
      // ==========================================
      ctx.save();
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const viewCenterW = canvas.width / 2;
      const viewCenterH = canvas.height / 2;

      ctx.translate(viewCenterW, viewCenterH);
      ctx.scale(CAMERA_SCALE, CAMERA_SCALE);
      ctx.translate(-camRenderX, -camRenderY);

      const halfViewW = viewCenterW / CAMERA_SCALE;
      const halfViewH = viewCenterH / CAMERA_SCALE;
      const minWorldX = camRenderX - halfViewW - 48;
      const maxWorldX = camRenderX + halfViewW + 48;
      const minWorldY = camRenderY - halfViewH - 48;
      const maxWorldY = camRenderY + halfViewH + 48;

      const minCx = Math.floor(minWorldX / CHUNK_PIXEL_SIZE);
      const maxCx = Math.floor(maxWorldX / CHUNK_PIXEL_SIZE);
      const minCy = Math.floor(minWorldY / CHUNK_PIXEL_SIZE);
      const maxCy = Math.floor(maxWorldY / CHUNK_PIXEL_SIZE);

      const visibleProps: WorldProp[] = [];

      // Pass 1: Chunk Terrains
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const chunk = world.getChunk(cx, cy);
          const chunkCanvas = world.prerenderChunk(chunk);
          ctx.drawImage(chunkCanvas, cx * CHUNK_PIXEL_SIZE, cy * CHUNK_PIXEL_SIZE);

          for (let i = 0; i < chunk.props.length; i++) {
            const p = chunk.props[i];
            if (p.x >= minWorldX && p.x <= maxWorldX && p.y >= minWorldY && p.y <= maxWorldY) {
              visibleProps.push(p);
            }
          }
        }
      }

      // Pass 1b: Subtle Water Shimmer Effect on visible water tiles
      const startTileX = Math.floor(minWorldX / 16);
      const endTileX = Math.ceil(maxWorldX / 16);
      const startTileY = Math.floor(minWorldY / 16);
      const endTileY = Math.ceil(maxWorldY / 16);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          if (world.getTileBiome(tx, ty) === 'water') {
            const shimmer = Math.sin(time * 0.003 + tx * 1.5 + ty * 2.3);
            if (shimmer > 0.72) {
              const sx = tx * 16 + 4 + Math.floor((shimmer - 0.72) * 12);
              const sy = ty * 16 + 7;
              ctx.fillRect(sx, sy, 3, 1);
            }
          }
        }
      }

      // Pass 1c: Footprints (Boot treadmarks and Nova pawprints on ground)
      for (let fIdx = 0; fIdx < footprintsRef.current.length; fIdx++) {
        const fp = footprintsRef.current[fIdx];
        if (fp.x >= minWorldX && fp.x <= maxWorldX && fp.y >= minWorldY && fp.y <= maxWorldY) {
          ctx.save();
          ctx.translate(fp.x, fp.y);
          ctx.rotate(fp.angle);
          ctx.globalAlpha = Math.max(0, fp.alpha * (fp.lifetime / fp.maxLifetime));
          ctx.fillStyle = fp.color;
          if (fp.type === 'boot') {
            ctx.fillRect(-2, -3, 4, 2);
            ctx.fillRect(-1.5, 0, 3, 3);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Pass 2: Y-Sorted Entities (Props, Equipment, Samples, Ship, Player, Nova)
      const renderList: RenderEntity[] = [];

      // Add Terrain Props
      for (let i = 0; i < visibleProps.length; i++) {
        const prop = visibleProps[i];
        renderList.push({
          type: 'prop',
          sortY: prop.y,
          render: (c) => {
            const drawX = Math.round(prop.x - prop.width / 2);
            const drawY = Math.round(prop.y - prop.height);
            atlas.drawSprite(c, prop.spriteKey, drawX, drawY, prop.width, prop.height);
          },
        });
      }

      // Add Placed Science Samples
      const visibleSamples = samplesListRef.current;
      for (let sIdx = 0; sIdx < visibleSamples.length; sIdx++) {
        const s = visibleSamples[sIdx];
        if (collectedSamplesRef.current.includes(s.id)) continue;
        if (s.worldX >= minWorldX && s.worldX <= maxWorldX && s.worldY >= minWorldY && s.worldY <= maxWorldY) {
          renderList.push({
            type: 'sample',
            sortY: s.worldY,
            render: (c) => {
              // Contact shadow
              c.fillStyle = 'rgba(0, 0, 0, 0.45)';
              c.beginPath();
              c.ellipse(s.worldX, s.worldY - 2, 7, 3, 0, 0, Math.PI * 2);
              c.fill();

              // Shimmer pulse
              const pulse = (Math.sin(time * 0.007 + sIdx * 1.5) + 1) * 0.5;
              atlas.drawSprite(c, s.def.spriteKey, Math.round(s.worldX - 8), Math.round(s.worldY - 14), 16, 16);

              // Twinkling energy particle
              c.fillStyle = `rgba(56, 189, 248, ${0.4 + pulse * 0.5})`;
              c.beginPath();
              c.arc(s.worldX, s.worldY - 7, 1.5 + pulse * 1.2, 0, Math.PI * 2);
              c.fill();

              // Proximity Tag & [E] Key Prompt
              const isNearby = nearbySample?.id === s.id;
              if (isNearby) {
                const tagY = s.worldY - 22;
                c.fillStyle = 'rgba(2, 6, 23, 0.9)';
                c.strokeStyle = '#38bdf8';
                c.lineWidth = 1;
                c.font = '8px monospace';
                c.textAlign = 'center';
                const label = `${s.def.name} [E]`;
                const textWidth = c.measureText(label).width;
                const boxW = textWidth + 12;

                c.fillRect(s.worldX - boxW / 2, tagY, boxW, 14);
                c.strokeRect(s.worldX - boxW / 2, tagY, boxW, 14);

                c.fillStyle = '#38bdf8';
                c.fillText(label, s.worldX, tagY + 10);
                atlas.drawSprite(c, 'key_e', s.worldX - 6, tagY - 15, 12, 12);
              }
            },
          });
        }
      }

      // Add Procedural Natural Landmarks (5 per world, 6-10 tiles wide)
      const visibleLandmarks = landmarksListRef.current;
      for (let lIdx = 0; lIdx < visibleLandmarks.length; lIdx++) {
        const lm = visibleLandmarks[lIdx];
        const halfW = (lm.def.widthTiles * 16) / 2;
        const h = lm.def.heightTiles * 16;
        if (
          lm.worldX + halfW >= minWorldX - 100 &&
          lm.worldX - halfW <= maxWorldX + 100 &&
          lm.worldY >= minWorldY - 100 &&
          lm.worldY - h <= maxWorldY + 100
        ) {
          renderList.push({
            type: 'landmark' as any,
            sortY: lm.worldY,
            render: (c) => {
              drawLandmark(c, lm, time);

              // If discovered, draw subtle holographic marker/nameplate only within 8 tiles (fading out between 6 and 8 tiles)
              const isDiscovered = discoveredLandmarksRef.current.includes(lm.id);
              const distToPlayer = Math.hypot(player.x - lm.worldX, player.y - lm.worldY);
              const maxDist = 8 * 16; // 128px
              const fadeStartDist = 6 * 16; // 96px
              if (isDiscovered && distToPlayer <= maxDist) {
                const tagAlpha = distToPlayer <= fadeStartDist
                  ? 1.0
                  : Math.max(0, 1.0 - (distToPlayer - fadeStartDist) / (maxDist - fadeStartDist));
                c.save();
                c.globalAlpha = tagAlpha;
                c.font = 'bold 8px monospace';
                c.textAlign = 'center';

                const tagText = lm.def.name;
                const tagW = c.measureText(tagText).width + 12;

                // Requirement B.3: Landmark name tags must stay fully on screen (clamp below the HUD bar)
                const naturalTagY = Math.round(lm.worldY - h - 14);
                // Top HUD bar height is ~56px in screen space. Tag box top is tagY - 8.
                // Screen Y = viewCenterH + (tagY - 8 - camRenderY) * CAMERA_SCALE >= 62
                const minTagY = camRenderY + (62 - viewCenterH) / CAMERA_SCALE + 8;
                const maxTagY = camRenderY + (canvas.height - 24 - viewCenterH) / CAMERA_SCALE - 5;
                const tagY = Math.max(minTagY, Math.min(maxTagY, naturalTagY));

                // Horizontal clamping within screen bounds
                const minTagX = camRenderX + (16 - viewCenterW) / CAMERA_SCALE + tagW / 2;
                const maxTagX = camRenderX + (canvas.width - 16 - viewCenterW) / CAMERA_SCALE - tagW / 2;
                const tagX = Math.max(minTagX, Math.min(maxTagX, lm.worldX));

                c.fillStyle = 'rgba(2, 6, 23, 0.85)';
                c.strokeStyle = lm.def.iconColor || '#38bdf8';
                c.lineWidth = 1;
                c.fillRect(tagX - tagW / 2, tagY - 8, tagW, 13);
                c.strokeRect(tagX - tagW / 2, tagY - 8, tagW, 13);
                c.fillStyle = '#f8fafc';
                c.fillText(tagText, tagX, tagY + 2);
                c.restore();
              }
            },
          });
        }
      }

      // Add Crashed Ship Landmark
      renderList.push({
        type: 'ship',
        sortY: ship.y,
        render: (c) => {
          // 1. Ground blast crater & scorch
          c.fillStyle = 'rgba(24, 7, 3, 0.7)';
          c.beginPath();
          c.ellipse(ship.x, ship.y - 4, 38, 16, 0, 0, Math.PI * 2);
          c.fill();

          c.fillStyle = 'rgba(10, 3, 1, 0.8)';
          c.beginPath();
          c.ellipse(ship.x, ship.y - 3, 26, 10, 0, 0, Math.PI * 2);
          c.fill();

          // 2. Contact shadow directly under tripod feet
          c.fillStyle = 'rgba(0, 0, 0, 0.7)';
          c.beginPath();
          c.ellipse(ship.x, ship.y - 1, 30, 8, 0, 0, Math.PI * 2);
          c.fill();

          const drawX = Math.round(ship.x - 32);
          const drawY = Math.round(ship.y - 58);
          const isRepaired = isShipRepairedRef.current;
          const parts = collectedPartIdsRef.current;

          // 3. Spacecraft sprite (repaired vs broken)
          if (isRepaired) {
            atlas.drawSprite(c, 'ship_repaired', drawX, drawY, 64, 64);

            // Active engine hum plasma plumes
            const plumeH = 8 + Math.sin(time * 0.015) * 3;
            c.fillStyle = 'rgba(56, 189, 248, 0.9)';
            c.beginPath();
            c.moveTo(drawX + 18, drawY + 56);
            c.lineTo(drawX + 24, drawY + 56);
            c.lineTo(drawX + 21, drawY + 56 + plumeH);
            c.closePath();
            c.fill();

            c.beginPath();
            c.moveTo(drawX + 40, drawY + 56);
            c.lineTo(drawX + 46, drawY + 56);
            c.lineTo(drawX + 43, drawY + 56 + plumeH);
            c.closePath();
            c.fill();

            // Energy shield aura
            const shieldAlpha = 0.25 + Math.sin(time * 0.005) * 0.15;
            c.strokeStyle = `rgba(56, 189, 248, ${shieldAlpha})`;
            c.lineWidth = 1.5;
            c.beginPath();
            c.ellipse(ship.x, ship.y - 26, 36, 26, 0, 0, Math.PI * 2);
            c.stroke();
          } else {
            atlas.drawSprite(c, 'ship_broken', drawX, drawY, 64, 64);

            // Thruster smoke & spark
            const smokeAlpha = 0.35 + Math.sin(time * 0.004) * 0.2;
            c.fillStyle = `rgba(249, 115, 22, ${smokeAlpha})`;
            c.beginPath();
            c.arc(drawX + 46, drawY + 36 + Math.sin(time * 0.006) * 3, 4, 0, Math.PI * 2);
            c.fill();

            // Render visible mounted parts on the ship
            const partOffsets: Record<string, { x: number; y: number }> = {
              part_solar_cell: { x: drawX + 46, y: drawY + 12 },
              part_antenna: { x: drawX + 27, y: drawY - 2 },
              part_battery_pack: { x: drawX + 6, y: drawY + 36 },
              part_drive_motor: { x: drawX + 42, y: drawY + 38 },
              part_gyroscope: { x: drawX + 27, y: drawY + 10 },
              part_thermal_core: { x: drawX + 8, y: drawY + 16 },
              part_drill_bit: { x: drawX + 44, y: drawY + 24 },
              part_camera: { x: drawX + 16, y: drawY + 4 },
            };

            for (let pIdx = 0; pIdx < parts.length; pIdx++) {
              const pid = parts[pIdx];
              const offset = partOffsets[pid];
              if (offset) {
                const defPart = SHIP_PARTS[pid];
                if (defPart) {
                  atlas.drawSprite(c, defPart.iconKey, offset.x, offset.y, 10, 10);
                }
              }
            }

            // If all 8 parts are gathered, show pulsing ready ring
            if (parts.length >= 8) {
              const ringPulse = (Math.sin(time * 0.008) + 1) * 0.5;
              c.strokeStyle = `rgba(34, 197, 94, ${0.4 + ringPulse * 0.5})`;
              c.lineWidth = 1.5;
              c.beginPath();
              c.arc(ship.x, ship.y - 24, 30 + ringPulse * 2, 0, Math.PI * 2);
              c.stroke();
            }
          }

          // 4. Landmark Proximity Tag & [E] Key Prompt
          const distToPlayer = Math.hypot(player.x - ship.x, player.y - ship.y);
          if (distToPlayer < 75) {
            const tagY = drawY - 14;
            const isReadyToRepair = parts.length >= 8 && !isRepaired;

            c.fillStyle = 'rgba(2, 6, 23, 0.92)';
            c.strokeStyle = isRepaired ? '#38bdf8' : isReadyToRepair ? '#22c55e' : '#f97316';
            c.lineWidth = 1;
            c.font = 'bold 8px monospace';
            c.textAlign = 'center';

            const label = isRepaired
              ? 'READY FOR LAUNCH! [E]'
              : isReadyToRepair
              ? 'READY TO REPAIR! [E]'
              : `CRASHED ESCAPE MODULE (${parts.length}/8 PARTS)`;

            const boxW = c.measureText(label).width + 16;
            c.fillRect(ship.x - boxW / 2, tagY, boxW, 14);
            c.strokeRect(ship.x - boxW / 2, tagY, boxW, 14);

            c.fillStyle = isRepaired ? '#38bdf8' : isReadyToRepair ? '#4ade80' : '#fdba74';
            c.fillText(label, ship.x, tagY + 10);

            // Keycap prompt
            atlas.drawSprite(c, 'key_e', ship.x - 6, tagY - 15, 12, 12);
          }
        },
      });

      // Add Placed Equipment Wrecks
      for (let i = 0; i < equipmentList.length; i++) {
        const eq = equipmentList[i];
        if (eq.worldX >= minWorldX && eq.worldX <= maxWorldX && eq.worldY >= minWorldY && eq.worldY <= maxWorldY) {
          const isCompleted = completedRef.current.includes(eq.def.id);
          const spriteKey = isCompleted ? eq.def.strippedSpriteKey : eq.def.spriteKey;

          renderList.push({
            type: 'equipment',
            sortY: eq.worldY,
            render: (c) => {
              const def = eq.def;
              const w = 36;
              const h = 36;
              const drawX = Math.round(eq.worldX - w / 2);
              const drawY = Math.round(eq.worldY - h);

              // 1. Ground Debris & Scorch Details (anchoring wreck to terrain)
              if (eq.debris) {
                for (const d of eq.debris) {
                  atlas.drawSprite(c, d.spriteKey, Math.round(eq.worldX + d.relX), Math.round(eq.worldY + d.relY), 16, 16);
                }
              }

              // 2. Blast scorch crater under wreck
              c.fillStyle = 'rgba(28, 8, 4, 0.55)';
              c.beginPath();
              c.ellipse(eq.worldX, eq.worldY - 3, 18, 7, 0, 0, Math.PI * 2);
              c.fill();

              // 3. Contact Shadow directly under base
              c.fillStyle = 'rgba(0, 0, 0, 0.65)';
              c.beginPath();
              c.ellipse(eq.worldX, eq.worldY - 1, 15, 4.5, 0, 0, Math.PI * 2);
              c.fill();

              // 4. Equipment Sprite (bottom at eq.worldY)
              atlas.drawSprite(c, spriteKey, drawX, drawY, w, h);

              // 5. Active vs Salvaged States
              if (!isCompleted) {
                // Active beacon glint on antenna/chassis
                const pulse = (Math.sin(time * 0.007 + i) + 1) * 0.5;
                const glintX = drawX + w - 8;
                const glintY = drawY + 6;
                c.fillStyle = `rgba(56, 189, 248, ${0.4 + pulse * 0.6})`;
                c.beginPath();
                c.arc(glintX, glintY, 2 + pulse * 1.5, 0, Math.PI * 2);
                c.fill();
              } else {
                // Completed/Salvaged: subtle smoke wisp
                const smokeAlpha = 0.2 + Math.sin(time * 0.005 + i) * 0.15;
                c.fillStyle = `rgba(148, 163, 184, ${smokeAlpha})`;
                c.beginPath();
                c.arc(drawX + 10, drawY + 8 + Math.sin(time * 0.004) * 2, 2.5, 0, Math.PI * 2);
                c.fill();
              }

              // 6. In-World [E] Prompt & Nametag when Player is nearby
              const isNearby = nearestActive?.def.id === def.id;
              if (isNearby) {
                const tagY = drawY - 14;

                c.fillStyle = 'rgba(2, 6, 23, 0.9)';
                c.strokeStyle = isCompleted ? '#64748b' : '#06b6d4';
                c.lineWidth = 1;
                c.font = '8px monospace';
                c.textAlign = 'center';
                const labelText = isCompleted ? `${def.name} [SALVAGED]` : def.name;
                const textWidth = c.measureText(labelText).width;
                const boxW = textWidth + 14;
                const boxH = 14;

                c.fillRect(eq.worldX - boxW / 2, tagY, boxW, boxH);
                c.strokeRect(eq.worldX - boxW / 2, tagY, boxW, boxH);

                c.fillStyle = isCompleted ? '#94a3b8' : '#38bdf8';
                c.fillText(labelText, eq.worldX, tagY + 10);

                if (!isCompleted) {
                  // Small [E] keycap prompt
                  atlas.drawSprite(c, 'key_e', eq.worldX - 6, tagY - 15, 12, 12);
                }
              }
            },
          });
        }
      }

      // Add Nova Companion
      renderList.push({
        type: 'nova',
        sortY: nova.y,
        render: (c) => {
          const frameIdx = nova.isMoving ? Math.floor(nova.walkFrame) % 4 : 0;
          let spriteKey = `nova_walk_${nova.facing}_${frameIdx}`;
          if (!nova.isMoving) {
            spriteKey = `nova_idle_${nova.facing}`;
          }
          debugSpritesRef.current.novaSprite = spriteKey;

          c.fillStyle = 'rgba(0, 0, 0, 0.3)';
          c.beginPath();
          c.ellipse(Math.round(nova.x), Math.round(nova.y), 7, 3, 0, 0, Math.PI * 2);
          c.fill();

          const drawX = Math.round(nova.x - 9);
          const drawY = Math.round(nova.y - 15);
          atlas.drawSprite(c, spriteKey, drawX, drawY, 18, 16);
        },
      });

      // Add Astronaut Player
      renderList.push({
        type: 'player',
        sortY: player.y,
        render: (c) => {
          const frameIdx = player.isMoving ? Math.floor(player.walkFrame) % 4 : 0;
          let spriteKey = `player_walk_${player.facing}_${frameIdx}`;
          if (!player.isMoving) {
            spriteKey = `player_idle_${player.facing}`;
          }
          debugSpritesRef.current.playerSprite = spriteKey;

          c.fillStyle = 'rgba(0, 0, 0, 0.35)';
          c.beginPath();
          c.ellipse(Math.round(player.x), Math.round(player.y), 8, 3.5, 0, 0, Math.PI * 2);
          c.fill();

          const drawX = Math.round(player.x - 10);
          const drawY = Math.round(player.y - 27);
          atlas.drawSprite(c, spriteKey, drawX, drawY, 20, 28);
        },
      });

      // Sort by depth Y and render
      renderList.sort((a, b) => a.sortY - b.sortY);
      for (let i = 0; i < renderList.length; i++) {
        renderList[i].render(ctx);
      }

      // Pass 2b: World Particles (Sparks, Thruster Plasma, Hearts)
      for (let pIdx = 0; pIdx < particlesRef.current.length; pIdx++) {
        const p = particlesRef.current[pIdx];
        if (p.x >= minWorldX && p.x <= maxWorldX && p.y >= minWorldY && p.y <= maxWorldY) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          if (p.shape === 'heart') {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = p.color;
            ctx.fillText('❤️', p.x - 5, p.y);
          } else if (p.shape === 'spark') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      ctx.restore();

      // ==========================================
      // PASS 3: DYNAMIC MARTIAN SOL DAY/NIGHT & LIGHTING OVERLAY
      // ==========================================
      const sol = solTimeRef.current;
      let darkness = 0;
      let ambR = 6;
      let ambG = 8;
      let ambB = 20;

      if (sol >= 0.22 && sol <= 0.65) {
        darkness = 0; // Clear daylight
      } else if (sol > 0.65 && sol <= 0.78) {
        // Dusk transition
        const t = (sol - 0.65) / 0.13;
        darkness = t * 0.76;
        ambR = Math.round(28 * (1 - t) + 4 * t);
        ambG = Math.round(12 * (1 - t) + 6 * t);
        ambB = Math.round(24 * (1 - t) + 24 * t);
      } else if (sol > 0.78 && sol <= 0.95) {
        // Deep Night
        darkness = 0.8;
        ambR = 4;
        ambG = 6;
        ambB = 22;
      } else {
        // Dawn transition
        const t = sol > 0.95 ? (sol - 0.95) / 0.27 : (sol + 0.05) / 0.27;
        darkness = (1 - t) * 0.76;
        ambR = Math.round(32 * t + 6 * (1 - t));
        ambG = Math.round(18 * t + 8 * (1 - t));
        ambB = Math.round(8 * t + 22 * (1 - t));
      }

      if (darkness > 0.04) {
        if (!lightCanvasRef.current) {
          lightCanvasRef.current = document.createElement('canvas');
        }
        const lc = lightCanvasRef.current;
        if (lc.width !== canvas.width || lc.height !== canvas.height) {
          lc.width = canvas.width;
          lc.height = canvas.height;
        }
        const lCtx = lc.getContext('2d');
        if (lCtx) {
          lCtx.clearRect(0, 0, lc.width, lc.height);
          lCtx.fillStyle = `rgba(${ambR}, ${ambG}, ${ambB}, ${darkness})`;
          lCtx.fillRect(0, 0, lc.width, lc.height);

          lCtx.globalCompositeOperation = 'destination-out';

          // 1. Cut out player flashlight cone
          const playerScreenX = viewCenterW + (player.x - camRenderX) * CAMERA_SCALE;
          const playerScreenY = viewCenterH + (player.y - 14 - camRenderY) * CAMERA_SCALE;
          const coneRadius = 150 * (CAMERA_SCALE / 3);
          let coneAngle = Math.PI / 2; // down
          if (player.facing === 'up') coneAngle = -Math.PI / 2;
          else if (player.facing === 'left') coneAngle = Math.PI;
          else if (player.facing === 'right') coneAngle = 0;

          const pGrad = lCtx.createRadialGradient(playerScreenX, playerScreenY, 6, playerScreenX, playerScreenY, coneRadius);
          pGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
          pGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          lCtx.fillStyle = pGrad;
          lCtx.beginPath();
          lCtx.moveTo(playerScreenX, playerScreenY);
          lCtx.arc(playerScreenX, playerScreenY, coneRadius, coneAngle - 0.58, coneAngle + 0.58);
          lCtx.closePath();
          lCtx.fill();

          // Ambient halo around player body
          const bodyGrad = lCtx.createRadialGradient(playerScreenX, playerScreenY, 2, playerScreenX, playerScreenY, 46);
          bodyGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
          bodyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          lCtx.fillStyle = bodyGrad;
          lCtx.beginPath();
          lCtx.arc(playerScreenX, playerScreenY, 46, 0, Math.PI * 2);
          lCtx.fill();

          // 2. Cut out NOVA eye spotlight
          const novaScreenX = viewCenterW + (nova.x - camRenderX) * CAMERA_SCALE;
          const novaScreenY = viewCenterH + (nova.y - 8 - camRenderY) * CAMERA_SCALE;
          const novaGrad = lCtx.createRadialGradient(novaScreenX, novaScreenY, 4, novaScreenX, novaScreenY, 70);
          novaGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
          novaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          lCtx.fillStyle = novaGrad;
          lCtx.beginPath();
          lCtx.arc(novaScreenX, novaScreenY, 70, 0, Math.PI * 2);
          lCtx.fill();

          // 3. Cut out Ship beacon & floodlights
          const shipScreenX = viewCenterW + (ship.x - camRenderX) * CAMERA_SCALE;
          const shipScreenY = viewCenterH + (ship.y - 20 - camRenderY) * CAMERA_SCALE;
          const shipGrad = lCtx.createRadialGradient(shipScreenX, shipScreenY, 15, shipScreenX, shipScreenY, 125);
          shipGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
          shipGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)');
          shipGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          lCtx.fillStyle = shipGrad;
          lCtx.beginPath();
          lCtx.arc(shipScreenX, shipScreenY, 125, 0, Math.PI * 2);
          lCtx.fill();

          // 4. Cut out visible equipment beacon halos
          for (let i = 0; i < equipmentList.length; i++) {
            const eq = equipmentList[i];
            const eqScreenX = viewCenterW + (eq.worldX - camRenderX) * CAMERA_SCALE;
            const eqScreenY = viewCenterH + (eq.worldY - 18 - camRenderY) * CAMERA_SCALE;
            if (eqScreenX >= -70 && eqScreenX <= canvas.width + 70 && eqScreenY >= -70 && eqScreenY <= canvas.height + 70) {
              const eqGrad = lCtx.createRadialGradient(eqScreenX, eqScreenY, 6, eqScreenX, eqScreenY, 70);
              eqGrad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
              eqGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              lCtx.fillStyle = eqGrad;
              lCtx.beginPath();
              lCtx.arc(eqScreenX, eqScreenY, 70, 0, Math.PI * 2);
              lCtx.fill();
            }
          }

          // 5. Cut out visible science sample sparkles
          const samples = samplesListRef.current;
          for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            if (collectedSamplesRef.current.includes(s.id)) continue;
            const sScreenX = viewCenterW + (s.worldX - camRenderX) * CAMERA_SCALE;
            const sScreenY = viewCenterH + (s.worldY - 8 - camRenderY) * CAMERA_SCALE;
            if (sScreenX >= -40 && sScreenX <= canvas.width + 40 && sScreenY >= -40 && sScreenY <= canvas.height + 40) {
              const sGrad = lCtx.createRadialGradient(sScreenX, sScreenY, 4, sScreenX, sScreenY, 40);
              sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
              sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              lCtx.fillStyle = sGrad;
              lCtx.beginPath();
              lCtx.arc(sScreenX, sScreenY, 40, 0, Math.PI * 2);
              lCtx.fill();
            }
          }

          ctx.drawImage(lc, 0, 0);
        }
      }

      // ==========================================
      // PASS 3b: SONAR RADAR EXPANDING WAVE
      // ==========================================
      if (sonarWaveRef.current && sonarWaveRef.current.active) {
        const sw = sonarWaveRef.current;
        const swScreenX = viewCenterW + (sw.x - camRenderX) * CAMERA_SCALE;
        const swScreenY = viewCenterH + (sw.y - camRenderY) * CAMERA_SCALE;
        const progress = sw.radius / sw.maxRadius;
        const waveAlpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.strokeStyle = `rgba(34, 211, 238, ${waveAlpha * 0.85})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(swScreenX, swScreenY, sw.radius * CAMERA_SCALE, 0, Math.PI * 2);
        ctx.stroke();

        if (sw.radius > 35) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${waveAlpha * 0.45})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(swScreenX, swScreenY, (sw.radius - 25) * CAMERA_SCALE, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ==========================================
      // PASS 4: HOLOGRAPHIC DIRECTIONAL COMPASS VECTORS
      // ==========================================
      if (compassTimerRef.current > 0) {
        const uncompleted = equipmentList.filter((e) => !completedRef.current.includes(e.def.id));
        const margin = 55;

        interface EdgePointerItem {
          borderX: number;
          borderY: number;
          angle: number;
          distTiles: number;
          labelText?: string;
          labelW?: number;
          labelH?: number;
          labelX?: number;
          labelY?: number;
        }

        const offscreenPointers: EdgePointerItem[] = [];
        ctx.font = 'bold 9px monospace';

        for (let i = 0; i < uncompleted.length; i++) {
          const eq = uncompleted[i];
          const dx = (eq.worldX - camRenderX) * CAMERA_SCALE;
          const dy = (eq.worldY - camRenderY) * CAMERA_SCALE;
          const distTiles = Math.round(Math.hypot(player.x - eq.worldX, player.y - eq.worldY) / 16);

          const screenTargetX = viewCenterW + dx;
          const screenTargetY = viewCenterH + dy;
          const isOffscreen = screenTargetX < margin || screenTargetX > canvas.width - margin || screenTargetY < margin || screenTargetY > canvas.height - margin;

          if (isOffscreen) {
            const angle = Math.atan2(dy, dx);
            const borderX = Math.max(margin, Math.min(canvas.width - margin, viewCenterW + Math.cos(angle) * (viewCenterW - margin)));
            const borderY = Math.max(margin, Math.min(canvas.height - margin, viewCenterH + Math.sin(angle) * (viewCenterH - margin)));

            const item: EdgePointerItem = {
              borderX,
              borderY,
              angle,
              distTiles,
            };

            // Requirement A.5: Drop label text for pointers farther than 150m (arrow only)
            if (distTiles <= 150) {
              const shortName = eq.def.name.split('(')[0].trim();
              const labelText = `${shortName} [${distTiles}m]`;
              const textMetrics = ctx.measureText(labelText);
              const labelW = textMetrics.width;
              const labelH = 12;

              // Clamp inside screen bounds with inward offset away from border arrow (Requirement C)
              const inwardDist = 20;
              const inwardX = borderX - Math.cos(angle) * inwardDist;
              const inwardY = borderY - Math.sin(angle) * inwardDist;
              const clampedX = Math.max(labelW / 2 + 10, Math.min(canvas.width - labelW / 2 - 10, inwardX));
              const clampedY = Math.max(22, Math.min(canvas.height - 16, inwardY));

              item.labelText = labelText;
              item.labelW = labelW;
              item.labelH = labelH;
              item.labelX = clampedX;
              item.labelY = clampedY;
            }

            offscreenPointers.push(item);
          } else {
            // Target is on-screen: draw glowing bracket around it
            ctx.save();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.5;
            const bPulse = (Math.sin(time * 0.01) + 1) * 3;
            ctx.strokeRect(screenTargetX - 22 - bPulse, screenTargetY - 26 - bPulse, 44 + bPulse * 2, 44 + bPulse * 2);
            ctx.restore();
          }
        }

        // Requirement A.5: De-overlap labels (nudge or stack with a 2px gap)
        const labeledItems = offscreenPointers.filter((p) => p.labelText && p.labelX !== undefined && p.labelY !== undefined);
        for (let pass = 0; pass < 3; pass++) {
          for (let a = 0; a < labeledItems.length; a++) {
            for (let b = a + 1; b < labeledItems.length; b++) {
              const pA = labeledItems[a];
              const pB = labeledItems[b];
              const overlapX = Math.abs(pA.labelX! - pB.labelX!) < (pA.labelW! + pB.labelW!) / 2 + 6;
              const overlapY = Math.abs(pA.labelY! - pB.labelY!) < (pA.labelH! + pB.labelH!) / 2 + 2;

              if (overlapX && overlapY) {
                const reqSeparation = (pA.labelH! + pB.labelH!) / 2 + 2;
                if (pA.labelY! <= pB.labelY!) {
                  pA.labelY = Math.max(20, pA.labelY! - reqSeparation / 2);
                  pB.labelY = Math.min(canvas.height - 12, pB.labelY! + reqSeparation / 2);
                } else {
                  pB.labelY = Math.max(20, pB.labelY! - reqSeparation / 2);
                  pA.labelY = Math.min(canvas.height - 12, pA.labelY! + reqSeparation / 2);
                }
              }
            }
          }
        }

        lastCompassPointersRef.current = labeledItems.map((item) => ({
          labelText: item.labelText,
          x: item.labelX,
          y: item.labelY,
          w: item.labelW,
          h: item.labelH,
          distTiles: item.distTiles,
        }));

        // Requirement C: Render arrows in Pass 1, then all label text in Pass 2 ABOVE arrows so no arrow overlaps text
        for (const p of offscreenPointers) {
          ctx.save();
          ctx.translate(p.borderX, p.borderY);
          ctx.rotate(p.angle);

          // Glowing arrow pointer
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-6, -7);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Pass 2: Labels drawn strictly above all arrow geometry
        for (const p of labeledItems) {
          if (p.labelText && p.labelX !== undefined && p.labelY !== undefined && p.labelW !== undefined) {
            ctx.save();
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.lineWidth = 1;
            const bgW = p.labelW + 8;
            const bgH = 13;
            ctx.fillRect(p.labelX - bgW / 2, p.labelY - 9, bgW, bgH);
            ctx.strokeRect(p.labelX - bgW / 2, p.labelY - 9, bgW, bgH);
            ctx.fillStyle = '#22d3ee';
            ctx.fillText(p.labelText, p.labelX, p.labelY + 1);
            ctx.restore();
          }
        }
      }

      // Reveal fog of war around player (expanded by Minimap Reveal upgrade if owned)
      const minimapLvl = typeof upgradesRef.current.minimap === 'number' ? upgradesRef.current.minimap : (upgradesRef.current.minimap ? 1 : 0);
      const currentReveal = minimapLvl === 2 ? 26 : minimapLvl === 1 ? 22 : REVEAL_RADIUS_TILES;
      fogRef.current.revealArea(currentTileX, currentTileY, currentReveal);

      // Render Sonar Sample Glints on world canvas during sampleGlintTimer (~6s)
      if (sampleGlintTimerRef.current > 0) {
        const samples = samplesListRef.current;
        const scanLvl = typeof upgradesRef.current.scan === 'number' ? upgradesRef.current.scan : (upgradesRef.current.scan ? 1 : 0);
        const currentScanRadius = scanLvl === 2 ? 420 : scanLvl === 1 ? 350 : 280;
        for (let i = 0; i < samples.length; i++) {
          const s = samples[i];
          if (collectedSamplesRef.current.includes(s.id)) continue;
          const distToPlayer = Math.hypot(player.x - s.worldX, player.y - s.worldY);
          if (distToPlayer <= currentScanRadius) {
            const sx = viewCenterW + (s.worldX - camRenderX) * CAMERA_SCALE;
            const sy = viewCenterH + (s.worldY - 8 - camRenderY) * CAMERA_SCALE;
            const shimmer = (Math.sin(time * 0.015 + i * 2) + 1) * 0.5;

            ctx.save();
            const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 22 * (CAMERA_SCALE / 3));
            grad.addColorStop(0, `rgba(34, 211, 238, ${0.9 * shimmer})`);
            grad.addColorStop(0.5, `rgba(56, 189, 248, ${0.4 * shimmer})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, 22 * (CAMERA_SCALE / 3), 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            const arm = (8 + shimmer * 4) * (CAMERA_SCALE / 3);
            ctx.beginPath();
            ctx.moveTo(sx - arm, sy); ctx.lineTo(sx + arm, sy);
            ctx.moveTo(sx, sy - arm); ctx.lineTo(sx, sy + arm);
            ctx.stroke();

            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#22d3ee';
            ctx.textAlign = 'center';
            ctx.fillText(`★ ${s.def.category.toUpperCase()}`, sx, sy - 14);
            ctx.restore();
          }
        }
      }

      // Render HUD Circular Minimap (bottom-right)
      if (minimapCanvasRef.current) {
        const mCtx = minimapCanvasRef.current.getContext('2d');
        if (mCtx) {
          minimapRendererRef.current.renderHudMinimap(
            mCtx,
            world,
            fogRef.current,
            player.x,
            player.y,
            player.facing,
            ship.x,
            ship.y,
            equipmentList,
            completedRef.current,
            time,
            samplesListRef.current,
            collectedSamplesRef.current,
            sampleGlintTimerRef.current > 0,
            landmarksListRef.current,
            discoveredLandmarksRef.current
          );
        }
      }

      // Render Enlarged Full Map Overlay if open
      if (isMapOpenRef.current && overlayCanvasRef.current) {
        const oCtx = overlayCanvasRef.current.getContext('2d');
        if (oCtx) {
          minimapRendererRef.current.renderOverlayMap(
            oCtx,
            world,
            fogRef.current,
            player.x,
            player.y,
            player.facing,
            ship.x,
            ship.y,
            equipmentList,
            completedRef.current,
            time,
            samplesListRef.current,
            collectedSamplesRef.current,
            sampleGlintTimerRef.current > 0,
            landmarksListRef.current,
            discoveredLandmarksRef.current
          );
        }
      }

      // Update Nova speech bubble position smoothly
      if (novaBubbleElementRef.current) {
        const nx = viewCenterW + (nova.x - camRenderX) * CAMERA_SCALE;
        const ny = viewCenterH + (nova.y - 18 - camRenderY) * CAMERA_SCALE;
        novaBubbleElementRef.current.style.transform = `translate3d(${Math.round(nx)}px, ${Math.round(ny)}px, 0)`;
      }

      // Update Debug Info if visible
      if (showDebug) {
        setDebugInfo({
          fps: currentFps,
          seed: config.seed,
          tileX: currentTileX,
          tileY: currentTileY,
          biome: biomeType,
          chunksLoaded: (maxCx - minCx + 1) * (maxCy - minCy + 1),
          playerFacing: player.facing,
          playerSprite: debugSpritesRef.current.playerSprite,
          novaFacing: nova.facing,
          novaSprite: debugSpritesRef.current.novaSprite,
          heldKeysList: Array.from(heldKeysRef.current).join(', ') || 'none',
          exploredTiles: fogRef.current.getExploredTilesCount(),
          exploredChunks: fogRef.current.getExploredChunksCount(),
          viewRadius: MINIMAP_VIEW_RADIUS,
          revealRadius: REVEAL_RADIUS_TILES,
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      sound.stopBiomeWind();
    };
  }, [config.seed, showDebug, triggerEquipmentInteract, triggerShipInteract]);

  // Touch event handlers
  const handleTouchDir = useCallback((dir: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    touchStateRef.current[dir] = active;
  }, []);

  const handleTouchInteract = useCallback(() => {
    if (nearbyEquipment) {
      triggerEquipmentInteract(nearbyEquipment);
    } else if (isNearShip) {
      triggerShipInteract();
    } else if (nearbySample) {
      triggerSampleCollect(nearbySample);
    }
  }, [nearbyEquipment, isNearShip, nearbySample, triggerEquipmentInteract, triggerShipInteract, triggerSampleCollect]);

  return (
    <div data-testid="world-scene" className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col items-center justify-center font-sans">
      
      {/* Top HUD Strip */}
      {!isLaunching && !showEnding && (
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          
          {/* Left: Menu & Chapter info */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 pointer-events-auto shadow-lg">
            <button
              onClick={onExitToMenu}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-mono"
              title="Main Menu"
            >
              ← Menu
            </button>
            <div className="text-xs font-mono hidden md:block">
              <span className="text-orange-400 font-bold">CHAPTER 4: MARS EXPLORATION</span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-cyan-300">Open-World Salvage</span>
            </div>

            {/* Sol Day/Night Cycle Clock */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-mono">
              {solTimeDisplay.isNight ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              )}
              <span className="text-slate-200 font-bold">SOL {solTimeDisplay.sol}</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300 font-bold">{solTimeDisplay.timeStr}</span>
            </div>

            {/* Field Science Samples Counter */}
            <div
              data-testid="samples-counter"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-mono text-cyan-300"
            >
              <Microscope className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Samples:</span>
              <span className="text-white font-bold">{collectedSampleIds.length}</span>
              <span className="text-slate-500">/{samplesListRef.current.length || 18}</span>
            </div>

            {/* Research Points Counter */}
            <div
              data-testid="research-points-display"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold"
            >
              <span className="text-amber-400">RP:</span>
              <span className="text-white">{researchPoints}</span>
            </div>
          </div>

          {/* Center: Parts HUD */}
          <div className="hidden sm:block pointer-events-auto">
            <PartsHUD collectedPartIds={collectedPartIds} />
          </div>

          {/* Right: Audio & Codex */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              data-testid="codex-btn"
              onClick={() => {
                sound.playClick();
                setShowCodex(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 hover:border-cyan-500/50 text-xs font-mono text-cyan-300 cursor-pointer"
            >
              Codex
            </button>
            {onToggleSound && (
              <button
                onClick={onToggleSound}
                className="p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 cursor-pointer text-xs font-mono"
              >
                {isMuted ? 'Muted' : 'Sound On'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Parts Counter (Below top bar) */}
      {!isLaunching && !showEnding && (
        <div className="sm:hidden absolute top-18 left-4 pointer-events-auto z-20 flex items-center gap-2">
          <PartsHUD collectedPartIds={collectedPartIds} />
          <div
            data-testid="mobile-samples-counter"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-800 text-[10px] font-mono text-cyan-300"
          >
            <Microscope className="w-3 h-3 text-cyan-400" />
            <span>{collectedSampleIds.length}/{samplesListRef.current.length || 18}</span>
          </div>
        </div>
      )}

      {/* Memory Log Recovered Toast Notification */}
      {logToast && (
        <div
          data-testid="log-toast"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-cyan-400 text-slate-100 shadow-[0_0_35px_rgba(6,182,212,0.5)] flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 max-w-md pointer-events-none select-none"
        >
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shrink-0">
            <Radio className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span data-testid="log-toast-title" className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                LOG {logToast.number}/8 recovered
              </span>
              <span data-testid="fiction-tag" className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                FICTION
              </span>
            </div>
            <div data-testid="log-toast-reaction" className="text-[11px] text-cyan-200 font-mono italic mt-0.5 leading-snug">
              Nova: "{logToast.reaction}"
            </div>
          </div>
        </div>
      )}

      {/* Part Pickup Toast Notification */}
      {partToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-950/95 border border-cyan-400 text-slate-100 shadow-[0_0_40px_rgba(6,182,212,0.6)] flex items-center gap-3.5 animate-in fade-in zoom-in-90 duration-200">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
              SHIP PART SALVAGED · CODEX UPDATED (+1)
            </div>
            <div className="text-sm font-bold text-white">
              {partToast.partName}
            </div>
          </div>
        </div>
      )}

      {/* Science Sample Pickup Toast Notification */}
      {sampleToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-950/95 border border-emerald-400 text-slate-100 shadow-[0_0_40px_rgba(16,185,129,0.5)] flex items-center gap-3.5 animate-in fade-in zoom-in-90 duration-200">
          <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
            <Microscope className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">
              MARTIAN FIELD SPECIMEN ANALYZED (+1)
            </div>
            <div className="text-sm font-bold text-white">
              {sampleToast.name}
            </div>
          </div>
        </div>
      )}

      {/* Natural Landmark Discovered Toast Notification (Lower center above control hint bar) */}
      {landmarkToast && (
        <div
          data-testid="landmark-toast"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-indigo-400 text-slate-100 shadow-[0_0_35px_rgba(99,102,241,0.45)] flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 max-w-md pointer-events-none select-none"
        >
          <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 shrink-0">
            <Compass className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div data-testid="landmark-toast-name" className="text-sm font-bold text-white leading-tight">
              {landmarkToast.name}
            </div>
            <div data-testid="landmark-toast-fact" className="text-[11px] text-slate-300 font-mono mt-0.5 leading-snug">
              {landmarkToast.fact}
            </div>
          </div>
        </div>
      )}

      {/* Main Game Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="world-canvas"
        className="w-full h-full object-cover cursor-default block"
      />

      {/* NOVA Floating Speech Bubble (Non-Modal, No movement block) */}
      {novaBubble && (
        <div
          ref={novaBubbleElementRef}
          data-testid="nova-speech-bubble"
          className="absolute top-0 left-0 z-30 pointer-events-none -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-xl bg-slate-900/95 border border-cyan-400 text-cyan-200 text-xs font-mono shadow-[0_0_20px_rgba(6,182,212,0.45)] flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          style={{ willChange: 'transform' }}
        >
          <span className="font-bold text-cyan-300">🐱 NOVA:</span>
          <span data-testid="nova-bubble-text">{novaBubble.text}</span>
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-900 border-r border-b border-cyan-400 rotate-45" />
        </div>
      )}

      {/* NOVA One-Line Dialogue Overlay */}
      {novaDialogue && (
        <div className="absolute bottom-20 left-4 right-4 max-w-xl mx-auto z-40">
          <NovaDialogue
            text={novaDialogue.text}
            mood="curious"
            actionLabel={novaDialogue.actionLabel}
            onAction={novaDialogue.onAction}
            onDismiss={() => setNovaDialogue(null)}
          />
        </div>
      )}

      {/* MINI-GAMES MODAL CONTAINER */}
      {activeMiniGame?.type === 'sojourner' && (
        <SojournerRoverPuzzle
          onSuccess={handleMiniGameSuccess}
          onClose={handleMiniGameClose}
        />
      )}

      {activeMiniGame?.type === 'opportunity' && (
        <OpportunityWaterPuzzle
          onSuccess={handleMiniGameSuccess}
          onClose={handleMiniGameClose}
        />
      )}

      {activeMiniGame?.type === 'insight' && (
        <InSightSeismicPuzzle
          onSuccess={handleMiniGameSuccess}
          onClose={handleMiniGameClose}
        />
      )}

      {activeMiniGame?.type === 'quiz' && activeMiniGame.def.miniGameParams?.quiz && (
        <FieldQuizModal
          title={activeMiniGame.def.name}
          quiz={activeMiniGame.def.miniGameParams.quiz}
          onSuccess={handleMiniGameSuccess}
          onClose={handleMiniGameClose}
        />
      )}

      {/* F3 Debug Overlay & Teleportation Panel (Only in Dev or ?debug=1) */}
      {showDebug && isDebugMode && !isLaunching && !showEnding && (
        <div data-testid="debug-panel" className="absolute top-16 left-4 z-40 p-4 rounded-xl bg-black/90 backdrop-blur-md border border-cyan-500/40 text-[11px] font-mono text-cyan-300 space-y-2 pointer-events-auto shadow-2xl max-w-sm max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1">
            <span className="font-bold text-white">WORLD DEBUG (F3)</span>
            <span className="text-[10px] text-slate-400">T: Teleport · F4: Atlas</span>
          </div>

          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>FPS: <span className="text-emerald-400 font-bold">{debugInfo.fps}</span></div>
            <div>Seed: <span className="text-slate-200">{debugInfo.seed}</span></div>
            <div>Tile: <span className="text-slate-200">({debugInfo.tileX}, {debugInfo.tileY})</span></div>
            <div>Biome: <span className="text-amber-300 uppercase">{debugInfo.biome}</span></div>
            <div>Player: <span className="text-amber-400 font-bold uppercase">{debugInfo.playerFacing}</span></div>
            <div>Nova: <span className="text-cyan-300 font-bold uppercase">{debugInfo.novaFacing}</span></div>
            <div>Parts: <span className="text-cyan-300">{completedEquipmentIds.length}/8</span></div>
            <div>Chunks: <span className="text-slate-200">{debugInfo.chunksLoaded}</span></div>
            <div>Explored: <span className="text-emerald-400 font-bold">{debugInfo.exploredTiles}</span> t</div>
            <div>Radar: <span className="text-cyan-300">{debugInfo.viewRadius}t</span> (rev {debugInfo.revealRadius}t)</div>
            <div className="col-span-2 text-[9px] text-slate-400 truncate">
              Spr: <span className="text-slate-200">{debugInfo.playerSprite}</span>
            </div>
            <div className="col-span-2 text-[9px] text-slate-400 truncate">
              Keys: <span className="text-emerald-400 font-bold">{debugInfo.heldKeysList}</span>
            </div>
          </div>

          {/* Action Buttons: Teleport & Tile Debugger */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              data-testid="tp-ship-btn"
              onClick={teleportToShip}
              className="py-1 px-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/50 text-indigo-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              🚀 TP Ship
            </button>
            <button
              data-testid="tp-wreck-btn"
              onClick={teleportToNearestUncompleted}
              className="py-1 px-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/50 text-cyan-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              ⚡ TP Wreck
            </button>
            <button
              data-testid="tp-sample-btn"
              onClick={teleportToNearestSample}
              className="py-1 px-1 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-purple-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              💎 TP Sample
            </button>
            <button
              onClick={() => setShowTileDebug(true)}
              className="py-1 px-1 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/50 text-amber-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              🔍 Atlas
            </button>
          </div>

          {/* Save / Load / Reset / Grant Parts Debug Buttons */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800">
            <button
              onClick={handleManualSave}
              className="py-1 px-1.5 rounded bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-500/50 text-emerald-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              💾 Save Now
            </button>
            <button
              onClick={handleManualLoad}
              className="py-1 px-1.5 rounded bg-blue-700/30 hover:bg-blue-700/50 border border-blue-500/50 text-blue-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              📂 Load Save
            </button>
            <button
              onClick={handleManualReset}
              className="py-1 px-1.5 rounded bg-rose-700/30 hover:bg-rose-700/50 border border-rose-500/50 text-rose-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              🔄 Reset Save
            </button>
            <button
              data-testid="grant-one-part-btn"
              onClick={handleGrantOnePart}
              className="py-1 px-1.5 rounded bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-400 text-cyan-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors"
            >
              ⚡ Grant 1 Part
            </button>
            <button
              data-testid="grant-parts-btn"
              onClick={handleGrantAllParts}
              className="col-span-2 py-1 px-1.5 rounded bg-amber-500/40 hover:bg-amber-500/60 border border-amber-400 text-amber-200 font-mono text-[9px] font-bold text-center cursor-pointer transition-colors shadow-[0_0_10px_rgba(245,158,11,0.3)]"
            >
              ⚡ Grant 8 Parts
            </button>
          </div>

          {/* List of Equipment Locations */}
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <div className="text-[10px] uppercase text-slate-400 font-bold">Equipment List (8 items):</div>
            {equipmentListRef.current.map((eq) => {
              const isDone = completedEquipmentIds.includes(eq.def.id);
              const player = playerRef.current;
              const dist = Math.round(Math.hypot(player.x - eq.worldX, player.y - eq.worldY) / 16);

              return (
                <div
                  key={eq.def.id}
                  data-eq-id={eq.def.id}
                  className="flex items-center justify-between p-1 rounded bg-slate-900/60 border border-slate-800/80 text-[10px]"
                >
                  <div className="truncate mr-2">
                    <span className={isDone ? 'text-slate-500 line-through' : 'text-slate-200'}>
                      {eq.def.name.split('(')[0].trim()}
                    </span>
                    <span className="text-slate-500 ml-1">({dist}t)</span>
                  </div>

                  <button
                    onClick={() => teleportToEquipment(eq.tileX, eq.tileY)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer shrink-0 ${
                      isDone
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {isDone ? 'DONE' : 'GOTO'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tile Debugger Modal */}
      {showTileDebug && (
        <TileDebugModal onClose={() => setShowTileDebug(false)} />
      )}

      {/* Circular Minimap & Enlarged Full Map Overlay */}
      {!isLaunching && !showEnding && (
        <MinimapHUD
          canvasRef={minimapCanvasRef}
          overlayCanvasRef={overlayCanvasRef}
          isOpen={isMapOpen}
          exploredCount={debugInfo.exploredTiles}
          totalChunks={debugInfo.exploredChunks}
          onToggle={() => {
            setIsMapOpen((prev) => {
              const next = !prev;
              if (next && !hasSeenMapHintRef.current) {
                hasSeenMapHintRef.current = true;
                setNovaDialogue({
                  text: 'Orange blips are signals from wrecks nearby, explorer.',
                  actionLabel: 'Understood',
                  onAction: () => setNovaDialogue(null),
                });
              }
              return next;
            });
          }}
          onClose={() => setIsMapOpen(false)}
        />
      )}

      {/* Planetary Exploration Codex Modal */}
      {showCodex && (
        <MissionArchiveModal
          completedEquipmentIds={completedEquipmentIds}
          collectedSampleIds={collectedSampleIds}
          discoveredLandmarkIds={discoveredLandmarkIds}
          recoveredLogIds={recoveredLogIds}
          researchPoints={researchPoints}
          onClose={() => setShowCodex(false)}
        />
      )}

      {/* Crashed Spaceship & Subsystems Upgrades Terminal Modal */}
      {isShipTerminalOpen && (
        <div
          data-testid="ship-terminal-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none"
        >
          <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden text-slate-100 flex flex-col">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold font-display tracking-wider text-white">
                  ASCENT VEHICLE & UPGRADES TERMINAL
                </h3>
              </div>
              <button
                data-testid="close-ship-terminal-btn"
                onClick={() => {
                  sound.playClick();
                  setIsShipTerminalOpen(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              {/* Ascent Vehicle Status */}
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Ascent Vehicle Subsystems</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {collectedPartIds.length >= 8
                      ? isShipRepaired
                        ? 'Ready for Orbital Return Flight'
                        : 'All 8 Parts Found · Ready for Calibration'
                      : `Missing ${8 - collectedPartIds.length} Parts (${collectedPartIds.length}/8 Found)`}
                  </div>
                </div>
                {collectedPartIds.length >= 8 ? (
                  isShipRepaired ? (
                    <button
                      data-testid="terminal-launch-btn"
                      onClick={() => {
                        setIsShipTerminalOpen(false);
                        setIsLaunching(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer transition-colors shadow-md"
                    >
                      Launch Ascent →
                    </button>
                  ) : (
                    <button
                      data-testid="terminal-repair-btn"
                      onClick={() => {
                        setIsShipTerminalOpen(false);
                        setIsRepairing(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer transition-colors shadow-md"
                    >
                      Calibrate & Repair →
                    </button>
                  )
                ) : (
                  <span className="text-[10px] text-amber-400 font-bold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
                    {8 - collectedPartIds.length} Wrecks Left
                  </span>
                )}
              </div>

              {/* Research Points Balance Banner */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-[10px] text-amber-300/80 uppercase font-bold">Field Research Points</div>
                    <div className="text-base font-bold text-white">
                      <span data-testid="research-points-count">{researchPoints}</span> RP
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">Earned from Science Samples & Landmarks</span>
              </div>

              {/* 3 Upgrades List (2 Levels Each) */}
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Subsystem Upgrades:</div>

                {/* Upgrade 1: Jetpack Boost */}
                {(() => {
                  const lvl = typeof upgrades.jetpack === 'number' ? upgrades.jetpack : (upgrades.jetpack ? 1 : 0);
                  const isMax = lvl >= 2;
                  const cost = isMax ? 0 : [3, 6][lvl];
                  const canAfford = !isMax && researchPoints >= cost;
                  const needed = isMax ? 0 : Math.max(0, cost - researchPoints);
                  const effectText = lvl === 2 ? 'Sprint Drain: -50% (Lv.2 Max)' : lvl === 1 ? 'Sprint Drain: -30% (Lv.1)' : 'Sprint Drain: Standard (100%)';
                  return (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>Jetpack Thruster Capacitor</span>
                          {isMax && <span className="text-emerald-400 text-[10px] font-bold">✓ MAX</span>}
                        </div>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${lvl >= 1 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                            <span className={`w-2 h-2 rounded-full ${lvl >= 2 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Level {lvl}/2</span>
                        </div>
                        <div className="text-[11px] text-slate-400">Extended thruster sprint duration with reduced battery drain rate.</div>
                        <div data-testid="effect-value-jetpack" className="text-[10px] text-cyan-300 font-bold">
                          {effectText}
                        </div>
                      </div>
                      <button
                        data-testid="buy-upgrade-jetpack"
                        onClick={() => handleBuyUpgrade('jetpack')}
                        disabled={isMax || !canAfford}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0 transition-colors ${
                          isMax
                            ? 'bg-slate-800 text-emerald-400 cursor-default border border-slate-700'
                            : canAfford
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        }`}
                      >
                        {isMax ? 'Owned' : canAfford ? `Buy (${cost} RP)` : `Need ${needed} more RP`}
                      </button>
                    </div>
                  );
                })()}

                {/* Upgrade 2: Scan Radius */}
                {(() => {
                  const lvl = typeof upgrades.scan === 'number' ? upgrades.scan : (upgrades.scan ? 1 : 0);
                  const isMax = lvl >= 2;
                  const cost = isMax ? 0 : [4, 8][lvl];
                  const canAfford = !isMax && researchPoints >= cost;
                  const needed = isMax ? 0 : Math.max(0, cost - researchPoints);
                  const effectText = lvl === 2 ? 'Scan Radius: 420m (+50% Lv.2 Max)' : lvl === 1 ? 'Scan Radius: 350m (+25% Lv.1)' : 'Scan Radius: 280m (Standard)';
                  return (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>Deep Resonance Sonar Antenna</span>
                          {isMax && <span className="text-emerald-400 text-[10px] font-bold">✓ MAX</span>}
                        </div>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${lvl >= 1 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                            <span className={`w-2 h-2 rounded-full ${lvl >= 2 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Level {lvl}/2</span>
                        </div>
                        <div className="text-[11px] text-slate-400">Expands NOVA's acoustic radar ping wave radius.</div>
                        <div data-testid="effect-value-scan" className="text-[10px] text-cyan-300 font-bold">
                          {effectText}
                        </div>
                      </div>
                      <button
                        data-testid="buy-upgrade-scan"
                        onClick={() => handleBuyUpgrade('scan')}
                        disabled={isMax || !canAfford}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0 transition-colors ${
                          isMax
                            ? 'bg-slate-800 text-emerald-400 cursor-default border border-slate-700'
                            : canAfford
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        }`}
                      >
                        {isMax ? 'Owned' : canAfford ? `Buy (${cost} RP)` : `Need ${needed} more RP`}
                      </button>
                    </div>
                  );
                })()}

                {/* Upgrade 3: Minimap Reveal */}
                {(() => {
                  const lvl = typeof upgrades.minimap === 'number' ? upgrades.minimap : (upgrades.minimap ? 1 : 0);
                  const isMax = lvl >= 2;
                  const cost = isMax ? 0 : [5, 10][lvl];
                  const canAfford = !isMax && researchPoints >= cost;
                  const needed = isMax ? 0 : Math.max(0, cost - researchPoints);
                  const effectText = lvl === 2 ? 'Reveal Radius: 26 tiles (+8 Lv.2 Max)' : lvl === 1 ? 'Reveal Radius: 22 tiles (+4 Lv.1)' : 'Reveal Radius: 18 tiles (Standard)';
                  return (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>Orbital Cartography Uplink</span>
                          {isMax && <span className="text-emerald-400 text-[10px] font-bold">✓ MAX</span>}
                        </div>
                        <div className="flex items-center gap-1.5 py-0.5">
                          <div className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${lvl >= 1 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                            <span className={`w-2 h-2 rounded-full ${lvl >= 2 ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-800 border border-slate-700'}`} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">Level {lvl}/2</span>
                        </div>
                        <div className="text-[11px] text-slate-400">Expands the fog-of-war exploration reveal radius.</div>
                        <div data-testid="effect-value-minimap" className="text-[10px] text-cyan-300 font-bold">
                          {effectText}
                        </div>
                      </div>
                      <button
                        data-testid="buy-upgrade-minimap"
                        onClick={() => handleBuyUpgrade('minimap')}
                        disabled={isMax || !canAfford}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0 transition-colors ${
                          isMax
                            ? 'bg-slate-800 text-emerald-400 cursor-default border border-slate-700'
                            : canAfford
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        }`}
                      >
                        {isMax ? 'Owned' : canAfford ? `Buy (${cost} RP)` : `Need ${needed} more RP`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/40 flex justify-end">
              <button
                onClick={() => {
                  sound.playClick();
                  setIsShipTerminalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-mono text-xs cursor-pointer transition-colors"
              >
                Exit Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autosave Notification Toast */}
      {saveToast && (
        <div className="absolute top-20 right-4 z-50 px-3.5 py-2 rounded-xl bg-slate-950/95 border border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 text-xs font-mono animate-in fade-in duration-200 pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* SPACECRAFT REPAIR SCENE */}
      {isRepairing && (
        <SpacecraftRepairScene
          collectedPartIds={collectedPartIds}
          onRepairComplete={() => {
            setIsRepairing(false);
            setIsShipRepaired(true);
            isShipRepairedRef.current = true;
            triggerAutoSave(true);
            sound.playSuccess();
            setIsLaunching(true);
          }}
          onClose={() => setIsRepairing(false)}
        />
      )}

      {/* LAUNCH CINEMATIC */}
      {isLaunching && (
        <LaunchCinematic
          onCinematicComplete={() => {
            setIsLaunching(false);
            setShowEnding(true);
          }}
        />
      )}

      {/* ENDING VICTORY SCREEN */}
      {showEnding && (
        <EndingScreen
          playTimeSeconds={playTimeRef.current}
          partsCount={collectedPartIdsRef.current.length}
          totalParts={8}
          exploredTiles={fogRef.current.getExploredTilesCount()}
          seed={config.seed}
          recoveredLogIds={recoveredLogIds}
          onPlayAgain={(newSeed) => {
            resetProgress();
            if (newSeed) {
              const freshSeed = Math.floor(Math.random() * 900000) + 100000;
              if (onRestartWithSeed) {
                onRestartWithSeed(freshSeed);
              } else {
                window.location.reload();
              }
            } else {
              if (onRestartWithSeed) {
                onRestartWithSeed(config.seed);
              } else {
                window.location.reload();
              }
            }
          }}
          onReturnToMenu={() => {
            if (onExitToMenu) onExitToMenu();
          }}
          onOpenCredits={() => setShowCredits(true)}
        />
      )}

      {/* CREDITS MODAL */}
      {showCredits && (
        <CreditsModal onClose={() => setShowCredits(false)} />
      )}

      {/* Desktop Ability Deck (Bottom Left) */}
      {!isLaunching && !showEnding && (
        <div className="hidden sm:flex absolute bottom-4 left-4 z-20 flex-col gap-2 pointer-events-none">
          
          {/* Thruster Jetpack Battery Gauge */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl pointer-events-auto">
            <Flame className={`w-4 h-4 ${sprintEnergy > 20 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
            <div className="flex flex-col gap-1 w-32">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-300 font-bold">JETPACK BOOST</span>
                <span className={`font-bold ${sprintEnergy > 20 ? 'text-cyan-400' : 'text-red-400'}`}>{sprintEnergy}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    sprintEnergy > 20 ? 'bg-gradient-to-r from-amber-500 to-cyan-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${sprintEnergy}%` }}
                />
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-300 font-semibold">
              SHIFT
            </span>
          </div>

          {/* Sonar Radar Scan Ability */}
          <button
            onClick={triggerSonarScan}
            disabled={sonarCooldown > 0}
            className={`flex items-center gap-2.5 p-2 rounded-xl backdrop-blur-md border shadow-xl pointer-events-auto transition-all cursor-pointer ${
              sonarCooldown <= 0
                ? 'bg-cyan-950/80 border-cyan-400/80 hover:bg-cyan-900 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95'
                : 'bg-slate-950/80 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
            title="Sonar Radar Scan [Space or Q]"
          >
            <Radio className={`w-4 h-4 ${sonarCooldown <= 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <div className="text-left font-mono text-[10px]">
              <div className="font-bold uppercase tracking-wider">
                {sonarCooldown <= 0 ? 'SONAR PING READY' : `RECHARGING (${sonarCooldown}s)`}
              </div>
              <div className="text-[9px] text-slate-400">Sweeps & vectors nearby wrecks</div>
            </div>
            <span className="ml-auto px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-300 font-semibold">
              SPACE / Q
            </span>
          </button>

          {/* Controls Legend */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-800/80 text-[10px] font-mono text-slate-400">
            <span className="text-cyan-400 font-bold">WASD:</span> Move
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-cyan-400 font-bold">[E]:</span> Interact
            <span className="text-slate-600 mx-1">·</span>
            <button
              onClick={triggerPetNova}
              className="text-pink-400 hover:text-pink-300 font-bold cursor-pointer underline pointer-events-auto"
              title="Pet NOVA Companion"
            >
              [P] Pet NOVA
            </button>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-cyan-400 font-bold">[M]:</span> Map
            {isDebugMode && (
              <>
                <span className="text-slate-600 mx-1">·</span>
                <span className="text-cyan-400 font-bold">F3:</span> Debug
              </>
            )}
          </div>
        </div>
      )}

      {/* Desktop Proximity Interaction Prompt Banner */}
      {!isLaunching && !showEnding && (nearbyEquipment || isNearShip || nearbySample) && (
        <div
          data-testid="interact-prompt"
          onClick={handleTouchInteract}
          className="hidden sm:flex absolute bottom-14 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-400 text-xs font-mono items-center gap-3 animate-pulse cursor-pointer pointer-events-auto shadow-[0_0_30px_rgba(6,182,212,0.4)]"
        >
          <span className="p-1 px-2 rounded-lg bg-cyan-400 text-slate-950 font-bold font-mono">
            [E]
          </span>
          <span className="text-white font-bold">
            {nearbyEquipment
              ? `SALVAGE ${nearbyEquipment.def.name.toUpperCase()}`
              : isShipRepaired
              ? 'COMMENCE ORBITAL RETURN LAUNCH'
              : isNearShip
              ? collectedPartIds.length >= 8
                ? 'COMMENCE SPACECRAFT REPAIR'
                : 'INSPECT CRASHED SPACECRAFT'
              : nearbySample
              ? `COLLECT ${nearbySample.def.name.toUpperCase()}`
              : 'INTERACT'}
          </span>
        </div>
      )}

      {/* Touch Interaction & D-Pad Controls (Mobile) */}
      {!isLaunching && !showEnding && (
        <div className="sm:hidden absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
          
          {/* Virtual D-Pad */}
          <div data-testid="virtual-dpad" className="flex flex-col items-center pointer-events-auto">
            <button
              onPointerDown={() => handleTouchDir('up', true)}
              onPointerUp={() => handleTouchDir('up', false)}
              onPointerLeave={() => handleTouchDir('up', false)}
              className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
            >
              ▲
            </button>
            <div className="flex gap-2 my-1">
              <button
                onPointerDown={() => handleTouchDir('left', true)}
                onPointerUp={() => handleTouchDir('left', false)}
                onPointerLeave={() => handleTouchDir('left', false)}
                className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
              >
                ◀
              </button>
              <button
                onPointerDown={() => handleTouchDir('down', true)}
                onPointerUp={() => handleTouchDir('down', false)}
                onPointerLeave={() => handleTouchDir('down', false)}
                className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
              >
                ▼
              </button>
              <button
                onPointerDown={() => handleTouchDir('right', true)}
                onPointerUp={() => handleTouchDir('right', false)}
                onPointerLeave={() => handleTouchDir('right', false)}
                className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Mobile Ability & Action Buttons */}
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            
            {/* Boost & Scan Mini Buttons */}
            <div className="flex items-center gap-2">
              <button
                onPointerDown={() => {
                  touchStateRef.current.boost = true;
                }}
                onPointerUp={() => {
                  touchStateRef.current.boost = false;
                }}
                onPointerLeave={() => {
                  touchStateRef.current.boost = false;
                }}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-mono text-[9px] font-bold shadow-lg transition-transform active:scale-95 ${
                  sprintEnergy > 15
                    ? 'bg-amber-600/90 active:bg-amber-500 border-amber-400 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-500'
                }`}
              >
                <Flame className="w-4 h-4 text-white" />
                <span>BOOST</span>
              </button>

              <button
                onClick={triggerSonarScan}
                disabled={sonarCooldown > 0}
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-mono text-[9px] font-bold shadow-lg transition-transform active:scale-95 ${
                  sonarCooldown <= 0
                    ? 'bg-cyan-600/90 active:bg-cyan-500 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-500'
                }`}
              >
                <Radio className="w-4 h-4 text-white" />
                <span>{sonarCooldown > 0 ? `${sonarCooldown}s` : 'SCAN'}</span>
              </button>
            </div>

            {/* Mobile Touch Interact Button */}
            {(nearbyEquipment || isNearShip || nearbySample) && (
              <button
                data-testid="touch-interact-btn"
                onClick={handleTouchInteract}
                className={`px-5 py-3 rounded-2xl font-bold font-mono text-xs shadow-lg animate-pulse flex items-center gap-2 cursor-pointer ${
                  nearbyEquipment
                    ? 'bg-cyan-400 active:bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                    : isShipRepaired
                    ? 'bg-sky-400 active:bg-sky-300 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)]'
                    : isNearShip
                    ? collectedPartIds.length >= 8
                      ? 'bg-emerald-400 active:bg-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                      : 'bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                    : nearbySample
                    ? 'bg-emerald-400 active:bg-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.6)]'
                    : 'bg-cyan-400 active:bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                }`}
              >
                <span>
                  {nearbyEquipment
                    ? '[E] SALVAGE'
                    : isShipRepaired
                    ? '[E] LAUNCH'
                    : isNearShip
                    ? collectedPartIds.length >= 8
                      ? '[E] REPAIR SHIP'
                      : '[E] INSPECT SHIP'
                    : nearbySample
                    ? '[E] SAMPLE'
                    : '[E] INTERACT'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
