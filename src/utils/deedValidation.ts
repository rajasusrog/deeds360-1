import { DeedWizardState, DraftStatus, SurveyDetails } from '../types';
import {
  resolveDeedType,
  isDeedTemplateAvailable,
  partitionPartiesForDeedType,
} from './deedTypes';

export const VALID_DRAFT_STATUSES: readonly DraftStatus[] = [
  'Draft',
  'In Progress',
  'Pending Review',
  'Review',
  'Approved',
  'Generated',
  'Finalized',
  'Exported',
  'Completed',
  'Archived',
] as const;

export function isValidDraftStatus(status: unknown): status is DraftStatus {
  return typeof status === 'string' && (VALID_DRAFT_STATUSES as readonly string[]).includes(status);
}

/**
 * Pure Aadhaar format validator.
 * NEVER mutates the input or parent object.
 * Accepts either 12 raw digits or masked format XXXX-XXXX-1234.
 */
export function validateAadhaarPure(rawAadhaar: unknown): {
  valid: boolean;
  reason?: 'missing' | 'format' | 'placeholder';
} {
  const value = String(rawAadhaar ?? '').trim();
  if (!value) {
    return { valid: false, reason: 'missing' };
  }

  const clean = value.replace(/[\s-]/g, '');
  const isMasked =
    /^(X|x|•){8}\d{4}$/.test(clean) ||
    /^(X|x|•){4}[-\s]?(X|x|•){4}[-\s]?\d{4}$/.test(value);

  if (isMasked) {
    const last4 = clean.slice(-4);
    if (last4 === '0000') {
      return { valid: false, reason: 'placeholder' };
    }
    return { valid: true };
  }

  const digits = clean;
  if (!/^\d{12}$/.test(digits)) {
    return { valid: false, reason: 'format' };
  }

  if (
    /^(\d)\1{11}$/.test(digits) ||
    digits === '123456789012' ||
    digits === '987654321098'
  ) {
    return { valid: false, reason: 'placeholder' };
  }

  return { valid: true };
}

/**
 * Pure helper to format an Aadhaar value for display/storage when explicitly requested
 * inside an input change handler (never inside validation).
 */
export function maskAadhaarValue(rawAadhaar: string): string {
  const trimmed = String(rawAadhaar || '').trim();
  if (/^XXXX-XXXX-\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/[\s-]/g, '');
  if (/^\d{12}$/.test(digits)) {
    return `XXXX-XXXX-${digits.slice(-4)}`;
  }
  return trimmed;
}

export function isRegistrationDistrictCompatible(
  district: string,
  registrationDistrict: string
): boolean {
  const d = String(district || '').trim().toLowerCase();
  const rd = String(registrationDistrict || '').trim().toLowerCase();
  if (!d || !rd) return true;
  if (rd.includes(d) || d.includes(rd)) return true;

  const metroGroup = ['chennai', 'chengalpattu', 'kanchipuram', 'tiruvallur', 'thiruvallur'];
  if (metroGroup.some((m) => d.includes(m)) && metroGroup.some((m) => rd.includes(m))) {
    return true;
  }
  return false;
}

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

/**
 * Pure, side-effect-free validation of DeedWizardState for a given step or final review.
 * Guarantees that `state` and all nested objects (`parties`, `witnesses`, `surveys`, etc.)
 * are NEVER mutated.
 */
export function validateDeedWizardStepPure(
  state: DeedWizardState | undefined | null,
  targetStep: number,
  isFinal = false
): StepValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!state || typeof state !== 'object') {
    return {
      valid: false,
      errors: ['Document state is missing or malformed.'],
      fieldErrors: { documentType: 'Document state is required' },
    };
  }

  // Step 1: Document Type & Template Availability
  if (targetStep === 1 || isFinal) {
    if (!state.documentType || !String(state.documentType).trim()) {
      errors.push('Document Type is required.');
      fieldErrors.documentType = 'Required';
    } else if (!isDeedTemplateAvailable(state.documentType)) {
      errors.push(
        `Template unavailable for "${state.documentType}". Generation and export are blocked for unsupported deed types.`
      );
      fieldErrors.documentType = 'Template unavailable';
    }
    const subType = (state as any).documentSubType || state.documentSubtype || (state as any).subType;
    if (!subType || !String(subType).trim()) {
      errors.push('Document Subtype is required.');
      fieldErrors.documentSubtype = 'Required';
    }
  }

  // Step 2: Party Details (100% pure — never mutates party.aadhaar)
  if (targetStep === 2 || isFinal) {
    const parties = Array.isArray(state.parties) ? state.parties : [];
    const executingParties = parties.filter((p) => p && p.role !== 'Witness');

    if (executingParties.length < 2) {
      errors.push('At least 2 executing parties are required for a legal deed.');
      fieldErrors.parties = 'Minimum 2 parties required';
    } else {
      const deedDef = resolveDeedType(state.documentType);
      const partitioned = partitionPartiesForDeedType(executingParties, state.documentType);
      if (partitioned.grantors.length === 0 || partitioned.grantees.length === 0) {
        const expectedRoles = deedDef
          ? `${deedDef.grantorLabelEn} (${deedDef.acceptedGrantorRoles.join('/')}) and ${deedDef.granteeLabelEn} (${deedDef.acceptedGranteeRoles.join('/')})`
          : 'both executing party sides';
        errors.push(`Must include valid party roles for ${expectedRoles}.`);
        fieldErrors.parties = 'Missing required party roles for selected deed type';
      }

      executingParties.forEach((p, idx) => {
        if (!String(p.name || '').trim() || String(p.name || '').trim().length < 2) {
          errors.push(`Party ${idx + 1}: Valid full name is required.`);
          fieldErrors[`party_${p.id}_name`] = 'Valid name required';
        }
        const relName = String(p.fatherName || (p as any).relationName || '').trim();
        if (!relName || relName.length < 2) {
          errors.push(`Party ${idx + 1}: Father/Husband name is required.`);
          fieldErrors[`party_${p.id}_fatherName`] = 'Required';
        }
        if (!p.age || Number(p.age) < 18 || Number(p.age) > 120) {
          errors.push(`Party ${idx + 1}: Age must be 18 or older.`);
          fieldErrors[`party_${p.id}_age`] = 'Must be 18+';
        }
        if (!String(p.address || '').trim() || String(p.address || '').trim().length < 10) {
          errors.push(`Party ${idx + 1}: Complete residential address is required.`);
          fieldErrors[`party_${p.id}_address`] = 'Complete address required';
        }

        const rawPhone = String(p.phone || p.mobile || '').replace(/[\s-]/g, '');
        if (!rawPhone) {
          errors.push(`Party ${idx + 1}: Mobile number is required.`);
          fieldErrors[`party_${p.id}_phone`] = 'Required';
        } else if (!/^[6-9]\d{9}$/.test(rawPhone)) {
          errors.push(`Party ${idx + 1}: Invalid 10-digit Indian mobile number.`);
          fieldErrors[`party_${p.id}_phone`] = 'Invalid 10-digit number';
        }

        const aadhaarCheck = validateAadhaarPure(p.aadhaar);
        if (!aadhaarCheck.valid) {
          if (aadhaarCheck.reason === 'missing') {
            errors.push(`Party ${idx + 1}: Aadhaar number is required.`);
            fieldErrors[`party_${p.id}_aadhaar`] = 'Required';
          } else if (aadhaarCheck.reason === 'placeholder') {
            errors.push(`Party ${idx + 1}: Placeholder or sequential Aadhaar number is not permitted.`);
            fieldErrors[`party_${p.id}_aadhaar`] = 'Invalid placeholder Aadhaar';
          } else {
            errors.push(`Party ${idx + 1}: Aadhaar must be 12 digits (or masked XXXX-XXXX-1234).`);
            fieldErrors[`party_${p.id}_aadhaar`] = 'Must be 12 digits';
          }
        }

        const rawPan = String(p.pan || '').trim().toUpperCase();
        const isMaskedPan = /^X{5}[0-9]{4}[A-Z]{1}$/.test(rawPan);
        const isFullPan = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(rawPan);
        if (!rawPan) {
          errors.push(`Party ${idx + 1}: PAN number is required.`);
          fieldErrors[`party_${p.id}_pan`] = 'Required';
        } else if (!isMaskedPan && !isFullPan) {
          errors.push(`Party ${idx + 1}: Invalid PAN format (e.g., ABCDE1234F).`);
          fieldErrors[`party_${p.id}_pan`] = 'Invalid PAN format';
        }
      });
    }
  }

  // Step 3: Property Location
  if (targetStep === 3 || isFinal) {
    const prop = state.property || ({} as DeedWizardState['property']);
    if (!String(prop.district || '').trim()) {
      errors.push('District is required.');
      fieldErrors.district = 'Required';
    }
    if (!String(prop.registrationDistrict || '').trim()) {
      errors.push('Registration District is required.');
      fieldErrors.registrationDistrict = 'Required';
    }
    if (!String(prop.taluk || '').trim()) {
      errors.push('Taluk is required.');
      fieldErrors.taluk = 'Required';
    }
    if (!String(prop.village || '').trim()) {
      errors.push('Village is required.');
      fieldErrors.village = 'Required';
    }
    if (!String(prop.sro || '').trim()) {
      errors.push('Sub-Registrar Office (SRO) is required.');
      fieldErrors.sro = 'Required';
    }
    if (!String(prop.doorNo || '').trim()) {
      errors.push('Property Address / Plot / Door No is required.');
      fieldErrors.doorNo = 'Required';
    }
    if (
      String(prop.district || '').trim() &&
      String(prop.registrationDistrict || '').trim() &&
      !isRegistrationDistrictCompatible(prop.district, prop.registrationDistrict)
    ) {
      errors.push(
        `Jurisdiction mismatch: Registration District (${prop.registrationDistrict}) does not match revenue District (${prop.district}).`
      );
      fieldErrors.registrationDistrict = 'Jurisdiction mismatch with District';
    }
  }

  // Step 4: Survey Details — check EVERY survey row
  if (targetStep === 4 || isFinal) {
    const surveyRows: SurveyDetails[] =
      Array.isArray(state.surveys) && state.surveys.length > 0
        ? state.surveys
        : state.survey
          ? [state.survey]
          : [];

    if (surveyRows.length === 0) {
      errors.push('At least one Survey entry is required.');
      fieldErrors.surveys = 'At least one survey row required';
    }

    const seenSurveyKeys = new Set<string>();
    surveyRows.forEach((s, idx) => {
      const surveyNo = String(s?.surveyNo || '').trim();
      const subDivision = String(s?.subDivision || '').trim();
      const pattaNo = String(s?.pattaNo || '').trim();
      const chittaRef = String(s?.chittaRef || '').trim();

      if (!surveyNo) {
        errors.push(`Survey Entry #${idx + 1}: Survey Number is required.`);
        fieldErrors[`survey_${idx}_surveyNo`] = 'Required';
      } else if (!/^[0-9A-Za-z/-]+$/.test(surveyNo)) {
        errors.push(`Survey Entry #${idx + 1}: Invalid Survey Number format.`);
        fieldErrors[`survey_${idx}_surveyNo`] = 'Invalid format';
      }

      if (!subDivision) {
        errors.push(`Survey Entry #${idx + 1}: Sub-Division Number is required.`);
        fieldErrors[`survey_${idx}_subDivision`] = 'Required';
      }

      if (!pattaNo) {
        errors.push(`Survey Entry #${idx + 1}: Patta Number is required.`);
        fieldErrors[`survey_${idx}_pattaNo`] = 'Required';
      } else if (!/^[0-9A-Za-z/-]+$/.test(pattaNo)) {
        errors.push(`Survey Entry #${idx + 1}: Invalid Patta Number format.`);
        fieldErrors[`survey_${idx}_pattaNo`] = 'Invalid format';
      }

      if (!chittaRef) {
        errors.push(`Survey Entry #${idx + 1}: Chitta / A-Register Reference is required.`);
        fieldErrors[`survey_${idx}_chittaRef`] = 'Required';
      }

      if (surveyNo && subDivision) {
        const rowKey = `${surveyNo.toLowerCase()}::${subDivision.toLowerCase()}`;
        if (seenSurveyKeys.has(rowKey)) {
          errors.push(
            `Survey Entry #${idx + 1}: Duplicate Survey ${surveyNo}/${subDivision} within the same document.`
          );
          fieldErrors[`survey_${idx}_surveyNo`] = 'Duplicate survey row in document';
        }
        seenSurveyKeys.add(rowKey);
      }
    });
  }

  // Step 5: Extent & Measurement
  if (targetStep === 5 || isFinal) {
    const ext = state.extent || ({} as DeedWizardState['extent']);
    const totalExtentVal = Number(ext.totalExtent || 0);
    const sqftVal = Number(ext.sqft || 0);
    if (totalExtentVal <= 0 && sqftVal <= 0) {
      errors.push('Total land extent must be greater than 0.');
      fieldErrors.totalExtent = 'Must be > 0';
    }
    const ewVal = parseFloat(String(ext.eastWest || '').trim());
    if (!String(ext.eastWest || '').trim() || Number.isNaN(ewVal) || ewVal <= 0) {
      errors.push('East to West measurement is required and must be > 0.');
      fieldErrors.eastWest = 'Required (> 0)';
    }
    const nsVal = parseFloat(String(ext.northSouth || '').trim());
    if (!String(ext.northSouth || '').trim() || Number.isNaN(nsVal) || nsVal <= 0) {
      errors.push('North to South measurement is required and must be > 0.');
      fieldErrors.northSouth = 'Required (> 0)';
    }
  }

  // Step 6: Four Boundaries
  if (targetStep === 6 || isFinal) {
    const b = state.boundary || ({} as DeedWizardState['boundary']);
    if (!String(b.north || '').trim() || String(b.north || '').trim().length < 5) {
      errors.push('North boundary description is required (minimum 5 characters).');
      fieldErrors.north = 'Required (min 5 chars)';
    }
    if (!String(b.south || '').trim() || String(b.south || '').trim().length < 5) {
      errors.push('South boundary description is required (minimum 5 characters).');
      fieldErrors.south = 'Required (min 5 chars)';
    }
    if (!String(b.east || '').trim() || String(b.east || '').trim().length < 5) {
      errors.push('East boundary description is required (minimum 5 characters).');
      fieldErrors.east = 'Required (min 5 chars)';
    }
    if (!String(b.west || '').trim() || String(b.west || '').trim().length < 5) {
      errors.push('West boundary description is required (minimum 5 characters).');
      fieldErrors.west = 'Required (min 5 chars)';
    }
  }

  // Step 7: Ownership History
  if (targetStep === 7 || isFinal) {
    const deedDef = resolveDeedType(state.documentType);
    const needsParent = deedDef ? deedDef.requiresParentHistory : true;
    const oh = state.ownershipHistory || ({} as DeedWizardState['ownershipHistory']);

    if (needsParent) {
      if (!String(oh.parentDocNo || '').trim()) {
        errors.push('Parent Document Number is required.');
        fieldErrors.parentDocNo = 'Required';
      }
      const yearNum = Number(oh.parentDocYear);
      if (
        !String(oh.parentDocYear || '').trim() ||
        !/^\d{4}$/.test(String(oh.parentDocYear).trim()) ||
        yearNum > new Date().getFullYear() ||
        yearNum < 1900
      ) {
        errors.push('Valid 4-digit Parent Document Year is required.');
        fieldErrors.parentDocYear = 'Valid 4-digit year required';
      }
      const sroVal = String(oh.parentDocSRO || (oh as any).parentSro || '').trim();
      if (!sroVal) {
        errors.push('Registered SRO of Parent Document is required.');
        fieldErrors.parentDocSRO = 'Required';
      }
      const dateVal = String(oh.parentDocDate || (oh as any).parentDocYear || '').trim();
      if (!dateVal) {
        errors.push('Parent Document Registration Date is required.');
        fieldErrors.parentDocDate = 'Required';
      } else if (oh.parentDocDate && new Date(oh.parentDocDate) > new Date()) {
        errors.push('Parent Document Date cannot be in the future.');
        fieldErrors.parentDocDate = 'Cannot be in future';
      }
      const priorVal = String(oh.priorOwners || (oh as any).howAcquired || '').trim();
      if (!priorVal || priorVal.length < 3) {
        errors.push('Previous Owner Name(s) are required.');
        fieldErrors.priorOwners = 'Required';
      }
    }
  }

  // Step 8: Transaction & Valuation
  if (targetStep === 8 || isFinal) {
    const deedDef = resolveDeedType(state.documentType);
    const needsConsideration = deedDef ? deedDef.requiresMonetaryConsideration : true;
    const isZeroConsiderationDeed =
      deedDef && (deedDef.code === 'GIFT' || deedDef.code === 'SETTLEMENT' || deedDef.code === 'POA');
    const tx = state.transaction || ({} as DeedWizardState['transaction']);

    if (Number(tx.considerationAmount || 0) < 0 || Number(tx.marketValue || 0) < 0 || Number(tx.guidelineValue || 0) < 0) {
      errors.push('Transaction and valuation amounts cannot be negative.');
      fieldErrors.considerationAmount = 'Cannot be negative';
    }

    if (deedDef?.code !== 'POA') {
      if (!tx.guidelineValue || Number(tx.guidelineValue) <= 0) {
        errors.push('Guideline Value is required and must be > 0.');
        fieldErrors.guidelineValue = 'Must be > 0';
      }
      if (!tx.marketValue || Number(tx.marketValue) <= 0) {
        errors.push('Market Value is required and must be > 0.');
        fieldErrors.marketValue = 'Must be > 0';
      }
    }

    if (needsConsideration) {
      if (!tx.considerationAmount || Number(tx.considerationAmount) <= 0) {
        errors.push(`Consideration Amount must be greater than 0 for ${deedDef?.nameEn || 'this deed'}.`);
        fieldErrors.considerationAmount = 'Must be > 0';
      }
      if (!String(tx.paymentMode || '').trim()) {
        errors.push('Payment Mode is required.');
        fieldErrors.paymentMode = 'Required';
      }
      const refNo = String(tx.paymentRefNo || (tx as any).utrNumber || '').trim();
      if (tx.paymentMode && tx.paymentMode !== 'Cash') {
        if (!refNo) {
          errors.push('UTR / Cheque / DD Reference Number is required for non-cash payments.');
          fieldErrors.paymentRefNo = 'Required';
        }
        if (!String(tx.paymentDate || '').trim()) {
          errors.push('Payment Date is required.');
          fieldErrors.paymentDate = 'Required';
        }
        if (!String(tx.bankName || '').trim()) {
          errors.push('Bank Name is required.');
          fieldErrors.bankName = 'Required';
        }
      }
      if (deedDef?.code === 'SALE') {
        const advance = Number(tx.advancePaid || 0);
        const balance = Number(tx.balancePaid || 0);
        if (advance > 0 || balance > 0) {
          const totalPaid = advance + balance;
          if (totalPaid !== Number(tx.considerationAmount || 0)) {
            errors.push(
              `Advance Paid (${advance}) + Balance Paid (${balance}) must equal Consideration Amount (${tx.considerationAmount || 0}).`
            );
            fieldErrors.advancePaid = 'Advance + Balance must equal Consideration';
            fieldErrors.balancePaid = 'Advance + Balance must equal Consideration';
          }
        }
      }
    } else if (isZeroConsiderationDeed) {
      if (Number(tx.considerationAmount || 0) > 0) {
        errors.push(
          `${deedDef?.nameEn} must not have a monetary consideration amount (must be 0).`
        );
        fieldErrors.considerationAmount = 'Must be 0 for non-monetary deed';
      }
    }
  }

  // Step 9: Witnesses (100% pure — never mutates witness.aadhaar)
  if (targetStep === 9 || isFinal) {
    const witnesses = Array.isArray(state.witnesses) ? state.witnesses : [];
    if (witnesses.length < 2) {
      errors.push('At least 2 witnesses are required for deed execution.');
      fieldErrors.witnesses = 'Minimum 2 witnesses required';
    } else {
      witnesses.forEach((w, idx) => {
        if (!String(w.name || '').trim() || String(w.name || '').trim().length < 2) {
          errors.push(`Witness ${idx + 1}: Valid full name is required.`);
          fieldErrors[`witness_${w.id}_name`] = 'Valid name required';
        }
        const relName = String(w.fatherName || (w as any).relationName || '').trim();
        if (!relName || relName.length < 2) {
          errors.push(`Witness ${idx + 1}: Father/Husband name is required.`);
          fieldErrors[`witness_${w.id}_fatherName`] = 'Required';
        }
        if (w.age !== undefined && w.age !== null && (Number(w.age) < 18 || Number(w.age) > 120)) {
          errors.push(`Witness ${idx + 1}: Witness must be 18 or older.`);
          fieldErrors[`witness_${w.id}_age`] = 'Must be 18+';
        }
        if (!String(w.address || '').trim() || String(w.address || '').trim().length < 10) {
          errors.push(`Witness ${idx + 1}: Complete address is required.`);
          fieldErrors[`witness_${w.id}_address`] = 'Complete address required';
        }
        const hasAadhaar = Boolean(String(w.aadhaar || '').trim());
        const hasIdProof = Boolean(String(w.idProof || '').trim());
        if (!hasAadhaar && !hasIdProof) {
          errors.push(`Witness ${idx + 1}: Aadhaar or ID Proof number is required.`);
          fieldErrors[`witness_${w.id}_aadhaar`] = 'Required';
        } else if (hasAadhaar) {
          const aadhaarCheck = validateAadhaarPure(w.aadhaar);
          if (!aadhaarCheck.valid) {
            errors.push(
              aadhaarCheck.reason === 'placeholder'
                ? `Witness ${idx + 1}: Placeholder Aadhaar number is not permitted.`
                : `Witness ${idx + 1}: Invalid 12-digit Aadhaar format.`
            );
            fieldErrors[`witness_${w.id}_aadhaar`] = 'Invalid 12-digit Aadhaar';
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

/**
 * Enforces document status transitions on the server.
 */
export function validateStatusTransition(
  currentStatus: string | undefined,
  nextStatus: string | undefined,
  options?: { createRevision?: boolean; isContentModified?: boolean }
): { valid: boolean; error?: string; code?: string } {
  const target = (nextStatus || currentStatus || 'Draft') as string;
  if (!isValidDraftStatus(target)) {
    return {
      valid: false,
      code: 'INVALID_STATUS',
      error: `Invalid document status "${target}". Allowed statuses: ${VALID_DRAFT_STATUSES.join(', ')}.`,
    };
  }

  // Creation of a brand new document
  if (!currentStatus) {
    if (target === 'Finalized' || target === 'Exported') {
      return {
        valid: false,
        code: 'INVALID_INITIAL_STATUS',
        error: `New documents cannot be created directly in "${target}" status. Create as Draft or In Progress first.`,
      };
    }
    return { valid: true };
  }

  // Finalized / Exported immutability lock
  if (currentStatus === 'Finalized' || currentStatus === 'Exported') {
    if (options?.createRevision) {
      if (target !== 'Draft' && target !== 'In Progress') {
        return {
          valid: false,
          code: 'INVALID_REVISION_STATUS',
          error: 'New revisions created from finalized documents must start in Draft status.',
        };
      }
      return { valid: true };
    }

    if (currentStatus === 'Finalized' && target === 'Exported' && !options?.isContentModified) {
      return { valid: true };
    }

    return {
      valid: false,
      code: 'FINALIZED_RECORD_LOCKED',
      error:
        'REGISTRY LOCK: Finalized documents are immutable and cannot be edited or reverted directly. Create a new revision to make corrections while preserving revision history.',
    };
  }

  // Cannot jump directly from Draft / In Progress to Exported without Finalized
  if (
    (currentStatus === 'Draft' || currentStatus === 'In Progress' || currentStatus === 'Pending Review' || currentStatus === 'Review') &&
    target === 'Exported'
  ) {
    return {
      valid: false,
      code: 'INVALID_STATUS_TRANSITION',
      error: `Cannot transition directly from "${currentStatus}" to "Exported". Document must be validated and Finalized first.`,
    };
  }

  return { valid: true };
}

/**
 * Server-side validation of a document payload.
 * Always validates field sanity (even for drafts if malformed values are passed)
 * and enforces full legal wizard completeness before transitioning to
 * Approved, Generated, Finalized, or Exported.
 */
export function validateDeedRecordForServer(
  docPayload: any,
  targetStatus: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const state: DeedWizardState | undefined = docPayload?.state;
  const candidateType = state?.documentType || docPayload?.docType;

  if (candidateType && !isDeedTemplateAvailable(candidateType)) {
    errors.push(
      `Template unavailable for document type "${candidateType}". Supported types: Sale Deed, Gift Deed, Settlement Deed, Partition Deed, Lease Deed, Mortgage Deed, Power of Attorney.`
    );
  }

  // Always check sanity of provided fields even in Draft/In Progress
  if (state && typeof state === 'object') {
    const tx = state.transaction;
    if (tx) {
      if (
        Number(tx.considerationAmount || 0) < 0 ||
        Number(tx.marketValue || 0) < 0 ||
        Number(tx.guidelineValue || 0) < 0
      ) {
        errors.push('Transaction amounts (consideration, market value, guideline value) cannot be negative.');
      }
    }

    // Check any provided party Aadhaar/PAN/phone if non-empty
    if (Array.isArray(state.parties)) {
      state.parties.forEach((p, idx) => {
        if (!p || p.role === 'Witness') return;
        const aadhaarVal = String(p.aadhaar || '').trim();
        if (aadhaarVal) {
          const check = validateAadhaarPure(aadhaarVal);
          if (!check.valid) {
            errors.push(
              `Party ${idx + 1}: Invalid Aadhaar number (${check.reason === 'placeholder' ? 'placeholder values not permitted' : 'must be 12 digits'}).`
            );
          }
        }
        const panVal = String(p.pan || '').trim().toUpperCase();
        const isMaskedPan = /^X{5}[0-9]{4}[A-Z]{1}$/.test(panVal);
        const isFullPan = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panVal);
        if (panVal && !isMaskedPan && !isFullPan) {
          errors.push(`Party ${idx + 1}: Invalid PAN format "${panVal}".`);
        }
        const phoneVal = String(p.phone || p.mobile || '').replace(/[\s-]/g, '');
        if (phoneVal && !/^[6-9]\d{9}$/.test(phoneVal)) {
          errors.push(`Party ${idx + 1}: Invalid 10-digit Indian mobile number.`);
        }
      });
    }

    if (Array.isArray(state.witnesses)) {
      state.witnesses.forEach((w, idx) => {
        if (!w) return;
        const aadhaarVal = String(w.aadhaar || '').trim();
        if (aadhaarVal) {
          const check = validateAadhaarPure(aadhaarVal);
          if (!check.valid) {
            errors.push(`Witness ${idx + 1}: Invalid Aadhaar number.`);
          }
        }
      });
    }
  }

  const strictStatuses = new Set(['Approved', 'Generated', 'Finalized', 'Exported']);
  if (strictStatuses.has(targetStatus)) {
    const fullCheck = validateDeedWizardStepPure(state, 12, true);
    for (const err of fullCheck.errors) {
      if (!errors.includes(err)) {
        errors.push(err);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface QualifiedSurveyRow {
  rowIndex: number;
  district: string;
  registrationDistrict: string;
  taluk: string;
  sro: string;
  village: string;
  surveyNo: string;
  subDivision: string;
  pattaNo: string;
  chittaRef: string;
  qualifiedKey: string;
  displayLabel: string;
}

function normLoc(val: unknown): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extracts and qualifies EVERY survey row in `state.surveys` (and `state.survey` fallback)
 * with full location identifiers (`district`, `registrationDistrict`, `taluk`, `sro`, `village`, `surveyNo`, `subDivision`).
 */
export function extractQualifiedSurveys(state: any): QualifiedSurveyRow[] {
  if (!state || typeof state !== 'object') return [];
  const prop = state.property || {};
  const district = normLoc(prop.district);
  const registrationDistrict = normLoc(prop.registrationDistrict);
  const taluk = normLoc(prop.taluk);
  const sro = normLoc(prop.sro);
  const village = normLoc(prop.village);

  const rawRows: any[] =
    Array.isArray(state.surveys) && state.surveys.length > 0
      ? state.surveys
      : state.survey && typeof state.survey === 'object'
        ? [state.survey]
        : [];

  const result: QualifiedSurveyRow[] = [];
  rawRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const surveyNo = normLoc(row.surveyNo);
    const subDivision = normLoc(row.subDivision);
    if (!surveyNo || !village) return;

    const pattaNo = normLoc(row.pattaNo);
    const chittaRef = normLoc(row.chittaRef);
    const qualifiedKey = [district, taluk, sro, village, surveyNo, subDivision].join('|');
    const locationParts = [
      prop.village || village,
      prop.taluk ? `${prop.taluk} Taluk` : '',
      prop.sro ? `${prop.sro} SRO` : '',
      prop.district ? `${prop.district} District` : '',
    ].filter(Boolean);

    result.push({
      rowIndex: idx,
      district,
      registrationDistrict,
      taluk,
      sro,
      village,
      surveyNo,
      subDivision,
      pattaNo,
      chittaRef,
      qualifiedKey,
      displayLabel: `Survey ${row.surveyNo}${row.subDivision ? `/${row.subDivision}` : ''} in ${locationParts.join(', ')}`,
    });
  });

  return result;
}

/**
 * Compares two qualified survey rows.
 * Requires `village` and `surveyNo` and `subDivision` (if both specify subDivision) to match,
 * AND requires `district`, `taluk`, and `sro` to match whenever present so that identical
 * survey numbers in different districts/taluks/SROs never falsely collide.
 */
export function doQualifiedSurveysMatch(a: QualifiedSurveyRow, b: QualifiedSurveyRow): boolean {
  if (!a.village || !b.village || a.village !== b.village) return false;
  if (!a.surveyNo || !b.surveyNo || a.surveyNo !== b.surveyNo) return false;

  const subA = a.subDivision || '';
  const subB = b.subDivision || '';
  if (subA !== subB) return false;

  if (a.district && b.district && a.district !== b.district) return false;
  if (a.taluk && b.taluk && a.taluk !== b.taluk) return false;
  if (a.sro && b.sro && a.sro !== b.sro) return false;

  return true;
}

export interface SurveyConflictItem {
  type: 'POSSIBLE_CONFLICT_REQUIRES_REVIEW' | 'CONCURRENT_DRAFT_WARNING';
  category?: 'POSSIBLE_CONFLICT_REQUIRES_REVIEW' | 'CONCURRENT_DRAFT_WARNING';
  severity: 'WARNING' | 'INFO';
  requiresReview: boolean;
  linkedInParentHistory: boolean;
  reviewAcknowledged: boolean;
  docId: string;
  docNo: string;
  docType: string;
  status: string;
  modifiedAt: string;
  surveyRowIndex: number;
  surveyNo: string;
  subDivision: string;
  survey?: {
    rowIndex: number;
    surveyNo: string;
    subDivision: string;
  };
  village: string;
  taluk: string;
  district: string;
  sro: string;
  qualifiedKey: string;
  message: string;
}

export interface SurveyConflictAnalysis {
  hasUnreviewedConflicts: boolean;
  hasAnyConflicts: boolean;
  conflicts: SurveyConflictItem[];
  checkedSurveys: QualifiedSurveyRow[];
}

/**
 * Checks EVERY survey row of a candidate document against EVERY survey row of existing documents,
 * qualifying location identifiers (`district`, `taluk`, `sro`, `village`, `surveyNo`, `subDivision`)
 * and applying transaction-history logic instead of a blanket "same survey finalized = fraud" block.
 */
export function findQualifiedSurveyConflicts(
  candidateState: any,
  candidateDocId: string | undefined,
  existingDocs: any[]
): SurveyConflictAnalysis {
  const checkedSurveys = extractQualifiedSurveys(candidateState);
  const conflicts: SurveyConflictItem[] = [];

  if (checkedSurveys.length === 0 || !Array.isArray(existingDocs)) {
    return {
      hasUnreviewedConflicts: false,
      hasAnyConflicts: false,
      conflicts: [],
      checkedSurveys,
    };
  }

  const parentDocNoNorm = normLoc(candidateState?.ownershipHistory?.parentDocNo);
  const reviewAcknowledged = Boolean(candidateState?.conflictReviewAcknowledged);

  for (const otherDoc of existingDocs) {
    if (!otherDoc || typeof otherDoc !== 'object') continue;
    if (candidateDocId && String(otherDoc.id) === String(candidateDocId)) continue;
    if (otherDoc.status === 'Archived') continue;

    const otherSurveys = extractQualifiedSurveys(otherDoc.state);
    if (otherSurveys.length === 0) continue;

    const otherDocNoNorm = normLoc(otherDoc.docNo);
    const isLinkedInParentHistory = Boolean(
      parentDocNoNorm &&
        otherDocNoNorm &&
        (parentDocNoNorm === otherDocNoNorm ||
          otherDocNoNorm.startsWith(`${parentDocNoNorm}-v`) ||
          parentDocNoNorm.includes(otherDocNoNorm))
    );

    for (const candidateRow of checkedSurveys) {
      const matchingOtherRow = otherSurveys.find((os) => doQualifiedSurveysMatch(candidateRow, os));
      if (!matchingOtherRow) continue;

      const isPriorFinalized =
        otherDoc.status === 'Finalized' || otherDoc.status === 'Exported';

      if (isPriorFinalized) {
        const requiresReview = !isLinkedInParentHistory && !reviewAcknowledged;
        conflicts.push({
          type: 'POSSIBLE_CONFLICT_REQUIRES_REVIEW',
          category: 'POSSIBLE_CONFLICT_REQUIRES_REVIEW',
          severity: 'WARNING',
          requiresReview,
          linkedInParentHistory: isLinkedInParentHistory,
          reviewAcknowledged,
          docId: String(otherDoc.id || ''),
          docNo: String(otherDoc.docNo || ''),
          docType: String(otherDoc.docType || otherDoc.state?.documentType || 'Deed'),
          status: String(otherDoc.status || 'Finalized'),
          modifiedAt: String(otherDoc.modifiedAt || ''),
          surveyRowIndex: candidateRow.rowIndex,
          surveyNo: candidateRow.surveyNo,
          subDivision: candidateRow.subDivision,
          survey: {
            rowIndex: candidateRow.rowIndex,
            surveyNo: candidateRow.surveyNo,
            subDivision: candidateRow.subDivision,
          },
          village: candidateRow.village,
          taluk: candidateRow.taluk,
          district: candidateRow.district,
          sro: candidateRow.sro,
          qualifiedKey: candidateRow.qualifiedKey,
          message: isLinkedInParentHistory
            ? `Prior finalized deed (${otherDoc.docNo}) found on ${candidateRow.displayLabel} and linked in Parent Document History.`
            : `Possible conflict requiring review: ${candidateRow.displayLabel} appears in a prior finalized deed (${otherDoc.docNo} - ${otherDoc.docType || 'Deed'}). Verify chain of title / transaction history before finalizing.`,
        });
      } else {
        conflicts.push({
          type: 'CONCURRENT_DRAFT_WARNING',
          category: 'CONCURRENT_DRAFT_WARNING',
          severity: 'INFO',
          requiresReview: false,
          linkedInParentHistory: isLinkedInParentHistory,
          reviewAcknowledged,
          docId: String(otherDoc.id || ''),
          docNo: String(otherDoc.docNo || ''),
          docType: String(otherDoc.docType || otherDoc.state?.documentType || 'Deed'),
          status: String(otherDoc.status || 'Draft'),
          modifiedAt: String(otherDoc.modifiedAt || ''),
          surveyRowIndex: candidateRow.rowIndex,
          surveyNo: candidateRow.surveyNo,
          subDivision: candidateRow.subDivision,
          survey: {
            rowIndex: candidateRow.rowIndex,
            surveyNo: candidateRow.surveyNo,
            subDivision: candidateRow.subDivision,
          },
          village: candidateRow.village,
          taluk: candidateRow.taluk,
          district: candidateRow.district,
          sro: candidateRow.sro,
          qualifiedKey: candidateRow.qualifiedKey,
          message: `Concurrent draft (${otherDoc.docNo}, status: ${otherDoc.status}) also references ${candidateRow.displayLabel}. Review for potential overlap.`,
        });
      }
    }
  }

  return {
    hasUnreviewedConflicts: conflicts.some((c) => c.requiresReview),
    hasAnyConflicts: conflicts.length > 0,
    conflicts,
    checkedSurveys,
  };
}
