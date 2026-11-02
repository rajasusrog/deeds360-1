import React from 'react';
import { 
  FileText, 
  Plus, 
  Bot, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  FolderOpen, 
  ArrowRight, 
  Users, 
  ScanText, 
  Settings,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function DocumentWriterWorkspace() {
  const { savedDrafts, loadDraft, createDraft, setActiveTab, calculateProgress } = useApp();

  // Active drafts
  const totalDrafts = savedDrafts.length;
  const inProgress = savedDrafts.filter(d => d.status === 'Draft' || d.status === 'In Progress');
  const readyForSro = savedDrafts.filter(d => d.status === 'Generated' || d.status === 'Approved');

  const handleStartNewDeed = () => {
    createDraft('Sale Deed', 'Absolute Conveyance');
    setActiveTab('wizard');
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" id="document-writer-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-black uppercase tracking-wider">
                Licenced Document Writer Workspace
              </span>
              <span className="text-xs text-slate-400 font-mono">Deed360 12-Step Drafting Engine</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              DocumentWriter360 Professional Drafting Studio
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Draft Sale Deeds, Lease Agreements, Gifts, and Power of Attorney with automated survey validation, Bilingual Tamil-English translation, and Deed360 SRO exports.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('ai-agents')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Bot className="h-4 w-4 text-amber-400" />
              <span>10 AI Agents Hub</span>
            </button>

            <button
              onClick={handleStartNewDeed}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 font-black text-slate-950 text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Deed Wizard (Step 1-12)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">My Active Drafts</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalDrafts} Deeds</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {inProgress.length} In Progress
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Ready for Deed360</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{readyForSro.length} Finalized</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3" />
              100% Validated
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Avg Drafting Time</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">18 Mins</h3>
            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3" />
              4x Faster with AI
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
            <Bot className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Connected SROs</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">SRO Mylapore</h3>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">Zone: Chennai Central</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FolderOpen className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Active Worklist & Fast Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Worklist Table */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Active Drafting Worklist</h3>
              <p className="text-xs text-slate-400">Manage and resume your Tamil Nadu deed drafts</p>
            </div>
            <button
              onClick={() => setActiveTab('documents')}
              className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 hover:underline"
            >
              <span>View Document Center</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3">Deed Reference</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Consideration</th>
                  <th className="py-2.5 px-3">Completeness</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {savedDrafts.map((deed) => {
                  const progress = calculateProgress(deed.state);
                  return (
                    <tr key={deed.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        <div className="hover:text-amber-600 transition">{deed.docNo}</div>
                        <span className="text-[10px] text-slate-400 font-medium block truncate max-w-44">{deed.propertyAddress}</span>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-700">{deed.docType}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹ {deed.consideration.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => {
                            loadDraft(deed.id);
                            setActiveTab('wizard');
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg transition cursor-pointer"
                        >
                          Resume
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Launch Tools */}
        <div className="lg:col-span-4 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                AI Assistant Fast Actions
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Automated deed generation tools</p>
            </div>

            <div className="space-y-3 mt-4">
              <button
                onClick={() => setActiveTab('ai-agents')}
                className="w-full p-3 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-amber-400">Agent 1: Smart Client Interview</p>
                  <p className="text-[10px] text-slate-400">Voice/Text interview auto-fills deed state</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>

              <button
                onClick={() => setActiveTab('ai-agents')}
                className="w-full p-3 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-emerald-400">Agent 2: OCR Parent Deed Reader</p>
                  <p className="text-[10px] text-slate-400">Scans old Tamil parent deeds & extracts boundaries</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>

              <button
                onClick={() => setActiveTab('clauses')}
                className="w-full p-3 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-indigo-400">TN Clause & Tariff Engine</p>
                  <p className="text-[10px] text-slate-400">35+ Tamil Nadu statutory mandatory clauses</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Writer License: Active</span>
            <span className="text-amber-400 font-bold">Deed360 Connected</span>
          </div>
        </div>

      </div>

    </div>
  );
}
