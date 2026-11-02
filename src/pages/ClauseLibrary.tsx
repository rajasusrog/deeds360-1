import { useState } from 'react';
import { Scale, Search, CheckCircle, Copy, Check, FileCheck, ShieldAlert } from 'lucide-react';
import { STANDARD_CLAUSES } from '../utils/dummyData';

export default function ClauseLibrary() {
  const [clauses, setClauses] = useState(STANDARD_CLAUSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyClause = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredClauses = clauses.filter(cl =>
    cl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cl.contentEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cl.contentTa.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 text-left flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-md font-bold text-slate-800">Tamil Nadu Registration Clause Index</h3>
          <p className="text-xs text-slate-400">Search, manage, and audit legal covenants for sub-registrar submission</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold font-mono">
          <FileCheck className="h-4 w-4" />
          Deed360 VALIDATED
        </span>
      </div>

      {/* Filter and search */}
      <div className="relative text-left">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id="clause-search"
          type="text"
          placeholder="Search clauses by legal titles or Tamil/English keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Clause Cards list */}
      <div className="space-y-4 text-left">
        {filteredClauses.map((clause) => (
          <div key={clause.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 hover:border-emerald-500/20 transition duration-150 relative">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">{clause.title}</h4>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{clause.category} CATEGORY</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {clause.isMandatory && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wide">
                    Mandatory Rule
                  </span>
                )}
                <button
                  onClick={() => handleCopyClause(`${clause.contentEn}\n\n${clause.contentTa}`, clause.id)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded border border-slate-150 transition"
                  title="Copy full clause text"
                >
                  {copiedId === clause.id ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Bilingual Display rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed pt-2 border-t border-slate-100">
              {/* Tamil column */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-sans tracking-wider block">தமிழ் உரை (Tamil Text)</span>
                <p className="text-slate-700 font-sans font-medium">{clause.contentTa}</p>
              </div>

              {/* English column */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-sans tracking-wider block">English Text</span>
                <p className="text-slate-700 italic">{clause.contentEn}</p>
              </div>
            </div>

          </div>
        ))}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-slate-500 text-xs flex gap-3 items-start text-left font-medium leading-relaxed">
        <ShieldAlert className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-bold text-slate-800">Deed360 Auto-Insertion System</h5>
          <p className="mt-0.5 text-slate-600">
            These clauses are automatically recommended in Step 10 of the Drafting Wizard based on the document type, sub-registrar boundaries, and tax considerations. Custom edits are indexed for compliance audits.
          </p>
        </div>
      </div>

    </div>
  );
}
