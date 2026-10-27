import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../../systems/audio';
import { NovaAvatar } from '../NovaAvatar';
import { Activity, CheckCircle2, Sliders, Shield, ChevronDown, ChevronUp } from 'lucide-react';

interface InSightSeismicPuzzleProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const InSightSeismicPuzzle: React.FC<InSightSeismicPuzzleProps> = ({
  onSuccess,
  onClose,
}) => {
  const [filterFrequency, setFilterFrequency] = useState<number>(50); // 0 to 100
  const [shieldDomeActive, setShieldDomeActive] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [showWhy, setShowWhy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState('Tune frequency toward 0.50 Hz to filter wind noise.');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Target frequency sweet spot is around 60-80 (0.50 Hz)
  const isOptimal = filterFrequency >= 60 && filterFrequency <= 80 && shieldDomeActive;

  useEffect(() => {
    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.05;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw Center Baseline
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Seismic Trace Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = isOptimal ? '#10b981' : '#06b6d4';
      ctx.beginPath();

      const noiseFactor = shieldDomeActive ? 0.25 : 1.1;
      const filterClarity = 1 - Math.abs(filterFrequency - 70) / 70;

      for (let x = 0; x < w; x++) {
        const normX = x / w;
        let y = h / 2;

        const windNoise =
          (Math.sin(normX * 90 + time * 3) * 12 + Math.cos(normX * 180 - time * 5) * 8) *
          noiseFactor *
          (1 - filterClarity * 0.85);

        let quakeSignal = 0;
        if (normX > 0.2 && normX < 0.45) {
          const pEnvelope = Math.sin(((normX - 0.2) / 0.25) * Math.PI);
          quakeSignal += Math.sin((normX - 0.2) * 55 + time) * 32 * pEnvelope;
        } else if (normX >= 0.45 && normX < 0.85) {
          const sEnvelope = Math.sin(((normX - 0.45) / 0.4) * Math.PI);
          quakeSignal += Math.sin((normX - 0.45) * 32 + time * 0.8) * 58 * sEnvelope;
        }

        y += windNoise + quakeSignal * (0.3 + filterClarity * 0.7);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      if (isOptimal) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px monospace';
        ctx.fillText('▼ P-WAVE', w * 0.24, h * 0.22);
        ctx.fillStyle = '#34d399';
        ctx.fillText('▼ S-WAVE', w * 0.54, h * 0.18);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [filterFrequency, shieldDomeActive, isOptimal]);

  const handleTune = (val: number) => {
    setFilterFrequency(val);
    sound.playHover();
    if (val >= 60 && val <= 80 && shieldDomeActive) {
      setStatusMsg('Signal nominal: P and S waves isolated.');
    } else if (!shieldDomeActive) {
      setStatusMsg('Deploy the shield dome to block surface wind gusts.');
    } else {
      setStatusMsg('Adjust frequency slider toward 0.50 Hz.');
    }
  };

  const handleLockIn = () => {
    if (!isOptimal) {
      sound.playMistake();
      setStatusMsg('Signal degraded: Align slider toward 0.50 Hz.');
      return;
    }
    sound.playSuccess();
    setIsLocked(true);
    setStatusMsg('MARS INTERIOR MAPPED: Liquid core radius ~1,830 km verified!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                SEISMOLOGY LAB · 2018
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white font-display">
                InSight: Seismic Filter
              </h3>
            </div>
          </div>
          <button
            data-testid="puzzle-exit-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
          >
            ✕ Exit
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          
          {/* Instruction Bar with Collapsed Why */}
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
            <span>Tune filter toward <strong>0.50 Hz</strong> and deploy shield to isolate Marsquake waves.</span>
            <button
              onClick={() => setShowWhy((p) => !p)}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 shrink-0 underline cursor-pointer"
            >
              {showWhy ? 'Hide' : 'Why?'}
            </button>
          </div>

          {showWhy && (
            <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs text-slate-300 space-y-1 animate-in fade-in duration-150">
              <div>Compressional P-waves arrive first; shear S-waves cannot traverse liquids, revealing Mars' molten core.</div>
              <div className="text-[10px] font-mono text-cyan-300">Crust: ~40 km · Core: ~1,830 km liquid radius.</div>
            </div>
          )}

          {/* Interactive Seismogram Screen */}
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-3 shadow-inner relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isOptimal ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                SEIS VBB SENSOR · M4.7 QUAKE
              </span>
              <span className="text-cyan-400">{(filterFrequency / 100 * 2.5).toFixed(2)} Hz</span>
            </div>

            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full h-[140px] sm:h-[150px] bg-[#03060c] rounded-lg block border border-slate-800"
            />
          </div>

          {/* Controls Matrix */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Frequency Slider */}
              <div className="flex-1 w-full space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    Frequency Filter
                  </span>
                  <span className={`font-semibold ${isOptimal ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {(filterFrequency / 100 * 2.5).toFixed(2)} Hz {isOptimal ? '(Optimal)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={filterFrequency}
                  onChange={(e) => handleTune(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Shield Dome Button */}
              <button
                onClick={() => {
                  sound.playClick();
                  setShieldDomeActive(!shieldDomeActive);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  shieldDomeActive
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>WTS Dome: {shieldDomeActive ? 'DEPLOYED' : 'EXPOSED'}</span>
              </button>

            </div>
          </div>

          {/* Status Message */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className={`font-mono ${isLocked ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
              {statusMsg}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <NovaAvatar mood={isLocked ? 'celebrate' : (isOptimal ? 'happy' : 'scanning')} size={32} />
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {isLocked ? '"Mars interior mapped!"' : '"Dial the filter toward 0.50 Hz."'}
            </div>
          </div>

          <div>
            {!isLocked ? (
              <button
                disabled={!isOptimal}
                onClick={handleLockIn}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                Lock In Signal
              </button>
            ) : (
              <button
                onClick={() => {
                  sound.playClick();
                  onSuccess();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Claim Part</span>
                <span className="font-mono">→</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
