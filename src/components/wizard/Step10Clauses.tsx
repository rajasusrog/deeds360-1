import { Check } from 'lucide-react';

interface ClauseItem {
  id: string;
  title: string;
  category: string;
  contentEn: string;
  contentTa: string;
}

interface Step10ClausesProps {
  selectedClauses: string[];
  onChange: (selected: string[]) => void;
}

export const CLAUSES_LIST: ClauseItem[] = [
  // --- MANDATORY COVENANTS ---
  {
    id: 'marketable_title',
    title: 'Marketable Title Assurance',
    category: 'Mandatory Covenant',
    contentEn: 'The Vendor hereby covenants with the Purchaser that the Vendor has absolute right, full power and absolute authority to sell, transfer and convey the Scheduled Property hereby sold and that the Vendor has not done any act or suffered anything whereby their right to sell and convey has been impaired.',
    contentTa: 'விற்பனையாளர் இதன் மூலம் வாங்குபவருக்கு உறுதி அளிப்பது என்னவென்றால், விற்கப்படும் சொத்தை விற்பதற்கும், மாற்றுவதற்கும், ஒப்படைப்பதற்கும் தங்களுக்கு முழுமையான மற்றும் தடையற்ற உரிமை உள்ளது. மேலும் தங்களின் சொத்து மாற்று உரிமையை பாதிக்கும் எந்தவொரு செயலையும் தாங்கள் செய்யவில்லை என்று உறுதியளிக்கிறார்.'
  },
  {
    id: 'encumbrance_clear',
    title: 'Encumbrance Clear Covenant',
    category: 'Mandatory Covenant',
    contentEn: 'The Vendor declares and assures the Purchaser that the Scheduled Property is free from all encumbrances, charges, liens, attachments, legal disputes, mortgages or acquisitions by government authorities, and should any charge be found, the Vendor covenants to clear the same at their own cost and indemnify the Purchaser against all losses.',
    contentTa: 'அட்டவணைப்படுத்தப்பட்ட சொத்தின் மீது எவ்விதமான வில்லங்கங்கள், கடன்கள், ஜப்திகள், நீதிமன்ற வழக்குகள், அடமானங்கள் அல்லது அரசாங்க கையகப்படுத்துதல்கள் ஏதுமில்லை என்று விற்பனையாளர் உறுதியளிக்கிறார். சொத்தில் ஏதேனும் வில்லங்கம் இருப்பதாகப் பிற்காலத்தில் தெரியவந்தால், அதை விற்பனையாளர் சொந்த செலவில் தீர்த்து, வாங்குபவருக்கு ஏற்படும் இழப்புகளுக்கு ஈடுசெய்வார்.'
  },
  {
    id: 'possession_delivery',
    title: 'Peaceful Possession Delivery',
    category: 'Mandatory Covenant',
    contentEn: 'The Vendor has on this day delivered vacant, peaceful and physical possession of the Scheduled Property to the Purchaser, and the Purchaser shall henceforth hold, possess and enjoy the same as absolute owner without any hindrance or interruption from the Vendor or any persons claiming under them.',
    contentTa: 'சொத்தின் மீதான வெற்று, அமைதியான மற்றும் நேரடி சுவாதீனத்தை விற்பனையாளர் இன்று வாங்குபவரிடம் ஒப்படைத்துவிட்டார். இதன் மூலம் வாங்குபவர் இச்சொத்தை எவ்வித இடையூறும் இன்றி முழு உரிமையுடன் அனுபவிக்கலாம்.'
  },
  {
    id: 'consideration_declaration',
    title: 'Consideration Declaration',
    category: 'Mandatory Covenant',
    contentEn: 'The Vendor hereby acknowledges the receipt of the full and final consideration amount as agreed between both parties, and declares that no further payments are outstanding from the Purchaser in respect of this absolute transfer.',
    contentTa: 'இரு தரப்பினராலும் ஒப்புக்கொள்ளப்பட்ட முழுமையான மற்றும் இறுதியான கிரயத் தொகையைப் பெற்றுக் கொண்டதை விற்பனையாளர் இதன் மூலம் ஒப்புக்கொள்கிறார், மேலும் இந்த முழுமையான உரிமை மாற்றத்திற்கு வாங்குபவரிடமிருந்து மேற்கொண்டு எந்தவொரு நிலுவைத் தொகையும் இல்லை என்றும் அறிவிக்கிறார்.'
  },
  {
    id: 'ownership_warranty',
    title: 'Ownership Warranty',
    category: 'Mandatory Covenant',
    contentEn: 'The Vendor warrants that they are the sole, lawful, and absolute owner of the Scheduled Property, possessing clear, marketable title, and have not executed any prior agreement, deed of sale, mortgage, or transfer in favor of any other person.',
    contentTa: 'விற்பனையாளர் தாங்கள் மட்டுமே சொத்தின் சட்டப்பூர்வமான மற்றும் முழுமையான உரிமையாளர் என்றும், தெளிவான மற்றும் விற்கத்தக்க உரிமையைக் கொண்டுள்ளனர் என்றும், வேறு எந்த நபருக்கும் முந்தைய உடன்படிக்கை, கிரயப் பத்திரம், அடமானம் அல்லது உரிமை மாற்றம் எதையும் செய்யவில்லை என்றும் உத்தரவாதம் அளிக்கிறார்.'
  },

  // --- RECOMMENDED COVENANTS ---
  {
    id: 'tax_outgoings',
    title: 'Tax and Outgoings Settlement',
    category: 'Recommended Covenant',
    contentEn: 'All taxes, rates, assessments, electricity charges, and other outgoings payable in respect of the Scheduled Property up to the date of execution of this deed have been fully paid and discharged by the Vendor, and thereafter the same shall be paid by the Purchaser.',
    contentTa: 'இன்றுவரை சொத்து வரி, மின்சார கட்டணம், இதர வரிகள் மற்றும் அரசு நிலுவைகள் அனைத்தையும் விற்பனையாளர் செலுத்திவிட்டார். இதற்குப் பிந்தைய வரிகள் மற்றும் அரசு கட்டணங்களை வாங்குபவரே செலுத்த வேண்டும்.'
  },
  {
    id: 'stamp_duty_liability',
    title: 'Stamp Duty and Registration Liability',
    category: 'Recommended Covenant',
    contentEn: 'It is agreed between the parties that the expenses towards stamp duty, registration fees, drafting charges, and computer fees for registration of this Sale Deed shall be solely borne and paid by the Purchaser.',
    contentTa: 'இக்கிரயப் பத்திரப் பதிவிற்கான முத்திரைத் தாள் கட்டணம், பதிவு கட்டணம், ஆவண எழுத்துக் கட்டணங்கள் ஆகிய அனைத்தையும் வாங்குபவரே முழுமையாக ஏற்க ஒப்புக்கொள்கிறார்.'
  },
  {
    id: 'original_documents',
    title: 'Original Title Document Handover',
    category: 'Recommended Covenant',
    contentEn: 'The Vendor has on this day handed over all original title deeds, parent documents, tax receipts, and other relevant records relating to the Scheduled Property to the Purchaser, who acknowledges receipt of the same.',
    contentTa: 'சொத்தின் மூல ஆவணங்கள், தாய் பத்திரங்கள், வரி ரசீதுகள் மற்றும் சொத்து தொடர்பான அனைத்து அசல் ஆவணங்களையும் விற்பனையாளர் இன்று வாங்குபவரிடம் ஒப்படைத்துவிட்டார், வாங்குபவர் அதனைப் பெற்றுக் கொண்டதை ஒப்புக்கொள்கிறார்.'
  },
  {
    id: 'patta_assistance',
    title: 'Patta / Mutation Transfer Assistance',
    category: 'Recommended Covenant',
    contentEn: 'The Vendor hereby covenants to cooperate, sign, and execute all necessary applications, declarations, and consent forms to assist the Purchaser in transferring the Patta, Chitta, Adangal, and municipal revenue records to the Purchaser\'s name.',
    contentTa: 'சொத்தின் பட்டா, சிட்டா, அடங்கல் மற்றும் நகராட்சி வருவாய்ப் பதிவேடுகளை வாங்குபவரின் பெயருக்கு மாற்றுவதற்குத் தேவையான அனைத்து விண்ணப்பங்கள், பிரகடனங்கள் மற்றும் சம்மதப் படிவங்களில் கையெழுத்திட்டு ஒத்துழைக்க விற்பனையாளர் ஒப்புக்கொள்கிறார்.'
  },
  {
    id: 'no_prior_agreement',
    title: 'No Prior Agreement Declaration',
    category: 'Recommended Covenant',
    contentEn: 'The Vendor solemnly declares that they have not entered into any agreement for sale, lease, joint venture, or any other transaction with any third party concerning the Scheduled Property, and that no prior agreements of any kind are currently subsisting.',
    contentTa: 'அட்டவணைப்படுத்தப்பட்ட சொத்து தொடர்பாக வேறு எந்த மூன்றாம் தரப்பினருடனும் விற்பனை உடன்படிக்கை, குத்தகை, கூட்டு முயற்சி அல்லது வேறு எந்த பரிவர்த்தனையும் செய்யவில்லை என்றும், தற்போது எந்தவொரு முந்தைய உடன்படிக்கையும் நடைமுறையில் இல்லை என்றும் விற்பனையாளர் உறுதியளிக்கிறார்.'
  },

  // --- CONDITIONAL COVENANTS ---
  {
    id: 'mortgage_release',
    title: 'Mortgage Release & NOC Covenant',
    category: 'Conditional Covenant',
    contentEn: 'In the event of any outstanding mortgage or bank charge on the Scheduled Property, the Vendor covenants to utilize the sale consideration to fully discharge and obtain a No Objection Certificate (NOC) and Mortgage Discharge Deed at their own expense prior to registration.',
    contentTa: 'விற்கப்படும் சொத்தின் மீது ஏதேனும் வங்கி கடன் அல்லது அடமானம் நிலுவையில் இருந்தால், விற்பனையாளர் இந்த விற்பனைத் தொகையைப் பயன்படுத்தி அதை முழுமையாக அடைத்து, பதிவுக்கு முன்னதாக தங்கள் சொந்தச் செலவில் தடையில்லாச் சான்றிதழ் (NOC) மற்றும் அடமான விடுதலைப் பத்திரத்தைப் பெற ஒப்புக்கொள்கிறார்.'
  },
  {
    id: 'tenant_occupancy',
    title: 'Existing Tenant Occupancy Clause',
    category: 'Conditional Covenant',
    contentEn: 'The Purchaser acknowledges that the Scheduled Property is currently occupied by tenants, and the Vendor hereby transfers all landlord rights, rental security deposits, and the right to collect future rents to the Purchaser with effect from the date of execution.',
    contentTa: 'அட்டவணை சொத்தில் தற்போது வாடகைதாரர்கள் குடியிருப்பதை வாங்குபவர் ஒப்புக்கொள்கிறார். விற்பனையாளர் தனது நில உரிமையாளர் உரிமைகள், வாடகை வைப்புத் தொகைகள் மற்றும் வருங்கால வாடகையை வசூலிக்கும் உரிமையை இன்று முதல் வாங்குபவருக்கு மாற்றுகிறார்.'
  },
  {
    id: 'gov_acquisition',
    title: 'Government Acquisition Protection',
    category: 'Conditional Covenant',
    contentEn: 'The Vendor declares that the Scheduled Property is not subject to any land acquisition notice, road widening project, or municipal reservation by any governmental body or local planning authority, and covenants to indemnify the Purchaser if any such pre-existing acquisition is discovered.',
    contentTa: 'சொத்து எந்தவொரு நில கையகப்படுத்தும் நடவடிக்கை, சாலை விரிவாக்கத் திட்டம் அல்லது அரசாங்க நகராட்சி ஒதுக்கீடுகளுக்கு உட்படவில்லை என்றும், அவ்வாறு ஏதேனும் முந்தைய கையகப்படுத்துதல் கண்டறியப்பட்டால் வாங்குபவருக்கு ஏற்படும் இழப்பை விற்பனையாளர் ஈடுசெய்வார் என்றும் உறுதியளிக்கிறார்.'
  },
  {
    id: 'litigation_disclosure',
    title: 'Litigation Disclosure & Indemnity',
    category: 'Conditional Covenant',
    contentEn: 'The Vendor covenants that there are no pending civil, criminal, revenue, or tax litigation proceedings in any court of law or tribunal concerning the Scheduled Property, and that the title of the Vendor is free from any legal challenge or lis pendens.',
    contentTa: 'சொத்து தொடர்பாக எந்தவொரு சிவில், கிரிமினல் அல்லது வருவாய் நீதிமன்றங்களிலும் வழக்குகள் நிலுவையில் இல்லை என்றும், விற்பனையாளரின் சொத்துரிமை எந்தவொரு சட்டரீதியான சவாலுக்கும் உட்படவில்லை என்றும் விற்பனையாளர் உறுதியளிக்கிறார்.'
  },
  {
    id: 'gpa_validation',
    title: 'GPA Validation Clause',
    category: 'Conditional Covenant',
    contentEn: 'Where this deed is executed by a General Power of Attorney (GPA) holder, the Principal and the Agent jointly declare that the GPA registered is fully valid, in force, and has not been revoked, cancelled, or terminated as of the date of execution of this deed.',
    contentTa: 'இப்பத்திரம் பொது அதிகாரப் பத்திரம் (GPA) பெற்றவர் மூலம் எழுதப்படும் பட்சத்தில், குறிப்பிட்ட பொது அதிகாரப் பத்திரம் செல்லுபடியாகக்கூடியது என்றும், இன்று வரை அது ரத்து செய்யப்படவில்லை என்றும் அசல் உரிமையாளரும் முகவரும் இணைந்து பிரகடனம் செய்கிறார்கள்.'
  },

  // --- COMPLIANCE COVENANTS ---
  {
    id: 'tn_patta_mutation',
    title: 'Tamil Nadu Revenue Mutation Clause',
    category: 'Compliance Covenant',
    contentEn: 'Both parties hereby agree that the Scheduled Property is fully registered under Patta/Chitta/Adangal records of Tamil Nadu Revenue Department, and the Vendor undertakes to provide all administrative assistance and execute necessary mutation applications on the TN e-District portal within thirty (30) days from registration.',
    contentTa: 'சொத்தானது தமிழ்நாட்டின் வருவாய்த்துறை பட்டா, சிட்டா மற்றும் அடங்கல் பதிவேடுகளின் கீழ் முறையாகப் பதிவு செய்யப்பட்டுள்ளது என்றும், விற்பனையாளர் பதிவு செய்யப்பட்ட முப்பது (30) நாட்களுக்குள் தமிழ்நாடு இ-சேவை இணையதளத்தில் பட்டா மாறுதலுக்கான அனைத்து உதவிகளையும் ஒப்புதல்களையும் வழங்க ஒப்புக்கொள்கிறார்.'
  },
  {
    id: 'tn_tslr_compliance',
    title: 'TSLR Land Register Compliance',
    category: 'Compliance Covenant',
    contentEn: 'The Vendor warrants that the Scheduled Property matches the dimensions, survey limits, and ownership details recorded in the Town Survey Land Register (TSLR) of the municipal corporation, and agrees to indemnify the Purchaser against any administrative discrepancies found in the revenue division.',
    contentTa: 'விற்கப்படும் சொத்தின் பரப்பளவு, எல்லைகள் மற்றும் உரிமை விபரங்கள் அனைத்தும் நகராட்சி மற்றும் மாநகராட்சியின் நகர நில அளவைப் பதிவேட்டுடன் (TSLR) முழுமையாக ஒத்துப்போகிறது என்றும், இதில் ஏதேனும் குளறுபடிகள் கண்டறியப்பட்டால் அதற்கு விற்பனையாளரே பொறுப்பாவார் என்றும் உறுதியளிக்கிறார்.'
  },
  {
    id: 'indemnity',
    title: 'Indemnity and Liability Clause',
    category: 'General Covenant',
    contentEn: 'The Vendor hereby covenants to fully indemnify, defend, and hold harmless the Purchaser from and against all losses, damages, liabilities, claims, and costs arising out of any defect in title, pending litigation, or claims by third parties claiming any interest in the Scheduled Property.',
    contentTa: 'விற்கப்படும் சொத்தின் மீது ஏதேனும் சட்டரீதியான வில்லங்கம், முந்தைய உரிமை கோரல்கள், அல்லது நீதிமன்ற வழக்குகள் காரணமாக வாங்குபவருக்கு ஏதேனும் இழப்பு ஏற்பட்டால், அதற்கு விற்பனையாளரே முழுப் பொறுப்பு ஏற்று அதற்கான முழு இழப்பீட்டையும் வாங்குபவருக்கு வழங்க கடமைப்பட்டவர் ஆவார்.'
  },
  {
    id: 'arbitration',
    title: 'Arbitration and Dispute Resolution',
    category: 'General Covenant',
    contentEn: 'In the event of any dispute, difference, or controversy arising out of or in connection with this deed, the parties shall attempt to resolve it amicably. If unresolved, it shall be referred to arbitration in accordance with the Indian Arbitration and Conciliation Act, 1996, with the venue of arbitration located in Chennai, Tamil Nadu.',
    contentTa: 'இப்பத்திரத்தின் அடிப்படையில் ஏதேனும் கருத்து வேறுபாடுகளோ அல்லது தாவாக்களோ ஏற்பட்டால், இரு தரப்பினரும் சுமுகமாக பேசித் தீர்க்க முயல வேண்டும். சுமுகமாக தீர்க்க முடியாத பட்சத்தில், அது இந்திய மத்தியஸ்த மற்றும் சமரசச் சட்டம் 1996-ன் படி சென்னை நீதிமன்ற எல்லைக்குட்பட்ட மத்தியஸ்தத்திற்கு சமர்ப்பிக்கப்பட வேண்டும்.'
  },
  {
    id: 'risk_transfer',
    title: 'Risk Transfer Clause',
    category: 'General Covenant',
    contentEn: 'All risks of loss, damage, or destruction to the Scheduled Property shall be transferred from the Vendor to the Purchaser immediately upon the execution of this deed and delivery of physical possession, from which moment the Purchaser shall bear all outgoings and enjoy all benefits of ownership.',
    contentTa: 'சொத்தின் மீதான அனைத்து இழப்புகள், சேதங்கள் அல்லது அழிவுகளுக்கான அபாயங்கள் இப்பத்திரம் எழுதப்பட்டு நேரடி சுவாதீனம் ஒப்படைக்கப்பட்ட உடனே விற்பனையாளரிடமிருந்து வாங்குபவருக்கு மாற்றப்படுகிறது. அதுமுதல் வாங்குபவரே இதன் முழு பலன்களையும் அனுபவிப்பார் மற்றும் வரிகளைச் செலுத்துவார்.'
  },
  {
    id: 'encumbrance_certificate',
    title: 'Encumbrance Certificate Verification',
    category: 'General Covenant',
    contentEn: 'The Vendor warrants that they have obtained and verified the Encumbrance Certificate (EC) for the Scheduled Property for a period of 30 years, and that no encumbrances, claims, or charges of any kind are registered against the property as of the date of execution of this deed.',
    contentTa: 'விற்பனையாளர் இச்சொத்தின் கடந்த 30 ஆண்டுகால வில்லங்கச் சான்றிதழை (EC) சரிபார்த்து எவ்வித வில்லங்கமும் இல்லை என வாங்குபவருக்கு உறுதியளிக்கிறார். இப்பதிவு நாள் வரை இச்சொத்தின் மீது வேறு எந்தவிதமான உரிமை கோரல்களோ, வில்லங்கங்களோ பதிவு செய்யப்படவில்லை.'
  }
];

export default function Step10Clauses({ selectedClauses, onChange }: Step10ClausesProps) {
  
  const toggleClause = (id: string) => {
    const updated = selectedClauses.includes(id)
      ? selectedClauses.filter(item => item !== id)
      : [...selectedClauses, id];
    onChange(updated);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800" id="step-10-clauses">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          Toggle specific legal covenants and protective clauses to be appended to your bilingual sub-registration draft. 
          <span className="block mt-1 text-[11px] text-emerald-600 font-bold">
            Note: Mandatory sale covenants (Marketable Title, Encumbrance Clear, Possession Delivery, Consideration, Ownership Warranty) are automatically injected by the production legal clause engine during document generation.
          </span>
        </p>
      </div>

      <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
        {CLAUSES_LIST.map((clause) => {
          const isSelected = selectedClauses.includes(clause.id);
          return (
            <div
              key={clause.id}
              onClick={() => toggleClause(clause.id)}
              className={`w-full text-left p-4 rounded-xl border cursor-pointer transition flex items-start gap-3.5 select-none ${
                isSelected 
                  ? 'bg-emerald-50/40 border-emerald-500/30 ring-1 ring-emerald-500/10' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                isSelected ? 'bg-[#c49a36] border-emerald-600 text-white' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 tracking-tight">{clause.title}</h4>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    clause.category.includes('Mandatory') 
                      ? 'bg-red-50 text-red-600 border border-red-100' 
                      : clause.category.includes('Recommended')
                      ? 'bg-blue-50 text-blue-600 border border-blue-100'
                      : clause.category.includes('Conditional')
                      ? 'bg-amber-50 text-amber-600 border border-amber-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {clause.category}
                  </span>
                </div>
                
                <div className="space-y-1 text-[10px] leading-relaxed text-slate-600">
                  <p className="font-serif italic text-slate-700">" {clause.contentEn} "</p>
                  <p className="font-sans font-medium text-emerald-800">" {clause.contentTa} "</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
