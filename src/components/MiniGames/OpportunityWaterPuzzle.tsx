import React, { useState } from 'react';
import { sound } from '../../systems/audio';
import { NovaAvatar } from '../NovaAvatar';
import { Microscope, CheckCircle2, AlertCircle, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface OpportunityWaterPuzzleProps {
  onSuccess: () => void;
  onClose: () => void;
}

interface RockSample {
  id: string;
  name: string;
  microscopicTexture: string;
  mineralogy: string;
  waterRelated: boolean;
  scientificDeduction: string;
}

const SAMPLES: RockSample[] = [
  {
    id: 'sample_a',
    name: 'Sample #01: Dark Basalt',
    microscopicTexture: 'Interlocking unrounded pyroxene crystals.',
    mineralogy: 'Dry volcanic olivine. Low sulfur.',
    waterRelated: false,
    scientificDeduction: 'Formed by rapid cooling of dry volcanic lava. Pristine condition proves absence of water.',
  },
  {
    id: 'sample_b',
    name: 'Sample #02: Hematite Spherules',
    microscopicTexture: 'Uniform spherules (1–3 mm) embedded in sulfate.',
    mineralogy: 'Pure crystalline grey hematite (Fe2O3).',
    waterRelated: true,
    scientificDeduction: 'Spherical beads precipitate inside porous rocks soaked in mineral-rich acidic groundwater.',
  },
  {
    id: 'sample_c',
    name: 'Sample #03: Cross-Bedded Bedrock',
    microscopicTexture: 'Festoon wave ripples in sedimentary layers.',
    mineralogy: 'Hydrated jarosite (water-formed iron sulfate).',
    waterRelated: true,
    scientificDeduction: 'Cross-bedded ripples form only in shallow flowing surface water currents.',
  },
  {
    id: 'sample_d',
    name: 'Sample #04: Impact Breccia',
    microscopicTexture: 'Angular shattered fragments in glass matrix.',
    mineralogy: 'Shock-melted silicate impactite.',
    waterRelated: false,
    scientificDeduction: 'Mechanical shock from meteorite impact; completely unrelated to liquid water.',
  },
];

export const OpportunityWaterPuzzle: React.FC<OpportunityWaterPuzzleProps> = ({
  onSuccess,
  onClose,
}) => {
  const [activeSampleId, setActiveSampleId] = useState<string>(SAMPLES[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [evaluated, setEvaluated] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showDeduction, setShowDeduction] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Select the 2 samples formed in liquid water.');

  const activeSample = SAMPLES.find((s) => s.id === activeSampleId)!;

  const toggleSelect = (id: string) => {
    if (isSuccess) return;
    sound.playClick();
    setEvaluated(false);
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length < 2) {
        setSelectedIds([...selectedIds, id]);
      } else {
        setSelectedIds([selectedIds[1], id]);
      }
    }
  };

  const handleEvaluate = () => {
    if (selectedIds.length !== 2) {
      sound.playMistake();
      setStatusMsg('Please select exactly 2 samples.');
      return;
    }

    setEvaluated(true);
    const waterIds = SAMPLES.filter((s) => s.waterRelated).map((s) => s.id);
    const correct = selectedIds.length === 2 && selectedIds.every((id) => waterIds.includes(id));

    if (correct) {
      sound.playSuccess();
      setIsSuccess(true);
      setStatusMsg('EVIDENCE CONFIRMED: Hematite spherules and jarosite sulfates prove ancient water!');
    } else {
      sound.playMistake();
      setIsSuccess(false);
      setStatusMsg('Incorrect: Look for minerals that only crystallize in liquid solutions.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Microscope className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                FIELD GEOLOGY LAB · 2004
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white font-display">
                Opportunity: Paleowater Analysis
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

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          
          {/* Instruction Bar */}
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Select the <strong>2 samples</strong> that formed in liquid water.</span>
            <span className="font-mono text-cyan-400 shrink-0 font-bold ml-2">Selected: {selectedIds.length}/2</span>
          </div>

          {/* Sample Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SAMPLES.map((sample) => {
              const isSelected = selectedIds.includes(sample.id);
              const isActive = activeSampleId === sample.id;

              return (
                <button
                  key={sample.id}
                  onClick={() => {
                    sound.playHover();
                    setActiveSampleId(sample.id);
                    setShowDeduction(false);
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-950/40 shadow-sm'
                      : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {sample.id.replace('sample_', '#0')}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-100 truncate">
                    {sample.name.split(':')[1]?.trim() || sample.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Specimen Inspection Panel */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs sm:text-sm font-semibold text-white font-display">
                {activeSample.name}
              </h4>

              <button
                onClick={() => toggleSelect(activeSample.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  selectedIds.includes(activeSample.id)
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {selectedIds.includes(activeSample.id) ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected</span>
                  </>
                ) : (
                  <span>Select Sample</span>
                )}
              </button>
            </div>

            {/* Microscopic Readings (Concise 1-liners) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-mono text-cyan-400 uppercase text-[9px] block font-semibold">
                  Texture
                </span>
                <p className="text-slate-200 text-xs mt-0.5">{activeSample.microscopicTexture}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="font-mono text-cyan-400 uppercase text-[9px] block font-semibold">
                  Mineralogy
                </span>
                <p className="text-slate-200 text-xs mt-0.5">{activeSample.mineralogy}</p>
              </div>
            </div>

            {/* Collapsed Scientific Deduction */}
            <div className="border border-slate-800/80 rounded-lg bg-slate-950/50 overflow-hidden">
              <button
                onClick={() => setShowDeduction((prev) => !prev)}
                className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <span>{showDeduction ? 'Hide Geological Deduction' : 'Learn More (Geological Deduction)'}</span>
                {showDeduction ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showDeduction && (
                <div className="px-3 pb-2.5 pt-1 text-xs text-slate-300 border-t border-slate-800/60 animate-in fade-in duration-150">
                  {activeSample.scientificDeduction}
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className={`font-mono ${isSuccess ? 'text-emerald-400 font-semibold' : evaluated ? 'text-rose-400' : 'text-slate-300'}`}>
              {statusMsg}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <NovaAvatar mood={isSuccess ? 'celebrate' : (evaluated ? 'warning' : 'curious')} size={32} />
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {isSuccess ? '"Martian paleowater confirmed!"' : '"Identify 2 samples formed in water."'}
            </div>
          </div>

          <div>
            {!isSuccess ? (
              <button
                disabled={selectedIds.length !== 2}
                onClick={handleEvaluate}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                Evaluate Selection
              </button>
            ) : (
              <button
                onClick={() => {
                  sound.playClick();
                  onSuccess();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Claim Part</span>
                <span className="font-mono">→</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
