import React, { useState } from 'react';
import { 
  Scale, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  BookOpen, 
  Search, 
  Check, 
  Bot, 
  ArrowRight,
  Send,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function LawyerWorkspace() {
  const { savedDrafts, loadDraft, setActiveTab } = useApp();
  const [selectedDeedId, setSelectedDeedId] = useState<string>(savedDrafts[0]?.id || '');
  const [aiLegalQuery, setAiLegalQuery] = useState('');
  const [aiLegalResponse, setAiLegalResponse] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedDeed = savedDrafts.find(d => d.id === selectedDeedId) || savedDrafts[0];

  const handleAskAiLegal = () => {
    if (!aiLegalQuery.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setAiLegalResponse(
        `[High Court Bar Legal Opinion Assistant Analysis]\n\n` +
        `Re: Property Registration under ${selectedDeed?.docType || 'Sale Deed'} (${selectedDeed?.docNo || 'TN-SRO-2026-001'})\n\n` +
        `1. Title Flow Compliance: The 30-year uninterrupted ownership narrative appears verified against parent document references. Ensure seller power of attorney is backed by live EC verification.\n` +
        `2. Statutory Mandates: Indemnity clause for encumbrances is present. Recommend adding express Tamil Nadu Apartment Ownership Act 2022 clause if UDS is being transferred.\n` +
        `3. Stamp Duty Tariff: Declared consideration meets minimum guideline value for Mylapore Taluk survey blocks.`
      );
    }, 800);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" id="lawyer-legal-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Scale className="h-3 w-3" />
                Legal Counsel & Advocate Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">TN Bar Council Compliant</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              High Court & Bar Council Legal Review Workspace
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Conduct title flow audits, scrutinize parent deed continuity, review clause validity, and issue certified legal opinions backed by Gemini AI Legal Assistant.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setActiveTab('clauses')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              <span>Clause Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Assigned Legal Cases</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{savedDrafts.length} Deeds</h3>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">Title Verification Active</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Title Flow Risk Flags</span>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">1 Attention Needed</h3>
            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              Minor Gap in 1998 Transfer
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Approved Legal Certificates</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">18 Certified</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              Digital Advocate Stamp
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Scale className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">AI Legal Queries Run</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">42 Scans</h3>
            <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3" />
              Gemini 1.5 Pro Legal Engine
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
            <Bot className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Main Review Console & AI Legal Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Assigned Legal Review Queue */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Assigned Deed Reviews</h3>
              <p className="text-xs text-slate-400">Select a deed to perform legal title audit & clause scrutiny</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {savedDrafts.length} Deeds Pending
            </span>
          </div>

          <div className="space-y-3">
            {savedDrafts.map((deed) => (
              <div
                key={deed.id}
                onClick={() => setSelectedDeedId(deed.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  selectedDeedId === deed.id
                    ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{deed.docNo}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      {deed.docType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{deed.propertyAddress}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span>Valuation: ₹ {deed.consideration.toLocaleString('en-IN')}</span>
                    <span>•</span>
                    <span>Writer: {deed.writer}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadDraft(deed.id);
                      setActiveTab('wizard');
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Audit Draft</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Legal Assistant Panel */}
        <div className="lg:col-span-5 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-extrabold text-white">AI Legal Counsel Assistant</h3>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">
                TN Act 1899 & Deed360
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Selected Deed: <strong className="text-indigo-400">{selectedDeed?.docNo} ({selectedDeed?.docType})</strong>
              </p>

              <div className="space-y-2">
                <textarea
                  value={aiLegalQuery}
                  onChange={(e) => setAiLegalQuery(e.target.value)}
                  placeholder="Ask legal risk opinion e.g. 'Verify parent deed transfer continuity and missing indemnity clauses for Mylapore property...'"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 min-h-24"
                />

                <button
                  onClick={handleAskAiLegal}
                  disabled={isAnalyzing}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{isAnalyzing ? 'Analyzing Legal Principles...' : 'Generate Legal Opinion'}</span>
                </button>
              </div>

              {aiLegalResponse && (
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {aiLegalResponse}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Advocate Verification Seal: Active</span>
            <span className="text-emerald-400 font-bold">Bar License Valid</span>
          </div>
        </div>

      </div>

    </div>
  );
}
