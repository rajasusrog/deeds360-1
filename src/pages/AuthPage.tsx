import { useState } from 'react';
import { 
  FileText,
  Layers, 
  ArrowRight, 
  AlertTriangle,
  Clock,
  LogOut,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured } from '../lib/supabase';

export default function AuthPage() {
  const { 
    currentUser, 
    loginWithGoogleHandler, 
    logoutUser
  } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await loginWithGoogleHandler();
      if (!res.success) {
        setErrorMsg(res.message || 'Google authentication failed');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  // If user is logged in but pending admin approval
  if (currentUser && currentUser.status === 'Pending Approval') {
    return (
      <div id="auth-pending-container" className="min-h-screen bg-[#0b1426] flex flex-col items-center justify-center p-4 relative font-sans text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center space-y-6 relative z-10">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Account Pending Admin Approval</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Welcome, <strong className="text-slate-200">{currentUser.name}</strong> ({currentUser.email}).
              Your account profile has been registered. An administrator will review and grant portal authorization.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs space-y-2">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
              <span>Account Status</span>
              <span className="text-amber-400 font-mono">Pending Review</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold">
              <span>Assigned Role</span>
              <span className="text-slate-300 font-mono">{currentUser.role}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-col gap-3">
            <button
              onClick={logoutUser}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in but suspended or deleted
  if (currentUser && (currentUser.status === 'Suspended' || currentUser.status === 'Deleted')) {
    const isDeleted = currentUser.status === 'Deleted';
    return (
      <div id="auth-suspended-container" className="min-h-screen bg-[#0b1426] flex flex-col items-center justify-center p-4 relative font-sans text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center space-y-6 relative z-10">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {isDeleted ? 'Account Deactivated' : 'Access Suspended'}
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your profile for <strong className="text-slate-200">{currentUser.email}</strong> has been {isDeleted ? 'deactivated' : 'suspended'}. Please contact your system administrator.
            </p>
          </div>

          <button
            onClick={logoutUser}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="auth-page-container" className="min-h-screen bg-[#f6f5f1] font-sans text-slate-900">
      <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr]">
        
        {/* Product Information Section: Left on desktop (order-2 lg:order-1), Below on mobile */}
        <section aria-labelledby="product-heading" className="order-2 lg:order-1 relative overflow-hidden bg-[#0b1426] px-6 py-8 text-white sm:px-12 lg:px-16 lg:py-10">
          <div aria-hidden="true" className="absolute -right-36 top-40 h-[450px] w-[450px] rounded-full border border-amber-200/10 pointer-events-none" />
          <div aria-hidden="true" className="absolute -right-20 top-56 h-[320px] w-[320px] rounded-full border border-amber-200/10 pointer-events-none" />
          
          <div className="relative mx-auto flex h-full max-w-xl flex-col justify-between">
            <header className="flex items-center gap-3">
              <img 
                src="/unikorn360-brand-20261031.svg" 
                alt="UNIKORN360 Logo" 
                className="h-20 w-20 shrink-0 object-contain" 
              />
              <div>
                <p className="text-sm font-bold tracking-[0.16em]">
                  UNIKORN<span className="text-amber-300">360</span> <span className="text-slate-400 font-normal text-xs ml-1">DEED360</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Tools for thoughtful work.</p>
              </div>
            </header>

            <div className="py-10 lg:py-12">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-amber-200 uppercase">
                <span className="h-px w-8 bg-amber-300" /> Deed360 workspace
              </p>
              <h1 id="product-heading" className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl text-white">
                From property details<br className="hidden sm:block" /> to a <span className="text-amber-200">clearer draft.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                Bring parties, property schedules and clauses together in one organised deed-drafting workspace.
              </p>
              <p lang="ta" className="mt-4 text-sm leading-7 text-amber-100/80">
                பத்திரத் தயாரிப்பின் ஒவ்வொரு படியும், ஒரே இடத்தில்.
              </p>
            </div>

            <div aria-label="Illustrative drafting workflow" className="relative rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6 mb-8">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-200" />
                  <span className="text-sm font-medium">Your next draft, organised.</span>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-slate-300 font-medium">Workflow</span>
              </div>
              <ol className="space-y-3.5">
                {[
                  ['01', 'Capture the details', 'Parties, property and transaction information.'],
                  ['02', 'Review your draft', 'Bring the details and selected clauses together.'],
                  ['03', 'Prepare for review', 'Preview and export supported documents.'],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-200/20 text-xs font-mono text-amber-200">{number}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-300 mb-8">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-200" /> Tamil & English drafts
              </span>
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-200" /> Reusable drafting workflow
              </span>
            </div>

            <p className="text-xs leading-5 text-slate-500 pt-4 border-t border-white/10">
              An independent UNIKORN360 product. Documents require appropriate professional review.
            </p>
          </div>
        </section>

        {/* Sign-In Panel Section: Top on mobile (order-1 lg:order-2), Right on desktop */}
        <main className="order-1 lg:order-2 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 lg:py-16 bg-[#f6f5f1]">
          <div className="w-full max-w-sm mx-auto">
            {/* Mobile-only header logo */}
            <div className="flex lg:hidden items-center gap-3 mb-8 pb-6 border-b border-slate-200">
              <img 
                src="/unikorn360-brand-20261031.svg" 
                alt="UNIKORN360 Logo" 
                className="h-16 w-16 shrink-0 object-contain" 
              />
              <div>
                <p className="text-sm font-bold tracking-[0.16em] text-slate-900">
                  UNIKORN<span className="text-amber-600">360</span> <span className="text-slate-500 font-normal text-xs ml-1">DEED360</span>
                </p>
                <p className="text-[11px] text-slate-500">Deed360 Workspace</p>
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
              Deed360 Workspace
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0b1426] sm:text-4xl">
              Welcome to Deed360
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sign in to continue drafting and manage your documents.
            </p>

            {!isSupabaseConfigured && (
              <div id="auth-config-error" role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Sign-in temporarily unavailable</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-amber-900">
                  Sign-in is temporarily unavailable. Please contact your workspace administrator.
                </p>
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || !isSupabaseConfigured}
              aria-busy={loading}
              className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span aria-live="polite">{loading ? 'Connecting to Google…' : 'Continue with Google'}</span>
              <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 text-slate-400" />
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              New here? Sign in to request access.<br />Your administrator approves workspace access.
            </p>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="flex gap-3">
                <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">Protected Workspace</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Document access is restricted to verified accounts and assigned permissions.</p>
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs leading-5 text-slate-500">
              Drafting assistance only. Review document details and obtain appropriate professional advice before use.
            </p>
            
            <p className="mt-6 text-[11px] font-medium tracking-wide text-slate-400">
              DEED360 · BY UNIKORN360
            </p>
          </div>
        </main>

      </div>
    </div>
  );
}
