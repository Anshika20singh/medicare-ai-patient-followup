import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Mail,
  MapPin,
  Phone,
  Pill,
  Plus,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import {
  formatShortDate,
  formatTime12h,
  getTodayISO,
  isFollowupOverdue,
} from '../../utils/dateUtils';
import { StatusLabel } from '../common/StatusLabel';

interface PatientDetailViewProps {
  patientId: string;
  onBack: () => void;
}

export const PatientDetailView: React.FC<PatientDetailViewProps> = ({
  patientId,
  onBack,
}) => {
  const {
    patients,
    medicines,
    appointments,
    followups,
    attentionFlags,
    currentUser,
    updatePatient,
    recordDoseStatus,
    markFollowupCompleted,
    addFollowup,
    addFollowupNote,
  } = useHealthcare();

  const patient = patients.find((p) => p.id === patientId);
  const [newFollowupTitle, setNewFollowupTitle] = useState('');
  const [newFollowupDueDate, setNewFollowupDueDate] = useState(getTodayISO());
  const [newFollowupPriority, setNewFollowupPriority] = useState<'High' | 'Medium' | 'Low'>(
    'Medium'
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  if (!patient) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600">Patient record could not be found.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#0F2544] text-white text-sm font-semibold rounded-lg"
        >
          Back to Patients
        </button>
      </div>
    );
  }

  const today = getTodayISO();
  const patientMedicines = medicines.filter((m) => m.patientId === patient.id);
  const patientAppointments = appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
  const patientFollowups = followups
    .filter((f) => f.patientId === patient.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const attention = attentionFlags.find((f) => f.patient.id === patient.id);

  const handleQuickFollowup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowupTitle.trim()) return;
    addFollowup({
      patientId: patient.id,
      title: newFollowupTitle.trim(),
      dueDate: newFollowupDueDate,
      assignedStaff: currentUser?.name ?? 'Dr. Elena Vance',
      priority: newFollowupPriority,
    });
    setNewFollowupTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Back bar & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Patients</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <select
            value={patient.status}
            onChange={(e) =>
              updatePatient(patient.id, { status: e.target.value as typeof patient.status })
            }
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="Active">Active</option>
            <option value="Monitoring">Monitoring</option>
            <option value="Recovered">Recovered</option>
            <option value="Discharged">Discharged</option>
          </select>
        </div>
      </div>

      {/* Patient Profile Summary Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">{patient.id}</span>
              <span aria-hidden="true">·</span>
              <span>{patient.ward}</span>
              <span aria-hidden="true">·</span>
              <span>Discharged {formatShortDate(patient.dischargeDate)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {patient.name}
              </h2>
              <StatusLabel status={patient.status} />
            </div>
            <p className="text-sm font-medium text-teal-800">{patient.medicalCondition}</p>
            <p className="text-sm text-slate-600 leading-relaxed pt-1">{patient.careSummary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0 lg:w-[420px]">
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">{patient.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-slate-500">Email</p>
                <p className="font-medium text-slate-900 mt-0.5 truncate">{patient.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-500">Address</p>
                <p className="font-medium text-slate-900 mt-0.5">{patient.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-500">Emergency Contact</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {patient.emergencyContactName}
                </p>
                <p className="font-mono text-slate-500">{patient.emergencyContactPhone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rule-Based Attention Callout if Flagged */}
        {attention && (
          <div className="mt-5 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Care Coordination Alert:
                  </span>
                  <StatusLabel status={attention.priority} />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {attention.reasons.join(' · ')}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Two-Column Clinical Tracking: Medicines & Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medicine Schedules */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Medicine Schedules
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {patientMedicines.length} active
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {patientMedicines.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No medicine schedules assigned to this patient.
              </p>
            ) : (
              patientMedicines.map((med) => (
                <div key={med.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{med.medicineName}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {med.dosageInstructions} · {med.frequency}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                        {formatShortDate(med.startDate)} – {formatShortDate(med.endDate)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {med.logs.slice(-4).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70 text-xs"
                      >
                        <div className="flex items-center gap-2 font-mono tabular-nums text-slate-700">
                          <span>{formatShortDate(log.date)}</span>
                          <span className="text-slate-400">·</span>
                          <span>{formatTime12h(log.time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusLabel status={log.status} />
                          {log.status === 'Pending' && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={() => recordDoseStatus(med.id, log.id, 'Taken')}
                                title="Mark as Taken"
                                className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => recordDoseStatus(med.id, log.id, 'Missed')}
                                title="Mark as Missed"
                                className="p-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Appointments */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#0F2544]" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Appointment History
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              {patientAppointments.length} total
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {patientAppointments.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No appointments scheduled for this patient.
              </p>
            ) : (
              patientAppointments.map((apt) => (
                <div key={apt.id} className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{apt.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {apt.doctorName} · {apt.department} · {apt.type}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                      {formatShortDate(apt.appointmentDate)} at {formatTime12h(apt.appointmentTime)}
                    </p>
                    {apt.notes && (
                      <p className="text-xs text-slate-500 mt-1.5 italic">{apt.notes}</p>
                    )}
                  </div>
                  <StatusLabel status={apt.status} className="shrink-0" />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Follow-up History & Quick Add */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Follow-up History & Staff Notes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Post-discharge check-ins, completion tracking, and care coordinator notes
            </p>
          </div>
        </div>

        {/* Inline Quick Follow-up Form */}
        <form
          onSubmit={handleQuickFollowup}
          className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <input
            type="text"
            value={newFollowupTitle}
            onChange={(e) => setNewFollowupTitle(e.target.value)}
            placeholder="Add new follow-up check-in task..."
            className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            required
          />
          <input
            type="date"
            value={newFollowupDueDate}
            onChange={(e) => setNewFollowupDueDate(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            required
          />
          <select
            value={newFollowupPriority}
            onChange={(e) =>
              setNewFollowupPriority(e.target.value as 'High' | 'Medium' | 'Low')
            }
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </form>

        <div className="divide-y divide-slate-100">
          {patientFollowups.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No follow-up tasks logged yet.</p>
          ) : (
            patientFollowups.map((fup) => {
              const overdue = isFollowupOverdue(fup.dueDate, fup.status, today);
              return (
                <div key={fup.id} className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-semibold text-slate-900">{fup.title}</span>
                        <StatusLabel status={overdue ? 'Overdue' : fup.status} />
                        <StatusLabel status={fup.priority} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Due {formatShortDate(fup.dueDate)} · Assigned to {fup.assignedStaff}
                        {fup.completedAt && ` · Completed ${formatShortDate(fup.completedAt)}`}
                      </p>
                    </div>
                    {fup.status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={() => markFollowupCompleted(fup.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap self-start"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>

                  {fup.staffNotes.length > 0 && (
                    <div className="space-y-2 pl-3 border-l border-slate-200">
                      {fup.staffNotes.map((n) => (
                        <div key={n.id} className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{n.author}</span>{' '}
                          <span className="text-slate-400">({formatShortDate(n.createdAt)}):</span>{' '}
                          {n.note}
                        </div>
                      ))}
                    </div>
                  )}

                  {(fup.status !== 'Completed' || currentUser?.role === 'Admin') && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={noteDrafts[fup.id] ?? ''}
                        onChange={(e) =>
                          setNoteDrafts({ ...noteDrafts, [fup.id]: e.target.value })
                        }
                        placeholder="Add a staff note to this follow-up..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const text = noteDrafts[fup.id] ?? '';
                          if (!text.trim()) return;
                          addFollowupNote(fup.id, text);
                          setNoteDrafts({ ...noteDrafts, [fup.id]: '' });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                      >
                        Save Note
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
