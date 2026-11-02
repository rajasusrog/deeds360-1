import { useState } from 'react';
import { DeedWizardState } from '../../types';
import Step11Review from './Step11Review';
import Step12Generate from './Step12Generate';
import { FileText, Printer, ShieldCheck } from 'lucide-react';

interface Step11ReviewGenerateProps {
  state: DeedWizardState;
  onJumpToStep: (step: number) => void;
}

export default function Step11ReviewGenerate({ state, onJumpToStep }: Step11ReviewGenerateProps) {
  const [tab, setTab] = useState<'review' | 'generate'>('review');

  return (
    <div className="space-y-6" id="step-11-review-generate">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('review')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
            tab === 'review'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>1. Audit & Review Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('generate')}
          className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition ${
            tab === 'generate'
              ? 'bg-[#c49a36] text-white shadow-sm'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <Printer className="h-4 w-4" />
          <span>2. Deed360 Generate, Print & Export</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      {tab === 'review' ? (
        <Step11Review state={state} onJumpToStep={onJumpToStep} />
      ) : (
        <Step12Generate state={state} />
      )}
    </div>
  );
}
