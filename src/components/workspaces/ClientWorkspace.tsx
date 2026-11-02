import React, { useState } from 'react';
import { 
  Building, 
  FileText, 
  Download, 
  Upload, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  Shield, 
  ExternalLink,
  MapPin,
  Sparkles,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ClientWorkspace() {
  const { savedDrafts, currentUser, loadDraft, setActiveTab } = useApp();
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: string; date: string }[]>([]);

  const [uploadType, setUploadType] = useState('Identity Proof');

  const handleFileUpload = (_event: React.ChangeEvent<HTMLInputElement>) => {
    window.alert('File storage is not connected on this screen. No document has been uploaded.');
  };

  // Client's registered property portfolio mock
  const registeredProperties: { docNo: string; title: string; district: string; sro: string; consideration: number; status: string; date: string }[] = [];

  return (
    <div className="space-y-6 font-sans text-slate-800" id="client-property-workspace">
      <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">The registered-property feed and file-upload storage on this screen are not connected. Your saved drafting records are separate. No sample property or identity file is presented as yours.</div>
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                Property Owner & Buyer Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">Deed360 Citizen Hub</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              My Documents & Property Details
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Review your saved drafts and the property details available in your workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-right">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">KYC Status</span>
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Aadhaar & PAN Linked
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Registered Titles</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">1 Property</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              Registered SRO Title Deed Copy
            </span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
            <Building className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Portfolio Valuation</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹ 75.0 Lakhs</h3>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">Guideline Value Matched</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Uploaded KYC Files</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{uploadedFiles.length} Uploads</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <Shield className="h-3 w-3" />
              256-bit Encrypted
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Active SRO Applications</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">1 Pending</h3>
            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              SRO Token #T-102 Scheduled
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Clock className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Main Grid: My Deeds & KYC Upload Portal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* My Registered Titles */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">My Property Documents</h3>
              <p className="text-xs text-slate-400">Review documents available in your workspace. App status does not establish official registration.</p>
            </div>
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg">
              Workspace documents
            </span>
          </div>

          <div className="space-y-3">
            {registeredProperties.map((prop, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">{prop.docNo}</span>
                    <h4 className="text-sm font-black text-slate-900">{prop.title}</h4>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-lg self-start sm:self-auto">
                    {prop.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Sub-Registry</span>
                    <span className="font-semibold text-slate-800">{prop.sro}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Consideration</span>
                    <span className="font-semibold text-slate-800">₹ {prop.consideration.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Registration Date</span>
                    <span className="font-semibold text-slate-800">{prop.date}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <QrCode className="h-4 w-4 text-teal-600" />
                    <span className="font-mono text-[10px]">Verification QR Code Active</span>
                  </div>

                  <button
                    onClick={() => setActiveTab('documents')}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Deed PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Supporting KYC & Documents */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900">Upload KYC & Title Documents</h3>
            <p className="text-xs text-slate-400">Share Aadhaar, PAN, and Parent Deeds securely with your Document Writer</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Select Document Category</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
              >
                <option value="Identity Proof">Identity Proof (Aadhaar / Voter ID)</option>
                <option value="Tax ID">Tax ID (PAN Card)</option>
                <option value="Title History">Parent Title Deed / EC Copy</option>
                <option value="Payment DD">Bank DD / Stamp Duty Receipt</option>
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center bg-slate-50/50 transition cursor-pointer relative">
              <input
                type="file"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Upload className="h-8 w-8 text-teal-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">Click or drag document file here</p>
              <p className="text-[10px] text-slate-400 mt-1">Supports PDF, JPG, PNG up to 10MB</p>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-700">Uploaded Document Locker</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 text-[11px] truncate max-w-40">{file.name}</p>
                      <span className="text-[10px] text-slate-400">{file.type} • {file.date}</span>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
