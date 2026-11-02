import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RotateCcw, LogOut } from 'lucide-react';
import { signOutSupabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
  currentUserEmail?: string;
  currentUserId?: string;
  activeTab?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Safely log diagnostic context (without leaking tokens or secrets)
    console.error('DeedOS360 Global Error Boundary caught a runtime exception:', {
      message: error.message,
      stack: error.stack,
      currentUser: {
        id: this.props.currentUserId || 'anonymous',
        email: this.props.currentUserEmail || 'unauthenticated'
      },
      activeTab: this.props.activeTab || 'root',
      componentStack: errorInfo.componentStack
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleSignOut = async () => {
    try {
      await signOutSupabase();
      localStorage.removeItem('unikorn_authenticated_user');
      localStorage.removeItem('unikorn_simulation_role');
      localStorage.removeItem('deedos360_supabase_auth_token');
    } catch (e) {
      console.warn('Sign-out from ErrorBoundary notice:', e);
    }
    window.location.href = window.location.origin;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-900/40 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">DeedOS360 encountered an application error.</h1>
                <p className="text-xs text-slate-400 mt-1">An unexpected runtime failure was caught by the system boundary.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto max-h-40">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#c49a36] hover:bg-[#b58a2b] text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-emerald-950"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleSignOut}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition-all border border-slate-700"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
