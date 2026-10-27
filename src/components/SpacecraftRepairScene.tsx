import React, { useState } from 'react';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import { Wrench, CheckCircle2, ChevronRight, Zap, Radio, Sliders, X, ChevronDown, ChevronUp } from 'lucide-react';

interface SpacecraftRepairSceneProps {
  collectedPartIds?: string[];
  onRepairComplete: () => void;
  onClose?: () => void;
}

export const SpacecraftRepairScene: React.FC<SpacecraftRepairSceneProps> = ({
  collectedPartIds = [],
  onRepairComplete,
  onClose,
}) => {
  const [repairs, setRepairs] = useState({
    gimbal: false,
    powerBus: false,
    gyro: false,
  });

  const [activeTab, setActiveTab] = useState<'gimbal' | 'powerBus' | 'gyro'>('gimbal');
  const [showGimbalWhy, setShowGimbalWhy] = useState(false);
  const [showPowerWhy, setShowPowerWhy] = useState(false);
  const [showGyroWhy, setShowGyroWhy] = useState(false);

  // Mini-puzzle states
  const [gimbalAngle, setGimbalAngle] = useState(12); // target is 0°
  const [powerFrequency, setPowerFrequency] = useState(30); // target is 60Hz
  const [gyroTrim, setGyroTrim] = useState(-15); // target is 0

  const handleFixGimbal = (val?: number) => {
    const angle = val !== undefined ? val : gimbalAngle;
    sound.playHover();
    if (Math.abs(angle) <= 2) {
      sound.playSuccess();
      setRepairs((prev) => ({ ...prev, gimbal: true }));
    }
  };

  const handleFixPower = (val?: number) => {
    const freq = val !== undefined ? val : powerFrequency;
    sound.playHover();
    if (freq >= 58 && freq <= 62) {
      sound.playSuccess();
      setRepairs((prev) => ({ ...prev, powerBus: true }));
    }
  };

  const handleFixGyro = (val?: number) => {
    const trim = val !== undefined ? val : gyroTrim;
    sound.playHover();
    if (Math.abs(trim) <= 1) {
      sound.playSuccess();
      setRepairs((prev) => ({ ...prev, gyro: true }));
    }
  };

  const allRepairsDone = repairs.gimbal && repairs.powerBus && repairs.gyro;

  return (
    <div data-testid="repair-scene" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                ASCENT MODULE INITIALIZATION
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white font-display">
                Spacecraft Systems Calibration
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-slate-400 hidden sm:block">
              Status: <span className={allRepairsDone ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {allRepairsDone ? 'READY' : '3 Calibrations Required'}
              </span>
            </div>
            {onClose && (
              <button
                onClick={() => {
                  sound.playClick();
                  onClose();
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          
          {/* Hardware Status Banner (10 words) */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span>8/8 components mounted. Calibrate the 3 subsystems below for launch.</span>
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1 shrink-0 ml-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hardware Ready</span>
            </span>
          </div>

          {/* Subsystem Navigation Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { sound.playHover(); setActiveTab('gimbal'); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'gimbal'
                  ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                  : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-mono font-semibold truncate">1. Gimbal</span>
              {repairs.gimbal && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>

            <button
              onClick={() => { sound.playHover(); setActiveTab('powerBus'); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'powerBus'
                  ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                  : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-mono font-semibold truncate">2. Power Bus</span>
              {repairs.powerBus && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>

            <button
              onClick={() => { sound.playHover(); setActiveTab('gyro'); }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'gyro'
                  ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                  : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-mono font-semibold truncate">3. Gyroscope</span>
              {repairs.gyro && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>
          </div>

          {/* Active Workspace */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            
            {/* 1. GIMBAL REPAIR */}
            {activeTab === 'gimbal' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Thruster Gimbal Vector</span>
                  {repairs.gimbal && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">ALIGNED (0.0°)</span>
                  )}
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between gap-2">
                  <span>Center rocket gimbal to <strong>0°</strong> to align thrust with center of mass.</span>
                  <button
                    onClick={() => setShowGimbalWhy((p) => !p)}
                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 shrink-0 underline cursor-pointer"
                  >
                    {showGimbalWhy ? 'Hide' : 'Why?'}
                  </button>
                </div>

                {showGimbalWhy && (
                  <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs text-slate-300 animate-in fade-in duration-150">
                    Inspired by Sojourner's joints. Off-center thrust causes uncontrolled tumbling during ascent.
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Gimbal Angle:
                    </span>
                    <span className={Math.abs(gimbalAngle) <= 2 ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                      {gimbalAngle > 0 ? `+${gimbalAngle}°` : `${gimbalAngle}°`} {Math.abs(gimbalAngle) <= 2 ? '(CENTERED)' : ''}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="-25"
                    max="25"
                    value={gimbalAngle}
                    disabled={repairs.gimbal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGimbalAngle(val);
                      if (Math.abs(val) <= 2) handleFixGimbal(val);
                    }}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>-25° PITCH</span>
                    <span>0° TRUE CENTER</span>
                    <span>+25° PITCH</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. POWER BUS REPAIR */}
            {activeTab === 'powerBus' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Power Inverter Bus</span>
                  {repairs.powerBus && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">SYNCHRONIZED (60 Hz)</span>
                  )}
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between gap-2">
                  <span>Match main bus frequency to <strong>60 Hz</strong> to prevent power surge.</span>
                  <button
                    onClick={() => setShowPowerWhy((p) => !p)}
                    className="text-[10px] font-mono text-amber-400 hover:text-amber-300 shrink-0 underline cursor-pointer"
                  >
                    {showPowerWhy ? 'Hide' : 'Why?'}
                  </button>
                </div>

                {showPowerWhy && (
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-slate-300 animate-in fade-in duration-150">
                    Inspired by Opportunity's power cycling to prevent thermal battery overload.
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      Frequency:
                    </span>
                    <span className={powerFrequency >= 58 && powerFrequency <= 62 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {powerFrequency} Hz {powerFrequency >= 58 && powerFrequency <= 62 ? '(SYNCHRONIZED)' : ''}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={powerFrequency}
                    disabled={repairs.powerBus}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPowerFrequency(val);
                      if (val >= 58 && val <= 62) handleFixPower(val);
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>20 Hz (Low)</span>
                    <span>60 Hz (Standard)</span>
                    <span>100 Hz (High)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. GYRO REPAIR */}
            {activeTab === 'gyro' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Inertial Navigation Trim</span>
                  {repairs.gyro && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">CALIBRATED (0.00 μrad/s)</span>
                  )}
                </div>

                <div className="text-xs text-slate-300 flex items-center justify-between gap-2">
                  <span>Trim navigation gyro drift to <strong>0.00 μrad/s</strong>.</span>
                  <button
                    onClick={() => setShowGyroWhy((p) => !p)}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 shrink-0 underline cursor-pointer"
                  >
                    {showGyroWhy ? 'Hide' : 'Why?'}
                  </button>
                </div>

                {showGyroWhy && (
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-300 animate-in fade-in duration-150">
                    Inspired by InSight's seismic sensor stabilization to nullify guidance drift.
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      Drift Trim:
                    </span>
                    <span className={Math.abs(gyroTrim) <= 1 ? 'text-emerald-400 font-bold' : 'text-emerald-400'}>
                      {gyroTrim > 0 ? `+${gyroTrim}` : `${gyroTrim}`} μrad/s {Math.abs(gyroTrim) <= 1 ? '(NULLIFIED)' : ''}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={gyroTrim}
                    disabled={repairs.gyro}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGyroTrim(val);
                      if (Math.abs(val) <= 1) handleFixGyro(val);
                    }}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>-30 μrad/s</span>
                    <span>0.00 μrad/s</span>
                    <span>+30 μrad/s</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <NovaAvatar mood={allRepairsDone ? 'celebrate' : 'happy'} size={32} />
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {allRepairsDone
                ? '"All systems nominal! Ready for launch."'
                : '"Adjust sliders until all signals turn green."'}
            </div>
          </div>

          <button
            data-testid="launch-ascent-btn"
            disabled={!allRepairsDone}
            onClick={() => {
              sound.playClick();
              onRepairComplete();
            }}
            className="px-5 py-2 rounded-xl font-bold font-mono text-xs tracking-wider transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
          >
            <span>COMMENCE RETURN ASCENT</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
