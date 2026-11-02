import { useState } from 'react';
import { Database, Copy, Check, FileDown, ShieldAlert } from 'lucide-react';

interface SQLViewerProps {
  sqlContent: string;
}

export default function SQLViewer({ sqlContent }: SQLViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSQL = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unikorn360_deedos_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">PostgreSQL Database Schema Spec</h3>
            <p className="text-[10px] text-slate-400 font-medium">Auto-generated DDL for Deed360 Compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-all"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy DDL</span>
              </>
            )}
          </button>
          <button
            onClick={downloadSQL}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#c49a36] hover:bg-[#b58a2b] text-xs text-white font-semibold transition-all"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Download .sql</span>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950/80 leading-relaxed text-left selection:bg-emerald-500/35 select-text">
        <pre className="whitespace-pre">
          {sqlContent}
        </pre>
      </div>

      {/* Footer Alert */}
      <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-slate-400 text-xs flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>Future-proofed with indexes for Deed360 API lookup & relational validation. Ready to execute on your PG cluster.</span>
      </div>
    </div>
  );
}
