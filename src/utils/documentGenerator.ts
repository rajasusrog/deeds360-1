import { DeedWizardState } from '../types';
import { generateSaleDeed } from './templates/saleDeed';
import { generateSettlementDeed } from './templates/settlementDeed';
import { generateGiftDeed } from './templates/giftDeed';
import { generatePartitionDeed } from './templates/partitionDeed';
import { generateLeaseDeed } from './templates/leaseDeed';
import { generateMortgageDeed } from './templates/mortgageDeed';
import { generatePowerOfAttorney } from './templates/powerOfAttorney';
import { resolveDeedType, TemplateUnavailableError } from './deedTypes';
import { sanitizeLegalSection } from './htmlSanitizer';

export interface LegalSection {
  id: string;
  titleEn: string;
  titleTa: string;
  contentEn: string;
  contentTa: string;
}

export interface GeneratedDeed {
  metadata: {
    templateVersion: string;
    generatedAt: string;
    revisionNo: number;
    docNo: string;
    deedCode: string;
    deedNameEn: string;
  };
  sections: LegalSection[];
}

/**
 * Main compilation entry point for the Legal Document Generation Engine.
 * Strictly dispatches only supported deed types with implemented templates:
 * SALE, SETTLEMENT (including legacy SETTLE), GIFT, PARTITION, LEASE, MORTGAGE, and POA.
 * Throws TemplateUnavailableError for any unsupported or unknown deed type — NEVER falls back to Sale Deed.
 */
export function compileDeedDocument(state: DeedWizardState, docNo: string = 'DEED/2026/0001'): GeneratedDeed {
  const deedDef = resolveDeedType(state?.documentType);

  if (!deedDef || !deedDef.templateAvailable) {
    throw new TemplateUnavailableError(state?.documentType);
  }

  let sections: LegalSection[];

  switch (deedDef.code) {
    case 'SALE':
      sections = generateSaleDeed(state);
      break;
    case 'SETTLEMENT':
      sections = generateSettlementDeed(state);
      break;
    case 'GIFT':
      sections = generateGiftDeed(state);
      break;
    case 'PARTITION':
      sections = generatePartitionDeed(state);
      break;
    case 'LEASE':
      sections = generateLeaseDeed(state);
      break;
    case 'MORTGAGE':
      sections = generateMortgageDeed(state);
      break;
    case 'POA':
      sections = generatePowerOfAttorney(state);
      break;
    default:
      throw new TemplateUnavailableError(state?.documentType);
  }

  const sanitizedSections = (sections || []).map((sec) => sanitizeLegalSection(sec));

  return {
    metadata: {
      templateVersion: 'v2.1.0-DRAFT',
      generatedAt: new Date().toISOString(),
      revisionNo: 1,
      docNo,
      deedCode: deedDef.code,
      deedNameEn: deedDef.nameEn
    },
    sections: sanitizedSections
  };
}

/**
 * Safe compilation wrapper for UI preview components.
 */
export function tryCompileDeedDocument(
  state: DeedWizardState,
  docNo: string = 'DEED/2026/0001'
): { deed: GeneratedDeed | null; error: string | null } {
  try {
    const deed = compileDeedDocument(state, docNo);
    return { deed, error: null };
  } catch (err: any) {
    return {
      deed: null,
      error: err?.message || 'Template unavailable'
    };
  }
}
