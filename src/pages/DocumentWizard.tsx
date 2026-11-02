import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Scale, 
  Users, 
  Building, 
  Navigation, 
  History, 
  CreditCard, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { DeedWizardState, PartyDetails, WitnessDetails, SurveyDetails } from '../types';
import DocumentPreview from '../components/DocumentPreview';
import { useApp } from '../context/AppContext';
import AIPlayground from '../components/AIPlayground';
import AIInsightsDashboard from '../components/AIInsightsDashboard';
import TrustVerificationDashboard from '../components/TrustVerificationDashboard';

// Import our newly created modular step components
import WizardStepper from '../components/wizard/WizardStepper';
import Step1DocType from '../components/wizard/Step1DocType';
import Step2Parties from '../components/wizard/Step2Parties';
import Step3Property from '../components/wizard/Step3Property';
import Step4Survey from '../components/wizard/Step4Survey';
import Step5Measurement from '../components/wizard/Step5Measurement';
import Step6Boundary from '../components/wizard/Step6Boundary';
import Step7History from '../components/wizard/Step7History';
import Step8Transaction from '../components/wizard/Step8Transaction';
import Step9Witnesses from '../components/wizard/Step9Witnesses';
import Step10Clauses from '../components/wizard/Step10Clauses';
import Step11Review from '../components/wizard/Step11Review';
import Step12Generate from '../components/wizard/Step12Generate';
import { isRegistrationDistrictCompatible } from '../utils/geoUtils';
import {
  resolveDeedType,
  isDeedTemplateAvailable,
  partitionPartiesForDeedType,
  normalizeDeedCode
} from '../utils/deedTypes';
import { validateAadhaarPure } from '../utils/deedValidation';

export default function DocumentWizard() {
  const [activeStep, setActiveStep] = useState(1);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [rightPaneTab, setRightPaneTab] = useState<'preview' | 'ai' | 'trust'>('preview');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [wizardNotice, setWizardNotice] = useState<{ type: 'error' | 'warning' | 'info' | 'success'; message: string } | null>(null);

  const { 
    currentDraft, 
    updateCurrentDraftState, 
    saveDraftManual, 
    retrySyncDraft,
    resolveVersionConflict,
    acknowledgeSurveyConflictAndFinalize,
    dismissSurveyConflictReview,
    createDraftRevision,
    autosaveStatus, 
    lastSaveError,
    versionConflict,
    surveyConflictReview,
    setActiveTab,
    calculateProgress
  } = useApp();

  // If there's no active draft, show the select screen
  if (!currentDraft) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-6 text-left">
        <div className="max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-sm text-center space-y-5 font-sans">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-slate-800">No Active Drafting Session</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Deed Drafting Wizard requires an active document draft context to autosave your progress safely.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('documents')}
              className="w-full py-2.5 bg-[#c49a36] hover:bg-[#b58a2b] text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              Go to Document Registry Center
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-750 text-xs font-bold rounded-lg transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const state = currentDraft.state;
  const isLocked = currentDraft.status === 'Finalized' || currentDraft.status === 'Exported' || currentDraft.status === 'Archived';
  const setState = (newState: DeedWizardState | ((prev: DeedWizardState) => DeedWizardState)) => {
    if (isLocked) {
      setWizardNotice({
        type: 'warning',
        message: 'This document is finalized and locked. Create a formal revision to make corrections while preserving revision history.'
      });
      return;
    }
    setWizardNotice(null);
    if (typeof newState === 'function') {
      updateCurrentDraftState(newState(state));
    } else {
      updateCurrentDraftState(newState);
    }
  };

  const stepsList = [
    { num: 1, name: 'Doc Type', icon: Scale },
    { num: 2, name: 'Parties', icon: Users },
    { num: 3, name: 'Property', icon: Building },
    { num: 4, name: 'Survey', icon: Navigation },
    { num: 5, name: 'Extent', icon: Navigation },
    { num: 6, name: 'Boundary', icon: Navigation },
    { num: 7, name: 'History', icon: History },
    { num: 8, name: 'Transaction', icon: CreditCard },
    { num: 9, name: 'Witnesses', icon: Users },
    { num: 10, name: 'Clauses', icon: Scale },
    { num: 11, name: 'Review', icon: CheckCircle },
    { num: 12, name: 'Generate', icon: CheckCircle }
  ];

  // Validation engine for wizard steps (soft during drafting, strict during final generation)
  const validateStep = (step: number, isFinal: boolean = false): boolean => {
    const newErrors: Record<string, string> = {};
    const newWarnings: Record<string, string> = {};
    const deedDef = resolveDeedType(state.documentType);

    // Helper to add error or warning based on mode
    const addIssue = (stepNum: number, field: string, message: string, isWarningOnly: boolean = false) => {
      if (isFinal) {
        newErrors[field] = message;
      } else if (activeStep === stepNum) {
        if (isWarningOnly) {
          newWarnings[field] = message;
        } else {
          newErrors[field] = message;
        }
      }
    };

    const stepsToValidate = isFinal ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [step];

    stepsToValidate.forEach((s) => {
      if (s === 1) {
        if (!state.documentType) {
          addIssue(1, 'documentType', 'Document type selection is required');
        } else if (!isDeedTemplateAvailable(state.documentType)) {
          addIssue(1, 'documentType', `Template unavailable for "${state.documentType}". Generation and export are blocked.`);
        }
      }

      if (s === 2) {
        if (state.parties.length === 0) {
          addIssue(2, 'parties_length', 'At least one executing party is required');
        }
        if (deedDef && deedDef.templateAvailable) {
          const { grantors, grantees } = partitionPartiesForDeedType(state.parties, deedDef.code);
          if (grantors.length === 0 || grantees.length === 0) {
            addIssue(
              2,
              'parties_roles',
              `${deedDef.nameEn} requires at least one ${deedDef.grantorRole} and one ${deedDef.granteeRole}.`
            );
          }
        }
        state.parties.forEach((party, idx) => {
          const prefix = `parties.${idx}`;
          if (!party.name?.trim()) {
            addIssue(2, `${prefix}.name`, `${party.role || 'Party'} Full Name is required`);
          }
          if (!party.fatherName?.trim()) {
            addIssue(2, `${prefix}.fatherName`, `${party.role || 'Party'} Father / Husband Name is required`);
          }
          if (!party.age || party.age < 18) {
            addIssue(2, `${prefix}.age`, `${party.role || 'Party'} must be 18+ years old`);
          }
          if (!party.address?.trim()) {
            addIssue(2, `${prefix}.address`, `${party.role || 'Party'} Complete Address is required`);
          }

          // Pure Aadhaar Validation (NEVER mutates party.aadhaar or form values)
          if (!party.aadhaar?.trim()) {
            addIssue(2, `${prefix}.aadhaar`, `${party.role || 'Party'} Aadhaar ID is required`);
          } else {
            const aadhaarCheck = validateAadhaarPure(party.aadhaar);
            if (!aadhaarCheck.valid) {
              addIssue(
                2,
                `${prefix}.aadhaar`,
                aadhaarCheck.reason === 'placeholder'
                  ? `${party.role || 'Party'} Aadhaar cannot be a sequential or repeated placeholder`
                  : `${party.role || 'Party'} Aadhaar must be 12 digits or in XXXX-XXXX-1234 format`
              );
            }
          }

          // PAN Validation
          if (!party.pan?.trim()) {
            addIssue(2, `${prefix}.pan`, `${party.role || 'Party'} PAN ID is required`);
          } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(party.pan.toUpperCase())) {
            addIssue(2, `${prefix}.pan`, `${party.role || 'Party'} PAN format must match standard ABCDE1234F`, true);
          }

          // Mobile Validation
          if (!party.phone?.trim()) {
            addIssue(2, `${prefix}.phone`, `${party.role || 'Party'} Phone number is required`);
          } else if (!/^[6-9][0-9]{9}$/.test(party.phone)) {
            addIssue(2, `${prefix}.phone`, `${party.role || 'Party'} Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.`, true);
          }
        });
      }

      if (s === 3) {
        if (!state.property.district) addIssue(3, 'property.district', 'Revenue District is required');
        if (!state.property.registrationDistrict) addIssue(3, 'property.registrationDistrict', 'Registration District is required');
        if (!state.property.taluk) addIssue(3, 'property.taluk', 'Taluk is required');
        if (!state.property.village) addIssue(3, 'property.village', 'Village is required');
        if (!state.property.sro) addIssue(3, 'property.sro', 'Sub-Registrar Office (SRO) is required');
        if (!state.property.doorNo?.trim()) addIssue(3, 'property.doorNo', 'Door Number / Plot Number is required');
        
        if (state.property.district && state.property.registrationDistrict && !isRegistrationDistrictCompatible(state.property.registrationDistrict, state.property.district)) {
          addIssue(3, 'property.sro', 'Selected SRO does not match property jurisdiction. Please verify registration district and SRO.');
        }
      }

      if (s === 4) {
        const surveysToValidate = state.surveys && state.surveys.length > 0 ? state.surveys : [state.survey];
        surveysToValidate.forEach((survey, idx) => {
          const prefix = `surveys.${idx}`;
          if (!survey.surveyNo?.trim()) {
            addIssue(4, `${prefix}.surveyNo`, 'Survey Number is required');
          } else if (!/^[a-zA-Z0-9/-]+$/.test(survey.surveyNo)) {
            addIssue(4, `${prefix}.surveyNo`, 'Survey Number must be alphanumeric and can contain slashes or hyphens only.', true);
          }

          if (!survey.subDivision?.trim()) {
            addIssue(4, `${prefix}.subDivision`, 'Subdivision Number is required');
          } else if (!/^[a-zA-Z0-9/-]+$/.test(survey.subDivision)) {
            addIssue(4, `${prefix}.subDivision`, 'Subdivision must be alphanumeric and can contain slashes or hyphens only.', true);
          }

          if (!survey.pattaNo?.trim()) addIssue(4, `${prefix}.pattaNo`, 'Patta Number is required');
          if (!survey.chittaRef?.trim()) addIssue(4, `${prefix}.chittaRef`, 'Chitta Reference is required');
        });
      }

      if (s === 5) {
        const extentVal = state.extent.totalExtent || state.extent.sqft;
        if (!extentVal || extentVal <= 0) {
          addIssue(5, 'extent.totalExtent', 'Total Extent / Sq.Ft must be greater than 0');
        }
        if (!state.extent.eastWest?.trim()) addIssue(5, 'extent.eastWest', 'East-West Measurement is required');
        if (!state.extent.northSouth?.trim()) addIssue(5, 'extent.northSouth', 'North-South Measurement is required');
      }

      if (s === 6) {
        const b = state.boundary;
        if (!b.east?.trim()) {
          addIssue(6, 'boundary.east', 'East Boundary description is required');
        } else if (b.east.trim().length < 5) {
          addIssue(6, 'boundary.east', 'East Boundary description is too short. Please provide a descriptive boundary.', true);
        }

        if (!b.west?.trim()) {
          addIssue(6, 'boundary.west', 'West Boundary description is required');
        } else if (b.west.trim().length < 5) {
          addIssue(6, 'boundary.west', 'West Boundary description is too short. Please provide a descriptive boundary.', true);
        }

        if (!b.north?.trim()) {
          addIssue(6, 'boundary.north', 'North Boundary description is required');
        } else if (b.north.trim().length < 5) {
          addIssue(6, 'boundary.north', 'North Boundary description is too short. Please provide a descriptive boundary.', true);
        }

        if (!b.south?.trim()) {
          addIssue(6, 'boundary.south', 'South Boundary description is required');
        } else if (b.south.trim().length < 5) {
          addIssue(6, 'boundary.south', 'South Boundary description is too short. Please provide a descriptive boundary.', true);
        }
      }

      if (s === 7) {
        const hist = state.ownershipHistory;
        if (!hist.parentDocNo?.trim()) addIssue(7, 'ownershipHistory.parentDocNo', 'Parent Document Number is required');
        if (!hist.parentDocYear?.trim()) addIssue(7, 'ownershipHistory.parentDocYear', 'Registration Year is required');
        if (!hist.parentDocSRO?.trim()) addIssue(7, 'ownershipHistory.parentDocSRO', 'Parent SRO Registry Office is required');
        if (!hist.priorOwners?.trim()) addIssue(7, 'ownershipHistory.priorOwners', 'Previous Owner name is required');
        
        if (!hist.parentDocDate?.trim()) {
          addIssue(7, 'ownershipHistory.parentDocDate', 'Parent Registration Date is required');
        } else {
          const pDate = new Date(hist.parentDocDate);
          const today = new Date();
          if (pDate > today) {
            addIssue(7, 'ownershipHistory.parentDocDate', 'Parent Registration Date cannot be in the future.', true);
          }
          if (hist.parentDocYear?.trim()) {
            const pYear = pDate.getFullYear();
            if (pYear.toString() !== hist.parentDocYear.trim()) {
              addIssue(7, 'ownershipHistory.parentDocYear', `Parent Registration Year (${hist.parentDocYear}) does not match parent registration date year (${pYear}).`, true);
            }
          }
        }
      }

      if (s === 8) {
        const tx = state.transaction;
        const requiresMonetary = deedDef ? deedDef.requiresMonetaryConsideration : true;
        const requiresPaymentRef = deedDef ? deedDef.requiresPaymentReference : true;

        if (requiresMonetary) {
          if (!tx.considerationAmount || tx.considerationAmount <= 0) {
            addIssue(8, 'transaction.considerationAmount', `${deedDef?.considerationLabelEn || 'Consideration Amount'} must be greater than 0`);
          }
        } else if (deedDef && (deedDef.code === 'GIFT' || deedDef.code === 'SETTLEMENT' || deedDef.code === 'POA') && (tx.considerationAmount || 0) > 0) {
          addIssue(8, 'transaction.considerationAmount', `${deedDef.nameEn} must be executed without monetary consideration (Rs. 0).`);
        }

        if (!deedDef || deedDef.code !== 'POA') {
          if (!tx.marketValue || tx.marketValue <= 0) {
            addIssue(8, 'transaction.marketValue', 'Market Value must be greater than 0');
          }
          if (!tx.guidelineValue || tx.guidelineValue <= 0) {
            addIssue(8, 'transaction.guidelineValue', 'Guideline Value must be greater than 0');
          }
        }

        if (requiresPaymentRef && !tx.paymentRefNo?.trim()) {
          addIssue(8, 'transaction.paymentRefNo', 'UTR / Payment Reference Number is required');
        }
        if (!tx.ecReference?.trim()) {
          addIssue(8, 'transaction.ecReference', 'EC Reference Number is required');
        }
        if (!tx.propertyTaxReceipt?.trim()) {
          addIssue(8, 'transaction.propertyTaxReceipt', 'Property Tax Receipt Reference is required');
        }
        if (!tx.stampDuty || tx.stampDuty <= 0) {
          addIssue(8, 'transaction.stampDuty', 'Declared Stamp Duty Assessment amount is required');
        }
        if (!tx.registrationFee || tx.registrationFee <= 0) {
          addIssue(8, 'transaction.registrationFee', 'Declared Registration Fee Assessment amount is required');
        }

        // Advance + Balance == Consideration (only for Sale Deed)
        const adv = tx.advancePaid || 0;
        const bal = tx.balancePaid || 0;
        const cons = tx.considerationAmount || 0;
        if ((!deedDef || deedDef.code === 'SALE') && cons > 0 && Math.round(adv + bal) !== Math.round(cons)) {
          addIssue(8, 'transaction.considerationAmount', `Payment structure mismatch: Advance (${adv}) + Balance (${bal}) must equal Consideration Amount (${cons}).`, true);
        }

        // Date Check
        if (tx.paymentDate) {
          const payDate = new Date(tx.paymentDate);
          const today = new Date();
          if (payDate > today) {
            addIssue(8, 'transaction.paymentDate', 'Payment Date cannot be in the future.', true);
          }
          if (state.ownershipHistory.parentDocDate) {
            const pDate = new Date(state.ownershipHistory.parentDocDate);
            if (pDate > payDate) {
              addIssue(8, 'transaction.paymentDate', 'Current Deed Date / Payment Date must be after the Parent Deed Registration Date.', true);
            }
          }
        }

        if (tx.ecDate) {
          const ecD = new Date(tx.ecDate);
          const today = new Date();
          if (ecD > today) {
            addIssue(8, 'transaction.ecDate', 'EC validity check date cannot be in the future.', true);
          }
        }
      }

      if (s === 9) {
        if (state.witnesses.length < 2) {
          addIssue(9, 'witnesses_length', 'At least two witnesses are legally required for sub-registration!');
        }
        state.witnesses.forEach((witness, idx) => {
          const prefix = `witnesses.${idx}`;
          if (!witness.name?.trim()) addIssue(9, `${prefix}.name`, 'Witness Name is required');
          if (!witness.fatherName?.trim()) addIssue(9, `${prefix}.fatherName`, 'Witness Father Name is required');
          if (!witness.age || witness.age < 18) addIssue(9, `${prefix}.age`, 'Witness must be 18+ years old');
          if (!witness.address?.trim()) addIssue(9, `${prefix}.address`, 'Witness Address is required');
          
          if (witness.phone?.trim() && !/^[6-9][0-9]{9}$/.test(witness.phone)) {
            addIssue(9, `${prefix}.phone`, 'Witness mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.', true);
          }

          // Pure Witness Aadhaar Validation (NEVER mutates witness.aadhaar or form values)
          if (witness.aadhaar?.trim()) {
            const aadhaarCheck = validateAadhaarPure(witness.aadhaar);
            if (!aadhaarCheck.valid) {
              addIssue(
                9,
                `${prefix}.aadhaar`,
                aadhaarCheck.reason === 'placeholder'
                  ? 'Witness Aadhaar cannot be a placeholder number'
                  : 'Witness Aadhaar must be 12 digits or XXXX-XXXX-1234'
              );
            }
          }
        });
      }
    });

    setErrors(newErrors);
    setWarnings(newWarnings);

    if (!isFinal) {
      return Object.keys(newErrors).length === 0;
    } else {
      const totalProblems = Object.keys(newErrors).length + Object.keys(newWarnings).length;
      if (totalProblems > 0) {
        const finalErrors = { ...newErrors, ...newWarnings };
        setErrors(finalErrors);
        return false;
      }
      return true;
    }
  };

  const handleNext = () => {
    if (activeStep === 11) {
      if (validateStep(activeStep, true)) {
        setErrors({});
        setWarnings({});
        setWizardNotice(null);
        setActiveStep(12);
      } else {
        setWizardNotice({
          type: 'error',
          message: 'Please resolve all strict compliance errors before proceeding to final Deed360 generation.'
        });
      }
    } else {
      if (validateStep(activeStep, false)) {
        setErrors({});
        setWarnings({});
        setWizardNotice(null);
        setActiveStep(prev => Math.min(12, prev + 1));
      } else {
        setWizardNotice({
          type: 'error',
          message: 'Please resolve the highlighted validation errors on this step before proceeding.'
        });
      }
    }
  };

  const handlePrev = () => {
    setErrors({});
    setWarnings({});
    setWizardNotice(null);
    setActiveStep(prev => Math.max(1, prev - 1));
  };

  const handleSaveDraft = async () => {
    await saveDraftManual();
  };

  const handleResumeLater = async () => {
    await saveDraftManual();
    setActiveTab('documents');
  };

  const handleAiAutofill = (extractedData: any) => {
    setState((prev) => {
      const nextState = {
        ...prev,
        parties: extractedData.parties ? [
          extractedData.parties[0],
          prev.parties[1]
        ] : prev.parties,
        property: {
          ...prev.property,
          district: extractedData.property.district || prev.property.district,
          taluk: extractedData.property.taluk || prev.property.taluk,
          village: extractedData.property.village || prev.property.village,
          sro: extractedData.property.sro || prev.property.sro
        },
        survey: {
          ...prev.survey,
          surveyNo: extractedData.property.surveyNo || prev.survey.surveyNo,
          subDivision: extractedData.property.subDivision || prev.survey.subDivision,
          pattaNo: extractedData.property.pattaNo || prev.survey.pattaNo
        },
        surveys: [
          {
            surveyNo: extractedData.property.surveyNo || prev.survey.surveyNo,
            subDivision: extractedData.property.subDivision || prev.survey.subDivision,
            pattaNo: extractedData.property.pattaNo || prev.survey.pattaNo,
            tslrNo: prev.survey.tslrNo,
            chittaRef: 'CH-2026-EXTRACTED'
          }
        ],
        boundary: {
          ...prev.boundary,
          east: extractedData.boundaries.east || prev.boundary.east,
          west: extractedData.boundaries.west || prev.boundary.west,
          north: extractedData.boundaries.north || prev.boundary.north,
          south: extractedData.boundaries.south || prev.boundary.south
        }
      };
      return nextState;
    });
    setShowAiDrawer(false);
  };

  const handleAddAiClause = (newClause: any) => {
    setState((prev) => ({
      ...prev,
      selectedClauses: [...prev.selectedClauses, newClause.id]
    }));
  };

  const completionPercentage = calculateProgress(state);

  // Sync state.surveys?.[0] with legacy state.survey so preview panel works correctly
  const updateSurveysState = (newSurveys: SurveyDetails[]) => {
    if (isLocked) {
      setWizardNotice({
        type: 'warning',
        message: 'This document is finalized and locked. Create a formal revision to make edits.'
      });
      return;
    }
    setState(prev => ({
      ...prev,
      surveys: newSurveys,
      survey: newSurveys[0] || prev.survey
    }));
  };

  return (
    <div className="flex flex-col xl:flex-row h-full overflow-hidden gap-6">
      
      {/* LEFT FORM PANE */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col h-[750px] overflow-hidden shadow-sm text-left">
        
        {/* Wizard Header and Progress Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Tamil Nadu Deed Drafting Wizard</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {autosaveStatus === 'Saved on this device' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Saved on this device</span>
                  <button
                    type="button"
                    onClick={() => retrySyncDraft(currentDraft.id)}
                    className="ml-1 underline hover:text-amber-950 font-extrabold"
                  >
                    Sync Now
                  </button>
                </span>
              )}
              {autosaveStatus === 'Syncing' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Syncing</span>
                </span>
              )}
              {autosaveStatus === 'Saved on server' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Saved on server</span>
                </span>
              )}
              {autosaveStatus === 'Save failed' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Save failed</span>
                  <button
                    type="button"
                    onClick={() => retrySyncDraft(currentDraft.id)}
                    className="ml-1 underline hover:text-rose-950 font-extrabold"
                  >
                    Retry
                  </button>
                </span>
              )}
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded">
                REF: {currentDraft.docNo} {currentDraft.revision ? `(REV ${currentDraft.revision})` : ''}
              </span>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                {completionPercentage}% COMPLETED
              </span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#c49a36] h-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Stepper buttons scrollable */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-1">
            {stepsList.map((step) => {
              const isCurrent = step.num === activeStep;
              const isCompleted = step.num < activeStep;
              return (
                <button
                  key={step.num}
                  onClick={() => {
                    if (step.num === 12) {
                      if (validateStep(activeStep, true)) {
                        setErrors({});
                        setWarnings({});
                        setWizardNotice(null);
                        setActiveStep(12);
                      } else {
                        setWizardNotice({
                          type: 'error',
                          message: 'Please resolve all strict compliance errors before final Deed360 generation.'
                        });
                      }
                    } else if (validateStep(activeStep, false)) {
                      setErrors({});
                      setWarnings({});
                      setWizardNotice(null);
                      setActiveStep(step.num);
                    } else {
                      if (step.num < activeStep) {
                        setErrors({});
                        setWarnings({});
                        setWizardNotice(null);
                        setActiveStep(step.num);
                      } else {
                        setWizardNotice({
                          type: 'error',
                          message: 'Please correct validation errors on current step before proceeding.'
                        });
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 focus:outline-none group shrink-0"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                    isCurrent ? 'bg-[#c49a36] border-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-600/10' :
                    isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                    'bg-white border-slate-200 text-slate-400 group-hover:border-slate-300'
                  }`}>
                    {isCompleted ? <Check className="h-3 w-3" /> : step.num}
                  </div>
                  <span className={`text-[10px] uppercase font-bold tracking-wider transition ${
                    isCurrent ? 'text-slate-800 font-extrabold' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {step.name}
                  </span>
                  {step.num < 12 && <span className="h-px w-4 bg-slate-200" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Step Content container */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          
          {/* Header Action inside form */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs uppercase font-extrabold text-slate-500 tracking-wider">
              Step {activeStep} of 12: {stepsList[activeStep - 1].name}
            </span>
            <button
              onClick={() => setShowAiDrawer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-teal-400 rounded transition"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>LAUNCH AI ASSISTANT</span>
            </button>
          </div>

          {/* Save Failed / Unsynced Retry Banner */}
          {autosaveStatus === 'Save failed' && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold uppercase tracking-tight">Save Failed — Changes Retained on This Device</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    {lastSaveError || 'Could not reach server. Your changes are safely stored on this device.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => retrySyncDraft(currentDraft.id)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold rounded-lg shrink-0 transition"
              >
                Retry Sync
              </button>
            </div>
          )}

          {/* Optimistic Concurrency Version Conflict Banner */}
          {versionConflict && versionConflict.draftId === currentDraft.id && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold uppercase tracking-tight">Version Conflict Detected (Simultaneous Edit)</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {versionConflict.message} Your local edits have been preserved on this device. Choose how to resolve this conflict:
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => resolveVersionConflict('keep-local')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold rounded-lg transition"
                >
                  Keep My Changes & Save as Latest Revision
                </button>
                {versionConflict.serverDocument && (
                  <button
                    type="button"
                    onClick={() => resolveVersionConflict('use-server')}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-extrabold rounded-lg transition"
                  >
                    Reload Server Version (Rev {versionConflict.currentRevision})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Possible Survey Conflict Requiring Transaction-History Review Banner */}
          {surveyConflictReview && surveyConflictReview.draftId === currentDraft.id && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold uppercase tracking-tight">Possible Survey Conflict — Transaction History Review Required</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {surveyConflictReview.message}
                  </p>
                  {surveyConflictReview.conflicts.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-900 pt-1">
                      {surveyConflictReview.conflicts.map((c, idx) => (
                        <li key={idx}>
                          <strong>Survey {c.surveyNo}/{c.subDivision}</strong> ({c.village}, {c.taluk} Taluk, {c.district}) — Prior {c.docType} <strong>{c.docNo}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    dismissSurveyConflictReview();
                    setActiveStep(7);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-extrabold rounded-lg transition"
                >
                  Link Parent Document in Step 7
                </button>
                <button
                  type="button"
                  onClick={() => acknowledgeSurveyConflictAndFinalize('Reviewed prior transaction history and confirmed valid subsequent transaction.')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-extrabold rounded-lg transition"
                >
                  Acknowledge Transaction History & Finalize
                </button>
                <button
                  type="button"
                  onClick={dismissSurveyConflictReview}
                  className="px-2.5 py-1.5 text-amber-700 hover:text-amber-950 text-[11px] font-bold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Wizard In-App Notice Banner */}
          {wizardNotice && (
            <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
              wizardNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : wizardNotice.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <span className="font-bold">{wizardNotice.message}</span>
              <button
                type="button"
                onClick={() => setWizardNotice(null)}
                className="text-[10px] font-extrabold underline ml-3"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Locked Read-Only Banner */}
          {isLocked && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-800 flex-wrap">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold uppercase tracking-tight">This Deed is Finalized & Locked (v{currentDraft.version || 1})</p>
                  <p className="text-[11px] text-red-700 mt-1">
                    Finalized records are protected against ordinary edits or deletion. Create a formal revision to make corrections while preserving revision history.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => createDraftRevision(currentDraft.id, `Formal revision created from ${currentDraft.docNo}`)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-extrabold rounded-lg shrink-0 transition"
              >
                Create New Revision
              </button>
            </div>
          )}

          {/* Validation Errors Header Warning */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold uppercase tracking-tight">Form Validation Warnings Identified</p>
                <p className="text-[11px] text-rose-700 mt-0.5">Please fill in all mandatory fields highlighted in red to ensure Deed360 registration compliance.</p>
              </div>
            </div>
          )}

          {/* Compliance Alerts Header Warning (Non-blocking Soft warnings) */}
          {Object.keys(warnings).length > 0 && Object.keys(errors).length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold uppercase tracking-tight">Deed360 Compliance Alerts (Non-blocking)</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-amber-700 font-medium">
                  {Object.entries(warnings).map(([key, msg]) => (
                    <li key={key}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* STEP 1: DOCUMENT TYPE */}
          {activeStep === 1 && (
            <Step1DocType 
              documentType={state.documentType} 
              onChange={(val) => {
                const canonicalCode = normalizeDeedCode(val) || val;
                const nextDef = resolveDeedType(canonicalCode);
                const updatedParties = nextDef && state.parties.length >= 2
                  ? state.parties.map((p, idx) => {
                      if (idx === 0) return { ...p, role: nextDef.grantorRole };
                      if (idx === 1) return { ...p, role: nextDef.granteeRole };
                      return p;
                    })
                  : state.parties;
                const updatedTx = nextDef && !nextDef.requiresMonetaryConsideration
                  ? { ...state.transaction, considerationAmount: 0, advancePaid: 0, balancePaid: 0 }
                  : state.transaction;
                setState({
                  ...state,
                  documentType: canonicalCode,
                  parties: updatedParties,
                  transaction: updatedTx
                });
              }} 
            />
          )}

          {/* STEP 2: PARTIES */}
          {activeStep === 2 && (
            <Step2Parties 
              parties={state.parties} 
              onChange={(parties) => setState({ ...state, parties })} 
              errors={errors}
              documentType={state.documentType}
            />
          )}

          {/* STEP 3: PROPERTY DETAILS */}
          {activeStep === 3 && (
            <Step3Property 
              property={state.property} 
              onChange={(property) => setState({ ...state, property })} 
              errors={errors}
            />
          )}

          {/* STEP 4: SURVEY DETAILS */}
          {activeStep === 4 && (
            <Step4Survey 
              surveys={state.surveys || [state.survey]} 
              onChange={updateSurveysState} 
              errors={errors}
            />
          )}

          {/* STEP 5: MEASUREMENT */}
          {activeStep === 5 && (
            <Step5Measurement 
              extent={state.extent} 
              onChange={(extent) => setState({ ...state, extent })} 
              errors={errors}
            />
          )}

          {/* STEP 6: BOUNDARY DETAILS */}
          {activeStep === 6 && (
            <Step6Boundary 
              boundary={state.boundary} 
              onChange={(boundary) => setState({ ...state, boundary })} 
              errors={errors}
            />
          )}

          {/* STEP 7: OWNERSHIP HISTORY */}
          {activeStep === 7 && (
            <Step7History 
              history={state.ownershipHistory} 
              onChange={(history) => setState({ ...state, ownershipHistory: history })} 
              errors={errors}
            />
          )}

          {/* STEP 8: TRANSACTION DETAILS */}
          {activeStep === 8 && (
            <Step8Transaction 
              transaction={state.transaction} 
              onChange={(transaction) => setState({ ...state, transaction })} 
              errors={errors}
              documentType={state.documentType}
            />
          )}

          {/* STEP 9: WITNESS DETAILS */}
          {activeStep === 9 && (
            <Step9Witnesses 
              witnesses={state.witnesses} 
              onChange={(witnesses) => setState({ ...state, witnesses })} 
              errors={errors}
            />
          )}

          {/* STEP 10: CLAUSE SELECTION */}
          {activeStep === 10 && (
            <Step10Clauses 
              selectedClauses={state.selectedClauses} 
              onChange={(selectedClauses) => setState({ ...state, selectedClauses })} 
            />
          )}

          {/* STEP 11: REVIEW PAGE */}
          {activeStep === 11 && (
            <Step11Review 
              state={state} 
              onJumpToStep={(step) => {
                setErrors({});
                setActiveStep(step);
              }} 
            />
          )}

          {/* STEP 12: DOCUMENT GENERATION PLACEHOLDER */}
          {activeStep === 12 && (
            <Step12Generate state={state} />
          )}

        </div>

        {/* Form control bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={activeStep === 1}
              className="flex items-center gap-1 px-3 py-2 border border-slate-250 bg-white text-slate-600 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            
            <button
              onClick={handleSaveDraft}
              className="text-[11px] font-extrabold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg border border-slate-200 transition"
            >
              Save Draft
            </button>

            <button
              onClick={handleResumeLater}
              className="text-[11px] font-extrabold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg border border-slate-200 transition"
            >
              Resume Later
            </button>
          </div>

          <span className="text-xs text-slate-400 font-bold font-mono">
            Step {activeStep} / 12
          </span>

          <button
            onClick={handleNext}
            disabled={activeStep === 12}
            className="flex items-center gap-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* RIGHT PREVIEW PANE */}
      <div className="flex-1 min-w-[320px] max-w-[800px] h-[750px] flex flex-col gap-3">
        {/* Tab switcher for Preview vs AI Insights */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-1.5 rounded-xl shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setRightPaneTab('preview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                rightPaneTab === 'preview' 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Live Document Proof</span>
            </button>
            <button
              onClick={() => setRightPaneTab('ai')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1.5 relative ${
                rightPaneTab === 'ai' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>AI Validation & Risk Insights</span>
              {/* Optional glowing dot indicating warnings */}
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping absolute top-1 right-1" />
            </button>
            <button
              onClick={() => setRightPaneTab('trust')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                rightPaneTab === 'trust' 
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Trust & Verification</span>
            </button>
          </div>

          <button
            onClick={() => setShowAiDrawer(true)}
            className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition"
          >
            Launch Co-pilot
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {rightPaneTab === 'preview' && (
            <DocumentPreview state={state} activeStep={activeStep} />
          )}
          {rightPaneTab === 'ai' && (
            <AIInsightsDashboard 
              state={state} 
              onAddClause={(clause) => {
                if (state.selectedClauses && !state.selectedClauses.includes(clause.id)) {
                  setState(prev => ({
                    ...prev,
                    selectedClauses: [...prev.selectedClauses, clause.id]
                  }));
                }
              }} 
              onJumpToStep={(step) => {
                setErrors({});
                setActiveStep(step);
              }}
            />
          )}
          {rightPaneTab === 'trust' && (
            <TrustVerificationDashboard 
              state={state} 
              onJumpToStep={(step) => {
                setErrors({});
                setActiveStep(step);
              }}
            />
          )}
        </div>
      </div>

      {/* AI SIDE DRAWER */}
      {showAiDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-850 flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-200 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">AI Registry Co-pilot</span>
              <button 
                onClick={() => setShowAiDrawer(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-100"
              >
                Close Drawer
              </button>
            </div>
            
            <AIPlayground 
              state={state} 
              onAutofill={handleAiAutofill} 
              onAddClause={handleAddAiClause} 
            />
          </div>
        </div>
      )}

    </div>
  );
}
