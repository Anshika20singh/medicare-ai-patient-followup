import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, Database, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { ConnectionCheckResult, firebaseConfig, testConnection } from '../../lib/firebase';
import { useHealthcare } from '../../store/HealthcareContext';

const DEPLOYED_RULES_SUMMARY = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
    // Enforces verified Firebase Auth, ownerId isolation,
    // strict schema validation blueprints, ID regex guards,
    // bounded array checks, and server request.time timestamps
    // across users, admins, patients, medicines, appointments,
    // followups, and activities.
  }
}`;

export const FirebaseSetupView: React.FC = () => {
  const { connectionStatus } = useHealthcare();
  const [liveCheck, setLiveCheck] = useState<ConnectionCheckResult | null>(connectionStatus);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRecheck = async () => {
    setChecking(true);
    const res = await testConnection();
    setLiveCheck(res);
    setChecking(false);
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            projectId: firebaseConfig.projectId,
            firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
            authDomain: firebaseConfig.authDomain,
          },
          null,
          2
        )
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const activeStatus = liveCheck ?? connectionStatus;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F2544] text-teal-300 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Connected Firebase Authentication & Cloud Firestore
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                MediCare AI is provisioned and connected to Cloud Firestore with real-time{' '}
                <span className="font-mono text-xs">onSnapshot</span> listeners across{' '}
                <span className="font-mono text-xs">users</span>,{' '}
                <span className="font-mono text-xs">patients</span>,{' '}
                <span className="font-mono text-xs">medicines</span>,{' '}
                <span className="font-mono text-xs">appointments</span>,{' '}
                <span className="font-mono text-xs">followups</span>, and{' '}
                <span className="font-mono text-xs">activities</span>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2544] hover:bg-[#16335c] disabled:opacity-60 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Verifying...' : 'Verify Connection'}</span>
          </button>
        </div>

        {/* Live Connection Verification Banner */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-slate-500">Firebase Project ID</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5">
              {firebaseConfig.projectId}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Firestore Database ID</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5 truncate" title={firebaseConfig.firestoreDatabaseId}>
              {firebaseConfig.firestoreDatabaseId}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Server Connection Status</p>
            <div className="mt-0.5 flex items-center gap-1.5 font-semibold">
              {activeStatus?.status === 'connected' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-emerald-700">Connected & Verified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-amber-700">
                    {activeStatus?.message ?? 'Checking connection...'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Deployed Security Rules & Configuration
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCopyConfig}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Project Info'}</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Production security rules in <span className="font-mono text-xs">firestore.rules</span>{' '}
            have been validated with <span className="font-mono text-xs">@firebase/eslint-plugin-security-rules</span>{' '}
            and deployed to your Firebase project. Please review and audit rules before sharing
            the application broadly.
          </p>
          <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto leading-relaxed">
            {DEPLOYED_RULES_SUMMARY}
          </pre>
        </div>
      </div>
    </div>
  );
};
