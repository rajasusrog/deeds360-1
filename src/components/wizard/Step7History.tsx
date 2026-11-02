import { OwnershipHistory } from '../../types';

interface Step7HistoryProps {
  history: OwnershipHistory;
  onChange: (history: OwnershipHistory) => void;
  errors?: Record<string, string>;
}

const DOC_TYPES_HISTORY = [
  'Sale Deed',
  'Gift Settlement Deed',
  'Family Settlement Deed',
  'Partition Deed',
  'Release Deed',
  'Lease Deed',
  'Mortgage Deed',
  'Will / Testate Success',
  'Allotment Order',
  'Other'
];

export default function Step7History({ history, onChange, errors }: Step7HistoryProps) {
  
  const updateField = (field: keyof OwnershipHistory, value: string) => {
    onChange({
      ...history,
      [field]: value
    });
  };

  return (
    <div className="space-y-4" id="step-7-history">
      <p className="text-xs text-slate-500 font-medium">
        Establish a clear chain of title. Enter parent deed registry parameters below.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Parent Document Type <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={history.parentDocType || 'Sale Deed'}
            onChange={(e) => updateField('parentDocType', e.target.value)}
            className="w-full border border-slate-250 rounded p-2.5 text-xs text-slate-800 bg-white focus:outline-none"
          >
            {DOC_TYPES_HISTORY.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Parent Document Number <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={history.parentDocNo}
            onChange={(e) => updateField('parentDocNo', e.target.value)}
            placeholder="e.g. 1422 / 1998"
            className={`w-full border rounded p-2 text-xs text-slate-800 font-bold ${
              errors?.['ownershipHistory.parentDocNo'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['ownershipHistory.parentDocNo'] && (
            <span className="text-[9px] text-rose-500 block">{errors['ownershipHistory.parentDocNo']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Registration Year <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={history.parentDocYear}
            onChange={(e) => updateField('parentDocYear', e.target.value)}
            placeholder="e.g. 1998"
            maxLength={4}
            className={`w-full border rounded p-2 text-xs text-slate-800 font-semibold ${
              errors?.['ownershipHistory.parentDocYear'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['ownershipHistory.parentDocYear'] && (
            <span className="text-[9px] text-rose-500 block">{errors['ownershipHistory.parentDocYear']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Registration Date <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="date"
            value={history.parentDocDate}
            onChange={(e) => updateField('parentDocDate', e.target.value)}
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['ownershipHistory.parentDocDate'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['ownershipHistory.parentDocDate'] && (
            <span className="text-[9px] text-rose-500 block">{errors['ownershipHistory.parentDocDate']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            SRO Registry Office <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={history.parentDocSRO}
            onChange={(e) => updateField('parentDocSRO', e.target.value)}
            placeholder="e.g. SRO Mylapore"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['ownershipHistory.parentDocSRO'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['ownershipHistory.parentDocSRO'] && (
            <span className="text-[9px] text-rose-500 block">{errors['ownershipHistory.parentDocSRO']}</span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold text-slate-500 block">
          Previous Owner (Prior Owner Full Name) <span className="text-rose-500 font-bold">*</span>
        </label>
        <input
          type="text"
          value={history.priorOwners}
          onChange={(e) => updateField('priorOwners', e.target.value)}
          placeholder="e.g. S. Ganesan Pillai"
          className={`w-full border rounded p-2 text-xs text-slate-800 ${
            errors?.['ownershipHistory.priorOwners'] ? 'border-rose-400' : 'border-slate-250'
          }`}
        />
        {errors?.['ownershipHistory.priorOwners'] && (
          <span className="text-[9px] text-rose-500 block">{errors['ownershipHistory.priorOwners']}</span>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold text-slate-500 block">
          Title Ownership History Narrative
        </label>
        <textarea
          value={history.historyNarrative}
          onChange={(e) => updateField('historyNarrative', e.target.value)}
          placeholder="e.g. The Vendor purchased this property from S. Ganesan Pillai under registered sale deed..."
          rows={3}
          className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
        />
      </div>
    </div>
  );
}
