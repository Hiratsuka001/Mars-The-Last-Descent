import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../systems/audio';
import { isReduceMotionEnabled } from '../systems/saveManager';
import { NovaAvatar } from './NovaAvatar';
import { AlertTriangle, ChevronRight, Flame } from 'lucide-react';

interface CrashInterludeProps {
  onComplete: () => void;
}

export const CrashInterlude: React.FC<CrashInterludeProps> = ({ onComplete }) => {
  const [beat, setBeat] = useState<number>(1);
  const [reduceMotion] = useState<boolean>(() => isReduceMotionEnabled());
  const completedRef = useRef(false);

  const handleFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Fixed auto-advance timers (~4s per beat, total < 20s)
  useEffect(() => {
    if (beat === 1) {
      try {
        sound.playRumble?.();
      } catch {}
      const timer = setTimeout(() => {
        setBeat(2);
      }, 4000);
      return () => clearTimeout(timer);
    } else if (beat === 2) {
      try {
        sound.playMistake?.();
      } catch {}
      const timer = setTimeout(() => {
        setBeat(3);
      }, 4000);
      return () => clearTimeout(timer);
    } else if (beat === 3) {
      try {
        sound.playNovaChirp?.();
      } catch {}
      // Auto-advance after 5s on beat 3 if not tapped
      const timer = setTimeout(() => {
        handleFinish();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [beat]);

  const handleContainerClick = () => {
    if (beat < 3) {
      setBeat((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  return (
    <div
      data-testid="crash-interlude"
      onClick={handleContainerClick}
      className="fixed inset-0 z-50 w-full h-full overflow-hidden bg-black text-slate-100 flex flex-col justify-between select-none cursor-pointer"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
      }}
    >
      <style>{`
        @keyframes crash-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-4px, 3px) rotate(-0.5deg); }
          30% { transform: translate(4px, -3px) rotate(0.5deg); }
          45% { transform: translate(-3px, -2px) rotate(-0.3deg); }
          60% { transform: translate(3px, 2px) rotate(0.3deg); }
          75% { transform: translate(-2px, 3px) rotate(-0.2deg); }
          90% { transform: translate(2px, -1px) rotate(0.2deg); }
        }
        @keyframes crash-flash {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
        }
        .crash-shake-active {
          animation: crash-shake 0.18s infinite linear;
        }
        .crash-flash-active {
          animation: crash-flash 0.35s infinite ease-in-out;
        }
      `}</style>

      {/* Header with 3 progress dots and Skip button (>=12px from every edge) */}
      <div className="w-full flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2" data-testid="crash-progress-dots" aria-label={`Progress ${beat} of 3`}>
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === beat
                  ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : step < beat
                  ? 'w-2 bg-cyan-600/70'
                  : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          data-testid="crash-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick?.();
            handleFinish();
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Skip</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Beat Stage */}
      <div className="flex-1 w-full flex items-center justify-center z-10 my-auto py-2">
        {/* BEAT 1: Entering Mars (Orange glow, ship shake) */}
        {beat === 1 && (
          <div
            data-testid="crash-beat-1"
            className={`w-full max-w-md mx-auto text-center flex flex-col items-center justify-center gap-4 ${
              !reduceMotion ? 'crash-shake-active' : ''
            }`}
          >
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center bg-gradient-to-t from-orange-600 via-amber-500 to-yellow-300 shadow-[0_0_60px_rgba(249,115,22,0.8)] border border-amber-300/60">
              <Flame className="w-12 h-12 text-white animate-pulse" />
            </div>

            <div className="space-y-1.5 px-2">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]">
                Entering Mars...
              </h1>
              <p className="text-xs sm:text-sm font-mono text-orange-200/90 leading-relaxed">
                Hold on tight! It's getting hot!
              </p>
            </div>
          </div>
        )}

        {/* BEAT 2: SYSTEMS FAILING (Red flash) */}
        {beat === 2 && (
          <div
            data-testid="crash-beat-2"
            className="w-full max-w-md mx-auto text-center flex flex-col items-center justify-center gap-4 relative"
          >
            {/* Background Red Flash Overlay (Static if reduced motion) */}
            <div
              className={`absolute -inset-16 rounded-3xl bg-red-600/20 pointer-events-none ${
                !reduceMotion ? 'crash-flash-active' : 'opacity-30'
              }`}
            />

            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center bg-red-950 border-2 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.9)]">
              <AlertTriangle className="w-12 h-12 text-red-400 animate-bounce" />
            </div>

            <div className="space-y-1.5 px-2 z-10">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-red-400 tracking-wide drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]">
                SYSTEMS FAILING!
              </h1>
              <p className="text-xs sm:text-sm font-mono text-red-200/90 leading-relaxed">
                Brace for impact!
              </p>
            </div>
          </div>
        )}

        {/* BEAT 3: Black screen with Nova Reboot */}
        {beat === 3 && (
          <div
            data-testid="crash-beat-3"
            className="w-full max-w-md mx-auto text-center flex flex-col items-center justify-center gap-5 px-2"
          >
            <div className="relative">
              <NovaAvatar mood="warning" size={80} />
              <div className="text-[10px] font-mono text-cyan-400 mt-1 uppercase tracking-widest font-semibold">
                NOVA // REBOOTED
              </div>
            </div>

            <div className="space-y-3 bg-slate-950/90 border border-cyan-500/40 rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] text-left w-full">
              <p className="text-xs sm:text-sm font-mono text-cyan-200 leading-relaxed">
                "Rebooting... who are you? I forgot everything."
              </p>
              <p className="text-xs sm:text-sm font-mono text-cyan-300 leading-relaxed pt-2 border-t border-slate-800">
                "I'll leave notes on old probes. Help me find them!"
              </p>
            </div>

            <button
              data-testid="crash-continue-btn"
              onClick={(e) => {
                e.stopPropagation();
                sound.playClick?.();
                handleFinish();
              }}
              className="mt-2 w-full px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-mono text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.5)] cursor-pointer transition-all animate-pulse"
            >
              <span>Start exploring -&gt;</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer prompt */}
      <div className="w-full text-center text-xs font-mono text-slate-500 shrink-0">
        Tap to continue
      </div>
    </div>
  );
};
