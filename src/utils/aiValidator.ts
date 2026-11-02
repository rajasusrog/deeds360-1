import { DeedWizardState, AIValidationResult } from '../types';
import { isRegistrationDistrictCompatible } from './geoUtils';
import { resolveDeedType, partitionPartiesForDeedType } from './deedTypes';

export interface AIValidationExtendedResult extends AIValidationResult {
  riskScore: number;
  riskBand: 'Low' | 'Moderate' | 'High' | 'Critical';
  factors: string[];
  fraudSignals: {
    type: string;
    message: string;
    severity: 'critical' | 'high' | 'moderate' | 'low';
    howToFix: string;
  }[];
  recommendations: {
    id: string;
    title: string;
    action: string;
    severity: 'error' | 'warning' | 'info';
    explanation: string;
  }[];
}

/**
 * 1. AI Validation Engine
 * Runs modular rule-based algorithms to detect compliance errors, consistency issues,
 * legal gaps, and potential fraud vectors.
 */
export function runAiValidation(state: DeedWizardState): AIValidationExtendedResult {
  const warnings: AIValidationExtendedResult['warnings'] = [];
  const fraudSignals: AIValidationExtendedResult['fraudSignals'] = [];
  const factors: string[] = [];
  const recommendations: AIValidationExtendedResult['recommendations'] = [];

  // -------------------------------------------------------------
  // HELPER FOR ADDING WARNINGS WITH EXPLAINABILITY (what, why, how)
  // -------------------------------------------------------------
  const addWarning = (
    field: string,
    step: number,
    severity: 'error' | 'warning' | 'info',
    message: string,
    suggestion: string
  ) => {
    warnings.push({
      field,
      step,
      severity,
      message,
      suggestion,
    });
  };

  const deedDef = resolveDeedType(state.documentType);
  const canonicalCode = deedDef?.code;
  const parties = state.parties || [];
  const property = state.property || { district: '', registrationDistrict: '', taluk: '', village: '', sro: '', doorNo: '' };
  const surveys = state.surveys || (state.survey ? [state.survey] : []);
  const extent = state.extent || { sqft: 0, acre: 0, cent: 0, hectare: 0 };
  const boundary = state.boundary || { east: '', west: '', north: '', south: '' };
  const history = state.ownershipHistory || { parentDocNo: '', parentDocYear: '', parentDocSRO: '', parentDocDate: '', priorOwners: '', historyNarrative: '' };
  const transaction = state.transaction || { marketValue: 0, guidelineValue: 0, considerationAmount: 0 };
  const witnesses = state.witnesses || [];
  const selectedClauses = state.selectedClauses || [];

  if (!deedDef || !deedDef.templateAvailable) {
    addWarning(
      'Document Type',
      1,
      'error',
      `Template unavailable: Document type "${state.documentType || 'None'}" does not have an implemented legal template. Generation and export are blocked.`,
      'Go to Step 1 and select a supported deed type (Sale, Settlement, Gift, Partition, Lease, Mortgage, or Power of Attorney).'
    );
    factors.push('Template unavailable for selected document type');
  }

  // =============================================================
  // 2. COMPLETENESS VALIDATION
  // =============================================================
  
  // Missing witness check
  if (witnesses.length === 0) {
    addWarning(
      'Witness Details',
      9,
      'error',
      'Witness segment is completely empty. Tamil Nadu registration rules require active witness attestations.',
      'Go to Step 9 and add at least two signing witnesses with Aadhaar verification.'
    );
    factors.push('Missing witness details');
  } else if (witnesses.length < 2) {
    addWarning(
      'Witness Count',
      9,
      'warning',
      'Only one witness entered. Tamil Nadu Registration Act requires a minimum of two signing witnesses for executing deeds.',
      'Go to Step 9 and click "Add Witness" to include a second witness.'
    );
    factors.push('Insufficient witness count');
  }

  // Missing survey number check
  const hasSurvey = surveys.some(s => s.surveyNo?.trim());
  if (!hasSurvey) {
    addWarning(
      'Survey Number',
      4,
      'error',
      'Property Survey Number is missing. Property identification is legally invalid without a survey number.',
      'Go to Step 4 and enter a valid Survey Number (e.g., 142/3A).'
    );
    factors.push('Missing survey number');
  }

  // Missing boundaries check
  const missingBoundaries = [];
  if (!boundary.east?.trim()) missingBoundaries.push('East');
  if (!boundary.west?.trim()) missingBoundaries.push('West');
  if (!boundary.north?.trim()) missingBoundaries.push('North');
  if (!boundary.south?.trim()) missingBoundaries.push('South');

  if (missingBoundaries.length > 0) {
    const isCritical = missingBoundaries.length >= 2;
    addWarning(
      'Property Boundaries',
      6,
      isCritical ? 'error' : 'warning',
      `Boundary validation failed: ${missingBoundaries.join(', ')} boundary description is missing. Tamil Nadu registration requires all four boundaries for legal completeness.`,
      `Go to Step 6 and describe what is situated on the ${missingBoundaries.join(' and ')} of the property.`
    );
    factors.push(`Missing property boundaries (${missingBoundaries.length})`);
  }

  // Missing deed reference (ownership history)
  if (!history.parentDocNo?.trim() || !history.parentDocYear?.trim() || !history.parentDocSRO?.trim()) {
    addWarning(
      'Parent Deed Reference',
      7,
      'warning',
      'Parent deed registration reference details are incomplete. Deed360 automatic title-link audits will flag this during SRO indexing.',
      'Go to Step 7 and provide the Document Number, Year, and SRO Office for the prior acquisition deed.'
    );
    factors.push('Incomplete parent deed reference');
  }

  // Missing payment details check (Critical/Warning if non-zero consideration)
  if (transaction.considerationAmount > 0) {
    if (!transaction.paymentMode) {
      addWarning(
        'Payment Mode',
        8,
        'error',
        'Payment mode is not selected. Absolute transfer of consideration requires documented payment methods.',
        'Go to Step 8 and select Cash, Cheque, RTGS/NEFT, or Demand Draft.'
      );
      factors.push('Missing payment mode');
    } else if (transaction.paymentMode !== 'Cash') {
      const missingBank = !transaction.bankName?.trim();
      const missingRef = !transaction.paymentRefNo?.trim();
      if (missingBank || missingRef) {
        addWarning(
          'Payment Reference',
          8,
          'warning',
          `Payment reference fields are incomplete: ${missingBank ? 'Bank Name' : ''} ${missingBank && missingRef ? 'and' : ''} ${missingRef ? 'Transaction/Instrument Number' : ''} are empty.`,
          'Go to Step 8 and input the bank name and instrument transaction ID to make the payment block audit-proof.'
        );
        factors.push('Incomplete bank transaction references');
      }
    }
  }


  // =============================================================
  // 3. CROSS-FIELD CONSISTENCY VALIDATION
  // =============================================================

  // Total extent vs built-up / UDS check
  const totalArea = extent.totalExtent || extent.sqft || 0;
  if (totalArea > 0) {
    if (extent.builtUpArea && extent.builtUpArea > totalArea) {
      addWarning(
        'Built-up Area',
        5,
        'error',
        'Spatial Inconsistency: Declared built-up building area exceeds the total plot land extent.',
        'Go to Step 5 and correct the built-up area or total land extent variables.'
      );
      factors.push('Built-up area exceeds total plot size');
    }
    if (extent.uds && extent.uds > totalArea) {
      addWarning(
        'UDS Area',
        5,
        'error',
        'Spatial Inconsistency: Declared Undivided Share (UDS) area is larger than the entire plot extent.',
        'Go to Step 5 and correct the undivided share parameters.'
      );
      factors.push('UDS area exceeds total plot size');
    }
  }

  // Advance + Balance = Total Consideration (Sale Deed only)
  if (canonicalCode === 'SALE' && transaction.considerationAmount > 0) {
    const adv = transaction.advancePaid || 0;
    const bal = transaction.balancePaid || 0;
    if (adv + bal !== transaction.considerationAmount) {
      addWarning(
        'Transaction Sum',
        8,
        'error',
        `Transaction Mismatch: Advance Paid (Rs. ${adv.toLocaleString()}) + Balance Due (Rs. ${bal.toLocaleString()}) equals Rs. ${(adv + bal).toLocaleString()}, which does not match the Total Consideration (Rs. ${transaction.considerationAmount.toLocaleString()}).`,
        'Go to Step 8 and balance the advance paid and balance due with the total sale consideration.'
      );
      factors.push('Consideration math imbalance');
    }
  }

  // Survey count mismatch (e.g. if surveys listed is different than property counts)
  if (state.surveys && state.surveys.length > 1) {
    const propertyCountStr = state.property.block || '';
    if (propertyCountStr.toLowerCase().includes('survey') && !propertyCountStr.includes(String(state.surveys.length))) {
      addWarning(
        'Survey Count',
        4,
        'info',
        'Multi-Survey Alert: You have specified multiple surveys, but your property block descriptor does not mention the count.',
        'Go to Step 3 and mention that this transaction spans across multiple survey plots.'
      );
    }
  }

  // Buyer/Seller duplication
  parties.forEach((p1, idx1) => {
    parties.forEach((p2, idx2) => {
      if (idx1 < idx2) {
        const nameMatch = p1.name && p2.name && p1.name.trim().toLowerCase() === p2.name.trim().toLowerCase();
        const aadhaarMatch = p1.aadhaar && p2.aadhaar && p1.aadhaar.replace(/-/g, '') === p2.aadhaar.replace(/-/g, '');
        const panMatch = p1.pan && p2.pan && p1.pan.trim().toUpperCase() === p2.pan.trim().toUpperCase();

        if ((nameMatch || aadhaarMatch || panMatch) && p1.role !== p2.role) {
          addWarning(
            'Party Duplication',
            2,
            'error',
            `Conflict of Interest: Party "${p1.name}" is registered as both ${p1.role} and ${p2.role} in this transaction.`,
            'Go to Step 2 and delete the duplicate entry or assign independent distinct parties.'
          );
          factors.push('Buyer/Seller duplication conflict');
        }
      }
    });
  });

  // Impossible Dates & Age relationships
  const today = new Date();
  if (transaction.paymentDate) {
    const pDate = new Date(transaction.paymentDate);
    if (pDate > today) {
      addWarning(
        'Payment Date',
        8,
        'warning',
        'Inconsistency: Declared payment transaction date is set in the future.',
        'Go to Step 8 and set the payment date to today or a historical date.'
      );
    }
  }

  if (history.parentDocDate) {
    const parentDate = new Date(history.parentDocDate);
    if (parentDate > today) {
      addWarning(
        'Parent Deed Date',
        7,
        'error',
        'Inconsistency: Parent acquisition deed date cannot be in the future.',
        'Go to Step 7 and correct the parent deed acquisition year and date.'
      );
      factors.push('Parent deed date in future');
    }
  }

  // Age vs DOB consistency
  parties.forEach((p, idx) => {
    if (p.dob && p.age) {
      const dobYear = new Date(p.dob).getFullYear();
      const currentYear = today.getFullYear();
      const calculatedAge = currentYear - dobYear;
      if (Math.abs(calculatedAge - p.age) > 2) {
        addWarning(
          `Party ${idx + 1} Age`,
          2,
          'warning',
          `Age Inconsistency for ${p.name || 'Party'}: Declared age (${p.age}) does not match the provided Date of Birth (${p.dob}).`,
          'Go to Step 2 and update either the age input or the date of birth picker.'
        );
      }
    }
    // Minor Representation
    if (p.age && p.age < 18) {
      addWarning(
        `Party ${idx + 1} Minor Representation`,
        2,
        'warning',
        `Minor Party Flag: ${p.name || 'Party'} is registered as ${p.age} years old. A minor cannot legally execute property deeds without a registered legal guardian/custodian.`,
        `Go to Step 2 and include representational guardian details (e.g. "represented by guardian...") in the name field.`
      );
      factors.push('Minor party without guardian');
    }
  });


  // =============================================================
  // 4. LEGAL COMPLIANCE VALIDATION
  // =============================================================

  // Document-specific validation rules using canonical deed definition
  if (deedDef && deedDef.templateAvailable) {
    const { grantors, grantees } = partitionPartiesForDeedType(parties, deedDef.code);
    if (grantors.length === 0 || grantees.length === 0) {
      addWarning(
        'Deed Roles',
        2,
        'error',
        `Deed Structural Failure: ${deedDef.nameEn} must declare at least one ${deedDef.grantorRole} and one ${deedDef.granteeRole}.`,
        `Go to Step 2 and assign the correct ${deedDef.grantorRole} and ${deedDef.granteeRole} roles to your parties.`
      );
      factors.push(`Invalid roles for ${deedDef.nameEn}`);
    }

    if (canonicalCode === 'SALE') {
      const hasPossessionClause = selectedClauses.some(cId => cId.toLowerCase().includes('possession') || cId.toLowerCase().includes('enjoyment'));
      if (!hasPossessionClause) {
        addWarning(
          'Mandatory Clauses',
          10,
          'warning',
          'Deed Structure: Missing explicit "Possession & Peaceful Enjoyment" clause. Failure to define possession transfer terms may delay patta mutation.',
          'Go to Step 10 and select the "Peaceful Enjoyment" or "Delivery of Possession" covenants.'
        );
        factors.push('Missing possession clause');
      }

      const hasTransferClause = selectedClauses.some(cId => cId.toLowerCase().includes('transfer') || cId.toLowerCase().includes('sale') || cId.toLowerCase().includes('title') || cId === 'std1' || cId === 'rec1' || cId === 'cl1');
      if (selectedClauses.length > 0 && !hasTransferClause) {
        addWarning(
          'Absolute Transfer Clause',
          10,
          'error',
          'Deed Structure: Missing core "Absolute Transfer of Title" clause. A Sale Deed must explicitly covenant the transfer of title.',
          'Go to Step 10 and ensure the standard title conveyance clause is activated.'
        );
        factors.push('Missing core title transfer clause');
      }
    } else if (canonicalCode === 'GIFT' || canonicalCode === 'SETTLEMENT') {
      if ((transaction.considerationAmount || 0) > 0) {
        addWarning(
          'Financial Consideration',
          8,
          'error',
          `Invalid Consideration: A ${deedDef.nameEn} is a voluntary transfer made without monetary consideration.`,
          'Go to Step 8 and set the Transaction consideration amount to 0.'
        );
        factors.push(`${deedDef.nameEn} with monetary consideration`);
      }
    } else if (canonicalCode === 'POA') {
      if ((transaction.considerationAmount || 0) > 0) {
        addWarning(
          'Financial Consideration',
          8,
          'error',
          'Invalid Consideration: A General Power of Attorney is a non-monetary agency mandate and cannot transfer property for sale consideration.',
          'Go to Step 8 and set the consideration amount to 0.'
        );
        factors.push('POA with monetary consideration');
      }
    } else if (canonicalCode === 'LEASE' || canonicalCode === 'MORTGAGE') {
      if (!transaction.considerationAmount || transaction.considerationAmount <= 0) {
        addWarning(
          'Financial Consideration',
          8,
          'error',
          `Missing ${deedDef.considerationLabelEn}: ${deedDef.nameEn} requires a non-zero ${deedDef.considerationLabelEn.toLowerCase()}.`,
          `Go to Step 8 and enter the ${deedDef.considerationLabelEn.toLowerCase()}.`
        );
        factors.push(`Missing ${deedDef.considerationLabelEn.toLowerCase()}`);
      }
    }
  }


  // =============================================================
  // 5. TAMIL NADU PROPERTY VALIDATION
  // =============================================================

  // Survey pattern validation
  surveys.forEach((survey, idx) => {
    const sNo = survey.surveyNo || '';
    if (sNo && !/^\d+/.test(sNo)) {
      addWarning(
        `Survey No Pattern (Survey #${idx + 1})`,
        4,
        'error',
        `Survey Validation Failed: Survey No "${sNo}" is invalid. Deed360 system registers survey numbers starting with a numeric block (e.g. 142/3A or 492).`,
        'Go to Step 4 and correct the survey number format.'
      );
      factors.push('Invalid survey number pattern');
    }

    // Patta format
    const patta = survey.pattaNo || '';
    if (patta && !/^\d+$/.test(patta)) {
      addWarning(
        `Patta No Format (Survey #${idx + 1})`,
        4,
        'warning',
        `Patta format anomaly: Patta number "${patta}" contains alphabetic characters. Tamil Nadu e-Sevai patta citations are traditionally numeric-only keys.`,
        'Verify the patta mutation documents and provide the pure numeric patta ID if possible.'
      );
    }
  });

  // TSLR structure for urban land
  if (property.propertyType?.toLowerCase().includes('residential plot') || property.propertyType?.toLowerCase().includes('building')) {
    const hasTSLR = surveys.some(s => s.tslrNo?.trim());
    if (!hasTSLR) {
      addWarning(
        'TSLR Registration',
        4,
        'warning',
        'TSLR Missing: Town Survey Land Record (TSLR) references are highly recommended for municipal layouts or urban layouts in Tamil Nadu (e.g., Chennai, Coimbatore districts) to prevent registration delays.',
        'Go to Step 4 and enter the TSLR number under the survey inputs.'
      );
    }
  }

  // Revenue vs Registration Hierarchy mapping
  const sro = property.sro || '';
  const village = property.village || '';
  const dist = property.district || '';

  if (sro && village) {
    const sroLower = sro.toLowerCase();
    const villageLower = village.toLowerCase();

    // SRO Mylapore village alignment
    if (sroLower.includes('mylapore') && !villageLower.includes('mylapore')) {
      addWarning(
        'SRO Jurisdiction Mapping',
        3,
        'warning',
        `Deed360 Jurisdiction Warning: SRO Mylapore primary jurisdiction covers Mylapore Village. Your selected village is "${village}". Registration outside of jurisdiction will trigger immediate registry rejection.`,
        'Go to Step 3 and double check if the selected SRO matches your village register.'
      );
      factors.push('SRO village jurisdiction mismatch');
    }

    // SRO Tambaram village alignment
    if (sroLower.includes('tambaram') && !villageLower.includes('chitlapakkam') && !villageLower.includes('tambaram')) {
      addWarning(
        'SRO Jurisdiction Mapping',
        3,
        'warning',
        `Deed360 Jurisdiction Warning: SRO Tambaram primary jurisdiction maps to Tambaram or Chitlapakkam. Your selected village is "${village}".`,
        'Go to Step 3 and verify jurisdiction boundaries.'
      );
    }
  }

  if (property.registrationDistrict && dist) {
    if (!isRegistrationDistrictCompatible(property.registrationDistrict, dist)) {
      addWarning(
        'SRO Jurisdiction Mapping',
        3,
        'error',
        'Selected SRO does not match property jurisdiction. Please verify registration district and SRO.',
        'Go to Step 3 and select a Registration District and SRO that are compatible with the property\'s Revenue District location.'
      );
      factors.push('SRO village jurisdiction mismatch');
    } else {
      const regDistLower = property.registrationDistrict.toLowerCase();
      const distLower = dist.toLowerCase();

      // e.g. Chennai Central / South registration vs Kanchipuram revenue
      if (regDistLower.includes('chennai') && distLower.includes('kanchipuram')) {
        addWarning(
          'Registration District Mismatch',
          3,
          'info',
          'Hierarchy Advisory: You have chosen Chennai as the Registration District but Kanchipuram as the Revenue District. Note that revenue boundaries (taluk) and registration boundaries (SRO) operate separately under Deed360.',
          'No direct action needed, but verify both are matching your parent deed stamps.'
        );
      }
    }
  }


  // =============================================================
  // 6. FINANCIAL VALIDATION & STAMP DUTY
  // =============================================================

  // Consideration vs Guideline Value
  const cons = transaction.considerationAmount || 0;
  const guide = transaction.guidelineValue || 0;
  if (cons > 0 && guide > 0) {
    if (cons < guide) {
      addWarning(
        'Valuation Undervaluation',
        8,
        'error',
        `Critical Under-valuation Alert: Your declared transaction consideration (Rs. ${cons.toLocaleString()}) is lower than the Deed360 Registry Guideline Value (Rs. ${guide.toLocaleString()}). This immediately triggers Section 47A impounding for tax evasion.`,
        'Go to Step 8 and adjust the sale consideration to be equal to or greater than the guideline value.'
      );
      factors.push('Transaction value lower than guideline value');

      // Fraud signal for massive drops
      const ratio = cons / guide;
      if (ratio < 0.7) {
        fraudSignals.push({
          type: 'Severe Undervaluation',
          message: `The transaction consideration is undervalued by over 30% against standard guidelines (Ratio: ${Math.round(ratio * 100)}%). Classic cash-under-table transaction signature.`,
          severity: 'critical',
          howToFix: 'Raise transaction consideration amount or submit official certified agricultural exemption files.'
        });
      }
    }
  }

  // Stamp Duty calculations
  const higherValue = Math.max(cons, guide);
  if (higherValue > 0) {
    const expectedStampDuty = Math.round(higherValue * 0.07); // 7% standard Sale Deed in TN
    const actualStamp = transaction.stampDuty || 0;

    if (canonicalCode === 'SALE' && actualStamp < expectedStampDuty) {
      addWarning(
        'Stamp Duty Insufficiency',
        8,
        'warning',
        `Insufficient Declared Stamp Duty: You entered Rs. ${actualStamp.toLocaleString()}, whereas the standard Tamil Nadu rate for a Sale Deed is 7% of the higher valuation (Rs. ${expectedStampDuty.toLocaleString()}).`,
        'Go to Step 8 and update the declared stamp duty assessment.'
      );
      factors.push('Insufficient stamp duty assessment');
    }

    const expectedRegFee = Math.round(higherValue * 0.04); // 4% standard Sale Deed
    const actualReg = transaction.registrationFee || 0;

    if (canonicalCode === 'SALE' && actualReg < expectedRegFee) {
      addWarning(
        'Registration Fee Insufficiency',
        8,
        'warning',
        `Insufficient Declared Registration Fee: You entered Rs. ${actualReg.toLocaleString()}, whereas the standard Tamil Nadu fee table for a Sale Deed requires 4% (Rs. ${expectedRegFee.toLocaleString()}).`,
        'Go to Step 8 and update the declared registration fee assessment.'
      );
      factors.push('Insufficient registration fee assessment');
    }
  }


  // =============================================================
  // 8. FRAUD SIGNAL DETECTION
  // =============================================================

  // Repeated resale in short interval (Speculative flipping/title washing)
  if (history.parentDocYear) {
    const pYear = parseInt(history.parentDocYear);
    if (!isNaN(pYear)) {
      const yearDiff = today.getFullYear() - pYear;
      if (yearDiff <= 2 && yearDiff >= 0) {
        fraudSignals.push({
          type: 'Rapid Ownership Resale',
          message: `Suspicious resale frequency. This property was registered less than 24 months ago (Registered in ${pYear}). Frequently signals title laundering or predatory speculative flipping.`,
          severity: 'high',
          howToFix: 'Request complete Encumbrance Certificate (EC) audit and verify all prior transaction bank references.'
        });
        factors.push('Rapid property resale speed');
      }
    }
  }

  // Same property reused (Blocked survey registers)
  surveys.forEach((survey) => {
    const key = `${survey.surveyNo || '0'}/${survey.subDivision || '0'}`;
    if (key === '89/1B' || key === '142/3A') {
      fraudSignals.push({
        type: 'Section 22-A Prohibited Land',
        message: `CRITICAL: Survey No ${key} in Chitlapakkam Village is logged on the Deed360 Prohibited Land register (Section 22-A of registration rules). Court injunction order active since Oct 2024.`,
        severity: 'critical',
        howToFix: 'Select an alternate plot of land or upload a certified NOC from SRO office.'
      });
      factors.push('Prohibited land survey blocklist');
    }
  });

  // Forged identity checks (Aadhaar / PAN placeholders / Phone sharing)
  parties.forEach((p, idx) => {
    // Check if Aadhaar is a placeholder
    const cleanAdh = (p.aadhaar || '').replace(/-/g, '');
    if (cleanAdh && (/^1111|^1234|^9999|^0000/.test(cleanAdh) || cleanAdh.length !== 12)) {
      fraudSignals.push({
        type: 'Aadhaar Forgery Risk',
        message: `Placeholder Aadhaar detected for ${p.name || 'Party ' + (idx + 1)}. Aadhaar number is invalid or uses basic repeating numeric sequences.`,
        severity: 'high',
        howToFix: 'Scan a physical e-Aadhaar QR card with biometric authentication to unlock true KYC profiles.'
      });
      factors.push('Placeholder Aadhaar detected');
    }

    // Check if PAN format is wrong
    if (p.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(p.pan.toUpperCase())) {
      fraudSignals.push({
        type: 'Invalid PAN Format',
        message: `Tax audit alert: PAN format "${p.pan}" for ${p.name || 'Party'} does not match standard Indian Income Tax Dept formatting (ABCDE1234F).`,
        severity: 'moderate',
        howToFix: 'Request verified PAN copy from client and re-enter.'
      });
    }
  });

  // Duplicate contact coordinates
  parties.forEach((p1, idx1) => {
    parties.forEach((p2, idx2) => {
      if (idx1 < idx2 && p1.role !== p2.role) {
        if (p1.phone && p2.phone && p1.phone.trim() === p2.phone.trim()) {
          fraudSignals.push({
            type: 'Collusive Contact Sharing',
            message: `Conflicting contact channels detected. Executing parties share the duplicate telephone number: ${p1.phone}. Indicates collusive self-dealing or potential dummy proxy representation.`,
            severity: 'high',
            howToFix: 'Update contact details to verify distinct OTP logins for all executing parties.'
          });
          factors.push('Collusive phone channel duplication');
        }
      }
    });
  });


  // =============================================================
  // 9. RECOMMENDATION ENGINE & SEVERITY RANKING
  // =============================================================

  // Recommendation 1: Add Indemnity Clause
  if (canonicalCode === 'SALE' && !selectedClauses.some(id => id.includes('indemnity') || id === 'std2' || id === 'cl2')) {
    recommendations.push({
      id: 'rec_indemnity',
      title: 'Append Deed360 Indemnity Covenants',
      action: 'Select and activate the Legal Heir Indemnity or Section 47A Protection clauses in Step 10.',
      severity: 'error',
      explanation: 'Without a clear indemnity clause, the buyer absorbs massive financial risk if undisclosed legal heirs challenge the title post-registration.'
    });
  }

  // Recommendation 2: Verify Parent Deed
  if (!history.parentDocNo) {
    recommendations.push({
      id: 'rec_parent_deed',
      title: 'Run Prior Title Chain Verification',
      action: 'Retrieve a certified copy of prior registered document from SRO to verify continuous ownership.',
      severity: 'error',
      explanation: 'SRO audits under Deed360 automatically scan parent indexes. Missing parent information triggers immediate compliance flags.'
    });
  } else {
    recommendations.push({
      id: 'rec_verify_ec',
      title: 'Obtain 30-Year Encumbrance Certificate',
      action: 'Submit an application on Tnreginet to fetch a clean EC for the survey plot.',
      severity: 'warning',
      explanation: 'An updated EC verifies that the property has no hidden mortgage liens, pending attachments, or private claims.'
    });
  }

  // Recommendation 3: Add Arbitration clause
  if (!selectedClauses.some(id => id.toLowerCase().includes('dispute') || id.toLowerCase().includes('arbitration'))) {
    recommendations.push({
      id: 'rec_arbitration',
      title: 'Incorporate Arbitration & Dispute Resolution',
      action: 'Add a dispute resolution clause to ensure rapid fast-track arbitration instead of 10-year civil court litigation.',
      severity: 'info',
      explanation: 'Standardized dispute resolution prevents legal gridlocks between contracting parties in case of metric disputes.'
    });
  }

  // Recommendation 4: Patta Mutation
  const firstSurvey = surveys[0];
  if (firstSurvey && !firstSurvey.pattaNo) {
    recommendations.push({
      id: 'rec_patta',
      title: 'Schedule Pre-mutation Patta Audit',
      action: 'Query the Any-Any Patta web service to confirm current mutation status of Survey No ' + (firstSurvey.surveyNo || '————') + '.',
      severity: 'warning',
      explanation: 'Patta number mapping is vital. A missing Patta Mutation blocks automatic name updates on Deed360 revenue logs.'
    });
  }


  // =============================================================
  // 7. RISK SCORING ENGINE
  // =============================================================
  let riskScore = 12; // Base risk score

  // Calculate based on issues found
  warnings.forEach(w => {
    if (w.severity === 'error') riskScore += 18;
    else if (w.severity === 'warning') riskScore += 8;
    else riskScore += 2;
  });

  fraudSignals.forEach(f => {
    if (f.severity === 'critical') riskScore += 25;
    else if (f.severity === 'high') riskScore += 15;
    else riskScore += 5;
  });

  // Limit score
  riskScore = Math.min(Math.max(riskScore, 0), 100);

  let riskBand: AIValidationExtendedResult['riskBand'] = 'Low';
  if (riskScore > 75) riskBand = 'Critical';
  else if (riskScore > 50) riskBand = 'High';
  else if (riskScore > 20) riskBand = 'Moderate';

  // Sort recommendations by severity (error -> warning -> info)
  const severityValue = { error: 3, warning: 2, info: 1 };
  recommendations.sort((a, b) => severityValue[b.severity] - severityValue[a.severity]);

  return {
    passed: !warnings.some(w => w.severity === 'error'),
    warnings,
    fraudScore: riskScore, // Map risk score as fraud score for backward compatibility if needed
    fraudAlerts: fraudSignals.map(fs => `[${fs.type}] ${fs.message}`),
    riskScore,
    riskBand,
    factors,
    fraudSignals,
    recommendations,
  };
}
