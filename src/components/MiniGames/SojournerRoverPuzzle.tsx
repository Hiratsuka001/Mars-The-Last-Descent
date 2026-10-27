import React, { useState } from 'react';
import { sound } from '../../systems/audio';
import { NovaAvatar } from '../NovaAvatar';
import { Compass, RotateCcw, Play, CheckCircle2, AlertTriangle, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';

interface SojournerRoverPuzzleProps {
  onSuccess: () => void;
  onClose: () => void;
}

// 6x5 grid of Ares Vallis
// 0: Flat soil, 1: Rock obstacle, 2: Sand hazard (requires careful drive), 3: Barnacle Bill Target
const GRID_WIDTH = 6;
const GRID_HEIGHT = 5;

const OBSTACLES = [
  { x: 1, y: 1, type: 'rock', name: 'Yogi Rock' },
  { x: 3, y: 0, type: 'rock', name: 'Twin Peaks Outcrop' },
  { x: 2, y: 2, type: 'rock', name: 'Moe Rock' },
  { x: 4, y: 3, type: 'sand', name: 'Drift Sand Trap' },
  { x: 0, y: 3, type: 'rock', name: 'Basalt Boulder' },
];

const TARGET = { x: 5, y: 2, name: 'Barnacle Bill (High Silica Target)' };

export const SojournerRoverPuzzle: React.FC<SojournerRoverPuzzleProps> = ({
  onSuccess,
  onClose
}) => {
  const [roverPos, setRoverPos] = useState({ x: 0, y: 1 });
  const [roverDir, setRoverDir] = useState<0 | 90 | 180 | 270>(90); // 90 is facing East
  const [commandQueue, setCommandQueue] = useState<('F' | 'L' | 'R')[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Program Sojourner’s path around rocks to deploy APXS on Barnacle Bill.');
  const [showWhy, setShowWhy] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [collision, setCollision] = useState(false);

  const addCommand = (cmd: 'F' | 'L' | 'R') => {
    if (isRunning || isCompleted) return;
    if (commandQueue.length >= 12) return;
    sound.playClick();
    setCommandQueue([...commandQueue, cmd]);
  };

  const removeLastCommand = () => {
    if (isRunning || isCompleted) return;
    sound.playClick();
    setCommandQueue(commandQueue.slice(0, -1));
  };

  const resetAll = () => {
    sound.playClick();
    setIsRunning(false);
    setRoverPos({ x: 0, y: 1 });
    setRoverDir(90);
    setCommandQueue([]);
    setCollision(false);
    setStatusMessage('Command queue reset. Plan a clear path around the rocks.');
  };

  const executeSequence = async () => {
    if (isRunning || commandQueue.length === 0 || isCompleted) return;
    setIsRunning(true);
    sound.playClick();
    setStatusMessage('Transmitting command sequence across 100 million miles of space...');

    let curX = roverPos.x;
    let curY = roverPos.y;
    let curDir = roverDir;

    for (let i = 0; i < commandQueue.length; i++) {
      const cmd = commandQueue[i];
      await new Promise((r) => setTimeout(r, 450));

      if (cmd === 'L') {
        curDir = ((curDir - 90 + 360) % 360) as 0 | 90 | 180 | 270;
        setRoverDir(curDir);
        sound.playHover();
      } else if (cmd === 'R') {
        curDir = ((curDir + 90) % 360) as 0 | 90 | 180 | 270;
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
        if (nX < 0 || nX >= GRID_WIDTH || nY < 0 || nY >= GRID_HEIGHT) {
          sound.playMistake();
          setCollision(true);
          setStatusMessage('Boundary limit reached! Rocker-bogie safety lockout triggered.');
          setIsRunning(false);
          return;
        }

        // Check obstacles
        const hitObstacle = OBSTACLES.find((o) => o.x === nX && o.y === nY);
        if (hitObstacle) {
          sound.playMistake();
          setCollision(true);
          setStatusMessage(`Hazard contact with ${hitObstacle.name}! The hazard cameras stopped the rover.`);
          setIsRunning(false);
          return;
        }

        curX = nX;
        curY = nY;
        setRoverPos({ x: curX, y: curY });
        sound.playClick();

        // Check target
        if (curX === TARGET.x && curY === TARGET.y) {
          await new Promise((r) => setTimeout(r, 200));
          sound.playSuccess();
          setIsCompleted(true);
          setIsRunning(false);
          setStatusMessage('SUCCESS: APXS deployed on Barnacle Bill! Drive motor salvaged.');
          return;
        }
      }
    }

    setIsRunning(false);
    if (curX !== TARGET.x || curY !== TARGET.y) {
      setStatusMessage('Sequence finished, but Sojourner hasn’t reached Barnacle Bill yet. Add more steps!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                ROBOTIC MOBILITY SIMULATOR
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white font-display">
                Sojourner: Waypoint Navigation
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

        <div className="p-4 sm:p-5 space-y-3">
          
          {/* Mission Explanation Banner with Collapsed Why */}
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs text-slate-300 gap-2">
            <div className="text-xs">
              Program Sojourner's route around rocks to deploy APXS on <strong>Barnacle Bill</strong>.
            </div>
            <button
              onClick={() => setShowWhy((p) => !p)}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 shrink-0 underline cursor-pointer"
            >
              {showWhy ? 'Hide' : 'Why?'}
            </button>
          </div>

          {showWhy && (
            <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs text-slate-300 animate-in fade-in duration-150">
              Light delay (10–20 min) prevents joystick control, requiring pre-planned waypoints.
            </div>
          )}

          {/* Grid Arena */}
          <div className="bg-[#180e0a] border-2 border-orange-950/70 rounded-xl p-3 shadow-inner relative overflow-hidden">
            <div className="grid grid-cols-6 gap-1.5 aspect-[6/5] max-h-[260px] w-full mx-auto">
              {Array.from({ length: GRID_HEIGHT }).map((_, y) =>
                Array.from({ length: GRID_WIDTH }).map((_, x) => {
                  const isRover = roverPos.x === x && roverPos.y === y;
                  const isTarget = TARGET.x === x && TARGET.y === y;
                  const obstacle = OBSTACLES.find((o) => o.x === x && o.y === y);

                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`relative rounded-lg flex items-center justify-center transition-colors duration-200 border ${
                        isRover
                          ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          : isTarget
                          ? 'border-emerald-500 bg-emerald-950/30 animate-pulse'
                          : obstacle?.type === 'rock'
                          ? 'border-amber-900/60 bg-amber-950/40'
                          : obstacle?.type === 'sand'
                          ? 'border-yellow-900/50 bg-yellow-950/30'
                          : 'border-orange-950/40 bg-orange-950/15 hover:bg-orange-950/25'
                      }`}
                    >
                      {/* Obstacle Icon / Rock */}
                      {obstacle?.type === 'rock' && (
                        <div className="flex flex-col items-center">
                          <span className="text-base select-none">🪨</span>
                          <span className="text-[9px] font-mono text-amber-300/80 truncate max-w-[50px]">
                            {obstacle.name.split(' ')[0]}
                          </span>
                        </div>
                      )}
                      {obstacle?.type === 'sand' && (
                        <div className="flex flex-col items-center">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-[8px] font-mono text-yellow-400">Sand</span>
                        </div>
                      )}

                      {/* Target Barnacle Bill */}
                      {isTarget && !isRover && (
                        <div className="flex flex-col items-center text-center">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 text-[10px] font-bold">
                            APXS
                          </div>
                          <span className="text-[9px] font-mono text-emerald-300 mt-0.5">Target</span>
                        </div>
                      )}

                      {/* Sojourner Rover Sprite */}
                      {isRover && (
                        <div
                          className="flex flex-col items-center transition-transform duration-300 z-10"
                          style={{ transform: `rotate(${roverDir - 90}deg)` }}
                        >
                          <div className="w-6 h-5 rounded bg-slate-200 border border-slate-400 flex items-center justify-center shadow-md relative">
                            {/* 6 Rocker Bogie Wheels */}
                            <div className="absolute -left-1 top-0 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            <div className="absolute -left-1 top-1.5 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            <div className="absolute -left-1 bottom-0 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            <div className="absolute -right-1 top-0 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            <div className="absolute -right-1 top-1.5 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            <div className="absolute -right-1 bottom-0 w-1 h-1.5 bg-slate-900 rounded-sm" />
                            {/* Solar Panel & APXS */}
                            <div className="w-3.5 h-3 bg-cyan-700 rounded-sm flex items-center justify-center">
                              <span className="text-[7px] text-white font-mono">SOJ</span>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-cyan-300 -rotate-90">▲</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
            <span className={`font-mono ${isCompleted ? 'text-emerald-400 font-semibold' : collision ? 'text-rose-400' : 'text-slate-300'}`}>
              {statusMessage}
            </span>
            <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
              Commands: {commandQueue.length}/12
            </span>
          </div>

          {/* Program Queue Display */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 overflow-x-auto min-h-[44px]">
            <span className="text-[11px] font-mono text-slate-500 uppercase shrink-0 mr-1">
              Sequence:
            </span>
            {commandQueue.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No commands loaded. Use buttons below.</span>
            ) : (
              commandQueue.map((cmd, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-cyan-300 shrink-0"
                >
                  {cmd === 'F' ? 'Forward' : cmd === 'L' ? 'Turn L' : 'Turn R'}
                </span>
              ))
            )}
          </div>

          {/* Control Pad */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                disabled={isRunning || isCompleted}
                onClick={() => addCommand('L')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Turn Left 90°</span>
              </button>

              <button
                disabled={isRunning || isCompleted}
                onClick={() => addCommand('F')}
                className="px-4 py-2 rounded-lg bg-cyan-900/60 hover:bg-cyan-800/80 text-cyan-200 border border-cyan-700/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowUp className="w-4 h-4" />
                <span>Drive Forward 1m</span>
              </button>

              <button
                disabled={isRunning || isCompleted}
                onClick={() => addCommand('R')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>Turn Right 90°</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                disabled={isRunning || isCompleted || commandQueue.length === 0}
                onClick={removeLastCommand}
                className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs cursor-pointer disabled:opacity-40"
                title="Undo last command"
              >
                Undo
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetAll}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              {!isCompleted ? (
                <button
                  disabled={isRunning || commandQueue.length === 0}
                  onClick={executeSequence}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Sequence</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    sound.playClick();
                    onSuccess();
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lock In Discovery →</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
