import { 
  Scale, 
  LayoutDashboard, 
  FileText, 
  Users, 
  BookOpen, 
  ShieldCheck, 
  Settings, 
  Sparkles,
  Database,
  CloudLightning,
  UserCheck,
  FolderOpen,
  Bot
} from 'lucide-react';
import { UserRole, getRoleAllowedTabs } from '../types';
import { useApp } from '../context/AppContext';
import UnikornLogo from './UnikornLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
}

const ALL_ROLES: UserRole[] = [
  'Super Admin',
  'Admin',
  'Document Writer',
  'Lawyer',
  'Broker',
  'Data Entry Operator',
  'Client',
  'Auditor'
];

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUserRole, 
}: SidebarProps) {
  const { currentUser, simulationRole, setSimulationRole } = useApp();
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai-agents', label: '10 AI Agents Hub', icon: Bot, badge: 'Writer360' },
    { id: 'documents', label: 'Document Center', icon: FolderOpen },
    { id: 'wizard', label: 'Drafting Wizard', icon: FileText, badge: 'Step 1-11' },
    { id: 'clients', label: 'Clients Management', icon: Users },
    { id: 'templates', label: 'Template Library', icon: BookOpen },
    { id: 'clauses', label: 'Clause Library', icon: Scale },
    { id: 'admin', label: 'Admin & Database', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getCustomLabel = (id: string, defaultLabel: string) => {
    if (currentUserRole === 'Broker') {
      if (id === 'clients') return 'Client Leads';
      if (id === 'documents') return 'Document Status';
    }
    if (currentUserRole === 'Client') {
      if (id === 'documents') return 'My Documents';
      if (id === 'clients') return 'Upload KYC';
      if (id === 'settings') return 'Preferences';
    }
    return defaultLabel;
  };

  const allowedTabs = getRoleAllowedTabs(currentUserRole);
  const filteredNavItems = navItems.filter(item => allowedTabs.includes(item.id));
  
  // Gated checklist to verify if real authenticated identity is Super Admin
  const isRealSuperAdmin = currentUser?.role === 'Super Admin';

  const handleSimulationRoleChange = (role: UserRole) => {
    setSimulationRole(role);
    localStorage.setItem('unikorn_simulation_role', role);
  };

  return (
    <aside id="app-sidebar" className="w-68 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0 h-screen overflow-y-auto font-sans">
      {/* Brand Section */}
      <div className="p-4 border-b border-slate-800 flex flex-col gap-1.5 bg-slate-950/60">
        <UnikornLogo size="md" showText={true} />
        <p className="mt-1 text-xs text-slate-400">Deed drafting workspace</p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 text-left">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-2">Core Platform</p>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const displayLabel = getCustomLabel(item.id, item.label);
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                isActive 
                  ? 'bg-[#c49a36]/90 text-[#0b1426] shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#0b1426]' : 'text-slate-400'}`} />
                <span>{displayLabel}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  isActive ? 'bg-white text-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Super Admin Only - Permission Preview Mode */}
      {isRealSuperAdmin && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 text-left">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Permission Preview Mode</span>
          </div>
          <select
            id="role-simulator-dropdown"
            value={currentUserRole}
            onChange={(e) => handleSimulationRoleChange(e.target.value as UserRole)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
          >
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded mt-2">
            <p className="text-[9px] text-slate-400 leading-normal">
              <strong className="text-emerald-400">Super Admin Simulation Enabled:</strong> Troubleshooting client and registrar view permissions. Refresh to revert.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
