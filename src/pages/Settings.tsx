import { useState, useEffect } from 'react';
import { Settings, MapPin, Calculator, ShieldCheck, Key, HelpCircle, Save } from 'lucide-react';

// Centralized Fee Rules Config as mandated
interface FeeRule {
  stampDutyRate: number;
  registrationRate: number;
  stampDutyCap: number;
  registrationCap: number;
}

const TN_FEE_RULES = {
  sale: {
    stampDutyRate: 0.07,
    registrationRate: 0.04,
    stampDutyCap: Infinity,
    registrationCap: Infinity,
  },
  lease: {
    stampDutyRate: 0.01,
    registrationRate: 0.01,
    stampDutyCap: Infinity,
    registrationCap: Infinity,
  },
  family: {
    gift: {
      stampDutyRate: 0.01,
      registrationRate: 0.01,
      stampDutyCap: 25000,
      registrationCap: 10000,
    },
    settlement: {
      stampDutyRate: 0.01,
      registrationRate: 0.01,
      stampDutyCap: 25000,
      registrationCap: 10000,
    },
    release: {
      stampDutyRate: 0.01,
      registrationRate: 0.01,
      stampDutyCap: 25000,
      registrationCap: 10000,
    }
  },
  nonFamily: {
    gift: {
      stampDutyRate: 0.07,
      registrationRate: 0.04,
      stampDutyCap: Infinity,
      registrationCap: Infinity,
    },
    settlement: {
      stampDutyRate: 0.07,
      registrationRate: 0.04,
      stampDutyCap: Infinity,
      registrationCap: Infinity,
    },
    release: {
      stampDutyRate: 0.07,
      registrationRate: 0.04,
      stampDutyCap: Infinity,
      registrationCap: Infinity,
    }
  }
};

export default function SettingsPage() {
  const [marketValue, setMarketValue] = useState<number>(1000000);
  const [deedType, setDeedType] = useState<'sale' | 'gift' | 'lease'>('sale');
  
  // Additional legal inputs for Gift / Settlement / Release
  const [giftSubtype, setGiftSubtype] = useState<'gift' | 'settlement' | 'release'>('gift');
  const [relationship, setRelationship] = useState<string>('Father');
  const [customRelationship, setCustomRelationship] = useState<string>('');
  const [isFamily, setIsFamily] = useState<'family' | 'nonFamily'>('family');
  const [propertyType, setPropertyType] = useState<string>('Agricultural Land');

  // Auto-set family/non-family category based on relationship select
  useEffect(() => {
    const familyRelations = ['Father', 'Mother', 'Son', 'Daughter', 'Spouse', 'Brother', 'Sister', 'Grandchild'];
    if (familyRelations.includes(relationship)) {
      setIsFamily('family');
    } else if (relationship === 'Friend') {
      setIsFamily('nonFamily');
    }
  }, [relationship]);

  // Calculates real TN Fees using Centralized Rule Engine
  const getCalculatedFees = () => {
    let stampDutyRate = 0.07;
    let regFeeRate = 0.04;
    let capStamp = Infinity;
    let capReg = Infinity;
    let ruleApplied = '';

    if (deedType === 'gift') {
      const isFamilyType = isFamily === 'family';
      const config = isFamilyType 
        ? TN_FEE_RULES.family[giftSubtype]
        : TN_FEE_RULES.nonFamily[giftSubtype];

      stampDutyRate = config.stampDutyRate;
      regFeeRate = config.registrationRate;
      capStamp = config.stampDutyCap;
      capReg = config.registrationCap;

      const subName = giftSubtype === 'gift' ? 'Gift Deed' : giftSubtype === 'settlement' ? 'Settlement Deed' : 'Release Deed';
      const relationStr = relationship === 'Other' && customRelationship ? customRelationship : relationship;
      
      if (isFamilyType) {
        ruleApplied = `Concessional Family Rate (${subName} for ${relationStr}): Stamp Duty capped at ₹${capStamp.toLocaleString('en-IN')}, Registration capped at ₹${capReg.toLocaleString('en-IN')}`;
      } else {
        ruleApplied = `Standard Non-Family Rate (${subName} for ${relationStr}): Full ${stampDutyRate * 100}% Stamp Duty & ${regFeeRate * 100}% Registration Fee (uncapped)`;
      }
    } else if (deedType === 'lease') {
      const config = TN_FEE_RULES.lease;
      stampDutyRate = config.stampDutyRate;
      regFeeRate = config.registrationRate;
      capStamp = config.stampDutyCap;
      capReg = config.registrationCap;
      ruleApplied = `Standard Lease Deed: ${stampDutyRate * 100}% Stamp Duty & ${regFeeRate * 100}% Registration Fee (uncapped)`;
    } else {
      const config = TN_FEE_RULES.sale;
      stampDutyRate = config.stampDutyRate;
      regFeeRate = config.registrationRate;
      capStamp = config.stampDutyCap;
      capReg = config.registrationCap;
      ruleApplied = `Conveyance / Sale Deed: ${stampDutyRate * 100}% Stamp Duty & ${regFeeRate * 100}% Registration Fee (uncapped)`;
    }

    const rawStamp = marketValue * stampDutyRate;
    const rawReg = marketValue * regFeeRate;

    const stampDuty = Math.min(rawStamp, capStamp);
    const regFee = Math.min(rawReg, capReg);
    const total = stampDuty + regFee;

    return { stampDuty, regFee, total, ruleApplied };
  };

  const fees = getCalculatedFees();

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 text-left">
        <h3 className="text-md font-bold text-slate-800">System Mappings & Calculators</h3>
        <p className="text-xs text-slate-400">Configure sub-registration values, SRO offices, and calculate Stamp duties</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        
        {/* Module 1: SRO Mappings */}
        <div id="sro-mappings-card" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-800">
            <MapPin className="h-4.5 w-4.5 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Deed360 SRO Office Mappings</h4>
          </div>

          <p className="text-xs text-slate-500 leading-normal">
            Configure SRO endpoints mapping to specific sub-district registrar servers.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">SRO Name</span>
                <input
                  id="sro-name-input"
                  type="text"
                  disabled
                  value="Joint-I SRO Mylapore"
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2 text-slate-600 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">System Code</span>
                <input
                  id="sro-code-input"
                  type="text"
                  disabled
                  value="SRO_MYLAPORE_01"
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2 text-slate-600 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">Deed360 Endpoint</span>
                <input
                  id="sro-endpoint-input"
                  type="text"
                  disabled
                  value="Not configured"
                  className="w-full border border-slate-200 bg-slate-50 rounded p-2 text-slate-400 font-mono focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-slate-400">Gateway Status</span>
                <span className="w-full bg-emerald-50 text-emerald-700 rounded p-2 flex items-center gap-1 border border-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  Not connected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: TN Stamp Fee Calculator */}
        <div id="stamp-fee-calculator-card" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Calculator className="h-4.5 w-4.5 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Stamp Duty & Registration Estimator</h4>
          </div>

          <p className="text-xs text-slate-500 leading-normal">
            Select the deed type and enter the estimated property market value to run dynamic fee calculations:
          </p>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="deed-category-select" className="text-[10px] uppercase font-bold text-slate-400">Deed Category</label>
                <select
                  id="deed-category-select"
                  value={deedType}
                  onChange={(e) => setDeedType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-slate-700 font-bold"
                >
                  <option value="sale">Conveyance / Sale Deed</option>
                  <option value="gift">Gift / Settlement / Release Deed</option>
                  <option value="lease">Lease Deed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="market-value-input" className="text-[10px] uppercase font-bold text-slate-400">Market Value (INR)</label>
                <input
                  id="market-value-input"
                  type="number"
                  value={marketValue}
                  onChange={(e) => setMarketValue(parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-bold"
                />
              </div>
            </div>

            {/* Conditionally render comprehensive Gift / Settlement Deed legal inputs */}
            {deedType === 'gift' && (
              <div id="gift-settlement-fields" className="border-t border-slate-100 pt-3.5 space-y-3">
                <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Deed Legal Parameters</h5>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="gift-subtype-select" className="text-[10px] uppercase font-bold text-slate-400">Deed Subtype</label>
                    <select
                      id="gift-subtype-select"
                      value={giftSubtype}
                      onChange={(e) => setGiftSubtype(e.target.value as any)}
                      className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700"
                    >
                      <option value="gift">Gift Deed</option>
                      <option value="settlement">Settlement Deed</option>
                      <option value="release">Release Deed</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="property-type-select" className="text-[10px] uppercase font-bold text-slate-400">Property Type</label>
                    <select
                      id="property-type-select"
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700"
                    >
                      <option value="Agricultural Land">Agricultural Land</option>
                      <option value="Residential / Commercial Plot">Residential / Commercial Plot</option>
                      <option value="Building / Apartment">Building / Apartment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="relationship-select" className="text-[10px] uppercase font-bold text-slate-400">Relationship</label>
                    <select
                      id="relationship-select"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-slate-700"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Grandchild">Grandchild</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="family-status-select" className="text-[10px] uppercase font-bold text-slate-400">Family Classification</label>
                    <select
                      id="family-status-select"
                      value={isFamily}
                      onChange={(e) => setIsFamily(e.target.value as any)}
                      className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-bold text-slate-700"
                    >
                      <option value="family">Family Member (Concessional)</option>
                      <option value="nonFamily">Non-Family Member (Full)</option>
                    </select>
                  </div>
                </div>

                {relationship === 'Other' && (
                  <div className="space-y-1">
                    <label htmlFor="custom-relationship-input" className="text-[10px] uppercase font-bold text-slate-400">Specify Relationship</label>
                    <input
                      id="custom-relationship-input"
                      type="text"
                      placeholder="e.g. Brother-in-law, Uncle, Business Associate"
                      value={customRelationship}
                      onChange={(e) => setCustomRelationship(e.target.value)}
                      className="w-full border border-slate-200 rounded p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Calculations display with explicit breakdown & rule applied */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/60 divide-y divide-slate-150 space-y-2 text-[11px] font-semibold text-slate-600">
              <div className="flex items-center justify-between pb-2">
                <span>Calculated Stamp Duty:</span>
                <span className="text-slate-800 font-extrabold font-mono text-xs">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(fees.stampDuty)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Calculated Registration Fee:</span>
                <span className="text-slate-800 font-extrabold font-mono text-xs">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(fees.regFee)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-slate-300 font-bold text-slate-900">
                <span>Total Registration Cost:</span>
                <span className="text-emerald-600 font-extrabold font-mono text-sm">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(fees.total)}
                </span>
              </div>
              <div className="pt-2 text-[9.5px] leading-relaxed text-slate-500 font-normal">
                <span className="font-bold text-slate-600 block mb-0.5 uppercase tracking-wider text-[8px]">Rule Engine Applied:</span>
                <p className="bg-white border border-slate-200/60 rounded p-1.5 text-slate-700 font-medium">
                  {fees.ruleApplied}
                </p>
              </div>
            </div>

            {/* Mandated Legal Note */}
            <div className="border-l-2 border-amber-500 bg-amber-50/50 rounded-r p-2.5 text-[10px] text-amber-800 leading-normal font-medium">
              “Final charges subject to SRO verification and latest TN registration circular.”
            </div>
          </div>
        </div>

      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">For access or integration setup, contact your workspace administrator. External registration services are not connected by default.</div>

    </div>
  );
}
