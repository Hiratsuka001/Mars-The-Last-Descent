import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Scissors, Sparkles, Wrench, Hand, Award, CheckCircle2, Zap } from 'lucide-react';

interface SurveyorSalvageGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface DustSpot {
  id: number;
  x: number;
  y: number;
  radius: number;
  cleared: boolean;
  opacity: number;
  label: string;
}

interface Pin {
  id: number;
  x: number;
  y: number;
  unlatched: boolean;
  label: string;
  recoilY: number;
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
    'Surveyor 3 reached in Oceanus Procellarum! Brush away 31 months of lunar dust, unlatch collar pins, and snip the sample arm!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Apollo 12 tool kit ready! Clear lunar dust, unpin the bracket, and sever the wiring harness!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="The Apollo 12 Salvage"
      instruction="Retrieve Surveyor 3's historic surface sampler! 1: Brush off lunar dust. 2: Unlatch 3 collar pins. 3: Snip the wiring harness!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <SurveyorSalvageContent
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

interface SurveyorSalvageContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;

export const SurveyorSalvageContent: React.FC<SurveyorSalvageContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  // 3 sequential steps: 'brushing' -> 'unpinning' -> 'snipping' -> 'won'
  const [step, setStep] = useState<'brushing' | 'unpinning' | 'snipping' | 'won'>('brushing');
  const [dustProgress, setDustProgress] = useState(0);
  const [pinsUnlatchedCount, setPinsUnlatchedCount] = useState(0);
  const [snipProgress, setSnipProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const stepRef = useRef<'brushing' | 'unpinning' | 'snipping' | 'won'>('brushing');
  stepRef.current = step;

  // Glove / Tool tracking position
  const glovePosRef = useRef({ x: 380, y: 220 });
  const targetGlovePosRef = useRef({ x: 380, y: 220 });
  const isInteractingRef = useRef(false);
  const shakeRef = useRef(0);
  const armSagRef = useRef(0); // Scissor arm visibly sags as pins are removed!
  const flashAlphaRef = useRef(0);

  // Phase 1: Dust Spots to scrub
  const dustSpotsRef = useRef<DustSpot[]>([
    { id: 1, x: 260, y: 135, radius: 38, cleared: false, opacity: 0.95, label: 'TV Camera' },
    { id: 2, x: 330, y: 95, radius: 42, cleared: false, opacity: 0.95, label: 'Solar Mast' },
    { id: 3, x: 410, y: 170, radius: 44, cleared: false, opacity: 0.92, label: 'Scissor Arm Hinge' },
    { id: 4, x: 285, y: 195, radius: 40, cleared: false, opacity: 0.88, label: 'Electronics Box' },
  ]);

  // Phase 2: 3 Quick-Release Retaining Collar Pins
  const pinsRef = useRef<Pin[]>([
    { id: 1, x: 325, y: 115, unlatched: false, label: 'Upper Mast Pin', recoilY: 0 },
    { id: 2, x: 385, y: 155, unlatched: false, label: 'Pivot Bracket Pin', recoilY: 0 },
    { id: 3, x: 445, y: 195, unlatched: false, label: 'Lower Strut Pin', recoilY: 0 },
  ]);

  // Phase 3: Cable Snip Pressure
  const cutPressureRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Synthesize rich procedural audio effects
  const playBrushSwoosh = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // Audio fallback
    }
  }, []);

  const playPinClink = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(940, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1480, ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      sound.playSonarPing();
    }
  }, []);

  const playBiteCrunch = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio fallback
    }
  }, []);

  const playShearSnap = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      sound.playSuccess();
    }
  }, []);

  // Spawn visual particles
  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.8 + 1.0;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        radius: Math.random() * 2.8 + 1.2,
        color,
        alpha: 1.0,
        decay: 0.038 + Math.random() * 0.025,
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

  // Handle pointer scrub / clicks across all phases
  const handlePointerAction = useCallback((canvasX: number, canvasY: number) => {
    targetGlovePosRef.current = { x: canvasX, y: canvasY };

    // -------------------------------------------------------------
    // STEP 1: BRUSHING LUNAR DUST
    // -------------------------------------------------------------
    if (stepRef.current === 'brushing') {
      let anyCleaned = false;
      for (const spot of dustSpotsRef.current) {
        const dist = Math.hypot(canvasX - spot.x, canvasY - spot.y);
        if (dist < spot.radius + 24 && spot.opacity > 0) {
          const scrubRate = assistActive ? 0.38 : 0.22;
          spot.opacity = Math.max(0, spot.opacity - scrubRate);
          anyCleaned = true;

          // Silver lunar dust puff particles
          spawnParticles(canvasX, canvasY, 3, '#cbd5e1');

          if (spot.opacity <= 0.05 && !spot.cleared) {
            spot.cleared = true;
            spot.opacity = 0;
            sound.playSuccess();
            spawnParticles(spot.x, spot.y, 14, '#38bdf8');
            addFloatingText(spot.x, spot.y - 15, `✨ ${spot.label} Clean!`, '#38bdf8');
          }
        }
      }

      if (anyCleaned) {
        playBrushSwoosh();
        const totalRemaining = dustSpotsRef.current.reduce((sum, s) => sum + s.opacity, 0);
        const maxDust = dustSpotsRef.current.length * 0.95;
        const percent = Math.min(100, Math.round(((maxDust - totalRemaining) / maxDust) * 100));
        setDustProgress(percent);

        if (percent >= 88) {
          stepRef.current = 'unpinning';
          setStep('unpinning');
          sound.playSuccess();
          onReactionChange('Dust cleared! 3 retaining collar pins exposed! Tap each pin to unlatch!');
          spawnParticles(320, 150, 30, '#38bdf8');
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 2: UNPINNING COLLAR PINS
    // -------------------------------------------------------------
    else if (stepRef.current === 'unpinning') {
      for (const pin of pinsRef.current) {
        if (!pin.unlatched) {
          const dist = Math.hypot(canvasX - pin.x, canvasY - pin.y);
          if (dist < 38) {
            pin.unlatched = true;
            pin.recoilY = -35;
            armSagRef.current += 5; // Scissor arm visibly droops loose!
            playPinClink();
            if (!reduceMotion) shakeRef.current = 6;
            spawnParticles(pin.x, pin.y, 18, '#eab308');
            addFloatingText(pin.x, pin.y - 20, `⚡ PIN POPPED!`, '#eab308');

            const unlatchedCount = pinsRef.current.filter((p) => p.unlatched).length;
            setPinsUnlatchedCount(unlatchedCount);
            onReactionChange(`UNLATCHED ${pin.label.toUpperCase()}! [ ${unlatchedCount}/3 ]`);

            if (unlatchedCount >= 3) {
              stepRef.current = 'snipping';
              setStep('snipping');
              sound.playSuccess();
              onReactionChange('Collar pins released! Squeeze bolt cutters to sever the wiring harness!');
              spawnParticles(320, 150, 30, '#22c55e');
            }
            break;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 3: SNIPPING WIRING HARNESS
    // -------------------------------------------------------------
    else if (stepRef.current === 'snipping') {
      const cutTargetX = 425;
      const cutTargetY = 180;
      const dist = Math.hypot(canvasX - cutTargetX, canvasY - cutTargetY);

      if (dist < 90) {
        cutPressureRef.current = Math.min(100, cutPressureRef.current + (assistActive ? 35 : 25));
        setSnipProgress(cutPressureRef.current);
        playBiteCrunch();
        if (!reduceMotion) shakeRef.current = 4;
        spawnParticles(cutTargetX, cutTargetY, 8, '#f59e0b');

        if (cutPressureRef.current >= 100) {
          stepRef.current = 'won';
          setStep('won');
          armSagRef.current = 24; // Arm drops free into hands!
          flashAlphaRef.current = 0.8;
          playShearSnap();
          sound.playSuccess();
          if (!reduceMotion) shakeRef.current = 16;
          spawnParticles(cutTargetX, cutTargetY, 40, '#38bdf8');
          spawnParticles(cutTargetX, cutTargetY, 25, '#fbbf24');
          addFloatingText(cutTargetX, cutTargetY - 30, `✂️ CABLE SEVERED! +100%`, '#22c55e');

          onReactionChange(
            'SNAP! WIRING HARNESS SEVERED! Surveyor 3 surface sampler secured for Earth return!'
          );
          onWinTrigger({ stars: 3 });
        }
      }
    }
  }, [addFloatingText, assistActive, onReactionChange, onWinTrigger, playBiteCrunch, playBrushSwoosh, playPinClink, playShearSnap, reduceMotion, spawnParticles]);

  // Main canvas animation and rendering loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Smooth glove follow
      glovePosRef.current.x += (targetGlovePosRef.current.x - glovePosRef.current.x) * 0.25;
      glovePosRef.current.y += (targetGlovePosRef.current.y - glovePosRef.current.y) * 0.25;

      // Update screen shake
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - 0.6);
      }
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

      // -------------------------------------------------------------
      // 1. RENDER SURVEYOR CRATER BACKDROP (Oceanus Procellarum)
      // -------------------------------------------------------------
      // Deep space starry void
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        const sx = (i * 91) % CANVAS_WIDTH;
        const sy = (i * 43) % 75;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // Beautiful Earth Marble in lunar sky with blue atmosphere rim
      const earthX = 530;
      const earthY = 42;
      const earthGrad = ctx.createRadialGradient(earthX - 3, earthY - 3, 2, earthX, earthY, 20);
      earthGrad.addColorStop(0, '#bae6fd');
      earthGrad.addColorStop(0.35, '#0284c7');
      earthGrad.addColorStop(0.7, '#0369a1');
      earthGrad.addColorStop(0.9, '#082f49');
      earthGrad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthX, earthY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric limb glow
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Surveyor Crater Slope (12-degree lunar regolith incline)
      const craterGrad = ctx.createLinearGradient(0, 68, 0, CANVAS_HEIGHT);
      craterGrad.addColorStop(0, '#1e293b');
      craterGrad.addColorStop(0.25, '#334155');
      craterGrad.addColorStop(0.65, '#475569');
      craterGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = craterGrad;
      ctx.fillRect(0, 68, CANVAS_WIDTH, CANVAS_HEIGHT - 68);

      // Distant Apollo 12 LM "Intrepid" perched on crater rim
      const lmX = 135;
      const lmY = 68;
      ctx.save();
      // Descent stage with gold mylar foil
      ctx.fillStyle = '#ca8a04';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(lmX - 18, lmY - 14, 36, 16, 2);
      ctx.fill();
      ctx.stroke();

      // Outrigger gear legs
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lmX - 16, lmY);
      ctx.lineTo(lmX - 26, lmY + 12);
      ctx.moveTo(lmX + 16, lmY);
      ctx.lineTo(lmX + 26, lmY + 12);
      ctx.stroke();

      // Ascent stage cabin
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.roundRect(lmX - 12, lmY - 26, 24, 12, 3);
      ctx.fill();

      // American Flag on lunar surface
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lmX + 32, lmY);
      ctx.lineTo(lmX + 32, lmY - 22);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(lmX + 32, lmY - 22, 12, 7);

      // Footprints in lunar dust trailing down from Intrepid to Surveyor!
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      for (let i = 0; i < 9; i++) {
        const fpx = lmX + 35 + i * 16;
        const fpy = lmY + 12 + i * 11;
        ctx.beginPath();
        ctx.ellipse(fpx, fpy, 3.5, 2, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 7px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('LM INTREPID (180m)', lmX, lmY + 22);
      ctx.restore();

      // -------------------------------------------------------------
      // 2. HIGH-DETAIL SURVEYOR 3 MODEL
      // -------------------------------------------------------------
      const landerX = 320;
      const landerY = 175;

      ctx.save();
      // Drop Shadow on Lunar Regolith
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(landerX + 25, landerY + 58, 130, 36, 0.12, 0, Math.PI * 2);
      ctx.fill();

      // 3 Outrigger Landing Legs with Shock Struts & Crushable Honeycomb Footpads
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      // Leg 1 (Left)
      ctx.beginPath();
      ctx.moveTo(landerX - 45, landerY + 20);
      ctx.lineTo(landerX - 115, landerY + 55);
      ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(landerX - 115, landerY + 55, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Leg 2 (Right)
      ctx.beginPath();
      ctx.moveTo(landerX + 45, landerY + 20);
      ctx.lineTo(landerX + 115, landerY + 55);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(landerX + 115, landerY + 55, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Conical Omnidirectional Antenna Horn on Leg 1
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(landerX - 115, landerY + 50);
      ctx.lineTo(landerX - 128, landerY + 25);
      ctx.lineTo(landerX - 105, landerY + 25);
      ctx.closePath();
      ctx.fill();

      // Triangular Aluminum Tube Frame Spacecraft Body
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(landerX - 52, landerY + 25);
      ctx.lineTo(landerX, landerY - 48);
      ctx.lineTo(landerX + 52, landerY + 25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold Thermal Insulation Compartment Boxes (A and B)
      ctx.fillStyle = '#ca8a04';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.fillRect(landerX - 38, landerY - 5, 30, 22);
      ctx.strokeRect(landerX - 38, landerY - 5, 30, 22);

      ctx.fillRect(landerX + 8, landerY - 5, 30, 22);
      ctx.strokeRect(landerX + 8, landerY - 5, 30, 22);

      // Central Tubular Mast (Supports Solar Array and Antenna)
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(landerX, landerY - 48);
      ctx.lineTo(landerX, landerY - 105);
      ctx.stroke();

      // Planar Solar Array with Silicon Photovoltaic Cell Grid
      ctx.fillStyle = '#0369a1';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(landerX - 25, landerY - 128, 50, 26, 3);
      ctx.fill();
      ctx.stroke();

      // Solar Cell Grid Lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      for (let gx = -18; gx <= 18; gx += 9) {
        ctx.beginPath();
        ctx.moveTo(landerX + gx, landerY - 128);
        ctx.lineTo(landerX + gx, landerY - 102);
        ctx.stroke();
      }

      // High-Gain Parabolic Antenna Horn
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(landerX + 28, landerY - 95, 10, 0, Math.PI * 2);
      ctx.fill();

      // TV Camera Housing with Rotating Optical Mirror
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(landerX - 62, landerY - 38, 28, 42, 4);
      ctx.fill();
      ctx.stroke();

      // Camera Optical Lens Aperture
      const lensGrad = ctx.createRadialGradient(landerX - 48, landerY - 20, 2, landerX - 48, landerY - 20, 8);
      lensGrad.addColorStop(0, '#ffffff');
      lensGrad.addColorStop(0.5, '#0284c7');
      lensGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(landerX - 48, landerY - 20, 8, 0, Math.PI * 2);
      ctx.fill();

      // -------------------------------------------------------------
      // 3. MOTORIZED PANTOGRAPH SCISSOR SAMPLE ARM
      // -------------------------------------------------------------
      const sag = armSagRef.current;
      const armBaseX = landerX + 26;
      const armBaseY = landerY - 8 + sag * 0.2;
      const elbowX = landerX + 88 + sag * 0.4;
      const elbowY = landerY + 16 + sag * 0.6;
      const scoopX = landerX + 135 + sag * 0.6;
      const scoopY = landerY + 46 + sag;

      // Pantograph Scissor Struts (Crossed links)
      ctx.strokeStyle = stepRef.current === 'won' ? '#22c55e' : '#cbd5e1';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(armBaseX, armBaseY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(scoopX, scoopY);
      ctx.stroke();

      // Cross-link brace
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(armBaseX + 15, armBaseY + 8);
      ctx.lineTo(elbowX - 10, elbowY - 6);
      ctx.stroke();

      // Motorized Gearbox Hub on Elbow
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(elbowX, elbowY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Titanium Surface Scoop Bucket with Soil Teeth
      ctx.fillStyle = stepRef.current === 'won' ? '#22c55e' : '#eab308';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(scoopX - 10, scoopY - 12, 26, 20, 4);
      ctx.fill();
      ctx.stroke();

      // Soil Cutter Teeth
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(scoopX + 16, scoopY - 8);
      ctx.lineTo(scoopX + 20, scoopY - 5);
      ctx.lineTo(scoopX + 16, scoopY - 2);
      ctx.lineTo(scoopX + 20, scoopY + 2);
      ctx.lineTo(scoopX + 16, scoopY + 5);
      ctx.fill();

      // Braided Wiring Cable Harness (Connects mast to scoop motor)
      if (stepRef.current !== 'won') {
        const cut = cutPressureRef.current;
        ctx.strokeStyle = cut > 0 ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = Math.max(1, 3 - (cut / 100) * 2);
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(armBaseX, armBaseY + 6);
        ctx.quadraticCurveTo(armBaseX + 48, armBaseY + 34, elbowX + 16, elbowY + 12);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      // -------------------------------------------------------------
      // 4. STEP 1 OVERLAY: LUNAR DUST SPOTS (Scrub to Clean)
      // -------------------------------------------------------------
      if (stepRef.current === 'brushing') {
        for (const spot of dustSpotsRef.current) {
          if (spot.opacity > 0) {
            ctx.save();
            const grad = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, spot.radius);
            grad.addColorStop(0, `rgba(148, 163, 184, ${spot.opacity * 0.95})`);
            grad.addColorStop(0.7, `rgba(100, 116, 139, ${spot.opacity * 0.85})`);
            grad.addColorStop(1, 'rgba(71, 85, 105, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
            ctx.fill();

            // Label callout
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(spot.x - 48, spot.y - 12, 96, 20, 4);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.fillText(`SCRUB: ${spot.label}`, spot.x, spot.y + 2);
            ctx.restore();
          }
        }

        // Animated Helper Prompt
        ctx.save();
        ctx.fillStyle = 'rgba(2, 132, 199, 0.9)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(210, 248, 220, 26, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('👉 DRAG BRUSH TO SCRUB DUST', 320, 265);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 5. STEP 2 OVERLAY: RETAINING COLLAR PINS (Tap to Unlatch)
      // -------------------------------------------------------------
      else if (stepRef.current === 'unpinning') {
        for (const pin of pinsRef.current) {
          ctx.save();
          if (pin.unlatched) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pin.x, pin.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✓', pin.x, pin.y + 4);
          } else {
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
            ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pin.x, pin.y, 18 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Pull-Ring Pin Body
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pin.x, pin.y - 6, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pin.x, pin.y);
            ctx.lineTo(pin.x, pin.y + 10);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(pin.x - 55, pin.y - 28, 110, 18, 3);
            ctx.fill();
            ctx.stroke();

            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#fde047';
            ctx.textAlign = 'center';
            ctx.fillText(`TAP TO POP: ${pin.label}`, pin.x, pin.y - 16);
          }
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 6. STEP 3 OVERLAY: BOLT CUTTERS ON WIRING HARNESS
      // -------------------------------------------------------------
      else if (stepRef.current === 'snipping') {
        const cutX = 425;
        const cutY = 180;

        ctx.save();
        const pulse = 1 + Math.sin(Date.now() / 120) * 0.15;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cutX, cutY, 34 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Shear blades graphic
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(cutX - 18, cutY - 16);
        ctx.lineTo(cutX + 18, cutY + 16);
        ctx.moveTo(cutX - 18, cutY + 16);
        ctx.lineTo(cutX + 18, cutY - 16);
        ctx.stroke();

        // Cutting progress bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cutX - 60, cutY + 36, 120, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.fillRect(cutX - 58, cutY + 38, (cutPressureRef.current / 100) * 116, 12);

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`SHEAR PRESSURE: ${cutPressureRef.current}%`, cutX, cutY + 28);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 7. ASTRONAUT FIRST-PERSON EVA GLOVE & ACTIVE TOOL
      // -------------------------------------------------------------
      const gx = glovePosRef.current.x;
      const gy = glovePosRef.current.y;

      ctx.save();
      // White Apollo A7L Spacesuit Glove Sleeve
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(gx + 25, gy + 35, 18, 30, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Red Mission Commander Stripe on Wrist Cuff
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(gx + 12, gy + 45, 12, 5);

      // Glove Palm & Blue Fingertips
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(gx + 8, gy + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Active Tool held in Glove
      if (stepRef.current === 'brushing') {
        // Lunar Dusting Brush Handle
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(gx - 20, gy - 6, 24, 7);
        // Soft White/Gray Bristles sweeping
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(gx - 20, gy - 12);
        ctx.lineTo(gx - 35, gy - 8);
        ctx.lineTo(gx - 35, gy + 12);
        ctx.lineTo(gx - 20, gy + 8);
        ctx.closePath();
        ctx.fill();
      } else if (stepRef.current === 'unpinning') {
        // Glove reaching with pinch fingers
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(gx - 4, gy + 4, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (stepRef.current === 'snipping') {
        // Apollo Mechanical Shears / Bolt Cutters with yellow insulated handles
        ctx.fillStyle = '#eab308';
        ctx.fillRect(gx - 25, gy - 8, 30, 8);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(gx - 38, gy - 6, 14, 5);
      }
      ctx.restore();

      // -------------------------------------------------------------
      // 8. WINNING CELEBRATION FLASH & HARVEST BANNER
      // -------------------------------------------------------------
      if (flashAlphaRef.current > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(56, 189, 248, ${flashAlphaRef.current})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
        flashAlphaRef.current = Math.max(0, flashAlphaRef.current - 0.04);
      }

      if (stepRef.current === 'won') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(140, 95, 360, 65, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 SURVEYOR 3 ARM SECURED! 🏆', 320, 122);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#bae6fd';
        ctx.fillText('First robotic artifact retrieved by humans from another world!', 320, 142);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 9. PARTICLES & FLOATING TEXTS
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
        ctx.font = 'bold 10px monospace';
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
  }, [reduceMotion]);

  // Pointer interactions
  const handlePointerDown = (clientX: number, clientY: number) => {
    isInteractingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    handlePointerAction(x, y);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    targetGlovePosRef.current = { x, y };
    if (isInteractingRef.current || stepRef.current === 'brushing') {
      handlePointerAction(x, y);
    }
  };

  const handlePointerUp = () => {
    isInteractingRef.current = false;
  };

  // Keyboard action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (stepRef.current === 'brushing') {
          handlePointerAction(280 + Math.random() * 120, 140 + Math.random() * 60);
        } else if (stepRef.current === 'unpinning') {
          const firstPinned = pinsRef.current.find((p) => !p.unlatched);
          if (firstPinned) handlePointerAction(firstPinned.x, firstPinned.y);
        } else if (stepRef.current === 'snipping') {
          handlePointerAction(425, 180);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePointerAction]);

  // Autoplay hook for test automation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runAutoplay = () => {
        for (const spot of dustSpotsRef.current) {
          spot.cleared = true;
          spot.opacity = 0;
        }
        for (const pin of pinsRef.current) {
          pin.unlatched = true;
        }
        cutPressureRef.current = 100;
        setDustProgress(100);
        setPinsUnlatchedCount(3);
        setSnipProgress(100);
        stepRef.current = 'won';
        setStep('won');
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
            APOLLO 12 EVA · SURVEYOR 3 SALVAGE
          </span>
          <span className="text-slate-200 font-bold uppercase tracking-wider sm:hidden">
            SURVEYOR 3 SALVAGE
          </span>
          <span
            data-testid="surveyor-status-pill"
            className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 text-[10px]"
          >
            {step === 'brushing'
              ? 'STEP 1: BRUSH DUST'
              : step === 'unpinning'
              ? 'STEP 2: UNPIN COLLARS'
              : step === 'snipping'
              ? 'STEP 3: SNIP HARNESS'
              : 'RETRIEVED!'}
          </span>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md">
          <Award size={14} className="text-cyan-400 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Phase Progress</span>
            <span className="text-xs font-bold font-mono text-cyan-300">
              {step === 'brushing'
                ? `${dustProgress}%`
                : step === 'unpinning'
                ? `${pinsUnlatchedCount} / 3`
                : step === 'snipping'
                ? `${snipProgress}%`
                : '100%'}
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
          className="bg-[#020617] rounded-2xl block border-2 border-slate-800 shadow-2xl cursor-pointer w-full h-full max-h-[220px] sm:max-h-[260px] touch-none select-none aspect-video shrink-0"
          data-testid="surveyor-canvas"
        />
      </div>

      {/* 3. Tactile Action Controls Strip */}
      <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl shrink-0">
        {/* Primary Action Button (>=48px touch target) */}
        <button
          data-testid="surveyor-action-btn"
          onClick={() => {
            if (step === 'brushing') {
              handlePointerAction(280 + Math.random() * 120, 140 + Math.random() * 60);
            } else if (step === 'unpinning') {
              const firstPinned = pinsRef.current.find((p) => !p.unlatched);
              if (firstPinned) handlePointerAction(firstPinned.x, firstPinned.y);
            } else if (step === 'snipping') {
              handlePointerAction(425, 180);
            }
          }}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          {step === 'brushing' ? (
            <>
              <Hand size={18} className="text-cyan-400" />
              <span>SWIPE BRUSH (OR TAP DUST)</span>
            </>
          ) : step === 'unpinning' ? (
            <>
              <Wrench size={18} className="text-amber-400" />
              <span>UNPIN COLLAR ({pinsUnlatchedCount}/3)</span>
            </>
          ) : step === 'snipping' ? (
            <>
              <Scissors size={18} className="text-emerald-400" />
              <span>SQUEEZE BOLT CUTTERS ({snipProgress}%)</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>SURVEYOR 3 ARM SECURED</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
