import { Loader2 } from 'lucide-react';
import UnikornLogo from './UnikornLogo';

export default function AuthenticationLoadingScreen() {
  return <main className="min-h-screen bg-[#0b1426] flex flex-col items-center justify-center p-6 text-white font-sans" aria-busy="true">
    <UnikornLogo size="xl" showText={false} />
    <h1 className="mt-6 text-2xl font-semibold">Deed360</h1>
    <div role="status" className="mt-4 flex items-center gap-3 text-sm text-slate-300"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-amber-200 motion-reduce:animate-none" />Opening your workspace…</div>
  </main>;
}
