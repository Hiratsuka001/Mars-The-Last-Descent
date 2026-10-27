import React from 'react';
import { sound } from '../systems/audio';
import { X, History, Globe, Moon, Flame, Wind, ArrowRight } from 'lucide-react';

interface LegacyChaptersModalProps {
  onSelectChapter: (chapter: number) => void;
  onClose: () => void;
}

export const LegacyChaptersModal: React.FC<LegacyChaptersModalProps> = ({
  onSelectChapter,
  onClose,
}) => {
  const chapters = [
    {
      num: 1,
      title: 'Prologue: Earth Kola Borehole',
      subtitle: 'Descend 12,262m into the crust to establish geological baselines',
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      tag: 'Kola Superdeep',
    },
    {
      num: 2,
      title: 'Chapter 1: Echoes of the Moon',
      subtitle: 'Traverse lunar gravity and scan Apollo 11, 17, and Surveyor ALSEP stations',
      icon: <Moon className="w-4 h-4 text-cyan-400" />,
      tag: 'Lunar ALSEP',
    },
    {
      num: 3,
      title: 'Chapter 2: Mars Descent & Crash',
      subtitle: 'Atmospheric entry sequence and emergency diagnostic damage assessment',
      icon: <Flame className="w-4 h-4 text-rose-400" />,
      tag: 'Entry & Crash',
    },
    {
      num: 5,
      title: 'Chapter 4: Mars Dust Storm Crisis',
      subtitle: 'Tactical survival navigation through severe Martian convection storms',
      icon: <Wind className="w-4 h-4 text-amber-400" />,
      tag: 'Convection Storm',
    },
  ];

  return (
    <div
      data-testid="legacy-chapters-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold font-display text-white">
                LEGACY MISSION ARCHIVES
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Original linear narrative chapters (Earth, Moon, & Diagnostic Simulations)
              </p>
            </div>
          </div>
          <button
            data-testid="legacy-chapters-close-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chapters List */}
        <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {chapters.map((ch) => (
            <button
              key={ch.num}
              data-testid={`legacy-chapter-${ch.num}`}
              onClick={() => {
                sound.playClick();
                onSelectChapter(ch.num);
                onClose();
              }}
              className="w-full p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 group-hover:scale-105 transition-transform">
                  {ch.icon}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-2 font-mono">
                    <span>{ch.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {ch.tag}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-sans leading-relaxed">
                    {ch.subtitle}
                  </div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0 transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/40 text-[10px] font-mono text-slate-500 flex justify-between items-center">
          <span>The main experience is the open-world Mars salvage expedition.</span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
