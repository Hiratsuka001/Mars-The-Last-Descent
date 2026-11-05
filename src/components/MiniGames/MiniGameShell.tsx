import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { NovaAvatar } from '../NovaAvatar';
import { DID_YOU_KNOW } from '../../data/didYouKnow';
import { isDebugMode } from '../../systems/debug';
import { X, Sparkles, Award, Star, RotateCcw } from 'lucide-react';

export interface MiniGameShellRenderProps {
  win: (result?: { stars?: 1 | 2 | 3 }) => void;
  fail: () => void;
  reset: () => void;
  assistActive: boolean;
  requestAssist: () => void;
}

export interface MiniGameShellProps {
  wreckId: string;
  title: string;
  instruction: string;
  winTitle?: string;
  claimLabel?: string;
  onWin: () => void;
  onExit: () => void;
  onRetry?: () => void;
  onAssist?: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
  footerReaction?: string;
  children: (props: MiniGameShellRenderProps) => React.ReactNode;
}

export const MiniGameShell: React.FC<MiniGameShellProps> = ({
  wreckId,
  title,
  instruction,
  winTitle,
  claimLabel = 'Claim Ship Part →',
  onWin,
  onExit,
  onRetry,
  onAssist,
  onAwardBonusRp,
  footerReaction,
  children,
}) => {
  const [failCount, setFailCount] = useState(0);
  const [assistRequested, setAssistRequested] = useState(false);
  const [assistActive, setAssistActive] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [stars, setStars] = useState<1 | 2 | 3>(3);
  const [showBonusRpToast, setShowBonusRpToast] = useState(false);
  const [factRevealed, setFactRevealed] = useState(false);

  const reduceMotion = useMemo(() => isReduceMotionEnabled(), []);
  const factText = DID_YOU_KNOW[wreckId] || "Mission telemetry recovered from historical NASA wreck.";

  const handleWin = useCallback(
    (result?: { stars?: 1 | 2 | 3 }) => {
      const earnedStars = result?.stars || 3;
      setStars(earnedStars);
      setHasWon(true);
      sound.playSuccess();

      if (earnedStars === 3 && onAwardBonusRp) {
        const newlyAwarded = onAwardBonusRp();
        if (newlyAwarded) {
          setShowBonusRpToast(true);
        }
      }
    },
    [onAwardBonusRp]
  );

  const handleFail = useCallback(() => {
    sound.playMistake();
    setFailCount((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    sound.playClick();
  }, []);

  const handleRetry = useCallback(() => {
    sound.playClick();
    setHasWon(false);
    setShowBonusRpToast(false);
    setFactRevealed(false);
    onRetry?.();
  }, [onRetry]);

  const handleRequestAssist = useCallback(() => {
    setAssistRequested(true);
  }, []);

  const handleTriggerAssist = useCallback(() => {
    sound.playNovaPurr();
    setAssistActive(true);
    onAssist?.();
  }, [onAssist]);

  // Expose debug triggers for QA and development
  useEffect(() => {
    if (isDebugMode) {
      (window as any).__triggerMiniGameAssist = () => {
        setAssistRequested(true);
        return true;
      };
      (window as any).__triggerMiniGameWin = (winStars?: 1 | 2 | 3) => {
        handleWin({ stars: winStars || 3 });
        return true;
      };
      return () => {
        delete (window as any).__triggerMiniGameAssist;
        delete (window as any).__triggerMiniGameWin;
      };
    }
  }, [handleWin]);

  const showAssistButton = !hasWon && (failCount >= 3 || assistRequested);

  // Footer Nova state and message
  const novaMood = hasWon
    ? 'celebrate'
    : (assistActive || showAssistButton ? 'curious' : 'idle');

  const defaultFooterText = hasWon
    ? (stars === 3 ? 'Purr-fect! 3 stars achieved!' : 'Safe landing! System recovered!')
    : showAssistButton
      ? "Need a paw? I can help!"
      : failCount > 0
        ? 'Try again, you got this!'
        : 'Paws ready to run!';

  const activeFooterText = footerReaction || defaultFooterText;

  return (
    <div
      data-testid="minigame-shell"
      className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      <div
        className={`relative flex flex-col bg-slate-950 border ${
          hasWon ? 'border-emerald-500/50' : 'border-cyan-500/40'
        } rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 transition-colors duration-300 w-[calc(100vw-12px)] h-[calc(100dvh-16px)] sm:w-[min(94vw,1000px)] sm:h-[min(86vh,640px)] max-w-[1000px]`}
        style={{
          imageRendering: 'pixelated',
        }}
      >
        {/* Header (Title + Exit Button) */}
        <div className="flex items-center justify-between px-4 py-2 sm:py-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm sm:text-base font-bold text-cyan-300 font-mono tracking-wide uppercase truncate max-w-[240px] sm:max-w-xs">
              {title}
            </h2>
          </div>
          <button
            data-testid="puzzle-exit-btn"
            onClick={onExit}
            aria-label="Exit Mini Game"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
          >
            <X size={20} />
          </button>
        </div>

        {/* Instruction Line (Max 12-15 words) */}
        <div className="px-4 py-1.5 sm:py-2 bg-cyan-950/30 border-b border-cyan-900/30 text-center shrink-0">
          <p className="text-xs sm:text-sm text-cyan-200/90 font-medium tracking-wide">
            {instruction}
          </p>
        </div>

        {/* Main Content Area: Game or Win Screen */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
          {!hasWon ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0">
              {children({
                win: handleWin,
                fail: handleFail,
                reset: handleReset,
                assistActive,
                requestAssist: handleRequestAssist,
              })}
            </div>
          ) : (
            <div
              data-testid="minigame-win"
              className="w-full max-w-md flex-1 flex flex-col items-center justify-center py-2 px-3 sm:px-6 gap-2 sm:gap-2.5 text-center animate-in fade-in zoom-in-95 duration-200 overflow-y-auto"
            >
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm sm:text-base font-mono">
                <Award size={20} className="animate-bounce" />
                <span>{winTitle || 'MISSION SUCCESS!'}</span>
              </div>

              {/* Stars Display */}
              <div
                data-testid="minigame-stars"
                className="flex items-center justify-center gap-1.5 py-1"
                data-stars={stars}
              >
                {[1, 2, 3].map((starNum) => (
                  <Star
                    key={starNum}
                    size={24}
                    className={
                      starNum <= stars
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                        : 'text-slate-700'
                    }
                  />
                ))}
                <span className="ml-2 font-mono font-bold text-xs sm:text-sm text-amber-300">
                  {stars} / 3 Stars
                </span>
              </div>

              {/* Bonus RP Toast (if 3 stars awarded) */}
              {showBonusRpToast && (
                <div
                  data-testid="bonus-rp-toast"
                  className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono text-xs font-bold animate-in fade-in flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>+1 RP Bonus (3 Stars!)</span>
                </div>
              )}

              {/* Try Again For 3 Stars Button (Min 48px height, available until claimed) */}
              <button
                data-testid="minigame-retry"
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[48px] px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700/80 font-mono text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw size={16} />
                Try again for 3 stars
              </button>

              {/* Tap to Reveal "Did You Know?" Fact */}
              <button
                data-testid="minigame-fact"
                type="button"
                onClick={() => {
                  sound.playClick();
                  setFactRevealed(true);
                }}
                className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                  factRevealed
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-md'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-amber-400 mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} /> Did you know?
                  </span>
                  {!factRevealed && (
                    <span className="text-[10px] text-amber-300 font-mono underline">
                      Tap to reveal
                    </span>
                  )}
                </div>
                {factRevealed ? (
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans animate-in fade-in">
                    {factText}
                  </p>
                ) : (
                  <p className="text-[11px] sm:text-xs text-amber-200/70 italic">
                    Tap to unlock a real historical Mars mission fact!
                  </p>
                )}
              </button>

              {/* Claim Part Action Button */}
              <button
                data-testid="claim-part-btn"
                onClick={() => {
                  sound.playClick();
                  onWin();
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                {claimLabel}
              </button>
            </div>
          )}
        </div>

        {/* Nova Assist Button (Appears after 3 fails or 20s stall, min 48px height) */}
        {showAssistButton && (
          <div className="px-4 py-2 shrink-0 flex justify-center bg-slate-900/50 border-t border-slate-800/80">
            <button
              data-testid="minigame-assist"
              type="button"
              onClick={handleTriggerAssist}
              className={`min-h-[48px] px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 border border-amber-300 transition-all ${
                reduceMotion ? '' : 'animate-pulse hover:scale-105 active:scale-95'
              }`}
            >
              <Sparkles size={18} />
              Nova, help!
            </button>
          </div>
        )}

        {/* Footer (Nova avatar + reaction text) */}
        <div className="px-4 py-2 sm:py-2.5 border-t border-slate-800 bg-slate-900/70 flex items-center gap-3 shrink-0">
          <NovaAvatar mood={novaMood} size={36} />
          <p className="text-xs text-slate-300 font-mono tracking-tight truncate">
            {activeFooterText}
          </p>
        </div>
      </div>
    </div>
  );
};
