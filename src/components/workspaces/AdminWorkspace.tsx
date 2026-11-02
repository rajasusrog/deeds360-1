import React, { useState } from 'react';
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight,
  Filter,
  Search,
  Check,
  X,
  Eye,
  Stamp
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function AdminWorkspace() {
  const { savedDrafts, updateDraftStatus, loadDraft, setActiveTab } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // SRO Branch metrics
  const pendingApprovals = savedDrafts.filter(d => d.status === 'Pending Review' || d.status === 'Review');
  const approvedDeeds = savedDrafts.filter(d => d.status === 'Approved' || d.status === 'Finalized' || d.status === 'Generated');

  const filteredDeeds = savedDrafts.filter(d => {
    const matchesStatus = filterStatus === 'All' || d.status === filterStatus;
    const matchesSearch = d.docNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.writer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800" id="admin-sro-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-[10px] font-black uppercase tracking-wider">
                Sub-Registrar Office Branch Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">SRO Mylapore (Joint-I)</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              SRO Branch Admin & Deed Approval Executive Console
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Oversee daily document submissions, review writer draft compliance, issue SRO official stamps & approvals, and manage token queues.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Token Queue Active</span>
              <span className="text-sm font-black text-emerald-400">18 Tokens Scheduled</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Pending SRO Reviews</span>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">{pendingApprovals.length} Deeds</h3>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">Awaiting Sub-Registrar Seal</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Approved & Sealed</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{approvedDeeds.length} Deeds</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              Synced with Deed360
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Stamp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Licensed Staff On Duty</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">8 Writers</h3>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">3 Counter Desks Open</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Today's Tariff Collections</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹ 18.4 Lakhs</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              100% Fee Reconciliation
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* SRO Document Approval Queue */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">SRO Document Approval Queue</h3>
            <p className="text-xs text-slate-400">Review submitted legal drafts, check guideline compliance, & issue official approval</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search deed or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-500"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Deed Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Writer</th>
                <th className="py-2.5 px-3 text-right">Declared Value</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Approval Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDeeds.map((deed) => (
                <tr key={deed.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    <div>{deed.docNo}</div>
                    <span className="text-[10px] text-slate-400 font-medium block truncate max-w-44">{deed.propertyAddress}</span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-700">{deed.docType}</td>
                  <td className="py-3 px-3 text-slate-600">{deed.writer}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    ₹ {deed.consideration.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      deed.status === 'Approved' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : deed.status === 'Pending Review' 
                        ? 'bg-amber-100 text-amber-800 animate-pulse' 
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {deed.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        loadDraft(deed.id);
                        setActiveTab('wizard');
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded transition cursor-pointer"
                    >
                      Inspect
                    </button>
                    {deed.status !== 'Approved' && (
                      <button
                        onClick={() => updateDraftStatus(deed.id, 'Approved')}
                        className="px-2.5 py-1 bg-[#c49a36] hover:bg-[#a57a20] text-white font-bold text-[11px] rounded transition cursor-pointer"
                      >
                        Approve Deed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
