import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../../systems/debug';

interface LunokhodLostRoverGameProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const GRID_COLS = 7;
export const GRID_ROWS = 5;

// Deterministic target positions for each attempt (strictly inner squares, never outer ring)
// Outer ring has x=0, x=6, y=0, y=4. All 8 targets have x in 1..5, y in 1..3.
export const LUNOKHOD_TARGETS: Array<{ x: number; y: number }> = [
  { x: 3, y: 2 }, // Attempt 0: center
  { x: 1, y: 1 }, // Attempt 1: top-left
  { x: 5, y: 2 }, // Attempt 2: right
  { x: 2, y: 3 }, // Attempt 3: bottom-left
  { x: 4, y: 1 }, // Attempt 4: top-right
  { x: 2, y: 1 }, // Attempt 5: mid-top-left
  { x: 4, y: 3 }, // Attempt 6: bottom-right
  { x: 3, y: 1 }, // Attempt 7: top-center
];

export type DistanceBand = 'found' | 'hot' | 'warm' | 'cool' | 'cold';

export interface ScannedCellData {
  x: number;
  y: number;
  band: DistanceBand;
  dist: number;
}

export const LunokhodLostRoverGame: React.FC<LunokhodLostRoverGameProps> = ({ onSuccess, onClose }) => {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [reactionText, setReactionText] = useState<string | undefined>(undefined);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear reaction text after 2.5s
  const triggerReaction = useCallback((text: string) => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
    }
    setReactionText(text);
    reactionTimerRef.current = setTimeout(() => {
      setReactionText(undefined);
    }, 2500);
  }, []);

  const handleRetry = useCallback(() => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
    }
    setReactionText(undefined);
    setAttemptIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  return (
    <MiniGameShell
      wreckId="moon_lunokhod1"
      title="Lunokhod 1 Lost Rover"
      instruction="Tap squares to scan. Find the lost rover!"
      winTitle={(stars) => (stars === 1 ? 'ROVER FOUND... EVENTUALLY!' : 'ROVER FOUND!')}
      claimLabel="Log Relic ->"
      factTeaser="Tap to unlock a real Moon mission fact!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <LunokhodContent
          key={attemptIndex}
          attemptIndex={attemptIndex}
          onWinTrigger={win}
          onFailTrigger={fail}
          onReactionChange={triggerReaction}
          assistActive={assistActive}
        />
      )}
    </MiniGameShell>
  );
};

export default LunokhodLostRoverGame;

interface LunokhodContentProps {
  attemptIndex: number;
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

export const LunokhodContent: React.FC<LunokhodContentProps> = ({
  attemptIndex,
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useMemo(() => isReduceMotionEnabled(), []);

  // Deterministic target for this attempt
  const target = useMemo(() => {
    return LUNOKHOD_TARGETS[attemptIndex % LUNOKHOD_TARGETS.length];
  }, [attemptIndex]);

  const targetRef = useRef(target);
  targetRef.current = target;

  const assistActiveRef = useRef(assistActive);
  assistActiveRef.current = assistActive;

  // Game state
  const [phase, setPhase] = useState<'searching' | 'found'>('searching');
  const phaseRef = useRef<'searching' | 'found'>('searching');
  phaseRef.current = phase;

  const [scannedMap, setScannedMap] = useState<Map<string, ScannedCellData>>(new Map());
  const scannedMapRef = useRef<Map<string, ScannedCellData>>(scannedMap);
  scannedMapRef.current = scannedMap;

  const [scanningCell, setScanningCell] = useState<{ x: number; y: number } | null>(null);
  const isScanningRef = useRef(false);

  const [focusedCell, setFocusedCell] = useState<{ x: number; y: number }>({ x: 3, y: 2 });
  const focusedCellRef = useRef<{ x: number; y: number }>({ x: 3, y: 2 });
  focusedCellRef.current = focusedCell;

  const [scansCount, setScansCount] = useState(0);
  const scansCountRef = useRef(0);
  scansCountRef.current = scansCount;

  const starsRef = useRef<1 | 2 | 3>(3);

  // Reaction events tracking (first hot, first cold)
  const hadFirstHotRef = useRef(false);
  const hadFirstColdRef = useRef(false);

  // Idle assistance (12s without scan -> hint line, no auto-scan)
  const idleTimerRef = useRef<number>(0);
  const idleHintGivenRef = useRef(false);

  // Background seeded craters and regolith features
  const cratersData = useMemo(() => {
    const list: Array<{ x: number; y: number; r: number; dark: boolean }> = [];
    let s = 19701117 + attemptIndex * 7919;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < 9; i++) {
      list.push({
        x: 40 + rnd() * 480,
        y: 30 + rnd() * 300,
        r: 12 + rnd() * 28,
        dark: rnd() > 0.4,
      });
    }
    return list;
  }, [attemptIndex]);

  // Compute Chebyshev distance band
  const getBandForCoord = useCallback((x: number, y: number): { band: DistanceBand; dist: number } => {
    const tx = targetRef.current.x;
    const ty = targetRef.current.y;
    const dist = Math.max(Math.abs(x - tx), Math.abs(y - ty));

    if (dist === 0) {
      return { band: 'found', dist: 0 };
    }

    // Assist widens HOT to <= 2 squares
    const isHotLimit = assistActiveRef.current ? 2 : 1;
    if (dist <= isHotLimit) {
      return { band: 'hot', dist };
    } else if (dist === 2) {
      return { band: 'warm', dist };
    } else if (dist === 3) {
      return { band: 'cool', dist };
    } else {
      return { band: 'cold', dist };
    }
  }, []);

  // Execute Scan on square (x, y)
  const scanCell = useCallback((x: number, y: number) => {
    if (phaseRef.current !== 'searching') return;
    if (isScanningRef.current) return; // Prevent double scans

    const key = `${x},${y}`;
    if (scannedMapRef.current.has(key)) return; // Already scanned

    idleTimerRef.current = 0; // Reset idle timer
    isScanningRef.current = true;
    setScanningCell({ x, y });
    setFocusedCell({ x, y });

    sound.playScanner();

    const sweepDuration = reduceMotion ? 0 : 300;

    setTimeout(() => {
      const { band, dist } = getBandForCoord(x, y);
      const nextScans = scansCountRef.current + 1;
      setScansCount(nextScans);
      scansCountRef.current = nextScans;

      const nextMap = new Map(scannedMapRef.current);
      nextMap.set(key, { x, y, band, dist });
      setScannedMap(nextMap);
      scannedMapRef.current = nextMap;

      isScanningRef.current = false;
      setScanningCell(null);

      // Feedback reactions & audio
      if (band === 'found') {
        phaseRef.current = 'found';
        setPhase('found');
        sound.playSuccess();
        sound.playSonarPing();
        onReactionChange('Target acquired! Lunokhod 1 has been found!');

        // Star calculations: <= 4 = 3, <= 7 = 2, 8+ = 1 (relaxed by 1 if assist)
        const limit3 = assistActiveRef.current ? 5 : 4;
        const limit2 = assistActiveRef.current ? 8 : 7;
        let awardedStars: 1 | 2 | 3 = 1;
        if (nextScans <= limit3) {
          awardedStars = 3;
        } else if (nextScans <= limit2) {
          awardedStars = 2;
        } else {
          awardedStars = 1;
        }
        starsRef.current = awardedStars;

        if (awardedStars === 1) {
          onFailTrigger();
        }

        setTimeout(() => {
          onWinTrigger({ stars: awardedStars });
        }, 650);
      } else {
        sound.playInteract();

        if (band === 'hot' && !hadFirstHotRef.current) {
          hadFirstHotRef.current = true;
          onReactionChange('Getting warmer, Explorer!');
        } else if (band === 'cold' && !hadFirstColdRef.current) {
          hadFirstColdRef.current = true;
          onReactionChange('Signal is cold. Try another zone!');
        }
      }
    }, sweepDuration);
  }, [getBandForCoord, onFailTrigger, onReactionChange, onWinTrigger, reduceMotion]);

  // Keyboard navigation & space/enter scanning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'searching') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        setFocusedCell((prev) => {
          let nx = prev.x;
          let ny = prev.y;
          if (e.code === 'ArrowLeft') nx = Math.max(0, nx - 1);
          if (e.code === 'ArrowRight') nx = Math.min(GRID_COLS - 1, nx + 1);
          if (e.code === 'ArrowUp') ny = Math.max(0, ny - 1);
          if (e.code === 'ArrowDown') ny = Math.min(GRID_ROWS - 1, ny + 1);
          return { x: nx, y: ny };
        });
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        const f = focusedCellRef.current;
        scanCell(f.x, f.y);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanCell]);

  // Idle assistance timer loop (12s with no scan)
  useEffect(() => {
    const interval = setInterval(() => {
      if (phaseRef.current !== 'searching') return;
      idleTimerRef.current += 1;

      if (idleTimerRef.current >= 12 && !idleHintGivenRef.current) {
        idleHintGivenRef.current = true;
        onReactionChange('Try scanning near the center of the grid!');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onReactionChange]);

  // Autopilot implementation for QA testing
  const runSmartStep = useCallback(() => {
    if (phaseRef.current !== 'searching') return;
    if (isScanningRef.current) return;

    // All 35 coordinates
    const allCoords: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        allCoords.push({ x, y });
      }
    }

    const currentScanned = scannedMapRef.current;

    // Filter candidates consistent with all feedbacks
    const candidates = allCoords.filter((coord) => {
      if (currentScanned.has(`${coord.x},${coord.y}`)) return false;

      for (const [_, sc] of currentScanned.entries()) {
        const d = Math.max(Math.abs(coord.x - sc.x), Math.abs(coord.y - sc.y));
        const isHotLimit = assistActiveRef.current ? 2 : 1;

        if (sc.band === 'hot' && d > isHotLimit) return false;
        if (sc.band === 'warm' && d !== 2) return false;
        if (sc.band === 'cool' && d !== 3) return false;
        if (sc.band === 'cold' && d < 4) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      // Fallback: pick any unscanned
      const unscanned = allCoords.filter((c) => !currentScanned.has(`${c.x},${c.y}`));
      if (unscanned.length > 0) {
        scanCell(unscanned[0].x, unscanned[0].y);
      }
      return;
    }

    // If center (3, 2) is candidate and not scanned yet, scan center
    if (!currentScanned.has('3,2') && candidates.some((c) => c.x === 3 && c.y === 2)) {
      scanCell(3, 2);
      return;
    }

    // Pick probe among candidates that minimizes maximum remaining candidate subset (minimax partition)
    let bestScore = Infinity;
    let bestProbe = candidates[0];

    for (const probe of candidates) {
      const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      for (const cand of candidates) {
        const d = Math.max(Math.abs(probe.x - cand.x), Math.abs(probe.y - cand.y));
        if (d === 0) counts[0]++;
        else if (d === 1) counts[1]++;
        else if (d === 2) counts[2]++;
        else if (d === 3) counts[3]++;
        else counts[4]++;
      }
      const maxRemaining = Math.max(counts[1], counts[2], counts[3], counts[4]);
      const sumSquares = counts[1] ** 2 + counts[2] ** 2 + counts[3] ** 2 + counts[4] ** 2;
      const score = maxRemaining * 1000 + sumSquares;
      if (score < bestScore) {
        bestScore = score;
        bestProbe = probe;
      }
    }

    scanCell(bestProbe.x, bestProbe.y);
  }, [scanCell]);

  const runRandomStep = useCallback(() => {
    if (phaseRef.current !== 'searching') return;
    if (isScanningRef.current) return;

    const unscanned: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (!scannedMapRef.current.has(`${x},${y}`)) {
          unscanned.push({ x, y });
        }
      }
    }

    if (unscanned.length === 0) return;
    // Deterministic pseudo-random pick
    const seed = attemptIndex * 101 + unscanned.length * 37;
    const idx = Math.abs(seed) % unscanned.length;
    const pick = unscanned[idx];
    scanCell(pick.x, pick.y);
  }, [attemptIndex, scanCell]);

  // Autopilot loop runner
  const autopilotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutopilot = useCallback((mode: 'perfect' | 'smart' | 'random') => {
    if (autopilotTimerRef.current) {
      clearInterval(autopilotTimerRef.current);
      autopilotTimerRef.current = null;
    }

    if (mode === 'perfect') {
      const t = targetRef.current;
      scanCell(t.x, t.y);
    } else if (mode === 'smart') {
      // Step immediately then interval
      runSmartStep();
      autopilotTimerRef.current = setInterval(() => {
        if (phaseRef.current === 'found') {
          if (autopilotTimerRef.current) clearInterval(autopilotTimerRef.current);
          return;
        }
        runSmartStep();
      }, 70);
    } else if (mode === 'random') {
      runRandomStep();
      autopilotTimerRef.current = setInterval(() => {
        if (phaseRef.current === 'found') {
          if (autopilotTimerRef.current) clearInterval(autopilotTimerRef.current);
          return;
        }
        runRandomStep();
      }, 70);
    }
  }, [runRandomStep, runSmartStep, scanCell]);

  useEffect(() => {
    return () => {
      if (autopilotTimerRef.current) clearInterval(autopilotTimerRef.current);
    };
  }, []);

  // Debug Hook Registration (gated behind isDebugMode)
  useEffect(() => {
    if (isDebugMode && typeof window !== 'undefined') {
      (window as any).__lostGame = {
        getState: () => {
          const firstCell = document.querySelector('[data-testid="lost-cell-0-0"]');
          const rect = firstCell ? firstCell.getBoundingClientRect() : null;
          return {
            phase: phaseRef.current,
            target: { ...targetRef.current },
            scans: scansCountRef.current,
            stars: starsRef.current,
            attempt: attemptIndex,
            isScanning: isScanningRef.current,
            squareSizeCss: rect ? Math.min(rect.width, rect.height) : 46,
          };
        },
        scanSquare: (x: number, y: number) => {
          scanCell(x, y);
        },
        setAutopilot: (mode: 'perfect' | 'smart' | 'random') => {
          startAutopilot(mode);
        },
      };

      return () => {
        delete (window as any).__lostGame;
      };
    }
  }, [attemptIndex, scanCell, startAutopilot]);

  // Render Background Canvas (Regolith texture + Seeded Craters)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Regolith base gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle regolith noise
    for (let i = 0; i < 600; i++) {
      const nx = (i * 97) % w;
      const ny = (i * 131) % h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(nx, ny, 1.5, 1.5);
    }

    // Seeded Craters
    for (const cr of cratersData) {
      ctx.save();
      // Outer shadow / rim
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.r, 0, Math.PI * 2);
      ctx.fillStyle = cr.dark ? '#090d16' : '#141e2e';
      ctx.fill();

      // Lit rim highlight (top-left)
      ctx.beginPath();
      ctx.arc(cr.x - 1, cr.y - 1, cr.r * 0.95, Math.PI * 0.75, Math.PI * 1.75);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Shadow rim (bottom-right)
      ctx.beginPath();
      ctx.arc(cr.x + 1, cr.y + 1, cr.r * 0.95, -Math.PI * 0.25, Math.PI * 0.75);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }, [cratersData]);

  return (
    <div
      data-testid="lost-game"
      data-phase={phase}
      className="w-full flex-1 flex flex-col items-center justify-between min-h-0 select-none touch-none overscroll-none"
    >
      {/* Top Status Bar: Ping Counter */}
      <div className="w-full flex items-center justify-between px-3 py-1 shrink-0 max-w-[560px]">
        <div
          data-testid="lost-pings"
          className="flex items-center gap-2 px-3 py-1 bg-slate-900/90 rounded-full border border-slate-700/80 text-xs font-mono font-bold text-cyan-300 shadow-md"
        >
          <span>Scans {scansCount}</span>
          <div className="flex gap-1 items-center">
            {Array.from({ length: Math.min(scansCount, 8) }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i < 4 ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.6)]' : i < 7 ? 'bg-amber-400' : 'bg-rose-400'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Orbiter Telemetry: 7×5 Grid</span>
        </div>
      </div>

      {/* Main Grid & Regolith Viewport */}
      <div className="w-full flex-1 flex items-center justify-center my-0.5 sm:my-1 min-h-0 relative">
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl bg-[#090d16] p-1 sm:p-2.5">
          {/* Background Regolith Canvas (>=340px mobile, >=560px desktop) */}
          <canvas
            ref={canvasRef}
            data-testid="lost-grid-canvas"
            width={560}
            height={390}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-85"
          />

          {/* Interactive 7 x 5 Grid Overlay */}
          <div
            className="relative z-10 grid grid-cols-7 gap-1 sm:gap-2"
            style={{ touchAction: 'none' }}
          >
            {Array.from({ length: GRID_ROWS }).map((_, y) =>
              Array.from({ length: GRID_COLS }).map((_, x) => {
                const cellKey = `${x},${y}`;
                const scannedData = scannedMap.get(cellKey);
                const isScanning = scanningCell?.x === x && scanningCell?.y === y;
                const isFocused = focusedCell.x === x && focusedCell.y === y;
                const isFound = scannedData?.band === 'found';

                // Determine Cell Style
                let cellClasses = 'relative flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 select-none ';
                // Sizing: mobile >= 44 css px, desktop >= 56 css px
                cellClasses += 'w-[46px] h-[46px] sm:w-[70px] sm:h-[70px] min-w-[44px] min-h-[44px] ';

                if (isFound) {
                  cellClasses += 'bg-emerald-500/35 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.7)] ';
                } else if (scannedData) {
                  if (scannedData.band === 'hot') {
                    cellClasses += 'bg-rose-500/30 border-2 border-rose-400/90 shadow-[0_0_12px_rgba(244,63,94,0.4)] ';
                  } else if (scannedData.band === 'warm') {
                    cellClasses += 'bg-amber-500/25 border-2 border-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.3)] ';
                  } else if (scannedData.band === 'cool') {
                    cellClasses += 'bg-sky-500/20 border-2 border-sky-400/70 shadow-[0_0_6px_rgba(56,189,248,0.25)] ';
                  } else {
                    cellClasses += 'bg-slate-900/80 border border-slate-700/60 ';
                  }
                } else {
                  // Unscanned square
                  cellClasses += 'bg-slate-900/40 hover:bg-slate-800/60 active:bg-cyan-950/60 border border-slate-700/60 hover:border-cyan-500/60 ';
                }

                // Keyboard focus highlight
                if (isFocused && phase === 'searching') {
                  cellClasses += 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950 z-20 ';
                }

                return (
                  <button
                    key={cellKey}
                    data-testid={`lost-cell-${x}-${y}`}
                    type="button"
                    onClick={() => scanCell(x, y)}
                    disabled={phase !== 'searching' || isScanningRef.current}
                    className={cellClasses}
                    aria-label={`Grid cell column ${x + 1} row ${y + 1}`}
                  >
                    {/* Unscanned corner tick marks */}
                    {!scannedData && !isScanning && (
                      <span className="text-[10px] text-slate-500 font-mono select-none pointer-events-none">
                        +
                      </span>
                    )}

                    {/* Scanning radar sweep animation (0.3s) */}
                    {isScanning && (
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl bg-cyan-950/50">
                        <div
                          className={`w-full h-full rounded-full border-2 border-cyan-400 ${
                            reduceMotion ? '' : 'animate-ping'
                          }`}
                        />
                        <div className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
                      </div>
                    )}

                    {/* Found Lunokhod Procedural Sprite */}
                    {isFound && (
                      <div className="relative flex items-center justify-center w-full h-full">
                        {/* Ping flash glow */}
                        {!reduceMotion && (
                          <span className="absolute inset-0 rounded-xl bg-emerald-400/40 animate-ping pointer-events-none" />
                        )}
                        <LunokhodSprite />
                      </div>
                    )}

                    {/* Scanned hot/cold ring pips (Second cue: 3/2/1/0 rings, no numbers or text in DOM) */}
                    {scannedData && !isFound && (
                      <RingPipsCue band={scannedData.band} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Ring Pips Cue: 3 / 2 / 1 / 0 ring pips
 * Color is accompanied by concentric rings so color is NEVER the only cue.
 * NEVER prints numbers or answer text in DOM.
 */
const RingPipsCue: React.FC<{ band: DistanceBand }> = ({ band }) => {
  if (band === 'hot') {
    // 3 ring pips
    return (
      <svg
        className="w-7 h-7 sm:w-10 sm:h-10 text-rose-400 pointer-events-none"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="3.5" fill="currentColor" />
        <circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
        <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }

  if (band === 'warm') {
    // 2 ring pips
    return (
      <svg
        className="w-7 h-7 sm:w-10 sm:h-10 text-amber-400 pointer-events-none"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="3.5" fill="currentColor" />
        <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      </svg>
    );
  }

  if (band === 'cool') {
    // 1 ring pip
    return (
      <svg
        className="w-7 h-7 sm:w-10 sm:h-10 text-sky-400 pointer-events-none"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="5" fill="currentColor" />
      </svg>
    );
  }

  // Cold: 0 ring pips (tiny faint core dot only)
  return (
    <svg
      className="w-5 h-5 sm:w-7 sm:h-7 text-slate-600 pointer-events-none"
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
};

/**
 * Procedural Lunokhod 1 Sprite (Tub body, 8 wheels, tilted circular solar lid)
 */
const LunokhodSprite: React.FC = () => {
  return (
    <svg
      className="w-9 h-9 sm:w-14 sm:h-14 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-in zoom-in-75 duration-300 select-none pointer-events-none"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      {/* 8 Wire Mesh Wheels (4 left, 4 right) */}
      <g fill="#334155" stroke="#94a3b8" strokeWidth="1">
        {/* Left Wheels */}
        <rect x="5" y="13" width="7" height="8" rx="2" />
        <rect x="5" y="23" width="7" height="8" rx="2" />
        <rect x="5" y="33" width="7" height="8" rx="2" />
        <rect x="5" y="43" width="7" height="8" rx="2" />
        {/* Right Wheels */}
        <rect x="52" y="13" width="7" height="8" rx="2" />
        <rect x="52" y="23" width="7" height="8" rx="2" />
        <rect x="52" y="33" width="7" height="8" rx="2" />
        <rect x="52" y="43" width="7" height="8" rx="2" />
      </g>

      {/* Bathtub Chassis (Curved tub body) */}
      <path
        d="M 14 17 Q 11 32 15 48 L 49 48 Q 53 32 50 17 Z"
        fill="#64748b"
        stroke="#e2e8f0"
        strokeWidth="2"
      />
      {/* Tub upper rim */}
      <path
        d="M 12 17 L 52 17 L 50 21 L 14 21 Z"
        fill="#475569"
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {/* Tilted Circular Solar Lid Hinged Open at Top */}
      <ellipse cx="32" cy="17" rx="16" ry="7" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.6" />
      <ellipse cx="32" cy="17" rx="12" ry="4.5" fill="#1e293b" />
      {/* Solar cell grid lines */}
      <line x1="22" y1="17" x2="42" y2="17" stroke="#38bdf8" strokeWidth="0.8" />
      <line x1="32" y1="13" x2="32" y2="21" stroke="#38bdf8" strokeWidth="0.8" />

      {/* Front Stereoscopic Camera Ports */}
      <circle cx="25" cy="44" r="2.5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1" />
      <circle cx="39" cy="44" r="2.5" fill="#0284c7" stroke="#e0f2fe" strokeWidth="1" />

      {/* Laser Corner Retroreflector Prism on front-right */}
      <rect x="41" y="32" width="6" height="6" rx="1" fill="#10b981" stroke="#a7f3d0" strokeWidth="1" />

      {/* Helical High-Gain Antenna on front-left */}
      <line x1="19" y1="24" x2="13" y2="12" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="13" cy="12" r="2" fill="#f59e0b" />
    </svg>
  );
};
