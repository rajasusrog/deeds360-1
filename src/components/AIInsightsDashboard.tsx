import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  Fingerprint,
  Info,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { DeedWizardState } from '../types';
import { runAiValidation, AIValidationExtendedResult } from '../utils/aiValidator';

interface AIInsightsDashboardProps {
  state: DeedWizardState;
  onAddClause?: (clause: any) => void;
  onJumpToStep?: (step: number) => void;
}

export default function AIInsightsDashboard({ state, onAddClause, onJumpToStep }: AIInsightsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIValidationExtendedResult | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'validation' | 'fraud' | 'recommendations'>('all');

  // Live Continuous Validation with local state
  useEffect(() => {
    // Run validation immediately on mount or state changes
    const res = runAiValidation(state);
    setResult(res);
  }, [state]);

  const triggerManualValidation = () => {
    setLoading(true);
    setTimeout(() => {
      const res = runAiValidation(state);
      setResult(res);
      setLoading(false);
    }, 800);
  };

  if (!result) return null;

  const { riskScore, riskBand, warnings, fraudSignals, recommendations, factors } = result;

  // Colors based on risk level
  const getRiskColor = (band: string) => {
    switch (band) {
      case 'Critical': return 'text-rose-600 bg-rose-50 border-rose-200 ring-rose-500/20';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200 ring-orange-500/20';
      case 'Moderate': return 'text-amber-600 bg-amber-50 border-amber-200 ring-amber-500/20';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-200 ring-emerald-500/20';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'error':
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            CRITICAL
          </span>
        );
      case 'warning':
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            ADVISORY
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6 shadow-sm flex flex-col h-full text-slate-800 font-sans" id="ai-insights-panel">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
            <Brain className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Deed360 Legal Intelligence</h3>
            <p className="text-[10px] text-slate-400 font-medium">Continuous risk analysis & registry compliance diagnostics</p>
          </div>
        </div>
        
        <button
          onClick={triggerManualValidation}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-45"
          title="Force manual diagnostics scan"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Overview Block: Risk Score and Counts */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
        
        {/* Risk Score Meter (Radial or Bar) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200/60 pb-4 md:pb-0 md:pr-4">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG circle track */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={
                  riskBand === 'Critical' ? '#e11d48' :
                  riskBand === 'High' ? '#ea580c' :
                  riskBand === 'Moderate' ? '#d97706' :
                  '#10b981'
                }
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - riskScore / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            
            {/* Center score display */}
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-900 tracking-tight block">{riskScore}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${getRiskColor(riskBand)}`}>
                {riskBand} RISK
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase mt-2 tracking-wide">Registry Risk Index</span>
        </div>

        {/* Counts & Factors */}
        <div className="md:col-span-7 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white border border-slate-150 rounded-xl p-2">
              <span className="text-sm font-extrabold text-slate-900 block">{warnings.filter(w => w.severity === 'error').length}</span>
              <span className="text-[9px] font-bold text-rose-600 uppercase">Criticals</span>
            </div>
            <div className="bg-white border border-slate-150 rounded-xl p-2">
              <span className="text-sm font-extrabold text-slate-900 block">{warnings.filter(w => w.severity === 'warning').length}</span>
              <span className="text-[9px] font-bold text-amber-600 uppercase">Warnings</span>
            </div>
            <div className="bg-white border border-slate-150 rounded-xl p-2">
              <span className="text-sm font-extrabold text-slate-900 block">{fraudSignals.length}</span>
              <span className="text-[9px] font-bold text-indigo-600 uppercase">Fraud Signs</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Primary Risk Factors:</span>
            {factors.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {factors.slice(0, 4).map((f, i) => (
                  <span key={i} className="text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                    • {f}
                  </span>
                ))}
                {factors.length > 4 && (
                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded">
                    +{factors.length - 4} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> Clean record. No primary legal risk anomalies detected.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-150 text-[11px] font-bold uppercase tracking-wider shrink-0 gap-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'all' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          All Issues ({warnings.length + fraudSignals.length})
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'validation' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Gaps & Compliance ({warnings.length})
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'fraud' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Security Flags ({fraudSignals.length})
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'recommendations' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Action Plans ({recommendations.length})
        </button>
      </div>

      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 space-y-3 text-xs">
        
        {/* TAB 1: ALL OR COMPLIANCE WARNINGS */}
        {(activeTab === 'all' || activeTab === 'validation') && (
          <div className="space-y-3">
            {warnings.length === 0 && activeTab === 'validation' && (
              <div className="p-6 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                No statutory compliance gaps identified. This is an internal consistency check, not official verification.
              </div>
            )}
            
            {warnings.map((warn, i) => (
              <div 
                key={`warn-${i}`} 
                className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition duration-150 ${
                  warn.severity === 'error' ? 'bg-rose-50/30 border-rose-100 hover:bg-rose-50/55' :
                  warn.severity === 'warning' ? 'bg-amber-50/30 border-amber-150 hover:bg-amber-50/55' :
                  'bg-sky-50/20 border-sky-100 hover:bg-sky-50/35'
                }`}
              >
                {/* Badge Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                    Step {warn.step}: {warn.field}
                  </span>
                  {getSeverityBadge(warn.severity)}
                </div>

                {/* Main Message Block */}
                <div className="flex gap-2.5">
                  {warn.severity === 'error' && <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />}
                  {warn.severity === 'warning' && <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />}
                  {warn.severity === 'info' && <Info className="h-4.5 w-4.5 text-sky-600 shrink-0 mt-0.5" />}
                  
                  <div className="space-y-1 text-left">
                    {/* Explainability Block: What, Why, How */}
                    <p className="font-bold text-slate-800 leading-normal text-[11.5px]">{warn.message}</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1 italic">
                      <strong className="text-slate-600 not-italic font-bold">Diagnostics:</strong> Tamil Nadu property registration protocols mandate strict structural declarations to block civil court challenges.
                    </p>
                  </div>
                </div>

                {/* Quick Action Suggestion Footer */}
                <div className="bg-white/80 border border-slate-100 p-2 rounded-lg flex items-center justify-between text-[10px] gap-2 shadow-inner">
                  <div className="flex items-center gap-1 text-slate-500 font-medium">
                    <Lightbulb className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>{warn.suggestion}</span>
                  </div>
                  {onJumpToStep && (
                    <button
                      onClick={() => onJumpToStep(warn.step)}
                      className="text-indigo-600 hover:text-indigo-800 font-black uppercase tracking-tight flex items-center gap-0.5 shrink-0 hover:underline"
                    >
                      <span>Fix</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: FRAUD AND SECURITY SIGNALS */}
        {(activeTab === 'all' || activeTab === 'fraud') && (
          <div className="space-y-3">
            {fraudSignals.length === 0 && activeTab === 'fraud' && (
              <div className="p-6 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Fingerprint className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                No high-risk fraud signatures or identity inconsistencies detected. Format and internal consistency checks passed (Not externally verified).
              </div>
            )}

            {fraudSignals.map((fs, i) => (
              <div 
                key={`fraud-${i}`} 
                className={`p-3.5 rounded-xl border flex flex-col gap-2 bg-slate-950/40 text-slate-200 text-left relative overflow-hidden ${
                  fs.severity === 'critical' ? 'border-rose-950 bg-rose-950/20' : 'border-orange-950 bg-orange-950/10'
                }`}
              >
                {/* Glowing Side bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  fs.severity === 'critical' ? 'bg-rose-500' : 'bg-orange-500'
                }`} />

                <div className="flex items-center justify-between pl-1">
                  <span className="text-[9px] font-black text-rose-400 tracking-wider uppercase flex items-center gap-1 font-mono">
                    <ShieldAlert className="h-3 w-3" />
                    {fs.type}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-black ${
                    fs.severity === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-orange-500/20 text-orange-300'
                  }`}>
                    {fs.severity.toUpperCase()}
                  </span>
                </div>

                <p className="font-bold text-[11px] leading-relaxed text-slate-100 mt-1 pl-1">{fs.message}</p>
                
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[10px] space-y-0.5 text-slate-300 mt-1 pl-2">
                  <span className="font-bold text-slate-400 block uppercase text-[8.5px]">Countermeasure:</span>
                  <p>{fs.howToFix}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: ACTION PLANS / RECOMMENDATIONS */}
        {(activeTab === 'all' || activeTab === 'recommendations') && (
          <div className="space-y-3">
            {recommendations.length === 0 && activeTab === 'recommendations' && (
              <div className="p-6 text-center text-slate-400 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Lightbulb className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                All optimized recommendations satisfied. Perfect draft state!
              </div>
            )}

            {recommendations.map((rec, i) => (
              <div 
                key={`rec-${i}`} 
                className="p-3.5 bg-white border border-slate-150 rounded-xl flex items-start gap-3 hover:border-slate-300 transition text-left"
              >
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 mt-0.5">
                  <Lightbulb className="h-4.5 w-4.5" />
                </div>
                
                <div className="space-y-2 flex-1">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-800 text-[11.5px] leading-snug">{rec.title}</h4>
                      {getSeverityBadge(rec.severity)}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{rec.explanation}</p>
                  </div>

                  <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-[10px] font-bold text-indigo-700/95 leading-normal flex items-center justify-between gap-2">
                    <span>Action: {rec.action}</span>
                    {rec.id === 'rec_indemnity' && onAddClause && (
                      <button
                        onClick={() => {
                          onAddClause({
                            id: 'rec1_auto',
                            title: 'Section 47A Guideline Undervaluation Protection',
                            category: 'Indemnity',
                            contentEn: 'The Vendor hereby covenants that they shall fully cooperate and indemnify the Purchaser in the event of any undervaluation notice under Section 47A of the Stamp Act, provided the purchaser registers at the active guideline rate.',
                            contentTa: 'இக்கிரய பத்திரத்திற்கு முத்திரைத்தாள் சட்டம் 47A பிரிவின்கீழ் ஏதேனும் குறைவான மதிப்பீடு வழக்கு பிற்காலத்தில் பதியப்பட்டால், அதற்கு விற்பனையாளரே பொறுப்பேற்று தீர்வு செய்வார்.'
                          });
                          alert('Section 47A Protection appended to clauses list!');
                        }}
                        className="text-[9px] font-black uppercase text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded shadow-sm hover:bg-indigo-50 transition shrink-0"
                      >
                        Add Clause
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Footer Status Indicators */}
      <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Diagnostics Active
        </span>
        <span className="font-mono">
          Deed360 Engine • v12.4
        </span>
      </div>

    </div>
  );
}
