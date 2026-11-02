import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  Search, 
  Filter, 
  Award, 
  BarChart3,
  DollarSign,
  Scale,
  Eye,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function AuditorWorkspace() {
  const { savedDrafts, loadDraft, setActiveTab } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState('All');

  // Audit calculation mockup
  const totalAuditDeeds = savedDrafts.length;
  const compliantCount = savedDrafts.filter(d => d.consideration >= 5000000).length;
  const shortfallCount = totalAuditDeeds - compliantCount;

  const filteredDeeds = savedDrafts.filter(d => {
    const matchesSearch = d.docNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans text-slate-800" id="auditor-compliance-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Revenue & Stamp Duty Compliance Auditor
              </span>
              <span className="text-xs text-slate-400 font-mono">TN Registration Act Sec 47-A</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              SRO Stamp Tariff & Guideline Value Audit Console
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Inspect registered deeds for undervaluation, verify official guideline tariff compliance, detect fraud signals, and issue audit reconciliation clearance.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-right">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Compliance Score</span>
              <span className="text-xs font-black text-emerald-400">98.4% Tariff Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Audited Deeds Volume</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalAuditDeeds} Deeds</h3>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">100% Inspected</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Tariff Shortfall Flags</span>
            <h3 className="text-2xl font-black text-rose-600 mt-0.5">{shortfallCount} Issues</h3>
            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              Potential Sec 47-A Review
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Reconciled Stamp Duties</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">₹ 84.2 Lakhs</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              Reconciled & Deposited
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Scale className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Unapproved Concessions</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">0 Deficiencies</h3>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">Zero Audit Exceptions</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Award className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* SRO Audit Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">SRO Revenue & Guideline Value Audit Log</h3>
            <p className="text-xs text-slate-400">Comparing declared consideration vs official Deed360 guideline tariff</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search deed reference or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Deed Reference</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Declared Consideration</th>
                <th className="py-2.5 px-3 text-right">Guideline Value</th>
                <th className="py-2.5 px-3">Stamp Duty Paid</th>
                <th className="py-2.5 px-3">Audit Risk Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDeeds.map((deed) => {
                const estGuideline = deed.consideration * 0.96; // 96% guideline mockup
                const stampDuty = deed.consideration * 0.07; // 7% TN stamp duty
                const isCompliant = deed.consideration >= estGuideline;

                return (
                  <tr key={deed.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div>{deed.docNo}</div>
                      <span className="text-[10px] text-slate-400 font-medium block truncate max-w-44">{deed.propertyAddress}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">{deed.docType}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ₹ {deed.consideration.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      ₹ {estGuideline.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                      ₹ {stampDuty.toLocaleString('en-IN')} (7%)
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                        isCompliant 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {isCompliant ? 'Compliant' : 'Shortfall Flag'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          loadDraft(deed.id);
                          setActiveTab('wizard');
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded transition cursor-pointer"
                      >
                        Inspect Audit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
