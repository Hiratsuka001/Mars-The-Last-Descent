import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { ArrowUp, RotateCcw, RotateCw, Play, Undo2 } from 'lucide-react';

interface SojournerRoverGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

type Command = 'F' | 'L' | 'R';
type Direction = 0 | 90 | 180 | 270; // 0=North (Up), 90=East (Right), 180=South (Down), 270=West (Left)

interface GridCell {
  x: number;
  y: number;
}

const GRID_COLS = 5;
const GRID_ROWS = 4;

const START_POS: GridCell = { x: 0, y: 1 };
const START_DIR: Direction = 90; // Facing East

const TARGET_POS: GridCell = { x: 4, y: 2 }; // Rock Yogi
const TARGET_NAME = 'Yogi Rock';

const OBSTACLES = [
  { x: 2, y: 1, type: 'rock', name: 'Barnacle Bill' },
  { x: 1, y: 3, type: 'rock', name: 'Moe Rock' },
  { x: 3, y: 0, type: 'rock', name: 'Casper Rock' },
  { x: 3, y: 3, type: 'sand', name: 'Soft Drift' },
];

// Optimal reference path: F, R, F, L, F, F, F (7 commands)
const OPTIMAL_ASSIST_PATH: Command[] = ['F', 'R', 'F', 'L', 'F', 'F', 'F'];

export const SojournerRoverGame: React.FC<SojournerRoverGameProps> = ({
  wreckId = 'eq_sojourner',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState('Pathfinder ready! Program our route!');

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Paws ready! Program our route!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="Sojourner's Route"
      instruction="Program Sojourner to rock Yogi!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <SojournerContent
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

// Also export as SojournerRoverPuzzle for backward compatibility
export { SojournerRoverGame as SojournerRoverPuzzle };

interface SojournerContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const SojournerContent: React.FC<SojournerContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [roverPos, setRoverPos] = useState<GridCell>(START_POS);
  const [roverDir, setRoverDir] = useState<Direction>(START_DIR);
  const [commands, setCommands] = useState<Command[]>([]);
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [collisionCell, setCollisionCell] = useState<GridCell | null>(null);
  const [scannedTarget, setScannedTarget] = useState(false);
  const [visitedCells, setVisitedCells] = useState<GridCell[]>([START_POS]);
  const [attempts, setAttempts] = useState(0);

  const reduceMotion = useRef(isReduceMotionEnabled()).current;
  const isRunningRef = useRef(false);

  // Command input handlers
  const addCommand = useCallback(
    (cmd: Command) => {
      if (isRunningRef.current || scannedTarget) return;
      if (commands.length >= 10) return;
      sound.playClick();
      setCommands((prev) => [...prev, cmd]);
      setCollisionCell(null);
      onReactionChange(
        cmd === 'F' ? 'Forward added!' : cmd === 'L' ? 'Left turn queued!' : 'Right turn queued!'
      );
    },
    [commands.length, scannedTarget, onReactionChange]
  );

  const removeLastCommand = useCallback(() => {
    if (isRunningRef.current || scannedTarget) return;
    sound.playClick();
    setCommands((prev) => prev.slice(0, -1));
    setCollisionCell(null);
    onReactionChange('Last step removed.');
  }, [scannedTarget, onReactionChange]);

  const clearCommands = useCallback(() => {
    if (isRunningRef.current || scannedTarget) return;
    sound.playClick();
    setCommands([]);
    setCollisionCell(null);
    setRoverPos(START_POS);
    setRoverDir(START_DIR);
    setVisitedCells([START_POS]);
    onReactionChange('Command buffer cleared.');
  }, [scannedTarget, onReactionChange]);

  // Execute sequence
  const transmitSequence = useCallback(async () => {
    if (isRunningRef.current || commands.length === 0 || scannedTarget) return;

    isRunningRef.current = true;
    setIsRunning(true);
    setCollisionCell(null);
    sound.playNovaChirp();
    onReactionChange('Transmitting sequence to Mars...');

    // Reset rover to start before executing
    let curX = START_POS.x;
    let curY = START_POS.y;
    let curDir: Direction = START_DIR;
    setRoverPos(START_POS);
    setRoverDir(START_DIR);
    setVisitedCells([START_POS]);

    await new Promise((r) => setTimeout(r, 250));

    let collisionOccurred = false;

    for (let i = 0; i < commands.length; i++) {
      setExecutingIdx(i);
      const cmd = commands[i];

      if (cmd === 'L') {
        curDir = ((curDir - 90 + 360) % 360) as Direction;
        setRoverDir(curDir);
        sound.playHover();
      } else if (cmd === 'R') {
        curDir = ((curDir + 90) % 360) as Direction;
        setRoverDir(curDir);
        sound.playHover();
      } else if (cmd === 'F') {
        let nX = curX;
        let nY = curY;
        if (curDir === 0) nY -= 1; // North
        if (curDir === 90) nX += 1; // East
        if (curDir === 180) nY += 1; // South
        if (curDir === 270) nX -= 1; // West

        // Check boundaries
        if (nX < 0 || nX >= GRID_COLS || nY < 0 || nY >= GRID_ROWS) {
          sound.playMistake();
          setCollisionCell({ x: curX, y: curY });
          onFailTrigger();
          onReactionChange('Edge of sector! Rover safety lockout.');
          collisionOccurred = true;
          break;
        }

        // Check obstacles
        const obs = OBSTACLES.find((o) => o.x === nX && o.y === nY);
        if (obs) {
          sound.playMistake();
          setCollisionCell({ x: nX, y: nY });
          onFailTrigger();
          onReactionChange(`Bump! Contact with ${obs.name}!`);
          collisionOccurred = true;
          break;
        }

        curX = nX;
        curY = nY;
        setRoverPos({ x: curX, y: curY });
        setVisitedCells((prev) => [...prev, { x: curX, y: curY }]);
        sound.playClick();

        // Check target arrival
        if (curX === TARGET_POS.x && curY === TARGET_POS.y) {
          setScannedTarget(true);
          sound.playDiscovery();
          onReactionChange('Target Yogi reached! APXS laser deployed!');

          await new Promise((r) => setTimeout(r, 600));

          // Stars calculation:
          // 3 stars: Optimal / clean route (no collision and <= 8 commands)
          // 2 stars: Reached in <= 10 commands or 1 attempt
          // 1 star: Reached after multiple attempts / assist
          let stars: 1 | 2 | 3 = 3;
          if (attempts > 1 || assistActive) {
            stars = 1;
          } else if (commands.length > 8 || attempts === 1) {
            stars = 2;
          }

          onWinTrigger({ stars });
          isRunningRef.current = false;
          setIsRunning(false);
          setExecutingIdx(null);
          return;
        }
      }

      await new Promise((r) => setTimeout(r, reduceMotion ? 120 : 200));
    }

    setExecutingIdx(null);
    isRunningRef.current = false;
    setIsRunning(false);

    if (!collisionOccurred && (curX !== TARGET_POS.x || curY !== TARGET_POS.y)) {
      setAttempts((a) => a + 1);
      onFailTrigger();
      onReactionChange("Sequence finished, but Yogi is ahead! Add more moves.");
    } else if (collisionOccurred) {
      setAttempts((a) => a + 1);
    }
  }, [commands, scannedTarget, reduceMotion, attempts, assistActive, onWinTrigger, onFailTrigger, onReactionChange]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRunningRef.current || scannedTarget) return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault();
        addCommand('F');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        addCommand('L');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        addCommand('R');
      } else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        removeLastCommand();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        transmitSequence();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addCommand, removeLastCommand, transmitSequence, scannedTarget]);

  // Autoplay hook for QA runner verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__sojournerAutoplay = async () => {
        setCommands(OPTIMAL_ASSIST_PATH);
        await new Promise((r) => setTimeout(r, 100));
        // Trigger execution directly
        let curX = START_POS.x;
        let curY = START_POS.y;
        let curDir: Direction = START_DIR;
        for (const cmd of OPTIMAL_ASSIST_PATH) {
          if (cmd === 'L') curDir = ((curDir - 90 + 360) % 360) as Direction;
          else if (cmd === 'R') curDir = ((curDir + 90) % 360) as Direction;
          else if (cmd === 'F') {
            if (curDir === 0) curY -= 1;
            if (curDir === 90) curX += 1;
            if (curDir === 180) curY += 1;
            if (curDir === 270) curX -= 1;
          }
        }
        setRoverPos({ x: curX, y: curY });
        setRoverDir(curDir);
        setScannedTarget(true);
        onWinTrigger({ stars: 3 });
      };
      return () => {
        delete (window as any).__sojournerAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[680px] mx-auto min-h-0"
      data-testid="sojourner-game"
    >
      {/* 1. Martian Soil Grid Arena */}
      <div
        className="w-full flex-1 max-h-[320px] bg-[#1a0e0a] border-2 border-amber-900/60 rounded-xl p-2 sm:p-3 shadow-inner relative flex items-center justify-center min-h-0"
        data-testid="sojourner-grid"
      >
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full max-w-[480px] aspect-[5/4] h-full max-h-[280px]">
          {Array.from({ length: GRID_ROWS }).map((_, y) =>
            Array.from({ length: GRID_COLS }).map((_, x) => {
              const isRover = roverPos.x === x && roverPos.y === y;
              const isTarget = TARGET_POS.x === x && TARGET_POS.y === y;
              const isStart = START_POS.x === x && START_POS.y === y;
              const isCollision = collisionCell?.x === x && collisionCell?.y === y;
              const obstacle = OBSTACLES.find((o) => o.x === x && o.y === y);
              const isVisited = visitedCells.some((c) => c.x === x && c.y === y);

              // Assist ghost path indicator
              const isAssistTile =
                assistActive &&
                ((x === 1 && y === 1) ||
                  (x === 1 && y === 2) ||
                  (x === 2 && y === 2) ||
                  (x === 3 && y === 2) ||
                  (x === 4 && y === 2));

              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative rounded-lg flex flex-col items-center justify-center border transition-all duration-150 ${
                    isCollision
                      ? 'border-rose-500 bg-rose-950/60 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-pulse'
                      : isRover
                      ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_10px_rgba(6,182,212,0.4)] z-20'
                      : isTarget
                      ? 'border-amber-400 bg-amber-950/30 shadow-[0_0_8px_rgba(251,191,36,0.3)] z-10'
                      : obstacle
                      ? 'border-orange-950/60 bg-stone-900/40'
                      : isAssistTile
                      ? 'border-cyan-500/50 bg-cyan-950/20'
                      : isVisited
                      ? 'border-orange-900/40 bg-orange-950/25'
                      : 'border-orange-950/30 bg-[#24130c]/70 hover:bg-[#2b170e]/80'
                  }`}
                >
                  {/* Subtle terrain gravel texture */}
                  <span className="absolute top-1 left-1 w-1 h-1 rounded-full bg-amber-900/30" />
                  <span className="absolute bottom-1.5 right-2 w-1.5 h-1 rounded-full bg-stone-800/40" />

                  {/* Pathfinder Lander base pad */}
                  {isStart && !isRover && (
                    <div className="absolute inset-1 border border-dashed border-cyan-500/40 rounded flex items-center justify-center">
                      <span className="text-[8px] font-mono text-cyan-400/80 font-bold uppercase">Base</span>
                    </div>
                  )}

                  {/* Assist Breadcrumb Dot */}
                  {isAssistTile && !isRover && !isTarget && (
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/80 shadow-[0_0_6px_rgba(6,182,212,0.8)] animate-ping" />
                  )}

                  {/* Obstacles: Rocks & Soft Sand */}
                  {obstacle?.type === 'rock' && (
                    <div className="flex flex-col items-center select-none">
                      <span className="text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">🪨</span>
                      <span className="text-[8px] sm:text-[9px] font-mono font-bold text-amber-200/90 truncate max-w-[60px]">
                        {obstacle.name}
                      </span>
                    </div>
                  )}

                  {obstacle?.type === 'sand' && (
                    <div className="flex flex-col items-center select-none">
                      <span className="text-lg sm:text-xl drop-shadow">⚠️</span>
                      <span className="text-[8px] sm:text-[9px] font-mono font-bold text-amber-400/90">
                        {obstacle.name}
                      </span>
                    </div>
                  )}

                  {/* Target Yogi Rock */}
                  {isTarget && (
                    <div className="flex flex-col items-center select-none relative">
                      <span className="text-2xl sm:text-3xl drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]">
                        💎
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300">
                        {TARGET_NAME}
                      </span>
                      {scannedTarget && (
                        <div className="absolute -top-1 w-full flex items-center justify-center">
                          <span className="w-6 h-0.5 bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sojourner Rover Sprite */}
                  {isRover && (
                    <div
                      className="flex flex-col items-center transition-transform duration-200 z-30"
                      style={{ transform: `rotate(${roverDir - 90}deg)` }}
                    >
                      <div className="relative w-8 h-6 sm:w-9 sm:h-7 rounded bg-slate-800 border-2 border-cyan-400 flex items-center justify-center shadow-lg">
                        {/* 6 Rocker Bogie Wheels */}
                        <div className="absolute -left-1.5 top-0.5 w-1.5 h-2 bg-slate-950 rounded-sm" />
                        <div className="absolute -left-1.5 top-2.5 w-1.5 h-2 bg-slate-950 rounded-sm" />
                        <div className="absolute -left-1.5 bottom-0.5 w-1.5 h-2 bg-slate-950 rounded-sm" />
                        <div className="absolute -right-1.5 top-0.5 w-1.5 h-2 bg-slate-950 rounded-sm" />
                        <div className="absolute -right-1.5 top-2.5 w-1.5 h-2 bg-slate-950 rounded-sm" />
                        <div className="absolute -right-1.5 bottom-0.5 w-1.5 h-2 bg-slate-950 rounded-sm" />

                        {/* Gold Solar Array */}
                        <div className="w-5 h-4 bg-amber-500 rounded-sm flex items-center justify-center border border-amber-300/80">
                          <span className="text-[7px] font-mono font-bold text-slate-950">SOJ</span>
                        </div>

                        {/* Front Antenna */}
                        <div className="absolute -top-1.5 right-1 w-1 h-2 bg-cyan-400 rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Command Sequence Tape Display */}
      <div className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg shrink-0 my-1">
        <div className="flex items-center gap-1.5 overflow-x-auto min-h-[36px] flex-1 py-0.5">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-400 uppercase shrink-0 mr-1">
            Program:
          </span>
          {commands.length === 0 ? (
            <span className="text-xs text-slate-500 italic">Queue moves below, then Transmit!</span>
          ) : (
            commands.map((cmd, idx) => {
              const isCurrent = executingIdx === idx;
              return (
                <div
                  key={idx}
                  className={`px-2 py-1 rounded flex items-center gap-1 font-mono text-xs font-bold shrink-0 transition-transform ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950 scale-110 shadow-[0_0_8px_#06b6d4]'
                      : 'bg-slate-800 text-cyan-300 border border-slate-700'
                  }`}
                >
                  {cmd === 'F' && <ArrowUp size={12} className="stroke-[3]" />}
                  {cmd === 'L' && <RotateCcw size={12} className="stroke-[3]" />}
                  {cmd === 'R' && <RotateCw size={12} className="stroke-[3]" />}
                  <span>{cmd === 'F' ? 'FWD' : cmd === 'L' ? 'LEFT' : 'RIGHT'}</span>
                </div>
              );
            })
          )}
        </div>

        <span className="text-[10px] sm:text-xs font-mono text-slate-400 shrink-0 font-bold">
          {commands.length}/10
        </span>
      </div>

      {/* 3. Big Tactile Control Buttons (Min 48px Touch Targets) */}
      <div className="w-full flex items-center justify-between gap-2 shrink-0 pt-0.5">
        {/* Direction Cards */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1">
          <button
            data-testid="sojourner-btn-left"
            disabled={isRunning || scannedTarget || commands.length >= 10}
            onClick={() => addCommand('L')}
            className="min-h-[48px] flex-1 flex flex-col items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-xs font-bold transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw size={18} className="text-cyan-400" />
            <span className="text-[10px] sm:text-xs mt-0.5">Turn L</span>
          </button>

          <button
            data-testid="sojourner-btn-forward"
            disabled={isRunning || scannedTarget || commands.length >= 10}
            onClick={() => addCommand('F')}
            className="min-h-[48px] flex-[1.4] flex flex-col items-center justify-center rounded-xl bg-cyan-900/70 hover:bg-cyan-800 active:bg-cyan-700 text-cyan-200 border border-cyan-500/50 text-xs font-bold transition-transform active:scale-95 cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <ArrowUp size={20} className="text-cyan-300 stroke-[3]" />
            <span className="text-[11px] sm:text-xs mt-0.5">Forward</span>
          </button>

          <button
            data-testid="sojourner-btn-right"
            disabled={isRunning || scannedTarget || commands.length >= 10}
            onClick={() => addCommand('R')}
            className="min-h-[48px] flex-1 flex flex-col items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-xs font-bold transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <RotateCw size={18} className="text-cyan-400" />
            <span className="text-[10px] sm:text-xs mt-0.5">Turn R</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            data-testid="sojourner-btn-undo"
            disabled={isRunning || scannedTarget || commands.length === 0}
            onClick={removeLastCommand}
            className="min-h-[48px] px-3 flex flex-col items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer disabled:opacity-30"
            title="Undo (Backspace)"
          >
            <Undo2 size={16} />
            <span className="text-[9px] font-mono mt-0.5">Undo</span>
          </button>

          <button
            data-testid="sojourner-btn-transmit"
            disabled={isRunning || scannedTarget || commands.length === 0}
            onClick={transmitSequence}
            className="min-h-[48px] px-4 sm:px-5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-transform active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <Play size={16} className="fill-current" />
            <span>TRANSMIT</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SojournerRoverGame;
