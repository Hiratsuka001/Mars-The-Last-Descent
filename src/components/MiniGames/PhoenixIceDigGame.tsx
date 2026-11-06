import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../../systems/debug';
import { Snowflake, Clock, AlertTriangle, ShieldCheck, Flame, Sparkles, ArrowDown, ChevronRight } from 'lucide-react';

interface PhoenixIceDigGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface RockObstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
  hit: boolean;
}

interface IceChunk {
  id: number;
  x: number;
  y: number;
  origX: number;
  origY: number;
  radius: number;
  bagged: boolean;
  evaporated: boolean;
  isAutoFlying?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  isSteam?: boolean;
}

export const PhoenixIceDigGame: React.FC<PhoenixIceDigGameProps> = ({
  wreckId = 'eq_phoenix',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Arctic permafrost detected. Subsurface sensors active.'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Fresh arctic drill site selected.');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="Dig for Ice"
      instruction="Dig down to the ice, then bag it fast!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <PhoenixContent
          key={retryNonce}
          onWinTrigger={win}
          onFailTrigger={fail}
          onReactionChange={setReactionText}
          assistActive={assistActive}
        />
      )}
    </MiniGameShell>
  );
};

export default PhoenixIceDigGame;

interface PhoenixContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 280;

// Cooler chute target coordinates
const COOLER_X = 510;
const COOLER_Y = 16;
const COOLER_W = 118;
const COOLER_H = 50;

export const PhoenixContent: React.FC<PhoenixContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [phase, setPhase] = useState<'digging' | 'sublimating' | 'won' | 'failed'>('digging');
  const [depthPercent, setDepthPercent] = useState(0);
  const [baggedCount, setBaggedCount] = useState(0);
  const [sublimationTimeLeft, setSublimationTimeLeft] = useState(assistActive ? 6.5 : 4.2);
  const [rockHitCount, setRockHitCount] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const phaseRef = useRef<'digging' | 'sublimating' | 'won' | 'failed'>('digging');
  phaseRef.current = phase;

  // Scoop position & dragging
  const scoopPosRef = useRef({ x: 320, y: 35 });
  const isScoopDraggingRef = useRef(false);
  const pointerStartRef = useRef({ canvasX: 0, canvasY: 0, scoopOrigX: 320, scoopOrigY: 35 });

  // Depth tracking (surface y=35 is 0%, ice layer y=215 is 100%)
  const maxDepthYRef = useRef(35);
  const depthPctRef = useRef(0);

  // Rock obstacles (fairly spaced with safe channels)
  const rocksRef = useRef<RockObstacle[]>([
    { id: 1, x: 195, y: 82, radius: 18, hit: false },
    { id: 2, x: 435, y: 92, radius: 19, hit: false },
    { id: 3, x: 265, y: 142, radius: 21, hit: false },
    { id: 4, x: 475, y: 156, radius: 20, hit: false },
  ]);

  // Stall system (1.0 second lockout on rock collision)
  const stallUntilRef = useRef<number>(0);
  const rockHitsRef = useRef(0);

  // Screen shake
  const shakeRef = useRef(0);

  // Ice chunks for sublimation phase
  const chunksRef = useRef<IceChunk[]>([
    { id: 0, x: 215, y: 208, origX: 215, origY: 208, radius: 16, bagged: false, evaporated: false },
    { id: 1, x: 320, y: 216, origX: 320, origY: 216, radius: 15, bagged: false, evaporated: false },
    { id: 2, x: 425, y: 208, origX: 425, origY: 208, radius: 17, bagged: false, evaporated: false },
  ]);

  const draggedChunkIdRef = useRef<number | null>(null);
  const totalSublimationTime = assistActive ? 6.5 : 4.2;
  const sublimationRemainingRef = useRef(totalSublimationTime);
  const sublimationStartRef = useRef<number | null>(null);

  // Particles (dust, rock chips, steam wisps, sparkles)
  const particlesRef = useRef<Particle[]>([]);

  // Carved trench points for visual trench wall cutaway
  const carvedPointsRef = useRef<Array<{ x: number; y: number }>>([]);

  // Keyboard navigation state
  const keysHeldRef = useRef<Set<string>>(new Set());

  // Spawn visual particles
  const spawnParticles = useCallback(
    (x: number, y: number, count: number, color: string, isSteam = false) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = isSteam ? Math.random() * 0.9 + 0.4 : Math.random() * 2.8 + 0.6;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: isSteam ? -Math.random() * 1.8 - 0.6 : Math.sin(angle) * speed,
          radius: isSteam ? Math.random() * 4.5 + 2.5 : Math.random() * 2.5 + 1,
          color,
          alpha: 1,
          decay: isSteam ? 0.018 + Math.random() * 0.018 : 0.04 + Math.random() * 0.03,
          isSteam,
        });
      }
    },
    []
  );

  // Switch to sublimation climax
  const triggerSublimationPhase = useCallback(() => {
    phaseRef.current = 'sublimating';
    setPhase('sublimating');
    sublimationStartRef.current = Date.now();
    sublimationRemainingRef.current = totalSublimationTime;

    if (!reduceMotion) shakeRef.current = 12;
    sound.playDiscovery();
    onReactionChange('Sub-surface ice reached! Pure water ice exposed.');
    spawnParticles(320, 208, 40, '#bae6fd');
    spawnParticles(320, 208, 25, '#ffffff', true);
  }, [onReactionChange, reduceMotion, spawnParticles, totalSublimationTime]);

  // Handle bag ice chunk
  const bagChunk = useCallback(
    (chunk: IceChunk) => {
      if (chunk.bagged) return;
      chunk.bagged = true;
      chunk.isAutoFlying = false;
      sound.playCollectSample();
      sound.playNovaPurr();
      spawnParticles(COOLER_X + COOLER_W / 2, COOLER_Y + COOLER_H / 2, 25, '#38bdf8');

      const nextBagged = chunksRef.current.filter((c) => c.bagged).length;
      setBaggedCount(nextBagged);

      if (nextBagged >= 3) {
        // Victory!
        phaseRef.current = 'won';
        setPhase('won');

        // Star calculation:
        // 3 stars: 0 rock hits AND chunks bagged with time left
        const stars: 1 | 2 | 3 =
          rockHitsRef.current === 0 && sublimationRemainingRef.current >= 0.5
            ? 3
            : rockHitsRef.current <= 1
            ? 2
            : 1;

        sound.playSuccess();
        onReactionChange(
          'VICTORY! All 3 water ice chunks bagged safely in the cryogenic core before sublimating!'
        );
        onWinTrigger({ stars });
      } else {
        onReactionChange(`Ice chunk bagged! [ ${nextBagged} / 3 ] secured in cryo storage!`);
      }
    },
    [onReactionChange, onWinTrigger, spawnParticles]
  );

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysHeldRef.current.add(e.code);
      setHasInteracted(true);

      // In Phase 2: Space / KeyE auto-bags nearest chunk
      if (phaseRef.current === 'sublimating' && (e.code === 'Space' || e.code === 'KeyE')) {
        e.preventDefault();
        const unbagged = chunksRef.current.find((c) => !c.bagged && !c.evaporated);
        if (unbagged) {
          unbagged.isAutoFlying = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main canvas animation and rendering loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = Date.now();
      const isStalled = now < stallUntilRef.current;

      // Handle keyboard drive during digging phase
      if (phaseRef.current === 'digging' && !isStalled) {
        let dx = 0;
        let dy = 0;
        if (keysHeldRef.current.has('ArrowDown') || keysHeldRef.current.has('KeyS')) dy += 3.2;
        if (keysHeldRef.current.has('ArrowUp') || keysHeldRef.current.has('KeyW')) dy -= 1.8;
        if (keysHeldRef.current.has('ArrowLeft') || keysHeldRef.current.has('KeyA')) dx -= 3.5;
        if (keysHeldRef.current.has('ArrowRight') || keysHeldRef.current.has('KeyD')) dx += 3.5;

        if (dx !== 0 || dy !== 0) {
          const targetX = Math.max(105, Math.min(535, scoopPosRef.current.x + dx));
          const targetY = Math.max(35, Math.min(220, scoopPosRef.current.y + dy));
          scoopPosRef.current = { x: targetX, y: targetY };
          carvedPointsRef.current.push({ x: targetX, y: targetY });

          if (targetY > maxDepthYRef.current) {
            maxDepthYRef.current = targetY;
            const pct = Math.min(100, Math.round(((targetY - 35) / 175) * 100));
            depthPctRef.current = pct;
            setDepthPercent(pct);
            if (pct >= 100) {
              triggerSublimationPhase();
            }
          }
        }
      }

      // Handle auto-flying chunks towards the cooler chute
      if (phaseRef.current === 'sublimating') {
        for (const chunk of chunksRef.current) {
          if (chunk.isAutoFlying && !chunk.bagged) {
            const targetX = COOLER_X + COOLER_W / 2;
            const targetY = COOLER_Y + COOLER_H / 2;
            chunk.x += (targetX - chunk.x) * 0.22;
            chunk.y += (targetY - chunk.y) * 0.22;
            spawnParticles(chunk.x, chunk.y, 2, '#bae6fd');

            if (Math.hypot(chunk.x - targetX, chunk.y - targetY) < 18) {
              bagChunk(chunk);
            }
          }
        }
      }

      // Update screen shake
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - 0.7);
      }
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

      // -------------------------------------------------------------
      // 1. BACKGROUND & 3 SOIL STRATA LAYERS
      // -------------------------------------------------------------
      // Arctic Martian Sky & Surface Horizon (y: 0 -> 25)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 25);
      skyGrad.addColorStop(0, '#1c100d');
      skyGrad.addColorStop(1, '#2f1a14');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, 25);

      // Trench outline guides (x: 80 -> 560, y: 25 -> 265)
      const trenchLeft = 80;
      const trenchRight = 560;
      const trenchW = trenchRight - trenchLeft;

      // Layer 1: Loose Iron Dust Regolith (Depth 0 - 33%, y: 25 -> 95)
      const regolithGrad = ctx.createLinearGradient(0, 25, 0, 95);
      regolithGrad.addColorStop(0, '#9e3d1b');
      regolithGrad.addColorStop(1, '#803215');
      ctx.fillStyle = regolithGrad;
      ctx.fillRect(trenchLeft, 25, trenchW, 70);

      // Layer 2: Frozen Polygonal Permafrost (Depth 33 - 66%, y: 95 -> 175)
      const permaGrad = ctx.createLinearGradient(0, 95, 0, 175);
      permaGrad.addColorStop(0, '#5a3023');
      permaGrad.addColorStop(1, '#44231b');
      ctx.fillStyle = permaGrad;
      ctx.fillRect(trenchLeft, 95, trenchW, 80);

      // Layer 3: Subsurface Cryo-Bedrock & Ice Sheet (Depth 66 - 100%, y: 175 -> 265)
      const iceGrad = ctx.createLinearGradient(0, 175, 0, 265);
      iceGrad.addColorStop(0, '#2e1c24');
      iceGrad.addColorStop(0.35, '#1e293b');
      iceGrad.addColorStop(0.65, '#38bdf8');
      iceGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(trenchLeft, 175, trenchW, 90);

      // Subtle safe lane guide paths (dotted vertical tracks showing clear lanes)
      if (phaseRef.current === 'digging') {
        ctx.save();
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        // Safe channel 1 (x ~ 320 down the center)
        ctx.beginPath();
        ctx.moveTo(320, 35);
        ctx.bezierCurveTo(340, 90, 360, 130, 350, 220);
        ctx.stroke();
        ctx.restore();
      }

      // Strata Division Dotted Lines & Labels
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';

      // Div 1
      ctx.beginPath();
      ctx.moveTo(trenchLeft, 95);
      ctx.lineTo(trenchRight, 95);
      ctx.stroke();

      // Div 2
      ctx.beginPath();
      ctx.moveTo(trenchLeft, 175);
      ctx.lineTo(trenchRight, 175);
      ctx.stroke();
      ctx.setLineDash([]);

      // Short Layer Names in the Left Gutter only (never under chunks or scoop)
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 200, 180, 0.9)';
      ctx.fillText('Dust', 8, 60);
      ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
      ctx.fillText('Frozen soil', 8, 135);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.95)';
      ctx.fillText('ICE', 8, 220);

      // Depth tick marks on left margin
      ctx.fillStyle = '#64748b';
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('0cm', trenchLeft - 4, 35);
      ctx.fillText('5cm', trenchLeft - 4, 95);
      ctx.fillText('10cm', trenchLeft - 4, 175);
      ctx.fillText('15cm', trenchLeft - 4, 235);
      ctx.textAlign = 'left';

      // -------------------------------------------------------------
      // 2. EXCAVATED TRENCH CUTAWAY & CARVED PATH
      // -------------------------------------------------------------
      if (carvedPointsRef.current.length > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 7, 5, 0.85)';
        for (const pt of carvedPointsRef.current) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 24, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 3. ROCK OBSTACLES (Phase 1)
      // -------------------------------------------------------------
      const scoop = scoopPosRef.current;
      for (const rock of rocksRef.current) {
        ctx.save();
        const distToScoop = Math.hypot(scoop.x - rock.x, scoop.y - rock.y);
        const isNear = distToScoop < rock.radius + 40 && phaseRef.current === 'digging';

        // Proximity Warning Ring when scoop approaches rock
        if (isNear) {
          ctx.beginPath();
          ctx.arc(rock.x, rock.y, rock.radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);

        // Gradient for jagged basalt rock
        const rockGrad = ctx.createRadialGradient(
          rock.x - 4,
          rock.y - 4,
          2,
          rock.x,
          rock.y,
          rock.radius
        );
        rockGrad.addColorStop(0, '#524545');
        rockGrad.addColorStop(0.7, '#261e1e');
        rockGrad.addColorStop(1, '#140f0f');
        ctx.fillStyle = rockGrad;
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = rock.hit ? '#ef4444' : isNear ? '#f97316' : '#6b5858';
        ctx.stroke();

        // Craggy internal rock fracture lines
        ctx.beginPath();
        ctx.moveTo(rock.x - rock.radius * 0.5, rock.y);
        ctx.lineTo(rock.x, rock.y - rock.radius * 0.4);
        ctx.lineTo(rock.x + rock.radius * 0.5, rock.y + rock.radius * 0.3);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Caution label on rock
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = isNear ? '#ef4444' : 'rgba(251, 146, 60, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText(isNear ? '⚠ ROCK!' : 'BASALT', rock.x, rock.y + 3);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 4. SUBLIMATION PHASE: ICE CHUNKS, STEAM & COOLER CHUTE
      // -------------------------------------------------------------
      if (phaseRef.current === 'sublimating') {
        const elapsed = (now - (sublimationStartRef.current || now)) / 1000;
        const remaining = Math.max(0, totalSublimationTime - elapsed);
        sublimationRemainingRef.current = remaining;
        setSublimationTimeLeft(remaining);

        // Spawn continuous rising steam wisps from exposed ice chunks
        for (const chunk of chunksRef.current) {
          if (!chunk.bagged && !chunk.evaporated && Math.random() < 0.4) {
            spawnParticles(
              chunk.x + (Math.random() - 0.5) * 16,
              chunk.y - 8,
              1,
              'rgba(240, 249, 255, 0.85)',
              true
            );
          }
        }

        // Check if time expired
        if (remaining <= 0) {
          let allBagged = true;
          for (const chunk of chunksRef.current) {
            if (!chunk.bagged) {
              chunk.evaporated = true;
              allBagged = false;
            }
          }
          if (!allBagged && phaseRef.current === 'sublimating') {
            phaseRef.current = 'failed';
            setPhase('failed');
            sound.playMistake();
            onReactionChange('The ice chunks sublimated into gas!');
            onFailTrigger();
          }
        }
      }

      // Draw Cooler Bag / Refrigerated Chute at Top Right (with magnetic glow)
      ctx.save();
      const isChuteActive = draggedChunkIdRef.current !== null;
      ctx.fillStyle = isChuteActive ? 'rgba(8, 51, 68, 0.98)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = isChuteActive ? '#38bdf8' : '#0ea5e9';
      ctx.lineWidth = isChuteActive ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(COOLER_X, COOLER_Y, COOLER_W, COOLER_H, 12);
      ctx.fill();
      ctx.stroke();

      // Magnetic Glow Field when dragging an ice chunk
      if (isChuteActive) {
        ctx.beginPath();
        ctx.arc(COOLER_X + COOLER_W / 2, COOLER_Y + COOLER_H / 2, 75, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Cooler Label & LED Counter
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('❄ CRYO CHUTE', COOLER_X + 12, COOLER_Y + 18);

      ctx.fillStyle = baggedCount === 3 ? '#4ade80' : '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`🧊 ${baggedCount}/3`, COOLER_X + 12, COOLER_Y + 36);

      if (isChuteActive) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('MAGNETIC PULL', COOLER_X + 12, COOLER_Y + 46);
      }
      ctx.restore();

      // Draw Animated Directional Guidance Arrows in Phase 2
      if (phaseRef.current === 'sublimating') {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(320, 195);
        ctx.quadraticCurveTo(460, 140, COOLER_X + 20, COOLER_Y + 35);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText('DROP ICE HERE ↗', COOLER_X + COOLER_W / 2, COOLER_Y + COOLER_H + 14);
        ctx.restore();
      }

      // Draw Ice Chunks
      if (phaseRef.current === 'sublimating' || phaseRef.current === 'won' || phaseRef.current === 'failed') {
        const shrinkFactor =
          phaseRef.current === 'sublimating'
            ? Math.max(0.2, sublimationRemainingRef.current / totalSublimationTime)
            : phaseRef.current === 'won'
            ? 1
            : 0;

        for (const chunk of chunksRef.current) {
          if (chunk.bagged || chunk.evaporated) continue;

          ctx.save();
          const r = chunk.radius * shrinkFactor;

          // Glowing ice aura
          const auraGrad = ctx.createRadialGradient(chunk.x, chunk.y, 2, chunk.x, chunk.y, r * 2.0);
          auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          auraGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.7)');
          auraGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(chunk.x, chunk.y, r * 2.0, 0, Math.PI * 2);
          ctx.fill();

          // Multi-faceted crystalline ice chunk
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = chunk.x + Math.cos(angle) * r;
            const py = chunk.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = '#f0f9ff';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();

          // Internal crystal facets
          ctx.beginPath();
          ctx.moveTo(chunk.x, chunk.y);
          ctx.lineTo(chunk.x + r * 0.7, chunk.y - r * 0.3);
          ctx.strokeStyle = '#bae6fd';
          ctx.stroke();

          // Friendly interaction hint on each chunk
          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#0284c7';
          ctx.textAlign = 'center';
          ctx.fillText('ICE', chunk.x, chunk.y + 3);

          if (!chunk.isAutoFlying && draggedChunkIdRef.current !== chunk.id) {
            const pulse = (Math.sin(Date.now() / 250) + 1) / 2;
            ctx.beginPath();
            ctx.arc(chunk.x, chunk.y, r + 4 + pulse * 3, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 5. ROBOTIC ARM & SCOOP HEAD (Phase 1 & active tool)
      // -------------------------------------------------------------
      ctx.save();

      // Articulated robotic arm linkage from top pivot (x: 320, y: 10)
      ctx.beginPath();
      ctx.moveTo(320, 10);
      const elbowX = (320 + scoop.x) / 2 + 25;
      const elbowY = (10 + scoop.y) / 2 - 10;
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(scoop.x, scoop.y - 12);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#334155';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#64748b';
      ctx.stroke();

      // Elbow joint
      ctx.beginPath();
      ctx.arc(elbowX, elbowY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Scoop Head Bucket
      const scoopColor = isStalled ? '#ef4444' : '#0284c7';
      ctx.beginPath();
      ctx.arc(scoop.x, scoop.y, 16, Math.PI * 0.1, Math.PI * 0.9);
      ctx.lineWidth = 4;
      ctx.strokeStyle = isStalled ? '#ef4444' : '#94a3b8';
      ctx.stroke();

      // Serrated tungsten digging teeth
      ctx.fillStyle = isStalled ? '#f87171' : '#e2e8f0';
      for (let i = -12; i <= 12; i += 6) {
        ctx.beginPath();
        ctx.moveTo(scoop.x + i - 2, scoop.y + 12);
        ctx.lineTo(scoop.x + i, scoop.y + 18);
        ctx.lineTo(scoop.x + i + 2, scoop.y + 12);
        ctx.fill();
      }

      // Digging motor hub
      ctx.beginPath();
      ctx.arc(scoop.x, scoop.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = scoopColor;
      ctx.fill();

      // Stalled warning label directly on scoop
      if (isStalled) {
        const stallMs = Math.max(0, stallUntilRef.current - now);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠ STALLED! ${(stallMs / 1000).toFixed(1)}s`, scoop.x, scoop.y - 22);
        ctx.font = '9px monospace';
        ctx.fillText('Boulder Jam!', scoop.x, scoop.y - 9);
      } else if (phaseRef.current === 'digging') {
        // High visibility tutorial prompt if player hasn't moved yet
        if (!hasInteracted) {
          ctx.save();
          const bounce = Math.sin(now * 0.006) * 4;
          ctx.fillStyle = 'rgba(8, 47, 73, 0.92)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(scoop.x - 70, scoop.y + 24 + bounce, 140, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('👇 DRAG DOWN TO DIG', scoop.x, scoop.y + 39 + bounce);
          ctx.restore();
        } else {
          ctx.font = '9px monospace';
          ctx.fillStyle = '#bae6fd';
          ctx.textAlign = 'center';
          ctx.fillText('STEER DOWN', scoop.x, scoop.y - 18);
        }
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 6. PARTICLES (Sparks, dust spray, and steam)
      // -------------------------------------------------------------
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.isSteam) {
          p.radius += 0.08; // expanding steam
          p.vx += (Math.random() - 0.5) * 0.1;
        }

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bagChunk, baggedCount, hasInteracted, onFailTrigger, onReactionChange, spawnParticles, totalSublimationTime, triggerSublimationPhase]);

  // Handle pointer down on canvas
  const handlePointerDown = (clientX: number, clientY: number) => {
    setHasInteracted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Phase 1: Touching anywhere on canvas engages the scoop steering!
    if (phaseRef.current === 'digging') {
      const now = Date.now();
      if (now < stallUntilRef.current) return; // Stalled, cannot drag

      isScoopDraggingRef.current = true;
      pointerStartRef.current = {
        canvasX: x,
        canvasY: y,
        scoopOrigX: scoopPosRef.current.x,
        scoopOrigY: scoopPosRef.current.y,
      };
      return;
    }

    // Phase 2: Check if clicking an ice chunk (with generous 60px hit area)
    if (phaseRef.current === 'sublimating') {
      for (const chunk of chunksRef.current) {
        if (!chunk.bagged && !chunk.evaporated) {
          const dist = Math.hypot(x - chunk.x, y - chunk.y);
          if (dist < 60) {
            draggedChunkIdRef.current = chunk.id;
            break;
          }
        }
      }
    }
  };

  // Handle pointer move on canvas
  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Phase 1: Dragging scoop down with smooth relative delta
    if (phaseRef.current === 'digging' && isScoopDraggingRef.current) {
      const now = Date.now();
      if (now < stallUntilRef.current) return; // Stalled

      const dx = x - pointerStartRef.current.canvasX;
      const dy = y - pointerStartRef.current.canvasY;

      // Constrain within trench bounds
      const targetX = Math.max(105, Math.min(535, pointerStartRef.current.scoopOrigX + dx));
      // Moving downwards digs the soil
      const targetY = Math.max(35, Math.min(220, pointerStartRef.current.scoopOrigY + dy));

      scoopPosRef.current = { x: targetX, y: targetY };

      // Record carved path
      carvedPointsRef.current.push({ x: targetX, y: targetY });
      if (carvedPointsRef.current.length > 140) {
        carvedPointsRef.current.shift();
      }

      // Check depth progress (y: 35 -> 210)
      if (targetY > maxDepthYRef.current) {
        maxDepthYRef.current = targetY;
        const pct = Math.min(100, Math.round(((targetY - 35) / 175) * 100));
        depthPctRef.current = pct;
        setDepthPercent(pct);

        // Digging spray particles
        if (Math.random() < 0.45) {
          const particleColor = pct > 66 ? '#bae6fd' : pct > 33 ? '#854d3d' : '#d97746';
          spawnParticles(targetX, targetY, 2, particleColor);
        }

        // Did we hit the 100% ice layer?
        if (pct >= 100) {
          triggerSublimationPhase();
          return;
        }
      }

      // Check collision with rocks (fair collision radius: rock.radius + 10)
      for (const rock of rocksRef.current) {
        const dist = Math.hypot(targetX - rock.x, targetY - rock.y);
        if (dist < rock.radius + 10) {
          // Rock Hit!
          stallUntilRef.current = Date.now() + 1000;
          isScoopDraggingRef.current = false;
          rockHitsRef.current += 1;
          setRockHitCount((c) => c + 1);
          rock.hit = true;

          if (!reduceMotion) shakeRef.current = 14;
          sound.playMistake();
          sound.playRumble();
          spawnParticles(rock.x, rock.y, 16, '#94a3b8');
          onReactionChange('CLANK! Struck basalt boulder! Scoop motor stalled for 1.0 second!');
          break;
        }
      }
      return;
    }

    // Phase 2: Dragging an ice chunk towards the cooler
    if (phaseRef.current === 'sublimating' && draggedChunkIdRef.current !== null) {
      const chunk = chunksRef.current.find((c) => c.id === draggedChunkIdRef.current);
      if (chunk && !chunk.bagged) {
        chunk.x = Math.max(30, Math.min(610, x));
        chunk.y = Math.max(20, Math.min(260, y));

        if (Math.random() < 0.3) {
          spawnParticles(chunk.x, chunk.y, 1, '#ffffff', true);
        }

        // Magnetic tractor beam check while dragging:
        // If dragged within 90px of chute center, auto-snap and bag!
        const chuteCenterX = COOLER_X + COOLER_W / 2;
        const chuteCenterY = COOLER_Y + COOLER_H / 2;
        if (Math.hypot(chunk.x - chuteCenterX, chunk.y - chuteCenterY) < 90) {
          draggedChunkIdRef.current = null;
          bagChunk(chunk);
        }
      }
    }
  };

  // Handle pointer up
  const handlePointerUp = () => {
    isScoopDraggingRef.current = false;

    // Phase 2: Check if dropped chunk is near or in cooler chute
    if (phaseRef.current === 'sublimating' && draggedChunkIdRef.current !== null) {
      const chunk = chunksRef.current.find((c) => c.id === draggedChunkIdRef.current);
      if (chunk && !chunk.bagged) {
        const chuteCenterX = COOLER_X + COOLER_W / 2;
        const chuteCenterY = COOLER_Y + COOLER_H / 2;
        const distToChute = Math.hypot(chunk.x - chuteCenterX, chunk.y - chuteCenterY);

        // Generous drop zone: within 110px OR anywhere in the upper right quadrant
        const inDropZone =
          distToChute < 110 ||
          (chunk.x >= COOLER_X - 40 && chunk.y <= COOLER_Y + COOLER_H + 40);

        if (inDropZone) {
          bagChunk(chunk);
        } else {
          // If tapped in place or not moved far, trigger auto-fly to chute!
          const distFromOrig = Math.hypot(chunk.x - chunk.origX, chunk.y - chunk.origY);
          if (distFromOrig < 25) {
            // Tap-to-bag shortcut
            chunk.isAutoFlying = true;
          } else {
            // Snap back
            chunk.x = chunk.origX;
            chunk.y = chunk.origY;
          }
        }
      }
      draggedChunkIdRef.current = null;
    }
  };

  // Autoplay hook for test automation
  useEffect(() => {
    if (typeof window !== 'undefined' && isDebugMode) {
      const runAutoplay = () => {
        rockHitsRef.current = 0;
        setRockHitCount(0);
        setDepthPercent(100);
        setBaggedCount(3);
        for (const chunk of chunksRef.current) {
          chunk.bagged = true;
        }
        phaseRef.current = 'won';
        setPhase('won');
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__phoenixAutoplay = runAutoplay;
      (window as any).__phoenixTriggerStage2 = triggerSublimationPhase;
      return () => {
        delete (window as any).__phoenixAutoplay;
        delete (window as any).__phoenixTriggerStage2;
      };
    }
  }, [onWinTrigger, triggerSublimationPhase]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="phoenix-ice-game"
    >
      {/* 1. Header Telemetry HUD (Stage Bar) */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-cyan-900/40 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-300 font-bold uppercase tracking-wider">
            {phase === 'digging' ? 'Dig!' : 'Bag it!'}
          </span>
        </div>

        {/* Mars Time-Lapse Badge (Active during sublimation phase) */}
        {phase === 'sublimating' && (
          <div
            data-testid="time-lapse-badge"
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse"
          >
            <Clock size={12} className="text-amber-400" />
            <span className="font-bold text-[10px]">SOL 20 → 24</span>
          </div>
        )}

        {/* Sublimating Timer Bar inside Stage Bar */}
        {phase === 'sublimating' && (
          <div className="flex-1 max-w-[140px] sm:max-w-[200px] mx-2 h-2.5 rounded-full bg-slate-800 border border-cyan-500/40 overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                sublimationTimeLeft < 1.5 ? 'bg-red-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.max(0, (sublimationTimeLeft / totalSublimationTime) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* 2. Interactive Trench Soil Canvas */}
      <div className="w-full flex-1 flex items-center justify-center my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="bg-[#120705] rounded-2xl block border-2 border-cyan-950 shadow-2xl cursor-grab active:cursor-grabbing w-full h-full max-h-[220px] sm:max-h-[260px] touch-none select-none aspect-video shrink-0"
          data-testid="crater-canvas"
        />

        {/* In-canvas Cryo Chute target overlay */}
        <div
          data-testid="cooler-chute"
          className="absolute pointer-events-none"
          style={{
            left: `${(COOLER_X / CANVAS_WIDTH) * 100}%`,
            top: `${(COOLER_Y / CANVAS_HEIGHT) * 100}%`,
            width: `${(COOLER_W / CANVAS_WIDTH) * 100}%`,
            height: `${(COOLER_H / CANVAS_HEIGHT) * 100}%`,
          }}
          aria-label="Cryo Chute"
        />

        {/* Accessibility overlay for touch targeting the scoop */}
        {phase === 'digging' && (
          <div
            data-testid="scoop-drag-target"
            className="absolute pointer-events-none text-[10px] text-cyan-300 font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/30 shadow-md"
            style={{
              left: `${(scoopPosRef.current.x / CANVAS_WIDTH) * 100}%`,
              top: `${(scoopPosRef.current.y / CANVAS_HEIGHT) * 100}%`,
              transform: 'translate(-50%, 22px)',
            }}
          >
            SCOOP
          </div>
        )}
      </div>

      {/* 3. Footer Bar: Depth Readout (Stage 1) or Time Left (Stage 2) */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-cyan-950/20 border border-cyan-900/30 rounded-xl shrink-0 text-xs font-mono text-slate-300">
        <span className="flex items-center gap-1.5">
          {phase === 'digging' ? (
            <span className="text-cyan-400 font-bold">
              Depth: {depthPercent}% ({Math.round(depthPercent * 0.15)} cm)
            </span>
          ) : (
            <span
              className={`font-bold flex items-center gap-1.5 ${
                sublimationTimeLeft < 1.5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
              }`}
            >
              <Clock size={13} /> Time left: {sublimationTimeLeft.toFixed(1)}s
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
