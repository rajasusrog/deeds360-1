import { useState } from 'react';
import { Search, Check, ChevronDown, AlertTriangle, Lock } from 'lucide-react';
import { CANONICAL_DEED_TYPES, resolveDeedType } from '../../utils/deedTypes';

interface Step1DocTypeProps {
  documentType: string;
  onChange: (value: string) => void;
}

export default function Step1DocType({ documentType, onChange }: Step1DocTypeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unavailableSelectionNotice, setUnavailableSelectionNotice] = useState<string | null>(null);

  const filteredTypes = CANONICAL_DEED_TYPES.filter(
    (dt) =>
      dt.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dt.nameTa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dt.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDoc = resolveDeedType(documentType) || CANONICAL_DEED_TYPES[0];
  const isCurrentSupported = Boolean(selectedDoc?.templateAvailable);

  return (
    <div className="space-y-4" id="step-1-doc-type">
      <p className="text-xs text-slate-500 font-medium">
        Select the deed type. Only deed types with implemented legal templates and statutory validation are enabled for generation and export. <span className="text-rose-500 font-bold">*</span>
      </p>

      {!isCurrentSupported && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Template unavailable: {selectedDoc?.nameEn || documentType}</p>
            <p className="text-[11px] text-rose-700 mt-0.5">
              This deed type does not have an implemented legal template. Document compilation, preview, finalization, and export are blocked until a supported deed type is selected.
            </p>
          </div>
        </div>
      )}

      {unavailableSelectionNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
          <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Template unavailable</p>
            <p className="text-[11px] text-amber-800 mt-0.5">{unavailableSelectionNotice}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block mb-1.5">
          Select Document Type <span className="text-rose-500">*</span>
        </label>

        {/* Custom searchable dropdown selector */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full border border-slate-250 rounded-lg p-3 text-xs bg-white flex items-center justify-between cursor-pointer hover:border-slate-300 transition shadow-sm font-bold text-slate-800"
        >
          <div className="flex items-center gap-2">
            <span>{selectedDoc.nameEn}</span>
            <span className="text-slate-400 font-normal">({selectedDoc.nameTa})</span>
            {!selectedDoc.templateAvailable && (
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold uppercase">
                Template unavailable
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-72 flex flex-col">
            <div className="p-2 border-b border-slate-150 bg-slate-50 flex items-center gap-2 shrink-0">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search document type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent border-none text-xs focus:outline-none p-1 text-slate-700"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100">
              {filteredTypes.length > 0 ? (
                filteredTypes.map((dt) => {
                  const isSelected = dt.code === selectedDoc.code;
                  const isSupported = dt.templateAvailable;
                  return (
                    <div
                      key={dt.code}
                      aria-disabled={!isSupported}
                      onClick={() => {
                        if (!isSupported) {
                          setUnavailableSelectionNotice(
                            `Template unavailable for "${dt.nameEn}" (${dt.code}). Selection is disabled because no verified template is implemented.`
                          );
                          return;
                        }
                        setUnavailableSelectionNotice(null);
                        onChange(dt.code);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`p-3 text-xs flex items-center justify-between transition ${
                        !isSupported
                          ? 'bg-slate-50/80 text-slate-400 cursor-not-allowed opacity-75'
                          : isSelected
                          ? 'bg-emerald-50 text-emerald-800 font-semibold cursor-pointer'
                          : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{dt.nameEn}</span>
                        <span className="text-slate-400 ml-2 font-normal">({dt.nameTa})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isSupported ? (
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-tight">
                            Template unavailable
                          </span>
                        ) : (
                          isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-xs text-slate-400 text-center">No document types match your search</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
        <span className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Party & Template Configuration:</span>
        Selected deed type (<strong>{selectedDoc.nameEn}</strong>) uses primary party role <strong>{selectedDoc.grantorRole}</strong> and counterparty role <strong>{selectedDoc.granteeRole}</strong>.
      </div>
    </div>
  );
}
