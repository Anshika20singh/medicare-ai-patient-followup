import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  Info,
  Pill,
  ShieldCheck,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { ActiveRoute } from '../../types/healthcare';
import { formatShortDate } from '../../utils/dateUtils';
import { StatusLabel } from '../common/StatusLabel';

interface AttentionCenterViewProps {
  onSelectPatient: (patientId: string) => void;
  onNavigate: (route: ActiveRoute) => void;
}

export const AttentionCenterView: React.FC<AttentionCenterViewProps> = ({
  onSelectPatient,
  onNavigate,
}) => {
  const { attentionFlags } = useHealthcare();
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  const counts = useMemo(() => {
    return {
      all: attentionFlags.length,
      high: attentionFlags.filter((f) => f.priority === 'High').length,
      medium: attentionFlags.filter((f) => f.priority === 'Medium').length,
      low: attentionFlags.filter((f) => f.priority === 'Low').length,
    };
  }, [attentionFlags]);

  const filteredFlags = useMemo(() => {
    if (priorityFilter === 'All') return attentionFlags;
    return attentionFlags.filter((f) => f.priority === priorityFilter);
  }, [attentionFlags, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Transparent Non-Diagnostic Operational Notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0F2544] text-teal-300 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Transparent Rule-Based Attention Engine
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
              Automatically flags patients based on operational schedule compliance: overdue
              follow-up tasks, missed clinic appointments, missed or pending medication reminders,
              and early post-discharge monitoring status. This module supports administrative staff
              prioritization and does not provide medical diagnosis or treatment recommendations.
            </p>
          </div>
        </div>
      </div>

      {/* Priority Summary & Filter Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setPriorityFilter('All')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            priorityFilter === 'All'
              ? 'bg-[#0F2544] text-white border-[#0F2544]'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className={`text-xs font-medium ${priorityFilter === 'All' ? 'text-slate-300' : 'text-slate-500'}`}>
            All Flagged Patients
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{counts.all}</p>
        </button>

        <button
          type="button"
          onClick={() => setPriorityFilter('High')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            priorityFilter === 'High'
              ? 'bg-red-700 text-white border-red-700'
              : 'bg-white text-slate-900 border-slate-200 hover:border-red-300'
          }`}
        >
          <p className={`text-xs font-medium ${priorityFilter === 'High' ? 'text-red-100' : 'text-red-700'}`}>
            High Priority
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{counts.high}</p>
        </button>

        <button
          type="button"
          onClick={() => setPriorityFilter('Medium')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            priorityFilter === 'Medium'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-slate-900 border-slate-200 hover:border-amber-300'
          }`}
        >
          <p className={`text-xs font-medium ${priorityFilter === 'Medium' ? 'text-amber-100' : 'text-amber-700'}`}>
            Medium Priority
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{counts.medium}</p>
        </button>

        <button
          type="button"
          onClick={() => setPriorityFilter('Low')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            priorityFilter === 'Low'
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-900 border-slate-200 hover:border-teal-300'
          }`}
        >
          <p className={`text-xs font-medium ${priorityFilter === 'Low' ? 'text-teal-100' : 'text-teal-700'}`}>
            Low Priority
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{counts.low}</p>
        </button>
      </div>

      {/* Flagged Patients List */}
      <div className="space-y-4">
        {filteredFlags.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
              No patients flagged in this priority tier
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              All monitored follow-ups, visits, and medication schedules in this view are resolved.
            </p>
          </div>
        ) : (
          filteredFlags.map((flag) => (
            <article
              key={flag.patient.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusLabel status={flag.priority} />
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPatient(flag.patient.id)}
                    className="font-display text-lg font-semibold text-slate-900 hover:text-teal-700 text-left"
                  >
                    {flag.patient.name}
                  </button>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {flag.patient.id}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span>{flag.patient.medicalCondition}</span>
                  <span aria-hidden="true">·</span>
                  <span>Discharged {formatShortDate(flag.patient.dischargeDate)}</span>
                  <span aria-hidden="true">·</span>
                  <span>Attending: {flag.patient.attendingPhysician}</span>
                </div>

                <div className="pt-1">
                  <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-700" />
                    <span>Rule-Based Explanation:</span>
                  </p>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {flag.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-400 select-none">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                    <span>{flag.overdueFollowupCount} overdue follow-ups</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{flag.missedAppointmentCount} missed appointments</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {flag.missedDoseCount} missed / {flag.pendingTodayDoseCount} pending today doses
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectPatient(flag.patient.id)}
                  className="px-4 py-2 bg-[#0F2544] hover:bg-[#16335c] text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Open Patient Chart</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {flag.overdueFollowupCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('followups')}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Review Follow-ups
                  </button>
                )}
                {flag.missedAppointmentCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onNavigate('appointments')}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Reschedule Visit
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
