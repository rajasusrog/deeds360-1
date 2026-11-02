import { BookOpen, FileText, Download, Star, ShieldCheck, Eye } from 'lucide-react';

export default function TemplateLibrary() {
  const templates = [
    {
      code: 'sale_deed_v1',
      title: 'Bilingual Absolute Sale Deed Template',
      titleTa: 'சுத்த கிரயப் பத்திர மாதிரி',
      type: 'Sale',
      description: 'Standard bilingual layout (English & Tamil side-by-side) for absolute conveyance of residential buildings or plots. Configured for Deed360 automated survey field syncing.',
      stampDuty: '7% of Market Value',
      regFee: '4% of Market Value',
      requiredForms: 'Form 1-A (Under valuation protection), PAN Card proof, Aadhaar biometric verification',
      popularity: 98
    },
    {
      code: 'gift_deed_v1',
      title: 'Gift Settlement Deed Template (Family Members)',
      titleTa: 'தான செட்டில்மெண்ட் பத்திர மாதிரி',
      type: 'Gift',
      description: 'Specially formatted deed for gifting properties exclusively to defined family members (spouse, children, grandchildren). Reduced stamp duty model under TN Gazette.',
      stampDuty: '1% of Guideline Value (Cap of ₹25,000)',
      regFee: '1% of Guideline Value (Cap of ₹10,000)',
      requiredForms: 'Relationship certificate issued by Tahsildar, Donor consent forms',
      popularity: 85
    },
    {
      code: 'partition_v1',
      title: 'Family Partition & Division Deed',
      titleTa: 'பாகப்பிரிவினை பத்திர மாதிரி',
      type: 'Partition',
      description: 'Used for splitting co-owned ancestral properties among legal heirs with clean survey subdivision schedules.',
      stampDuty: '₹25,000 per division share',
      regFee: '₹10,000 flat rate',
      requiredForms: 'Legal Heirship Certificate, Patta copy showing joint ownership',
      popularity: 72
    },
    {
      code: 'lease_deed_v1',
      title: 'Commercial/Residential Lease Agreement',
      titleTa: 'வாடகை / குத்தகை ஒப்பந்தப் பத்திரம்',
      type: 'Lease',
      description: 'Standard lease templates exceeding 11 months requiring compulsory registration at the local SRO under Tamil Nadu tenancy rules.',
      stampDuty: '1% of total rent + deposit',
      regFee: '1% flat fee',
      requiredForms: 'Tenancy Form A, building tax receipts',
      popularity: 90
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 text-left">
        <h3 className="text-md font-bold text-slate-800">Deed360 Registration Templates</h3>
        <p className="text-xs text-slate-400">Browse official bilingual sub-registration templates compliant with Deed360 electronic submission guidelines</p>
      </div>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {templates.map((tpl) => (
          <div key={tpl.code} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:border-emerald-500/30 hover:shadow-md transition duration-150">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <span className="inline-flex px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 uppercase tracking-wide">
                  {tpl.type}
                </span>
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>{tpl.popularity}% popular</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-extrabold text-slate-800">{tpl.title}</h4>
                <p className="text-xs font-bold text-emerald-600 font-sans mt-0.5">{tpl.titleTa}</p>
              </div>

              <p className="text-xs text-slate-500 leading-normal font-medium">{tpl.description}</p>

              {/* Fee matrix specs */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Stamp Duty:</span>
                  <strong className="text-slate-700">{tpl.stampDuty}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Reg. Fee:</span>
                  <strong className="text-slate-700">{tpl.regFee}</strong>
                </div>
                <div className="col-span-2 border-t border-slate-150/50 pt-2 mt-1">
                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Compulsory Attachments:</span>
                  <p className="text-slate-600 font-medium leading-tight mt-0.5">{tpl.requiredForms}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 mt-5">
              <button
                onClick={() => alert(`"${tpl.title}" template loaded successfully. Switch to Drafting Wizard to build deed.`)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 font-bold text-xs text-white rounded-lg transition"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Load Template</span>
              </button>
              <button
                onClick={() => alert("Deed360 raw XML templates were downloaded inside /backend/templates/")}
                className="p-2 border border-slate-250 hover:bg-slate-50 rounded-lg text-slate-500 transition"
                title="Download raw schema files"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
