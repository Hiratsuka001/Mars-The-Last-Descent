import React, { useState } from 'react';
import { QuizChallenge } from '../data/equipment';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import { CheckCircle2, HelpCircle, Award, AlertCircle } from 'lucide-react';

interface FieldQuizModalProps {
  title: string;
  quiz: QuizChallenge;
  onSuccess: () => void;
  onClose: () => void;
}

export const FieldQuizModal: React.FC<FieldQuizModalProps> = ({
  title,
  quiz,
  onSuccess,
  onClose,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleSelect = (idx: number) => {
    if (isCorrect) return;
    setSelectedIdx(idx);
    setIsAnswered(true);

    if (idx === quiz.correctIndex) {
      setIsCorrect(true);
      sound.playSuccess();
    } else {
      setIsCorrect(false);
      sound.playMistake();
      setShowHint(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative w-full max-w-xl bg-slate-950 border ${isCorrect ? 'border-emerald-500/50' : 'border-cyan-500/40'} rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NovaAvatar mood={isCorrect ? 'celebrate' : (showHint ? 'curious' : 'idle')} size={40} />
            <div>
              <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                FIELD AVIONICS CHALLENGE
              </div>
              <h3 className="text-base font-semibold text-white font-display">
                {title}
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

        {/* Question Body */}
        <div className="p-6 space-y-4">
          <div className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
            {quiz.question}
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {quiz.options.map((option, idx) => {
              const isOptionSelected = selectedIdx === idx;
              let btnStyle = 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/80 text-slate-200 hover:border-slate-700';

              if (isAnswered) {
                if (idx === quiz.correctIndex && (isOptionSelected || isCorrect)) {
                  btnStyle = 'border-emerald-500 bg-emerald-950/50 text-emerald-200';
                } else if (isOptionSelected && !isCorrect) {
                  btnStyle = 'border-rose-500/60 bg-rose-950/40 text-rose-200';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm font-normal transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-400">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>
                  {isAnswered && idx === quiz.correctIndex && (isOptionSelected || isCorrect) && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  {isAnswered && isOptionSelected && !isCorrect && (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* NOVA Clue / Feedback */}
          {isCorrect ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 space-y-1">
              <span className="font-semibold font-mono uppercase">NOVA: "Telemetry Verified!"</span>
              <p>{quiz.explanation}</p>
            </div>
          ) : showHint ? (
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold font-mono uppercase text-cyan-300">NOVA's Clue: </span>
                {quiz.hint}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {isCorrect ? 'Subsystem unlocked!' : 'Select the verified engineering principle'}
          </div>

          {isCorrect && (
            <button
              onClick={() => {
                sound.playClick();
                onSuccess();
              }}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-mono shadow-md"
            >
              <span>Salvage Part</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

