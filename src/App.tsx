/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import DocumentCenter from './pages/DocumentCenter';
import DocumentWizard from './pages/DocumentWizard';
import ClientManagement from './pages/ClientManagement';
import TemplateLibrary from './pages/TemplateLibrary';
import ClauseLibrary from './pages/ClauseLibrary';
import AdminPanel from './pages/AdminPanel';
import SettingsPage from './pages/Settings';
import AiAgentsWorkbench from './pages/AiAgentsWorkbench';
import AuthenticationLoadingScreen from './components/AuthenticationLoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useApp } from './context/AppContext';

export default function App() {
  const { 
    activeTab, 
    setActiveTab, 
    currentUser,
    effectiveRole,
    authLoading
  } = useApp();

  // 1. Hold rendering until initial Supabase authentication verification completes
  if (authLoading) {
    return <AuthenticationLoadingScreen />;
  }

  // 2. If unauthenticated or account is not Approved (Pending Approval, Suspended, Deleted), render AuthPage
  if (!currentUser || currentUser.status !== 'Approved') {
    return <AuthPage />;
  }

  // 3. Render workspace protected by the Global Error Boundary
  return (
    <ErrorBoundary 
      currentUserEmail={currentUser.email} 
      currentUserId={currentUser.id} 
      activeTab={activeTab}
    >
      <div id="unikorn360-app" className="flex h-screen overflow-hidden bg-slate-50 font-sans">
        
        {/* Sidebar Navigation */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          currentUserRole={effectiveRole} 
          setCurrentUserRole={() => {}} 
        />

        {/* Main Workspace Frame */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Header Navbar */}
          <Navbar 
            activeTab={activeTab} 
            currentUserRole={effectiveRole} 
            userEmail={currentUser.email} 
          />

          {/* Scrollable Workspace viewport */}
          <main className="flex-1 overflow-y-auto p-6 font-sans">
            <div className="max-w-[1600px] mx-auto h-full">
              {activeTab === 'dashboard' && (
                <Dashboard 
                  onNavigateToDraft={() => setActiveTab('documents')} 
                  currentUserRole={effectiveRole}
                />
              )}

              {activeTab === 'ai-agents' && (
                <AiAgentsWorkbench />
              )}

              {activeTab === 'documents' && (
                <DocumentCenter />
              )}
              
              {activeTab === 'wizard' && (
                <DocumentWizard />
              )}
              
              {activeTab === 'clients' && (
                <ClientManagement />
              )}
              
              {activeTab === 'templates' && (
                <TemplateLibrary />
              )}
              
              {activeTab === 'clauses' && (
                <ClauseLibrary />
              )}
              
              {activeTab === 'admin' && (
                <AdminPanel />
              )}
              
              {activeTab === 'settings' && (
                <SettingsPage />
              )}
            </div>
          </main>

        </div>
      </div>
    </ErrorBoundary>
  );
}
