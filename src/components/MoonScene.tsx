import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { atlas } from '../render/atlas';
import { sound } from '../systems/audio';
import { isReduceMotionEnabled, saveProgress, getSavedProgress, GameProgress } from '../systems/saveManager';
import { isDebugMode } from '../systems/debug';
import { getMoonMapData, RelicDef } from '../data/moonMap';
import { MiniGameShell } from './MiniGames/MiniGameShell';
import { LunaSoftLandingGame } from './MiniGames/LunaSoftLandingGame';
import { NovaDialogue } from './NovaDialogue';
import { Volume2, VolumeX, Radio } from 'lucide-react';

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

  const [activeRelic, setActiveRelic] = useState<RelicDef | null>(null);
  const activeRelicRef = useRef(activeRelic);
  activeRelicRef.current = activeRelic;

  const [showEarthrise, setShowEarthrise] = useState(false);
  const showEarthriseRef = useRef(showEarthrise);
  showEarthriseRef.current = showEarthrise;

  // Nearby Relic for UI prompt
  const [nearbyRelic, setNearbyRelic] = useState<RelicDef | null>(null);
  const nearbyRelicRef = useRef(nearbyRelic);
  nearbyRelicRef.current = nearbyRelic;
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

  // Nova Companion state
  const novaRef = useRef({
    x: mapData.startTile.x * TILE_SIZE - 8,
    y: mapData.startTile.y * TILE_SIZE + 12,
    facing: 'right' as 'up' | 'down' | 'left' | 'right',
    isMoving: false,
    walkFrame: 0,
    trail: [] as { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' }[],
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
        setNovaDialogue(null);
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
  }, [mapData]);

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
        } else {
          setNovaDialogue(null);
          const p = playerRef.current;
          const nr = nearbyRelicRef.current || mapData.relics.find((r) => Math.hypot(p.x - (r.tileX * TILE_SIZE + 8), p.y - (r.tileY * TILE_SIZE + 8)) <= 36);
          if (nr) {
            triggerRelicInteract(nr);
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
  }, [activeRelic, showEarthrise, novaDialogue, nearbyRelic]);

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
    sound.playClick();
  }, []);

  // Interact with Relic
  const triggerRelicInteract = useCallback((relic: RelicDef) => {
    sound.playClick();
    const alreadyFound = relicIdsRef.current.includes(relic.id);

    if (alreadyFound) {
      setNovaDialogue({
        text: relic.replayLine,
      });
      return;
    }

    setNovaDialogue({
      text: relic.oneLineHint,
      actionLabel: 'Log Relic →',
      onAction: () => {
        setNovaDialogue(null);
        setActiveRelic(relic);
      },
    });
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
        completed: false,
        rpApplied: false,
      },
    };
    saveProgress(updated, true);

    setActiveRelic(null);
    setToast(`RELIC ${nextRelics.length}/3`);
    setTimeout(() => setToast(null), 2500);

    if (nextRelics.length >= 3) {
      setTimeout(() => {
        setNovaDialogue({
          text: 'All three lunar relics logged! Look, Earth is rising ahead!',
          actionLabel: 'Observe Earthrise →',
          onAction: () => {
            setNovaDialogue(null);
            setShowEarthrise(true);
          },
        });
      }, 500);
    }
  }, []);

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
            player.x = lastSafeGroundRef.current.x;
            player.y = lastSafeGroundRef.current.y;
            setNovaDialogue({
              text: 'Whoa! Low gravity hop fell short. Back to safety!',
            });
            setTimeout(() => {
              setNovaDialogue((prev) => (prev?.text.includes('short') ? null : prev));
            }, 3000);
            sound.playMistake();
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
          player.x = lastSafeGroundRef.current.x;
          player.y = lastSafeGroundRef.current.y;
          currentTx = Math.floor(player.x / TILE_SIZE);
          currentTy = Math.floor(player.y / TILE_SIZE);
          setNovaDialogue({
            text: 'Whoa! Low gravity hop fell short. Back to safety!',
          });
          sound.playMistake();
        }
      }

      setCurrentTile(`${currentTx},${currentTy}`);

      // Smooth Camera Follow
      cameraRef.current.x += (player.x - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (player.y - cameraRef.current.y) * 0.1;

      // 3. Nova Companion Follower Logic
      const nova = novaRef.current;
      const lastTrail = nova.trail[nova.trail.length - 1];
      if (!lastTrail || Math.hypot(player.x - lastTrail.x, player.y - lastTrail.y) > 6) {
        nova.trail.push({ x: player.x, y: player.y, facing: player.facing });
        if (nova.trail.length > 20) nova.trail.shift();
      }

      const distToPlayer = Math.hypot(player.x - nova.x, player.y - nova.y);
      if (distToPlayer > 18) {
        const target = nova.trail.length > 0 ? nova.trail[0] : player;
        const dx = target.x - nova.x;
        const dy = target.y - nova.y;
        const d = Math.hypot(dx, dy);
        if (d > 3) {
          nova.x += (dx / d) * WALK_SPEED * dt * 1.05;
          nova.y += (dy / d) * WALK_SPEED * dt * 1.05;
          nova.isMoving = true;
          nova.walkFrame += dt * 8;
          if (Math.abs(dx) > Math.abs(dy)) nova.facing = dx > 0 ? 'right' : 'left';
          else nova.facing = dy > 0 ? 'down' : 'up';
        } else if (nova.trail.length > 1) {
          nova.trail.shift();
        }
      } else {
        nova.isMoving = false;
        nova.walkFrame = 0;
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
      const minCamY = viewWorldH / 2;
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

          // Edge highlights for 3D crater rim look (no horizontal scanline stripes)
          const hasGroundNorth = ty > 0 && mapData.tiles[ty - 1]?.[tx] !== '#';
          const hasGroundWest = tx > 0 && mapData.tiles[ty]?.[tx - 1] !== '#';
          const hasGroundSouth = ty < mapData.height - 1 && mapData.tiles[ty + 1]?.[tx] !== '#';
          const hasGroundEast = tx < mapData.width - 1 && mapData.tiles[ty]?.[tx + 1] !== '#';

          if (hasGroundNorth || hasGroundWest || hasGroundSouth || hasGroundEast) {
            ctx.save();
            if (hasGroundNorth) {
              ctx.fillStyle = '#8a97a8';
              ctx.fillRect(px, py, TILE_SIZE, 2);
              ctx.fillStyle = '#4c5767';
              ctx.fillRect(px, py + 2, TILE_SIZE, 1);
            }
            if (hasGroundWest) {
              ctx.fillStyle = '#728091';
              ctx.fillRect(px, py, 2, TILE_SIZE);
            }
            if (hasGroundSouth) {
              ctx.fillStyle = '#0c1017';
              ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
            }
            if (hasGroundEast) {
              ctx.fillStyle = '#10141b';
              ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
            }
            ctx.restore();
          }
        } else if (ch === '~') {
          atlas.drawSprite(ctx, 'tile_moon_pit', px, py, TILE_SIZE, TILE_SIZE);

          // Lit crater rim and rounded inner bowl
          const pitNorthGround = ty > 0 && mapData.tiles[ty - 1]?.[tx] === '.';
          const pitSouthGround = ty < mapData.height - 1 && mapData.tiles[ty + 1]?.[tx] === '.';
          const pitWestGround = tx > 0 && mapData.tiles[ty]?.[tx - 1] === '.';
          const pitEastGround = tx < mapData.width - 1 && mapData.tiles[ty]?.[tx + 1] === '.';

          ctx.save();
          if (pitNorthGround) {
            ctx.fillStyle = '#647285';
            ctx.fillRect(px, py, TILE_SIZE, 2);
            ctx.fillStyle = '#070a12';
            ctx.fillRect(px, py + 2, TILE_SIZE, 2);
          }
          if (pitWestGround) {
            ctx.fillStyle = '#525e6f';
            ctx.fillRect(px, py, 2, TILE_SIZE);
          }
          if (pitSouthGround) {
            ctx.fillStyle = '#0d131f';
            ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
          }
          if (pitEastGround) {
            ctx.fillStyle = '#0f1624';
            ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
          }
          if (pitNorthGround && pitWestGround) {
            ctx.fillStyle = '#5a6270';
            ctx.fillRect(px, py, 3, 3);
          }
          if (pitNorthGround && pitEastGround) {
            ctx.fillStyle = '#4a5360';
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

    // 4. Draw Lunar Lander at Start
    const landerX = mapData.startTile.x * TILE_SIZE - 8;
    const landerY = mapData.startTile.y * TILE_SIZE - 12;
    atlas.drawSprite(ctx, 'wreck_phoenix', landerX, landerY, 32, 32);

    // 5. Draw 3 Relic Sites
    for (const relic of mapData.relics) {
      const rx = relic.tileX * TILE_SIZE - 10;
      const ry = relic.tileY * TILE_SIZE - 10;
      const isClaimed = relicIdsRef.current.includes(relic.id);

      // Render relic placeholder sprite
      atlas.drawSprite(ctx, relic.placeholderSprite, rx, ry, 36, 36);

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

    // 6. Draw Nova Companion
    const nova = novaRef.current;
    const novaFrame = nova.isMoving ? Math.floor(nova.walkFrame) % 4 : 0;
    const novaSprite = nova.isMoving ? `nova_walk_${nova.facing}_${novaFrame}` : `nova_idle_${nova.facing}`;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(Math.round(nova.x), Math.round(nova.y), 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    atlas.drawSprite(ctx, novaSprite, Math.round(nova.x - 13), Math.round(nova.y - 24), 26, 26);

    // 7. Draw Astronaut Player
    const player = playerRef.current;
    const pFrame = player.isMoving ? Math.floor(player.walkFrame) % 4 : 0;
    const pSprite = player.isMoving ? `player_walk_${player.facing}_${pFrame}` : `player_idle_${player.facing}`;

    // Sine vertical lift during hop
    let hopLift = 0;
    if (isHoppingRef.current) {
      const hopProgress = Math.max(0, Math.min(1, 1 - hopTimerRef.current / HOP_AIRTIME));
      hopLift = Math.sin(hopProgress * Math.PI) * 20;
    }

    // Ground shadow (drawn at ground level)
    const shadowScale = isHoppingRef.current ? Math.max(0.4, 1 - hopLift / 30) : 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.round(player.x), Math.round(player.y), 8 * shadowScale, 3.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player sprite (lifted on sine arc, 28 world px -> 56 CSS px under ZOOM 2)
    atlas.drawSprite(ctx, pSprite, Math.round(player.x - 10), Math.round(player.y - 27 - hopLift), 20, 28);

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
        <div className="flex items-center gap-3 pointer-events-auto">
          <div
            data-testid="moon-relic-counter"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300 shadow-lg"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Relics {relicIds.length}/3</span>
          </div>

          {/* Earth Radio Distance Chip */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-400 shadow-md">
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-cyan-500/90 text-slate-950 font-bold font-mono text-sm shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-in fade-in zoom-in-95 pointer-events-none">
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
            onDismiss={() => setNovaDialogue(null)}
          />
        </div>
      )}

      {/* Real MiniGame for Luna 9, STUB MiniGame for Relics 2 & 3 */}
      {activeRelic && activeRelic.id === 'moon_luna9' && (
        <LunaSoftLandingGame
          onSuccess={() => handleRelicLogged(activeRelic.id)}
          onClose={() => setActiveRelic(null)}
        />
      )}

      {activeRelic && activeRelic.id !== 'moon_luna9' && (
        <MiniGameShell
          wreckId={activeRelic.id}
          title={activeRelic.name}
          instruction="Hold the sensor calibration trigger for 1.5s to log relic telemetry."
          winTitle="RELIC LOGGED!"
          claimLabel="Log Relic ->"
          onWin={() => handleRelicLogged(activeRelic.id)}
          onExit={() => setActiveRelic(null)}
        >
          {({ win }) => (
            <RelicStubMiniGame onComplete={() => win({ stars: 3 })} />
          )}
        </MiniGameShell>
      )}

      {/* Full-Screen CSS Earthrise Panel */}
      {showEarthrise && (
        <EarthrisePanel onContinue={onComplete} reduceMotion={reduceMotion} />
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
 * Stub MiniGame Child
 * Hold button for 1.5s to fill bar, then calls onComplete -> win({ stars: 3 })
 */
const RelicStubMiniGame: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!holding || completedRef.current) {
      if (!completedRef.current) setProgress(0);
      startTimeRef.current = null;
      return;
    }

    startTimeRef.current = performance.now();

    const interval = setInterval(() => {
      if (!startTimeRef.current || completedRef.current) return;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const p = Math.min(100, (elapsed / 1.5) * 100);
      setProgress(p);

      if (p >= 100) {
        completedRef.current = true;
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [holding]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 select-none">
      <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
        Telemetry Receiver Tuning
      </div>

      <div className="w-64 h-5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
        <div
          data-testid="relic-stub-progress"
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        data-testid="relic-stub-hold-btn"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        className="px-6 py-4 min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-400 text-white font-mono font-bold select-none cursor-pointer shadow-lg shadow-cyan-600/30 transition-transform active:scale-95"
      >
        Hold to Scan & Log (1.5s)
      </button>
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
  return (
    <div
      data-testid="moon-earthrise"
      onClick={onContinue}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 sm:p-12 bg-[#03060d] text-slate-100 overflow-hidden select-none cursor-pointer"
    >
      {/* Background Starfield (CSS pure) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#03060d] to-black opacity-90 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span>Transit to Mars...</span>
      </div>

      {/* Earth Rising Over Grey Horizon */}
      <div className="relative z-10 w-full max-w-xl h-80 flex flex-col items-center justify-end overflow-hidden">
        {/* Earth Orb */}
        <div
          className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-blue-900 via-sky-600 to-cyan-300 shadow-[0_0_60px_rgba(56,189,248,0.6)] border border-cyan-400/40 ${
            reduceMotion ? '' : 'animate-[earthrise_4s_cubic-bezier(0.2,0.8,0.2,1)_forwards]'
          }`}
          style={{
            transform: reduceMotion ? 'translateY(10px)' : undefined,
          }}
        />

        {/* Grey Lunar Horizon */}
        <div className="w-[140%] h-32 rounded-t-[50%] bg-gradient-to-t from-slate-950 via-slate-800 to-slate-700 border-t-2 border-slate-500/60 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] -mt-16 z-10" />
      </div>

      {/* Footer & Continue Button */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <p className="text-xs sm:text-sm text-slate-400 font-mono text-center max-w-md">
          Lunar telemetry compiled. Trajectory vector locked for interplanetary transit.
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
