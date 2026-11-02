import { DeedWizardState } from '../types';
import { normalizeDeedCode } from './deedTypes';

export interface FormattedClauseOutput {
  id: string;
  titleEn: string;
  titleTa: string;
  en: string;
  ta: string;
}

export interface ClauseMetadata {
  clauseVersion: string;
  clauseSource: string;
  clauseEngineVersion: string;
}

export interface ClauseDefinition {
  id: string;
  titleEn: string;
  titleTa: string;
  contentEn: string;
  contentTa: string;
  classification: 'Mandatory' | 'Recommended' | 'Conditional' | 'Custom';
  metadata: ClauseMetadata;
}

/**
 * 1. Production-Grade Legal Clause Dictionary (Bilingual English & Tamil)
 * Classified under Mandatory, Recommended, and Conditional as per STAR 2.0 specs.
 * Internal metadata is stored but excluded from final legal text output.
 */
export const PRODUCTION_CLAUSES: Record<string, ClauseDefinition> = {
  // --- MANDATORY SALE DEED COVENANTS (Sec 55 Transfer of Property Act, 1882) ---
  marketable_title: {
    id: 'marketable_title',
    titleEn: 'Marketable Title Assurance',
    titleTa: 'விற்கத்தக்க உரிமை உத்தரவாதம்',
    contentEn: 'The Vendor hereby covenants with the Purchaser that the Vendor has absolute right, full power and absolute authority to sell, transfer and convey the Scheduled Property hereby sold and that the Vendor has not done any act or suffered anything whereby their right to sell and convey has been impaired.',
    contentTa: 'விற்பனையாளர் இதன் மூலம் வாங்குபவருக்கு உறுதி அளிப்பது என்னவென்றால், விற்கப்படும் சொத்தை விற்பதற்கும், மாற்றுவதற்கும், ஒப்படைப்பதற்கும் தங்களுக்கு முழுமையான மற்றும் தடையற்ற உரிமை உள்ளது. மேலும் தங்களின் சொத்து மாற்று உரிமையை பாதிக்கும் எந்தவொரு செயலையும் தாங்கள் செய்யவில்லை என்று உறுதியளிக்கிறார்.',
    classification: 'Mandatory',
    metadata: {
      clauseVersion: '1.2.0',
      clauseSource: 'Section 55(1)(g) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  encumbrance_clear: {
    id: 'encumbrance_clear',
    titleEn: 'Encumbrance Clear Covenant',
    titleTa: 'வில்லங்கமின்மை பொறுப்புறுதி',
    contentEn: 'The Vendor declares and assures the Purchaser that the Scheduled Property is free from all encumbrances, charges, liens, attachments, legal disputes, mortgages or acquisitions by government authorities, and should any charge be found, the Vendor covenants to clear the same at their own cost and indemnify the Purchaser against all losses.',
    contentTa: 'அட்டவணைப்படுத்தப்பட்ட சொத்தின் மீது எவ்விதமான வில்லங்கங்கள், கடன்கள், ஜப்திகள், நீதிமன்ற வழக்குகள், அடமானங்கள் அல்லது அரசாங்க கையகப்படுத்துதல்கள் ஏதுமில்லை என்று விற்பனையாளர் உறுதியளிக்கிறார். சொத்தில் ஏதேனும் வில்லங்கம் இருப்பதாகப் பிற்காலத்தில் தெரியவந்தால், அதை விற்பனையாளர் சொந்த செலவில் தீர்த்து, வாங்குபவருக்கு ஏற்படும் இழப்புகளுக்கு ஈடுசெய்வார்.',
    classification: 'Mandatory',
    metadata: {
      clauseVersion: '1.2.0',
      clauseSource: 'Section 55(1)(g) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  possession_delivery: {
    id: 'possession_delivery',
    titleEn: 'Peaceful Possession Delivery',
    titleTa: 'அமைதியான சொத்து சுவாதீன ஒப்படைப்பு',
    contentEn: 'The Vendor has on this day delivered vacant, peaceful and physical possession of the Scheduled Property to the Purchaser, and the Purchaser shall henceforth hold, possess and enjoy the same as absolute owner without any hindrance or interruption from the Vendor or any persons claiming under them.',
    contentTa: 'சொத்தின் மீதான வெற்று, அமைதியான மற்றும் நேரடி சுவாதீனத்தை விற்பனையாளர் இன்று வாங்குபவரிடம் ஒப்படைத்துவிட்டார். இதன் மூலம் வாங்குபவர் இச்சொத்தை எவ்வித இடையூறும் இன்றி முழு உரிமையுடன் அனுபவிக்கலாம்.',
    classification: 'Mandatory',
    metadata: {
      clauseVersion: '1.2.0',
      clauseSource: 'Section 55(1)(f) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  consideration_declaration: {
    id: 'consideration_declaration',
    titleEn: 'Consideration Declaration',
    titleTa: 'கிரயத் தொகை பிரகடனம் மற்றும் ஒப்புதல்',
    contentEn: 'The Vendor hereby acknowledges the receipt of the full and final consideration amount as agreed between both parties, and declares that no further payments are outstanding from the Purchaser in respect of this absolute transfer.',
    contentTa: 'இரு தரப்பினராலும் ஒப்புக்கொள்ளப்பட்ட முழுமையான மற்றும் இறுதியான கிரயத் தொகையைப் பெற்றுக் கொண்டதை விற்பனையாளர் இதன் மூலம் ஒப்புக்கொள்கிறார், மேலும் இந்த முழுமையான உரிமை மாற்றத்திற்கு வாங்குபவரிடமிருந்து மேற்கொண்டு எந்தவொரு நிலுவைத் தொகையும் இல்லை என்றும் அறிவிக்கிறார்.',
    classification: 'Mandatory',
    metadata: {
      clauseVersion: '1.2.0',
      clauseSource: 'Section 54 of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  ownership_warranty: {
    id: 'ownership_warranty',
    titleEn: 'Ownership Warranty',
    titleTa: 'சொத்துரிமை மற்றும் முந்தைய உடன்படிக்கையின்மை உத்தரவாதம்',
    contentEn: 'The Vendor warrants that they are the sole, lawful, and absolute owner of the Scheduled Property, possessing clear, marketable title, and have not executed any prior agreement, deed of sale, mortgage, or transfer in favor of any other person.',
    contentTa: 'விற்பனையாளர் தாங்கள் மட்டுமே சொத்தின் சட்டப்பூர்வமான மற்றும் முழுமையான உரிமையாளர் என்றும், தெளிவான மற்றும் விற்கத்தக்க உரிமையைக் கொண்டுள்ளனர் என்றும், வேறு எந்த நபருக்கும் முந்தைய உடன்படிக்கை, கிரயப் பத்திரம், அடமானம் அல்லது உரிமை மாற்றம் எதையும் செய்யவில்லை என்றும் உத்தரவாதம் அளிக்கிறார்.',
    classification: 'Mandatory',
    metadata: {
      clauseVersion: '1.2.0',
      clauseSource: 'Section 55(2) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },

  // --- RECOMMENDED BILINGUAL COVENANTS ---
  tax_outgoings: {
    id: 'tax_outgoings',
    titleEn: 'Tax and Outgoings Settlement',
    titleTa: 'வரி மற்றும் அரசு கட்டணங்கள் தீர்வு',
    contentEn: 'All taxes, rates, assessments, electricity charges, and other outgoings payable in respect of the Scheduled Property up to the date of execution of this deed have been fully paid and discharged by the Vendor, and thereafter the same shall be paid by the Purchaser.',
    contentTa: 'இன்றுவரை சொத்து வரி, மின்சார கட்டணம், இதர வரிகள் மற்றும் அரசு நிலுவைகள் அனைத்தையும் விற்பனையாளர் செலுத்திவிட்டார். இதற்குப் பிந்தைய வரிகள் மற்றும் அரசு கட்டணங்களை வாங்குபவரே செலுத்த வேண்டும்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Section 55(1)(g) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  stamp_duty_liability: {
    id: 'stamp_duty_liability',
    titleEn: 'Stamp Duty and Registration Liability',
    titleTa: 'முத்திரைத்தாள் மற்றும் பதிவு கட்டணப் பொறுப்பு',
    contentEn: 'It is agreed between the parties that the expenses towards stamp duty, registration fees, drafting charges, and computer fees for registration of this Sale Deed shall be solely borne and paid by the Purchaser.',
    contentTa: 'இக்கிரயப் பத்திரப் பதிவிற்கான முத்திரைத் தாள் கட்டணம், பதிவு கட்டணம், ஆவண எழுத்துக் கட்டணங்கள் ஆகிய அனைத்தையும் வாங்குபவரே முழுமையாக ஏற்க ஒப்புக்கொள்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Indian Stamp Act, 1899 & TN Registration Rules',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  original_documents: {
    id: 'original_documents',
    titleEn: 'Original Title Document Handover',
    titleTa: 'மூல ஆவணங்கள் மற்றும் அசல் பத்திரங்கள் ஒப்படைப்பு',
    contentEn: 'The Vendor has on this day handed over all original title deeds, parent documents, tax receipts, and other relevant records relating to the Scheduled Property to the Purchaser, who acknowledges receipt of the same.',
    contentTa: 'சொத்தின் மூல ஆவணங்கள், தாய் பத்திரங்கள், வரி ரசீதுகள் மற்றும் சொத்து தொடர்பான அனைத்து அசல் ஆவணங்களையும் விற்பனையாளர் இன்று வாங்குபவரிடம் ஒப்படைத்துவிட்டார், வாங்குபவர் அதனைப் பெற்றுக் கொண்டதை ஒப்புக்கொள்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Section 55(3) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  patta_assistance: {
    id: 'patta_assistance',
    titleEn: 'Patta / Mutation Transfer Assistance',
    titleTa: 'பட்டா மற்றும் வருவாய்த்துறை பதிவேடு பெயர் மாற்ற ஒத்துழைப்பு',
    contentEn: 'The Vendor hereby covenants to cooperate, sign, and execute all necessary applications, declarations, and consent forms to assist the Purchaser in transferring the Patta, Chitta, Adangal, and municipal revenue records to the Purchaser\'s name.',
    contentTa: 'சொத்தின் பட்டா, சிட்டா, அடங்கல் மற்றும் நகராட்சி வருவாய்ப் பதிவேடுகளை வாங்குபவரின் பெயருக்கு மாற்றுவதற்குத் தேவையான அனைத்து விண்ணப்பங்கள், பிரகடனங்கள் மற்றும் சம்மதப் படிவங்களில் கையெழுத்திட்டு ஒத்துழைக்க விற்பனையாளர் ஒப்புக்கொள்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Tamil Nadu Patta Pass Book Act, 1983',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  no_prior_agreement: {
    id: 'no_prior_agreement',
    titleEn: 'No Prior Agreement Declaration',
    titleTa: 'முந்தைய சொத்து உடன்படிக்கையின்மை பிரகடனம்',
    contentEn: 'The Vendor solemnly declares that they have not entered into any agreement for sale, lease, joint venture, or any other transaction with any third party concerning the Scheduled Property, and that no prior agreements of any kind are currently subsisting.',
    contentTa: 'அட்டவணைப்படுத்தப்பட்ட சொத்து தொடர்பாக வேறு எந்த மூன்றாம் தரப்பினருடனும் விற்பனை உடன்படிக்கை, குத்தகை, கூட்டு முயற்சி அல்லது வேறு எந்த பரிவர்த்தனையும் செய்யவில்லை என்றும், தற்போது எந்தவொரு முந்தைய உடன்படிக்கையும் நடைமுறையில் இல்லை என்றும் விற்பனையாளர் உறுதியளிக்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Section 54 of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },

  // --- CONDITIONAL COVENANTS (Triggered dynamically based on risk profiles) ---
  mortgage_release: {
    id: 'mortgage_release',
    titleEn: 'Mortgage Release & NOC Covenant',
    titleTa: 'அடமான விடுதலை மற்றும் தடையில்லாச் சான்று உடன்படிக்கை',
    contentEn: 'In the event of any outstanding mortgage or bank charge on the Scheduled Property, the Vendor covenants to utilize the sale consideration to fully discharge and obtain a No Objection Certificate (NOC) and Mortgage Discharge Deed at their own expense prior to registration.',
    contentTa: 'விற்கப்படும் சொத்தின் மீது ஏதேனும் வங்கி கடன் அல்லது அடமானம் நிலுவையில் இருந்தால், விற்பனையாளர் இந்த விற்பனைத் தொகையைப் பயன்படுத்தி அதை முழுமையாக அடைத்து, பதிவுக்கு முன்னதாக தங்கள் சொந்தச் செலவில் தடையில்லாச் சான்றிதழ் (NOC) மற்றும் அடமான விடுதலைப் பத்திரத்தைப் பெற ஒப்புக்கொள்கிறார்.',
    classification: 'Conditional',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Indian Contract Act, 1872 & Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  tenant_occupancy: {
    id: 'tenant_occupancy',
    titleEn: 'Existing Tenant Occupancy Clause',
    titleTa: 'வாடகைதாரர் குடியிருப்பு மற்றும் குத்தகை உரிமை மாற்றம்',
    contentEn: 'The Purchaser acknowledges that the Scheduled Property is currently occupied by tenants, and the Vendor hereby transfers all landlord rights, rental security deposits, and the right to collect future rents to the Purchaser with effect from the date of execution.',
    contentTa: 'அட்டவணை சொத்தில் தற்போது வாடகைதாரர்கள் குடியிருப்பதை வாங்குபவர் ஒப்புக்கொள்கிறார். விற்பனையாளர் தனது நில உரிமையாளர் உரிமைகள், வாடகை வைப்புத் தொகைகள் மற்றும் வருங்கால வாடகையை வசூலிக்கும் உரிமையை இன்று முதல் வாங்குபவருக்கு மாற்றுகிறார்.',
    classification: 'Conditional',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act, 2017',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  gov_acquisition: {
    id: 'gov_acquisition',
    titleEn: 'Government Acquisition Protection',
    titleTa: 'அரசு கையகப்படுத்துதல் பாதுகாப்பு உத்தரவாதம்',
    contentEn: 'The Vendor declares that the Scheduled Property is not subject to any land acquisition notice, road widening project, or municipal reservation by any governmental body or local planning authority, and covenants to indemnify the Purchaser if any such pre-existing acquisition is discovered.',
    contentTa: 'சொத்து எந்தவொரு நில கையகப்படுத்தும் நடவடிக்கை, சாலை விரிவாக்கத் திட்டம் அல்லது அரசாங்க நகராட்சி ஒதுக்கீடுகளுக்கு உட்படவில்லை என்றும், அவ்வாறு ஏதேனும் முந்தைய கையகப்படுத்துதல் கண்டறியப்பட்டால் வாங்குபவருக்கு ஏற்படும் இழப்பை விற்பனையாளர் ஈடுசெய்வார் என்றும் உறுதியளிக்கிறார்.',
    classification: 'Conditional',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  litigation_disclosure: {
    id: 'litigation_disclosure',
    titleEn: 'Litigation Disclosure & Indemnity',
    titleTa: 'வழக்கு வெளிப்படுத்துதல் மற்றும் இழப்பீட்டுப் பொறுப்பு',
    contentEn: 'The Vendor covenants that there are no pending civil, criminal, revenue, or tax litigation proceedings in any court of law or tribunal concerning the Scheduled Property, and that the title of the Vendor is free from any legal challenge or lis pendens.',
    contentTa: 'சொத்து தொடர்பாக எந்தவொரு சிவில், கிரிமினல் அல்லது வருவாய் நீதிமன்றங்களிலும் வழக்குகள் நிலுவையில் இல்லை என்றும், விற்பனையாளரின் சொத்துரிமை எந்தவொரு சட்டரீதியான சவாலுக்கும் உட்படவில்லை என்றும் விற்பனையாளர் உறுதியளிக்கிறார்.',
    classification: 'Conditional',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Section 52 of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  gpa_validation: {
    id: 'gpa_validation',
    titleEn: 'GPA Validation Clause',
    titleTa: 'பொது அதிகாரப் பத்திர செல்லுபடித் தன்மை பிரகடனம்',
    contentEn: 'Where this deed is executed by a General Power of Attorney (GPA) holder, the Principal and the Agent jointly declare that the GPA registered is fully valid, in force, and has not been revoked, cancelled, or terminated as of the date of execution of this deed.',
    contentTa: 'இப்பத்திரம் பொது அதிகாரப் பத்திரம் (GPA) பெற்றவர் மூலம் எழுதப்படும் பட்சத்தில், குறிப்பிட்ட பொது அதிகாரப் பத்திரம் செல்லுபடியாகக்கூடியது என்றும், இன்று வரை அது ரத்து செய்யப்படவில்லை என்றும் அசல் உரிமையாளரும் முகவரும் இணைந்து பிரகடனம் செய்கிறார்கள்.',
    classification: 'Conditional',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Indian Powers of Attorney Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },

  // --- TAMIL NADU SPECIFIC COMPLIANCE COVENANTS ---
  tn_patta_mutation: {
    id: 'tn_patta_mutation',
    titleEn: 'Tamil Nadu Revenue Mutation (Patta/Chitta/Adangal) Clause',
    titleTa: 'தமிழ்நாடு வருவாய் பட்டா, சிட்டா மற்றும் அடங்கல் மாற்றுரிமை',
    contentEn: 'Both parties hereby agree that the Scheduled Property is fully registered under Patta/Chitta/Adangal records of Tamil Nadu Revenue Department, and the Vendor undertakes to provide all administrative assistance and execute necessary mutation applications on the TN e-District portal within thirty (30) days from registration.',
    contentTa: 'சொத்தானது தமிழ்நாட்டின் வருவாய்த்துறை பட்டா, சிட்டா மற்றும் அடங்கல் பதிவேடுகளின் கீழ் முறையாகப் பதிவு செய்யப்பட்டுள்ளது என்றும், விற்பனையாளர் பதிவு செய்யப்பட்ட முப்பது (30) நாட்களுக்குள் தமிழ்நாடு இ-சேவை இணையதளத்தில் பட்டா மாறுதலுக்கான அனைத்து உதவிகளையும் ஒப்புதல்களையும் வழங்க ஒப்புக்கொள்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Tamil Nadu Patta Pass Book Act, 1983 & TN Land Revenue Rules',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  tn_tslr_compliance: {
    id: 'tn_tslr_compliance',
    titleEn: 'TSLR Town Survey Land Register Compliance',
    titleTa: 'நகர நில அளவைப் பதிவேடு (TSLR) இணக்கப் பிரகடனம்',
    contentEn: 'The Vendor warrants that the Scheduled Property matches the dimensions, survey limits, and ownership details recorded in the Town Survey Land Register (TSLR) of the municipal corporation, and agrees to indemnify the Purchaser against any administrative discrepancies found in the revenue division.',
    contentTa: 'விற்கப்படும் சொத்தின் பரப்பளவு, எல்லைகள் மற்றும் உரிமை விபரங்கள் அனைத்தும் நகராட்சி மற்றும் மாநகராட்சியின் நகர நில அளவைப் பதிவேட்டுடன் (TSLR) முழுமையாக ஒத்துப்போகிறது என்றும், இதில் ஏதேனும் குளறுபடிகள் கண்டறியப்பட்டால் அதற்கு விற்பனையாளரே பொறுப்பாவார் என்றும் உறுதியளிக்கிறார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.1.0',
      clauseSource: 'Tamil Nadu Land Survey and Boundaries Act, 1923',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },

  // --- ARBITRATION & INDEMNITY ---
  indemnity: {
    id: 'indemnity',
    titleEn: 'Indemnity and Liability Clause',
    titleTa: 'இழப்பீட்டு உடன்படிக்கை',
    contentEn: 'The Vendor hereby covenants to fully indemnify, defend, and hold harmless the Purchaser from and against all losses, damages, liabilities, claims, and costs arising out of any defect in title, pending litigation, or claims by third parties claiming any interest in the Scheduled Property.',
    contentTa: 'விற்கப்படும் சொத்தின் மீது ஏதேனும் சட்டரீதியான வில்லங்கம், முந்தைய உரிமை கோரல்கள், அல்லது நீதிமன்ற வழக்குகள் காரணமாக வாங்குபவருக்கு ஏதேனும் இழப்பு ஏற்பட்டால், அதற்கு விற்பனையாளரே முழுப் பொறுப்பு ஏற்று அதற்கான முழு இழப்பீட்டையும் வாங்குபவருக்கு வழங்க கடமைப்பட்டவர் ஆவார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Section 124 of the Indian Contract Act, 1872',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  arbitration: {
    id: 'arbitration',
    titleEn: 'Arbitration and Dispute Resolution',
    titleTa: 'மத்தியஸ்தம் மற்றும் மாற்றுத் தீர்வு',
    contentEn: 'In the event of any dispute, difference, or controversy arising out of or in connection with this deed, the parties shall attempt to resolve it amicably. If unresolved, it shall be referred to arbitration in accordance with the Indian Arbitration and Conciliation Act, 1996, with the venue of arbitration located in Chennai, Tamil Nadu.',
    contentTa: 'இப்பத்திரத்தின் அடிப்படையில் ஏதேனும் கருத்து வேறுபாடுகளோ அல்லது தாவாக்களோ ஏற்பட்டால், இரு தரப்பினரும் சுமுகமாக பேசித் தீர்க்க முயல வேண்டும். சுமுகமாக தீர்க்க முடியாத பட்சத்தில், அது இந்திய மத்தியஸ்த மற்றும் சமரசச் சட்டம் 1996-ன் படி சென்னை நீதிமன்ற எல்லைக்குட்பட்ட மத்தியஸ்தத்திற்கு சமர்ப்பிக்கப்பட வேண்டும்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Indian Arbitration and Conciliation Act, 1996',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  risk_transfer: {
    id: 'risk_transfer',
    titleEn: 'Risk Transfer Clause',
    titleTa: 'இழப்பு மற்றும் அபாயங்கள் மாற்றம்',
    contentEn: 'All risks of loss, damage, or destruction to the Scheduled Property shall be transferred from the Vendor to the Purchaser immediately upon the execution of this deed and delivery of physical possession, from which moment the Purchaser shall bear all outgoings and enjoy all benefits of ownership.',
    contentTa: 'சொத்தின் மீதான அனைத்து இழப்புகள், சேதங்கள் அல்லது அழிவுகளுக்கான அபாயங்கள் இப்பத்திரம் எழுதப்பட்டு நேரடி சுவாதீனம் ஒப்படைக்கப்பட்ட உடனே விற்பனையாளரிடமிருந்து வாங்குபவருக்கு மாற்றப்படுகிறது. அதுமுதல் வாங்குபவரே இதன் முழு பலன்களையும் அனுபவிப்பார் மற்றும் வரிகளைச் செலுத்துவார்.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Section 55(4)(a) of the Transfer of Property Act, 1882',
      clauseEngineVersion: 'LCE-v2.0'
    }
  },
  encumbrance_certificate: {
    id: 'encumbrance_certificate',
    titleEn: 'Encumbrance Certificate Verification',
    titleTa: 'வில்லங்கச் சான்றிதழ் விபரம்',
    contentEn: 'The Vendor warrants that they have obtained and verified the Encumbrance Certificate (EC) for the Scheduled Property for a period of 30 years, and that no encumbrances, claims, or charges of any kind are registered against the property as of the date of execution of this deed.',
    contentTa: 'விற்பனையாளர் இச்சொத்தின் கடந்த 30 ஆண்டுகால வில்லங்கச் சான்றிதழை (EC) சரிபார்த்து எவ்வித வில்லங்கமும் இல்லை என வாங்குபவருக்கு உறுதியளிக்கிறார். இப்பதிவு நாள் வரை இச்சொத்தின் மீது வேறு எந்தவிதமான உரிமை கோரல்களோ, வில்லங்கங்களோ பதிவு செய்யப்படவில்லை.',
    classification: 'Recommended',
    metadata: {
      clauseVersion: '1.0.0',
      clauseSource: 'Indian Registration Act, 1908',
      clauseEngineVersion: 'LCE-v2.0'
    }
  }
};

/**
 * Legacy support dictionary mapping for backward compatibility.
 */
export const LEGAL_CLAUSES: Record<string, { id: string; titleEn: string; titleTa: string; contentEn: string; contentTa: string }> = {};
Object.keys(PRODUCTION_CLAUSES).forEach((key) => {
  const pc = PRODUCTION_CLAUSES[key];
  LEGAL_CLAUSES[key] = {
    id: pc.id,
    titleEn: pc.titleEn,
    titleTa: pc.titleTa,
    contentEn: pc.contentEn,
    contentTa: pc.contentTa
  };
});

/**
 * 2. Clause Injection Logic
 * Evaluates document type, property type, transaction parameters, ownership history risks,
 * and compliance parameters to dynamically recommend covenants.
 */
export function getDynamicClauses(state: DeedWizardState): ClauseDefinition[] {
  const clauses: ClauseDefinition[] = [];

  const docType = normalizeDeedCode(state.documentType) || 'SALE';
  const propType = (state.property?.propertyType || '').toUpperCase();
  
  // 1. Standard sale deed clauses (for Sale Deeds)
  if (docType === 'SALE') {
    clauses.push(PRODUCTION_CLAUSES.marketable_title);
    clauses.push(PRODUCTION_CLAUSES.encumbrance_clear);
    clauses.push(PRODUCTION_CLAUSES.possession_delivery);
    clauses.push(PRODUCTION_CLAUSES.consideration_declaration);
    clauses.push(PRODUCTION_CLAUSES.ownership_warranty);
  }

  // 2. Recommended Clauses
  // Tax & Outgoings Settlement
  if (docType === 'SALE' || docType === 'SETTLEMENT' || docType === 'GIFT' || docType === 'LEASE') {
    clauses.push(PRODUCTION_CLAUSES.tax_outgoings);
  }
  
  // Stamp duty and registration liability
  clauses.push(PRODUCTION_CLAUSES.stamp_duty_liability);

  // Original Document Handover (recommended for transfers)
  if (docType === 'SALE' || docType === 'GIFT' || docType === 'SETTLEMENT') {
    clauses.push(PRODUCTION_CLAUSES.original_documents);
  }

  // Patta / Mutation transfer and TN-specific patta compliance
  if (docType === 'SALE' || docType === 'SETTLEMENT' || docType === 'GIFT' || docType === 'PARTITION') {
    clauses.push(PRODUCTION_CLAUSES.patta_assistance);
    clauses.push(PRODUCTION_CLAUSES.tn_patta_mutation);
  }

  // No Prior Agreement Declaration
  if (docType === 'SALE' || docType === 'MORTGAGE') {
    clauses.push(PRODUCTION_CLAUSES.no_prior_agreement);
  }

  // TSLR Compliance (if the property is in an urban/town area, i.e., has TSLR or block/ward, or is in Chennai/metro)
  const isUrban = state.property?.district?.toUpperCase().includes('CHENNAI') || 
                  !!state.property?.ward || 
                  !!state.property?.block || 
                  !!state.survey?.tslrNo;
  if (isUrban && (docType === 'SALE' || docType === 'GIFT')) {
    clauses.push(PRODUCTION_CLAUSES.tn_tslr_compliance);
  }

  // 3. Conditional Clauses Injection
  const hasMortgageRisk = state.ownershipHistory?.historyNarrative?.toLowerCase().includes('mortgage') ||
                          state.ownershipHistory?.historyNarrative?.toLowerCase().includes('loan') ||
                          state.ownershipHistory?.priorOwners?.toLowerCase().includes('bank') ||
                          state.transaction?.paymentMode?.toLowerCase().includes('loan') ||
                          docType === 'MORTGAGE';
  if (hasMortgageRisk) {
    clauses.push(PRODUCTION_CLAUSES.mortgage_release);
  }

  const hasTenantRisk = propType.includes('COMMERCIAL') ||
                        state.ownershipHistory?.historyNarrative?.toLowerCase().includes('tenant') ||
                        state.ownershipHistory?.historyNarrative?.toLowerCase().includes('lease') ||
                        state.ownershipHistory?.historyNarrative?.toLowerCase().includes('rent') ||
                        docType === 'LEASE';
  if (hasTenantRisk) {
    clauses.push(PRODUCTION_CLAUSES.tenant_occupancy);
  }

  const hasAcquisitionRisk = propType.includes('PLOT') || propType.includes('LAND') || 
                             state.ownershipHistory?.historyNarrative?.toLowerCase().includes('acquisition') ||
                             state.ownershipHistory?.historyNarrative?.toLowerCase().includes('highway') ||
                             state.ownershipHistory?.historyNarrative?.toLowerCase().includes('widening');
  if (hasAcquisitionRisk) {
    clauses.push(PRODUCTION_CLAUSES.gov_acquisition);
  }

  const hasLitigationRisk = state.ownershipHistory?.historyNarrative?.toLowerCase().includes('dispute') ||
                            state.ownershipHistory?.historyNarrative?.toLowerCase().includes('litigation') ||
                            state.ownershipHistory?.historyNarrative?.toLowerCase().includes('court') ||
                            state.ownershipHistory?.historyNarrative?.toLowerCase().includes('suit') ||
                            state.ownershipHistory?.priorOwners?.toLowerCase().includes('court');
  if (hasLitigationRisk) {
    clauses.push(PRODUCTION_CLAUSES.litigation_disclosure);
  }

  const hasGpa = state.parties?.some(p => 
    p.name?.toLowerCase().includes('gpa') || 
    p.name?.toLowerCase().includes('power of attorney') || 
    p.fatherName?.toLowerCase().includes('gpa') || 
    p.address?.toLowerCase().includes('gpa')
  ) ||
  state.ownershipHistory?.historyNarrative?.toLowerCase().includes('gpa') ||
  state.ownershipHistory?.historyNarrative?.toLowerCase().includes('power of attorney') ||
  docType === 'POA';
  if (hasGpa) {
    clauses.push(PRODUCTION_CLAUSES.gpa_validation);
  }

  return clauses;
}

/**
 * Injects only the clauses explicitly selected by the user in the draft state.
 * Never forces unselected assertions of clean title, completed payment, or delivered possession.
 */
export function injectClauses(selectedClauseIds: string[], state?: DeedWizardState): FormattedClauseOutput[] {
  const results: FormattedClauseOutput[] = [];
  const addedIds = new Set<string>();

  const addClause = (c: ClauseDefinition) => {
    if (!addedIds.has(c.id)) {
      results.push({
        id: c.id,
        titleEn: c.titleEn,
        titleTa: c.titleTa,
        en: c.contentEn,
        ta: c.contentTa
      });
      addedIds.add(c.id);
    }
  };

  if (state && selectedClauseIds && selectedClauseIds.length > 0) {
    const dynamicClauses = getDynamicClauses(state);
    dynamicClauses.forEach((c) => {
      const isSelected = selectedClauseIds.some(id => {
        const norm = id.toLowerCase();
        return norm === c.id.toLowerCase() || 
               (norm === 'cl1' && c.id === 'marketable_title') ||
               (norm === 'cl2' && c.id === 'encumbrance_clear') ||
               (norm === 'cl3' && c.id === 'possession_delivery') ||
               (norm === 'cl4' && c.id === 'tax_outgoings') ||
               (norm === 'cl5' && c.id === 'stamp_duty_liability') ||
               (norm === 'warranty' && c.id === 'marketable_title') ||
               (norm === 'encumbrance' && c.id === 'encumbrance_clear') ||
               (norm === 'possession' && c.id === 'possession_delivery') ||
               (norm === 'property_tax' && c.id === 'tax_outgoings') ||
               (norm === 'stamp_duty' && c.id === 'stamp_duty_liability') ||
               (norm === 'indemnity' && c.id === 'indemnity') ||
               (norm === 'arbitration' && c.id === 'arbitration') ||
               (norm === 'dispute resolution' && c.id === 'arbitration') ||
               (norm === 'encumbrance_certificate' && c.id === 'encumbrance_certificate') ||
               (norm === 'risk_transfer' && c.id === 'risk_transfer');
      });

      if (isSelected) {
        addClause(c);
      }
    });
  }

  // Resolve explicitly selected clauses
  if (selectedClauseIds && selectedClauseIds.length > 0) {
    selectedClauseIds.forEach((id) => {
      let targetKey = id.toLowerCase();
      if (targetKey === 'cl1' || targetKey === 'warranty') targetKey = 'marketable_title';
      else if (targetKey === 'cl2' || targetKey === 'encumbrance') targetKey = 'encumbrance_clear';
      else if (targetKey === 'cl3' || targetKey === 'possession') targetKey = 'possession_delivery';
      else if (targetKey === 'cl4' || targetKey === 'property_tax') targetKey = 'tax_outgoings';
      else if (targetKey === 'cl5' || targetKey === 'stamp_duty') targetKey = 'stamp_duty_liability';
      else if (targetKey === 'dispute resolution') targetKey = 'arbitration';

      const definition = PRODUCTION_CLAUSES[targetKey];
      if (definition) {
        addClause(definition);
      }
    });
  }

  return results;
}

/**
 * Builds standard formatting for clauses section as reusable HTML blocks.
 * Does NOT render internal metadata such as version, source, or engine version.
 */
export function generateClausesSection(selectedClauseIds: string[], state?: DeedWizardState): { en: string; ta: string } {
  const clauses = injectClauses(selectedClauseIds, state);
  if (clauses.length === 0) {
    return {
      en: '<p class="italic text-slate-400">No covenants or custom clauses selected for this draft.</p>',
      ta: '<p class="italic text-slate-400">உடன்படிக்கைகள் அல்லது தனிப்பயன் உட்பிரிவுகள் எதுவும் தேர்ந்தெடுக்கப்படவில்லை.</p>'
    };
  }

  const enHtml = clauses.map((c, idx) => {
    return `
      <div class="mb-4">
        <p class="font-bold text-xs text-slate-800">${idx + 1}. ${c.titleEn}:</p>
        <p class="text-xs text-slate-600 pl-4 mt-0.5">${c.en}</p>
      </div>
    `;
  }).join('');

  const taHtml = clauses.map((c, idx) => {
    return `
      <div class="mb-4">
        <p class="font-bold text-xs text-slate-800">${idx + 1}. ${c.titleTa}:</p>
        <p class="text-xs text-slate-600 pl-4 mt-0.5">${c.ta}</p>
      </div>
    `;
  }).join('');

  return {
    en: enHtml,
    ta: taHtml
  };
}
