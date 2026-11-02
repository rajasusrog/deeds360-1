import { TransactionDetails } from '../../types';
import { useApp } from '../../context/AppContext';
import { resolveDeedType } from '../../utils/deedTypes';

interface Step8TransactionProps {
  transaction: TransactionDetails;
  onChange: (transaction: TransactionDetails) => void;
  errors?: Record<string, string>;
  documentType?: string;
}

const PAYMENT_MODES = [
  'Cash',
  'Bank Transfer',
  'RTGS',
  'Cheque',
  'DD',
  'UPI'
] as const;

export default function Step8Transaction({ transaction, onChange, errors, documentType }: Step8TransactionProps) {
  const { currentDraft } = useApp();
  const activeDocType = documentType || currentDraft?.state?.documentType || 'SALE';
  const deedDef = resolveDeedType(activeDocType);

  const requiresConsideration = deedDef ? deedDef.requiresMonetaryConsideration : true;
  const requiresPaymentRef = deedDef ? deedDef.requiresPaymentReference : true;
  const considerationLabel = deedDef?.considerationLabelEn || 'Consideration Value (INR)';
  const advanceLabel = deedDef?.advanceLabelEn || 'Advance Paid (INR)';

  const updateField = (field: keyof TransactionDetails, value: any) => {
    const updated = { ...transaction, [field]: value };
    
    // Auto-calculate Balance Paid if Consideration or Advance is modified
    if (field === 'considerationAmount' || field === 'advancePaid') {
      const consideration = field === 'considerationAmount' ? (parseFloat(value) || 0) : (transaction.considerationAmount || 0);
      const advance = field === 'advancePaid' ? (parseFloat(value) || 0) : (transaction.advancePaid || 0);
      updated.balancePaid = Math.max(0, consideration - advance);
    }
    
    onChange(updated);
  };

  return (
    <div className="space-y-4" id="step-8-transaction">
      <p className="text-xs text-slate-500 font-medium">
        Define declared transaction and valuation particulars for <strong>{deedDef?.nameEn || 'Deed'}</strong>.
        {!requiresConsideration && ' This deed type is non-monetary or voluntary; Market Value is used for stamp duty calculation.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            {considerationLabel} {requiresConsideration && <span className="text-rose-500 font-bold">*</span>}
          </label>
          <input
            type="number"
            value={transaction.considerationAmount ?? ''}
            onChange={(e) => updateField('considerationAmount', parseFloat(e.target.value) || 0)}
            placeholder={requiresConsideration ? 'e.g. 5000000' : '0 (Non-monetary)'}
            className={`w-full border rounded p-2 text-xs font-bold text-emerald-800 ${
              errors?.['transaction.considerationAmount'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['transaction.considerationAmount'] && (
            <span className="text-[9px] text-rose-500 block">{errors['transaction.considerationAmount']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            {advanceLabel}
          </label>
          <input
            type="number"
            value={transaction.advancePaid || 0}
            onChange={(e) => updateField('advancePaid', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 500000"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800 font-semibold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Balance Amount (INR)
          </label>
          <input
            type="number"
            value={transaction.balancePaid || 0}
            disabled
            className="w-full bg-slate-100 border border-slate-200 rounded p-2 text-xs text-slate-700 font-bold cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Payment Mode {requiresPaymentRef && <span className="text-rose-500 font-bold">*</span>}
          </label>
          <select
            value={transaction.paymentMode || 'RTGS'}
            onChange={(e) => updateField('paymentMode', e.target.value)}
            className="w-full border border-slate-250 rounded p-2.5 text-xs text-slate-800 bg-white font-bold"
          >
            {PAYMENT_MODES.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            UTR / Reference Number {requiresPaymentRef && <span className="text-rose-500 font-bold">*</span>}
          </label>
          <input
            type="text"
            value={transaction.paymentRefNo || ''}
            onChange={(e) => updateField('paymentRefNo', e.target.value)}
            placeholder={requiresPaymentRef ? 'e.g. UTR1234567890' : 'Optional for voluntary/non-monetary deeds'}
            className={`w-full border rounded p-2 text-xs font-mono text-slate-800 ${
              errors?.['transaction.paymentRefNo'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['transaction.paymentRefNo'] && (
            <span className="text-[9px] text-rose-500 block">{errors['transaction.paymentRefNo']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Market Value (INR) <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="number"
            value={transaction.marketValue || ''}
            onChange={(e) => updateField('marketValue', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 5200000"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['transaction.marketValue'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['transaction.marketValue'] && (
            <span className="text-[9px] text-rose-500 block">{errors['transaction.marketValue']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Guideline Value (INR) <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="number"
            value={transaction.guidelineValue || ''}
            onChange={(e) => updateField('guidelineValue', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 4800000"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['transaction.guidelineValue'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['transaction.guidelineValue'] && (
            <span className="text-[9px] text-rose-500 block">{errors['transaction.guidelineValue']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Paying Bank
          </label>
          <input
            type="text"
            value={transaction.bankName || ''}
            onChange={(e) => updateField('bankName', e.target.value)}
            placeholder="e.g. State Bank of India"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Execution / Payment Date
          </label>
          <input
            type="date"
            value={transaction.paymentDate || ''}
            onChange={(e) => updateField('paymentDate', e.target.value)}
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-2">
        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-3">
          Declared Supporting References & Estimated Fees
        </h5>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block">
              Declared EC Reference Number
            </label>
            <input
              type="text"
              value={transaction.ecReference || ''}
              onChange={(e) => updateField('ecReference', e.target.value)}
              placeholder="e.g. EC/2026/984712"
              className={`w-full border rounded p-2 text-xs font-mono text-slate-800 ${
                errors?.['transaction.ecReference'] ? 'border-rose-400' : 'border-slate-250'
              }`}
            />
            {errors?.['transaction.ecReference'] && (
              <span className="text-[9px] text-rose-500 block">{errors['transaction.ecReference']}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block">
              Declared EC Date
            </label>
            <input
              type="date"
              value={transaction.ecDate || ''}
              onChange={(e) => updateField('ecDate', e.target.value)}
              className={`w-full border rounded p-2 text-xs text-slate-800 ${
                errors?.['transaction.ecDate'] ? 'border-rose-400' : 'border-slate-250'
              }`}
            />
            {errors?.['transaction.ecDate'] && (
              <span className="text-[9px] text-rose-500 block">{errors['transaction.ecDate']}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block">
              Declared Property Tax Receipt Ref
            </label>
            <input
              type="text"
              value={transaction.propertyTaxReceipt || ''}
              onChange={(e) => updateField('propertyTaxReceipt', e.target.value)}
              placeholder="e.g. TAX/2025/1102"
              className={`w-full border rounded p-2 text-xs font-mono text-slate-800 ${
                errors?.['transaction.propertyTaxReceipt'] ? 'border-rose-400' : 'border-slate-250'
              }`}
            />
            {errors?.['transaction.propertyTaxReceipt'] && (
              <span className="text-[9px] text-rose-500 block">{errors['transaction.propertyTaxReceipt']}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block">
              Estimated Stamp Duty (INR)
            </label>
            <input
              type="number"
              value={transaction.stampDuty || ''}
              onChange={(e) => updateField('stampDuty', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 350000"
              className={`w-full border rounded p-2 text-xs text-slate-800 ${
                errors?.['transaction.stampDuty'] ? 'border-rose-400' : 'border-slate-250'
              }`}
            />
            {errors?.['transaction.stampDuty'] && (
              <span className="text-[9px] text-rose-500 block">{errors['transaction.stampDuty']}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 block">
              Estimated Registration Fee (INR)
            </label>
            <input
              type="number"
              value={transaction.registrationFee || ''}
              onChange={(e) => updateField('registrationFee', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 50000"
              className={`w-full border rounded p-2 text-xs text-slate-800 ${
                errors?.['transaction.registrationFee'] ? 'border-rose-400' : 'border-slate-250'
              }`}
            />
            {errors?.['transaction.registrationFee'] && (
              <span className="text-[9px] text-rose-500 block">{errors['transaction.registrationFee']}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
