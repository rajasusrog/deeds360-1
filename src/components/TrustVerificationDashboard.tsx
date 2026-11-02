import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Fingerprint, 
  Building, 
  Coins, 
  History, 
  HelpCircle, 
  Globe, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';
import { DeedWizardState } from '../types';
import { useApp } from '../context/AppContext';
import { getActiveSession } from '../lib/supabase';
import { 
  calculateTrustScore, 
  ComprehensiveVerificationResult,
  UIDAIAadhaarConnector,
  NsdlPanConnector,
  TnreginetGuidelineConnector,
  ESevaiPattaConnector,
  EcRegistryConnector
} from '../utils/verificationService';

interface TrustVerificationDashboardProps {
  state: DeedWizardState;
  onJumpToStep?: (step: number) => void;
}

export default function TrustVerificationDashboard({ state, onJumpToStep }: TrustVerificationDashboardProps) {
  const { currentDraft } = useApp();
  const [result, setResult] = useState<ComprehensiveVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'connectors'>('overview');
  const [connectorLogs, setConnectorLogs] = useState<Record<string, any>>({});
  const [crossCheckAlert, setCrossCheckAlert] = useState<{ message: string; severity: 'critical' | 'high'; fix: string } | null>(null);

  const performAuthorizedCrossCheck = async () => {
    try {
      const surveyRows = Array.isArray(state.surveys) && state.surveys.length > 0
        ? state.surveys.filter(s => s && String(s.surveyNo || '').trim())
        : state.survey?.surveyNo
          ? [state.survey]
          : [];
      if (surveyRows.length === 0) {
        setCrossCheckAlert(null);
        return;
      }

      const session = await getActiveSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const crossRes = await fetch('/api/verification/cross-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state,
          currentDocId: currentDraft?.id
        })
      });
      if (crossRes.ok) {
        const data = await crossRes.json();
        if (data.conflict || data.hasConflict) {
          const msg = data.message || data.alerts?.[0]?.message || 'Possible survey overlap requiring transaction-history review.';
          setCrossCheckAlert({
            message: `Possible Survey Conflict (Review Required): ${msg}`,
            severity: 'high',
            fix: 'Review the transaction history: if this deed is a subsequent transfer of the same property, enter the prior Deed Reference in Step 4 (Parent Document No.) or record your chain-of-title review.'
          });
        } else {
          setCrossCheckAlert(null);
        }
      }
    } catch (err) {
      console.error('Error doing cross check:', err);
    }
  };

  useEffect(() => {
    // Perform verification calculation on mount/state modification
    const res = calculateTrustScore(state);
    setResult(res);
    performAuthorizedCrossCheck();
  }, [state, currentDraft?.id]);

  const triggerDiagnosticScan = () => {
    setIsLoading(true);
    setTimeout(async () => {
      const res = calculateTrustScore(state);
      setResult(res);
      
      // Simulate calling the external connectors
      const aadhaarConn = new UIDAIAadhaarConnector();
      const panConn = new NsdlPanConnector();
      const guidelineConn = new TnreginetGuidelineConnector();
      const pattaConn = new ESevaiPattaConnector();
      const ecConn = new EcRegistryConnector();

      const logs: Record<string, any> = {};

      // Pull party values
      const p1 = state.parties[0];
      const s1 = state.surveys?.[0] || state.survey;

      if (p1) {
        logs[aadhaarConn.id] = await aadhaarConn.verify(p1.aadhaar || '1234');
        logs[panConn.id] = await panConn.verify(p1.pan || 'ABCDE1234F');
      }

      logs[guidelineConn.id] = await guidelineConn.verify({
        district: state.property.district || 'Chennai',
        village: state.property.village || 'Mylapore',
        surveyNo: s1?.surveyNo || '1'
      });

      logs[pattaConn.id] = await pattaConn.verify({
        pattaNo: s1?.pattaNo || '0',
        village: state.property.village || 'Mylapore',
        surveyNo: s1?.surveyNo || '1'
      });

      logs[ecConn.id] = await ecConn.verify({
        parentDocNo: state.ownershipHistory?.parentDocNo || '',
        parentDocYear: state.ownershipHistory?.parentDocYear || '',
        surveyNo: s1?.surveyNo || '1'
      });

      // Also trigger real-time cross check
      await performAuthorizedCrossCheck();

      setConnectorLogs(logs);
      setIsLoading(false);
    }, 1000);
  };

  if (!result) return null;

  const {
    identityResult,
    propertyResult,
    ownershipResult,
    financialResult,
    fraudResult,
    trustScore,
    trustBand,
    scoreBreakdown
  } = result;

  const getBandColor = (band: typeof trustBand) => {
    switch (band) {
      case 'Format Valid':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          badge: 'bg-[#c49a36] text-white',
          text: 'text-emerald-600',
          ring: 'ring-emerald-500/20'
        };
      case 'Review Recommended':
        return {
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
          badge: 'bg-indigo-600 text-white',
          text: 'text-indigo-600',
          ring: 'ring-indigo-500/20'
        };
      case 'Suspicious':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          badge: 'bg-amber-600 text-white',
          text: 'text-amber-600',
          ring: 'ring-amber-500/20'
        };
      case 'High Risk':
      default:
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          badge: 'bg-rose-600 text-white',
          text: 'text-rose-600',
          ring: 'ring-rose-500/20'
        };
    }
  };

  const getStatusIcon = (passed: boolean, status: string) => {
    if (status === 'Suspicious' || status === 'Format Error') {
      return <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />;
    }
    if (passed) {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
    }
    return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
  };

  const colors = getBandColor(trustBand);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6 shadow-sm flex flex-col h-full text-slate-800 font-sans" id="trust-verification-dashboard">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
            <ShieldCheck className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">UNIKORN360 DEEDOS Trust Engine</h3>
            <p className="text-[10px] text-slate-400 font-medium">Automatic fraud auditing & registry connector suite</p>
          </div>
        </div>
        
        <button
          onClick={triggerDiagnosticScan}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-45"
          title="Run diagnostics with external gateways"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Main Score & Band Summary Banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between ${colors.bg}`}>
        <div className="flex items-center gap-4">
          {/* Circular Score Visualizer */}
          <div className="relative w-20 h-20 flex items-center justify-center bg-white rounded-full shadow-inner border border-slate-150">
            <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={
                  trustBand === 'Format Valid' ? '#10b981' :
                  trustBand === 'Review Recommended' ? '#6366f1' :
                  trustBand === 'Suspicious' ? '#f59e0b' :
                  '#f43f5e'
                }
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - trustScore / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="text-xl font-black text-slate-800">{trustScore}</span>
          </div>

          <div className="space-y-1 text-left">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Trust Rating</p>
            <h4 className="text-sm font-extrabold flex items-center gap-1.5 leading-none">
              <span>Status: {trustBand}</span>
            </h4>
            <p className="text-[10px] opacity-85 leading-relaxed">
              {trustBand === 'Format Valid' && 'Perfect compliance profile. Suitable for immediate SRO electronic export.'}
              {trustBand === 'Review Recommended' && 'Minor informational warnings found. Please review the highlighted indicators.'}
              {trustBand === 'Suspicious' && 'Moderate verification gaps. Correct all highlighted data fields before submission.'}
              {trustBand === 'High Risk' && 'Blocked. Absolute compliance gaps or known blocklist markers identified.'}
            </p>
          </div>
        </div>

        {/* Breakdown badge */}
        <div className="flex flex-col gap-1.5 shrink-0 text-center w-full md:w-auto">
          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${colors.badge}`}>
            {trustBand}
          </span>
          <span className="text-[9px] font-bold text-slate-400">Score Out of 100</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-150 text-[10px] font-bold uppercase tracking-wider shrink-0 gap-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'overview' ? 'border-emerald-600 text-emerald-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Trust Overview
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'modules' ? 'border-emerald-600 text-emerald-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Modular Checks ({
            (identityResult.passed ? 1 : 0) + 
            (propertyResult.passed ? 1 : 0) + 
            (ownershipResult.passed ? 1 : 0) + 
            (financialResult.passed ? 1 : 0) + 
            (fraudResult.passed ? 1 : 0)
          }/5 Pass)
        </button>
        <button
          onClick={() => setActiveTab('connectors')}
          className={`px-3 py-1.5 border-b-2 transition ${activeTab === 'connectors' ? 'border-emerald-600 text-emerald-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          API Connector Logs
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-4 text-xs">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-left">
            {/* Score Breakdown Points Cards */}
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Identity</span>
                <span className="text-xs font-black text-slate-800">{scoreBreakdown.identity}/25</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Property</span>
                <span className="text-xs font-black text-slate-800">{scoreBreakdown.property}/25</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Title Chain</span>
                <span className="text-xs font-black text-slate-800">{scoreBreakdown.ownership}/20</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Finance</span>
                <span className="text-xs font-black text-slate-800">{scoreBreakdown.financial}/15</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Security</span>
                <span className="text-xs font-black text-slate-800">{scoreBreakdown.fraud}/15</span>
              </div>
            </div>

            {/* List of active alerts */}
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Identified Gaps & Action Items</span>
              
              {[
                ...(crossCheckAlert ? [crossCheckAlert] : []),
                ...identityResult.alerts,
                ...propertyResult.alerts,
                ...ownershipResult.alerts,
                ...financialResult.alerts,
                ...fraudResult.alerts
              ].length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-extrabold text-xs text-slate-700">Perfect Verification Profile!</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">No critical warnings, broken chains, or undervaluation triggers are present.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    ...(crossCheckAlert ? [crossCheckAlert] : []),
                    ...identityResult.alerts,
                    ...propertyResult.alerts,
                    ...ownershipResult.alerts,
                    ...financialResult.alerts,
                    ...fraudResult.alerts
                  ].map((alert, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                        alert.severity === 'critical' ? 'bg-rose-50/50 border-rose-100' :
                        alert.severity === 'high' ? 'bg-orange-50/40 border-orange-100' :
                        'bg-amber-50/30 border-amber-100'
                      }`}
                    >
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      
                      <div className="space-y-1 flex-1">
                        <p className="font-bold text-slate-800 text-[11px]">{alert.message}</p>
                        <p className="text-[9.5px] text-slate-500 leading-normal">
                          <strong className="text-indigo-600 uppercase tracking-wide font-black text-[8.5px]">How To Fix:</strong> {alert.fix}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODULAR RESULTS TAB */}
        {activeTab === 'modules' && (
          <div className="space-y-3 text-left">
            {[
              { name: 'Identity Verification Engine', res: identityResult, icon: Fingerprint, desc: 'Audits taxpayer credentials, masked Aadhaar storage patterns, and witness pools.' },
              { name: 'Property Boundary Engine', res: propertyResult, icon: Building, desc: 'Validates subdivision coordinates, Patta format alignment, and Section 22-A blocklists.' },
              { name: 'Ownership Continuity Engine', res: ownershipResult, icon: History, desc: 'Audits chronological timeline parameters and tracks continuous seller pedigree.' },
              { name: 'Financial Integrity Engine', res: financialResult, icon: Coins, desc: 'Cross-checks consideration sums against SRO guideline matrices and verifies 7%+4% duties.' },
              { name: 'Fraud Signal Engine', res: fraudResult, icon: ShieldAlert, desc: 'Detects overlapping telephone keys, repeating pattern numbers, and rapid asset flipping.' }
            ].map((mod, i) => (
              <div key={i} className="border border-slate-150 rounded-xl p-3 bg-slate-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600">
                      <mod.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-[11px]">{mod.name}</h4>
                      <p className="text-[9.5px] text-slate-400">{mod.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      mod.res.status === 'Format Valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      mod.res.status === 'Partially Valid' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {mod.res.status}
                    </span>
                    {getStatusIcon(mod.res.passed, mod.res.status)}
                  </div>
                </div>

                {mod.res.details.length > 0 && (
                  <div className="bg-white/80 p-2 rounded-lg border border-slate-100 space-y-0.5">
                    {mod.res.details.map((det, dIdx) => (
                      <p key={dIdx} className="text-[9.5px] text-slate-500 font-medium flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        {det}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PLUGGABLE CONNECTORS LOGS */}
        {activeTab === 'connectors' && (
          <div className="space-y-4 text-left">
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl space-y-1.5 border border-slate-950 font-mono text-[10px]">
              <div className="flex items-center gap-1.5 text-teal-400 border-b border-slate-800 pb-1.5 mb-1.5">
                <Cpu className="h-4 w-4" />
                <span className="font-bold">EXTERNAL ADAPTER SUITE STATUS</span>
              </div>
              <p>• External Verification Status: <span className="text-amber-400 font-bold">NOT EXTERNALLY VERIFIED</span></p>
              <p>• External Provider Connection: <span className="text-slate-400">Live Provider API Not Connected</span></p>
              <p>• Local Format Validation: <span className="text-teal-300">Syntax & Pattern Checking Active</span></p>
            </div>

            <div className="space-y-3">
              {[
                { name: 'UIDAI Aadhaar Gateway API', id: 'uidai-aadhaar-gateway', desc: 'Secure biometric vault query for demographic and mobile binding confirmation.' },
                { name: 'NSDL Income Tax PAN Registry', id: 'nsdl-pan-taxpayer-query', desc: 'Queries PAN structural format and taxonomic holder profile logs.' },
                { name: 'TNreginet Guideline Service', id: 'tnreginet-guideline-service', desc: 'Provider integration unavailable; local checks only.' },
                { name: 'e-Sevai Patta Mutation Registry', id: 'esevai-patta-mutation-service', desc: 'Live ownership validation and Revenue Mutation checks.' },
                { name: 'Deed360 EC Ledger API', id: 'star20-ec-ledger-connector', desc: 'No live external ledger is connected.' }
              ].map((conn, i) => (
                <div key={i} className="border border-slate-150 rounded-xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-[11px] text-slate-800">{conn.name}</h4>
                      <p className="text-[9.5px] text-slate-400 font-medium">{conn.desc}</p>
                    </div>
                    <span className="text-[9px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                      Sandbox Ready
                    </span>
                  </div>

                  {connectorLogs[conn.id] ? (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-mono text-[9.5px] space-y-1 text-slate-600">
                      <p className="text-[8.5px] font-bold uppercase text-indigo-600 border-b border-slate-150/60 pb-1">Gateway Payload Response:</p>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(connectorLogs[conn.id], null, 2)}</pre>
                    </div>
                  ) : (
                    <button
                      onClick={triggerDiagnosticScan}
                      className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <span>Simulate live API Query</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer Status Indicators */}
      <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px] text-slate-400 font-bold shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          External verification not connected
        </span>
        <span className="font-mono">
          UNIKORN-TRUST • v3.0
        </span>
      </div>

    </div>
  );
}
