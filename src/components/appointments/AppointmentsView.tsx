import React, { useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { Appointment, AppointmentStatus, AppointmentType } from '../../types/healthcare';
import { formatShortDate, formatTime12h, getTodayISO } from '../../utils/dateUtils';
import { Modal } from '../common/Modal';
import { StatusLabel } from '../common/StatusLabel';

interface AppointmentsViewProps {
  onSelectPatient: (patientId: string) => void;
}

interface AppointmentFormState {
  patientId: string;
  title: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  appointmentTime: string;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({ onSelectPatient }) => {
  const {
    patients,
    appointments,
    currentUser,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    deleteAppointment,
  } = useHealthcare();

  const today = getTodayISO();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | AppointmentStatus>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentFormState>({
    patientId: patients[0]?.id ?? '',
    title: '',
    doctorName: '',
    department: '',
    appointmentDate: today,
    appointmentTime: '10:00',
    type: 'In-Person',
    status: 'Upcoming',
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments
      .filter((a) => {
        if (statusFilter !== 'All' && a.status !== statusFilter) return false;
        if (!q) return true;
        const pName = patientMap.get(a.patientId)?.name.toLowerCase() ?? '';
        return (
          a.title.toLowerCase().includes(q) ||
          a.doctorName.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q) ||
          pName.includes(q) ||
          a.patientId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        `${b.appointmentDate} ${b.appointmentTime}`.localeCompare(
          `${a.appointmentDate} ${a.appointmentTime}`
        )
      );
  }, [appointments, patientMap, searchQuery, statusFilter]);

  const openScheduleModal = () => {
    setEditingApt(null);
    setFormError(null);
    setForm({
      patientId: patients[0]?.id ?? '',
      title: '',
      doctorName: patients[0]?.attendingPhysician ?? '',
      department: 'Post-Discharge Clinic',
      appointmentDate: today,
      appointmentTime: '10:00',
      type: 'In-Person',
      status: 'Upcoming',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setFormError(null);
    setForm({
      patientId: apt.patientId,
      title: apt.title,
      doctorName: apt.doctorName,
      department: apt.department,
      appointmentDate: apt.appointmentDate,
      appointmentTime: apt.appointmentTime,
      type: apt.type,
      status: apt.status,
      notes: apt.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.patientId) {
      setFormError('Please select a patient.');
      return;
    }
    if (!form.title.trim() || !form.doctorName.trim()) {
      setFormError('Appointment title and attending doctor are required.');
      return;
    }
    if (!form.appointmentDate || !form.appointmentTime) {
      setFormError('Appointment date and time are required.');
      return;
    }

    const payload = {
      patientId: form.patientId,
      title: form.title.trim(),
      doctorName: form.doctorName.trim(),
      department: form.department.trim() || 'Outpatient Clinic',
      appointmentDate: form.appointmentDate,
      appointmentTime: form.appointmentTime,
      type: form.type,
      status: form.status,
      notes: form.notes.trim(),
    };

    if (editingApt) {
      updateAppointment(editingApt.id, payload);
    } else {
      addAppointment(payload);
    }
    setModalOpen(false);
  };

  const statusTabs: ('All' | AppointmentStatus)[] = [
    'All',
    'Upcoming',
    'Completed',
    'Missed',
    'Cancelled',
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient, doctor, or visit reason..."
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openScheduleModal}
          disabled={patients.length === 0}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Appointment</span>
        </button>
      </div>

      {/* Appointments Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
              No appointments found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Schedule a new post-discharge appointment or clear your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Visit Details</th>
                  <th className="py-3 px-4">Clinician & Clinic</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAppointments.map((apt) => {
                  const patient = patientMap.get(apt.patientId);
                  return (
                    <tr key={apt.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatShortDate(apt.appointmentDate)}
                        </div>
                        <div className="font-mono text-xs text-slate-500 tabular-nums mt-0.5">
                          {formatTime12h(apt.appointmentTime)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectPatient(apt.patientId)}
                          className="font-semibold text-teal-700 hover:underline text-left"
                        >
                          {patient?.name ?? apt.patientId}
                        </button>
                        <div className="font-mono text-xs text-slate-400 tabular-nums">
                          {apt.patientId}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{apt.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {apt.type}
                          {apt.notes ? ` · ${apt.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800">{apt.doctorName}</div>
                        <div className="text-xs text-slate-500">{apt.department}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusLabel status={apt.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {apt.status === 'Upcoming' && (
                            <>
                              <button
                                type="button"
                                onClick={() => updateAppointmentStatus(apt.id, 'Completed')}
                                title="Mark Completed"
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-md inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAppointmentStatus(apt.id, 'Cancelled')}
                                title="Cancel Appointment"
                                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md inline-flex items-center gap-1"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                            </>
                          )}
                          {(!(apt.status === 'Completed' || apt.status === 'Cancelled') ||
                            currentUser?.role === 'Admin') && (
                            <button
                              type="button"
                              onClick={() => openEditModal(apt)}
                              aria-label={`Edit ${apt.title}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(apt)}
                            aria-label={`Delete ${apt.title}`}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule / Edit Appointment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingApt ? 'Edit Appointment' : 'Schedule Post-Discharge Appointment'}
        subtitle="Changes immediately update dashboard analytics and attention alerts."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Patient *
            </label>
            <select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Appointment Reason / Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Post-Discharge Cardiology Review"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Doctor Name *
              </label>
              <input
                type="text"
                value={form.doctorName}
                onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
                placeholder="Dr. Priya Nair"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Cardiology"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={form.appointmentDate}
                onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={form.appointmentTime}
                onChange={(e) => setForm({ ...form, appointmentTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Visit Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as AppointmentType })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="In-Person">In-Person</option>
                <option value="Telehealth">Telehealth</option>
                <option value="Lab Review">Lab Review</option>
                <option value="Post-Op Check">Post-Op Check</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AppointmentStatus })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
                <option value="Missed">Missed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Visit Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Preparation instructions or rescheduling context..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2544] rounded-lg hover:bg-[#16335c]"
            >
              {editingApt ? 'Save Appointment' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Appointment"
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Permanently remove appointment{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.title}</span>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAppointment(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
