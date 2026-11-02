import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  FileText, 
  Server, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Search, 
  ExternalLink,
  Cpu,
  BarChart3,
  Key,
  Layers,
  MapPin
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart, 
  Line 
} from 'recharts';

export default function SuperAdminWorkspace() {
  const { auditLogs, usersList, savedDrafts } = useApp();
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [searchTerm, setSearchTerm] = useState('');

  // District revenue metrics
  const districtData = [
    { district: 'Chennai', registrations: 4210, revenueCr: 48.2 },
    { district: 'Coimbatore', registrations: 2980, revenueCr: 31.5 },
    { district: 'Madurai', registrations: 2150, revenueCr: 22.1 },
    { district: 'Trichy', registrations: 1840, revenueCr: 18.4 },
    { district: 'Salem', registrations: 1620, revenueCr: 14.8 },
    { district: 'Tirunelveli', registrations: 1210, revenueCr: 10.2 },
  ];

  // System metrics
  const totalUsers = usersList.length;
  const activeSros = 284;
  const totalStateRevenue = 145.2; // Cr
  const apiHealth = '99.98%';

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-slate-800" id="super-admin-workspace">
      
      {/* Scope Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-black uppercase tracking-wider">
                State Level Platform Administration
              </span>
              <span className="text-xs text-slate-400 font-mono">Deed360 TN Gateway v3.4</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Deed360 Administration
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Manage workspace users and review application records. Revenue charts are demonstration data.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="All Districts">All 38 Districts (State Wide)</option>
              <option value="Chennai">Chennai Registration Zone</option>
              <option value="Coimbatore">Coimbatore Zone</option>
              <option value="Madurai">Madurai Zone</option>
              <option value="Trichy">Trichy Zone</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Total Users & Licenses</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{totalUsers} Active</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <Users className="h-3 w-3" />
              {usersList.filter(u => u.status === 'Approved').length} Approved Accounts
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Connected SRO Offices <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded ml-1">[DEMO METRICS]</span></span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{activeSros} SROs</h3>
            <span className="text-[10px] text-teal-600 font-bold flex items-center gap-1 mt-1">
              <Building2 className="h-3 w-3" />
              Simulated SRO Feed
            </span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">State Revenue (FY 26-27) <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded ml-1">[DEMO METRICS]</span></span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹ {totalStateRevenue} Cr</h3>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Demonstration Revenue Data
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <BarChart3 className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">AI Benchmark <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded ml-1">[DEMO DATA]</span></span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{apiHealth}</h3>
            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-1">
              <Cpu className="h-3 w-3" />
              Live Health: <code className="text-[9px] bg-slate-100 px-1 font-mono rounded">/health</code>
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Activity className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Analytics & System Health Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* State District Revenue Chart */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">District Registration Revenue (₹ Crores) <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold uppercase">[DEMO METRICS]</span></h3>
              <p className="text-xs text-slate-400">Simulated demonstration data for Tamil Nadu registration zones</p>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              [DEMO FEED]
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="district" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => [`₹ ${value} Crores`, 'Revenue']}
                />
                <Bar dataKey="revenueCr" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Engine & SRO Gateway Status */}
        <div className="lg:col-span-4 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">System Health & Gateways</h3>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                CONNECTIVITY NOT VERIFIED
              </span>
            </div>

            <div className="space-y-3 mt-4 text-xs font-mono">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 font-bold">Deed360 API Gateway</p>
                  <p className="text-[10px] text-slate-400">Response time not measured</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 font-bold">Drafting assistance</p>
                  <p className="text-[10px] text-slate-400">Capacity not measured</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <p className="text-slate-300 font-bold">Tamil Nadu Survey / Patta Sync</p>
                  <p className="text-[10px] text-slate-400">External synchronization not connected</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>See application audit records</span>
            <span className="text-emerald-400 font-bold">Connection status not measured</span>
          </div>
        </div>

      </div>

      {/* User Accounts & Audit Logs Management Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">User Accounts & Role Permissions</h3>
            <p className="text-xs text-slate-400">Manage user authorization and platform access across roles</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">User Name</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Organization</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-bold text-slate-900">{user.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{user.email}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-700 text-[11px]">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{user.organization || 'General SRO'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      user.status === 'Approved' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : user.status === 'Pending Approval' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="text-xs text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer">
                      Edit Permissions
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
