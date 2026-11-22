import React, { useState } from 'react';
import {
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  Pill,
  ShieldCheck,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, connectionStatus } = useHealthcare();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setSigningIn(true);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setAuthError(res.error ?? 'Google sign-in failed.');
    }
    setSigningIn(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand & Clinical Overview Panel */}
      <div className="lg:w-[46%] bg-[#0F2544] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                MediCare AI
              </span>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <p className="text-xs font-medium text-teal-300 tracking-wide">
              Post-Discharge Care Coordination Platform
            </p>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              Continuity of care after every hospital discharge.
            </h1>
            <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
              Coordinate discharged patients, medication reminder schedules, follow-up appointments,
              and rule-based attention alerts from one unified clinical workspace.
            </p>
          </div>

          <div className="mt-10 space-y-5 max-w-md border-t border-white/10 pt-8">
            <div className="flex items-start gap-3.5">
              <Pill className="w-5 h-5 text-teal-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">Medicine Adherence Tracking</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Daily dose schedules, reminder timings, and instant taken or missed dose logging.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <CalendarClock className="w-5 h-5 text-teal-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">Follow-up & Visit Coordination</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Automatic overdue task detection paired with timestamped staff notes and visit logs.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <ClipboardCheck className="w-5 h-5 text-teal-300 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-white">Transparent Rule-Based Alerts</h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Flags overdue follow-ups, missed appointments, and missed reminders with clear explanations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-xs text-slate-400">
          Preloaded with clearly labelled fictional demonstration records on first sign-in. No real patient health information is stored.
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-8">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Staff Portal Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your verified Google account to access Cloud Firestore patient records
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mt-5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {authError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full py-3 px-4 bg-[#0F2544] hover:bg-[#16335c] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Authenticated Cloud Firestore Workspace</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Protected by Firebase Authentication and strict Firestore Security Rules. On first
                sign-in, your workspace automatically seeds clearly labelled fictional demo records.
              </p>
              {connectionStatus && (
                <p className="text-[11px] font-mono text-slate-500 pt-1">
                  Database: {connectionStatus.projectId} ·{' '}
                  {connectionStatus.status === 'connected' ? 'Reachable' : connectionStatus.status}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
