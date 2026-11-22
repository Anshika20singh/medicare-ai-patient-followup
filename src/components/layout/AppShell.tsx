import React, { useState } from 'react';
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  Database,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { ActiveRoute } from '../../types/healthcare';
import { Modal } from '../common/Modal';

interface AppShellProps {
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  breadcrumbTitle: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeRoute,
  onNavigate,
  breadcrumbTitle,
  headerAction,
  children,
}) => {
  const { currentUser, logout, attentionFlags, resetDemoDatabase } = useHealthcare();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const highRiskCount = attentionFlags.filter((f) => f.priority === 'High').length;

  const navItems: {
    id: ActiveRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeCount?: number;
  }[] = [
    { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'medicines', label: 'Medicine Reminders', icon: Pill },
    { id: 'appointments', label: 'Appointments', icon: CalendarClock },
    {
      id: 'attention',
      label: 'AI Attention Center',
      icon: BrainCircuit,
      badgeCount: highRiskCount > 0 ? highRiskCount : undefined,
    },
    { id: 'followups', label: 'Follow-up Tracker', icon: ClipboardList },
    { id: 'firebase-setup', label: 'Firebase Setup', icon: Database },
  ];

  const handleNavClick = (id: ActiveRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const initials = (currentUser?.name ?? 'MC')
    .split(' ')
    .filter((p) => !p.endsWith('.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F2544] text-slate-200">
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
            <HeartPulse className="w-4 h-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            MediCare AI
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeRoute === item.id ||
            (activeRoute === 'patient-detail' && item.id === 'patients');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badgeCount !== undefined && (
                <span
                  className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-red-500/20 text-red-200'
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Staff & Demo Controls */}
      <div className="p-3 border-t border-white/10 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => setResetModalOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Reset Demo Data</span>
        </button>

        <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg bg-white/5">
          {currentUser?.avatarUrl && !avatarError ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">
              {currentUser?.name}
            </p>
            <p className="text-[11px] text-slate-300 truncate">{currentUser?.role}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Fixed Sidebar (256px) */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[82vw] h-full z-10 shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean Contextual Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                MediCare AI
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {breadcrumbTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {headerAction}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Reset Demo Data Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Fictional Demo Dataset"
        subtitle="Restore the initial sample patients, medicine schedules, appointments, and follow-ups."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            This will replace your current browser-persisted records with the original clearly
            labelled demonstration records. Any custom patients or notes added during this session
            will be cleared.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemoDatabase();
                setResetModalOpen(false);
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2544] rounded-lg hover:bg-[#16335c] transition-colors inline-flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Restore Demo Data</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
