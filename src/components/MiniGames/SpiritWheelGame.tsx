import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Sparkles, AlertTriangle, ShieldCheck, Flame, Compass, ChevronLeft, ChevronRight, Award } from 'lucide-react';

interface SpiritWheelGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface TerrainFeature {
  id: number;
  x: number;
  y: number;
  type: 'sand' | 'boulder';
  radius: number;
  w?: number;
  h?: number;
}

interface SilicaDeposit {
  id: number;
  x: number;
  y: number;
  collected: boolean;
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
}

export const SpiritWheelGame: React.FC<SpiritWheelGameProps> = ({
  wreckId = 'eq_spirit',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Front-right wheel jammed! Counter-steer against the pull to keep the wheel in the central silica vein!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Fresh descent vector aligned! Stay in the central vein to gouge out pure silica!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="The Dragged Wheel"
      instruction="Spirit drives backwards with a locked wheel! Counter-steer to keep the dragged wheel in the central vein and unearth silica!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <SpiritContent
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

export default SpiritWheelGame;

interface SpiritContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 280;
const TOTAL_DISTANCE = 100;
const SILICA_TARGET = 8;

// Central Hydrothermal Vein Bounds
const VEIN_LEFT = 210;
const VEIN_RIGHT = 430;

export const SpiritContent: React.FC<SpiritContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [phase, setPhase] = useState<'driving' | 'won' | 'failed'>('driving');
  const [progressPercent, setProgressPercent] = useState(0);
  const [silicaCollected, setSilicaCollected] = useState(0);
  const [isInVein, setIsInVein] = useState(true);
  const [isBogged, setIsBogged] = useState(false);
  const [sandBogsCount, setSandBogsCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const phaseRef = useRef<'driving' | 'won' | 'failed'>('driving');
  phaseRef.current = phase;

  // Rover position & physics
  const roverPosRef = useRef({ x: 320, y: 175 });
  const steerInputRef = useRef<'left' | 'right' | null>(null);
  const pointerTargetXRef = useRef<number | null>(null);

  // Wheel drift: Jammed right wheel pulls right constantly
  const driftRate = assistActive ? 0.8 : 1.5;

  // Drag furrow trail (points cut by the locked right wheel)
  const furrowTrailRef = useRef<Array<{ x: number; y: number; inVein: boolean }>>([]);

  // Hazards & Collectibles
  const featuresRef = useRef<TerrainFeature[]>([]);
  const silicaRef = useRef<SilicaDeposit[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Stalled / bogged status
  const stallUntilRef = useRef<number>(0);
  const boggedUntilRef = useRef<number>(0);
  const sandBogsRef = useRef(0);
  const silicaCountRef = useRef(0);
  const distanceCoveredRef = useRef(0);

  // Vein gouging continuous timer (every ~1.3s in vein awards +1 silica)
  const veinAccrualTimerRef = useRef(0);

  // Shake
  const shakeRef = useRef(0);

  // Spawn visual particles
  const spawnParticles = useCallback(
    (x: number, y: number, count: number, color: string) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.5 + 0.6;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 2.5 + 1,
          color,
          alpha: 1,
          decay: 0.035 + Math.random() * 0.025,
        });
      }
    },
    []
  );

  // Harvest silica helper
  const addSilica = useCallback(
    (x: number, y: number, reason: string) => {
      if (silicaCountRef.current >= SILICA_TARGET + 2) return;
      silicaCountRef.current += 1;
      setSilicaCollected(silicaCountRef.current);
      sound.playCollectSample();
      sound.playNovaPurr();
      spawnParticles(x, y, 16, '#38bdf8');
      spawnParticles(x, y, 10, '#ffffff');
      onReactionChange(`${reason} [ 💎 ${silicaCountRef.current} / ${SILICA_TARGET} ]`);
    },
    [onReactionChange, spawnParticles]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        steerInputRef.current = 'left';
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        steerInputRef.current = 'right';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        (e.code === 'ArrowLeft' || e.code === 'KeyA') &&
        steerInputRef.current === 'left'
      ) {
        steerInputRef.current = null;
      } else if (
        (e.code === 'ArrowRight' || e.code === 'KeyD') &&
        steerInputRef.current === 'right'
      ) {
        steerInputRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main canvas animation and physics loop
  useEffect(() => {
    let animId: number;
    let spawnTimer = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = Date.now();
      const isStalled = now < stallUntilRef.current;
      const isCurrentlyBogged = now < boggedUntilRef.current;
      setIsBogged(isCurrentlyBogged);

      // Terrain scroll speed (descent speed)
      const baseSpeed = isStalled ? 0 : isCurrentlyBogged ? 1.2 : 2.5;

      if (phaseRef.current === 'driving') {
        // -------------------------------------------------------------
        // 1. UPDATE ROVER PHYSICS & SNAPPY STEERING
        // -------------------------------------------------------------
        const rover = roverPosRef.current;

        // Jammed wheel pulls constantly to the right!
        if (!isStalled) {
          rover.x += driftRate;
        }

        // Apply player steering input (responsive & powerful)
        if (!isStalled) {
          if (steerInputRef.current === 'left') {
            rover.x -= 4.8; // Authoritative counter-steer overpowers drift
          } else if (steerInputRef.current === 'right') {
            rover.x += 3.0;
          } else if (pointerTargetXRef.current !== null) {
            // Direct touch / drag tracking with smooth, crisp lerp
            const targetX = pointerTargetXRef.current;
            rover.x += (targetX - rover.x) * 0.42;
          }
        }

        // Clamp within slope track boundaries (x: 105 to 535)
        rover.x = Math.max(105, Math.min(535, rover.x));

        // Advance distance progress
        distanceCoveredRef.current += baseSpeed * 0.052;
        const currentPct = Math.min(100, Math.round(distanceCoveredRef.current));
        setProgressPercent(currentPct);

        // Locked wheel position (offset on rover chassis: +22, +14)
        const lockedWheelX = rover.x + 22;
        const lockedWheelY = rover.y + 14;

        // Check if locked wheel is inside the Hydrothermal Silica Vein!
        const wheelInVein = lockedWheelX >= VEIN_LEFT && lockedWheelX <= VEIN_RIGHT;
        setIsInVein(wheelInVein);

        // Record furrow points carved by the locked wheel
        furrowTrailRef.current.push({ x: lockedWheelX, y: lockedWheelY, inVein: wheelInVein });
        if (furrowTrailRef.current.length > 90) {
          furrowTrailRef.current.shift();
        }

        // Shift furrow points down as terrain scrolls
        for (const pt of furrowTrailRef.current) {
          pt.y += baseSpeed;
        }

        // Continuous Vein Gouging: staying in vein unearths silica!
        if (wheelInVein && !isStalled && !isCurrentlyBogged) {
          veinAccrualTimerRef.current += 1;
          // Every ~60 frames (~1.0s), unearth silica from the vein!
          if (veinAccrualTimerRef.current >= 55) {
            veinAccrualTimerRef.current = 0;
            addSilica(lockedWheelX, lockedWheelY, 'GOUGED WHITE SILICA FROM VEIN!');
          }

          // Sparks and brilliant white/cyan spray from gouging the vein
          if (Math.random() < 0.5) {
            spawnParticles(lockedWheelX, lockedWheelY, 2, '#38bdf8');
            spawnParticles(lockedWheelX, lockedWheelY, 1, '#ffffff');
          }
        } else {
          // In sand/shoulder: churning brown dust sparks
          if (Math.random() < 0.3) {
            spawnParticles(lockedWheelX, lockedWheelY, 1, '#d97706');
          }
        }

        // -------------------------------------------------------------
        // 2. SPAWN TERRAIN FEATURES & BONUS SILICA CLUSTERS
        // -------------------------------------------------------------
        spawnTimer += baseSpeed;
        if (spawnTimer >= 70 && currentPct < 90) {
          spawnTimer = 0;

          // Intelligently spawn sand pits on the outer edges, not blocking the whole vein!
          const isLeftShoulder = Math.random() < 0.5;
          const sandX = isLeftShoulder
            ? 120 + Math.random() * 80 // Left side (120-200)
            : 440 + Math.random() * 80; // Right side (440-520)

          featuresRef.current.push({
            id: Date.now() + Math.random(),
            x: sandX,
            y: -35,
            type: 'sand',
            radius: 24,
            w: 55,
            h: 35,
          });

          // Occasionally spawn a rock on the far margins
          if (Math.random() < 0.4) {
            const boulderX = isLeftShoulder ? 520 : 115;
            featuresRef.current.push({
              id: Date.now() + Math.random() + 2,
              x: boulderX,
              y: -40,
              type: 'boulder',
              radius: 16,
            });
          }

          // Spawn bonus sparkling silica cluster along the vein
          if (Math.random() < 0.65 && silicaRef.current.length < 6) {
            silicaRef.current.push({
              id: Date.now() + Math.random() + 1,
              x: VEIN_LEFT + 25 + Math.random() * (VEIN_RIGHT - VEIN_LEFT - 50),
              y: -25,
              collected: false,
            });
          }
        }

        // Scroll features and check collisions
        for (let i = featuresRef.current.length - 1; i >= 0; i--) {
          const feat = featuresRef.current[i];
          feat.y += baseSpeed;

          // Check collision with rover
          const dist = Math.hypot(rover.x - feat.x, rover.y - feat.y);
          if (feat.type === 'boulder' && dist < feat.radius + 14 && !isStalled) {
            // Boulder collision!
            stallUntilRef.current = now + 800;
            if (!reduceMotion) shakeRef.current = 12;
            sound.playMistake();
            spawnParticles(feat.x, feat.y, 14, '#94a3b8');
            onReactionChange('CLANK! Glanced basalt boulder! Counter-steer back to the vein!');
          } else if (feat.type === 'sand' && dist < feat.radius + 12 && !isCurrentlyBogged) {
            // Sand pit bog!
            boggedUntilRef.current = now + 900;
            sandBogsRef.current += 1;
            setSandBogsCount((c) => c + 1);
            if (!reduceMotion) shakeRef.current = 6;
            sound.playMistake();
            spawnParticles(rover.x, rover.y, 12, '#d97706');
            onReactionChange('⚠ SOFT SAND! Wheels slipping! Counter-steer left to reach firm bedrock!');
          }

          if (feat.y > CANVAS_HEIGHT + 60) {
            featuresRef.current.splice(i, 1);
          }
        }

        // Scroll bonus silica deposits and collect with generous 52px radius
        for (let i = silicaRef.current.length - 1; i >= 0; i--) {
          const deposit = silicaRef.current[i];
          deposit.y += baseSpeed;

          const dist = Math.hypot(rover.x - deposit.x, rover.y - deposit.y);
          if (!deposit.collected && dist < 52) {
            deposit.collected = true;
            addSilica(deposit.x, deposit.y, 'BONUS SILICA NODULE GATHERED!');
          }

          if (deposit.y > CANVAS_HEIGHT + 50) {
            silicaRef.current.splice(i, 1);
          }
        }

        // Check victory at 100% distance (Home Plate reached!)
        if (currentPct >= TOTAL_DISTANCE) {
          phaseRef.current = 'won';
          setPhase('won');

          // Intuitive and fair star rating:
          // 3 stars: >= 7 silica (out of 8 target) AND <= 1 sand bog!
          // 2 stars: >= 4 silica
          // 1 star: reached Home Plate
          const stars: 1 | 2 | 3 =
            silicaCountRef.current >= 7 && sandBogsRef.current <= 1
              ? 3
              : silicaCountRef.current >= 4
              ? 2
              : 1;

          sound.playSuccess();
          onReactionChange(
            'VICTORY! Home Plate reached! 90% pure silica confirmed—proving ancient hot springs on Mars!'
          );
          onWinTrigger({ stars });
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
      // 3. DRAW MARTIAN SLOPE & CENTRAL HYDROTHERMAL VEIN
      // -------------------------------------------------------------
      // Slope Background Gradient (Rust and volcanic soil)
      const terrainGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      terrainGrad.addColorStop(0, '#5a2213');
      terrainGrad.addColorStop(0.5, '#732c18');
      terrainGrad.addColorStop(1, '#44190e');
      ctx.fillStyle = terrainGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Central Hydrothermal Bedrock Vein (Optimal firm traction & silica source)
      const veinGrad = ctx.createLinearGradient(VEIN_LEFT, 0, VEIN_RIGHT, 0);
      veinGrad.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
      veinGrad.addColorStop(0.5, 'rgba(8, 47, 73, 0.75)');
      veinGrad.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
      ctx.fillStyle = veinGrad;
      ctx.fillRect(VEIN_LEFT, 0, VEIN_RIGHT - VEIN_LEFT, CANVAS_HEIGHT);

      // Vein Boundary Dotted Lines (Cyan highway guides)
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(VEIN_LEFT, 0);
      ctx.lineTo(VEIN_LEFT, CANVAS_HEIGHT);
      ctx.moveTo(VEIN_RIGHT, 0);
      ctx.lineTo(VEIN_RIGHT, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle Hydrothermal Vein Ground Fissures & Label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ HYDROTHERMAL SILICA VEIN (BEDROCK RIDGE) ⚡', (VEIN_LEFT + VEIN_RIGHT) / 2, 22);

      // Left and Right Boundary Hazard Zones
      ctx.fillStyle = 'rgba(217, 119, 6, 0.2)';
      ctx.fillRect(0, 0, 100, CANVAS_HEIGHT);
      ctx.fillRect(540, 0, 100, CANVAS_HEIGHT);

      // Hazard Boundary Striping
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, 0);
      ctx.lineTo(100, CANVAS_HEIGHT);
      ctx.moveTo(540, 0);
      ctx.lineTo(540, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // -------------------------------------------------------------
      // 4. DRAW SOFT SAND PITS & BOULDERS
      // -------------------------------------------------------------
      for (const feat of featuresRef.current) {
        if (feat.type === 'sand') {
          // Powdery sulfate sand drift
          ctx.save();
          const sandGrad = ctx.createRadialGradient(
            feat.x,
            feat.y,
            3,
            feat.x,
            feat.y,
            feat.radius
          );
          sandGrad.addColorStop(0, '#f59e0b');
          sandGrad.addColorStop(0.7, '#d97706');
          sandGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');
          ctx.fillStyle = sandGrad;
          ctx.beginPath();
          ctx.ellipse(feat.x, feat.y, feat.radius * 1.25, feat.radius * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
          ctx.textAlign = 'center';
          ctx.fillText('SOFT SAND', feat.x, feat.y + 3);
          ctx.restore();
        } else {
          // Basalt Boulder
          ctx.save();
          ctx.beginPath();
          ctx.arc(feat.x, feat.y, feat.radius, 0, Math.PI * 2);
          const rockGrad = ctx.createRadialGradient(
            feat.x - 3,
            feat.y - 3,
            2,
            feat.x,
            feat.y,
            feat.radius
          );
          rockGrad.addColorStop(0, '#524545');
          rockGrad.addColorStop(1, '#181212');
          ctx.fillStyle = rockGrad;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#6b5858';
          ctx.stroke();
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 5. DRAW CARVED WHITE SILICA FURROW (The Dragged Wheel Trench!)
      // -------------------------------------------------------------
      if (furrowTrailRef.current.length > 1) {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < furrowTrailRef.current.length; i++) {
          const pt = furrowTrailRef.current[i];
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        // Glowing white & cyan furrow when in the silica vein!
        ctx.lineWidth = 11;
        ctx.strokeStyle = isInVein ? 'rgba(224, 242, 254, 0.95)' : 'rgba(160, 100, 80, 0.7)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.lineWidth = 6;
        ctx.strokeStyle = isInVein ? '#ffffff' : '#b45309';
        ctx.stroke();

        if (isInVein) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();
        }
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 6. DRAW SPARKLING HYDROTHERMAL SILICA CLUSTERS
      // -------------------------------------------------------------
      for (const silica of silicaRef.current) {
        if (silica.collected) continue;

        ctx.save();
        // Pulsing crystal glow
        const glowGrad = ctx.createRadialGradient(
          silica.x,
          silica.y,
          1,
          silica.x,
          silica.y,
          18
        );
        glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.7)');
        glowGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(silica.x, silica.y, 18, 0, Math.PI * 2);
        ctx.fill();

        // Dazzling multi-faceted white silica mineral
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(silica.x, silica.y - 7);
        ctx.lineTo(silica.x + 6, silica.y);
        ctx.lineTo(silica.x, silica.y + 7);
        ctx.lineTo(silica.x - 6, silica.y);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#bae6fd';
        ctx.textAlign = 'center';
        ctx.fillText('SILICA', silica.x, silica.y - 10);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 7. DRAW SPIRIT ROVER CHASSIS (Driving Backwards!)
      // -------------------------------------------------------------
      const rover = roverPosRef.current;
      ctx.save();

      // Main golden-foil solar panel wings
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rover.x - 20, rover.y - 16, 40, 32, 4);
      ctx.fill();
      ctx.stroke();

      // Rocker-bogie wheel linkages
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;

      // Left wheel train (3 working wheels spinning in reverse)
      ctx.beginPath();
      ctx.moveTo(rover.x - 22, rover.y - 12);
      ctx.lineTo(rover.x - 22, rover.y + 16);
      ctx.stroke();

      // Right wheel train (2 working wheels + 1 locked wheel!)
      ctx.beginPath();
      ctx.moveTo(rover.x + 22, rover.y - 12);
      ctx.lineTo(rover.x + 22, rover.y + 16);
      ctx.stroke();

      // Draw the 6 Wheels:
      // Left 3 wheels (Active)
      ctx.fillStyle = '#334155';
      ctx.fillRect(rover.x - 26, rover.y - 14, 5, 8);
      ctx.fillRect(rover.x - 26, rover.y - 1, 5, 8);
      ctx.fillRect(rover.x - 26, rover.y + 12, 5, 8);

      // Right 2 working wheels
      ctx.fillRect(rover.x + 21, rover.y - 14, 5, 8);
      ctx.fillRect(rover.x + 21, rover.y - 1, 5, 8);

      // The JAMMED Front-Right Wheel (trailing at bottom right in reverse)
      // Highlighted in RED with locked angle and drag sparks!
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(rover.x + 20, rover.y + 11, 7, 10);
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rover.x + 20, rover.y + 11, 7, 10);

      // Locked Wheel Warning Aura
      ctx.beginPath();
      ctx.arc(rover.x + 23, rover.y + 16, 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label for Jammed Wheel
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('LOCKED!', rover.x + 36, rover.y + 18);

      // High Gain Antenna Dish & Mast
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(rover.x, rover.y - 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // In-Canvas Status Badge above Rover
      if (phaseRef.current === 'driving' && !isStalled) {
        if (isInVein) {
          ctx.fillStyle = 'rgba(8, 47, 73, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rover.x - 70, rover.y - 36, 140, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('✨ GOUGING SILICA VEIN!', rover.x, rover.y - 24);
        } else {
          ctx.fillStyle = 'rgba(120, 53, 15, 0.9)';
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rover.x - 75, rover.y - 36, 150, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#fb923c';
          ctx.textAlign = 'center';
          ctx.fillText('⚠ PULLING RIGHT! STEER LEFT ◄', rover.x, rover.y - 24);
        }
      }

      // Wheel Slip warning badge if bogged
      if (isCurrentlyBogged) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
        ctx.beginPath();
        ctx.roundRect(rover.x - 55, rover.y + 26, 110, 18, 4);
        ctx.fill();
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ WHEEL SLIP!', rover.x, rover.y + 38);
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 8. PARTICLES
      // -------------------------------------------------------------
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

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
  }, [addSilica, assistActive, driftRate, isInVein, onReactionChange, onWinTrigger, reduceMotion, spawnParticles]);

  // Handle pointer down on canvas
  const handlePointerDown = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;
    pointerTargetXRef.current = x;
  };

  const handlePointerMove = (clientX: number) => {
    if (pointerTargetXRef.current === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;
    pointerTargetXRef.current = x;
  };

  const handlePointerUp = () => {
    pointerTargetXRef.current = null;
  };

  // Autoplay hook for test automation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runAutoplay = () => {
        sandBogsRef.current = 0;
        setSandBogsCount(0);
        silicaCountRef.current = SILICA_TARGET;
        setSilicaCollected(SILICA_TARGET);
        distanceCoveredRef.current = TOTAL_DISTANCE;
        setProgressPercent(100);
        phaseRef.current = 'won';
        setPhase('won');
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__spiritAutoplay = runAutoplay;
      return () => {
        delete (window as any).__spiritAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="spirit-wheel-game"
    >
      {/* 1. Header Telemetry HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-amber-900/40 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isInVein ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-amber-300 font-bold uppercase tracking-wider">
            {isInVein ? 'VEIN ACTIVE: GOUGING SILICA' : 'PULLING RIGHT ⚠ COUNTER-STEER'}
          </span>
        </div>

        {/* Silica Harvest Counter */}
        <div
          data-testid="silica-counter"
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md shadow-cyan-950/40"
        >
          <Sparkles size={14} className="text-cyan-400 animate-spin" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Silica Vein</span>
            <span className="text-xs font-bold text-cyan-300 font-mono">
              {silicaCollected} / {SILICA_TARGET}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Scrolling Canvas */}
      <div className="w-full flex-1 flex items-center justify-center my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={(e) => handlePointerDown(e.clientX)}
          onPointerMove={(e) => handlePointerMove(e.clientX)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="bg-[#35140b] rounded-2xl block border-2 border-amber-950 shadow-2xl cursor-grab active:cursor-grabbing w-full h-full max-h-[210px] sm:max-h-[250px] touch-none select-none aspect-video shrink-0"
          data-testid="crater-canvas"
        />

        {/* Visual Target Pill for Accessibility */}
        <div
          data-testid="spirit-rover-target"
          className="absolute pointer-events-none text-[9px] text-amber-300 font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-amber-500/40 shadow"
          style={{
            left: `${(roverPosRef.current.x / CANVAS_WIDTH) * 100}%`,
            top: `${(roverPosRef.current.y / CANVAS_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -36px)',
          }}
        >
          SPIRIT (REVERSE)
        </div>
      </div>

      {/* 3. Tactile Steering Controls Strip */}
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-900/90 border border-amber-900/30 rounded-xl shrink-0">
        {/* Large Tactile Counter-Steer Left Button (>=48px touch target) */}
        <button
          data-testid="steer-left-btn"
          onPointerDown={() => {
            steerInputRef.current = 'left';
          }}
          onPointerUp={() => {
            if (steerInputRef.current === 'left') steerInputRef.current = null;
          }}
          onPointerLeave={() => {
            if (steerInputRef.current === 'left') steerInputRef.current = null;
          }}
          className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-900/50 border-2 border-cyan-400 text-cyan-200 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-600/70 active:scale-[0.98] transition-all cursor-pointer shadow-md select-none"
        >
          <ChevronLeft size={20} className="text-cyan-300 animate-pulse" />
          <span>◄ COUNTER-STEER LEFT</span>
        </button>

        {/* Descent Progress Badge */}
        <div className="flex flex-col items-center justify-center px-3 py-1 bg-slate-950/80 rounded border border-slate-700 font-mono text-center shrink-0">
          <span className="text-[9px] text-slate-400 uppercase">Descent</span>
          <span className="text-xs font-bold text-amber-300">{progressPercent}%</span>
        </div>

        {/* Large Tactile Steer Right Button (>=48px touch target) */}
        <button
          data-testid="steer-right-btn"
          onPointerDown={() => {
            steerInputRef.current = 'right';
          }}
          onPointerUp={() => {
            if (steerInputRef.current === 'right') steerInputRef.current = null;
          }}
          onPointerLeave={() => {
            if (steerInputRef.current === 'right') steerInputRef.current = null;
          }}
          className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-lg bg-amber-900/40 border-2 border-amber-500/60 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-amber-700/60 active:scale-[0.98] transition-all cursor-pointer shadow-md select-none"
        >
          <span>STEER RIGHT ►</span>
          <ChevronRight size={18} className="text-amber-400" />
        </button>
      </div>
    </div>
  );
};
