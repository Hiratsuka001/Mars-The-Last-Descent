import React, { useEffect, useState } from 'react';
import { NovaAvatar, NovaMood } from './NovaAvatar';
import { sound } from '../systems/audio';

interface NovaDialogueProps {
  speakerName?: string;
  text: string;
  mood?: NovaMood;
  showScannerBeam?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

export const NovaDialogue: React.FC<NovaDialogueProps> = ({
  speakerName = 'NOVA // SCI-BOT',
  text,
  mood = 'idle',
  showScannerBeam = false,
  onAction,
  actionLabel,
  onDismiss,
  className = ''
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    sound.playNovaChirp();
    setDisplayedText('');
    setIsTyping(true);

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [text]);

  const handleSkipTyping = () => {
    if (isTyping) {
      setDisplayedText(text);
      setIsTyping(false);
    }
  };

  return (
    <div
      data-testid="nova-dialogue"
      onClick={handleSkipTyping}
      className={`bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-xl p-4 flex items-start gap-4 transition-all duration-300 ${className}`}
    >
      {/* NOVA Avatar Container */}
      <div className="shrink-0 relative group">
        <NovaAvatar
          mood={mood}
          size={76}
          showScannerBeam={showScannerBeam}
          onClick={() => sound.playNovaChirp()}
        />
        <div className="text-[10px] tracking-widest text-cyan-400 font-mono text-center mt-1 uppercase font-semibold">
          UNIT 09
        </div>
      </div>

      {/* Speech content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
            <span className="text-xs font-semibold text-cyan-300 font-mono tracking-wider">
              {speakerName}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            AUDIO-SYNTH NOMINAL
          </span>
        </div>

        <p className="text-sm md:text-base text-slate-100 font-normal leading-relaxed">
          {displayedText}
          {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />}
        </p>

        {/* Action Controls */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {onAction && actionLabel && (
            <button
              data-testid="nova-dialogue-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                sound.playClick();
                onAction();
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm tracking-wide cursor-pointer flex items-center gap-1.5"
            >
              <span>{actionLabel}</span>
              <span className="font-mono">→</span>
            </button>
          )}

          {onDismiss && (
            <button
              data-testid="nova-dialogue-dismiss-btn"
              onClick={(e) => {
                e.stopPropagation();
                sound.playClick();
                onDismiss();
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50 cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
