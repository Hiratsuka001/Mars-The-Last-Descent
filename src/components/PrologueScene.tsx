import React, { useEffect, useState } from 'react';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import earthBoreholeImg from '../assets/images/earth_deep_borehole_1791205870198.jpg';

interface PrologueSceneProps {
  onComplete: () => void;
}

export const PrologueScene: React.FC<PrologueSceneProps> = ({ onComplete }) => {
  // Phase 0: Space Earth overview
  // Phase 1: Borehole depth cross-section (12 km vs 6,371 km)
  // Phase 2: Moon & Mars horizons
  // Phase 3: NOVA introduction & Title reveal
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    sound.startAmbience('space');

    const t1 = setTimeout(() => setPhase(1), 5000);
    const t2 = setTimeout(() => setPhase(2), 11000);
    const t3 = setTimeout(() => setPhase(3), 16000);
    const t4 = setTimeout(() => {
      onComplete();
    }, 22000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full h-full min-h-screen bg-[#03060d] text-slate-100 flex flex-col justify-between p-6 sm:p-12 overflow-hidden select-none">
      
      {/* Top Header / Skip */}
      <div className="flex items-center justify-between z-20">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>PROLOGUE // THE DEPTH OF EARTH</span>
        </div>

        <button
          data-testid="skip-prologue-btn"
          onClick={() => {
            sound.playClick();
            onComplete();
          }}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 text-xs font-mono transition-colors cursor-pointer"
        >
          Skip Prologue →
        </button>
      </div>

      {/* Main Cinematic Visuals */}
      <div className="relative flex-1 flex items-center justify-center my-6">
        
        {/* Phase 0: Earth in Space */}
        {phase === 0 && (
          <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-[0_0_80px_rgba(56,189,248,0.3)] border border-cyan-500/30 flex items-center justify-center bg-gradient-to-tr from-sky-950 via-blue-900 to-indigo-950">
              {/* Earth glow ring */}
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-pulse" />
              <div className="text-center p-6 space-y-2">
                <div className="text-xs font-mono text-cyan-300 uppercase tracking-widest">
                  PLANET EARTH
                </div>
                <div className="text-2xl font-bold font-display text-white">
                  RADIUS: 6,371 KM
                </div>
                <div className="text-xs text-slate-400">
                  Humanity's cradle and solitary home
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 1: 12 km Borehole vs 6,371 km Radius Cross-Section */}
        {phase === 1 && (
          <div className="flex flex-col items-center max-w-2xl w-full animate-in fade-in duration-1000 space-y-4">
            <div className="relative w-full max-h-[300px] rounded-xl overflow-hidden border border-cyan-500/40 shadow-2xl bg-black">
              <img
                src={earthBoreholeImg}
                alt="Earth cross section 12km borehole comparison"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover max-h-[300px]"
              />
              <div className="absolute bottom-3 left-3 right-3 p-3 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-700/60 flex items-center justify-between text-xs font-mono">
                <span className="text-rose-400 font-semibold">KOLA SUPERDEEP BOREHOLE: 12.26 KM</span>
                <span className="text-slate-400">0.19% OF EARTH CRUST</span>
                <span className="text-cyan-400">EARTH CENTER: 6,371 KM</span>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Moon & Mars Horizon */}
        {phase === 2 && (
          <div className="flex items-center justify-center gap-8 sm:gap-16 animate-in fade-in duration-1000">
            {/* The Moon */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700 shadow-[0_0_40px_rgba(203,213,225,0.2)] border border-slate-400/40" />
              <span className="text-xs font-mono text-slate-300">THE MOON</span>
              <span className="text-[10px] font-mono text-slate-500">384,400 KM</span>
            </div>

            <div className="text-xl font-mono text-cyan-500">→</div>

            {/* Mars */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-orange-500 via-red-700 to-amber-950 shadow-[0_0_40px_rgba(239,68,68,0.3)] border border-orange-500/40" />
              <span className="text-xs font-mono text-orange-300">MARS</span>
              <span className="text-[10px] font-mono text-slate-500">225,000,000 KM</span>
            </div>
          </div>
        )}

        {/* Phase 3: NOVA & Title Reveal */}
        {phase === 3 && (
          <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-1000">
            <NovaAvatar mood="happy" size={110} />
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-wider text-white">
                MARS: THE LAST DESCENT
              </h1>
              <div className="text-sm sm:text-base font-mono text-cyan-400 uppercase tracking-widest">
                AN EXPEDITION BEYOND EARTH
              </div>
              <p className="text-xs sm:text-sm text-slate-400 italic">
                "We went as deep as we could. Now, let's go beyond."
              </p>
            </div>

            <button
          data-testid="skip-prologue-btn"
              onClick={() => {
                sound.playClick();
                onComplete();
              }}
              className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs tracking-wider font-mono shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
            >
              ENTER MISSION CONTROL →
            </button>
          </div>
        )}

      </div>

      {/* Cinematic Narration Subtitles matching prompt exactly */}
      <div className="z-20 max-w-3xl mx-auto w-full text-center">
        <div className="p-4 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 text-sm sm:text-base font-light leading-relaxed tracking-wide shadow-lg">
          {phase === 0 && (
            <span>"Beneath our feet lies a world we have barely explored..."</span>
          )}
          {phase === 1 && (
            <span>"Our deepest borehole reaches only about 12 kilometres into a planet nearly 6,371 kilometres to its centre."</span>
          )}
          {phase === 2 && (
            <span>"Yet humanity never stopped exploring. From the Moon to Mars, forgotten machines still tell the story of our greatest discoveries."</span>
          )}
          {phase === 3 && (
            <span className="text-cyan-300 font-normal">"Now, it's your turn to uncover them."</span>
          )}
        </div>
      </div>

    </div>
  );
};
