import { DeedWizardState, PartyRole } from '../types';

export type CanonicalDeedCode =
  | 'SALE'
  | 'SETTLEMENT'
  | 'GIFT'
  | 'PARTITION'
  | 'RELEASE'
  | 'LEASE'
  | 'MORTGAGE'
  | 'POA'
  | 'RECTIFICATION'
  | 'CANCELLATION'
  | 'TRUST'
  | 'PARTNERSHIP'
  | 'WILL';

export type SupportedDeedCode =
  | 'SALE'
  | 'SETTLEMENT'
  | 'GIFT'
  | 'PARTITION'
  | 'LEASE'
  | 'MORTGAGE'
  | 'POA';

export interface DeedTypeDefinition {
  code: CanonicalDeedCode;
  aliases: string[];
  nameEn: string;
  nameTa: string;
  desc: string;
  templateAvailable: boolean;
  grantorRole: PartyRole;
  granteeRole: PartyRole;
  acceptedGrantorRoles: PartyRole[];
  acceptedGranteeRoles: PartyRole[];
  grantorLabelEn: string;
  granteeLabelEn: string;
  grantorLabelTa: string;
  granteeLabelTa: string;
  requiresMonetaryConsideration: boolean;
  requiresPaymentReference: boolean;
  requiresParentHistory: boolean;
  considerationLabelEn: string;
  considerationLabelTa: string;
  advanceLabelEn: string;
  advanceLabelTa: string;
  scheduleTitleEn: string;
  scheduleTitleTa: string;
  defaultPrintProfile: string;
}

export const CANONICAL_DEED_TYPES: readonly DeedTypeDefinition[] = [
  {
    code: 'SALE',
    aliases: ['SALE', 'SALE DEED', 'ABSOLUTE SALE DEED', 'கிரயப் பத்திரம்'],
    nameEn: 'Sale Deed',
    nameTa: 'கிரயப் பத்திரம்',
    desc: 'Transfer of property ownership for a price',
    templateAvailable: true,
    grantorRole: 'Seller',
    granteeRole: 'Buyer',
    acceptedGrantorRoles: ['Seller'],
    acceptedGranteeRoles: ['Buyer'],
    grantorLabelEn: 'SELLER (VENDOR)',
    granteeLabelEn: 'BUYER (PURCHASER)',
    grantorLabelTa: 'விற்பனையாளர் (கிரயம் செய்பவர்)',
    granteeLabelTa: 'வாங்குபவர் (கிரயம் பெறுபவர்)',
    requiresMonetaryConsideration: true,
    requiresPaymentReference: true,
    requiresParentHistory: true,
    considerationLabelEn: 'Sale Consideration Amount (₹)',
    considerationLabelTa: 'கிரயத் தொகை',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF THE PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'SETTLEMENT',
    aliases: [
      'SETTLEMENT',
      'SETTLE',
      'SETTLEMENT DEED',
      'FAMILY SETTLEMENT DEED',
      'GIFT SETTLEMENT DEED',
      'செட்டில்மென்ட் பத்திரம்',
      'குடும்ப ஏற்பாட்டுப் பத்திரம்',
    ],
    nameEn: 'Settlement Deed',
    nameTa: 'செட்டில்மென்ட் பத்திரம்',
    desc: 'Transfer of property to family members',
    templateAvailable: true,
    grantorRole: 'Settlor',
    granteeRole: 'Settlee',
    acceptedGrantorRoles: ['Settlor', 'Donor', 'Seller'],
    acceptedGranteeRoles: ['Settlee', 'Donee', 'Buyer'],
    grantorLabelEn: 'SETTLOR',
    granteeLabelEn: 'SETTLEE (BENEFICIARY)',
    grantorLabelTa: 'செட்டில்மென்ட் வழங்குபவர்',
    granteeLabelTa: 'செட்டில்மென்ட் பெறுபவர் (பயனாளி)',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Monetary Consideration (₹) — Voluntary Family Settlement (₹0)',
    considerationLabelTa: 'பணப் பிரதிபலன் இல்லை (குடும்ப அன்பு)',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF SETTLED PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'செட்டில்மென்ட் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'GIFT',
    aliases: ['GIFT', 'GIFT DEED', 'தானப் பத்திரம்'],
    nameEn: 'Gift Deed',
    nameTa: 'தானப் பத்திரம்',
    desc: 'Voluntary transfer without consideration',
    templateAvailable: true,
    grantorRole: 'Donor',
    granteeRole: 'Donee',
    acceptedGrantorRoles: ['Donor', 'Settlor', 'Seller'],
    acceptedGranteeRoles: ['Donee', 'Settlee', 'Buyer'],
    grantorLabelEn: 'DONOR',
    granteeLabelEn: 'DONEE',
    grantorLabelTa: 'தானம் வழங்குபவர்',
    granteeLabelTa: 'தானம் பெறுபவர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Monetary Consideration (₹) — Voluntary Gift (₹0)',
    considerationLabelTa: 'பணப் பிரதிபலன் இல்லை (தானம்)',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF GIFTED PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'தானச் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'PARTITION',
    aliases: ['PARTITION', 'PARTITION DEED', 'பாகப்பிரிவினை பத்திரம்'],
    nameEn: 'Partition Deed',
    nameTa: 'பாகப்பிரிவினை பத்திரம்',
    desc: 'Division of joint property among co-owners',
    templateAvailable: true,
    grantorRole: 'First Co-owner',
    granteeRole: 'Second Co-owner',
    acceptedGrantorRoles: ['First Co-owner', 'Co-owner', 'Seller'],
    acceptedGranteeRoles: ['Second Co-owner', 'Co-owner', 'Buyer'],
    grantorLabelEn: 'FIRST PARTY (CO-OWNER / COPARCENER)',
    granteeLabelEn: 'SECOND PARTY (CO-OWNER / COPARCENER)',
    grantorLabelTa: 'முதல் பாகஸ்தர் (கூட்டு உரிமையாளர்)',
    granteeLabelTa: 'இரண்டாம் பாகஸ்தர் (கூட்டு உரிமையாளர்)',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Owelty / Equalization Amount (₹, if any)',
    considerationLabelTa: 'சமன்பாட்டுத் தொகை',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF PARTITIONED PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'பாகப்பிரிவினை சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'TN Legal',
  },
  {
    code: 'RELEASE',
    aliases: ['RELEASE', 'RELEASE DEED', 'RELINQUISHMENT DEED', 'விடுதலைப் பத்திரம்'],
    nameEn: 'Release Deed',
    nameTa: 'விடுதலைப் பத்திரம்',
    desc: 'Relinquishing rights in a shared property',
    templateAvailable: false,
    grantorRole: 'Seller',
    granteeRole: 'Buyer',
    acceptedGrantorRoles: ['Seller'],
    acceptedGranteeRoles: ['Buyer'],
    grantorLabelEn: 'RELEASOR',
    granteeLabelEn: 'RELEASEE',
    grantorLabelTa: 'உரிமை விடுவிப்பவர்',
    granteeLabelTa: 'உரிமை பெறுபவர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Release Consideration (₹)',
    considerationLabelTa: 'விடுதலைத் தொகை',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'LEASE',
    aliases: ['LEASE', 'LEASE DEED', 'RENTAL AGREEMENT', 'குத்தகைப் பத்திரம்'],
    nameEn: 'Lease Deed',
    nameTa: 'குத்தகைப் பத்திரம்',
    desc: 'Renting property for a specific period',
    templateAvailable: true,
    grantorRole: 'Lessor',
    granteeRole: 'Lessee',
    acceptedGrantorRoles: ['Lessor', 'Seller'],
    acceptedGranteeRoles: ['Lessee', 'Buyer'],
    grantorLabelEn: 'LESSOR (LANDLORD)',
    granteeLabelEn: 'LESSEE (TENANT)',
    grantorLabelTa: 'குத்தகைக்கு விடுபவர் (உரிமையாளர்)',
    granteeLabelTa: 'குத்தகைதாரர் (வாடகைதாரர்)',
    requiresMonetaryConsideration: true,
    requiresPaymentReference: false,
    requiresParentHistory: false,
    considerationLabelEn: 'Monthly Lease Rent / Premium (₹)',
    considerationLabelTa: 'மாத வாடகை / குத்தகைத் தொகை',
    advanceLabelEn: 'Security Deposit / Advance (₹)',
    advanceLabelTa: 'காப்புத் தொகை / முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF LEASED DEMISED PREMISES (SCHEDULE "A")',
    scheduleTitleTa: 'குத்தகைச் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'MORTGAGE',
    aliases: ['MORTGAGE', 'MORTGAGE DEED', 'MODT', 'அடமானப் பத்திரம்'],
    nameEn: 'Mortgage Deed',
    nameTa: 'அடமானப் பத்திரம்',
    desc: 'Pledging property as security for a loan',
    templateAvailable: true,
    grantorRole: 'Mortgagor',
    granteeRole: 'Mortgagee',
    acceptedGrantorRoles: ['Mortgagor', 'Seller'],
    acceptedGranteeRoles: ['Mortgagee', 'Buyer'],
    grantorLabelEn: 'MORTGAGOR (BORROWER)',
    granteeLabelEn: 'MORTGAGEE (LENDER)',
    grantorLabelTa: 'அடமானம் வைப்பவர் (கடன் பெறுபவர்)',
    granteeLabelTa: 'அடமானம் பெறுபவர் (கடன் வழங்குபவர்)',
    requiresMonetaryConsideration: true,
    requiresPaymentReference: true,
    requiresParentHistory: true,
    considerationLabelEn: 'Principal Loan Amount Secured (₹)',
    considerationLabelTa: 'அடமானக் கடன் தொகை',
    advanceLabelEn: 'Disbursed Tranche / Advance (₹)',
    advanceLabelTa: 'வழங்கப்பட்ட தொகை',
    scheduleTitleEn: 'SCHEDULE OF MORTGAGED PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'அடமானச் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'TN Legal',
  },
  {
    code: 'POA',
    aliases: [
      'POA',
      'POWER OF ATTORNEY',
      'GENERAL POWER OF ATTORNEY',
      'SPECIAL POWER OF ATTORNEY',
      'பவர் ஆஃப் அட்டார்னி',
      'பொது அதிகாரப் பத்திரம்',
    ],
    nameEn: 'Power of Attorney',
    nameTa: 'பவர் ஆஃப் அட்டார்னி',
    desc: 'Authorizing someone to act on your behalf',
    templateAvailable: true,
    grantorRole: 'Principal',
    granteeRole: 'Power Agent',
    acceptedGrantorRoles: ['Principal', 'Seller', 'Donor'],
    acceptedGranteeRoles: ['Power Agent', 'Buyer', 'Donee'],
    grantorLabelEn: 'PRINCIPAL (EXECUTANT)',
    granteeLabelEn: 'ATTORNEY / POWER AGENT',
    grantorLabelTa: 'முதல்வர் (அதிகாரம் வழங்குபவர்)',
    granteeLabelTa: 'பவர் ஏஜென்ட் (அதிகாரம் பெறுபவர்)',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Consideration (₹) — Agency Mandate (₹0)',
    considerationLabelTa: 'பணப் பிரதிபலன் இல்லை (அதிகாரப் பத்திரம்)',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF PROPERTY UNDER AGENCY MANDATE (SCHEDULE "A")',
    scheduleTitleTa: 'அதிகாரப் பத்திரச் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'Non-Judicial Stamp',
  },
  {
    code: 'RECTIFICATION',
    aliases: ['RECTIFICATION', 'RECTIFICATION DEED', 'பிழைத்திருத்தப் பத்திரம்'],
    nameEn: 'Rectification Deed',
    nameTa: 'பிழைத்திருத்தப் பத்திரம்',
    desc: 'Correcting errors in a previously registered deed',
    templateAvailable: false,
    grantorRole: 'Seller',
    granteeRole: 'Buyer',
    acceptedGrantorRoles: ['Seller'],
    acceptedGranteeRoles: ['Buyer'],
    grantorLabelEn: 'FIRST PARTY',
    granteeLabelEn: 'SECOND PARTY',
    grantorLabelTa: 'முதல் தரப்பினர்',
    granteeLabelTa: 'இரண்டாம் தரப்பினர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Consideration Amount (₹)',
    considerationLabelTa: 'தொகை',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'CANCELLATION',
    aliases: ['CANCELLATION', 'CANCELLATION DEED', 'ரத்துப் பத்திரம்'],
    nameEn: 'Cancellation Deed',
    nameTa: 'ரத்துப் பத்திரம்',
    desc: 'Cancelling a previously executed document',
    templateAvailable: false,
    grantorRole: 'Seller',
    granteeRole: 'Buyer',
    acceptedGrantorRoles: ['Seller'],
    acceptedGranteeRoles: ['Buyer'],
    grantorLabelEn: 'EXECUTANT',
    granteeLabelEn: 'COUNTERPARTY',
    grantorLabelTa: 'ரத்து செய்பவர்',
    granteeLabelTa: 'எதிர் தரப்பினர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Consideration Amount (₹)',
    considerationLabelTa: 'தொகை',
    advanceLabelEn: 'Advance Paid (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'TRUST',
    aliases: ['TRUST', 'TRUST DEED', 'டிரஸ்ட் பத்திரம்'],
    nameEn: 'Trust Deed',
    nameTa: 'டிரஸ்ட் பத்திரம்',
    desc: 'Creating a charitable or private trust',
    templateAvailable: false,
    grantorRole: 'Settlor',
    granteeRole: 'Settlee',
    acceptedGrantorRoles: ['Settlor'],
    acceptedGranteeRoles: ['Settlee'],
    grantorLabelEn: 'AUTHOR OF TRUST',
    granteeLabelEn: 'TRUSTEE',
    grantorLabelTa: 'நிறுவனர்',
    granteeLabelTa: 'அறங்காவலர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: false,
    considerationLabelEn: 'Trust Corpus Amount (₹)',
    considerationLabelTa: 'அறக்கட்டளை நிதி',
    advanceLabelEn: 'Initial Contribution (₹)',
    advanceLabelTa: 'ஆரம்ப நிதி',
    scheduleTitleEn: 'SCHEDULE OF TRUST PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'அறக்கட்டளை சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'PARTNERSHIP',
    aliases: ['PARTNERSHIP', 'PARTNERSHIP DEED', 'கூட்டாண்மைப் பத்திரம்'],
    nameEn: 'Partnership Deed',
    nameTa: 'கூட்டாண்மைப் பத்திரம்',
    desc: 'Agreement between business partners',
    templateAvailable: false,
    grantorRole: 'First Co-owner',
    granteeRole: 'Second Co-owner',
    acceptedGrantorRoles: ['First Co-owner', 'Co-owner'],
    acceptedGranteeRoles: ['Second Co-owner', 'Co-owner'],
    grantorLabelEn: 'FIRST PARTNER',
    granteeLabelEn: 'SECOND PARTNER',
    grantorLabelTa: 'முதல் பங்குதாரர்',
    granteeLabelTa: 'இரண்டாம் பங்குதாரர்',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: false,
    considerationLabelEn: 'Capital Contribution (₹)',
    considerationLabelTa: 'மூலதனத் தொகை',
    advanceLabelEn: 'Initial Paid-up Capital (₹)',
    advanceLabelTa: 'ஆரம்ப மூலதனம்',
    scheduleTitleEn: 'SCHEDULE OF PARTNERSHIP BUSINESS (SCHEDULE "A")',
    scheduleTitleTa: 'கூட்டாண்மை விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
  {
    code: 'WILL',
    aliases: ['WILL', 'WILL DEED', 'TESTAMENT', 'உயில் பத்திரம்'],
    nameEn: 'Will Deed',
    nameTa: 'உயில் பத்திரம்',
    desc: 'Legal declaration for property distribution after death',
    templateAvailable: false,
    grantorRole: 'Settlor',
    granteeRole: 'Settlee',
    acceptedGrantorRoles: ['Settlor', 'Donor'],
    acceptedGranteeRoles: ['Settlee', 'Donee'],
    grantorLabelEn: 'TESTATOR',
    granteeLabelEn: 'LEGATEE / BENEFICIARY',
    grantorLabelTa: 'உயில் எழுதுபவர்',
    granteeLabelTa: 'உயில் பயனாளி',
    requiresMonetaryConsideration: false,
    requiresPaymentReference: false,
    requiresParentHistory: true,
    considerationLabelEn: 'Consideration (₹)',
    considerationLabelTa: 'தொகை',
    advanceLabelEn: 'Advance (₹)',
    advanceLabelTa: 'முன்பணம்',
    scheduleTitleEn: 'SCHEDULE OF BEQUEATHED PROPERTY (SCHEDULE "A")',
    scheduleTitleTa: 'உயில் சொத்து விவரம் (ஷெட்யூல் "A")',
    defaultPrintProfile: 'A4 Standard',
  },
] as const;

export const SUPPORTED_DEED_TYPES: readonly DeedTypeDefinition[] = CANONICAL_DEED_TYPES.filter(
  (d) => d.templateAvailable
);

export const UNSUPPORTED_DEED_TYPES: readonly DeedTypeDefinition[] = CANONICAL_DEED_TYPES.filter(
  (d) => !d.templateAvailable
);

const DEED_LOOKUP_MAP = new Map<string, DeedTypeDefinition>();
for (const def of CANONICAL_DEED_TYPES) {
  DEED_LOOKUP_MAP.set(def.code.toUpperCase(), def);
  DEED_LOOKUP_MAP.set(def.nameEn.toUpperCase(), def);
  DEED_LOOKUP_MAP.set(def.nameTa.trim().toUpperCase(), def);
  for (const alias of def.aliases) {
    DEED_LOOKUP_MAP.set(alias.trim().toUpperCase(), def);
  }
}

export class TemplateUnavailableError extends Error {
  public readonly deedCode: string;
  constructor(deedType?: string) {
    const label = deedType?.trim() || 'Unknown';
    super(`Template unavailable for document type "${label}". Generation and export are blocked.`);
    this.name = 'TemplateUnavailableError';
    this.deedCode = label;
  }
}

export function resolveDeedType(input?: string | null): DeedTypeDefinition | null {
  if (!input || typeof input !== 'string') return null;
  const normalized = input.trim().toUpperCase();
  if (!normalized) return null;
  return DEED_LOOKUP_MAP.get(normalized) ?? null;
}

export function normalizeDeedCode(input?: string | null): CanonicalDeedCode | null {
  const resolved = resolveDeedType(input);
  return resolved ? resolved.code : null;
}

export function isDeedTemplateAvailable(input?: string | null): boolean {
  const resolved = resolveDeedType(input);
  return Boolean(resolved && resolved.templateAvailable);
}

export function getDeedDisplayName(input?: string | null): string {
  const resolved = resolveDeedType(input);
  return resolved ? resolved.nameEn : (input?.trim() || 'Unknown Deed');
}

export function getDefaultPartiesForDeedType(input?: string | null): {
  grantorRole: PartyRole;
  granteeRole: PartyRole;
} {
  const resolved = resolveDeedType(input);
  if (!resolved) {
    return { grantorRole: 'Seller', granteeRole: 'Buyer' };
  }
  return {
    grantorRole: resolved.grantorRole,
    granteeRole: resolved.granteeRole,
  };
}

export function partitionPartiesForDeedType(
  parties: DeedWizardState['parties'],
  deedTypeInput?: string | null
) {
  const def = resolveDeedType(deedTypeInput);
  if (!def) {
    return {
      grantors: parties.filter((p) => p.role === 'Seller'),
      grantees: parties.filter((p) => p.role === 'Buyer'),
    };
  }
  const grantors = parties.filter((p) => def.acceptedGrantorRoles.includes(p.role));
  const grantees = parties.filter((p) => def.acceptedGranteeRoles.includes(p.role));
  return { grantors, grantees };
}

export function validateDeedStateByType(state: DeedWizardState): string[] {
  const errors: string[] = [];
  const def = resolveDeedType(state.documentType);

  if (!def) {
    errors.push(`Template unavailable: Unrecognized document type "${state.documentType || 'None'}".`);
    return errors;
  }

  if (!def.templateAvailable) {
    errors.push(
      `Template unavailable: "${def.nameEn}" (${def.code}) does not have an implemented legal template. Generation and export are blocked.`
    );
    return errors;
  }

  const { grantors, grantees } = partitionPartiesForDeedType(state.parties || [], def.code);
  if (grantors.length === 0) {
    errors.push(`Missing primary party (${def.grantorRole}) required for ${def.nameEn}.`);
  }
  if (grantees.length === 0) {
    errors.push(`Missing counterparty (${def.granteeRole}) required for ${def.nameEn}.`);
  }

  for (const p of [...grantors, ...grantees]) {
    if (!p.name || p.name.trim().length < 2) {
      errors.push(`Party (${p.role}) full name is required.`);
    }
  }

  if (def.requiresMonetaryConsideration) {
    if (!state.transaction?.considerationAmount || state.transaction.considerationAmount <= 0) {
      errors.push(`${def.considerationLabelEn} must be greater than ₹0 for ${def.nameEn}.`);
    }
  } else if (def.code === 'GIFT' || def.code === 'SETTLEMENT' || def.code === 'POA') {
    if ((state.transaction?.considerationAmount || 0) > 0) {
      errors.push(`${def.nameEn} is executed without monetary consideration; consideration amount must be ₹0.`);
    }
  }

  if (def.requiresPaymentReference) {
    if (!state.transaction?.paymentRefNo || state.transaction.paymentRefNo.trim().length < 2) {
      errors.push(`Payment / UTR / Cheque reference number is required for ${def.nameEn}.`);
    }
  }

  return errors;
}
