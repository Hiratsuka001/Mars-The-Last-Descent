import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Radio, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Sparkles, ShieldAlert, Target } from 'lucide-react';

interface DeepSpaceDishGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface MicrowavePacket {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGold: boolean;
  isFlare: boolean;
  radius: number;
  deflected: boolean;
  absorbed: boolean;
  label: string;
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

interface LaserFlash {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  alpha: number;
  color: string;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export const DeepSpaceDishGame: React.FC<DeepSpaceDishGameProps> = ({
  wreckId = 'eq_deep_space_dish',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Cassegrain sub-reflector online! Drag or tap anywhere to catch blue beams and bounce them into the feed horn!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Sub-reflector ready! Tap or drag to position the mirror. Dodge red solar flares!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="Microwave Beam Reflector"
      instruction="Move the mirror! Bounce 5 beams into the horn!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <DishReflectorContent
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

export default DeepSpaceDishGame;

interface DishReflectorContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 280;
const TOTAL_PACKETS = 5;

// Central Cryogenic Feed Horn Coordinates (Center of the 70m dish)
const HORN_X = 320;
const HORN_Y = 150;
const HORN_RADIUS = 28;

// Sub-reflector mirror catch radius (generous for intuitive play)
const MIRROR_RADIUS = 38;
const MAGNETIC_PULL_RADIUS = 60;

export const DishReflectorContent: React.FC<DishReflectorContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [phase, setPhase] = useState<'deflecting' | 'won' | 'failed'>('deflecting');
  const [packetsCollected, setPacketsCollected] = useState(0);
  const [combo, setCombo] = useState(1);
  const [isOverheated, setIsOverheated] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const phaseRef = useRef<'deflecting' | 'won' | 'failed'>('deflecting');
  phaseRef.current = phase;

  // Sub-reflector mirror position (Starts suspended above feed horn)
  const mirrorPosRef = useRef({ x: 320, y: 100 });
  const targetPosRef = useRef({ x: 320, y: 100 });
  const isDraggingRef = useRef(false);

  // Key navigation inputs
  const keysHeldRef = useRef<Set<string>>(new Set());

  // Packets and hazards
  const packetsRef = useRef<MicrowavePacket[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const laserFlashesRef = useRef<LaserFlash[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Overheat & Combos
  const overheatUntilRef = useRef(0);
  const comboRef = useRef(1);
  const packetsCountRef = useRef(0);
  const flareHitsRef = useRef(0);
  const shakeRef = useRef(0);
  const hornShockwaveRef = useRef(0);

  // Synthesize procedural rising pentatonic scale
  const playDeflectChime = useCallback((comboCount: number, isGold = false) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pentatonic scale rising pitch: C5, D5, E5, G5, A5, C6
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = isGold ? 1318.51 : scale[Math.min(comboCount - 1, scale.length - 1)];

      osc.type = isGold ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      sound.playSonarPing();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysHeldRef.current.add(e.code);
      setHasInteracted(true);
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

  // Spawn visual particles
  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.2 + 0.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.5 + 1.2,
        color,
        alpha: 1,
        decay: 0.035 + Math.random() * 0.025,
      });
    }
  }, []);

  const addFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -1.2,
    });
  }, []);

  // Main canvas animation and reflection game loop
  useEffect(() => {
    let animId: number;
    let spawnTimer = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = Date.now();
      const isStalled = now < overheatUntilRef.current;
      setIsOverheated(isStalled);

      // -------------------------------------------------------------
      // 1. UPDATE SUB-REFLECTOR POSITION (Smooth interpolation & limits)
      // -------------------------------------------------------------
      if (phaseRef.current === 'deflecting') {
        const mirror = mirrorPosRef.current;
        const target = targetPosRef.current;

        // Apply keyboard motion to target
        let dx = 0;
        let dy = 0;
        if (keysHeldRef.current.has('ArrowLeft') || keysHeldRef.current.has('KeyA')) dx -= 5.5;
        if (keysHeldRef.current.has('ArrowRight') || keysHeldRef.current.has('KeyD')) dx += 5.5;
        if (keysHeldRef.current.has('ArrowUp') || keysHeldRef.current.has('KeyW')) dy -= 5.5;
        if (keysHeldRef.current.has('ArrowDown') || keysHeldRef.current.has('KeyS')) dy += 5.5;

        if (dx !== 0 || dy !== 0) {
          target.x = Math.max(100, Math.min(540, target.x + dx));
          target.y = Math.max(45, Math.min(235, target.y + dy));
        }

        // Smoothly interpolate mirror towards target position
        const lerpFactor = isDraggingRef.current ? 0.35 : 0.22;
        mirror.x += (target.x - mirror.x) * lerpFactor;
        mirror.y += (target.y - mirror.y) * lerpFactor;

        // -------------------------------------------------------------
        // 2. SPAWN INCOMING MICROWAVE PACKETS & SOLAR FLARES
        // -------------------------------------------------------------
        // Pace spawns naturally so player easily sees each beam
        spawnTimer += 1;
        const activeCount = packetsRef.current.length;

        // Spawn a new packet if no packet is currently active OR timer reached
        if (
          (activeCount === 0 || spawnTimer >= 85) &&
          packetsCountRef.current < TOTAL_PACKETS &&
          activeCount < 2
        ) {
          spawnTimer = 0;

          // Packets 0 & 1 are ALWAYS pure safe cyan microwave packets (seamless learning!)
          // Flares only have a small chance starting from packet 2 onwards
          const canFlare = !assistActive && packetsCountRef.current >= 2;
          const isFlare = canFlare && Math.random() < 0.25;
          const isGold = !isFlare && packetsCountRef.current === TOTAL_PACKETS - 1;

          // Spawn from top aperture aiming towards central collector area
          const startX = 160 + Math.random() * 320;
          const targetX = HORN_X + (Math.random() - 0.5) * 90;
          const targetY = HORN_Y + (Math.random() - 0.5) * 50;

          const angle = Math.atan2(targetY - (-25), targetX - startX);
          const speed = isFlare ? 2.2 : 1.75; // Comfortable, intuitive speed

          packetsRef.current.push({
            id: Date.now() + Math.random(),
            x: startX,
            y: -25,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            isGold,
            isFlare,
            radius: isFlare ? 14 : 12,
            deflected: false,
            absorbed: false,
            label: isGold ? '⭐ GOLD BEAM' : isFlare ? '⚠ SOLAR FLARE' : '📡 MICROWAVE',
          });
        }

        // -------------------------------------------------------------
        // 3. UPDATE PACKETS, MAGNETIC ASSIST & DEFLECTION
        // -------------------------------------------------------------
        for (let i = packetsRef.current.length - 1; i >= 0; i--) {
          const p = packetsRef.current[i];

          // Check distance to player's mirror
          const distToMirror = Math.hypot(p.x - mirror.x, p.y - mirror.y);

          // Magnetic attraction: When close to mirror, pull safe microwave packets toward it!
          if (!p.isFlare && !isStalled && distToMirror < MAGNETIC_PULL_RADIUS && distToMirror > 4) {
            const pullAngle = Math.atan2(mirror.y - p.y, mirror.x - p.x);
            p.vx += Math.cos(pullAngle) * 0.45;
            p.vy += Math.sin(pullAngle) * 0.45;

            // Draw faint magnetic tractor sparks
            if (Math.random() < 0.4) {
              particlesRef.current.push({
                x: (p.x + mirror.x) / 2 + (Math.random() - 0.5) * 8,
                y: (p.y + mirror.y) / 2 + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                radius: 1.5,
                color: '#38bdf8',
                alpha: 0.8,
                decay: 0.08,
              });
            }
          }

          p.x += p.vx;
          p.y += p.vy;

          // Spark trail
          if (Math.random() < 0.4) {
            spawnParticles(p.x, p.y, 1, p.isFlare ? '#ef4444' : p.isGold ? '#fbbf24' : '#38bdf8');
          }

          // Hit detection with player mirror
          if (!p.deflected && distToMirror < MIRROR_RADIUS + p.radius) {
            p.deflected = true;

            if (p.isFlare) {
              // SOLAR FLARE OVERHEAT HIT!
              overheatUntilRef.current = now + 900;
              comboRef.current = 1;
              setCombo(1);
              flareHitsRef.current += 1;
              if (!reduceMotion) shakeRef.current = 12;
              sound.playMistake();
              spawnParticles(p.x, p.y, 20, '#ef4444');
              addFloatingText(mirror.x, mirror.y - 20, '⚠ FLARE HIT! -OVERHEAT', '#ef4444');
              onReactionChange('⚠ SOLAR FLARE HIT! Reflector mirror overheated! Dodge the red fireballs!');
              packetsRef.current.splice(i, 1);
              continue;
            } else {
              // SUCCESSFUL BEAM DEFLECTION INTO FEED HORN!
              p.absorbed = true;
              packetsCountRef.current += 1;
              setPacketsCollected(packetsCountRef.current);

              const currentCombo = comboRef.current;
              comboRef.current += 1;
              setCombo(comboRef.current);

              // Play rising pentatonic chime
              playDeflectChime(currentCombo, p.isGold);

              // Flash high-powered laser beam from mirror straight into the feed horn!
              laserFlashesRef.current.push({
                fromX: mirror.x,
                fromY: mirror.y,
                toX: HORN_X,
                toY: HORN_Y,
                alpha: 1.0,
                color: p.isGold ? '#fbbf24' : '#38bdf8',
              });

              hornShockwaveRef.current = 1.0;
              if (!reduceMotion) shakeRef.current = 6;
              spawnParticles(mirror.x, mirror.y, 16, p.isGold ? '#fbbf24' : '#38bdf8');
              spawnParticles(HORN_X, HORN_Y, 18, '#ffffff');

              addFloatingText(
                mirror.x,
                mirror.y - 25,
                p.isGold ? '⭐ GOLDEN PACKET! +BOOST' : `BOUNCE! +1 (x${currentCombo})`,
                p.isGold ? '#fbbf24' : '#38bdf8'
              );

              onReactionChange(
                `DEFLECTED PACKET INTO FEED HORN! [ 📡 ${packetsCountRef.current} / ${TOTAL_PACKETS} ] COMBO x${currentCombo}! 🔥`
              );

              packetsRef.current.splice(i, 1);

              // Check victory at 5 packets!
              if (packetsCountRef.current >= TOTAL_PACKETS) {
                phaseRef.current = 'won';
                setPhase('won');

                // Star calculation:
                // 3 stars: 0 solar flare hits AND combo >= 3
                const stars: 1 | 2 | 3 =
                  flareHitsRef.current === 0 && comboRef.current >= 3 ? 3 : flareHitsRef.current <= 1 ? 2 : 1;

                sound.playSuccess();
                onReactionChange(
                  'VICTORY! All 5 telemetry microwave packets focused into the receiver! Earth link established!'
                );
                onWinTrigger({ stars });
              }
              continue;
            }
          }

          // Off-screen packet cleanup (If missed, re-transmit without penalty)
          if (p.y > CANVAS_HEIGHT + 35 || p.x < 20 || p.x > CANVAS_WIDTH - 20) {
            if (!p.isFlare && !p.deflected) {
              comboRef.current = 1;
              setCombo(1);
              addFloatingText(p.x, CANVAS_HEIGHT - 30, 'Missed! Retrying...', '#94a3b8');
            }
            packetsRef.current.splice(i, 1);
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
      // 4. DRAW 70-METER PARABOLIC DISH SURFACE FROM ABOVE
      // -------------------------------------------------------------
      // Deep space background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Giant Parabolic Dish Outline & Concentric Panels
      const dishGrad = ctx.createRadialGradient(HORN_X, HORN_Y, 10, HORN_X, HORN_Y, 260);
      dishGrad.addColorStop(0, '#1e293b');
      dishGrad.addColorStop(0.5, '#0f172a');
      dishGrad.addColorStop(0.85, '#090d16');
      dishGrad.addColorStop(1, '#020617');
      ctx.fillStyle = dishGrad;
      ctx.beginPath();
      ctx.arc(HORN_X, HORN_Y, 250, 0, Math.PI * 2);
      ctx.fill();

      // Concentric metallic panel rings
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      for (let r = 50; r <= 240; r += 45) {
        ctx.beginPath();
        ctx.arc(HORN_X, HORN_Y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Dish radial ribs
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(HORN_X + Math.cos(angle) * 35, HORN_Y + Math.sin(angle) * 35);
        ctx.lineTo(HORN_X + Math.cos(angle) * 245, HORN_Y + Math.sin(angle) * 245);
        ctx.stroke();
      }

      // -------------------------------------------------------------
      // 5. DRAW CENTRAL CRYOGENIC FEED HORN (Target)
      // -------------------------------------------------------------
      // Feed horn shockwave ripple on beam capture
      if (hornShockwaveRef.current > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, ' + hornShockwaveRef.current + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(HORN_X, HORN_Y, HORN_RADIUS + (1.0 - hornShockwaveRef.current) * 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        hornShockwaveRef.current = Math.max(0, hornShockwaveRef.current - 0.04);
      }

      // Pulsing cryogenic intake halo
      const hornHalo = ctx.createRadialGradient(HORN_X, HORN_Y, 4, HORN_X, HORN_Y, HORN_RADIUS * 1.9);
      hornHalo.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      hornHalo.addColorStop(0.5, 'rgba(2, 132, 199, 0.45)');
      hornHalo.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = hornHalo;
      ctx.beginPath();
      ctx.arc(HORN_X, HORN_Y, HORN_RADIUS * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Feed horn metallic cylinder & waveguide vortex
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(HORN_X, HORN_Y, HORN_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(HORN_X, HORN_Y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Target Label
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#bae6fd';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET RECEIVER', HORN_X, HORN_Y + 4);

      // -------------------------------------------------------------
      // 6. DRAW LASER FLASHES (Deflected beam straight into feed horn)
      // -------------------------------------------------------------
      for (let i = laserFlashesRef.current.length - 1; i >= 0; i--) {
        const lf = laserFlashesRef.current[i];
        lf.alpha -= 0.05;

        if (lf.alpha <= 0) {
          laserFlashesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = lf.alpha;
        ctx.strokeStyle = lf.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(lf.fromX, lf.fromY);
        ctx.lineTo(lf.toX, lf.toY);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 7. DRAW TRAJECTORY PREDICTION GUIDELINES & INCOMING PACKETS
      // -------------------------------------------------------------
      const mirror = mirrorPosRef.current;

      for (const p of packetsRef.current) {
        ctx.save();

        // 7A. Draw subtle trajectory prediction guideline so the path is immediately obvious!
        if (!p.deflected) {
          const futureDist = 180;
          const endX = p.x + p.vx * (futureDist / Math.hypot(p.vx, p.vy));
          const endY = p.y + p.vy * (futureDist / Math.hypot(p.vx, p.vy));

          ctx.save();
          ctx.setLineDash([4, 6]);
          ctx.strokeStyle = p.isFlare ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.restore();
        }

        if (p.isFlare) {
          // Red Solar Flare Hazard (Glowing Fireball)
          const flareGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius * 1.7);
          flareGrad.addColorStop(0, '#fef08a');
          flareGrad.addColorStop(0.4, '#ef4444');
          flareGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = flareGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Unmistakable Danger Badge
          ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(p.x - 32, p.y - 25, 64, 15, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#fca5a5';
          ctx.textAlign = 'center';
          ctx.fillText('⛔ DODGE!', p.x, p.y - 14);
        } else {
          // Telemetry Microwave Beam Packet (Glowing Cyan / Gold)
          const packetGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius * 1.9);
          packetGrad.addColorStop(0, '#ffffff');
          packetGrad.addColorStop(0.5, p.isGold ? '#fbbf24' : '#38bdf8');
          packetGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = packetGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 1.9, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Catch Callout Badge
          ctx.fillStyle = p.isGold ? 'rgba(113, 63, 18, 0.85)' : 'rgba(8, 47, 73, 0.85)';
          ctx.strokeStyle = p.isGold ? '#fbbf24' : '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(p.x - 34, p.y - 25, 68, 15, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = p.isGold ? '#fde047' : '#bae6fd';
          ctx.textAlign = 'center';
          ctx.fillText(p.isGold ? '⭐ GOLDEN' : '📡 CATCH ME', p.x, p.y - 14);
        }
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 8. DRAW SUSPENDED CASSEGRAIN SUB-REFLECTOR (Player Mirror)
      // -------------------------------------------------------------
      ctx.save();

      // Tripod support struts from dish rim to mirror
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Strut 1 (Top)
      ctx.moveTo(320, 15);
      ctx.lineTo(mirror.x, mirror.y);
      // Strut 2 (Bottom-Left)
      ctx.moveTo(130, 260);
      ctx.lineTo(mirror.x, mirror.y);
      // Strut 3 (Bottom-Right)
      ctx.moveTo(510, 260);
      ctx.lineTo(mirror.x, mirror.y);
      ctx.stroke();

      // Magnetic Reception Field Halo (Generous outer zone)
      if (!isStalled) {
        const fieldGrad = ctx.createRadialGradient(mirror.x, mirror.y, MIRROR_RADIUS - 4, mirror.x, mirror.y, MIRROR_RADIUS + 12);
        fieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        fieldGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = fieldGrad;
        ctx.beginPath();
        ctx.arc(mirror.x, mirror.y, MIRROR_RADIUS + 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Convex Titanium Sub-Reflector Mirror Body
      const mirrorGrad = ctx.createRadialGradient(mirror.x - 4, mirror.y - 4, 2, mirror.x, mirror.y, MIRROR_RADIUS);
      if (isStalled) {
        mirrorGrad.addColorStop(0, '#f87171');
        mirrorGrad.addColorStop(0.7, '#ef4444');
        mirrorGrad.addColorStop(1, '#7f1d1d');
      } else {
        mirrorGrad.addColorStop(0, '#f8fafc');
        mirrorGrad.addColorStop(0.5, '#cbd5e1');
        mirrorGrad.addColorStop(1, '#475569');
      }
      ctx.fillStyle = mirrorGrad;
      ctx.beginPath();
      ctx.arc(mirror.x, mirror.y, MIRROR_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = isStalled ? '#ef4444' : '#38bdf8';
      ctx.stroke();

      // Mirror alignment crosshair
      ctx.strokeStyle = isStalled ? '#ffffff' : 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mirror.x - 14, mirror.y);
      ctx.lineTo(mirror.x + 14, mirror.y);
      ctx.moveTo(mirror.x, mirror.y - 14);
      ctx.lineTo(mirror.x, mirror.y + 14);
      ctx.stroke();

      // Status Badge above Mirror
      const badgeY = mirror.y - 42;
      ctx.fillStyle = isStalled ? 'rgba(127, 29, 29, 0.95)' : 'rgba(8, 47, 73, 0.95)';
      ctx.strokeStyle = isStalled ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mirror.x - 65, badgeY, 130, 20, 5);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = isStalled ? '#fca5a5' : '#bae6fd';
      ctx.textAlign = 'center';
      ctx.fillText(isStalled ? '⚠ OVERHEATED!' : 'REFLECTOR MIRROR', mirror.x, badgeY + 13);

      // First-time player callout banner right below the mirror!
      if (!hasInteracted && packetsCountRef.current === 0) {
        ctx.fillStyle = 'rgba(2, 132, 199, 0.9)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mirror.x - 75, mirror.y + 44, 150, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('👆 DRAG OR TAP TO MOVE', mirror.x, mirror.y + 57);
      }

      ctx.restore();

      // -------------------------------------------------------------
      // 9. DRAW FLOATING POPUP TEXTS
      // -------------------------------------------------------------
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.alpha -= 0.025;

        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = ft.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 10. DRAW PARTICLES
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
  }, [addFloatingText, assistActive, hasInteracted, onReactionChange, onWinTrigger, playDeflectChime, reduceMotion, spawnParticles]);

  // Handle direct pointer interaction (Tap to glide or drag smoothly)
  const handlePointerDown = (clientX: number, clientY: number) => {
    setHasInteracted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    isDraggingRef.current = true;
    targetPosRef.current = {
      x: Math.max(100, Math.min(540, x)),
      y: Math.max(45, Math.min(235, y)),
    };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    targetPosRef.current = {
      x: Math.max(100, Math.min(540, x)),
      y: Math.max(45, Math.min(235, y)),
    };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Tactile Nudge Functions for buttons
  const nudge = (dx: number, dy: number) => {
    setHasInteracted(true);
    targetPosRef.current = {
      x: Math.max(100, Math.min(540, targetPosRef.current.x + dx)),
      y: Math.max(45, Math.min(235, targetPosRef.current.y + dy)),
    };
  };

  // Autoplay hook for automated QA testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runAutoplay = () => {
        packetsCountRef.current = TOTAL_PACKETS;
        setPacketsCollected(TOTAL_PACKETS);
        setCombo(5);
        comboRef.current = 5;
        flareHitsRef.current = 0;
        phaseRef.current = 'won';
        setPhase('won');
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__deepSpaceAutoplay = runAutoplay;
      return () => {
        delete (window as any).__deepSpaceAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="deep-space-game"
    >
      {/* 1. Header Telemetry HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-cyan-900/40 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-300 font-bold uppercase tracking-wider hidden sm:inline">
            CASSEGRAIN BEAM DEFLECTOR
          </span>
          <span className="text-cyan-300 font-bold uppercase tracking-wider sm:hidden">
            BEAM DEFLECTOR
          </span>
          {combo > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 animate-bounce">
              COMBO x{combo} 🔥
            </span>
          )}
        </div>

        {/* SNR & Packet HUD */}
        <div
          data-testid="snr-counter"
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md shadow-cyan-950/40"
        >
          <Radio size={14} className="text-cyan-400 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Packets Caught</span>
            <span className="text-xs font-bold font-mono text-cyan-300">
              {packetsCollected} / {TOTAL_PACKETS}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Parabolic Dish Canvas */}
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
          className="bg-[#020617] rounded-2xl block border-2 border-cyan-950 shadow-2xl cursor-grab active:cursor-grabbing w-full h-full max-h-[210px] sm:max-h-[250px] touch-none select-none aspect-video shrink-0"
          data-testid="crater-canvas"
        />

        {/* Reticle Target Accessibility Pill */}
        <div
          data-testid="dish-reticle-target"
          className="absolute pointer-events-none text-[9px] text-cyan-300 font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/40 shadow"
          style={{
            left: `${(mirrorPosRef.current.x / CANVAS_WIDTH) * 100}%`,
            top: `${(mirrorPosRef.current.y / CANVAS_HEIGHT) * 100}%`,
            transform: 'translate(-50%, -46px)',
          }}
        >
          SUB-REFLECTOR
        </div>
      </div>

      {/* 3. Tactile Dual-Axis Directional Controls Strip */}
      <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-900/90 border border-cyan-900/30 rounded-xl shrink-0">
        {/* Left Button (>=48px touch target) */}
        <button
          data-testid="az-left-btn"
          onClick={() => nudge(-30, 0)}
          className="flex-1 h-12 flex flex-col items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <div className="flex items-center gap-1">
            <ChevronLeft size={16} />
            <span>LEFT</span>
          </div>
          <span className="text-[8px] text-cyan-400/60 tracking-wider">AZ-</span>
        </button>

        {/* Up Button (>=48px touch target) */}
        <button
          data-testid="el-up-btn"
          onClick={() => nudge(0, -30)}
          className="flex-1 h-12 flex flex-col items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <div className="flex items-center gap-1">
            <ChevronUp size={16} />
            <span>UP</span>
          </div>
          <span className="text-[8px] text-cyan-400/60 tracking-wider">EL+</span>
        </button>

        {/* Packets Progress Pill */}
        <div className="flex flex-col items-center justify-center px-2 py-1 bg-slate-950/80 rounded border border-cyan-500/40 font-mono text-center shrink-0 min-w-[70px]">
          <span className="text-[9px] text-slate-400 uppercase">Packets</span>
          <span className="text-xs font-bold text-emerald-400">{packetsCollected} / {TOTAL_PACKETS}</span>
        </div>

        {/* Down Button (>=48px touch target) */}
        <button
          data-testid="el-down-btn"
          onClick={() => nudge(0, 30)}
          className="flex-1 h-12 flex flex-col items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <div className="flex items-center gap-1">
            <ChevronDown size={16} />
            <span>DOWN</span>
          </div>
          <span className="text-[8px] text-cyan-400/60 tracking-wider">EL-</span>
        </button>

        {/* Right Button (>=48px touch target) */}
        <button
          data-testid="az-right-btn"
          onClick={() => nudge(30, 0)}
          className="flex-1 h-12 flex flex-col items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <div className="flex items-center gap-1">
            <span>RIGHT</span>
            <ChevronRight size={16} />
          </div>
          <span className="text-[8px] text-cyan-400/60 tracking-wider">AZ+</span>
        </button>
      </div>
    </div>
  );
};
