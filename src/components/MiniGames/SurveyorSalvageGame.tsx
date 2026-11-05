import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Wrench, Award, CheckCircle2, ShieldCheck, Gauge, Zap } from 'lucide-react';

interface SurveyorSalvageGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
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

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export const SurveyorSalvageGame: React.FC<SurveyorSalvageGameProps> = ({
  wreckId = 'eq_surveyor',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Surveyor 3 Surface Sampler online! Dig the lunar trench to reach bedrock, then press down with 400 PSI to prove the Moon is safe for landing!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Robotic pantograph reset! Drag the scoop to carve the trench, then hold bearing pressure in the green safe zone!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="The Bedrock Bearing Test"
      instruction="Operate Surveyor 3's motorized robotic arm! Dig through lunar regolith to reach basalt bedrock, then hold 400 PSI bearing pressure to confirm the Moon is safe for Apollo!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <SurveyorBearingContent
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

export default SurveyorSalvageGame;

interface SurveyorBearingContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;

export const SurveyorBearingContent: React.FC<SurveyorBearingContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  // Phase 1: 'digging' (trenching soil) -> Phase 2: 'bearing' (pressure test) -> 'won'
  const [phase, setPhase] = useState<'digging' | 'bearing' | 'won'>('digging');
  const [trenchProgress, setTrenchProgress] = useState(0);
  const [bearingPsi, setBearingPsi] = useState(0);
  const [holdTimeSeconds, setHoldTimeSeconds] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const phaseRef = useRef<'digging' | 'bearing' | 'won'>('digging');
  phaseRef.current = phase;

  // Pantograph Arm Kinematics & Position
  const armXRef = useRef(320);
  const armYRef = useRef(180);
  const targetXRef = useRef(320);
  const targetYRef = useRef(180);
  const scoopAngleRef = useRef(0.2); // Angle of bucket
  const isDraggingRef = useRef(false);
  const isPressingForceRef = useRef(false);
  const shakeRef = useRef(0);

  // Excavation Trench Model: 16 discrete soil depth nodes along X in [180, 520]
  const trenchDepthsRef = useRef<number[]>(new Array(16).fill(0)); // 0 = surface, 35 = bedrock

  // Bearing Pressure Test
  const currentPsiRef = useRef(0);
  const targetPsiRef = useRef(0);
  const holdProgressRef = useRef(0); // 0 to 3.0 seconds

  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Synthesize procedural audio effects
  const playMotorHum = useCallback((pitch = 180) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.15, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio fallback
    }
  }, []);

  const playSoilCrunch = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio fallback
    }
  }, []);

  const playChimeLock = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime);
      osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.1);

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

  // Spawn visual particles
  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.2 + 0.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        radius: Math.random() * 2.8 + 1.2,
        color,
        alpha: 1.0,
        decay: 0.04 + Math.random() * 0.025,
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

  // Main canvas animation and rendering loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Smooth kinematic interpolation
      armXRef.current += (targetXRef.current - armXRef.current) * 0.22;
      armYRef.current += (targetYRef.current - armYRef.current) * 0.22;

      // Screen shake decay
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - 0.6);
      }
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;

      // -------------------------------------------------------------
      // 1. UPDATE PHASE LOGIC
      // -------------------------------------------------------------
      if (phaseRef.current === 'digging') {
        // Check if arm scoop is interacting with the trench soil
        const scoopX = armXRef.current;
        const scoopY = armYRef.current;

        // Trench boundary: X in [200, 520], surface Y around 195
        if (scoopX >= 200 && scoopX <= 520 && scoopY >= 185) {
          const nodeIndex = Math.min(
            15,
            Math.max(0, Math.floor(((scoopX - 200) / 320) * 16))
          );
          const currentDepth = trenchDepthsRef.current[nodeIndex];
          const digRate = assistActive ? 2.5 : 1.4;

          if (currentDepth < 36) {
            trenchDepthsRef.current[nodeIndex] = Math.min(36, currentDepth + digRate);
            playMotorHum(160);
            playSoilCrunch();
            if (!reduceMotion && Math.random() < 0.4) shakeRef.current = 2.5;

            // Soil gravel particles spraying in 1/6g
            spawnParticles(scoopX, scoopY, 2, '#94a3b8');

            // Calculate total excavation progress across all nodes
            const totalExcavated = trenchDepthsRef.current.reduce((sum, d) => sum + d, 0);
            const maxExcavated = 16 * 36;
            const percent = Math.min(100, Math.round((totalExcavated / (maxExcavated * 0.72)) * 100));
            setTrenchProgress(percent);

            if (percent >= 100) {
              phaseRef.current = 'bearing';
              setPhase('bearing');
              playChimeLock();
              sound.playSuccess();
              if (!reduceMotion) shakeRef.current = 10;
              spawnParticles(scoopX, scoopY, 30, '#38bdf8');
              addFloatingText(scoopX, scoopY - 30, 'BEDROCK REACHED! ⛏️', '#38bdf8');
              onReactionChange('Basalt bedrock reached! Press and hold 400 PSI bearing force to confirm Apollo safety!');

              // Rest position in center of trench
              targetXRef.current = 360;
              targetYRef.current = 228;
            }
          }
        }
      } else if (phaseRef.current === 'bearing') {
        // -------------------------------------------------------------
        // PHASE 2: BEARING PRESSURE GAUGING
        // -------------------------------------------------------------
        const isPressing = isPressingForceRef.current || isDraggingRef.current;
        targetPsiRef.current = isPressing ? 385 + (Math.sin(Date.now() / 180) * 30) : 0;

        // Smooth needle physics
        currentPsiRef.current += (targetPsiRef.current - currentPsiRef.current) * 0.12;
        const psi = Math.max(0, Math.round(currentPsiRef.current));
        setBearingPsi(psi);

        // Optimal green zone is between 320 and 440 PSI
        const inGreenZone = psi >= 310 && psi <= 450;

        if (inGreenZone) {
          holdProgressRef.current = Math.min(3.0, holdProgressRef.current + 0.016);
          setHoldTimeSeconds(parseFloat(holdProgressRef.current.toFixed(1)));
          if (Math.random() < 0.25) {
            spawnParticles(armXRef.current, armYRef.current, 1, '#22c55e');
          }

          if (holdProgressRef.current >= 3.0) {
            phaseRef.current = 'won';
            setPhase('won');
            sound.playSuccess();
            if (!reduceMotion) shakeRef.current = 14;
            spawnParticles(armXRef.current, armYRef.current, 40, '#22c55e');
            spawnParticles(armXRef.current, armYRef.current, 25, '#fbbf24');
            addFloatingText(armXRef.current, 140, 'BEARING LOAD CONFIRMED! 🏆', '#22c55e');

            onReactionChange(
              'VICTORY! Bearing strength verified at 400 PSI! Lunar soil confirmed solid bedrock—safe for Apollo astronauts!'
            );
            onWinTrigger({ stars: 3 });
          }
        } else {
          // Slowly decay if pressure drops below target
          holdProgressRef.current = Math.max(0, holdProgressRef.current - 0.02);
          setHoldTimeSeconds(parseFloat(holdProgressRef.current.toFixed(1)));
        }
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

      // -------------------------------------------------------------
      // 2. RENDER LUNAR BACKDROP (Oceanus Procellarum)
      // -------------------------------------------------------------
      // Deep space starry sky
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 45; i++) {
        const sx = (i * 91) % CANVAS_WIDTH;
        const sy = (i * 43) % 65;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // Distant Earth in lunar sky
      const earthX = 540;
      const earthY = 38;
      const earthGrad = ctx.createRadialGradient(earthX - 2, earthY - 2, 2, earthX, earthY, 18);
      earthGrad.addColorStop(0, '#bae6fd');
      earthGrad.addColorStop(0.35, '#0284c7');
      earthGrad.addColorStop(0.7, '#0369a1');
      earthGrad.addColorStop(0.9, '#082f49');
      earthGrad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthX, earthY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Distant crater rim mountains
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 68);
      ctx.lineTo(90, 52);
      ctx.lineTo(210, 62);
      ctx.lineTo(340, 48);
      ctx.lineTo(470, 64);
      ctx.lineTo(CANVAS_WIDTH, 56);
      ctx.lineTo(CANVAS_WIDTH, 68);
      ctx.closePath();
      ctx.fill();

      // Lunar Regolith Surface & Trench Stratum
      const surfaceY = 195;
      const groundGrad = ctx.createLinearGradient(0, 68, 0, CANVAS_HEIGHT);
      groundGrad.addColorStop(0, '#1e293b');
      groundGrad.addColorStop(0.35, '#334155');
      groundGrad.addColorStop(0.7, '#475569');
      groundGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 68, CANVAS_WIDTH, CANVAS_HEIGHT - 68);

      // -------------------------------------------------------------
      // 3. DRAW EXCAVATED LUNAR TRENCH & BEDROCK STRATA
      // -------------------------------------------------------------
      ctx.save();
      // Outer trench rim drop shadow
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(195, surfaceY);
      for (let i = 0; i < 16; i++) {
        const nx = 200 + i * 20;
        const ny = surfaceY + trenchDepthsRef.current[i];
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(525, surfaceY);
      ctx.lineTo(525, CANVAS_HEIGHT);
      ctx.lineTo(195, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Basalt Bedrock Layer (Dense dark rock floor revealed when dug)
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(200, surfaceY + 36);
      ctx.lineTo(520, surfaceY + 36);
      ctx.lineTo(520, CANVAS_HEIGHT);
      ctx.lineTo(200, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Bedrock texture veins
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1;
      for (let vx = 220; vx <= 500; vx += 40) {
        ctx.beginPath();
        ctx.moveTo(vx, surfaceY + 36);
        ctx.lineTo(vx + 15, CANVAS_HEIGHT);
        ctx.stroke();
      }

      // Soil layer callout labels along left wall of trench
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('DUST 0-2cm', 140, surfaceY + 8);
      ctx.fillStyle = '#64748b';
      ctx.fillText('REGOLITH 2-8cm', 125, surfaceY + 22);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('BEDROCK >8cm', 130, surfaceY + 45);

      ctx.restore();

      // -------------------------------------------------------------
      // 4. DRAW SURVEYOR 3 LANDER CHASSIS (Left Anchor)
      // -------------------------------------------------------------
      const landerX = 90;
      const landerY = 160;

      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(landerX + 15, surfaceY + 8, 85, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Landing Gear Shock Strut with Honeycomb Footpad
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(landerX + 20, landerY + 10);
      ctx.lineTo(landerX + 70, surfaceY + 4);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(landerX + 70, surfaceY + 4, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Triangular Truss Chassis
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(landerX - 40, landerY + 20);
      ctx.lineTo(landerX + 10, landerY - 45);
      ctx.lineTo(landerX + 50, landerY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold Foil Compartment A
      ctx.fillStyle = '#ca8a04';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.fillRect(landerX - 25, landerY - 15, 30, 24);
      ctx.strokeRect(landerX - 25, landerY - 15, 30, 24);

      // Central Mast
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(landerX + 10, landerY - 45);
      ctx.lineTo(landerX + 10, landerY - 95);
      ctx.stroke();

      // Planar Solar Array
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(landerX - 8, landerY - 118, 36, 22, 2);
      ctx.fill();
      ctx.stroke();

      // TV Camera Housing
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(landerX - 38, landerY - 45, 24, 30, 3);
      ctx.fill();
      ctx.stroke();

      // Camera lens
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(landerX - 26, landerY - 30, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // -------------------------------------------------------------
      // 5. MOTORIZED PANTOGRAPH SCISSOR ARM (Active Robotic Arm)
      // -------------------------------------------------------------
      const armBaseX = landerX + 45;
      const armBaseY = landerY + 5;
      const scoopX = armXRef.current;
      const scoopY = armYRef.current;

      // Scissor Elbow Joint calculated dynamically
      const midX = (armBaseX + scoopX) / 2;
      const midY = Math.min(armBaseY, scoopY) - 35;

      ctx.save();
      // Scissor Struts (Lightweight tubular aluminum)
      ctx.strokeStyle = phaseRef.current === 'won' ? '#22c55e' : '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      // Upper arm link
      ctx.moveTo(armBaseX, armBaseY);
      ctx.lineTo(midX - 10, midY);
      ctx.lineTo(scoopX, scoopY - 8);
      ctx.stroke();

      // Lower cross link
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(armBaseX + 10, armBaseY + 8);
      ctx.lineTo(midX + 10, midY + 12);
      ctx.lineTo(scoopX - 12, scoopY + 2);
      ctx.stroke();

      // Stepper Motor Hubs & Chrome Pivot Rivets
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(midX - 10, midY, 6, 0, Math.PI * 2);
      ctx.arc(armBaseX, armBaseY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Motorized Scoop Bucket (Oriented flat during bearing test)
      ctx.translate(scoopX, scoopY);
      if (phaseRef.current === 'bearing' || phaseRef.current === 'won') {
        // Flat orientation pressing into bedrock
        ctx.fillStyle = phaseRef.current === 'won' ? '#22c55e' : '#eab308';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-16, -10, 32, 16, 4);
        ctx.fill();
        ctx.stroke();

        // Pressure Force Vector Arrows
        if (phaseRef.current === 'bearing' && currentPsiRef.current > 100) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 10);
          ctx.lineTo(0, 24);
          ctx.moveTo(-4, 18);
          ctx.lineTo(0, 24);
          ctx.lineTo(4, 18);
          ctx.stroke();
        }
      } else {
        // Angled digging scoop
        ctx.rotate(scoopAngleRef.current);
        ctx.fillStyle = '#eab308';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-12, -14, 24, 20, 3);
        ctx.fill();
        ctx.stroke();

        // Hardened Titanium Ground Teeth
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(12, -8);
        ctx.lineTo(16, -4);
        ctx.lineTo(12, 0);
        ctx.lineTo(16, 4);
        ctx.lineTo(12, 8);
        ctx.fill();
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 6. PHASE 2 OVERLAY: ANALOG SOIL BEARING PRESSURE GAUGE
      // -------------------------------------------------------------
      if (phaseRef.current === 'bearing') {
        const gaugeX = 490;
        const gaugeY = 125;
        const gaugeRadius = 48;
        const psi = currentPsiRef.current;

        ctx.save();
        // Outer Chrome Gauge Bezel
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(gaugeX, gaugeY, gaugeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Color Arc Segments: Red (0-240), Yellow (240-310), Green (310-440), Red (>440)
        // Angle range: -Math.PI * 0.75 to Math.PI * 0.75
        const startAng = -Math.PI * 0.75;
        const totalAng = Math.PI * 1.5;

        // Red Zone (Soft quicksand hazard)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(gaugeX, gaugeY, gaugeRadius - 7, startAng, startAng + totalAng * 0.5);
        ctx.stroke();

        // Green Zone (Apollo Safe Bedrock: 310 - 450 PSI)
        ctx.strokeStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(gaugeX, gaugeY, gaugeRadius - 7, startAng + totalAng * 0.5, startAng + totalAng * 0.9);
        ctx.stroke();

        // Needle Rotation Angle (0 to 500 PSI)
        const needleRatio = Math.min(1.0, Math.max(0, psi / 500));
        const needleAngle = startAng + totalAng * needleRatio;

        // Draw Needle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(gaugeX, gaugeY);
        ctx.lineTo(gaugeX + Math.cos(needleAngle) * (gaugeRadius - 12), gaugeY + Math.sin(needleAngle) * (gaugeRadius - 12));
        ctx.stroke();

        // Center Pin
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(gaugeX, gaugeY, 5, 0, Math.PI * 2);
        ctx.fill();

        // PSI Digital Readout Badge
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = psi >= 310 && psi <= 450 ? '#22c55e' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(gaugeX - 40, gaugeY + 54, 80, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = psi >= 310 && psi <= 450 ? '#4ade80' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${psi} PSI`, gaugeX, gaugeY + 68);

        // Target Zone Label
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#bae6fd';
        ctx.fillText('TARGET: 400 PSI', gaugeX, gaugeY - 54);

        // Verification Hold Meter
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gaugeX - 55, gaugeY + 78, 110, 14, 3);
        ctx.fill();
        ctx.stroke();

        const holdPercent = Math.min(1.0, holdProgressRef.current / 3.0);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(gaugeX - 53, gaugeY + 80, holdPercent * 106, 10);

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`HOLD: ${holdTimeSeconds}s / 3.0s`, gaugeX, gaugeY + 88);

        ctx.restore();
      }

      // -------------------------------------------------------------
      // 7. WINNING CELEBRATION OVERLAY
      // -------------------------------------------------------------
      if (phaseRef.current === 'won') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(140, 95, 360, 75, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 BEDROCK BEARING CONFIRMED! 🏆', 320, 124);

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#bae6fd';
        ctx.fillText('Soil strength: 400 PSI · Zero quicksand risk!', 320, 144);
        ctx.fillStyle = '#fde047';
        ctx.fillText('Surveyor 3 proved Moon is safe for Apollo landings!', 320, 158);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 8. PARTICLES & FLOATING TEXTS
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

      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.alpha -= 0.024;

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

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [addFloatingText, assistActive, holdTimeSeconds, onReactionChange, onWinTrigger, playChimeLock, playMotorHum, playSoilCrunch, reduceMotion, spawnParticles]);

  // Pointer interactions
  const handlePointerDown = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (phaseRef.current === 'digging') {
      targetXRef.current = Math.max(180, Math.min(520, x));
      targetYRef.current = Math.max(140, Math.min(235, y));
    } else if (phaseRef.current === 'bearing') {
      isPressingForceRef.current = true;
    }
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

    if (phaseRef.current === 'digging') {
      targetXRef.current = Math.max(180, Math.min(520, x));
      targetYRef.current = Math.max(140, Math.min(235, y));
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    isPressingForceRef.current = false;
  };

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (phaseRef.current === 'digging') {
          targetXRef.current = 240 + Math.random() * 260;
          targetYRef.current = 210;
        } else if (phaseRef.current === 'bearing') {
          isPressingForceRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        isPressingForceRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Autoplay hook for test automation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runAutoplay = () => {
        trenchDepthsRef.current = new Array(16).fill(36);
        setTrenchProgress(100);
        currentPsiRef.current = 400;
        setBearingPsi(400);
        holdProgressRef.current = 3.0;
        setHoldTimeSeconds(3.0);
        phaseRef.current = 'won';
        setPhase('won');
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__surveyorAutoplay = runAutoplay;
      return () => {
        delete (window as any).__surveyorAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="surveyor-game"
    >
      {/* 1. Header Telemetry HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-slate-700/60 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-200 font-bold uppercase tracking-wider hidden sm:inline">
            SURVEYOR 3 · BEDROCK BEARING TEST
          </span>
          <span className="text-slate-200 font-bold uppercase tracking-wider sm:hidden">
            BEARING TEST
          </span>
          <span
            data-testid="surveyor-status-pill"
            className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 text-[10px]"
          >
            {phase === 'digging'
              ? 'PHASE 1: DIG TRENCH'
              : phase === 'bearing'
              ? 'PHASE 2: 400 PSI LOAD TEST'
              : 'BEARING VERIFIED!'}
          </span>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md">
          <Gauge size={14} className="text-cyan-400 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">
              {phase === 'digging' ? 'Trench Depth' : 'Bearing Load'}
            </span>
            <span className="text-xs font-bold font-mono text-cyan-300">
              {phase === 'digging' ? `${trenchProgress}%` : `${bearingPsi} PSI`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Lunar Surface Canvas */}
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
          className="bg-[#020617] rounded-2xl block border-2 border-slate-800 shadow-2xl cursor-grab active:cursor-grabbing w-full h-full max-h-[220px] sm:max-h-[260px] touch-none select-none aspect-video shrink-0"
          data-testid="surveyor-canvas"
        />

        {/* Phase 1 helper banner */}
        {phase === 'digging' && trenchProgress < 20 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 pointer-events-none text-[10px] text-cyan-300 font-mono font-bold bg-slate-950/90 px-3 py-1 rounded-full border border-cyan-500/40 shadow animate-pulse">
            👉 DRAG SCOOP ALONG SOIL TO DIG TRENCH
          </div>
        )}
      </div>

      {/* 3. Tactile Action Controls Strip */}
      <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl shrink-0">
        {/* Primary Action Button (>=48px touch target) */}
        <button
          data-testid="surveyor-action-btn"
          onPointerDown={() => {
            if (phase === 'digging') {
              targetXRef.current = 240 + Math.random() * 260;
              targetYRef.current = 210;
            } else if (phase === 'bearing') {
              isPressingForceRef.current = true;
            }
          }}
          onPointerUp={() => {
            isPressingForceRef.current = false;
          }}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          {phase === 'digging' ? (
            <>
              <Wrench size={18} className="text-cyan-400" />
              <span>DIG TRENCH TO BEDROCK ({trenchProgress}%)</span>
            </>
          ) : phase === 'bearing' ? (
            <>
              <Gauge size={18} className="text-emerald-400" />
              <span>HOLD BEARING FORCE ({bearingPsi} PSI)</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>APOLLO BEARING CAPACITY CONFIRMED</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
