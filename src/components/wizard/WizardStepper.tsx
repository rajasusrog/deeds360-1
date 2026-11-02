import { useState } from 'react';
import { 
  Scale, 
  Users, 
  Building, 
  Navigation, 
  Ruler, 
  Compass, 
  History, 
  CreditCard, 
  UserCheck, 
  FileText, 
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  Sparkles,
  AlertTriangle,
  Lock,
  Check
} from 'lucide-react';
import { DeedWizardState, SurveyDetails } from '../../types';

// Import modular step components
import Step1DocType from './Step1DocType';
import Step2Parties from './Step2Parties';
import Step3Property from './Step3Property';
import Step4Survey from './Step4Survey';
import Step5Extent from './Step5Extent';
import Step6Boundary from './Step6Boundary';
import Step7History from './Step7History';
import Step8Transaction from './Step8Transaction';
import Step9Witnesses from './Step9Witnesses';
import Step10Clauses from './Step10Clauses';
import Step11ReviewGenerate from './Step11ReviewGenerate';

export interface WizardStepperProps {
  initialStep?: number;
  state: DeedWizardState;
  onChange: (newState: DeedWizardState) => void;
  onSaveDraft?: () => void;
  onLaunchAi?: () => void;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  isLocked?: boolean;
  docNo?: string;
  completionPercentage?: number;
}

export const WIZARD_STEPS = [
  { num: 1, id: 'doctype', label: 'Document Type', icon: Scale, shortName: 'Doc Type' },
  { num: 2, id: 'parties', label: 'Party Details', icon: Users, shortName: 'Parties' },
  { num: 3, id: 'property', label: 'Property Details', icon: Building, shortName: 'Property' },
  { num: 4, id: 'survey', label: 'Survey Details', icon: Navigation, shortName: 'Survey' },
  { num: 5, id: 'extent', label: 'Extent', icon: Ruler, shortName: 'Extent' },
  { num: 6, id: 'boundary', label: 'Boundary', icon: Compass, shortName: 'Boundary' },
  { num: 7, id: 'history', label: 'Ownership History', icon: History, shortName: 'History' },
  { num: 8, id: 'transaction', label: 'Transaction Details', icon: CreditCard, shortName: 'Transaction' },
  { num: 9, id: 'witnesses', label: 'Witnesses', icon: UserCheck, shortName: 'Witnesses' },
  { num: 10, id: 'clauses', label: 'Clauses', icon: FileText, shortName: 'Clauses' },
  { num: 11, id: 'review_generate', label: 'Review + Generate', icon: CheckCircle, shortName: 'Review & Generate' }
];

export default function WizardStepper({
  initialStep = 1,
  state,
  onChange,
  onSaveDraft,
  onLaunchAi,
  errors = {},
  warnings = {},
  isLocked = false,
  docNo,
  completionPercentage = 0
}: WizardStepperProps) {
  const [activeStep, setActiveStep] = useState<number>(initialStep);

  const currentStepMeta = WIZARD_STEPS.find(s => s.num === activeStep) || WIZARD_STEPS[0];

  const handleStepClick = (stepNum: number) => {
    setActiveStep(stepNum);
  };

  const nextStep = () => {
    if (activeStep < WIZARD_STEPS.length) {
      setActiveStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (activeStep > 1) {
      setActiveStep(prev => prev - 1);
    }
  };

  const updateSurveysState = (surveys: SurveyDetails[]) => {
    onChange({
      ...state,
      surveys,
      survey: surveys[0] || state.survey
    });
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm text-left" id="wizard-stepper-root">
      
      {/* STEPPER HEADER & PROGRESS TRAIL */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 space-y-3">
        
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider">
              UNIKORN360 DEEDOS — Document Creation Wizard
            </h2>
            {docNo && (
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded border border-slate-300/40">
                {docNo}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              {completionPercentage}% COMPLETED
            </span>
            {onLaunchAi && (
              <button
                type="button"
                onClick={onLaunchAi}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-teal-300 rounded transition"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>AI Assist</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Progress Line */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[#c49a36] h-full transition-all duration-300"
            style={{ width: `${Math.max(completionPercentage, (activeStep / WIZARD_STEPS.length) * 100)}%` }}
          />
        </div>

        {/* Responsive Scrollable Stepper Navigation Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          {WIZARD_STEPS.map((step) => {
            const isCurrent = step.num === activeStep;
            const isCompleted = step.num < activeStep;
            const IconComponent = step.icon;

            return (
              <button
                key={step.num}
                type="button"
                onClick={() => handleStepClick(step.num)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition text-[10px] font-bold shrink-0 ${
                  isCurrent 
                    ? 'bg-[#c49a36] border-emerald-600 text-white shadow-sm' 
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${
                  isCurrent ? 'bg-white text-emerald-700' : isCompleted ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {isCompleted ? <Check className="h-2.5 w-2.5 text-emerald-800" /> : step.num}
                </div>
                <IconComponent className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap uppercase tracking-wider">{step.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP CONTENT BODY CONTAINER */}
      <div className="p-6 space-y-5 overflow-y-auto flex-1 max-h-[620px]">
        
        {/* Step Banner */}
        <div className="flex items-center justify-between border-b border-slate-150 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              {activeStep}
            </span>
            <div>
              <span className="text-xs uppercase font-extrabold text-slate-800 tracking-wider">
                Step {activeStep} of 11: {currentStepMeta.label}
              </span>
              <p className="text-[11px] text-slate-400 font-medium">
                Deed360 Tamil Nadu Legal Registration Standard
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-400">
            Step {activeStep} / 11
          </div>
        </div>

        {/* Read-Only Locked Warning */}
        {isLocked && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
            <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase tracking-tight">Read-Only Finalized State</p>
              <p className="text-[11px] text-red-700">This document is locked in a finalized state. Unlock or create revision to modify fields.</p>
            </div>
          </div>
        )}

        {/* Validation Errors Header */}
        {Object.keys(errors).length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase tracking-tight">Validation Warnings Identified</p>
              <p className="text-[11px] text-rose-700">Please complete all highlighted mandatory fields to ensure compliance.</p>
            </div>
          </div>
        )}

        {/* Non-blocking Compliance Warnings */}
        {Object.keys(warnings).length > 0 && Object.keys(errors).length === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold uppercase tracking-tight">Compliance Alerts (Non-blocking)</p>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[11px] text-amber-700 font-medium">
                {Object.entries(warnings).map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* MODULAR STEP COMPONENTS MOUNTING */}

        {/* STEP 1: DOCUMENT TYPE */}
        {activeStep === 1 && (
          <Step1DocType 
            documentType={state.documentType} 
            onChange={(val) => onChange({ ...state, documentType: val })} 
          />
        )}

        {/* STEP 2: PARTY DETAILS */}
        {activeStep === 2 && (
          <Step2Parties 
            parties={state.parties} 
            onChange={(parties) => onChange({ ...state, parties })} 
            errors={errors}
          />
        )}

        {/* STEP 3: PROPERTY DETAILS */}
        {activeStep === 3 && (
          <Step3Property 
            property={state.property} 
            onChange={(property) => onChange({ ...state, property })} 
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

        {/* STEP 5: EXTENT */}
        {activeStep === 5 && (
          <Step5Extent 
            extent={state.extent} 
            onChange={(extent) => onChange({ ...state, extent })} 
            errors={errors}
          />
        )}

        {/* STEP 6: BOUNDARY */}
        {activeStep === 6 && (
          <Step6Boundary 
            boundary={state.boundary} 
            onChange={(boundary) => onChange({ ...state, boundary })} 
            errors={errors}
          />
        )}

        {/* STEP 7: OWNERSHIP HISTORY */}
        {activeStep === 7 && (
          <Step7History 
            history={state.ownershipHistory} 
            onChange={(history) => onChange({ ...state, ownershipHistory: history })} 
            errors={errors}
          />
        )}

        {/* STEP 8: TRANSACTION DETAILS */}
        {activeStep === 8 && (
          <Step8Transaction 
            transaction={state.transaction} 
            onChange={(transaction) => onChange({ ...state, transaction })} 
            errors={errors}
          />
        )}

        {/* STEP 9: WITNESSES */}
        {activeStep === 9 && (
          <Step9Witnesses 
            witnesses={state.witnesses} 
            onChange={(witnesses) => onChange({ ...state, witnesses })} 
            errors={errors}
          />
        )}

        {/* STEP 10: CLAUSES */}
        {activeStep === 10 && (
          <Step10Clauses 
            selectedClauses={state.selectedClauses} 
            onChange={(selectedClauses) => onChange({ ...state, selectedClauses })} 
          />
        )}

        {/* STEP 11: REVIEW + GENERATE */}
        {activeStep === 11 && (
          <Step11ReviewGenerate 
            state={state} 
            onJumpToStep={(step) => setActiveStep(step)} 
          />
        )}
      </div>

      {/* STEPPER FOOTER NAVIGATION TOOLBAR */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        
        {/* Left Action: Save Draft */}
        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition shadow-xs"
            >
              <Save className="h-3.5 w-3.5 text-slate-500" />
              <span>Save Draft</span>
            </button>
          )}
        </div>

        {/* Right Actions: Prev & Next */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevStep}
            disabled={activeStep === 1}
            className={`flex items-center gap-1 px-3.5 py-1.5 border text-xs font-bold rounded-lg transition ${
              activeStep === 1
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous Step</span>
          </button>

          {activeStep < WIZARD_STEPS.length ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-1 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition shadow-sm"
            >
              <span>Next Step</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>Wizard Complete</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
