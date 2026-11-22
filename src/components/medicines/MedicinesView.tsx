import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Edit3,
  Pill,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { DoseStatus, MedicineSchedule } from '../../types/healthcare';
import {
  addDaysISO,
  formatShortDate,
  formatTime12h,
  getTodayISO,
} from '../../utils/dateUtils';
import { Modal } from '../common/Modal';
import { StatusLabel } from '../common/StatusLabel';

interface MedicinesViewProps {
  onSelectPatient: (patientId: string) => void;
}

interface MedicineFormState {
  patientId: string;
  medicineName: string;
  dosageInstructions: string;
  frequency: MedicineSchedule['frequency'];
  startDate: string;
  endDate: string;
  reminderTimings: string[];
  notes: string;
}

export const MedicinesView: React.FC<MedicinesViewProps> = ({ onSelectPatient }) => {
  const {
    patients,
    medicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    recordDoseStatus,
    addTodayDoseLogsIfMissing,
  } = useHealthcare();

  const today = getTodayISO();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'All' | 'Pending' | 'Taken' | 'Missed'>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicineSchedule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newTimingInput, setNewTimingInput] = useState('12:00');
  const [form, setForm] = useState<MedicineFormState>({
    patientId: patients[0]?.id ?? '',
    medicineName: '',
    dosageInstructions: '',
    frequency: 'Twice Daily',
    startDate: today,
    endDate: addDaysISO(today, 14),
    reminderTimings: ['08:00', '20:00'],
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<MedicineSchedule | null>(null);

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  // Compute global adherence metrics across all logged dose slots
  const metrics = useMemo(() => {
    const allLogs = medicines.flatMap((m) => m.logs);
    const taken = allLogs.filter((l) => l.status === 'Taken').length;
    const missed = allLogs.filter((l) => l.status === 'Missed').length;
    const pending = allLogs.filter((l) => l.status === 'Pending').length;
    const completedTotal = taken + missed;
    const adherenceRate =
      completedTotal > 0 ? Math.round((taken / completedTotal) * 100) : 100;

    return { totalSchedules: medicines.length, taken, missed, pending, adherenceRate };
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return medicines.filter((m) => {
      const patient = patientMap.get(m.patientId);
      if (q) {
        const match =
          m.medicineName.toLowerCase().includes(q) ||
          m.dosageInstructions.toLowerCase().includes(q) ||
          (patient?.name.toLowerCase().includes(q) ?? false) ||
          m.patientId.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterTab !== 'All') {
        return m.logs.some((l) => l.status === filterTab);
      }
      return true;
    });
  }, [medicines, patientMap, searchQuery, filterTab]);

  // Flat upcoming / today reminders queue
  const todayDoseQueue = useMemo(() => {
    const items: {
      medicine: MedicineSchedule;
      patientName: string;
      logId: string;
      date: string;
      time: string;
      status: DoseStatus;
    }[] = [];

    for (const med of medicines) {
      const patientName = patientMap.get(med.patientId)?.name ?? med.patientId;
      for (const log of med.logs) {
        if (log.date === today || log.status === 'Pending') {
          items.push({
            medicine: med,
            patientName,
            logId: log.id,
            date: log.date,
            time: log.time,
            status: log.status,
          });
        }
      }
    }

    return items.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  }, [medicines, patientMap, today]);

  const openAddModal = () => {
    setEditingMed(null);
    setFormError(null);
    setForm({
      patientId: patients[0]?.id ?? '',
      medicineName: '',
      dosageInstructions: '',
      frequency: 'Twice Daily',
      startDate: today,
      endDate: addDaysISO(today, 14),
      reminderTimings: ['08:00', '20:00'],
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (med: MedicineSchedule) => {
    setEditingMed(med);
    setFormError(null);
    setForm({
      patientId: med.patientId,
      medicineName: med.medicineName,
      dosageInstructions: med.dosageInstructions,
      frequency: med.frequency,
      startDate: med.startDate,
      endDate: med.endDate,
      reminderTimings: [...med.reminderTimings],
      notes: med.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleAddTiming = () => {
    if (!newTimingInput) return;
    if (form.reminderTimings.includes(newTimingInput)) return;
    setForm((prev) => ({
      ...prev,
      reminderTimings: [...prev.reminderTimings, newTimingInput].sort(),
    }));
  };

  const handleRemoveTiming = (time: string) => {
    setForm((prev) => ({
      ...prev,
      reminderTimings: prev.reminderTimings.filter((t) => t !== time),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.patientId) {
      setFormError('Please select a patient.');
      return;
    }
    if (!form.medicineName.trim() || !form.dosageInstructions.trim()) {
      setFormError('Medicine name and dosage instructions are required.');
      return;
    }
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }
    if (form.reminderTimings.length === 0) {
      setFormError('Add at least one daily reminder timing.');
      return;
    }

    const payload = {
      patientId: form.patientId,
      medicineName: form.medicineName.trim(),
      dosageInstructions: form.dosageInstructions.trim(),
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate,
      reminderTimings: form.reminderTimings,
      notes: form.notes.trim(),
    };

    if (editingMed) {
      updateMedicine(editingMed.id, payload);
    } else {
      addMedicine(payload);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Adherence KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Active Schedules</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalSchedules}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Pending Reminders</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-amber-700 tabular-nums">
            {metrics.pending}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Doses Taken</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {metrics.taken}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">
            Missed / Adherence Rate
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
            <span className={metrics.missed > 0 ? 'text-red-700' : 'text-slate-900'}>
              {metrics.missed}
            </span>
            <span className="text-sm font-normal text-slate-400 mx-1.5">·</span>
            <span className="text-teal-700">{metrics.adherenceRate}%</span>
          </p>
        </div>
      </section>

      {/* Upcoming & Today's Reminder Queue */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Upcoming & Today’s Medicine Reminders
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Log doses directly as Taken or Missed
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {todayDoseQueue.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No reminder slots queued for today.
            </p>
          ) : (
            todayDoseQueue.map((item) => (
              <div
                key={item.logId}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#0F2544] tabular-nums">
                      {formatTime12h(item.time)}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.medicine.medicineName}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectPatient(item.medicine.patientId)}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      {item.patientName}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.medicine.dosageInstructions} · {formatShortDate(item.date)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusLabel status={item.status} className="mr-2" />
                  {item.status !== 'Taken' && (
                    <button
                      type="button"
                      onClick={() =>
                        recordDoseStatus(item.medicine.id, item.logId, 'Taken')
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Taken</span>
                    </button>
                  )}
                  {item.status !== 'Missed' && (
                    <button
                      type="button"
                      onClick={() =>
                        recordDoseStatus(item.medicine.id, item.logId, 'Missed')
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Missed</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Toolbar & All Schedules Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicine name or patient..."
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['All', 'Pending', 'Taken', 'Missed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterTab === tab
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
          onClick={openAddModal}
          disabled={patients.length === 0}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Medicine Schedule</span>
        </button>
      </div>

      {/* Schedules List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredMedicines.length === 0 ? (
          <div className="p-10 text-center">
            <Pill className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              No medicine schedules match the active filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Medicine & Dosage</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Frequency & Timings</th>
                  <th className="py-3 px-4">Course Dates</th>
                  <th className="py-3 px-4">Dose Summary</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMedicines.map((med) => {
                  const patient = patientMap.get(med.patientId);
                  const takenCount = med.logs.filter((l) => l.status === 'Taken').length;
                  const missedCount = med.logs.filter((l) => l.status === 'Missed').length;
                  const pendingCount = med.logs.filter((l) => l.status === 'Pending').length;

                  return (
                    <tr key={med.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {med.medicineName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {med.dosageInstructions}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectPatient(med.patientId)}
                          className="font-medium text-teal-700 hover:underline text-left"
                        >
                          {patient?.name ?? med.patientId}
                        </button>
                        <div className="font-mono text-xs text-slate-400 tabular-nums">
                          {med.patientId}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800">
                          {med.frequency}
                        </div>
                        <div className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums">
                          {med.reminderTimings.map(formatTime12h).join(' · ')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatShortDate(med.startDate)} – {formatShortDate(med.endDate)}
                      </td>
                      <td className="py-3.5 px-4 text-xs tabular-nums whitespace-nowrap">
                        <span className="text-emerald-700 font-semibold">
                          {takenCount} taken
                        </span>
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span className="text-amber-700 font-semibold">
                          {pendingCount} pending
                        </span>
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span
                          className={
                            missedCount > 0
                              ? 'text-red-700 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          {missedCount} missed
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => addTodayDoseLogsIfMissing(med.id)}
                            title="Queue today's reminder slots"
                            className="px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-md"
                          >
                            + Today Slots
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(med)}
                            aria-label={`Edit ${med.medicineName}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(med)}
                            aria-label={`Delete ${med.medicineName}`}
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

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMed ? 'Edit Medicine Schedule' : 'Add Medicine Reminder Schedule'}
        subtitle="Configure dosage instructions, treatment window, and daily reminder timings."
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
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medicine Name & Strength *
              </label>
              <input
                type="text"
                value={form.medicineName}
                onChange={(e) => setForm({ ...form, medicineName: e.target.value })}
                placeholder="e.g., Lisinopril 10mg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Frequency *
              </label>
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frequency: e.target.value as MedicineSchedule['frequency'],
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="Once Daily">Once Daily</option>
                <option value="Twice Daily">Twice Daily</option>
                <option value="Three Times Daily">Three Times Daily</option>
                <option value="Every 12 Hours">Every 12 Hours</option>
                <option value="As Directed">As Directed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Dosage Instructions *
            </label>
            <input
              type="text"
              value={form.dosageInstructions}
              onChange={(e) => setForm({ ...form, dosageInstructions: e.target.value })}
              placeholder="e.g., 1 tablet orally after morning meal"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Daily Reminder Timings *
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {form.reminderTimings.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono text-xs text-slate-800"
                >
                  <span>{formatTime12h(t)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTiming(t)}
                    aria-label={`Remove ${t}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={newTimingInput}
                onChange={(e) => setNewTimingInput(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleAddTiming}
                className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
              >
                + Add Time
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Staff Notes (Optional)
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Special administration instructions..."
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
              {editingMed ? 'Save Schedule' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Medicine Schedule"
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Remove <span className="font-semibold text-slate-900">{deleteTarget.medicineName}</span>{' '}
              and its reminder logs?
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
                  deleteMedicine(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete Schedule
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
