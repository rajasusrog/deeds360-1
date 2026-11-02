import { useState } from 'react';
import { 
  Bot, 
  FileText, 
  GitCompare, 
  Scan, 
  MapPin, 
  UserCheck, 
  FileCheck, 
  Calculator, 
  Languages, 
  ClipboardCheck, 
  MessageSquare, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  RefreshCw, 
  Copy, 
  Check, 
  Scale, 
  Calendar, 
  Clock, 
  Receipt, 
  BarChart3, 
  ShieldCheck, 
  Search,
  Plus,
  Send,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DeedWizardState, PartyDetails } from '../types';

export default function AiAgentsWorkbench() {
  const { currentDraft, updateCurrentDraftState, createDraft, setActiveTab } = useApp();
  const [activeAgent, setActiveAgent] = useState<string>('drafting');

  // Agent 1: Smart Interview State
  const [docType, setDocType] = useState('Sale Deed');
  const [sellerCount, setSellerCount] = useState(1);
  const [buyerCount, setBuyerCount] = useState(1);
  const [interviewAnswers, setInterviewAnswers] = useState({
    district: 'Chennai',
    sro: 'SRO Mylapore (Joint-I)',
    village: 'Mylapore Village',
    surveyNo: '492/1',
    pattaNo: '8910',
    extentSqft: '2400',
    consideration: '7500000',
    guideline: '7200000',
    isFamily: false
  });
  const [draftingProgress, setDraftingProgress] = useState(false);

  // Agent 2: Comparison State
  const [prevDeedText, setPrevDeedText] = useState(`SALE DEED DATED 12/04/1995
Vendor: M. Selvakumar, S/o Muthuswamy Mudaliar
Vendee: K. Rajkumar, S/o Karuppan Pillai
Property: All that piece and parcel of land bearing Survey No. 492/1, Patta No. 8910, extent 2400 Sq.Ft (5.5 Cents) in Mylapore Village, Chennai District.
Boundaries:
East: 30 Feet Road
West: Plot No. 15 belonging to Raghavan
North: Plot No. 12 belonging to Kumar
South: Open municipal lane
Consideration: Rs. 12,00,000/-`);
  
  const [newDraftText, setNewDraftText] = useState(`SALE DEED DATED 28/07/2026
Vendor: K. Rajkumar, S/o Karuppan Pillai
Vendee: S. Vijay, S/o Sundaram
Property: All that piece and parcel of land bearing Survey No. 492/1B, Patta No. 9102, extent 2200 Sq.Ft in Mylapore Village, Chennai District.
Boundaries:
East: 30 Feet PWD Road
West: Plot No. 15 belonging to Raghavan
North: Plot No. 12 belonging to Kumar
South: Commercial Complex constructed by SRO
Consideration: Rs. 85,00,000/-`);

  const [compareResult, setCompareResult] = useState<any | null>(null);

  // Agent 3: OCR Extraction State
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrText, setOcrText] = useState(`DOCUMENT NO. 1422/1998 OF BOOK 1, SRO MYLAPORE
THIS DEED OF SALE executed on 14th day of October 1998 at Chennai between SRI M. SELVAKUMAR, son of Muthuswamy Mudaliar, aged about 48 years, residing at No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041 (Aadhaar No. 4589-1234-5678, PAN ABCPS1234F), hereinafter called VENDOR of the ONE PART and SRI K. RAJKUMAR, son of Karuppan Pillai, aged about 32 years, residing at Mylapore, Chennai (Aadhaar No. 9988-7766-5544, PAN XYZPR9876K), hereinafter called VENDEE.

SCHEDULE OF PROPERTY:
All that piece and parcel of house ground and premises bearing Survey No. 492, Sub-division 1, Patta No. 8910, measuring 2400 Sq.Ft (5.5 Cents) in Mylapore Village, Mylapore Taluk, Chennai District.
Boundaries: East by 30ft Road, West by Plot 15, North by Plot 12, South by Lane.
Consideration: Rs. 15,00,000/-`);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  // Agent 4 & 5 & 6 & 7 & 8 & 9 & 10 States
  const [nameScanResult, setNameScanResult] = useState<any | null>(null);
  const [stampDutyCalc, setStampDutyCalc] = useState<any | null>(null);
  const [translationText, setTranslationText] = useState('கிரைய பத்திரம்: இந்த தஸ்தாவேஜு சென்னை மாவட்டம் மயிலாப்பூர் கிராமத்தில் அமைந்த நிலத்திற்கான விற்பனை ஆவணம் ஆகும்.');
  const [translatedResult, setTranslatedResult] = useState('');
  const [sroChecklist, setSroChecklist] = useState({
    aadhaar: true,
    pan: true,
    ec: true,
    patta: true,
    parentDeed: true,
    encumbrance: true,
    witnesses: true,
    photos: true,
    thumbImpression: false
  });
  const [clientQuery, setClientQuery] = useState('What is the difference between a Settlement Deed and a Gift Deed in Tamil Nadu?');
  const [aiChatResponse, setAiChatResponse] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Vanakkam! I am your AI DocumentWriter360 Assistant. Ask me anything about Tamil Nadu registration procedures, stamp duty, or legal deed terms in English or Tamil.' }
  ]);

  // Office Management State
  const [appointments, setAppointments] = useState([
    { id: '1', client: 'K. Rajkumar', service: 'Sale Deed Registration', time: '10:30 AM', token: 'T-102', status: 'In Office', fee: '₹ 15,000', feePaid: true },
    { id: '2', client: 'P. Saraswathi', service: 'Family Settlement Deed', time: '02:00 PM', token: 'T-103', status: 'Scheduled', fee: '₹ 12,000', feePaid: false },
    { id: '3', client: 'M. Selvam', service: 'Mortgage Deed Draft', time: '04:15 PM', token: 'T-104', status: 'Pending Review', fee: '₹ 8,000', feePaid: true }
  ]);

  const agentsList = [
    { id: 'drafting', name: 'Deed Drafting Agent', icon: FileText, tag: 'Smart Interview & Multi-Deed' },
    { id: 'ocr', name: 'OCR & Extraction Agent', icon: Scan, tag: 'Scanned Deed AI Reader' },
    { id: 'comparison', name: 'Document Comparison Agent', icon: GitCompare, tag: 'Legal Track Changes' },
    { id: 'property', name: 'Property Validation Agent', icon: MapPin, tag: 'Survey & Schedule Match' },
    { id: 'identity', name: 'Identity & Name Verifier', icon: UserCheck, tag: 'Page-by-Page Name Audit' },
    { id: 'clause', name: 'Clause Compliance Agent', icon: FileCheck, tag: 'Missing Clause Detection' },
    { id: 'stamp', name: 'Stamp Duty & Fee Assistant', icon: Calculator, tag: 'Deed360 Duty Calc' },
    { id: 'translation', name: 'Translation Agent', icon: Languages, tag: 'English ↔ Tamil Legal' },
    { id: 'readiness', name: 'Registration Readiness', icon: ClipboardCheck, tag: 'SRO Pre-Check Audit' },
    { id: 'communication', name: 'Client Explainer Agent', icon: MessageSquare, tag: 'Legal Q&A Assistant' },
    { id: 'office', name: 'AI Office Manager', icon: Calendar, tag: 'Tokens & Appointments' },
  ];

  const demoEnabled = Boolean((import.meta as any).env?.DEV) && (import.meta as any).env?.VITE_ENABLE_DEMO_MODE === 'true';
  const requireDemo = () => {
    if (demoEnabled) return true;
    window.alert('This demonstration tool is not connected. Use the drafting wizard to enter your actual details.');
    return false;
  };

  // Actions
  const handleRunDraftingAgent = () => {
    if (!requireDemo()) return;
    setDraftingProgress(true);
    setTimeout(() => {
      setDraftingProgress(false);
      // Create new draft or update current draft
      const draft = createDraft(docType, 'Mylapore SRO Client Project');
      if (draft) {
        updateCurrentDraftState({
          ...draft.state,
          documentType: docType,
          documentSubtype: 'Absolute Conveyance',
          property: {
            ...draft.state.property,
            district: interviewAnswers.district,
            registrationDistrict: 'Chennai Central',
            taluk: 'Mylapore',
            village: interviewAnswers.village,
            sro: interviewAnswers.sro,
            ward: 'Block 12',
            block: 'Ward C',
            propertyType: 'Residential Plot'
          },
          survey: {
            ...draft.state.survey,
            surveyNo: interviewAnswers.surveyNo.split('/')[0] || '492',
            subDivision: interviewAnswers.surveyNo.split('/')[1] || '1',
            pattaNo: interviewAnswers.pattaNo,
            tslrNo: `TSLR-${interviewAnswers.surveyNo}`
          },
          extent: {
            ...draft.state.extent,
            sqft: Number(interviewAnswers.extentSqft) || 2400,
            cent: (Number(interviewAnswers.extentSqft) || 2400) / 435.6,
            acre: 0,
            hectare: 0
          },
          transaction: {
            ...draft.state.transaction,
            marketValue: Number(interviewAnswers.consideration) || 7500000,
            considerationAmount: Number(interviewAnswers.consideration) || 7500000,
            guidelineValue: Number(interviewAnswers.guideline) || 7200000,
            advancePaid: 1000000,
            balancePaid: 6500000,
            paymentMode: 'DD',
            paymentRefNo: 'HDFC Bank DD No. 889012',
            paymentDate: new Date().toISOString().split('T')[0],
            bankName: 'HDFC Bank Mylapore Branch'
          }
        });
        setActiveTab('wizard');
      }
    }, 1200);
  };

  const handleRunOcrExtraction = () => {
    if (!requireDemo()) return;
    setOcrScanning(true);
    setTimeout(() => {
      setOcrScanning(false);
      setExtractedData({
        documentNo: '1422/1998',
        sro: 'SRO Mylapore',
        seller: {
          name: 'M. Selvakumar',
          father: 'Muthuswamy Mudaliar',
          age: 48,
          aadhaar: '4589-1234-5678',
          pan: 'ABCPS1234F',
          address: 'No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041'
        },
        buyer: {
          name: 'K. Rajkumar',
          father: 'Karuppan Pillai',
          age: 32,
          aadhaar: '9988-7766-5544',
          pan: 'XYZPR9876K',
          address: 'Mylapore, Chennai'
        },
        property: {
          surveyNo: '492/1',
          pattaNo: '8910',
          village: 'Mylapore Village',
          extent: '2400 Sq.Ft (5.5 Cents)',
          boundaries: {
            east: '30ft Road',
            west: 'Plot 15',
            north: 'Plot 12',
            south: 'Lane'
          },
          consideration: 'Rs. 15,00,000/-'
        }
      });
    }, 1400);
  };

  const handleRunComparison = () => {
    if (!requireDemo()) return;
    setCompareResult({
      addedClauses: [
        'Commercial complex construction indemnity added to South boundary clause',
        'Deed360 Online Digital Token Verification Clause inserted'
      ],
      deletedClauses: [
        'Municipal open lane access rights clause omitted'
      ],
      surveyChanges: [
        'Survey Sub-Division changed from 492/1 to 492/1B',
        'Patta Number updated from 8910 to 9102'
      ],
      areaChanges: [
        'Extent reduced from 2,400 Sq.Ft (5.5 Cents) to 2,200 Sq.Ft (-200 Sq.Ft variation)'
      ],
      boundaryChanges: [
        'East boundary: Updated from "30 Feet Road" to "30 Feet PWD Road"',
        'South boundary: Shifted from "Open municipal lane" to "Commercial Complex constructed by SRO"'
      ]
    });
  };

  const handleRunNameAudit = () => {
    if (!requireDemo()) return;
    setNameScanResult({
      status: 'Inconsistency Detected',
      findings: [
        { page: 'Page 1 (Preamble)', text: 'M. Rajkumar', role: 'Vendor' },
        { page: 'Page 3 (Property Clause)', text: 'Raj Kumar', role: 'Vendor' },
        { page: 'Page 8 (Signature Page)', text: 'S. Rajkumar', role: 'Vendor' }
      ],
      recommendation: 'Ensure exact legal full name matches Patta and Aadhaar card (M. Rajkumar) consistently on all pages.',
      aadhaarValid: true,
      panValid: true
    });
  };

  const handleCalculateStampDuty = () => {
    if (!requireDemo()) return;
    const cons = Number(interviewAnswers.consideration) || 7500000;
    const guide = Number(interviewAnswers.guideline) || 7200000;
    const isSettlement = docType === 'Settlement Deed';
    const isFam = interviewAnswers.isFamily;

    let stampRate = 0.07; // 7% standard in TN for Sale
    let regRate = 0.02; // 2% standard reg fee

    if (isSettlement && isFam) {
      stampRate = 0.01; // 1% family settlement capped
      regRate = 0.01;
    }

    const baseVal = Math.max(cons, guide);
    const stampDuty = baseVal * stampRate;
    const regFee = baseVal * regRate;

    setStampDutyCalc({
      baseVal,
      stampRatePercent: stampRate * 100,
      regRatePercent: regRate * 100,
      stampDuty,
      regFee,
      totalFee: stampDuty + regFee,
      concessionNote: isSettlement && isFam ? 'Family Line Settlement Concession Applied (1% Stamp + 1% Reg Fee)' : 'Standard Deed360 General Tariff Rate'
    });
  };

  const handleTranslate = () => {
    if (!requireDemo()) return;
    setTranslatedResult(`SALE DEED: This document is a deed of absolute sale executed at Mylapore Village, Chennai District for the specified land premises.`);
  };

  const handleClientChat = () => {
    if (!requireDemo()) return;
    if (!clientQuery.trim()) return;
    const userMsg = clientQuery;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setClientQuery('');

    setTimeout(() => {
      let reply = "In Tamil Nadu, a Settlement Deed (செட்டில்மெண்ட் பத்திரம்) is executed between blood relatives (parents, children, spouse, siblings) with concessionary stamp duty (1% stamp + 1% reg fee). A Gift Deed (தான பத்திரம்) is executed without monetary consideration to non-family members or entities, attracting standard stamp duty rates.";
      if (userMsg.toLowerCase().includes('stamp duty')) {
        reply = "Stamp duty in Tamil Nadu is calculated on whichever is higher between the declared consideration amount and the official Deed360 Guideline Value. For general Sale Deeds, standard rates are 7% Stamp Duty + 2% Registration Fee.";
      }
      setChatHistory(prev => [...prev, { sender: 'ai', text: reply }]);
    }, 800);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" id="ai-agents-workbench">
      <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Demonstration tools: OCR, translation, fee estimates and chat on this screen are not connected to live services. Sample actions are disabled outside explicit development demo mode. Use the drafting wizard for actual document entry.</div>
      
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 border border-amber-400/30 rounded-2xl text-amber-400">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white uppercase">DocumentWriter360 AI</h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  10 Specialized AI Agents
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                Your AI Document Drafting Assistant — Automated client interview, OCR deed reader, track changes comparison, & Deed360 SRO readiness audit.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              createDraft('Sale Deed', 'New AI Draft Session');
              setActiveTab('wizard');
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Launch Drafting Wizard</span>
          </button>
        </div>
      </div>

      {/* Agents Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {agentsList.map(agent => {
          const Icon = agent.icon;
          const isActive = activeAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between h-24 ${
                isActive 
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-700 font-bold shadow-sm ring-1 ring-amber-500/30' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-5 w-5 ${isActive ? 'text-amber-600' : 'text-slate-500'}`} />
                {isActive && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              </div>
              <div>
                <p className="text-xs font-black truncate">{agent.name}</p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">{agent.tag}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Agent Workbench Area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[500px]">
        
        {/* AGENT 1: Deed Drafting Agent (Smart Interview) */}
        {activeAgent === 'drafting' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">📄 Deed Drafting Agent & Smart Client Interview</h3>
                  <p className="text-xs text-slate-400">Replaces 50 manual paper questions with conversational AI prompts & instant draft setup.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Question Form */}
              <div className="lg:col-span-7 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Conversational Interview Parameters</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Select Instrument Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Sale Deed">Sale Deed (கிரைய பத்திரம்)</option>
                      <option value="Settlement Deed">Settlement Deed (செட்டில்மெண்ட்)</option>
                      <option value="Gift Deed">Gift Deed (தான பத்திரம்)</option>
                      <option value="Mortgage Deed">Mortgage Deed (அடமான பத்திரம்)</option>
                      <option value="Lease Deed">Lease Deed (குத்தகை பத்திரம்)</option>
                      <option value="Partition Deed">Partition Deed (பாகப்பிரிவினை)</option>
                      <option value="Release Deed">Release Deed (விடுதலை பத்திரம்)</option>
                      <option value="Power of Attorney">Power of Attorney (பொது அதிகாரம்)</option>
                      <option value="Cancellation Deed">Cancellation Deed (ரத்து பத்திரம்)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Sub-Registrar Office (SRO)</label>
                    <input
                      type="text"
                      value={interviewAnswers.sro}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, sro: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Survey No / Sub-Division</label>
                    <input
                      type="text"
                      value={interviewAnswers.surveyNo}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, surveyNo: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Patta Number</label>
                    <input
                      type="text"
                      value={interviewAnswers.pattaNo}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, pattaNo: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Extent (Sq.Ft)</label>
                    <input
                      type="number"
                      value={interviewAnswers.extentSqft}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, extentSqft: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Consideration Amount (₹)</label>
                    <input
                      type="number"
                      value={interviewAnswers.consideration}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, consideration: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={interviewAnswers.isFamily}
                      onChange={(e) => setInterviewAnswers({ ...interviewAnswers, isFamily: e.target.checked })}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Is this a Family Line Relative Transaction? (Blood relatives)</span>
                  </label>
                </div>

                <button
                  onClick={handleRunDraftingAgent}
                  disabled={draftingProgress}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {draftingProgress ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>{draftingProgress ? 'Preparing Automated Draft...' : 'Generate & Load into 12-Step Wizard'}</span>
                </button>
              </div>

              {/* AI Guidance Summary */}
              <div className="lg:col-span-5 bg-amber-50/40 p-5 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>AI Drafting Assistant Summary</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The AI Drafting Agent automatically matches Deed360 registration rules for <strong className="text-slate-900">{docType}</strong> in <strong className="text-slate-900">{interviewAnswers.sro}</strong>.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Auto-includes Possession & Indemnity clauses required for {docType}.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-amber-200/60">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Validates Survey No. {interviewAnswers.surveyNo} against Patta No. {interviewAnswers.pattaNo}.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AGENT 2: OCR & Extraction Agent */}
        {activeAgent === 'ocr' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl">
                  <Scan className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🧠 OCR & Document Extraction Agent</h3>
                  <p className="text-xs text-slate-400">Upload scanned PDF or old Tamil/English parent deeds to extract structured JSON variables without retyping.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">Scanned Deed OCR Raw Input</label>
                <textarea
                  rows={8}
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleRunOcrExtraction}
                  disabled={ocrScanning}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {ocrScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                  <span>{ocrScanning ? 'Parsing Deed Structures...' : 'Run AI OCR Extraction'}</span>
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-3">Extracted Data Variables</label>
                {extractedData ? (
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3 text-xs font-mono">
                    <div className="flex justify-between items-center text-emerald-400 font-bold border-b border-slate-800 pb-2">
                      <span>DOCUMENT NO: {extractedData.documentNo} ({extractedData.sro})</span>
                      <span className="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-300">PARSED</span>
                    </div>
                    <div>
                      <p className="text-amber-400 font-bold">Seller:</p>
                      <p>{extractedData.seller.name}, S/o {extractedData.seller.father} ({extractedData.seller.aadhaar})</p>
                    </div>
                    <div>
                      <p className="text-amber-400 font-bold">Buyer:</p>
                      <p>{extractedData.buyer.name}, S/o {extractedData.buyer.father} ({extractedData.buyer.aadhaar})</p>
                    </div>
                    <div>
                      <p className="text-amber-400 font-bold">Property & Boundaries:</p>
                      <p>Survey No: {extractedData.property.surveyNo} | Patta: {extractedData.property.pattaNo}</p>
                      <p>Extent: {extractedData.property.extent}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-56 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium">
                    Click "Run AI OCR Extraction" to view structured fields.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AGENT 3: Document Comparison Agent */}
        {activeAgent === 'comparison' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl">
                  <GitCompare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🔍 Document Comparison Agent ("Legal Track Changes")</h3>
                  <p className="text-xs text-slate-400">Compares historical parent deeds vs new draft to spot added/deleted clauses, survey area changes, & boundary shifts.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Old Parent Deed (1995)</label>
                <textarea
                  rows={6}
                  value={prevDeedText}
                  onChange={(e) => setPrevDeedText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Draft Deed (2026)</label>
                <textarea
                  rows={6}
                  value={newDraftText}
                  onChange={(e) => setNewDraftText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <button
              onClick={handleRunComparison}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
            >
              <GitCompare className="h-4 w-4" />
              <span>Run AI Side-by-Side Comparison</span>
            </button>

            {compareResult && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <h4 className="font-black text-slate-900 text-sm">AI Legal Comparison Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <p className="font-bold text-amber-700 mb-1">📍 Boundary Shifts Detected:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {compareResult.boundaryChanges.map((b: string, i: number) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-200">
                    <p className="font-bold text-rose-700 mb-1">📐 Area Extent Variations:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {compareResult.areaChanges.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AGENT 4: Property Validation Agent */}
        {activeAgent === 'property' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">📍 Property Description & Schedule Validation Agent</h3>
                  <p className="text-xs text-slate-400">Verifies body text vs Schedule text for Survey Numbers, Patta, Sub-division, and Extent discrepancies.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Schedule & Body Cross-Verification Result</span>
              </div>
              <p className="text-slate-700">
                <strong>Survey Number:</strong> 492/1 (Page 2 Body) matches 492/1 (Schedule Page).<br />
                <strong>Patta Number:</strong> 8910 (Page 2 Body) matches 8910 (Schedule Page).<br />
                <strong>Extent:</strong> 2,400 Sq.Ft (Page 2 Body) matches 2,400 Sq.Ft (Schedule Page).
              </p>
            </div>
          </div>
        )}

        {/* AGENT 5: Identity & Name Verifier */}
        {activeAgent === 'identity' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">👤 Identity & Name Consistency Verifier</h3>
                  <p className="text-xs text-slate-400">Scans all document pages to detect spelling, initial, or father's name mismatches across Preamble and Signature pages.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRunNameAudit}
              className="py-2.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              <span>Audit Document Page Names</span>
            </button>

            {nameScanResult && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Name Mismatch Warning Detected</span>
                </div>
                <div className="space-y-1">
                  {nameScanResult.findings.map((f: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-rose-200/60 pb-1">
                      <span className="font-semibold text-slate-700">{f.page}:</span>
                      <span className="font-mono font-bold text-rose-900">{f.text}</span>
                    </div>
                  ))}
                </div>
                <p className="text-slate-700 pt-1 font-medium">💡 <strong>Recommendation:</strong> {nameScanResult.recommendation}</p>
              </div>
            )}
          </div>
        )}

        {/* AGENT 6: Clause Compliance Agent */}
        {activeAgent === 'clause' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-xl">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">📑 Clause Compliance & Missing Clause Detector</h3>
                  <p className="text-xs text-slate-400">Scans draft for mandatory legal clauses (Possession, Indemnity, Consideration, Witness, Schedule) & permits 1-click insertion.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-emerald-900">✔ Possession Handover Clause</span>
                <span className="text-[10px] bg-[#c49a36] text-white px-2 py-0.5 rounded font-bold">PRESENT</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-emerald-900">✔ Consideration Receipt Clause</span>
                <span className="text-[10px] bg-[#c49a36] text-white px-2 py-0.5 rounded font-bold">PRESENT</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-amber-900">⚠️ Indemnity & Title Guarantee Clause</span>
                <button className="text-[10px] bg-amber-500 hover:bg-amber-600 text-slate-950 px-2 py-1 rounded font-black cursor-pointer">
                  + INSERT CLAUSE
                </button>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-emerald-900">✔ Property Schedule & Boundaries</span>
                <span className="text-[10px] bg-[#c49a36] text-white px-2 py-0.5 rounded font-bold">PRESENT</span>
              </div>
            </div>
          </div>
        )}

        {/* AGENT 7: Stamp Duty & Fee Assistant */}
        {activeAgent === 'stamp' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">💰 Stamp Duty & Registration Fee Assistant</h3>
                  <p className="text-xs text-slate-400">Calculates Deed360 stamp duty, registration fees, family concessions, and required supporting documents.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCalculateStampDuty}
              className="py-2.5 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
            >
              <Calculator className="h-4 w-4" />
              <span>Calculate Tamil Nadu Fee Tariff</span>
            </button>

            {stampDutyCalc && (
              <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl space-y-3 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Valuation Base</span>
                    <span className="text-base font-extrabold text-white">₹ {stampDutyCalc.baseVal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Stamp Duty ({stampDutyCalc.stampRatePercent}%)</span>
                    <span className="text-base font-extrabold text-amber-400">₹ {stampDutyCalc.stampDuty.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Reg Fee ({stampDutyCalc.regRatePercent}%)</span>
                    <span className="text-base font-extrabold text-amber-400">₹ {stampDutyCalc.regFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3 bg-emerald-950 border border-emerald-500/30 rounded-xl">
                    <span className="text-[10px] text-emerald-400 block font-bold uppercase">Total Payable</span>
                    <span className="text-base font-black text-emerald-300">₹ {stampDutyCalc.totalFee.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center font-medium italic">
                  Note: Final calculation should be verified at SRO counter prior to registration.
                </p>
              </div>
            )}
          </div>
        )}

        {/* AGENT 8: Translation Agent */}
        {activeAgent === 'translation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-xl">
                  <Languages className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🌐 AI Legal Translation Agent (English ↔ Tamil)</h3>
                  <p className="text-xs text-slate-400">Translates legal deeds between English and Tamil preserving legal terms and Deed360 formatting.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tamil Input Text</label>
                <textarea
                  rows={4}
                  value={translationText}
                  onChange={(e) => setTranslationText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">English Legal Translation</label>
                <textarea
                  rows={4}
                  readOnly
                  value={translatedResult || 'Click translate to generate English output.'}
                  className="w-full bg-slate-900 text-amber-300 border border-slate-800 rounded-xl p-3 text-xs font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleTranslate}
              className="py-2.5 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
            >
              <Languages className="h-4 w-4" />
              <span>Translate preserving Deed360 Formatting</span>
            </button>
          </div>
        )}

        {/* AGENT 9: Registration Readiness Agent */}
        {activeAgent === 'readiness' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-sky-600 border border-sky-200 rounded-xl">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">📋 Registration Readiness Checker</h3>
                  <p className="text-xs text-slate-400">Audits mandatory document pre-requisites before heading to the Sub-Registrar Office.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {Object.entries(sroChecklist).map(([key, val]) => (
                <div key={key} className={`p-3 rounded-xl border flex items-center justify-between ${val ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                  <span className="font-bold uppercase text-slate-800">{key} Verification</span>
                  {val ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENT 10: Client Communication Agent */}
        {activeAgent === 'communication' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">💬 Client Communication & Legal Q&A Assistant</h3>
                  <p className="text-xs text-slate-400">Answers client questions about deeds, stamp duty, or patta rules in simple language.</p>
                </div>
              </div>
            </div>

            <div className="h-64 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xl p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white border border-slate-200 text-slate-800'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Ask legal question in Tamil or English..."
                className="flex-1 bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium"
              />
              <button
                onClick={handleClientChat}
                className="px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {/* AGENT 11: AI Office Management */}
        {activeAgent === 'office' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🏢 AI Office Management & Token Desk</h3>
                  <p className="text-xs text-slate-400">Manages daily client tokens, appointment scheduling, fee collection, and office queues.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
              {appointments.map(app => (
                <div key={app.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-slate-900">{app.client}</span>
                    <span className="bg-[#c49a36] text-white font-bold px-2 py-0.5 rounded text-[10px]">{app.token}</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">{app.service} • {app.time}</p>
                  <div className="pt-2 flex justify-between items-center border-t border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-800">{app.fee}</span>
                    <span className={`font-bold ${app.feePaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {app.feePaid ? 'PAID' : 'PENDING'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
