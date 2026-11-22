import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { AppointmentsView } from './components/appointments/AppointmentsView';
import { AttentionCenterView } from './components/attention/AttentionCenterView';
import { LoginPage } from './components/auth/LoginPage';
import { DashboardView } from './components/dashboard/DashboardView';
import { FollowupsView } from './components/followups/FollowupsView';
import { AppShell } from './components/layout/AppShell';
import { MedicinesView } from './components/medicines/MedicinesView';
import { PatientDetailView } from './components/patients/PatientDetailView';
import { PatientsView } from './components/patients/PatientsView';
import { FirebaseSetupView } from './components/setup/FirebaseSetupView';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HealthcareProvider, useHealthcare } from './store/HealthcareContext';
import { ActiveRoute } from './types/healthcare';

const ROUTE_TITLES: Record<ActiveRoute, string> = {
  dashboard: 'Admin Dashboard',
  patients: 'Patient Management',
  'patient-detail': 'Patient Chart',
  medicines: 'Medicine Reminder System',
  appointments: 'Appointment Management',
  attention: 'AI Attention Center',
  followups: 'Follow-up Tracker',
  'firebase-setup': 'Firebase Setup & Status',
};

const ProtectedWorkspace: React.FC = () => {
  const { currentUser, isLoading, error, clearError, patients, attentionFlags } =
    useHealthcare();
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveRoute('patient-detail');
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const breadcrumbTitle =
    activeRoute === 'patient-detail' && selectedPatient
      ? `Patients / ${selectedPatient.name}`
      : ROUTE_TITLES[activeRoute];

  const highCount = attentionFlags.filter((f) => f.priority === 'High').length;

  const headerAction =
    activeRoute !== 'attention' ? (
      <button
        type="button"
        onClick={() => setActiveRoute('attention')}
        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2544] hover:bg-[#16335c] rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
      >
        <BrainCircuit className="w-3.5 h-3.5 text-teal-300" />
        <span>
          Attention Queue{highCount > 0 ? ` (${highCount} High)` : ''}
        </span>
      </button>
    ) : undefined;

  return (
    <AppShell
      activeRoute={activeRoute}
      onNavigate={(route) => setActiveRoute(route)}
      breadcrumbTitle={breadcrumbTitle}
      headerAction={headerAction}
    >
      {error && (
        <div
          role="alert"
          className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-4 text-xs font-medium text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="underline hover:text-red-900 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeRoute === 'dashboard' && (
        <DashboardView
          onNavigate={setActiveRoute}
          onSelectPatient={handleSelectPatient}
        />
      )}

      {activeRoute === 'patients' && (
        <PatientsView onSelectPatient={handleSelectPatient} />
      )}

      {activeRoute === 'patient-detail' && selectedPatientId && (
        <PatientDetailView
          patientId={selectedPatientId}
          onBack={() => setActiveRoute('patients')}
        />
      )}

      {activeRoute === 'medicines' && (
        <MedicinesView onSelectPatient={handleSelectPatient} />
      )}

      {activeRoute === 'appointments' && (
        <AppointmentsView onSelectPatient={handleSelectPatient} />
      )}

      {activeRoute === 'attention' && (
        <AttentionCenterView
          onSelectPatient={handleSelectPatient}
          onNavigate={setActiveRoute}
        />
      )}

      {activeRoute === 'followups' && (
        <FollowupsView onSelectPatient={handleSelectPatient} />
      )}

      {activeRoute === 'firebase-setup' && <FirebaseSetupView />}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <HealthcareProvider>
        <ProtectedWorkspace />
      </HealthcareProvider>
    </ErrorBoundary>
  );
}
