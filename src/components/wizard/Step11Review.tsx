import { Edit, ShieldCheck, Scale, Users, Building, Navigation, History, CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';
import { DeedWizardState } from '../../types';
import { CLAUSES_LIST } from './Step10Clauses';
import { resolveDeedType } from '../../utils/deedTypes';

interface Step11ReviewProps {
  state: DeedWizardState;
  onJumpToStep: (step: number) => void;
}

export default function Step11Review({ state, onJumpToStep }: Step11ReviewProps) {
  const deedDef = resolveDeedType(state.documentType);
  const templateAvailable = Boolean(deedDef?.templateAvailable);

  const getSelectedClausesFull = () => {
    return CLAUSES_LIST.filter(clause => state.selectedClauses.includes(clause.id));
  };

  const formattedAmount = (num: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  const selectedClauses = getSelectedClausesFull();

  return (
    <div className="space-y-6 text-slate-800" id="step-11-review">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Registration Review Summary</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Verify all fields before finalizing the legal draft. Correctness of names, Aadhaar numbers, and survey boundaries are legally binding.
          </p>
        </div>
      </div>

      {!templateAvailable && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider">Template unavailable — Generation &amp; Export Blocked</h4>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              The selected document type (<strong>{deedDef?.nameEn || state.documentType || 'Unknown'}</strong>) does not have an implemented template. Return to Step 1 to select a supported document type.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        
        {/* SECTION 1: DOCUMENT TYPE */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-slate-500" />
              <span>Step 1 — Document Type</span>
            </span>
            <button
              onClick={() => onJumpToStep(1)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs">
            <p className="font-extrabold text-slate-800 text-sm">
              {deedDef ? `${deedDef.nameEn} (${deedDef.code})` : `${state.documentType} DEED`}
              {!templateAvailable && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                  Template unavailable
                </span>
              )}
            </p>
            <p className="text-slate-500 mt-1">Model classification: {state.documentSubtype || 'Standard registration'}</p>
          </div>
        </div>

        {/* SECTION 2: PARTY DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500" />
              <span>Step 2 — Party Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(2)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 divide-y divide-slate-100">
            {state.parties.map((party, idx) => (
              <div key={party.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                <p className="font-bold text-slate-800">Party #{idx + 1}: {party.name} ({party.role})</p>
                <div className="grid grid-cols-2 gap-2 text-slate-500 mt-1 text-[11px]">
                  <p><strong>Father/Husband:</strong> {party.fatherName}</p>
                  <p><strong>Age / Occupation:</strong> {party.age} | {party.occupation}</p>
                  <p><strong>Aadhaar:</strong> {party.aadhaar}</p>
                  <p><strong>PAN:</strong> {party.pan}</p>
                  <p><strong>Contact:</strong> {party.phone} | {party.email || '————'}</p>
                  <p className="col-span-2"><strong>Address:</strong> {party.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: PROPERTY DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-4 w-4 text-slate-500" />
              <span>Step 3 — Property Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(3)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs grid grid-cols-2 gap-2 text-slate-600">
            <p><strong>Revenue District:</strong> {state.property.district}</p>
            <p><strong>Registration District:</strong> {state.property.registrationDistrict || '————'}</p>
            <p><strong>Taluk:</strong> {state.property.taluk}</p>
            <p><strong>Village:</strong> {state.property.village}</p>
            <p><strong>Sub-Registrar (SRO):</strong> {state.property.sro}</p>
            <p><strong>Door Number:</strong> {state.property.doorNo || '————'}</p>
            <p><strong>Ward / Block:</strong> {state.property.ward || '————'} / {state.property.block || '————'}</p>
            <p className="col-span-2"><strong>Property Type:</strong> {state.property.propertyType}</p>
          </div>
        </div>

        {/* SECTION 4: SURVEY DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-slate-500" />
              <span>Step 4 — Survey Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(4)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs divide-y divide-slate-100">
            {(state.surveys && state.surveys.length > 0 ? state.surveys : [state.survey]).map((survey, idx) => (
              <div key={idx} className="py-2 first:pt-0 last:pb-0 text-xs">
                <p className="font-bold text-slate-800">Survey Record #{idx + 1}</p>
                <div className="grid grid-cols-2 gap-2 text-slate-500 mt-1 text-[11px]">
                  <p><strong>Survey No:</strong> {survey.surveyNo}</p>
                  <p><strong>Sub-Division:</strong> {survey.subDivision}</p>
                  <p><strong>Patta No:</strong> {survey.pattaNo}</p>
                  <p><strong>TSLR No:</strong> {survey.tslrNo || '————'}</p>
                  <p className="col-span-2"><strong>Chitta Ref:</strong> {survey.chittaRef || '————'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: PROPERTY MEASUREMENT */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-slate-500" />
              <span>Step 5 — Property Measurement</span>
            </span>
            <button
              onClick={() => onJumpToStep(5)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs grid grid-cols-2 gap-2 text-slate-600">
            <p><strong>Area Unit:</strong> {state.extent.areaUnit || 'Sq.ft'}</p>
            <p><strong>Total Extent:</strong> {state.extent.totalExtent || state.extent.sqft || '————'}</p>
            <p><strong>East-West Measure:</strong> {state.extent.eastWest || '————'}</p>
            <p><strong>North-South Measure:</strong> {state.extent.northSouth || '————'}</p>
            <p><strong>Built-up Area:</strong> {state.extent.builtUpArea ? `${state.extent.builtUpArea} Sq.ft` : 'Vacant Land'}</p>
            <p><strong>UDS:</strong> {state.extent.uds ? `${state.extent.uds} Sq.ft` : '————'}</p>
          </div>
        </div>

        {/* SECTION 6: BOUNDARY DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-slate-500" />
              <span>Step 6 — Boundary Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(6)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs grid grid-cols-2 gap-2 text-slate-600">
            <p><strong>East boundary:</strong> {state.boundary.east}</p>
            <p><strong>West boundary:</strong> {state.boundary.west}</p>
            <p><strong>North boundary:</strong> {state.boundary.north}</p>
            <p><strong>South boundary:</strong> {state.boundary.south}</p>
          </div>
        </div>

        {/* SECTION 7: OWNERSHIP HISTORY */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-500" />
              <span>Step 7 — Ownership History</span>
            </span>
            <button
              onClick={() => onJumpToStep(7)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs grid grid-cols-2 gap-2 text-slate-600">
            <p><strong>Parent Doc Type:</strong> {state.ownershipHistory.parentDocType || 'Sale Deed'}</p>
            <p><strong>Parent Doc No:</strong> {state.ownershipHistory.parentDocNo}</p>
            <p><strong>Registration Year:</strong> {state.ownershipHistory.parentDocYear}</p>
            <p><strong>Registration Date:</strong> {state.ownershipHistory.parentDocDate}</p>
            <p><strong>SRO:</strong> {state.ownershipHistory.parentDocSRO}</p>
            <p><strong>Previous Owner:</strong> {state.ownershipHistory.priorOwners}</p>
            <p className="col-span-2 mt-1 border-t border-slate-100 pt-2 text-slate-500 italic">
              <strong>History Narrative:</strong> {state.ownershipHistory.historyNarrative}
            </p>
          </div>
        </div>

        {/* SECTION 8: TRANSACTION DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-slate-500" />
              <span>Step 8 — Transaction Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(8)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs grid grid-cols-2 gap-2 text-slate-600">
            <p><strong>Consideration Value:</strong> {formattedAmount(state.transaction.considerationAmount)}</p>
            <p><strong>Advance Paid:</strong> {formattedAmount(state.transaction.advancePaid || 0)}</p>
            <p><strong>Balance Paid:</strong> {formattedAmount(state.transaction.balancePaid || 0)}</p>
            <p><strong>Payment Mode:</strong> {state.transaction.paymentMode}</p>
            <p><strong>Bank:</strong> {state.transaction.bankName || '————'}</p>
            <p><strong>UTR Ref:</strong> {state.transaction.paymentRefNo || '————'}</p>
          </div>
        </div>

        {/* SECTION 9: WITNESS DETAILS */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500" />
              <span>Step 9 — Witness Details</span>
            </span>
            <button
              onClick={() => onJumpToStep(9)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 divide-y divide-slate-100">
            {state.witnesses.map((witness, idx) => (
              <div key={witness.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                <p className="font-bold text-slate-800">Witness #{idx + 1}: {witness.name}</p>
                <div className="grid grid-cols-2 gap-2 text-slate-500 mt-1 text-[11px]">
                  <p><strong>Father's name:</strong> {witness.fatherName}</p>
                  <p><strong>Age / Occupation:</strong> {witness.age} | {witness.occupation || '————'}</p>
                  <p className="col-span-2"><strong>ID Proof:</strong> {witness.idProof || witness.aadhaar || '————'}</p>
                  <p className="col-span-2"><strong>Address:</strong> {witness.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 10: CLAUSE SELECTION */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-55/60 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-slate-500" />
              <span>Step 10 — Clause Selection</span>
            </span>
            <button
              onClick={() => onJumpToStep(10)}
              className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 hover:underline"
            >
              <Edit className="h-3 w-3" />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-4 text-xs space-y-2">
            {selectedClauses.length > 0 ? (
              selectedClauses.map(clause => (
                <div key={clause.id} className="border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <p className="font-extrabold text-slate-800">{clause.title}</p>
                  <p className="text-[10px] text-slate-500 italic mt-0.5">"{clause.contentEn}"</p>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No optional clauses selected</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
