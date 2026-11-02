import { useState } from 'react';
import { 
  Sparkles, 
  Brain, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle,
  ChevronRight,
  Database,
  FileCheck2,
  Lock
} from 'lucide-react';
import { DeedWizardState, AIValidationResult } from '../types';

interface AIPlaygroundProps {
  state: DeedWizardState;
  onAutofill: (extractedData: any) => void;
  onAddClause: (clause: any) => void;
}

export default function AIPlayground({ state, onAutofill, onAddClause }: AIPlaygroundProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<AIValidationResult | null>(null);
  const [recommendedClauses, setRecommendedClauses] = useState<any[]>([]);
  const [fraudCheckResult, setFraudCheckResult] = useState<any | null>(null);

  // Simulated OCR uploads
  const mockParentDeeds = [
    {
      id: 'pd1',
      title: 'Mylapore 1995 Parent Deed',
      description: 'PDF scan of original sale deed from SRO Mylapore, registered under Volume 122.',
      data: {
        parties: [
          {
            role: 'Seller',
            name: 'M. Selvakumar',
            fatherName: 'Muthuswamy Mudaliar',
            dob: '1975-04-12',
            age: 51,
            occupation: 'Business',
            aadhaar: '4589-1234-5678',
            pan: 'ABCPS1234F',
            phone: '9840123456',
            email: 'selvakumar.m@example.com',
            address: 'No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041'
          }
        ],
        property: {
          district: 'Chennai',
          taluk: 'Mylapore',
          village: 'Mylapore Village',
          ward: 'Block 12',
          block: 'Ward C',
          propertyType: 'Residential Plot / Land',
          sro: 'SRO Mylapore (Joint-I)'
        },
        survey: {
          surveyNo: '492',
          subDivision: '1',
          pattaNo: '8910',
          tslrNo: 'TSLR-492'
        },
        extent: {
          sqft: 2400,
          acre: 0,
          cent: 5.5,
          hectare: 0
        },
        boundary: {
          east: 'East by 30 Feet Road',
          west: 'West by Plot No. 15 belonging to Raghavan',
          north: 'North by Plot No. 12 belonging to Kumar',
          south: 'South by open municipal lane'
        }
      }
    },
    {
      id: 'pd2',
      title: 'Chitlapakkam Wet Land Parent Deed',
      description: 'JPEG photos of agricultural wet land deed, SRO Tambaram registers.',
      data: {
        parties: [
          {
            role: 'Seller',
            name: 'K. Kathiravan',
            fatherName: 'Karuppiah Pillai',
            dob: '1990-08-05',
            age: 35,
            occupation: 'Agriculture',
            aadhaar: '2345-6789-0123',
            pan: 'CLKPK5566T',
            phone: '9884112233',
            email: 'kathir.k@example.com',
            address: 'Pillayar Kovil Street, Chitlapakkam, Tambaram, Chennai - 600064'
          }
        ],
        property: {
          district: 'Kanchipuram',
          taluk: 'Tambaram',
          village: 'Chitlapakkam',
          ward: 'Mundakanni Amman Ward',
          block: 'Block 2',
          propertyType: 'Agricultural Wet Land (Nanjai)',
          sro: 'SRO Tambaram'
        },
        survey: {
          surveyNo: '89',
          subDivision: '1B',
          pattaNo: '3342',
          tslrNo: 'TS-3342'
        },
        extent: {
          sqft: 10890,
          acre: 0.25,
          cent: 25,
          hectare: 0.1
        },
        boundary: {
          east: 'East by Agricultural Channel (Koil Kaal)',
          west: 'West by lands owned by Karuppan Chettiar',
          north: 'North by main Panchayat gravel road',
          south: 'South by dry land of Devaraj'
        }
      }
    }
  ];

  // 1. Simulate OCR Text Extraction /ai/extract
  const runExtraction = (mockDeed: any) => {
    setLoading('extract');
    setTimeout(() => {
      onAutofill(mockDeed.data);
      setLoading(null);
      alert(`AI Extraction Completed!\n\nSuccessfully parsed 5 distinct legal structures from "${mockDeed.title}". Check form steps to view populated variables.`);
    }, 1500);
  };

  // 2. Simulate Compliance Rule Verification /ai/validate
  const runValidation = () => {
    setLoading('validate');
    setTimeout(() => {
      const warnings: any[] = [];
      
      // Check roles
      if (state.parties.length < 2) {
        warnings.push({
          field: 'Parties Count',
          step: 2,
          severity: 'error',
          message: 'Deed requires a minimum of 2 parties: at least 1 Vendor (Seller) and 1 Vendee (Buyer).',
          suggestion: 'Go to Step 2 and add a Buyer/Donee party row.'
        });
      }

      // Check witnesses
      if (state.witnesses.length < 2) {
        warnings.push({
          field: 'Witnesses',
          step: 9,
          severity: 'warning',
          message: 'Tamil Nadu Registration Act requires a minimum of two signing witnesses for validating Sale Deeds.',
          suggestion: 'Go to Step 9 and enter details for two witnesses.'
        });
      }

      // Check Guideline value alignment
      if (state.transaction.considerationAmount < state.transaction.guidelineValue) {
        warnings.push({
          field: 'Consideration Amount',
          step: 8,
          severity: 'error',
          message: 'Declared transaction consideration is lower than the Deed360 Registry Guideline Value for this village. Under-valuation invokes Section 47A immediate document impounding.',
          suggestion: 'Adjust consideration amount to match or exceed guideline value, or upload agricultural value exemption forms.'
        });
      }

      // Check survey details
      if (!state.survey.pattaNo) {
        warnings.push({
          field: 'Patta Number',
          step: 4,
          severity: 'error',
          message: 'Patta number is mandatory for rural and municipal area registration in Deed360.',
          suggestion: 'Provide a valid Patta number in step 4.'
        });
      }

      // Check boundaries
      if (!state.boundary.east || !state.boundary.west) {
        warnings.push({
          field: 'Property Boundaries',
          step: 6,
          severity: 'warning',
          message: 'All 4 boundaries (East, West, North, South) should be explicitly filled to prevent registration rejection.',
          suggestion: 'Go to Step 6 and complete four boundaries description.'
        });
      }

      setValidationResult({
        passed: warnings.length === 0,
        warnings,
        fraudScore: warnings.length > 0 ? 35 : 0,
        fraudAlerts: []
      });
      setLoading(null);
    }, 1200);
  };

  // 3. Simulate Clause Recommender /ai/recommend-clause
  const runClauseRecommendation = () => {
    setLoading('clauses');
    setTimeout(() => {
      setRecommendedClauses([
        {
          id: 'rec1',
          title: 'Section 47A Guideline Undervaluation Protection',
          category: 'Indemnity',
          contentEn: 'The Vendor hereby covenants that they shall fully cooperate and indemnify the Purchaser in the event of any undervaluation notice under Section 47A of the Stamp Act, provided the purchaser registers at the active guideline rate.',
          contentTa: 'இக்கிரய பத்திரத்திற்கு முத்திரைத்தாள் சட்டம் 47A பிரிவின்கீழ் ஏதேனும் குறைவான மதிப்பீடு வழக்கு பிற்காலத்தில் பதியப்பட்டால், அதற்கு விற்பனையாளரே பொறுப்பேற்று தீர்வு செய்வார்.'
        },
        {
          id: 'rec2',
          title: 'Legal Heir Waiver & Indemnity Block',
          category: 'Indemnity',
          contentEn: 'The Vendor declares that no minor legal heirs have any claim or share in the schedule property and covenants to fully indemnify the Purchaser against any future inheritance challenges.',
          contentTa: 'இச்சொத்தில் மைனர் வாரிசுகள் எவருக்கும் எவ்வித பங்கும் இல்லை என்றும், எதிர்காலத்தில் வாரிசுரிமை கோரல் ஏதேனும் எழுந்தால் அதற்கு விற்பனையாளரே முழுப் பொறுப்பேற்று தீர்வு செய்வார்.'
        }
      ]);
      setLoading(null);
    }, 1000);
  };

  // 4. Simulate Registry Intelligence Fraud Check /ai/fraud-check
  const runFraudCheck = () => {
    setLoading('fraud');
    setTimeout(() => {
      const surveyKey = `${state.survey.surveyNo || '0'}/${state.survey.subDivision || '0'}`;
      const hasDoubleRegThreat = surveyKey === '89/1B' || surveyKey === '142/3A';
      
      setFraudCheckResult({
        survey: surveyKey,
        doubleRegistrationThreat: hasDoubleRegThreat,
        fraudScore: hasDoubleRegThreat ? 85 : 12,
        alerts: hasDoubleRegThreat 
          ? [
              `CRITICAL: Survey No ${surveyKey} in Chitlapakkam Village is on the Deed360 Prohibited Land blocklist (Section 22-A of registration rules). Court injunction order active since Oct 2024.`,
              `ALERT: Potential double-registration attempt flagged. Parent deed metadata indicates active mortgage with Canara Bank.`
            ]
          : [
              `Green Flag: Survey No ${surveyKey} is verified clean on the Deed360 blocklist. No prohibited tags detected.`,
              `Notice: Guideline value alignment is correct for ${state.property.village || 'Thiruvanmiyur Village'}.`
            ]
      });
      setLoading(null);
    }, 1400);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 text-slate-100 p-6 flex flex-col gap-6">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide">Gemini 3.5 AI Registry Suite</h3>
            <p className="text-[10px] text-slate-400">Smart extraction, verification, & fraud intelligence simulation</p>
          </div>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-800 border border-slate-700 text-slate-400">
          MOCK ENDPOINTS
        </span>
      </div>

      {/* Grid Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Module 1: AI OCR Parent Deed Extraction */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-teal-400">
            <Database className="h-4 w-4" />
            <h4 className="text-xs font-bold uppercase tracking-wider">AI OCR Extraction (/ai/extract)</h4>
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Simulate scanning a parent document to auto-fill the 11-step drafting wizard instantly. Select a preset:
          </p>
          <div className="space-y-2">
            {mockParentDeeds.map((deed) => (
              <button
                key={deed.id}
                onClick={() => runExtraction(deed)}
                disabled={loading !== null}
                className="w-full text-left p-3 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/40 transition group flex items-start justify-between"
              >
                <div>
                  <h5 className="text-xs font-bold text-slate-200 group-hover:text-teal-400 transition">{deed.title}</h5>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{deed.description}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-1" />
              </button>
            ))}
          </div>
          {loading === 'extract' && (
            <div className="flex items-center gap-2 justify-center text-xs text-teal-400 font-bold bg-slate-900 py-2.5 rounded">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Analyzing Parent Deed with Gemini-3.5-flash...</span>
            </div>
          )}
        </div>

        {/* Module 2: AI Registry Compliance Validation */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-400">
              <Brain className="h-4 w-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Deed Validator (/ai/validate)</h4>
            </div>
            <button
              onClick={runValidation}
              disabled={loading !== null}
              className="px-3 py-1.5 bg-[#c49a36] hover:bg-[#b58a2b] rounded text-xs text-white font-semibold flex items-center gap-1.5 transition"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              <span>Run Rules Engine</span>
            </button>
          </div>
          
          <p className="text-xs text-slate-400 leading-normal">
            Verifies the current deed draft state against Tamil Nadu sub-registration rules (mandatory witnesses, valuation alignment).
          </p>

          {loading === 'validate' ? (
            <div className="flex items-center gap-2 justify-center text-xs text-teal-400 font-bold bg-slate-900 py-4 rounded border border-slate-800">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Running compliance validations...</span>
            </div>
          ) : validationResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded border border-slate-800 justify-between">
                <span className="text-xs text-slate-300">Rules Run:</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${validationResult.passed ? 'text-teal-400' : 'text-rose-400'}`}>
                  {validationResult.passed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Passed
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      {validationResult.warnings.length} Warnings Identified
                    </>
                  )}
                </span>
              </div>
              
              <div className="max-h-36 overflow-y-auto space-y-2.5 pr-1">
                {validationResult.warnings.map((warn, i) => (
                  <div key={i} className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">Step {warn.step} • {warn.field}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">CRITICAL</span>
                    </div>
                    <p className="text-xs text-slate-300 font-semibold leading-normal mt-0.5">{warn.message}</p>
                    <p className="text-[10px] text-slate-400 font-medium italic mt-1">Suggestion: {warn.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
              Deed validation has not been run. Ensure you have filled a few fields and run.
            </div>
          )}
        </div>

        {/* Module 3: AI Smart Clause Recommender */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-400">
              <Sparkles className="h-4 w-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Clause Recommender</h4>
            </div>
            <button
              onClick={runClauseRecommendation}
              disabled={loading !== null}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-200 font-semibold transition"
            >
              Analyze & Recommend
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Dynamically recommends legal protection clauses in English and Tamil based on your deed type.
          </p>

          {loading === 'clauses' ? (
            <div className="flex items-center gap-2 justify-center text-xs text-teal-400 font-bold bg-slate-900 py-4 rounded">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Analyzing deed parameters...</span>
            </div>
          ) : recommendedClauses.length > 0 ? (
            <div className="space-y-3">
              {recommendedClauses.map((clause) => (
                <div key={clause.id} className="p-3 bg-slate-900 rounded border border-slate-800 text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">{clause.title}</span>
                    <button
                      onClick={() => {
                        onAddClause(clause);
                        alert(`"${clause.title}" appended to drafting state.`);
                      }}
                      className="text-[10px] font-bold text-teal-400 hover:underline"
                    >
                      + Add to Deed
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal italic">{clause.contentEn}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
              Click to evaluate and append Deed360 specialized legal protections.
            </div>
          )}
        </div>

        {/* Module 4: Deed360 Fraud Detection & Double Registration */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-400">
              <ShieldAlert className="h-4 w-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Registry Intelligence (/ai/fraud)</h4>
            </div>
            <button
              onClick={runFraudCheck}
              disabled={loading !== null}
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/30 rounded text-xs text-rose-300 font-semibold transition"
            >
              Analyze Survey Risk
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Queries sub-registrar prohibited registers (litigation, Section 22A, marshlands) for Survey: <strong className="text-slate-300">{state.survey.surveyNo || '————'}/{state.survey.subDivision || '————'}</strong>
          </p>

          {loading === 'fraud' ? (
            <div className="flex items-center gap-2 justify-center text-xs text-teal-400 font-bold bg-slate-900 py-4 rounded">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Scanning Deed360 Blocklists...</span>
            </div>
          ) : fraudCheckResult ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-300">Fraud / Threat Score:</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded ${
                  fraudCheckResult.fraudScore > 50 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                }`}>
                  {fraudCheckResult.fraudScore}% {fraudCheckResult.fraudScore > 50 ? 'HIGH RISK' : 'CLEAN'}
                </span>
              </div>
              
              <div className="space-y-1.5 text-left">
                {fraudCheckResult.alerts.map((alert: string, i: number) => (
                  <p 
                    key={i} 
                    className={`text-[10px] font-medium leading-relaxed p-2 rounded ${
                      fraudCheckResult.doubleRegistrationThreat 
                        ? 'bg-rose-500/5 text-rose-300 border border-rose-500/10' 
                        : 'bg-teal-500/5 text-teal-300 border border-teal-500/10'
                    }`}
                  >
                    {alert}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
              Queries Tamil Nadu sub-registrar database and scans for prohibited or double registration.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
