import { useState } from 'react';
import { 
  AlertTriangle,
  History,
  CheckCircle2,
  GitBranch
} from 'lucide-react';
import { DeedWizardState } from '../../types';
import { useApp } from '../../context/AppContext';
import { runAiValidation } from '../../utils/aiValidator';
import { calculateTrustScore } from '../../utils/verificationService';
import { isDeedTemplateAvailable, resolveDeedType, validateDeedStateByType } from '../../utils/deedTypes';
import LegalPrintEngine from '../LegalPrintEngine';

interface Step12GenerateProps {
  state: DeedWizardState;
}

export default function Step12Generate({ state }: Step12GenerateProps) {
  const { 
    currentDraft, 
    updateDraftStatus, 
    createDraftRevision,
    calculateProgress,
    lastSaveError,
    surveyConflictReview,
    acknowledgeSurveyConflictAndFinalize,
    dismissSurveyConflictReview
  } = useApp();

  const [exportError, setExportError] = useState<string | null>(null);
  const [warningOverrideConfirmed, setWarningOverrideConfirmed] = useState(false);
  const [pendingWarningPrompt, setPendingWarningPrompt] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState('Correction / amendment to finalized deed');
  const [showRevisionPrompt, setShowRevisionPrompt] = useState(false);
  const [conflictNotes, setConflictNotes] = useState(
    state.conflictReviewNotes || 'Reviewed prior transaction history and verified lawful chain of title.'
  );

  const docNo = currentDraft?.docNo || 'DEED/2026/0142';
  const progress = currentDraft ? calculateProgress(state) : 0;
  const isComplete = progress >= 90;
  const docStatus = currentDraft?.status || 'Draft';
  const isLocked = docStatus === 'Finalized' || docStatus === 'Exported' || docStatus === 'Archived';

  const deedDef = resolveDeedType(state.documentType);
  const templateAvailable = isDeedTemplateAvailable(state.documentType);

  const handleFinalizeDocument = async (forceOverride = false) => {
    if (!currentDraft) return;

    if (!templateAvailable) {
      const msg = `Template unavailable for "${deedDef?.nameEn || state.documentType || 'Unknown'}". Finalization and export are blocked.`;
      setExportError(msg);
      return;
    }

    const typeErrors = validateDeedStateByType(state);
    if (typeErrors.length > 0) {
      setExportError(`Deed validation blocked finalization: ${typeErrors[0]}`);
      return;
    }

    if (!isComplete) {
      setExportError("Compliance block: Cannot finalize document. Mandatory details must be completed first.");
      return;
    }

    // Validation Gate Integration
    const validation = runAiValidation(state);
    const criticals = validation.warnings.filter(w => w.severity === 'error');
    const warningsList = validation.warnings.filter(w => w.severity === 'warning');

    if (criticals.length > 0) {
      const errorMsg = `Validation Block: "${criticals[0].message}" (Step ${criticals[0].step}, ${criticals[0].field}). Please correct all critical errors before locking the draft.`;
      setExportError(errorMsg);
      return;
    }

    const trustResult = calculateTrustScore(state);
    if (trustResult.trustBand === 'High Risk') {
      const errorMsg = `Trust Verification Gate Blocked: Trust Score is ${trustResult.trustScore} (${trustResult.trustBand}). High-risk validation issues must be resolved before locking the draft.`;
      setExportError(errorMsg);
      return;
    }

    if (!forceOverride && !warningOverrideConfirmed && (warningsList.length > 0 || trustResult.trustBand === 'Suspicious')) {
      const warnSummary = warningsList.length > 0
        ? `${warningsList.length} compliance warning(s) detected (e.g., "${warningsList[0].message}").`
        : `Draft is flagged as SUSPICIOUS (Trust Score: ${trustResult.trustScore}/100).`;
      setPendingWarningPrompt(warnSummary);
      return;
    }

    setPendingWarningPrompt(null);
    setExportError(null);
    const ok = await updateDraftStatus(currentDraft.id, 'Finalized');
    if (!ok) {
      setExportError('Server rejected finalization. Please review any validation or survey conflict alerts above.');
    }
  };

  const handleCreateNewRevision = async () => {
    if (!currentDraft) return;
    if (!showRevisionPrompt) {
      setShowRevisionPrompt(true);
      return;
    }
    setExportError(null);
    const ok = await createDraftRevision(currentDraft.id, revisionReason);
    if (ok) {
      setShowRevisionPrompt(false);
    } else {
      setExportError('Failed to create a new revision on the server.');
    }
  };

  const revisionHistory = currentDraft?.revisionHistory || state.revisionHistory || [];

  return (
    <div className="p-6 text-left space-y-6 text-slate-800 font-sans" id="step-12-generate-panel">
      
      {!templateAvailable && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-tight">Template unavailable</p>
            <p className="mt-1 font-medium text-rose-700">
              Document type &ldquo;{deedDef?.nameEn || state.documentType || 'Unknown'}&rdquo; does not have an implemented template. Compilation, finalization, printing, and export are blocked.
            </p>
          </div>
        </div>
      )}

      {(exportError || lastSaveError) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-tight">Draft Finalization / Sync Alert</p>
            <p className="mt-1 font-medium text-rose-700">{exportError || lastSaveError}</p>
          </div>
        </div>
      )}

      {pendingWarningPrompt && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div>
            <p className="font-extrabold uppercase tracking-tight">Compliance Warning Review Required</p>
            <p className="mt-1 text-amber-800">{pendingWarningPrompt} Confirm manual review to proceed with finalization.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setWarningOverrideConfirmed(true);
                handleFinalizeDocument(true);
              }}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition"
            >
              Confirm & Finalize
            </button>
            <button
              type="button"
              onClick={() => setPendingWarningPrompt(null)}
              className="px-2.5 py-1.5 bg-white border border-amber-300 text-amber-800 font-bold rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {surveyConflictReview && currentDraft && surveyConflictReview.draftId === currentDraft.id && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs text-amber-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold uppercase tracking-tight">Possible Survey Overlap — Transaction History Review Required</p>
              <p className="mt-1 text-amber-800">{surveyConflictReview.message}</p>
            </div>
            <button
              type="button"
              onClick={dismissSurveyConflictReview}
              className="px-2 py-1 bg-white border border-amber-200 rounded text-[10px] font-bold text-amber-700"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <input
              type="text"
              value={conflictNotes}
              onChange={(e) => setConflictNotes(e.target.value)}
              placeholder="Document chain-of-title review notes..."
              className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            />
            <button
              type="button"
              onClick={() => acknowledgeSurveyConflictAndFinalize(currentDraft.id, conflictNotes)}
              className="px-3 py-1.5 bg-[#c49a36] hover:bg-[#b58a2b] text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Acknowledge Review & Finalize</span>
            </button>
          </div>
        </div>
      )}

      {showRevisionPrompt && isLocked && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3 text-xs text-indigo-950">
          <div className="flex items-center gap-2 font-extrabold uppercase tracking-tight text-indigo-900">
            <GitBranch className="h-4 w-4 text-indigo-600" />
            <span>Create Formal Revision of Finalized Deed</span>
          </div>
          <p className="text-[11px] text-indigo-800">
            Finalized records are immutable. Proceeding will archive <strong>{currentDraft?.docNo} (v{currentDraft?.version || 1})</strong> in revision history, increment the version, and unlock the new revision in <strong>Draft</strong> status.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Reason for revision..."
              className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            />
            <button
              type="button"
              onClick={handleCreateNewRevision}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition"
            >
              Confirm New Revision
            </button>
            <button
              type="button"
              onClick={() => setShowRevisionPrompt(false)}
              className="px-2.5 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {revisionHistory.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold uppercase tracking-wider text-[10px] text-slate-600 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-indigo-600" />
              Preserved Revision History ({revisionHistory.length} prior version{revisionHistory.length === 1 ? '' : 's'})
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Active Version: v{currentDraft?.version || state.version || 1} ({docNo})
            </span>
          </div>
          <div className="divide-y divide-slate-200/70">
            {revisionHistory.map((rev, idx) => (
              <div key={idx} className="py-1.5 flex items-center justify-between text-[11px] text-slate-600">
                <div>
                  <span className="font-mono font-bold text-slate-800">{rev.docNo}</span>
                  <span className="ml-2 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-semibold">
                    v{rev.version} • {rev.status}
                  </span>
                  {rev.notes && <span className="ml-2 text-slate-500 italic">— {rev.notes}</span>}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(rev.modifiedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
        <strong>Statutory Notice:</strong> Finalizing a deed in this application locks the draft record for printing and export. App finalization is <strong>not</strong> government registration under the Registration Act, 1908; legal registration occurs only upon physical execution and presentation before the jurisdictional Sub-Registrar Office (SRO).
      </div>

      <LegalPrintEngine
        state={state}
        currentDraft={currentDraft}
        onFinalize={() => handleFinalizeDocument(false)}
        onNewRevision={handleCreateNewRevision}
        isLocked={isLocked}
      />

    </div>
  );
}

