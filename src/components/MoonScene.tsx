import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { atlas } from '../render/atlas';
import { sound } from '../systems/audio';
import { isReduceMotionEnabled, saveProgress, getSavedProgress, GameProgress } from '../systems/saveManager';
import { isDebugMode } from '../systems/debug';
import { getMoonMapData, RelicDef, SecretDef, PSRArea, IceDepositDef } from '../data/moonMap';
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

  // Nova Companion state (with 1/6th gravity cat physics)
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
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    setActiveRelic(null);
    setToast(`RELIC ${nextRelics.length}/3`);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }

      heldKeysRef.current.add(e.code);

      // Space starts hop
      if (e.code === 'Space' && !isHoppingRef.current && hopCooldownRef.current <= 0 && !activeRelicRef.current && !showEarthriseRef.current) {
        startHop();
      }

      // E or Enter triggers interaction
      if ((e.code === 'KeyE' || e.code === 'Enter') && !activeRelicRef.current && !showEarthriseRef.current) {
        if (novaDialogueRef.current?.onAction) {
          novaDialogueRef.current.onAction();
        } else if (novaDialogueRef.current) {
          showDialogue(null);
        } else {
          const p = playerRef.current;
          const nr = nearbyRelicRef.current || mapData.relics.find((r) => Math.hypot(p.x - (r.tileX * TILE_SIZE + 8), p.y - (r.tileY * TILE_SIZE + 8)) <= 36);
          if (nr) {
            triggerRelicInteract(nr);
          } else {
            const ns = nearbySecretRef.current || mapData.secrets.find((s) => Math.hypot(p.x - (s.tileX * TILE_SIZE + 8), p.y - (s.tileY * TILE_SIZE + 8)) <= 36);
            if (ns) {
              triggerSecretInteract(ns);
            } else {
              const ni = nearbyIceRef.current || mapData.iceDeposits.find((ice) => Math.hypot(p.x - (ice.tileX * TILE_SIZE + 8), p.y - (ice.tileY * TILE_SIZE + 8)) <= 32);
              if (ni) {
                triggerIceScan(ni);
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
  }, [mapData, showDialogue, startHop, triggerRelicInteract, triggerSecretInteract, triggerIceScan]);

  // Main 60fps Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const player = playerRef.current;
      const keys = heldKeysRef.current;
      const touch = touchStateRef.current;

      // 1. Process Hop Cooldown
      if (hopCooldownRef.current > 0) {
        hopCooldownRef.current = Math.max(0, hopCooldownRef.current - dt);
      }

      // 2. Process Movement
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
      let currentTx = Math.floor(player.x / TILE_SIZE);
      let currentTy = Math.floor(player.y / TILE_SIZE);
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

      // Smooth Camera Follow
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;

      // 3. Nova Companion Follower & 1/6th Gravity Physics Logic
      const nova = novaRef.current;
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

      if (distToPlayer > 18) {
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

    // Apply integer zoom & camera transform
    ctx.scale(MOON_CAMERA_ZOOM, MOON_CAMERA_ZOOM);
    ctx.translate(-Math.round(viewLeft), -Math.round(viewTop));

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
      // Elevated dust particle
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
      ctx.globalAlpha = 1.0;
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
    let hopLift = 0;
    if (isHoppingRef.current) {
      const hopProgress = Math.max(0, Math.min(1, 1 - hopTimerRef.current / HOP_AIRTIME));
      hopLift = Math.sin(hopProgress * Math.PI) * 20;
    }
    const headX = player.x;
    const headY = player.y - 18 - hopLift;
    const currentFlashlightAngle = flashlightAngleRef.current;
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

    // 6. Draw Nova Companion (with 1/6th gravity float & leaps)
    const nova = novaRef.current;
    const novaFrame = nova.isMoving ? Math.floor(nova.walkFrame) % 4 : 0;
    const novaSprite = nova.isMoving ? `nova_walk_${nova.facing}_${novaFrame}` : `nova_idle_${nova.facing}`;
    const novaLift = nova.isHopping ? nova.hopLift : (nova.floatOffset || 0);

    const novaShadowScale = Math.max(0.4, 1 - Math.abs(novaLift) / 18);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(Math.round(nova.x), Math.round(nova.y), 7 * novaShadowScale, 3 * novaShadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    atlas.drawSprite(ctx, novaSprite, Math.round(nova.x - 13), Math.round(nova.y - 24 - novaLift), 26, 26);

    // Subtle Nova visor reflection glow
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(Math.round(nova.x - 2), Math.round(nova.y - 20 - novaLift), 4, 2);

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
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-default" />

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
      {(nearbyRelic || nearbySecret || nearbyIce) && !novaDialogue && !activeRelic && !showEarthrise && (
        <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-30 items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/60 text-xs font-mono font-bold shadow-xl pointer-events-none">
          <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-cyan-400 shadow">E</kbd>
          {nearbyRelic ? (
            <span className="text-cyan-300">Interact with {nearbyRelic.name}</span>
          ) : nearbySecret ? (
            <span className="text-amber-300">{nearbySecret.name} · {nearbySecret.interactionPrompt.replace(/^\[E\]\s*/, '')}</span>
          ) : nearbyIce ? (
            <span className="text-sky-300">Scan {nearbyIce.name}</span>
          ) : null}
        </div>
      )}

      {/* Mobile Touch Controls */}
      <div className="sm:hidden absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
        
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

        {/* Action Buttons: Touch HOP Button (>= 48px) & Interact */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {nearbyRelic && (
            <button
              data-testid="touch-interact-btn"
              onClick={() => triggerRelicInteract(nearbyRelic)}
              className="px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-cyan-400 active:bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer"
            >
              [E] LOG RELIC
            </button>
          )}

          {nearbySecret && !nearbyRelic && (
            <button
              data-testid="touch-secret-btn"
              onClick={() => triggerSecretInteract(nearbySecret)}
              className="px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-amber-400 active:bg-amber-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer"
            >
              [E] {nearbySecret.id === 'secret_golf_ball' ? 'SWING 6-IRON' : nearbySecret.id === 'secret_orange_glass' ? 'SAMPLE SOIL' : 'INSPECT FLAG'}
            </button>
          )}

          {nearbyIce && !nearbyRelic && !nearbySecret && (
            <button
              data-testid="touch-ice-btn"
              onClick={() => triggerIceScan(nearbyIce)}
              className="px-5 py-3 rounded-2xl font-bold font-mono text-xs bg-sky-400 active:bg-sky-300 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.6)] cursor-pointer"
            >
              [E] SCAN WATER ICE
            </button>
          )}

          <button
            data-testid="moon-hop-btn"
            onClick={startHop}
            disabled={isHopping}
            className={`w-14 h-14 min-w-[48px] min-h-[48px] rounded-2xl flex flex-col items-center justify-center border font-mono text-[10px] font-bold shadow-lg transition-transform active:scale-95 cursor-pointer ${
              !isHopping
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
