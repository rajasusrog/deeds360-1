import React, { useState } from 'react';
import { 
  Briefcase, 
  Users, 
  TrendingUp, 
  UploadCloud, 
  FileCheck, 
  Clock, 
  Building2, 
  Plus, 
  ArrowRight,
  MapPin,
  DollarSign,
  PhoneCall,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function BrokerWorkspace() {
  const { clients, savedDrafts, setActiveTab, addClient } = useApp();
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Property deals pipeline mock
  const [deals, setDeals] = useState([
    {
      id: 'deal-1',
      title: '2400 Sq.ft Plot at Mylapore Survey 492/1',
      clientName: 'Thiru. R. Venkatesh',
      value: 7500000,
      stage: 'Drafting Deed',
      sro: 'SRO Mylapore',
      status: 'In Progress'
    },
    {
      id: 'deal-2',
      title: 'Commercial Space at Anna Salai, Chennai',
      clientName: 'Smt. K. Meenakshi',
      value: 18500000,
      stage: 'Pending SRO Seal',
      sro: 'SRO Thousand Lights',
      status: 'Review'
    },
    {
      id: 'deal-3',
      title: '3BHK Villa at OMR Perungudi',
      clientName: 'Thiru. M. Sundaram',
      value: 12000000,
      stage: 'Registered & Token Issued',
      sro: 'SRO Joint-II Chennai',
      status: 'Completed'
    }
  ]);

  const totalDealVolume = deals.reduce((acc, d) => acc + d.value, 0);
  const estCommission = totalDealVolume * 0.02; // 2% broker fee

  const handleAddDealClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    addClient({
      id: 'c_' + Date.now(),
      name: newClientName,
      fatherName: 'Father Name',
      dob: '1985-06-12',
      age: 41,
      occupation: 'Business',
      pan: 'ABCDE1234F',
      aadhaar: '9988-7766-5544',
      address: 'Mylapore, Chennai',
      phone: newClientPhone || '9840012345',
      email: 'client@example.com',
      createdAt: new Date().toISOString()
    });
    setNewClientName('');
    setNewClientPhone('');
    setShowAddClient(false);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" id="broker-agent-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Real Estate Agent & Broker Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">TN RERA Registered Advisor</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Property Deals & Client Registration Pipeline
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Track client deals from initial sale agreement to SRO registration, monitor document status, upload KYC copies, and manage brokerage commissions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowAddClient(true)}
              className="px-4 py-2.5 bg-[#c49a36] hover:bg-[#b58a2b] font-bold text-white text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Client Lead</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal to add client */}
      {showAddClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900">Add New Property Client Lead</h3>
            <form onSubmit={handleAddDealClient} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Client Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thiru. S. Sundaram"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 98400 98400"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c49a36] hover:bg-[#a57a20] text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Active Deals Volume</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">
              ₹ {(totalDealVolume / 10000000).toFixed(2)} Cr
            </h3>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">3 Active Property Listings</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Est. Brokerage Fee</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
              ₹ {(estCommission / 100000).toFixed(2)} Lakhs
            </h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              2% Standard Brokerage
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">My Client Leads</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{clients.length} Clients</h3>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">KYC Documents Uploaded</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Scheduled SRO Tokens</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">1 Today</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              Token #T-102 @ SRO Mylapore
            </span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Property Deals Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Active Property Registration Pipeline</h3>
            <p className="text-xs text-slate-400">Track deal progress and SRO registration token milestones</p>
          </div>
          <button
            onClick={() => setActiveTab('clients')}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 hover:underline"
          >
            <span>Manage Client Roster</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Deal Description</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Sub-Registry</th>
                <th className="py-2.5 px-3 text-right">Consideration</th>
                <th className="py-2.5 px-3">Registration Stage</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-3 font-bold text-slate-900">{deal.title}</td>
                  <td className="py-3.5 px-3 font-medium text-slate-700">{deal.clientName}</td>
                  <td className="py-3.5 px-3 text-slate-600">{deal.sro}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                    ₹ {deal.value.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold">
                      {deal.stage}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => setActiveTab('documents')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      View Deed Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
