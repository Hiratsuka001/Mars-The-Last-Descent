import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { atlas } from '../render/atlas';
import { sound } from '../systems/audio';
import { isReduceMotionEnabled, saveProgress, getSavedProgress, GameProgress } from '../systems/saveManager';
import { isDebugMode } from '../systems/debug';
import { getMoonMapData, RelicDef, SecretDef, PSRArea, IceDepositDef, MonumentDef, LunarRockDef, SeismicThumperDef } from '../data/moonMap';
import { MiniGameShell } from './MiniGames/MiniGameShell';
import { LunaSoftLandingGame } from './MiniGames/LunaSoftLandingGame';
import { ApolloLaserPingGame } from './MiniGames/ApolloLaserPingGame';
import { LunokhodLostRoverGame } from './MiniGames/LunokhodLostRoverGame';
import { NovaDialogue } from './NovaDialogue';
import { Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';

interface MoonSceneProps {
  onComplete: () => void;
  onSkip: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
}

const TILE_SIZE = 16;
const WALK_SPEED = 75; // px/sec
const HOP_SPEED_MULT = 1.4; // 105 px/sec
const HOP_AIRTIME = 0.8; // 0.7-0.9s
const HOP_COOLDOWN = 0.4; // 0.4s
const MOON_CAMERA_ZOOM = 2; // Integer zoom: player sprite rendered 56 CSS px tall (>= 32 desktop, >= 28 mobile)

interface Footprint {
  x: number;
  y: number;
  angle: number;
  isLeft: boolean;
  type: 'boot' | 'paw';
  alpha: number;
  age: number;
}

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  shape?: 'dot' | 'heart';
}

interface Micrometeorite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  length: number;
  trail: { x: number; y: number; alpha: number }[];
  life: number;
  maxLife: number;
  active: boolean;
}

interface KineticImpactFlash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface SeismicWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface LunarRoverState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  steerAngle: number;
  isDriving: boolean;
  bounceOffset: number;
  roosterTimer: number;
  dustTimer: number;
  motorSoundTimer: number;
}

// Seeded deterministic stars drawn in space beyond the map bounds
const SEEDED_STARS = Array.from({ length: 240 }, (_, i) => {
  const s1 = Math.sin(i * 997.13 + 42.7) * 10000;
  const r1 = s1 - Math.floor(s1);
  const s2 = Math.cos(i * 613.87 + 19.3) * 10000;
  const r2 = s2 - Math.floor(s2);
  const s3 = Math.sin(i * 331.41 + 81.9) * 10000;
  const r3 = s3 - Math.floor(s3);
  return {
    x: -400 + r1 * (1024 + 800),
    y: -300 + r2 * (640 + 600),
    size: r3 < 0.2 ? 2 : 1,
    alpha: 0.35 + r3 * 0.65,
  };
});

// Seeded nanoscale LADEE dust motes levitated by electrostatic solar UV charging
const LADEE_DUST_MOTES = Array.from({ length: 48 }, (_, i) => {
  const s1 = Math.sin(i * 439.17 + 12.3) * 10000;
  const r1 = s1 - Math.floor(s1);
  const s2 = Math.cos(i * 881.29 + 49.7) * 10000;
  const r2 = s2 - Math.floor(s2);
  const s3 = Math.sin(i * 193.41 + 83.1) * 10000;
  const r3 = s3 - Math.floor(s3);
  return {
    x: r1 * 1024,
    baseY: -35 + r2 * 75,
    speed: 1.5 + r3 * 3,
    phase: r2 * Math.PI * 2,
    size: r3 < 0.25 ? 1.5 : 1,
    alpha: 0.25 + r3 * 0.45,
  };
});

export const MoonScene: React.FC<MoonSceneProps> = ({
  onComplete,
  onSkip,
  isMuted,
  onToggleSound,
}) => {
  const mapData = useMemo(() => getMoonMapData(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Saved progress & collected relics
  const [relicIds, setRelicIds] = useState<string[]>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.relicIds || [];
  });
  const relicIdsRef = useRef<string[]>(relicIds);
  relicIdsRef.current = relicIds;

  // Saved secrets & anomalies
  const [secretIds, setSecretIds] = useState<string[]>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.secretIds || [];
  });
  const secretIdsRef = useRef<string[]>(secretIds);
  secretIdsRef.current = secretIds;

  // Active Toast & Notification
  const [toast, setToast] = useState<string | null>(null);

  // Dialogue & MiniGame state
  const [novaDialogue, setNovaDialogue] = useState<{
    text: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const novaDialogueRef = useRef(novaDialogue);
  novaDialogueRef.current = novaDialogue;

  const showDialogue = useCallback((dialogue: { text: string; actionLabel?: string; onAction?: () => void } | null) => {
    if (dialogue) {
      sound.playQuindarTone(false);
    } else if (novaDialogueRef.current) {
      sound.playQuindarTone(true);
    }
    setNovaDialogue(dialogue);
  }, []);

  const [activeRelic, setActiveRelic] = useState<RelicDef | null>(null);
  const activeRelicRef = useRef(activeRelic);
  activeRelicRef.current = activeRelic;

  const [showEarthrise, setShowEarthrise] = useState(false);
  const showEarthriseRef = useRef(showEarthrise);
  showEarthriseRef.current = showEarthrise;

  // Nearby Relic & Secret for UI prompts
  const [nearbyRelic, setNearbyRelic] = useState<RelicDef | null>(null);
  const nearbyRelicRef = useRef(nearbyRelic);
  nearbyRelicRef.current = nearbyRelic;

  const [nearbySecret, setNearbySecret] = useState<SecretDef | null>(null);
  const nearbySecretRef = useRef(nearbySecret);
  nearbySecretRef.current = nearbySecret;

  // Saved Water Ice Deposits & PSR State
  const [iceScannedIds, setIceScannedIds] = useState<string[]>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.iceScannedIds || [];
  });
  const iceScannedIdsRef = useRef<string[]>(iceScannedIds);
  iceScannedIdsRef.current = iceScannedIds;

  const [nearbyIce, setNearbyIce] = useState<IceDepositDef | null>(null);
  const nearbyIceRef = useRef(nearbyIce);
  nearbyIceRef.current = nearbyIce;

  // Saved historical monuments
  const [monumentIds, setMonumentIds] = useState<string[]>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.monumentIds || [];
  });
  const monumentIdsRef = useRef<string[]>(monumentIds);
  monumentIdsRef.current = monumentIds;

  const [nearbyMonument, setNearbyMonument] = useState<MonumentDef | null>(null);
  const nearbyMonumentRef = useRef<MonumentDef | null>(null);
  nearbyMonumentRef.current = nearbyMonument;

  // Phase 10: Saved Lunar Geological Rock Samples
  const [lunarRockIds, setLunarRockIds] = useState<string[]>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.lunarRockIds || [];
  });
  const lunarRockIdsRef = useRef<string[]>(lunarRockIds);
  lunarRockIdsRef.current = lunarRockIds;

  const [nearbyRock, setNearbyRock] = useState<LunarRockDef | null>(null);
  const nearbyRockRef = useRef<LunarRockDef | null>(null);
  nearbyRockRef.current = nearbyRock;

  // Phase 10: ALSEP Active Seismic Thumper
  const [thumperFired, setThumperFired] = useState<boolean>(() => {
    const saved = getSavedProgress();
    return saved.moonChapter?.thumperFired || false;
  });
  const thumperFiredRef = useRef<boolean>(thumperFired);
  thumperFiredRef.current = thumperFired;

  const [nearbyThumper, setNearbyThumper] = useState(false);
  const nearbyThumperRef = useRef(false);

  const seismicWavesRef = useRef<SeismicWave[]>([]);

  // Nova Petting State
  const [canPetNova, setCanPetNova] = useState(false);
  const canPetNovaRef = useRef(false);

  const hasTriggeredIceTransmissionRef = useRef(false);

  // Dynamic Helmet Floodlight Angle
  const flashlightAngleRef = useRef(0);

  // Flying Golf Ball State for Apollo 14 Easter Egg
  const flyingGolfBallRef = useRef<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    trail: { x: number; y: number }[];
    active: boolean;
  } | null>(null);

  // Phase 7: Dynamic Cosmic Environment Refs
  const micrometeoritesRef = useRef<Micrometeorite[]>([]);
  const impactFlashesRef = useRef<KineticImpactFlash[]>([]);
  const nextMeteorTimerRef = useRef(14 + Math.random() * 10);
  const cameraShakeRef = useRef(0);
  const hasTriggeredHorizonTransRef = useRef(false);
  const hasWitnessedMeteorRef = useRef(false);

  // Phase 8: Apollo Lunar Roving Vehicle (LRV "Moon Buggy")
  const roverRef = useRef<LunarRoverState>({
    x: 13 * TILE_SIZE + 8,
    y: 16 * TILE_SIZE + 8,
    angle: 0,
    speed: 0,
    steerAngle: 0,
    isDriving: false,
    bounceOffset: 0,
    roosterTimer: 0,
    dustTimer: 0,
    motorSoundTimer: 0,
  });
  const [nearbyRover, setNearbyRover] = useState(false);
  const nearbyRoverRef = useRef(false);
  const [isDrivingRover, setIsDrivingRover] = useState(false);
  const isDrivingRoverRef = useRef(false);
  const hasBoardedRoverRef = useRef(false);

  const playerRef = useRef({
    x: mapData.startTile.x * TILE_SIZE + 8,
    y: mapData.startTile.y * TILE_SIZE + 12,
    facing: 'right' as 'up' | 'down' | 'left' | 'right',
    isMoving: false,
    walkFrame: 0,
  });

  const lastSafeGroundRef = useRef({
    x: mapData.startTile.x * TILE_SIZE + 8,
    y: mapData.startTile.y * TILE_SIZE + 12,
  });

  // Hop state
  const [isHopping, setIsHopping] = useState(false);
  const isHoppingRef = useRef(false);
  const hopTimerRef = useRef(0);
  const hopCooldownRef = useRef(0);
  const hopDirRef = useRef({ x: 0, y: 0 });

  // Camera & view
  const cameraRef = useRef({
    x: mapData.startTile.x * TILE_SIZE + 8,
    y: mapData.startTile.y * TILE_SIZE + 12,
  });

  // Nova Companion state (with 1/6th gravity cat physics & playful companionship)
  const novaRef = useRef({
    x: mapData.startTile.x * TILE_SIZE - 8,
    y: mapData.startTile.y * TILE_SIZE + 12,
    facing: 'right' as 'up' | 'down' | 'left' | 'right',
    isMoving: false,
    walkFrame: 0,
    trail: [] as { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' }[],
    idleTimer: 0,
    hopTimer: 0,
    isHopping: false,
    hopLift: 0,
    floatOffset: 0,
    isPetting: false,
    petTimer: 0,
    pounceCooldown: 2.0,
    pounceTarget: null as { x: number; y: number } | null,
    ballChaseTimer: 0,
  });

  // Keys & Touch Controls
  const heldKeysRef = useRef<Set<string>>(new Set());
  const touchStateRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
  });

  // Current Tile Coordinates for data attribute
  const [currentTile, setCurrentTile] = useState(`${mapData.startTile.x},${mapData.startTile.y}`);

  // Beacon overlay refs (updated directly at 60fps without React re-render churn)
  const beaconRef = useRef<HTMLDivElement | null>(null);
  const beaconArrowRef = useRef<HTMLDivElement | null>(null);

  // Persistent Footprints & Ballistic Vacuum Dust Particles
  const footprintsRef = useRef<Footprint[]>([]);
  const dustParticlesRef = useRef<DustParticle[]>([]);
  const playerDistSinceStepRef = useRef(0);
  const isLeftFootRef = useRef(false);
  const novaDistSinceStepRef = useRef(0);

  const spawnDust = useCallback((x: number, y: number, baseVx: number, baseVy: number, count = 2) => {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 16;
      const spreadVy = (Math.random() - 0.5) * 16;
      dustParticlesRef.current.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        z: Math.random() * 2 + 1,
        vx: baseVx + spread,
        vy: baseVy + spreadVy,
        vz: 14 + Math.random() * 18,
        size: Math.random() < 0.4 ? 2 : 1.2,
        alpha: 0.75 + Math.random() * 0.25,
        maxLife: 0.6 + Math.random() * 0.4,
        life: 0,
        color: Math.random() < 0.5 ? '#cbd5e1' : '#94a3b8',
      });
    }
  }, []);

  const spawnHopLaunchDust = useCallback((x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 18 + Math.random() * 24;
      dustParticlesRef.current.push({
        x: x + Math.cos(angle) * 3,
        y: y + Math.sin(angle) * 2,
        z: 1 + Math.random() * 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.6,
        vz: 28 + Math.random() * 25,
        size: Math.random() < 0.5 ? 2 : 1.5,
        alpha: 0.85,
        maxLife: 0.8 + Math.random() * 0.4,
        life: 0,
        color: '#e2e8f0',
      });
    }
  }, []);

  const spawnHopLandDust = useCallback((x: number, y: number) => {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = 25 + Math.random() * 35;
      dustParticlesRef.current.push({
        x: x + Math.cos(angle) * 4,
        y: y + Math.sin(angle) * 3,
        z: 1 + Math.random() * 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.7,
        vz: 35 + Math.random() * 35,
        size: Math.random() < 0.35 ? 2.5 : 1.5,
        alpha: 0.9,
        maxLife: 0.9 + Math.random() * 0.5,
        life: 0,
        color: Math.random() < 0.6 ? '#cbd5e1' : '#f1f5f9',
      });
    }
  }, []);

  // Canvas resize listener ensuring canvas rect matches viewport immediately (<200ms)
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reduce motion preference
  const reduceMotion = useMemo(() => isReduceMotionEnabled(), []);

  // Ambient sound setup: Vacuum / Moon
  useEffect(() => {
    sound.startAmbience('moon');
    sound.stopBiomeWind();
    return () => {
      sound.stopAmbience();
    };
  }, []);

  // QA Debug Hook: window.__moonTeleport & window.__moonDebug (gated behind isDebugMode)
  useEffect(() => {
    if (isDebugMode && typeof window !== 'undefined') {
      (window as any).__moonTeleport = (tx: number, ty: number) => {
        showDialogue(null);
        playerRef.current.x = tx * TILE_SIZE + 8;
        playerRef.current.y = ty * TILE_SIZE + 12;
        cameraRef.current.x = playerRef.current.x;
        cameraRef.current.y = playerRef.current.y;
        const ch = mapData.tiles[ty]?.[tx];
        if (ch === '.') {
          lastSafeGroundRef.current = { x: playerRef.current.x, y: playerRef.current.y };
        }
        setCurrentTile(`${tx},${ty}`);
        return { success: true, tx, ty };
      };
      (window as any).__moonDebug = {
        getPlayerSpriteHeight: () => 28 * MOON_CAMERA_ZOOM,
        getZoom: () => MOON_CAMERA_ZOOM,
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__moonTeleport;
        delete (window as any).__moonDebug;
      }
    };
  }, [mapData, showDialogue]);

  // When all 3 relics are logged, prompt for Earthrise whenever not in minigame or other dialogue
  useEffect(() => {
    if (relicIds.length >= 3 && !showEarthrise && !activeRelic && !novaDialogue) {
      const timer = setTimeout(() => {
        showDialogue({
          text: 'All three lunar relics logged! Look, Earth is rising ahead!',
          actionLabel: 'Observe Earthrise →',
          onAction: () => {
            showDialogue(null);
            setShowEarthrise(true);
          },
        });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [relicIds.length, showEarthrise, activeRelic, novaDialogue, showDialogue]);

  // Start Hop Action
  const startHop = useCallback(() => {
    if (isHoppingRef.current || hopCooldownRef.current > 0) return;

    let dirX = 0;
    let dirY = 0;
    const keys = heldKeysRef.current;
    const touch = touchStateRef.current;

    if (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left) dirX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight') || touch.right) dirX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp') || touch.up) dirY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown') || touch.down) dirY += 1;

    // If standing still when pressing hop, hop forward in facing direction
    if (dirX === 0 && dirY === 0) {
      const facing = playerRef.current.facing;
      if (facing === 'left') dirX = -1;
      else if (facing === 'right') dirX = 1;
      else if (facing === 'up') dirY = -1;
      else if (facing === 'down') dirY = 1;
    }

    const len = Math.hypot(dirX, dirY) || 1;
    hopDirRef.current = { x: dirX / len, y: dirY / len };

    isHoppingRef.current = true;
    setIsHopping(true);
    hopTimerRef.current = HOP_AIRTIME;
    spawnHopLaunchDust(playerRef.current.x, playerRef.current.y);
    sound.playClick();
  }, [spawnHopLaunchDust]);

  // Interact with Relic
  const triggerRelicInteract = useCallback((relic: RelicDef) => {
    sound.playClick();
    const alreadyFound = relicIdsRef.current.includes(relic.id);

    if (alreadyFound) {
      showDialogue({
        text: relic.replayLine,
      });
      return;
    }

    showDialogue({
      text: relic.oneLineHint,
      actionLabel: 'Log Relic →',
      onAction: () => {
        showDialogue(null);
        setActiveRelic(relic);
      },
    });
  }, [showDialogue]);

  // Interact with Secret Lunar Discovery
  const triggerSecretInteract = useCallback((secret: SecretDef) => {
    sound.playClick();
    const alreadyFound = secretIdsRef.current.includes(secret.id);

    if (alreadyFound) {
      if (secret.type === 'golf_ball') {
        flyingGolfBallRef.current = {
          x: secret.tileX * TILE_SIZE + 8,
          y: secret.tileY * TILE_SIZE + 8,
          z: 2,
          vx: 135,
          vy: -60,
          vz: 95,
          trail: [],
          active: true,
        };
        sound.playLaunchIgnition();
        novaRef.current.ballChaseTimer = 3.0;
        sound.playNovaChirp();
        spawnHopLaunchDust(novaRef.current.x, novaRef.current.y);
        showDialogue({
          text: `Alan Shepard's makeshift 6-iron strikes another golf ball into lunar orbit! Nova gives chase across the regolith!`,
        });
        return;
      }
      showDialogue({
        text: `${secret.name} is already logged in our expedition archive.`,
      });
      return;
    }

    const nextSecrets = Array.from(new Set([...secretIdsRef.current, secret.id]));
    setSecretIds(nextSecrets);
    secretIdsRef.current = nextSecrets;

    // Persist immediately to game progress
    const saved = getSavedProgress();
    const updated: GameProgress = {
      ...saved,
      currentChapter: 8,
      badges: Array.from(new Set([...(saved.badges || []), secret.badge])),
      moonChapter: {
        relicIds: relicIdsRef.current,
        secretIds: nextSecrets,
        iceScannedIds: iceScannedIdsRef.current,
        monumentIds: monumentIdsRef.current,
        lunarRockIds: lunarRockIdsRef.current,
        thumperFired: thumperFiredRef.current,
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    if (secret.type === 'golf_ball') {
      flyingGolfBallRef.current = {
        x: secret.tileX * TILE_SIZE + 8,
        y: secret.tileY * TILE_SIZE + 8,
        z: 2,
        vx: 135,
        vy: -60,
        vz: 95,
        trail: [],
        active: true,
      };
      sound.playLaunchIgnition();
      // Nova cat zoomies: leaps in pursuit of the hit golf ball!
      novaRef.current.ballChaseTimer = 3.0;
      sound.playNovaChirp();
      spawnHopLaunchDust(novaRef.current.x, novaRef.current.y);
      setToast('SECRET DISCOVERED: APOLLO 14 GOLF BALL');
    } else if (secret.type === 'orange_glass') {
      sound.playCollectSample();
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const spd = 20 + Math.random() * 25;
        dustParticlesRef.current.push({
          x: secret.tileX * TILE_SIZE + 8,
          y: secret.tileY * TILE_SIZE + 8,
          z: 1,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd * 0.7,
          vz: 25 + Math.random() * 25,
          size: 2,
          alpha: 1.0,
          maxLife: 1.2,
          life: 0,
          color: '#f97316',
        });
      }
      setToast('SAMPLE COLLECTED: ORANGE GLASS (+1 RP MARS)');
    } else if (secret.type === 'apollo_flag') {
      sound.playDiscovery();
      setToast('SECRET DISCOVERED: BLEACHED APOLLO 11 FLAG');
    }

    setTimeout(() => setToast(null), 3000);
    showDialogue({
      text: secret.discoveredLine,
    });
  }, [showDialogue]);

  // Interact / Scan Subsurface Water-Ice Deposit in Permanently Shadowed Regions
  const triggerIceScan = useCallback((ice: IceDepositDef) => {
    sound.playCollectSample();
    const alreadyScanned = iceScannedIdsRef.current.includes(ice.id);

    if (alreadyScanned) {
      showDialogue({
        text: `${ice.name}: telemetry confirmed. High-purity water-ice volatile crystals detected.`,
      });
      return;
    }

    const nextIce = Array.from(new Set([...iceScannedIdsRef.current, ice.id]));
    setIceScannedIds(nextIce);
    iceScannedIdsRef.current = nextIce;

    // Persist immediately to game progress
    const saved = getSavedProgress();
    const updated: GameProgress = {
      ...saved,
      currentChapter: 8,
      badges: Array.from(new Set([...(saved.badges || []), 'Permafrost Prospector'])),
      moonChapter: {
        relicIds: relicIdsRef.current,
        secretIds: secretIdsRef.current,
        iceScannedIds: nextIce,
        monumentIds: monumentIdsRef.current,
        lunarRockIds: lunarRockIdsRef.current,
        thumperFired: thumperFiredRef.current,
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    // Glimmer sparkles burst
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spd = 20 + Math.random() * 25;
      dustParticlesRef.current.push({
        x: ice.tileX * TILE_SIZE + 8,
        y: ice.tileY * TILE_SIZE + 8,
        z: 1,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.7,
        vz: 20 + Math.random() * 28,
        size: 2,
        alpha: 1.0,
        maxLife: 1.4,
        life: 0,
        color: i % 2 === 0 ? '#38bdf8' : '#e0f2fe',
      });
    }

    setToast(`WATER ICE SCANNED (${nextIce.length}/6)`);
    setTimeout(() => setToast(null), 3000);

    showDialogue({
      text: `${ice.name} verified! Crystalline volatiles frozen at cryogenic temperatures. Subsurface lunar ice is the key to deep space propellant and life support!`,
    });
  }, [showDialogue]);

  // Interact with Historical Lunar Monument
  const triggerMonumentInteract = useCallback((monument: MonumentDef) => {
    sound.playClick();
    const alreadyFound = monumentIdsRef.current.includes(monument.id);

    if (alreadyFound) {
      if (monument.type === 'fallen_astronaut') {
        sound.playSolemnChime();
      } else {
        sound.playSurveyorPing();
      }
      showDialogue({
        text: `${monument.name} is inscribed in our planetary exploration codex.`,
      });
      return;
    }

    const nextMonuments = Array.from(new Set([...monumentIdsRef.current, monument.id]));
    setMonumentIds(nextMonuments);
    monumentIdsRef.current = nextMonuments;

    // Persist immediately to game progress
    const saved = getSavedProgress();
    const updated: GameProgress = {
      ...saved,
      currentChapter: 8,
      badges: Array.from(new Set([...(saved.badges || []), monument.badge])),
      moonChapter: {
        relicIds: relicIdsRef.current,
        secretIds: secretIdsRef.current,
        iceScannedIds: iceScannedIdsRef.current,
        monumentIds: nextMonuments,
        lunarRockIds: lunarRockIdsRef.current,
        thumperFired: thumperFiredRef.current,
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    if (monument.type === 'fallen_astronaut') {
      sound.playSolemnChime();
      setToast('MEMORIAL VISITED: THE FALLEN ASTRONAUT');
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const spd = 14 + Math.random() * 18;
        dustParticlesRef.current.push({
          x: monument.tileX * TILE_SIZE + 8,
          y: monument.tileY * TILE_SIZE + 8,
          z: 2,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd * 0.7,
          vz: 16 + Math.random() * 20,
          size: 2,
          alpha: 0.9,
          maxLife: 1.6,
          life: 0,
          color: i % 2 === 0 ? '#fde047' : '#f8fafc',
        });
      }
    } else {
      sound.playSurveyorPing();
      setToast('HISTORIC PROBE INSPECTED: SURVEYOR 3');
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const spd = 16 + Math.random() * 20;
        dustParticlesRef.current.push({
          x: monument.tileX * TILE_SIZE + 8,
          y: monument.tileY * TILE_SIZE + 8,
          z: 2,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd * 0.7,
          vz: 18 + Math.random() * 22,
          size: 2,
          alpha: 0.9,
          maxLife: 1.4,
          life: 0,
          color: i % 2 === 0 ? '#67e8f9' : '#e2e8f0',
        });
      }
    }

    setTimeout(() => setToast(null), 3000);
    showDialogue({
      text: monument.discoveredLine,
    });
  }, [showDialogue]);

  // Phase 10: Sample Geological Rock Specimen
  const triggerRockSample = useCallback((rock: LunarRockDef) => {
    sound.playClick();
    const alreadyFound = lunarRockIdsRef.current.includes(rock.id);

    if (alreadyFound) {
      sound.playGeologicalHammer();
      showDialogue({
        text: `${rock.name} specimen already collected and cataloged in the Lunar Return Kit.`,
      });
      return;
    }

    sound.playGeologicalHammer();
    const nextRocks = Array.from(new Set([...lunarRockIdsRef.current, rock.id]));
    setLunarRockIds(nextRocks);
    lunarRockIdsRef.current = nextRocks;

    const allThreeCollected = nextRocks.length >= 3;
    const earnedBadges = [rock.badge];
    if (allThreeCollected) {
      earnedBadges.push('Lunar Petrologist');
    }

    const saved = getSavedProgress();
    const currentBadges = saved.badges || [];
    const updated: GameProgress = {
      ...saved,
      currentChapter: 8,
      badges: Array.from(new Set([...currentBadges, ...earnedBadges])),
      moonChapter: {
        relicIds: relicIdsRef.current,
        secretIds: secretIdsRef.current,
        iceScannedIds: iceScannedIdsRef.current,
        monumentIds: monumentIdsRef.current,
        lunarRockIds: nextRocks,
        thumperFired: thumperFiredRef.current,
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    // Particle burst with rock's distinct mineral color
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const spd = 16 + Math.random() * 24;
      dustParticlesRef.current.push({
        x: rock.tileX * TILE_SIZE + 8,
        y: rock.tileY * TILE_SIZE + 8,
        z: 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.7,
        vz: 18 + Math.random() * 22,
        size: Math.random() < 0.4 ? 2.5 : 1.5,
        alpha: 0.95,
        maxLife: 1.5,
        life: 0,
        color: i % 2 === 0 ? rock.color : '#f8fafc',
      });
    }

    setToast(
      allThreeCollected
        ? `GEOLOGY KIT COMPLETE: ${rock.name.toUpperCase()}`
        : `SPECIMEN COLLECTED: ${rock.name.toUpperCase()}`
    );
    setTimeout(() => setToast(null), 3500);

    showDialogue({
      text: allThreeCollected
        ? `[LUNAR PETROLOGY COMPLETE] Sampled ${rock.name} (${rock.chemicalFormula}, ${rock.mineralAge}). All 3 key Apollo geological lithologies cataloged for Earth return!`
        : `[SAMPLE COLLECTED] ${rock.name} (${rock.chemicalFormula}, ${rock.mineralAge}). ${rock.discoveredLine}`,
    });
  }, [showDialogue]);

  // Phase 10: Detonate ALSEP Active Seismic Thumper Station
  const triggerSeismicThumper = useCallback(() => {
    sound.playClick();
    sound.playSeismicThumper();

    // Camera shake detonation effect
    cameraShakeRef.current = 3.6;

    // Spawn 4 expanding concentric seismic acoustic wavefront rings
    const tx = mapData.seismicThumper.tileX * TILE_SIZE + 8;
    const ty = mapData.seismicThumper.tileY * TILE_SIZE + 8;
    for (let i = 0; i < 4; i++) {
      seismicWavesRef.current.push({
        x: tx,
        y: ty,
        radius: 6 + i * 14,
        maxRadius: 160 + i * 20,
        alpha: 1.0,
        life: 0,
        maxLife: 1.8 + i * 0.2,
      });
    }

    // Regolith dust kick around baseplate
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spd = 20 + Math.random() * 28;
      dustParticlesRef.current.push({
        x: tx,
        y: ty,
        z: 2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.7,
        vz: 24 + Math.random() * 28,
        size: Math.random() < 0.35 ? 2.5 : 1.5,
        alpha: 0.9,
        maxLife: 1.4,
        life: 0,
        color: i % 2 === 0 ? '#fbbf24' : '#cbd5e1',
      });
    }

    // Delayed sonar echo from subterranean strata reflection
    setTimeout(() => {
      sound.playSonarPing();
    }, 750);

    if (!thumperFiredRef.current) {
      setThumperFired(true);
      thumperFiredRef.current = true;

      const saved = getSavedProgress();
      const currentBadges = saved.badges || [];
      const updated: GameProgress = {
        ...saved,
        currentChapter: 8,
        badges: Array.from(new Set([...currentBadges, 'Seismic Sounder'])),
        moonChapter: {
          relicIds: relicIdsRef.current,
          secretIds: secretIdsRef.current,
          iceScannedIds: iceScannedIdsRef.current,
          monumentIds: monumentIdsRef.current,
          lunarRockIds: lunarRockIdsRef.current,
          thumperFired: true,
          completed: false,
          rpApplied: false,
        },
      };
      saveProgress(updated, true);
    }

    setToast('ALSEP SEISMIC THUMPER DETONATED');
    setTimeout(() => setToast(null), 3000);

    showDialogue({
      text: '[ACTIVE SEISMIC SOUNDING] Sub-surface acoustic shockwave recorded by 3 geophones. Crustal thickness: 40 km. Detected subterranean basalt lava tube cavity at 45 m depth!',
    });
  }, [mapData.seismicThumper, showDialogue]);

  // Pet Nova Companion in 1/6th Gravity (Zero-G belly roll & resonant purr)
  const triggerPetNova = useCallback(() => {
    const nova = novaRef.current;
    if (nova.isPetting) return;
    nova.isPetting = true;
    nova.petTimer = 2.2;
    nova.hopTimer = 0;
    nova.isHopping = false;
    nova.hopLift = 0;
    nova.isMoving = false;
    sound.playNovaPurr();

    // Spawn floating heart particles in low-G
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const spd = 12 + Math.random() * 16;
      dustParticlesRef.current.push({
        x: nova.x + (Math.random() - 0.5) * 6,
        y: nova.y - 12 + (Math.random() - 0.5) * 6,
        z: 6 + Math.random() * 6,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd * 0.6,
        vz: 16 + Math.random() * 16,
        size: 4,
        alpha: 1.0,
        maxLife: 2.2,
        life: 0,
        color: i % 2 === 0 ? '#f43f5e' : '#fb7185',
        shape: 'heart',
      });
    }

    setToast('NOVA PURRS IN 1/6TH GRAVITY ❤️');
    setTimeout(() => setToast(null), 3000);

    const saved = getSavedProgress();
    const currentBadges = saved.badges || [];
    if (!currentBadges.includes('Cosmic Companion')) {
      const updated: GameProgress = {
        ...saved,
        currentChapter: 8,
        badges: Array.from(new Set([...currentBadges, 'Cosmic Companion'])),
        moonChapter: {
          relicIds: relicIdsRef.current,
          secretIds: secretIdsRef.current,
          iceScannedIds: iceScannedIdsRef.current,
          monumentIds: monumentIdsRef.current,
          lunarRockIds: lunarRockIdsRef.current,
          thumperFired: thumperFiredRef.current,
          completed: false,
          rpApplied: false,
        },
      };
      saveProgress(updated, true);
    }
  }, []);

  // Board Apollo Lunar Roving Vehicle (LRV)
  const boardRover = useCallback(() => {
    const rover = roverRef.current;
    if (rover.isDriving) return;
    rover.isDriving = true;
    rover.speed = 0;
    isDrivingRoverRef.current = true;
    setIsDrivingRover(true);
    setNearbyRover(false);
    nearbyRoverRef.current = false;
    sound.playClick();
    setToast('BOARDED APOLLO LUNAR ROVING VEHICLE (LRV) 🏎️');
    setTimeout(() => setToast(null), 3000);

    const saved = getSavedProgress();
    const currentBadges = saved.badges || [];
    if (!currentBadges.includes('Lunar Grand Prix')) {
      const updated: GameProgress = {
        ...saved,
        currentChapter: 8,
        badges: Array.from(new Set([...currentBadges, 'Lunar Grand Prix'])),
        moonChapter: {
          relicIds: relicIdsRef.current,
          secretIds: secretIdsRef.current,
          iceScannedIds: iceScannedIdsRef.current,
          monumentIds: monumentIdsRef.current,
          lunarRockIds: lunarRockIdsRef.current,
          thumperFired: thumperFiredRef.current,
          completed: false,
          rpApplied: false,
        },
      };
      saveProgress(updated, true);
    }

    if (!hasBoardedRoverRef.current) {
      hasBoardedRoverRef.current = true;
      showDialogue({
        text: 'Nova: "All four DC wheel motors humming! 4-wheel independent steering and 1/6th gravity suspension engaged—watch those vacuum rooster tails!"',
      });
    }
  }, [showDialogue]);

  // Dismount Apollo Lunar Roving Vehicle
  const dismountRover = useCallback(() => {
    const rover = roverRef.current;
    if (!rover.isDriving) return;
    rover.isDriving = false;
    rover.speed = 0;
    isDrivingRoverRef.current = false;
    setIsDrivingRover(false);

    // Place astronaut and Nova beside rover safely
    const dismountX = rover.x - Math.sin(rover.angle) * 16;
    const dismountY = rover.y + Math.cos(rover.angle) * 16;
    playerRef.current.x = dismountX;
    playerRef.current.y = dismountY;
    novaRef.current.x = rover.x - 18;
    novaRef.current.y = rover.y;

    sound.playClick();
    setToast('DISMOUNTED LUNAR ROVER');
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Handle Relic MiniGame Logged / Won
  const handleRelicLogged = useCallback((relicId: string) => {
    const nextRelics = Array.from(new Set([...relicIdsRef.current, relicId]));
    setRelicIds(nextRelics);
    relicIdsRef.current = nextRelics;

    // Persist immediately to game progress
    const saved = getSavedProgress();
    const updated: GameProgress = {
      ...saved,
      currentChapter: 8,
      moonChapter: {
        relicIds: nextRelics,
        secretIds: secretIdsRef.current,
        iceScannedIds: iceScannedIdsRef.current,
        monumentIds: monumentIdsRef.current,
        lunarRockIds: lunarRockIdsRef.current,
        thumperFired: thumperFiredRef.current,
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    setActiveRelic(null);
    setToast(`RELIC ${nextRelics.length}/3`);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Direct Click/Tap to Pet Nova on Foot
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeRelicRef.current || showEarthriseRef.current || isDrivingRoverRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const viewW = canvas.width;
    const viewH = canvas.height;
    const viewWorldW = viewW / MOON_CAMERA_ZOOM;
    const viewWorldH = viewH / MOON_CAMERA_ZOOM;

    const mapWorldW = mapData.width * TILE_SIZE;
    const mapWorldH = mapData.height * TILE_SIZE;

    let camX = cameraRef.current.x;
    let camY = cameraRef.current.y;
    if (mapWorldW >= viewWorldW) {
      const minCamX = viewWorldW / 2;
      const maxCamX = mapWorldW - viewWorldW / 2;
      camX = Math.max(minCamX, Math.min(maxCamX, camX));
    } else {
      camX = mapWorldW / 2;
    }
    if (mapWorldH >= viewWorldH) {
      const minCamY = (viewWorldH / 2) - 80;
      const maxCamY = mapWorldH - viewWorldH / 2;
      camY = Math.max(minCamY, Math.min(maxCamY, camY));
    } else {
      camY = mapWorldH / 2;
    }

    const viewLeft = camX - viewWorldW / 2;
    const viewTop = camY - viewWorldH / 2;

    const worldX = viewLeft + clickX / MOON_CAMERA_ZOOM;
    const worldY = viewTop + clickY / MOON_CAMERA_ZOOM;

    const nova = novaRef.current;
    const player = playerRef.current;
    const dClickNova = Math.hypot(worldX - nova.x, worldY - (nova.y - 12));
    const dPlayerNova = Math.hypot(player.x - nova.x, player.y - nova.y);

    if (dClickNova <= 24 && dPlayerNova <= 45 && !nova.isPetting) {
      triggerPetNova();
    }
  }, [mapData, triggerPetNova]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'Enter', 'KeyP'].includes(e.code)) {
        e.preventDefault();
      }

      heldKeysRef.current.add(e.code);

      // P pets Nova when nearby on foot (consistent with Mars WorldScene)
      if ((e.code === 'KeyP' || e.key === 'p' || e.key === 'P') && !activeRelicRef.current && !showEarthriseRef.current && !isDrivingRoverRef.current) {
        const p = playerRef.current;
        const n = novaRef.current;
        if (Math.hypot(p.x - n.x, p.y - n.y) <= 45 && !n.isPetting) {
          triggerPetNova();
          return;
        }
      }

      // Space starts hop (only on foot)
      if (e.code === 'Space' && !isDrivingRoverRef.current && !isHoppingRef.current && hopCooldownRef.current <= 0 && !activeRelicRef.current && !showEarthriseRef.current) {
        startHop();
      }

      // E or Enter triggers interaction
      if ((e.code === 'KeyE' || e.code === 'Enter') && !activeRelicRef.current && !showEarthriseRef.current) {
        if (novaDialogueRef.current?.onAction) {
          novaDialogueRef.current.onAction();
        } else if (novaDialogueRef.current) {
          showDialogue(null);
        } else if (isDrivingRoverRef.current) {
          const p = playerRef.current;
          const nr = nearbyRelicRef.current || mapData.relics.find((r) => Math.hypot(p.x - (r.tileX * TILE_SIZE + 8), p.y - (r.tileY * TILE_SIZE + 8)) <= 36);
          const nm = nearbyMonumentRef.current || mapData.monuments.find((m) => Math.hypot(p.x - (m.tileX * TILE_SIZE + 8), p.y - (m.tileY * TILE_SIZE + 8)) <= 36);
          const nrock = nearbyRockRef.current || mapData.rocks.find((rk) => Math.hypot(p.x - (rk.tileX * TILE_SIZE + 8), p.y - (rk.tileY * TILE_SIZE + 8)) <= 36);
          const nthumper = nearbyThumperRef.current || Math.hypot(p.x - (mapData.seismicThumper.tileX * TILE_SIZE + 8), p.y - (mapData.seismicThumper.tileY * TILE_SIZE + 8)) <= 36;
          if (nr) {
            dismountRover();
            triggerRelicInteract(nr);
          } else if (nm) {
            dismountRover();
            triggerMonumentInteract(nm);
          } else if (nrock) {
            dismountRover();
            triggerRockSample(nrock);
          } else if (nthumper) {
            dismountRover();
            triggerSeismicThumper();
          } else {
            dismountRover();
          }
        } else {
          const p = playerRef.current;
          const nr = nearbyRelicRef.current || mapData.relics.find((r) => Math.hypot(p.x - (r.tileX * TILE_SIZE + 8), p.y - (r.tileY * TILE_SIZE + 8)) <= 36);
          if (nr) {
            triggerRelicInteract(nr);
          } else {
            const nm = nearbyMonumentRef.current || mapData.monuments.find((m) => Math.hypot(p.x - (m.tileX * TILE_SIZE + 8), p.y - (m.tileY * TILE_SIZE + 8)) <= 36);
            if (nm) {
              triggerMonumentInteract(nm);
            } else {
              const nrock = nearbyRockRef.current || mapData.rocks.find((rk) => Math.hypot(p.x - (rk.tileX * TILE_SIZE + 8), p.y - (rk.tileY * TILE_SIZE + 8)) <= 36);
              if (nrock) {
                triggerRockSample(nrock);
              } else {
                const nthumper = nearbyThumperRef.current || Math.hypot(p.x - (mapData.seismicThumper.tileX * TILE_SIZE + 8), p.y - (mapData.seismicThumper.tileY * TILE_SIZE + 8)) <= 36;
                if (nthumper) {
                  triggerSeismicThumper();
                } else {
                  const ns = nearbySecretRef.current || mapData.secrets.find((s) => Math.hypot(p.x - (s.tileX * TILE_SIZE + 8), p.y - (s.tileY * TILE_SIZE + 8)) <= 36);
                  if (ns) {
                    triggerSecretInteract(ns);
                  } else {
                    const ni = nearbyIceRef.current || mapData.iceDeposits.find((ice) => Math.hypot(p.x - (ice.tileX * TILE_SIZE + 8), p.y - (ice.tileY * TILE_SIZE + 8)) <= 32);
                    if (ni) {
                      triggerIceScan(ni);
                    } else if (nearbyRoverRef.current) {
                      boardRover();
                    } else if (canPetNovaRef.current) {
                      triggerPetNova();
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mapData, showDialogue, startHop, triggerRelicInteract, triggerMonumentInteract, triggerRockSample, triggerSeismicThumper, triggerSecretInteract, triggerIceScan, triggerPetNova, boardRover, dismountRover]);

  // Main 60fps Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const player = playerRef.current;
      const nova = novaRef.current;
      const keys = heldKeysRef.current;
      const touch = touchStateRef.current;

      // 1. Process Hop Cooldown
      if (hopCooldownRef.current > 0) {
        hopCooldownRef.current = Math.max(0, hopCooldownRef.current - dt);
      }

      // 2. Process Movement (Apollo LRV Driving OR On-Foot EVA)
      const rover = roverRef.current;
      let currentTx = Math.floor(player.x / TILE_SIZE);
      let currentTy = Math.floor(player.y / TILE_SIZE);

      if (rover.isDriving) {
        // Player is driving the Apollo Lunar Roving Vehicle (LRV)
        let steerInput = 0;
        if (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left) steerInput -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight') || touch.right) steerInput += 1;

        let throttleInput = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp') || touch.up) throttleInput += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown') || touch.down) throttleInput -= 1;

        // Steering rate (rad/s)
        const STEER_SPEED = 2.4;
        if (steerInput !== 0) {
          rover.steerAngle = Math.max(-0.6, Math.min(0.6, rover.steerAngle + steerInput * 4.0 * dt));
        } else {
          rover.steerAngle *= Math.max(0, 1 - 6.0 * dt);
        }

        // Adjust vehicle heading based on steer angle & speed
        if (Math.abs(rover.speed) > 2) {
          const turnDirection = rover.speed > 0 ? 1 : -1;
          rover.angle += rover.steerAngle * (rover.speed / 130) * STEER_SPEED * turnDirection * dt;
        }

        // Acceleration and braking
        const ACCEL = 160;
        const BRAKE = 220;
        const DECEL_FRICTION = 70;
        const MAX_SPEED = 140;
        const MAX_REV = -50;

        if (throttleInput > 0) {
          if (rover.speed < 0) {
            rover.speed = Math.min(0, rover.speed + BRAKE * dt);
          } else {
            rover.speed = Math.min(MAX_SPEED, rover.speed + ACCEL * dt);
          }
        } else if (throttleInput < 0) {
          if (rover.speed > 0) {
            rover.speed = Math.max(0, rover.speed - BRAKE * dt);
          } else {
            rover.speed = Math.max(MAX_REV, rover.speed - ACCEL * 0.7 * dt);
          }
        } else {
          // Coast / natural lunar regolith rolling resistance
          if (rover.speed > 0) {
            rover.speed = Math.max(0, rover.speed - DECEL_FRICTION * dt);
          } else if (rover.speed < 0) {
            rover.speed = Math.min(0, rover.speed + DECEL_FRICTION * dt);
          }
        }

        // Low-G suspension bounce oscillation
        if (Math.abs(rover.speed) > 10) {
          rover.bounceOffset = Math.sin(time * 0.016) * (Math.abs(rover.speed) / MAX_SPEED) * 1.5;
        } else {
          rover.bounceOffset = 0;
        }

        // Calculate next vehicle position along heading
        const headingX = Math.cos(rover.angle);
        const headingY = Math.sin(rover.angle);
        const nextRoverX = rover.x + headingX * rover.speed * dt;
        const nextRoverY = rover.y + headingY * rover.speed * dt;

        // Collision check against crater walls '#' and pits '~' (the rover cannot jump pits!)
        const checkRoverPassable = (rx: number, ry: number) => {
          const rtx = Math.floor(rx / TILE_SIZE);
          const rty = Math.floor(ry / TILE_SIZE);
          if (rtx < 0 || rtx >= mapData.width || rty < 0 || rty >= mapData.height) return false;
          const ch = mapData.tiles[rty]?.[rtx];
          return ch !== '#' && ch !== '~';
        };

        // Bumper check points around rover radius (approx 8px)
        const bumperPts = [
          { x: nextRoverX + headingX * 9, y: nextRoverY + headingY * 9 },
          { x: nextRoverX - headingX * 9, y: nextRoverY - headingY * 9 },
          { x: nextRoverX + headingY * 8, y: nextRoverY - headingX * 8 },
          { x: nextRoverX - headingY * 8, y: nextRoverY + headingX * 8 },
        ];

        let collision = false;
        for (const pt of bumperPts) {
          if (!checkRoverPassable(pt.x, pt.y)) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          rover.x = nextRoverX;
          rover.y = nextRoverY;
        } else {
          // Bumper bump! Soft stop and seismic thud
          if (Math.abs(rover.speed) > 30) {
            sound.playLunarSeismicThud();
            spawnDust(rover.x + headingX * 8, rover.y + headingY * 8, -headingX * 20, -headingY * 20, 6);
          }
          rover.speed = 0;
        }

        // Sync player position & facing to rover
        player.x = rover.x;
        player.y = rover.y;
        player.isMoving = Math.abs(rover.speed) > 5;
        if (Math.abs(headingX) > Math.abs(headingY)) {
          player.facing = headingX > 0 ? 'right' : 'left';
        } else {
          player.facing = headingY > 0 ? 'down' : 'up';
        }

        // Sync Nova position to rover passenger seat
        nova.x = rover.x;
        nova.y = rover.y;
        nova.isMoving = false;
        nova.isHopping = false;
        nova.facing = player.facing;

        // Motor sound
        if (Math.abs(rover.speed) > 10) {
          rover.motorSoundTimer += dt;
          if (rover.motorSoundTimer >= 0.16) {
            rover.motorSoundTimer = 0;
            sound.playRoverMotor(Math.abs(rover.speed) / MAX_SPEED);
          }
        } else {
          rover.motorSoundTimer = 0;
        }

        // Dual "Rooster Tail" regolith dust plumes spraying backward in vacuum parabolic arcs
        if (Math.abs(rover.speed) > 25) {
          rover.dustTimer += dt;
          if (rover.dustTimer >= 0.06) {
            rover.dustTimer = 0;
            // Back wheels offset perp to heading
            const rearX = rover.x - headingX * 7;
            const rearY = rover.y - headingY * 7;
            const perpX = -headingY * 6;
            const perpY = headingX * 6;

            const speedRatio = Math.abs(rover.speed) / MAX_SPEED;
            // Spray dust behind
            const sprayVx = -headingX * (rover.speed > 0 ? 1 : -1) * (20 + speedRatio * 35);
            const sprayVy = -headingY * (rover.speed > 0 ? 1 : -1) * (20 + speedRatio * 35);

            spawnDust(rearX + perpX, rearY + perpY, sprayVx + (Math.random() - 0.5) * 10, sprayVy + (Math.random() - 0.5) * 10, 2);
            spawnDust(rearX - perpX, rearY - perpY, sprayVx + (Math.random() - 0.5) * 10, sprayVy + (Math.random() - 0.5) * 10, 2);
          }
        }

        currentTx = Math.floor(player.x / TILE_SIZE);
        currentTy = Math.floor(player.y / TILE_SIZE);
        setCurrentTile(`${currentTx},${currentTy}`);
      } else {
        let moveX = 0;
        let moveY = 0;
        let speed = WALK_SPEED;

        if (isHoppingRef.current) {
          // Airborne movement: forward speed x1.4 along hop vector
          speed = WALK_SPEED * HOP_SPEED_MULT;
          moveX = hopDirRef.current.x;
          moveY = hopDirRef.current.y;
          hopTimerRef.current -= dt;

          if (hopTimerRef.current <= 0) {
            // Landing!
            isHoppingRef.current = false;
            setIsHopping(false);
            hopCooldownRef.current = HOP_COOLDOWN;

            // Check if landed on pit
            const landTileX = Math.floor(player.x / TILE_SIZE);
            const landTileY = Math.floor(player.y / TILE_SIZE);
            const tileCh = mapData.tiles[landTileY]?.[landTileX];

            if (tileCh === '~') {
              // Landed in a pit! Slide back to last safe tile
              spawnDust(player.x, player.y, 0, 0, 8);
              player.x = lastSafeGroundRef.current.x;
              player.y = lastSafeGroundRef.current.y;
              showDialogue({
                text: 'Whoa! Low gravity hop fell short. Back to safety!',
              });
              setTimeout(() => {
                setNovaDialogue((prev) => (prev?.text.includes('short') ? null : prev));
              }, 3000);
              sound.playMistake();
            } else {
              // Clean landing on solid lunar ground
              spawnHopLandDust(player.x, player.y);
              sound.playFootstep('regolith');

              // Spawn double landing bootprints side-by-side
              const hopAngle = Math.atan2(hopDirRef.current.y, hopDirRef.current.x);
              const perpX = -hopDirRef.current.y * 3.5;
              const perpY = hopDirRef.current.x * 3.5;
              footprintsRef.current.push({
                x: player.x - perpX,
                y: player.y - perpY,
                angle: hopAngle,
                isLeft: true,
                type: 'boot',
                alpha: 1.0,
                age: 0,
              });
              footprintsRef.current.push({
                x: player.x + perpX,
                y: player.y + perpY,
                angle: hopAngle,
                isLeft: false,
                type: 'boot',
                alpha: 1.0,
                age: 0,
              });
              if (footprintsRef.current.length > 200) {
                footprintsRef.current.splice(0, footprintsRef.current.length - 200);
              }
            }
          }
        } else if (!activeRelic && !showEarthrise && (!novaDialogue || !novaDialogue.actionLabel)) {
          // Normal grounded movement
          if (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left) moveX -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight') || touch.right) moveX += 1;
          if (keys.has('KeyW') || keys.has('ArrowUp') || touch.up) moveY -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown') || touch.down) moveY += 1;

          if (moveX !== 0 && moveY !== 0) {
            const inv = 1 / Math.SQRT2;
            moveX *= inv;
            moveY *= inv;
          }
        }

        const isMoving = moveX !== 0 || moveY !== 0;
        player.isMoving = isMoving;

        if (isMoving) {
          if (Math.abs(moveX) > Math.abs(moveY)) {
            player.facing = moveX > 0 ? 'right' : 'left';
          } else if (Math.abs(moveY) > 0) {
            player.facing = moveY > 0 ? 'down' : 'up';
          }
          player.walkFrame += dt * 8;
        } else {
          player.walkFrame = 0;
        }

        // Check collision and apply velocity
        if (isMoving) {
          const nextX = player.x + moveX * speed * dt;
          const nextY = player.y + moveY * speed * dt;

          const checkWalkable = (testX: number, testY: number) => {
            const tx = Math.floor(testX / TILE_SIZE);
            const ty = Math.floor(testY / TILE_SIZE);

            if (tx < 0 || tx >= mapData.width || ty < 0 || ty >= mapData.height) return false;
            const ch = mapData.tiles[ty]?.[tx];
            if (ch === '#') return false; // Rock/wall impassable always
            if (ch === '~' && !isHoppingRef.current) return false; // Pit impassable unless hopping
            return true;
          };

          // Bounding box checks (half-width 5, half-height 4)
          if (
            checkWalkable(nextX - 5, player.y - 4) &&
            checkWalkable(nextX + 5, player.y - 4) &&
            checkWalkable(nextX - 5, player.y + 4) &&
            checkWalkable(nextX + 5, player.y + 4)
          ) {
            player.x = nextX;
          }

          if (
            checkWalkable(player.x - 5, nextY - 4) &&
            checkWalkable(player.x + 5, nextY - 4) &&
            checkWalkable(player.x - 5, nextY + 4) &&
            checkWalkable(player.x + 5, nextY + 4)
          ) {
            player.y = nextY;
          }

          // Footsteps & bootprints in lunar regolith
          if (!isHoppingRef.current) {
            playerDistSinceStepRef.current += speed * dt;
            if (playerDistSinceStepRef.current >= 13) {
              playerDistSinceStepRef.current = 0;
              isLeftFootRef.current = !isLeftFootRef.current;

              const ptx = Math.floor(player.x / TILE_SIZE);
              const pty = Math.floor(player.y / TILE_SIZE);
              if (mapData.tiles[pty]?.[ptx] === '.') {
                const angle = Math.atan2(moveY, moveX);
                const perpAngle = angle + (isLeftFootRef.current ? Math.PI / 2 : -Math.PI / 2);
                const footX = player.x + Math.cos(perpAngle) * 3;
                const footY = player.y + Math.sin(perpAngle) * 3;

                footprintsRef.current.push({
                  x: footX,
                  y: footY,
                  angle,
                  isLeft: isLeftFootRef.current,
                  type: 'boot',
                  alpha: 1.0,
                  age: 0,
                });
                if (footprintsRef.current.length > 200) footprintsRef.current.shift();

                spawnDust(footX, footY, -moveX * 12, -moveY * 12, 2);
                sound.playFootstep('regolith');
              }
            }
          }
        }

        // Record safe ground tile when grounded on solid ground
        currentTx = Math.floor(player.x / TILE_SIZE);
        currentTy = Math.floor(player.y / TILE_SIZE);
        let currentTileCh = mapData.tiles[currentTy]?.[currentTx];

        if (!isHoppingRef.current) {
          if (currentTileCh === '.') {
            lastSafeGroundRef.current = { x: player.x, y: player.y };
          } else if (currentTileCh === '~') {
            // In pit when not hopping: slide back to last safe ground tile
            spawnDust(player.x, player.y, 0, 0, 8);
            player.x = lastSafeGroundRef.current.x;
            player.y = lastSafeGroundRef.current.y;
            currentTx = Math.floor(player.x / TILE_SIZE);
            currentTy = Math.floor(player.y / TILE_SIZE);
            showDialogue({
              text: 'Whoa! Low gravity hop fell short. Back to safety!',
            });
            sound.playMistake();
          }
        }

        setCurrentTile(`${currentTx},${currentTy}`);
      }

      // Smooth Camera Follow
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;

      // 3. Nova Companion Follower & 1/6th Gravity Physics Logic (Only on foot)
      if (!rover.isDriving) {
        const lastTrail = nova.trail[nova.trail.length - 1];
        if (!lastTrail || Math.hypot(player.x - lastTrail.x, player.y - lastTrail.y) > 6) {
          nova.trail.push({ x: player.x, y: player.y, facing: player.facing });
          if (nova.trail.length > 20) nova.trail.shift();
        }

        const distToPlayer = Math.hypot(player.x - nova.x, player.y - nova.y);

        // Low-G Hopping State update
        if (nova.isHopping) {
          nova.hopTimer -= dt;
          const progress = Math.max(0, Math.min(1, 1 - nova.hopTimer / 0.85));
          nova.hopLift = Math.sin(progress * Math.PI) * 14;
          if (nova.hopTimer <= 0) {
            nova.isHopping = false;
            nova.hopLift = 0;
            spawnHopLaunchDust(nova.x, nova.y);
          }
        }

        // Handle pet timer
        if (nova.isPetting) {
          nova.petTimer -= dt;
          nova.floatOffset = Math.sin(time * 0.006) * 3.5;
          if (nova.petTimer <= 0) {
            nova.isPetting = false;
            nova.floatOffset = 0;
          }
        }

        // Handle pounce cooldown
        if (nova.pounceCooldown > 0) {
          nova.pounceCooldown -= dt;
        }

        // Priority 1: Petting (remain still floating/purring with gentle roll)
        if (nova.isPetting) {
          nova.isMoving = false;
          nova.walkFrame = 0;
        }
        // Priority 2: Ball chase zoomies!
        else if (nova.ballChaseTimer > 0 && flyingGolfBallRef.current?.active) {
          nova.ballChaseTimer -= dt;
          const ball = flyingGolfBallRef.current;
          const chaseDx = ball.x - nova.x;
          const chaseDy = ball.y - nova.y;
          const chaseDist = Math.hypot(chaseDx, chaseDy);
          if (chaseDist > 16) {
            if (!nova.isHopping && Math.random() < 0.12) {
              nova.isHopping = true;
              nova.hopTimer = 0.6;
              spawnHopLaunchDust(nova.x, nova.y);
            }
            const chaseSpd = 125;
            nova.x += (chaseDx / chaseDist) * chaseSpd * dt;
            nova.y += (chaseDy / chaseDist) * chaseSpd * dt;
            nova.isMoving = true;
            nova.walkFrame += dt * 14;
            if (Math.abs(chaseDx) > Math.abs(chaseDy)) nova.facing = chaseDx > 0 ? 'right' : 'left';
            else nova.facing = chaseDy > 0 ? 'down' : 'up';
          }
        }
        // Priority 3: Flashlight dot pouncing!
        else if (nova.pounceTarget) {
          const pdx = nova.pounceTarget.x - nova.x;
          const pdy = nova.pounceTarget.y - nova.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd > 6 && nova.isHopping) {
            const pounceSpd = 115;
            nova.x += (pdx / pd) * pounceSpd * dt;
            nova.y += (pdy / pd) * pounceSpd * dt;
            nova.isMoving = true;
            nova.walkFrame += dt * 12;
            if (Math.abs(pdx) > Math.abs(pdy)) nova.facing = pdx > 0 ? 'right' : 'left';
            else nova.facing = pdy > 0 ? 'down' : 'up';
          } else {
            nova.pounceTarget = null;
            spawnHopLaunchDust(nova.x, nova.y);
          }
        }
        // Priority 4: Normal follow trail / low-G hops / idle
        else if (distToPlayer > 18) {
          nova.idleTimer = 0;
          nova.floatOffset = 0;

          // If player is hopping or far away, Nova occasionally leaps in 1/6th gravity
          if ((distToPlayer > 36 || isHoppingRef.current) && !nova.isHopping && Math.random() < 0.05) {
            nova.isHopping = true;
            nova.hopTimer = 0.85;
            sound.playNovaPurr();
          }

          const target = nova.trail.length > 0 ? nova.trail[0] : player;
          const dx = target.x - nova.x;
          const dy = target.y - nova.y;
          const d = Math.hypot(dx, dy);
          if (d > 3) {
            const speedMult = nova.isHopping ? 1.4 : 1.05;
            nova.x += (dx / d) * WALK_SPEED * dt * speedMult;
            nova.y += (dy / d) * WALK_SPEED * dt * speedMult;
            nova.isMoving = true;
            nova.walkFrame += dt * (nova.isHopping ? 12 : 8);
            if (Math.abs(dx) > Math.abs(dy)) nova.facing = dx > 0 ? 'right' : 'left';
            else nova.facing = dy > 0 ? 'down' : 'up';

            novaDistSinceStepRef.current += WALK_SPEED * dt * speedMult;
            if (novaDistSinceStepRef.current >= 12 && !nova.isHopping) {
              novaDistSinceStepRef.current = 0;
              const ntx = Math.floor(nova.x / TILE_SIZE);
              const nty = Math.floor(nova.y / TILE_SIZE);
              if (mapData.tiles[nty]?.[ntx] === '.') {
                footprintsRef.current.push({
                  x: nova.x,
                  y: nova.y,
                  angle: Math.atan2(dy, dx),
                  isLeft: false,
                  type: 'paw',
                  alpha: 0.85,
                  age: 0,
                });
                if (footprintsRef.current.length > 200) footprintsRef.current.shift();
              }
            }
          } else if (nova.trail.length > 1) {
            nova.trail.shift();
          }
        } else {
          nova.isMoving = false;
          nova.walkFrame = 0;

          if (!nova.isHopping) {
            nova.idleTimer += dt;
            // Micro-elevation low-g float when resting
            if (nova.idleTimer > 2.0) {
              nova.floatOffset = Math.sin(time * 0.003 + 1.2) * 2.2;
            } else {
              nova.floatOffset = 0;
            }
            // Periodic idle curiosity bounce
            if (nova.idleTimer > 8.5 && !player.isMoving) {
              nova.isHopping = true;
              nova.hopTimer = 0.8;
              nova.idleTimer = 0;
              sound.playNovaChirp();
            }
          }

          // Check if player's flashlight dot is dancing on ground near Nova -> Predatory Pounce!
          if (!player.isMoving && !isHoppingRef.current && !nova.isHopping && nova.pounceCooldown <= 0) {
            const headX = player.x;
            const headY = player.y - 18;
            const spotX = headX + Math.cos(flashlightAngleRef.current) * 65;
            const spotY = headY + Math.sin(flashlightAngleRef.current) * 65;
            const dSpot = Math.hypot(spotX - nova.x, spotY - nova.y);
            if (dSpot >= 22 && dSpot <= 75) {
              nova.pounceTarget = { x: spotX, y: spotY };
              nova.isHopping = true;
              nova.hopTimer = 0.7;
              nova.pounceCooldown = 7.0; // Pounce interval
              sound.playNovaChirp();
              spawnHopLaunchDust(nova.x, nova.y);
            }
          }

          // Curiosity head-turn towards nearby secret or ice
          const closeObj = mapData.secrets.find((s) => Math.hypot(s.tileX * TILE_SIZE + 8 - nova.x, s.tileY * TILE_SIZE + 8 - nova.y) <= 36)
            || mapData.iceDeposits.find((ice) => Math.hypot(ice.tileX * TILE_SIZE + 8 - nova.x, ice.tileY * TILE_SIZE + 8 - nova.y) <= 32);
          if (closeObj) {
            const cx = closeObj.tileX * TILE_SIZE + 8;
            const cy = closeObj.tileY * TILE_SIZE + 8;
            const ox = cx - nova.x;
            const oy = cy - nova.y;
            if (Math.abs(ox) > Math.abs(oy)) nova.facing = ox > 0 ? 'right' : 'left';
            else nova.facing = oy > 0 ? 'down' : 'up';
          }
        }
      }

      // 3.5 Update Footprints & Ballistic Vacuum Dust Particles
      const fps = footprintsRef.current;
      for (let i = 0; i < fps.length; i++) {
        fps[i].age += dt;
        fps[i].alpha = Math.max(0, 1 - fps[i].age / 95);
      }

      const particles = dustParticlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vz -= 60 * dt; // Moon vertical gravity pulls dust particles down

        if (p.z <= 0) {
          p.z = 0;
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.vz = 0;
        }

        p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      // 3.6 Update Camera Shake decay & Micrometeorite Cosmic Impact Physics
      if (cameraShakeRef.current > 0) {
        cameraShakeRef.current = Math.max(0, cameraShakeRef.current - dt * 6.5);
      }

      // Micrometeorite Spawner
      nextMeteorTimerRef.current -= dt;
      if (nextMeteorTimerRef.current <= 0) {
        nextMeteorTimerRef.current = 24 + Math.random() * 20;
        const targetX = 80 + Math.random() * (mapData.width * TILE_SIZE - 160);
        const targetY = 32 + Math.random() * 72; // Distant northern crater rim walls
        const angle = Math.PI * 0.32 + (Math.random() - 0.5) * 0.35;
        const spd = 640 + Math.random() * 160;
        const dist = 320;
        const startX = targetX - Math.cos(angle) * dist;
        const startY = targetY - Math.sin(angle) * dist;
        micrometeoritesRef.current.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          targetX,
          targetY,
          length: 28,
          trail: [],
          life: 0,
          maxLife: dist / spd,
          active: true,
        });
      }

      // Update Active Micrometeorites
      const meteors = micrometeoritesRef.current;
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.trail.push({ x: m.x, y: m.y, alpha: 0.9 });
        if (m.trail.length > 7) m.trail.shift();
        for (const t of m.trail) t.alpha = Math.max(0, t.alpha - dt * 4.5);

        if (m.life >= m.maxLife) {
          m.active = false;
          // 1. Silent kinetic flash in vacuum
          impactFlashesRef.current.push({
            x: m.targetX,
            y: m.targetY,
            radius: 2,
            maxRadius: 24 + Math.random() * 8,
            alpha: 1.0,
            life: 0,
            maxLife: 0.28,
          });

          // 2. Ballistic regolith ejecta plume
          for (let pIdx = 0; pIdx < 18; pIdx++) {
            const eAngle = (pIdx / 18) * Math.PI + (Math.random() - 0.5) * 0.4;
            const eSpd = 28 + Math.random() * 45;
            dustParticlesRef.current.push({
              x: m.targetX + (Math.random() - 0.5) * 4,
              y: m.targetY + (Math.random() - 0.5) * 4,
              z: 1,
              vx: Math.cos(eAngle) * eSpd,
              vy: -Math.sin(eAngle) * eSpd * 0.65,
              vz: 25 + Math.random() * 35,
              size: Math.random() < 0.4 ? 2 : 1.2,
              alpha: 0.9,
              maxLife: 1.2 + Math.random() * 0.6,
              life: 0,
              color: pIdx % 2 === 0 ? '#f8fafc' : '#cbd5e1',
            });
          }

          // 3. Bedrock seismic shockwave conducted through astronaut suit boots
          const dToPlayer = Math.hypot(player.x - m.targetX, player.y - m.targetY);
          if (dToPlayer <= 280) {
            cameraShakeRef.current = Math.max(cameraShakeRef.current, (1 - dToPlayer / 280) * 2.2);
            sound.playLunarSeismicThud();
          }

          // 4. Nova head turn towards impact
          const dToNova = Math.hypot(nova.x - m.targetX, nova.y - m.targetY);
          if (dToNova <= 220 && !nova.isMoving && !nova.isPetting) {
            const nvx = m.targetX - nova.x;
            const nvy = m.targetY - nova.y;
            if (Math.abs(nvx) > Math.abs(nvy)) nova.facing = nvx > 0 ? 'right' : 'left';
            else nova.facing = nvy > 0 ? 'down' : 'up';
            nova.idleTimer = 0;
          }

          // 5. Witness notification on first nearby encounter
          if (!hasWitnessedMeteorRef.current && dToPlayer <= 320) {
            hasWitnessedMeteorRef.current = true;
            sound.playCosmicStatic();
            setToast('MICROMETEORITE IMPACT (SILENT KINETIC FLASH)');
            setTimeout(() => setToast(null), 3000);
          }

          meteors.splice(i, 1);
        }
      }

      // Update Kinetic Impact Flashes
      const flashes = impactFlashesRef.current;
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.life += dt;
        f.radius = (f.life / f.maxLife) * f.maxRadius;
        f.alpha = Math.max(0, 1 - f.life / f.maxLife);
        if (f.life >= f.maxLife) {
          flashes.splice(i, 1);
        }
      }

      // Update Active Seismic Acoustic Waves
      const waves = seismicWavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.life += dt;
        const progress = Math.min(1, w.life / w.maxLife);
        w.radius = 6 + (w.maxRadius - 6) * Math.sqrt(progress);
        w.alpha = Math.max(0, 1 - progress);
        if (w.life >= w.maxLife) {
          waves.splice(i, 1);
        }
      }

      // Check proximity to relics
      let nearR: RelicDef | null = null;
      for (const relic of mapData.relics) {
        const rx = relic.tileX * TILE_SIZE + 8;
        const ry = relic.tileY * TILE_SIZE + 8;
        if (Math.hypot(player.x - rx, player.y - ry) <= 28) {
          nearR = relic;
          break;
        }
      }
      nearbyRelicRef.current = nearR;
      setNearbyRelic(nearR);

      // Check proximity to historical monuments
      let nearM: MonumentDef | null = null;
      for (const monument of mapData.monuments) {
        const mx = monument.tileX * TILE_SIZE + 8;
        const my = monument.tileY * TILE_SIZE + 8;
        if (Math.hypot(player.x - mx, player.y - my) <= 30) {
          nearM = monument;
          break;
        }
      }
      nearbyMonumentRef.current = nearM;
      setNearbyMonument(nearM);

      // Check proximity to lunar geological rocks
      let nearRock: LunarRockDef | null = null;
      for (const rock of mapData.rocks) {
        const rx = rock.tileX * TILE_SIZE + 8;
        const ry = rock.tileY * TILE_SIZE + 8;
        if (Math.hypot(player.x - rx, player.y - ry) <= 30) {
          nearRock = rock;
          break;
        }
      }
      nearbyRockRef.current = nearRock;
      setNearbyRock(nearRock);

      // Check proximity to ALSEP seismic thumper station
      const stx = mapData.seismicThumper.tileX * TILE_SIZE + 8;
      const sty = mapData.seismicThumper.tileY * TILE_SIZE + 8;
      const nearThump = Math.hypot(player.x - stx, player.y - sty) <= 32;
      nearbyThumperRef.current = nearThump;
      setNearbyThumper(nearThump);

      // Check proximity to secrets
      let nearS: SecretDef | null = null;
      for (const secret of mapData.secrets) {
        const sx = secret.tileX * TILE_SIZE + 8;
        const sy = secret.tileY * TILE_SIZE + 8;
        if (Math.hypot(player.x - sx, player.y - sy) <= 30) {
          nearS = secret;
          break;
        }
      }
      nearbySecretRef.current = nearS;
      setNearbySecret(nearS);

      // Nearby Water-Ice Proximity
      const nearIce = mapData.iceDeposits.find((ice) => Math.hypot(player.x - (ice.tileX * TILE_SIZE + 8), player.y - (ice.tileY * TILE_SIZE + 8)) <= 32) || null;
      nearbyIceRef.current = nearIce;
      setNearbyIce(nearIce);

      // Nearby Apollo LRV Proximity Check
      let nearRover = false;
      if (!rover.isDriving) {
        const dRover = Math.hypot(player.x - rover.x, player.y - rover.y);
        if (dRover <= 32) {
          nearRover = true;
        }
      }
      if (nearbyRoverRef.current !== nearRover) {
        nearbyRoverRef.current = nearRover;
        setNearbyRover(nearRover);
      }

      // Nova Pet Interaction Check (Affectionate resting cuddle window only, not always on screen)
      const dPlayerNova = Math.hypot(player.x - nova.x, player.y - nova.y);
      const petPossible = !rover.isDriving && !nearRover && dPlayerNova <= 28 && !isHoppingRef.current &&
        !nearR && !nearM && !nearRock && !nearThump && !nearS && !nearIce &&
        !nova.isMoving && !nova.isPetting && !nova.pounceTarget && nova.ballChaseTimer <= 0 &&
        nova.idleTimer >= 3.0 && nova.idleTimer <= 7.0;
      if (canPetNovaRef.current !== petPossible) {
        canPetNovaRef.current = petPossible;
        setCanPetNova(petPossible);
      }

      // Smooth Dynamic Helmet Floodlight Angle
      const targetLightAngle = player.facing === 'right' ? 0 : player.facing === 'down' ? Math.PI / 2 : player.facing === 'left' ? Math.PI : -Math.PI / 2;
      let diff = targetLightAngle - flashlightAngleRef.current;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      flashlightAngleRef.current += diff * Math.min(1, dt * 14);

      // Check if flashlight illuminates ice in PSR for the first time
      if (!hasTriggeredIceTransmissionRef.current && !activeRelic && !showEarthrise && !novaDialogue) {
        const headX = player.x;
        const headY = player.y - 18 - (isHoppingRef.current ? Math.sin(Math.max(0, Math.min(1, 1 - hopTimerRef.current / HOP_AIRTIME)) * Math.PI) * 20 : 0);
        const beamAngle = Math.PI * 0.35;
        const beamRange = 135;
        for (const ice of mapData.iceDeposits) {
          const ix = ice.tileX * TILE_SIZE + 8;
          const iy = ice.tileY * TILE_SIZE + 8;
          const dToIce = Math.hypot(ix - headX, iy - headY);
          let aToIce = Math.atan2(iy - headY, ix - headX);
          let aDiff = aToIce - flashlightAngleRef.current;
          while (aDiff < -Math.PI) aDiff += Math.PI * 2;
          while (aDiff > Math.PI) aDiff -= Math.PI * 2;
          if (dToIce <= beamRange && Math.abs(aDiff) <= beamAngle / 2) {
            hasTriggeredIceTransmissionRef.current = true;
            showDialogue({
              text: 'Nova: "Optical sensors confirm crystalline water-ice in the shadow! Subsurface lunar ice preserved at 35 Kelvin—the key to rocket fuel and survival for the Mars transit!"',
            });
            break;
          }
        }
      }

      // Check if astronaut approaches northern horizon ridge to observe LADEE dust glow
      if (!hasTriggeredHorizonTransRef.current && player.y <= 165 && !activeRelic && !showEarthrise && !novaDialogue) {
        hasTriggeredHorizonTransRef.current = true;
        sound.playCosmicStatic();
        showDialogue({
          text: 'Nova: "Optical sensors confirm high-altitude electrostatic dust streamers along the northern terminator. Levitated nanoscale lunar dust—the exact twilight rays Cernan and Schmitt sketched during Apollo 17!"',
        });
      }

      // Update Flying Golf Ball Physics
      const ball = flyingGolfBallRef.current;
      if (ball && ball.active) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.z += ball.vz * dt;
        ball.vz -= 22 * dt; // Moon low gravity
        ball.trail.push({ x: ball.x, y: ball.y - ball.z });
        if (ball.trail.length > 25) ball.trail.shift();

        if (ball.z < -40 || ball.y < -350 || ball.x > 1200) {
          ball.active = false;
        }
      }

      // 4. Update Beacon Arrow overlay directly via DOM refs (no React state churn)
      if (beaconRef.current && beaconArrowRef.current) {
        const unfound = mapData.relics.filter((r) => !relicIdsRef.current.includes(r.id));
        if (unfound.length > 0 && !showEarthriseRef.current) {
          beaconRef.current.style.display = 'flex';
          const nearest = unfound.reduce((prev, curr) => {
            const dPrev = Math.hypot(player.x - (prev.tileX * TILE_SIZE + 8), player.y - (prev.tileY * TILE_SIZE + 8));
            const dCurr = Math.hypot(player.x - (curr.tileX * TILE_SIZE + 8), player.y - (curr.tileY * TILE_SIZE + 8));
            return dCurr < dPrev ? curr : prev;
          });
          const targetWorldX = nearest.tileX * TILE_SIZE + 8;
          const targetWorldY = nearest.tileY * TILE_SIZE + 8;
          const dx = targetWorldX - cameraRef.current.x;
          const dy = targetWorldY - cameraRef.current.y;
          const angle = Math.atan2(dy, dx);
          const deg = (angle * 180) / Math.PI;

          const w = window.innerWidth;
          const h = window.innerHeight;
          const marginX = 52;
          const marginY = 68;
          const halfW = Math.max(30, w / 2 - marginX);
          const halfH = Math.max(30, h / 2 - marginY);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          let scale = 1;
          if (Math.abs(cosA * halfH) > Math.abs(sinA * halfW)) {
            scale = halfW / Math.max(0.001, Math.abs(cosA));
          } else {
            scale = halfH / Math.max(0.001, Math.abs(sinA));
          }
          const bx = Math.round(w / 2 + cosA * scale);
          const by = Math.round(h / 2 + sinA * scale);
          beaconRef.current.style.left = `${bx}px`;
          beaconRef.current.style.top = `${by}px`;
          beaconArrowRef.current.style.transform = `rotate(${Math.round(deg + 90)}deg)`;
        } else {
          beaconRef.current.style.display = 'none';
        }
      }

      // 5. Render Frame
      renderCanvas(time);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mapData, activeRelic, showEarthrise, novaDialogue]);

  // Render to Canvas with Integer Zoom and Clamped Camera Follow
  const renderCanvas = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const viewW = canvas.width;
    const viewH = canvas.height;
    const mapWorldW = mapData.width * TILE_SIZE;
    const mapWorldH = mapData.height * TILE_SIZE;

    // Viewport dimensions in world coordinates under integer zoom
    const viewWorldW = viewW / MOON_CAMERA_ZOOM;
    const viewWorldH = viewH / MOON_CAMERA_ZOOM;

    // Camera follow player clamped to map edges (never show whole map at tiny scale)
    let camX = cameraRef.current.x;
    let camY = cameraRef.current.y;

    if (mapWorldW >= viewWorldW) {
      const minCamX = viewWorldW / 2;
      const maxCamX = mapWorldW - viewWorldW / 2;
      camX = Math.max(minCamX, Math.min(maxCamX, camX));
    } else {
      camX = mapWorldW / 2;
    }

    if (mapWorldH >= viewWorldH) {
      // Allow 80px headroom so the northern deep space sky and Earth are framed
      const minCamY = (viewWorldH / 2) - 80;
      const maxCamY = mapWorldH - viewWorldH / 2;
      camY = Math.max(minCamY, Math.min(maxCamY, camY));
    } else {
      camY = mapWorldH / 2;
    }

    const viewLeft = camX - viewWorldW / 2;
    const viewTop = camY - viewWorldH / 2;

    ctx.save();
    // 1. Deep space background fill
    ctx.fillStyle = '#03060d';
    ctx.fillRect(0, 0, viewW, viewH);

    // Apply integer zoom & camera transform with seismic bedrock rumble
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    if (cameraShakeRef.current > 0.05 && !reduceMotion) {
      shakeOffsetX = (Math.random() - 0.5) * cameraShakeRef.current;
      shakeOffsetY = (Math.random() - 0.5) * cameraShakeRef.current;
    }
    ctx.scale(MOON_CAMERA_ZOOM, MOON_CAMERA_ZOOM);
    ctx.translate(-Math.round(viewLeft + shakeOffsetX), -Math.round(viewTop + shakeOffsetY));

    // 2. Render seeded starfield (visible in deep space outside map boundaries)
    for (const star of SEEDED_STARS) {
      ctx.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // 2.5 Render Celestial Earth in the Deep Space Horizon
    const earthX = 512 + (camX - 512) * 0.12;
    const earthY = -42 + (camY - 200) * 0.08;
    const earthRadius = 32;

    ctx.save();
    // Atmospheric Outer Diffuse Glow
    const glowGrad = ctx.createRadialGradient(earthX, earthY, earthRadius * 0.85, earthX, earthY, earthRadius * 2.3);
    glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    glowGrad.addColorStop(0.35, 'rgba(14, 165, 233, 0.22)');
    glowGrad.addColorStop(0.7, 'rgba(2, 132, 199, 0.08)');
    glowGrad.addColorStop(1, 'rgba(3, 6, 13, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius * 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Clip to Earth Sphere
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();

    // Deep Ocean Base
    const oceanGrad = ctx.createLinearGradient(earthX - earthRadius, earthY - earthRadius, earthX + earthRadius, earthY + earthRadius);
    oceanGrad.addColorStop(0, '#0284c7');
    oceanGrad.addColorStop(0.5, '#0369a1');
    oceanGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(earthX - earthRadius, earthY - earthRadius, earthRadius * 2, earthRadius * 2);

    // Continents
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(earthX - 7, earthY - 6, 13, 9, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.ellipse(earthX - 5, earthY + 5, 9, 13, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(earthX + 10, earthY - 8, 12, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Polar Caps
    ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
    ctx.beginPath();
    ctx.ellipse(earthX, earthY - earthRadius + 3.5, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX, earthY + earthRadius - 3.5, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swirling Cloud Bands (slow orbital drift)
    const cloudShift = (time * 0.0006) % 20;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(earthX - 10 + cloudShift, earthY - 2, 15, 4, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 8 - cloudShift * 0.7, earthY + 8, 11, 3.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 5, earthY - 14, 8, 3, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Terminator Shadow (Gentle Waxing Gibbous curve)
    const termGrad = ctx.createLinearGradient(earthX - earthRadius * 0.3, earthY, earthX + earthRadius, earthY);
    termGrad.addColorStop(0, 'rgba(3, 6, 13, 0)');
    termGrad.addColorStop(0.35, 'rgba(3, 6, 13, 0.4)');
    termGrad.addColorStop(0.7, 'rgba(2, 6, 23, 0.85)');
    termGrad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    ctx.fillStyle = termGrad;
    ctx.fillRect(earthX - earthRadius, earthY - earthRadius, earthRadius * 2, earthRadius * 2);

    ctx.restore(); // End clip

    // Thin Outer Atmosphere Limb
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 2.7 Render LADEE Electrostatic Horizon Glow & Levitated Nanoscale Dust Grains
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let layer = 0; layer < 3; layer++) {
      const yBase = -14 + layer * 22;
      const grad = ctx.createLinearGradient(0, yBase - 16, 0, yBase + 28);
      grad.addColorStop(0, 'rgba(186, 230, 253, 0)');
      grad.addColorStop(0.5, `rgba(186, 230, 253, ${0.07 + Math.sin(time * 0.0012 + layer * 1.6) * 0.025})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(viewLeft - 60, yBase);
      for (let wx = viewLeft - 60; wx <= viewLeft + viewWorldW + 60; wx += 35) {
        const wy = yBase + Math.sin(wx * 0.012 + time * 0.001 + layer) * 5 + Math.cos(wx * 0.022 - time * 0.0007) * 3;
        ctx.lineTo(wx, wy);
      }
      ctx.lineTo(viewLeft + viewWorldW + 60, yBase + 35);
      ctx.lineTo(viewLeft - 60, yBase + 35);
      ctx.closePath();
      ctx.fill();
    }

    // Levitated Nanoscale Dust Motes drifting in solar wind
    for (const mote of LADEE_DUST_MOTES) {
      const mx = (mote.x + (time * 0.001 * mote.speed)) % (mapData.width * TILE_SIZE + 200) - 100;
      const my = mote.baseY + Math.sin(time * 0.002 + mote.phase) * 6;
      ctx.fillStyle = `rgba(224, 242, 254, ${mote.alpha * (0.6 + Math.sin(time * 0.003 + mote.phase) * 0.4)})`;
      ctx.fillRect(Math.round(mx), Math.round(my), mote.size, mote.size);
    }
    ctx.restore();

    // 2.8 Draw Active Micrometeorite Streaks
    for (const m of micrometeoritesRef.current) {
      if (!m.active) continue;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const tailX = m.x - (m.vx / 600) * m.length;
      const tailY = m.y - (m.vy / 600) * m.length;
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // Incandescent meteor head glint
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw Visible Moon Tiles
    const startTileCol = Math.max(0, Math.floor(viewLeft / TILE_SIZE));
    const endTileCol = Math.min(mapData.width - 1, Math.ceil((viewLeft + viewWorldW) / TILE_SIZE));
    const startTileRow = Math.max(0, Math.floor(viewTop / TILE_SIZE));
    const endTileRow = Math.min(mapData.height - 1, Math.ceil((viewTop + viewWorldH) / TILE_SIZE));

    for (let ty = startTileRow; ty <= endTileRow; ty++) {
      for (let tx = startTileCol; tx <= endTileCol; tx++) {
        const ch = mapData.tiles[ty]?.[tx];
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        if (ch === '#') {
          atlas.drawSprite(ctx, 'tile_moon_crater_rim', px, py, TILE_SIZE, TILE_SIZE);

          // Lit highlight drawn ONLY on edges touching open ground or pit, never between two wall tiles
          ctx.save();
          const touchesGroundNorth = ty > 0 && (mapData.tiles[ty - 1]?.[tx] === '.' || mapData.tiles[ty - 1]?.[tx] === '~');
          const touchesGroundWest = tx > 0 && (mapData.tiles[ty]?.[tx - 1] === '.' || mapData.tiles[ty]?.[tx - 1] === '~');
          const touchesGroundSouth = ty < mapData.height - 1 && (mapData.tiles[ty + 1]?.[tx] === '.' || mapData.tiles[ty + 1]?.[tx] === '~');
          const touchesGroundEast = tx < mapData.width - 1 && (mapData.tiles[ty]?.[tx + 1] === '.' || mapData.tiles[ty]?.[tx + 1] === '~');

          if (touchesGroundNorth) {
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(px, py, TILE_SIZE, 1.5);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(px, py + 1.5, TILE_SIZE, 1);
          }
          if (touchesGroundWest) {
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(px, py, 1.5, TILE_SIZE);
          }
          if (touchesGroundSouth) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
          }
          if (touchesGroundEast) {
            ctx.fillStyle = '#334155';
            ctx.fillRect(px + TILE_SIZE - 1.5, py, 1.5, TILE_SIZE);
          }
          ctx.restore();
        } else if (ch === '~') {
          atlas.drawSprite(ctx, 'tile_moon_pit', px, py, TILE_SIZE, TILE_SIZE);

          // Deep blue-black crater centre with rounded bowl
          ctx.save();
          ctx.fillStyle = '#010309';
          ctx.beginPath();
          ctx.ellipse(px + 8, py + 8, 6.5, 6.5, 0, 0, Math.PI * 2);
          ctx.fill();

          const pitNorthGround = ty > 0 && mapData.tiles[ty - 1]?.[tx] === '.';
          const pitSouthGround = ty < mapData.height - 1 && mapData.tiles[ty + 1]?.[tx] === '.';
          const pitWestGround = tx > 0 && mapData.tiles[ty]?.[tx - 1] === '.';
          const pitEastGround = tx < mapData.width - 1 && mapData.tiles[ty]?.[tx + 1] === '.';

          // Bright lit rim on the near edge (west edge facing player approach)
          if (pitWestGround) {
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(px, py, 2.5, TILE_SIZE);
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(px + 2.5, py, 1.5, TILE_SIZE);

            // Faint dashed edge marker so it reads "hop here"
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + TILE_SIZE);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          if (pitNorthGround) {
            ctx.fillStyle = '#0284c7';
            ctx.fillRect(px, py, TILE_SIZE, 2);
          }
          if (pitSouthGround) {
            ctx.fillStyle = '#090d16';
            ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
          }
          if (pitEastGround) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
          }

          // Rounded crater bowl corners
          if (pitNorthGround && pitWestGround) {
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(px, py, 3, 3);
          }
          if (pitNorthGround && pitEastGround) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(px + TILE_SIZE - 3, py, 3, 3);
          }
          ctx.restore();
        } else {
          // Grey regolith
          const isVariant = (tx * 7 + ty * 13) % 5 === 0;
          atlas.drawSprite(
            ctx,
            isVariant ? 'tile_moon_regolith_variant' : 'tile_moon_regolith',
            px,
            py,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }
    }

    // 3.5 Soft Earthshine ambient tint across the landscape
    ctx.fillStyle = 'rgba(56, 189, 248, 0.022)';
    ctx.fillRect(viewLeft, viewTop, viewWorldW, viewWorldH);

    // 3.6 Draw Persistent Footprints & Pawprints
    for (const fp of footprintsRef.current) {
      if (fp.alpha <= 0.04) continue;
      ctx.save();
      ctx.translate(Math.round(fp.x), Math.round(fp.y));
      ctx.rotate(fp.angle);

      if (fp.type === 'boot') {
        // Apollo boot imprint
        ctx.fillStyle = `rgba(15, 23, 42, ${fp.alpha * 0.65})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tread ribs
        ctx.fillStyle = `rgba(30, 41, 59, ${fp.alpha * 0.85})`;
        ctx.fillRect(-2, -1.2, 0.7, 2.4);
        ctx.fillRect(0, -1.5, 0.7, 3);
        ctx.fillRect(2, -1.2, 0.7, 2.4);

        // Sunlit rim highlight
        ctx.fillStyle = `rgba(241, 245, 249, ${fp.alpha * 0.22})`;
        ctx.fillRect(-2.5, -2, 5, 0.6);
      } else {
        // Nova pawprint
        ctx.fillStyle = `rgba(15, 23, 42, ${fp.alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(30, 41, 59, ${fp.alpha * 0.75})`;
        ctx.fillRect(-1.4, -2.4, 0.9, 0.9);
        ctx.fillRect(0, -2.8, 0.9, 0.9);
        ctx.fillRect(1.4, -2.4, 0.9, 0.9);
      }
      ctx.restore();
    }

    // 3.7 Draw Ballistic Vacuum Dust Particles
    for (const p of dustParticlesRef.current) {
      if (p.alpha <= 0.02) continue;
      // Faint ground shadow
      if (p.z > 0.5) {
        ctx.fillStyle = `rgba(15, 23, 42, ${p.alpha * 0.35})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, Math.max(1, p.size * 0.6));
      }
      if (p.shape === 'heart') {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        const hx = Math.round(p.x);
        const hy = Math.round(p.y - p.z);
        // Retro 5x5 heart pixel pattern
        ctx.fillRect(hx - 2, hy - 2, 2, 2);
        ctx.fillRect(hx + 1, hy - 2, 2, 2);
        ctx.fillRect(hx - 2, hy, 5, 2);
        ctx.fillRect(hx - 1, hy + 2, 3, 1);
        ctx.fillRect(hx, hy + 3, 1, 1);
        ctx.restore();
      } else {
        // Elevated dust particle
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
        ctx.globalAlpha = 1.0;
      }
    }

    // 3.8 Draw Silent Kinetic Impact Flashes
    for (const f of impactFlashesRef.current) {
      if (f.alpha <= 0.02) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      // Outer kinetic shockwave ring
      ctx.strokeStyle = `rgba(255, 255, 255, ${f.alpha * 0.85})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.stroke();

      // High-intensity white-hot core
      const coreGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 0.75);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${f.alpha})`);
      coreGrad.addColorStop(0.4, `rgba(254, 240, 138, ${f.alpha * 0.7})`);
      coreGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Lunar Lander at Start
    const landerX = mapData.startTile.x * TILE_SIZE - 8;
    const landerY = mapData.startTile.y * TILE_SIZE - 12;
    atlas.drawSprite(ctx, 'wreck_phoenix', landerX, landerY, 32, 32);

    // 5. Draw 3 Relic Sites
    for (const relic of mapData.relics) {
      const rx = relic.tileX * TILE_SIZE - 10;
      const ry = relic.tileY * TILE_SIZE - 10;
      const isClaimed = relicIdsRef.current.includes(relic.id);

      if (relic.id === 'moon_lunokhod1') {
        // High-fidelity Lunokhod 1 Soviet Lunar Rover Model
        const lx = rx + 18;
        const ly = ry + 20;

        ctx.save();
        // Ground shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.ellipse(lx, ly + 2, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 8 wire-mesh wheels (4 left, 4 right)
        ctx.fillStyle = '#334155';
        for (let i = 0; i < 4; i++) {
          const wx = lx - 12 + i * 8;
          ctx.fillRect(wx - 2, ly - 7, 4, 3);
          ctx.fillRect(wx - 2, ly + 4, 4, 3);
        }

        // Bathtub chassis
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(lx - 12, ly - 5, 24, 10, 3);
        ctx.fill();
        ctx.stroke();

        // Opened circular solar lid
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(lx, ly - 8, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // High-gain antenna mast
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx - 6, ly - 5);
        ctx.lineTo(lx - 10, ly - 14);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(lx - 11, ly - 15, 2, 2);

        // Stereoscopic front camera ports
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(lx + 10, ly - 3, 2, 2);
        ctx.fillRect(lx + 10, ly + 1, 2, 2);

        // French Laser Corner Retroreflector Prism on front right
        ctx.fillStyle = '#10b981';
        ctx.fillRect(lx + 9, ly - 1, 3, 3);

        // Pulsing Earth laser ping ray to the retroreflector
        const laserCycle = (time * 0.003) % 4;
        if (laserCycle < 1.2) {
          const laserAlpha = Math.sin((laserCycle / 1.2) * Math.PI);
          ctx.strokeStyle = `rgba(52, 211, 153, ${laserAlpha * 0.85})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          // Ray travels towards Earth in the deep space northern sky
          ctx.moveTo(lx + 10, ly);
          ctx.lineTo(lx - 45, ly - 90);
          ctx.stroke();
          ctx.setLineDash([]);

          // Reflector sparkle glint
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(lx + 9, ly - 1, 2, 2);
        }
        ctx.restore();
      } else {
        // Render relic placeholder sprite
        atlas.drawSprite(ctx, relic.placeholderSprite, rx, ry, 36, 36);
      }

      // Glowing telemetry ring for unfound relics
      if (!isClaimed) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        const pulse = (Math.sin(time * 0.006) + 1) * 2;
        ctx.strokeRect(rx - pulse, ry - pulse, 36 + pulse * 2, 36 + pulse * 2);
        ctx.restore();
      }
    }

    // 5.5 Draw 3 Secret Lunar Discoveries & Flying Golf Ball
    for (const secret of mapData.secrets) {
      const sx = secret.tileX * TILE_SIZE + 8;
      const sy = secret.tileY * TILE_SIZE + 8;
      const isFound = secretIdsRef.current.includes(secret.id);

      if (secret.type === 'golf_ball') {
        // Ground Golf Ball (if not whacked yet)
        if (!isFound) {
          // Ball shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.beginPath();
          ctx.ellipse(sx + 0.5, sy + 1, 2.5, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();

          // White golf ball with dimple shading
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy - 1, 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(sx + 0.6, sy - 0.4, 1.2, 0, Math.PI * 2);
          ctx.fill();

          // Golden sparkle ring around golf ball
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1;
          const pulse = (Math.sin(time * 0.007) + 1) * 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Flying Golf Ball with arc trail
        const flyingBall = flyingGolfBallRef.current;
        if (flyingBall && flyingBall.active) {
          // Trail line
          if (flyingBall.trail.length > 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(flyingBall.trail[0].x, flyingBall.trail[0].y);
            for (let i = 1; i < flyingBall.trail.length; i++) {
              ctx.lineTo(flyingBall.trail[i].x, flyingBall.trail[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // Flying ball shadow on ground
          ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
          ctx.beginPath();
          ctx.ellipse(flyingBall.x, flyingBall.y, 2, 1, 0, 0, Math.PI * 2);
          ctx.fill();

          // Elevated golf ball
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(flyingBall.x, flyingBall.y - flyingBall.z, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (secret.type === 'apollo_flag') {
        // Bleached Apollo 11 Flag
        // Ground shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.beginPath();
        ctx.ellipse(sx + 2, sy + 3, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flagpole (silver aluminum)
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(sx - 1, sy - 18, 1.5, 20);

        // Top horizontal telescoping rod
        ctx.fillRect(sx - 1, sy - 18, 14, 1.2);

        // Gold finial
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(sx - 0.25, sy - 18.5, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Bleached pure white flag cloth
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(sx, sy - 17, 13, 9);

        // Subtle shaded fabric ripples
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(sx + 4, sy - 17, 1.2, 9);
        ctx.fillRect(sx + 8, sy - 17, 1.2, 9);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sx + 12, sy - 17, 1, 9);

        // Faint glow if unfound
        if (!isFound) {
          ctx.save();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          const pulse = (Math.sin(time * 0.005) + 1) * 2;
          ctx.strokeRect(sx - 4 - pulse, sy - 21 - pulse, 19 + pulse * 2, 24 + pulse * 2);
          ctx.restore();
        }
      } else if (secret.type === 'orange_glass') {
        // Shorty Crater Orange Pyroclastic Soil Decal
        ctx.save();
        const oGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 14);
        oGrad.addColorStop(0, '#ea580c');
        oGrad.addColorStop(0.4, '#f59e0b');
        oGrad.addColorStop(0.8, '#78350f');
        oGrad.addColorStop(1, 'rgba(30, 41, 59, 0)');
        ctx.fillStyle = oGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fill();

        // Glimmering glass bead motes
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(sx - 4, sy - 3, 1.5, 1.5);
        ctx.fillRect(sx + 3, sy - 4, 1.5, 1.5);
        ctx.fillRect(sx + 1, sy + 3, 1.5, 1.5);
        ctx.fillRect(sx - 5, sy + 2, 1.2, 1.2);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(sx + 5, sy + 1, 1.5, 1.5);

        // Beacon pulse if unfound
        if (!isFound) {
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 1.2;
          const pulse = (Math.sin(time * 0.008) + 1) * 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 12 + pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Small sampled trench marks
          ctx.fillStyle = '#451a03';
          ctx.fillRect(sx - 3, sy - 1, 6, 2);
        }
        ctx.restore();
      }
    }

    // 5.55 Draw Historical Lunar Monuments & Pioneers
    for (const monument of mapData.monuments) {
      const mx = monument.tileX * TILE_SIZE + 8;
      const my = monument.tileY * TILE_SIZE + 8;
      const isVisited = monumentIdsRef.current.includes(monument.id);

      if (monument.type === 'fallen_astronaut') {
        // Hadley Rille Memorial: 8.5 cm Prone Aluminum Figurine & Plaque
        ctx.save();
        // Ground shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.beginPath();
        ctx.ellipse(mx, my + 2, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Commemorative Plaque (standing upright in regolith)
        // Titanium post
        ctx.fillStyle = '#64748b';
        ctx.fillRect(mx + 3, my - 8, 1.2, 8);
        // Inscribed plaque face (silver/white with black micro-engravings)
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(mx + 1, my - 14, 6, 6);
        ctx.fillRect(mx + 1, my - 14, 6, 6);
        // 14 micro-notches representing the fallen astronauts and cosmonauts
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(mx + 2, my - 13, 4, 0.7);
        ctx.fillRect(mx + 2, my - 11.5, 4, 0.7);
        ctx.fillRect(mx + 2, my - 10, 4, 0.7);

        // Prone Aluminum Figurine (8.5 cm statuette lying face down in the dust)
        ctx.fillStyle = '#cbd5e1';
        // Figurine body (torso and legs stretched horizontally)
        ctx.fillRect(mx - 6, my - 1, 7, 2);
        // Figurine helmet/head (facing down)
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(mx - 6, my, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Figurine limbs / spacesuit joints
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(mx - 2, my - 1.5, 1, 3);
        ctx.fillRect(mx - 5, my - 1.5, 1, 3);

        // Subtle celestial golden starlight aura & glint
        const starlightPulse = 0.5 + 0.5 * Math.sin(time * 0.003);
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.4 + starlightPulse * 0.5})`;
        ctx.lineWidth = 1;
        // Diamond star sparkle above plaque
        const glintX = mx + 4;
        const glintY = my - 16;
        ctx.beginPath();
        ctx.moveTo(glintX - 3, glintY);
        ctx.lineTo(glintX + 3, glintY);
        ctx.moveTo(glintX, glintY - 3);
        ctx.lineTo(glintX, glintY + 3);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(glintX - 0.5, glintY - 0.5, 1, 1);

        // Golden reverence ring if unvisited
        if (!isVisited) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
          ctx.lineWidth = 1.2;
          const pulse = (Math.sin(time * 0.005) + 1) * 2;
          ctx.beginPath();
          ctx.arc(mx, my, 10 + pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (monument.type === 'surveyor3') {
        // Surveyor 3 Robotic Probe (Apollo 12 landing site in Ocean of Storms)
        ctx.save();
        // Ground shadow for tripod legs
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.beginPath();
        ctx.ellipse(mx, my + 3, 13, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3 Circular Landing Footpads (crushable aluminum honeycomb)
        ctx.fillStyle = '#94a3b8';
        // Left footpad
        ctx.beginPath();
        ctx.ellipse(mx - 10, my + 3, 2.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Right footpad
        ctx.beginPath();
        ctx.ellipse(mx + 10, my + 3, 2.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Front/center footpad
        ctx.beginPath();
        ctx.ellipse(mx, my + 6, 2.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tripod Strut Legs (aluminum tubular frame connecting footpads to chassis)
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, my - 2);
        ctx.lineTo(mx - 10, my + 3);
        ctx.moveTo(mx, my - 2);
        ctx.lineTo(mx + 10, my + 3);
        ctx.moveTo(mx, my - 2);
        ctx.lineTo(mx, my + 6);
        ctx.stroke();

        // Central Triangular Electronics Compartment / White Chassis
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(mx, my - 6);
        ctx.lineTo(mx + 6, my);
        ctx.lineTo(mx - 6, my);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mast with Solar Panel and High-Gain Planar Antenna
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(mx, my - 6);
        ctx.lineTo(mx, my - 16);
        ctx.stroke();

        // Planar Solar Panel (dark blue cells tilted to sun)
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.8;
        ctx.fillRect(mx - 4, my - 20, 8, 4);
        ctx.strokeRect(mx - 4, my - 20, 8, 4);

        // High-Gain Antenna Dish atop mast
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(mx + 2, my - 21, 3, 1.2, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Cylindrical TV Camera (angled upward towards crater rim)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(mx - 5, my - 5, 3, 5);
        ctx.fillStyle = '#0f172a'; // Camera aperture lens
        ctx.fillRect(mx - 5, my - 5, 1, 2);

        // Surface Sampler Pantograph Arm & Soil Trenching Scoop
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(mx + 3, my - 1);
        ctx.lineTo(mx + 7, my + 1);
        ctx.lineTo(mx + 9, my + 4);
        ctx.stroke();
        // Soil scoop bucket touching regolith
        ctx.fillStyle = '#475569';
        ctx.fillRect(mx + 8, my + 4, 3, 2);
        // Small dug regolith trench mark
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(mx + 8, my + 5, 4, 1.5);

        // Telemetry Ping Waves if unvisited
        if (!isVisited) {
          const pingPhase = (time * 0.002) % 1;
          const pingR = 8 + pingPhase * 16;
          const pingAlpha = (1 - pingPhase) * 0.7;
          ctx.strokeStyle = `rgba(56, 189, 248, ${pingAlpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(mx, my - 2, pingR, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Subtle operational telemetry LED
          const ledPulse = Math.sin(time * 0.004) > 0 ? 1 : 0.2;
          ctx.fillStyle = `rgba(52, 211, 153, ${ledPulse})`;
          ctx.fillRect(mx, my - 4, 1.5, 1.5);
        }

        ctx.restore();
      }
    }

    // 5.56 Draw 3 Lunar Mineral Return Specimens (Geological Rocks)
    for (const rock of mapData.rocks) {
      const rx = rock.tileX * TILE_SIZE + 8;
      const ry = rock.tileY * TILE_SIZE + 8;
      const isCollected = lunarRockIdsRef.current.includes(rock.id);

      ctx.save();
      // Ground contact shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.beginPath();
      ctx.ellipse(rx, ry + 2.5, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      if (rock.id === 'rock_breccia') {
        // Descartes Impact Melt Breccia (Apollo 16)
        // Multi-faceted dark impactite with lighter angular shock clasts
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(rx - 5, ry + 2);
        ctx.lineTo(rx - 6, ry - 2);
        ctx.lineTo(rx - 2, ry - 6);
        ctx.lineTo(rx + 3, ry - 5);
        ctx.lineTo(rx + 6, ry - 1);
        ctx.lineTo(rx + 4, ry + 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shock-melt angular clasts (anorthositic light fragments in dark glass)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(rx - 3, ry - 4, 2.5, 1.8);
        ctx.fillRect(rx + 1, ry - 3, 2, 2.2);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(rx - 1, ry + 0.5, 1.8, 1.5);
      } else if (rock.id === 'rock_basalt') {
        // Mare Tranquillitatis Basalt (Apollo 11)
        // Dark vesicular basalt slab with gold ilmenite & pyrite flecks
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(rx - 6, ry + 2);
        ctx.lineTo(rx - 4, ry - 4);
        ctx.lineTo(rx + 1, ry - 6);
        ctx.lineTo(rx + 6, ry - 3);
        ctx.lineTo(rx + 5, ry + 2.5);
        ctx.lineTo(rx - 1, ry + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vesicular pores (micro-cavities)
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(rx - 2, ry - 2, 1, 0, Math.PI * 2);
        ctx.arc(rx + 2, ry - 1, 1.2, 0, Math.PI * 2);
        ctx.arc(rx, ry + 1, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Sparkling golden ilmenite/pyrite flecks
        const fleckShine = 0.6 + 0.4 * Math.sin(time * 0.006 + rx);
        ctx.fillStyle = `rgba(251, 191, 36, ${fleckShine})`;
        ctx.fillRect(rx - 3.5, ry - 3, 1.2, 1.2);
        ctx.fillRect(rx + 3, ry - 4, 1, 1);
        ctx.fillRect(rx + 1.5, ry + 1, 1.2, 1);
      } else {
        // Anorthosite ("Genesis Rock", Apollo 15)
        // Pure calcic plagioclase feldspar crystal prism
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(rx - 5, ry + 2);
        ctx.lineTo(rx - 4, ry - 3);
        ctx.lineTo(rx, ry - 7);
        ctx.lineTo(rx + 5, ry - 4);
        ctx.lineTo(rx + 4, ry + 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crystal facet specular shine & inner prism refractions
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 7);
        ctx.lineTo(rx, ry + 1);
        ctx.lineTo(rx - 5, ry + 2);
        ctx.moveTo(rx, ry + 1);
        ctx.lineTo(rx + 4, ry + 2.5);
        ctx.stroke();

        // Crystalline core gleam
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(rx - 3, ry - 2);
        ctx.lineTo(rx, ry - 6);
        ctx.lineTo(rx, ry);
        ctx.closePath();
        ctx.fill();
      }

      // If collected: draw specimen catalog tag / core-notch marker
      if (isCollected) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(rx + 4, ry - 8, 3, 2);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rx + 4.5, ry - 7.5, 2, 1);
      } else {
        // Discovery pulse ring when uncollected
        const pulse = (Math.sin(time * 0.005 + rx) + 1) * 2;
        ctx.strokeStyle = rock.id === 'rock_genesis'
          ? `rgba(56, 189, 248, ${0.5 + pulse * 0.1})`
          : rock.id === 'rock_basalt'
          ? `rgba(245, 158, 11, ${0.5 + pulse * 0.1})`
          : `rgba(203, 213, 225, ${0.5 + pulse * 0.1})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(rx, ry - 1, 9 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Specular diamond sparkle
        const glintX = rx + (rock.id === 'rock_genesis' ? 0 : 2);
        const glintY = ry - 6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(glintX - 2.5, glintY);
        ctx.lineTo(glintX + 2.5, glintY);
        ctx.moveTo(glintX, glintY - 2.5);
        ctx.lineTo(glintX, glintY + 2.5);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5.57 Draw ALSEP Active Seismic Thumper Station & Geophone Network
    {
      const thumper = mapData.seismicThumper;
      const tx = thumper.tileX * TILE_SIZE + 8;
      const ty = thumper.tileY * TILE_SIZE + 8;
      const hasDetonated = thumperFiredRef.current;

      ctx.save();
      // Mortar baseplate shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.beginPath();
      ctx.ellipse(tx, ty + 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trailing electrical telemetry cables leading to 3 geophones
      ctx.lineWidth = 1;
      // Geophone 1 cable (top-left)
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(tx - 2, ty + 1);
      ctx.quadraticCurveTo(tx - 8, ty + 4, tx - 14, ty - 6);
      ctx.stroke();

      // Geophone 2 cable (top-right)
      ctx.strokeStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(tx + 2, ty + 1);
      ctx.quadraticCurveTo(tx + 10, ty + 3, tx + 16, ty - 4);
      ctx.stroke();

      // Geophone 3 cable (bottom-center)
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(tx, ty + 3);
      ctx.quadraticCurveTo(tx - 2, ty + 10, tx + 2, ty + 16);
      ctx.stroke();

      // 3 Geophone Sensor Stakes
      const geophones = [
        { gx: tx - 14, gy: ty - 6 },
        { gx: tx + 16, gy: ty - 4 },
        { gx: tx + 2, gy: ty + 16 },
      ];
      for (const gp of geophones) {
        // Geophone stake ground shadow
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.beginPath();
        ctx.ellipse(gp.gx, gp.gy + 1.5, 3, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stake metal spike
        ctx.fillStyle = '#64748b';
        ctx.fillRect(gp.gx - 0.5, gp.gy - 3, 1, 4);

        // Geophone cylinder sensor head
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 0.6;
        ctx.fillRect(gp.gx - 2, gp.gy - 6, 4, 3);
        ctx.strokeRect(gp.gx - 2, gp.gy - 6, 4, 3);

        // Sensor activity telemetry pulse
        const gpPulse = hasDetonated
          ? (Math.sin(time * 0.005 + gp.gx) > 0 ? '#22c55e' : '#15803d')
          : '#38bdf8';
        ctx.fillStyle = gpPulse;
        ctx.fillRect(gp.gx - 0.8, gp.gy - 5, 1.6, 1.2);
      }

      // Circular Mortar Baseplate (Steel/Aluminum)
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(tx, ty + 1, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Central Spring-Loaded Hammer Pillar / Striker Cylinder
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.8;
      ctx.fillRect(tx - 3, ty - 9, 6, 9);
      ctx.strokeRect(tx - 3, ty - 9, 6, 9);

      // Top hammer cap and shock-absorbing collar
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tx - 4, ty - 12, 8, 3);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(tx - 4, ty - 12, 8, 3);

      // Status Indicator LED on Central Housing
      const ledColor = hasDetonated ? '#22c55e' : (Math.sin(time * 0.008) > 0 ? '#ef4444' : '#7f1d1d');
      ctx.fillStyle = ledColor;
      ctx.beginPath();
      ctx.arc(tx, ty - 5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Detonation Ready Pulse Ring if not yet detonated
      if (!hasDetonated) {
        const pulse = (Math.sin(time * 0.006) + 1) * 2;
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.6 + pulse * 0.1})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tx, ty, 11 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5.58 Draw Concentric Seismic Acoustic Wavefront Rings
    if (seismicWavesRef.current.length > 0) {
      ctx.save();
      for (const wave of seismicWavesRef.current) {
        ctx.strokeStyle = `rgba(251, 191, 36, ${wave.alpha * 0.85})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner harmonic shock boundary
        ctx.strokeStyle = `rgba(56, 189, 248, ${wave.alpha * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, Math.max(1, wave.radius * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5.6 Render Permanently Shadowed Regions (PSR) Cryogenic Darkness Pass
    for (const area of mapData.psrAreas) {
      const ax = area.minX * TILE_SIZE;
      const ay = area.minY * TILE_SIZE;
      const aw = (area.maxX - area.minX + 1) * TILE_SIZE;
      const ah = (area.maxY - area.minY + 1) * TILE_SIZE;

      if (ax + aw < viewLeft || ax > viewLeft + viewWorldW || ay + ah < viewTop || ay > viewTop + viewWorldH) {
        continue;
      }

      ctx.save();
      const psrGrad = ctx.createLinearGradient(ax, ay, ax, ay + ah);
      psrGrad.addColorStop(0, 'rgba(3, 7, 18, 0.20)');
      psrGrad.addColorStop(0.25, 'rgba(2, 6, 23, 0.72)');
      psrGrad.addColorStop(0.7, 'rgba(1, 3, 9, 0.88)');
      psrGrad.addColorStop(1, 'rgba(2, 6, 23, 0.65)');
      ctx.fillStyle = psrGrad;
      ctx.fillRect(ax, ay, aw, ah);
      ctx.restore();
    }

    // 5.7 Render Subsurface Water-Ice Crystal Deposits
    const player = playerRef.current;
    const rover = roverRef.current;
    const isDriving = rover.isDriving;

    let hopLift = 0;
    if (isHoppingRef.current) {
      const hopProgress = Math.max(0, Math.min(1, 1 - hopTimerRef.current / HOP_AIRTIME));
      hopLift = Math.sin(hopProgress * Math.PI) * 20;
    }
    const headX = isDriving ? rover.x + Math.cos(rover.angle) * 3 : player.x;
    const headY = isDriving ? rover.y + Math.sin(rover.angle) * 3 - 4 : player.y - 18 - hopLift;
    const currentFlashlightAngle = isDriving ? rover.angle : flashlightAngleRef.current;
    const beamAngle = Math.PI * 0.35;
    const beamRange = 135;

    for (const ice of mapData.iceDeposits) {
      const ix = ice.tileX * TILE_SIZE + 8;
      const iy = ice.tileY * TILE_SIZE + 8;
      const isScanned = iceScannedIdsRef.current.includes(ice.id);

      // Check if illuminated by helmet floodlight
      const dToIce = Math.hypot(ix - headX, iy - headY);
      let aToIce = Math.atan2(iy - headY, ix - headX);
      let aDiff = aToIce - currentFlashlightAngle;
      while (aDiff < -Math.PI) aDiff += Math.PI * 2;
      while (aDiff > Math.PI) aDiff -= Math.PI * 2;
      const isIlluminated = (dToIce <= beamRange && Math.abs(aDiff) <= beamAngle / 2) || dToIce <= 28;

      ctx.save();
      // Base crystalline frost cluster
      ctx.fillStyle = isScanned ? 'rgba(56, 189, 248, 0.45)' : 'rgba(147, 197, 253, 0.65)';
      ctx.fillRect(ix - 3, iy - 2, 2.5, 2.5);
      ctx.fillRect(ix + 1, iy - 3, 2, 2);
      ctx.fillRect(ix - 1, iy + 1, 2.5, 2);

      // Deep cyan glow
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(ix, iy, 4, 0, Math.PI * 2);
      ctx.fill();

      // If swept by helmet floodlight: Brilliant Specular Star Glint!
      if (isIlluminated) {
        const twinkle = 0.75 + 0.25 * Math.sin(time * 0.008 + ice.tileX * 5);
        const starSize = (isScanned ? 3.5 : 5.5) * twinkle;

        // Bright diamond flare
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ix - starSize, iy);
        ctx.lineTo(ix + starSize, iy);
        ctx.moveTo(ix, iy - starSize);
        ctx.lineTo(ix, iy + starSize);
        ctx.stroke();

        // Diagonal shimmer
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ix - starSize * 0.5, iy - starSize * 0.5);
        ctx.lineTo(ix + starSize * 0.5, iy + starSize * 0.5);
        ctx.moveTo(ix - starSize * 0.5, iy + starSize * 0.5);
        ctx.lineTo(ix + starSize * 0.5, iy - starSize * 0.5);
        ctx.stroke();

        // Specular core dot
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ix - 1, iy - 1, 2, 2);
      }
      ctx.restore();
    }

    // 5.8 Render Dynamic Helmet Floodlight Beam (Additive Screen Blending)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // A. 360-degree ambient helmet illumination (close proximity)
    const ambGrad = ctx.createRadialGradient(headX, headY, 2, headX, headY, 30);
    ambGrad.addColorStop(0, 'rgba(240, 249, 255, 0.32)');
    ambGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.12)');
    ambGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.arc(headX, headY, 30, 0, Math.PI * 2);
    ctx.fill();

    // B. Directional Wide Floodlight Cone (135px reach)
    const coneGrad = ctx.createRadialGradient(headX, headY, 4, headX, headY, beamRange);
    coneGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    coneGrad.addColorStop(0.2, 'rgba(224, 242, 254, 0.42)');
    coneGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.16)');
    coneGrad.addColorStop(0.9, 'rgba(14, 165, 233, 0.05)');
    coneGrad.addColorStop(1, 'rgba(3, 6, 13, 0)');

    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.arc(headX, headY, beamRange, currentFlashlightAngle - beamAngle / 2, currentFlashlightAngle + beamAngle / 2);
    ctx.closePath();
    ctx.fill();

    // C. Narrow High-Intensity Center Hotspot
    const coreAngle = beamAngle * 0.45;
    const coreGrad = ctx.createRadialGradient(headX, headY, 2, headX, headY, beamRange * 0.7);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    coreGrad.addColorStop(0.35, 'rgba(224, 242, 254, 0.35)');
    coreGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
    coreGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.arc(headX, headY, beamRange * 0.7, currentFlashlightAngle - coreAngle / 2, currentFlashlightAngle + coreAngle / 2);
    ctx.closePath();
    ctx.fill();

    // D. Microscopic vacuum dust motes drifting in the beam
    for (let i = 0; i < 5; i++) {
      const moteDist = 20 + ((time * 0.02 + i * 26) % (beamRange - 25));
      const moteSpread = (Math.sin(time * 0.001 + i * 1.7) * 0.5) * (beamAngle * 0.35);
      const moteAngle = currentFlashlightAngle + moteSpread;
      const mx = headX + Math.cos(moteAngle) * moteDist;
      const my = headY + Math.sin(moteAngle) * moteDist;
      const moteAlpha = Math.sin((moteDist / beamRange) * Math.PI) * 0.55;
      ctx.fillStyle = `rgba(224, 242, 254, ${moteAlpha})`;
      ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
    }

    ctx.restore(); // Restore globalCompositeOperation to 'source-over'

    // 5.9 Draw Apollo Lunar Roving Vehicle (LRV "Moon Buggy")
    ctx.save();
    const bounceY = isDriving ? rover.bounceOffset : 0;
    ctx.translate(Math.round(rover.x), Math.round(rover.y - bounceY));
    ctx.rotate(rover.angle);

    // Rover Ground Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4 Wire-Mesh Wheels with Titanium Chevrons
    const wheelPositions = [
      { x: 10, y: -9, isFront: true },
      { x: 10, y: 9, isFront: true },
      { x: -10, y: -9, isFront: false },
      { x: -10, y: 9, isFront: false },
    ];

    for (const w of wheelPositions) {
      ctx.save();
      ctx.translate(w.x, w.y);
      if (w.isFront && isDriving) {
        ctx.rotate(rover.steerAngle);
      }
      // Wire mesh rim (dark zinc slate)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-4.5, -2, 9, 4, 1.5);
      ctx.fill();

      // Zinc piano wire mesh pattern
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-3, -1.5, 6, 3);

      // Spun aluminum hub
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1, -1, 2, 2);

      // Titanium chevron tread highlights
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-3.5, -2, 1, 4);
      ctx.fillRect(0, -2, 1, 4);
      ctx.fillRect(3.5, -2, 1, 4);

      // White fiberglass fender / mudguard above wheel
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-5, w.y < 0 ? -3 : 2, 10, 1.2);
      ctx.restore();
    }

    // White Tubular Aluminum Chassis
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-11, -7, 22, 14, 2.5);
    ctx.fill();
    ctx.stroke();

    // Front Forward Chassis with Golden Kapton Battery Covers & Electronics
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(4, -5, 6, 10);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(5, -4, 4, 8);

    // Front Bumper & RCA Color TV Camera
    ctx.fillStyle = '#64748b';
    ctx.fillRect(10, -5, 2, 10);
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, -2, 2.5, 4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(13, -1, 1, 2);

    // High-Gain Umbrella Dish Antenna
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(8, 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
    ctx.beginPath();
    ctx.ellipse(8, 10, 3.5, 2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rear Tool Rack & Geology Sample Carrier
    ctx.fillStyle = '#475569';
    ctx.fillRect(-13, -5, 2.5, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-12.5, -4, 1.5, 3);
    ctx.fillRect(-12.5, 1, 1.5, 3);

    // Two Bucket Seats
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-4, -6, 7, 5); // Driver seat
    ctx.fillRect(-4, 1, 7, 5);  // Passenger seat

    // T-Handle Hand Controller
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, -0.6, 2.5, 1.2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(2, -1.2, 1, 2.4);

    if (isDriving) {
      // Driver Astronaut (Apollo spacesuit in left bucket seat)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(-3, -6, 5.5, 4.5, 1);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-5, -5.5, 2, 3.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -3.8, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(1, -3.8, 1.8, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(1.5, -2.5, 1.5, 1);

      // Passenger Nova (feline EVA suit in right bucket seat)
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(-2.5, 1.5, 4.5, 3.5, 1);
      ctx.fill();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 3.2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(-1, 1.2);
      ctx.lineTo(0, 0.4);
      ctx.lineTo(1, 1.2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-1.5, 2.8, 3, 0.8);
    } else {
      // Parked: Empty seats with nylon seatbelts
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-3, -5.5);
      ctx.lineTo(2, -1.5);
      ctx.moveTo(-3, 1.5);
      ctx.lineTo(2, 5.5);
      ctx.stroke();
    }

    // Proximity Beacon Pulse when parked & nearby
    if (!isDriving && nearbyRoverRef.current) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      const pulse = (Math.sin(time * 0.007) + 1) * 2;
      ctx.strokeRect(-13 - pulse, -9 - pulse, 26 + pulse * 2, 18 + pulse * 2);
      ctx.restore();
    }

    ctx.restore();

    // 6. Draw Nova Companion & 7. Draw Astronaut Player (When On Foot)
    if (!isDriving) {
      const nova = novaRef.current;
      const novaFrame = nova.isMoving ? Math.floor(nova.walkFrame) % 4 : 0;
      const novaSprite = nova.isMoving ? `nova_walk_${nova.facing}_${novaFrame}` : `nova_idle_${nova.facing}`;
      const novaLift = nova.isHopping ? nova.hopLift : (nova.floatOffset || 0);

      const novaShadowScale = Math.max(0.4, 1 - Math.abs(novaLift) / 18);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(Math.round(nova.x), Math.round(nova.y), 7 * novaShadowScale, 3 * novaShadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      if (nova.isPetting) {
        // Playful zero-G belly roll rotation while purring
        ctx.save();
        ctx.translate(Math.round(nova.x), Math.round(nova.y - 12 - (nova.floatOffset || 0)));
        const rollAngle = Math.sin((2.2 - nova.petTimer) * 4.5) * 0.38;
        ctx.rotate(rollAngle);
        atlas.drawSprite(ctx, `nova_idle_${nova.facing}`, -13, -12, 26, 26);
        // Soft blush/heart glow on helmet visor
        ctx.fillStyle = 'rgba(251, 113, 133, 0.65)';
        ctx.fillRect(-2, -8, 4, 2);
        ctx.restore();
      } else {
        atlas.drawSprite(ctx, novaSprite, Math.round(nova.x - 13), Math.round(nova.y - 24 - novaLift), 26, 26);

        // Subtle Nova visor reflection glow
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fillRect(Math.round(nova.x - 2), Math.round(nova.y - 20 - novaLift), 4, 2);

        // Gentle floating heart emote bubble indicating Nova wants pets during cuddle window
        if (canPetNovaRef.current) {
          const heartFloat = Math.sin(time * 0.006) * 2;
          const bubbleX = Math.round(nova.x);
          const bubbleY = Math.round(nova.y - 28 - novaLift + heartFloat);
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(bubbleX - 7, bubbleY - 6, 14, 12, 3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 113, 133, 0.85)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fb7185';
          ctx.fillText('♥', bubbleX, bubbleY);
          ctx.restore();
        }
      }

      // 7. Draw Astronaut Player
      const pFrame = player.isMoving ? Math.floor(player.walkFrame) % 4 : 0;
      const pSprite = player.isMoving ? `player_walk_${player.facing}_${pFrame}` : `player_idle_${player.facing}`;

      // Ground shadow (drawn at ground level)
      const shadowScale = isHoppingRef.current ? Math.max(0.4, 1 - hopLift / 30) : 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(Math.round(player.x), Math.round(player.y), 8 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player sprite (lifted on sine arc, 28 world px -> 56 CSS px under ZOOM 2)
      atlas.drawSprite(ctx, pSprite, Math.round(player.x - 10), Math.round(player.y - 27 - hopLift), 20, 28);

      // Helmet headlamp lens bulb glint
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(Math.round(headX), Math.round(headY), 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // Restore world camera transform
  };

  return (
    <div
      data-testid="moon-scene"
      data-hopping={isHopping ? 'true' : 'false'}
      data-player-tile={currentTile}
      data-player-sprite-height={28 * MOON_CAMERA_ZOOM}
      className="relative w-screen h-screen overflow-hidden bg-[#03060d] text-slate-100 flex flex-col font-sans select-none touch-none overscroll-none"
    >
      {/* Background World Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="absolute inset-0 w-full h-full block cursor-default"
      />

      {/* Top HUD: Relic Counter, Earth Distance Chip, Skip Moon Button, Sound (>= 12px safe-area edge padding) */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pointer-events-none"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
        }}
      >
        {/* Left: Relic Counter */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <div
            data-testid="moon-relic-counter"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300 shadow-lg"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Relics {relicIds.length}/3</span>
          </div>

          {secretIds.length > 0 && (
            <div
              data-testid="moon-secrets-counter"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-xs font-mono font-bold text-amber-300 shadow-lg animate-in fade-in"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Secrets {secretIds.length}/3</span>
            </div>
          )}

          {iceScannedIds.length > 0 && (
            <div
              data-testid="moon-ice-counter"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-sky-500/40 text-xs font-mono font-bold text-sky-300 shadow-lg animate-in fade-in"
            >
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>Ice {iceScannedIds.length}/6</span>
            </div>
          )}

          {monumentIds.length > 0 && (
            <div
              data-testid="moon-monuments-counter"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-yellow-500/40 text-xs font-mono font-bold text-yellow-300 shadow-lg animate-in fade-in"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Monuments {monumentIds.length}/2</span>
            </div>
          )}

          {lunarRockIds.length > 0 && (
            <div
              data-testid="moon-rocks-counter"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-xs font-mono font-bold text-emerald-300 shadow-lg animate-in fade-in"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Rocks {lunarRockIds.length}/3</span>
            </div>
          )}

          {/* Earth Radio Distance Chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-[11px] font-mono text-slate-300 shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 border border-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" />
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>EARTH 384,400 km · radio delay 1.3 s</span>
          </div>
        </div>

        {/* Right: Audio toggle & Skip Moon Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            data-testid="moon-skip-btn"
            onClick={onSkip}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-mono transition-colors cursor-pointer shadow-lg"
          >
            Skip Moon →
          </button>
        </div>
      </div>

      {/* BEACON arrow pointing to nearest unfound relic (always on when unfound relic exists) */}
      <div
        ref={beaconRef}
        data-testid="moon-beacon"
        className="absolute pointer-events-none z-30 flex flex-col items-center justify-center"
        style={{
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '50px',
        }}
      >
        <div
          ref={beaconArrowRef}
          className="flex items-center justify-center mb-0.5"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.85)]">
            <polygon points="12,2 22,20 12,15 2,20" fill="currentColor" />
          </svg>
        </div>
        <span className="text-[9px] font-mono font-bold text-cyan-300 tracking-wider bg-slate-950/85 px-1.5 py-0.5 rounded border border-cyan-500/40 shadow-md">
          BEACON
        </span>
      </div>

      {/* Relic Found Toast */}
      {toast && (
        <div
          data-testid="moon-relic-toast"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-cyan-500/90 text-slate-950 font-bold font-mono text-sm shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-in fade-in zoom-in-95 pointer-events-none"
        >
          {toast}
        </div>
      )}

      {/* Nova Dialogue Overlay */}
      {novaDialogue && (
        <div className="absolute bottom-20 left-4 right-4 max-w-xl mx-auto z-40 pointer-events-auto">
          <NovaDialogue
            text={novaDialogue.text}
            actionLabel={novaDialogue.actionLabel}
            onAction={novaDialogue.onAction}
            onDismiss={() => showDialogue(null)}
          />
        </div>
      )}

      {/* Real MiniGame for Luna 9 & Apollo 11, STUB MiniGame for Relic 3 */}
      {activeRelic && activeRelic.id === 'moon_luna9' && (
        <LunaSoftLandingGame
          onSuccess={() => handleRelicLogged(activeRelic.id)}
          onClose={() => setActiveRelic(null)}
        />
      )}

      {activeRelic && activeRelic.id === 'moon_apollo11' && (
        <ApolloLaserPingGame
          onSuccess={() => handleRelicLogged(activeRelic.id)}
          onClose={() => setActiveRelic(null)}
        />
      )}

      {activeRelic && activeRelic.id === 'moon_lunokhod1' && (
        <LunokhodLostRoverGame
          onSuccess={() => handleRelicLogged(activeRelic.id)}
          onClose={() => setActiveRelic(null)}
        />
      )}

      {/* Full-Screen CSS Earthrise Panel */}
      {showEarthrise && (
        <EarthrisePanel onContinue={onComplete} reduceMotion={reduceMotion} />
      )}

      {/* Desktop Interaction Prompt Pill */}
      {(nearbyRelic || nearbyMonument || nearbyRock || nearbyThumper || nearbySecret || nearbyIce || canPetNova || nearbyRover || isDrivingRover) && !novaDialogue && !activeRelic && !showEarthrise && (
        <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-30 items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/60 text-xs font-mono font-bold shadow-xl pointer-events-none">
          <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-cyan-400 shadow">E</kbd>
          {isDrivingRover ? (
            <span className="text-amber-400">Dismount Lunar Rover (LRV)</span>
          ) : nearbyRelic ? (
            <span className="text-cyan-300">Interact with {nearbyRelic.name}</span>
          ) : nearbyMonument ? (
            <span className="text-amber-300">{nearbyMonument.name} · {nearbyMonument.interactionPrompt.replace(/^\[E\]\s*/, '')}</span>
          ) : nearbyRock ? (
            <span className="text-emerald-300">{nearbyRock.name} · Sample Specimen</span>
          ) : nearbyThumper ? (
            <span className="text-amber-300">ALSEP Active Seismic Experiment · Detonate Thumper</span>
          ) : nearbyRover ? (
            <span className="text-amber-300">Drive Apollo Lunar Rover (LRV)</span>
          ) : nearbySecret ? (
            <span className="text-amber-300">{nearbySecret.name} · {nearbySecret.interactionPrompt.replace(/^\[E\]\s*/, '')}</span>
          ) : nearbyIce ? (
            <span className="text-sky-300">Scan {nearbyIce.name}</span>
          ) : canPetNova ? (
            <span className="text-rose-300">Pet Nova (Purr in 1/6th G)</span>
          ) : null}
        </div>
      )}

      {/* Mobile Touch Controls */}
      <div className="sm:hidden absolute bottom-4 left-4 right-4 z-50 flex items-end justify-between pointer-events-none">
        
        {/* Virtual D-Pad */}
        <div data-testid="virtual-dpad" className="flex flex-col items-center pointer-events-auto">
          <button
            onPointerDown={() => { touchStateRef.current.up = true; }}
            onPointerUp={() => { touchStateRef.current.up = false; }}
            onPointerLeave={() => { touchStateRef.current.up = false; }}
            className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
          >
            ▲
          </button>
          <div className="flex gap-2 my-1">
            <button
              onPointerDown={() => { touchStateRef.current.left = true; }}
              onPointerUp={() => { touchStateRef.current.left = false; }}
              onPointerLeave={() => { touchStateRef.current.left = false; }}
              className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
            >
              ◀
            </button>
            <button
              onPointerDown={() => { touchStateRef.current.down = true; }}
              onPointerUp={() => { touchStateRef.current.down = false; }}
              onPointerLeave={() => { touchStateRef.current.down = false; }}
              className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
            >
              ▼
            </button>
            <button
              onPointerDown={() => { touchStateRef.current.right = true; }}
              onPointerUp={() => { touchStateRef.current.right = false; }}
              onPointerLeave={() => { touchStateRef.current.right = false; }}
              className="w-11 h-11 rounded-lg bg-slate-900/80 border border-slate-700 active:bg-cyan-900 text-slate-200 flex items-center justify-center font-bold"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Action Buttons: Touch HOP Button (>= 48px) & Context Buttons (Max 2 in range) */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
          {(() => {
            const contextBtns: React.ReactNode[] = [];

            if (isDrivingRover) {
              contextBtns.push(
                <button
                  key="dismount-rover"
                  data-testid="touch-dismount-rover-btn"
                  onClick={dismountRover}
                  className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-500 active:bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer flex items-center justify-center text-center"
                >
                  [E] DISMOUNT ROVER
                </button>
              );
            } else {
              if (nearbyRelic) {
                contextBtns.push(
                  <button
                    key="relic"
                    data-testid="touch-interact-btn"
                    onClick={() => {
                      if (isDrivingRoverRef.current) {
                        dismountRover();
                      }
                      triggerRelicInteract(nearbyRelic);
                    }}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-cyan-400 active:bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] LOG RELIC
                  </button>
                );
              }

              if (nearbyRover) {
                contextBtns.push(
                  <button
                    key="board-rover"
                    data-testid="touch-board-rover-btn"
                    onClick={boardRover}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] BOARD ROVER
                  </button>
                );
              }

              if (nearbyMonument) {
                contextBtns.push(
                  <button
                    key="monument"
                    data-testid="touch-monument-btn"
                    onClick={() => {
                      if (isDrivingRoverRef.current) {
                        dismountRover();
                      }
                      triggerMonumentInteract(nearbyMonument);
                    }}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    {nearbyMonument.interactionPrompt}
                  </button>
                );
              }

              if (nearbyRock) {
                contextBtns.push(
                  <button
                    key="rock"
                    data-testid="touch-rock-btn"
                    onClick={() => {
                      if (isDrivingRoverRef.current) {
                        dismountRover();
                      }
                      triggerRockSample(nearbyRock);
                    }}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-emerald-400 active:bg-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] SAMPLE ROCK
                  </button>
                );
              }

              if (nearbyThumper) {
                contextBtns.push(
                  <button
                    key="thumper"
                    data-testid="touch-thumper-btn"
                    onClick={() => {
                      if (isDrivingRoverRef.current) {
                        dismountRover();
                      }
                      triggerSeismicThumper();
                    }}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] FIRE THUMPER
                  </button>
                );
              }

              if (nearbySecret) {
                contextBtns.push(
                  <button
                    key="secret"
                    data-testid="touch-secret-btn"
                    onClick={() => triggerSecretInteract(nearbySecret)}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] {nearbySecret.id === 'secret_golf_ball' ? 'SWING 6-IRON' : nearbySecret.id === 'secret_orange_glass' ? 'SAMPLE SOIL' : 'INSPECT FLAG'}
                  </button>
                );
              }

              if (nearbyIce) {
                contextBtns.push(
                  <button
                    key="ice"
                    data-testid="touch-ice-btn"
                    onClick={() => triggerIceScan(nearbyIce)}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-sky-400 active:bg-sky-300 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    [E] SCAN WATER ICE
                  </button>
                );
              }

              if (canPetNova) {
                contextBtns.push(
                  <button
                    key="pet"
                    data-testid="touch-pet-btn"
                    onClick={triggerPetNova}
                    className="min-h-[48px] min-w-[48px] px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-rose-500 active:bg-rose-400 text-slate-950 shadow-[0_0_20px_rgba(244,63,94,0.6)] cursor-pointer flex items-center justify-center text-center"
                  >
                    🐾 [E] PET NOVA
                  </button>
                );
              }
            }

            return contextBtns.slice(0, 2);
          })()}

          <button
            data-testid="moon-hop-btn"
            onClick={startHop}
            disabled={isHopping || isDrivingRover}
            className={`w-14 h-14 min-w-[48px] min-h-[48px] rounded-2xl flex flex-col items-center justify-center border font-mono text-[10px] font-bold shadow-lg transition-transform active:scale-95 cursor-pointer ${
              !isHopping && !isDrivingRover
                ? 'bg-cyan-500 active:bg-cyan-400 border-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                : 'bg-slate-900/80 border-slate-800 text-slate-500'
            }`}
          >
            <span className="text-sm">✦</span>
            <span>HOP</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Full-screen CSS Earthrise Panel
 * Stars, Earth rising over a grey horizon (~4s), "Transit to Mars..." text, and Continue button
 */
const EarthrisePanel: React.FC<{ onContinue: () => void; reduceMotion: boolean }> = ({
  onContinue,
  reduceMotion,
}) => {
  useEffect(() => {
    sound.playEarthriseChime();
  }, []);

  return (
    <div
      data-testid="moon-earthrise"
      onClick={onContinue}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 sm:p-12 bg-[#03060d] text-slate-100 overflow-hidden select-none cursor-pointer"
    >
      {/* Background Starfield (CSS pure) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#03060d] to-black opacity-95 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Transit to Mars...</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Trans-Mars Injection Sequence Initiated
        </div>
      </div>

      {/* Earth Rising Over Grey Horizon */}
      <div className="relative z-10 w-full max-w-xl h-80 flex flex-col items-center justify-end overflow-hidden">
        {/* Earth Atmospheric Outer Glow */}
        <div
          className={`absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none ${
            reduceMotion ? '' : 'animate-[earthrise_4s_cubic-bezier(0.2,0.8,0.2,1)_forwards]'
          }`}
          style={{
            transform: reduceMotion ? 'translateY(10px)' : undefined,
          }}
        />

        {/* Earth Orb with Realistic Atmosphere & Swirling Clouds */}
        <div
          className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-blue-950 via-sky-600 to-cyan-300 shadow-[0_0_60px_rgba(56,189,248,0.7)] border border-cyan-400/50 overflow-hidden ${
            reduceMotion ? '' : 'animate-[earthrise_4s_cubic-bezier(0.2,0.8,0.2,1)_forwards]'
          }`}
          style={{
            transform: reduceMotion ? 'translateY(10px)' : undefined,
          }}
        >
          {/* Swirling Cloud Bands */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent mix-blend-overlay" />
          <div className="absolute -top-4 -left-6 w-32 h-16 rounded-full bg-white/20 blur-sm rotate-12" />
          <div className="absolute top-12 left-2 w-28 h-12 rounded-full bg-white/25 blur-sm -rotate-6" />
          {/* Terminator Shadow Curve */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-950/40 to-slate-950/90" />
        </div>

        {/* Grey Lunar Horizon with Crater Rim Silhouette */}
        <div className="w-[140%] h-32 rounded-t-[50%] bg-gradient-to-t from-slate-950 via-slate-800 to-slate-700 border-t-2 border-slate-500/60 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] -mt-16 z-10" />
      </div>

      {/* Footer & Continue Button */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <p className="text-xs sm:text-sm text-slate-400 font-mono text-center max-w-md">
          Three relics logged! Next stop: Mars.
        </p>

        <button
          data-testid="moon-earthrise-continue"
          onClick={onContinue}
          className="px-8 py-3.5 min-h-[48px] rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold font-mono text-sm tracking-wide shadow-lg shadow-cyan-500/30 cursor-pointer transition-transform active:scale-95"
        >
          Continue to Mars →
        </button>
      </div>

      <style>{`
        @keyframes earthrise {
          0% { transform: translateY(140px); opacity: 0.3; }
          40% { opacity: 1; }
          100% { transform: translateY(10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
