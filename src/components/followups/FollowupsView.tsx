import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { FollowupPriority } from '../../types/healthcare';
import { formatShortDate, getTodayISO, isFollowupOverdue } from '../../utils/dateUtils';
import { Modal } from '../common/Modal';
import { StatusLabel } from '../common/StatusLabel';

interface FollowupsViewProps {
  onSelectPatient: (patientId: string) => void;
}

export const FollowupsView: React.FC<FollowupsViewProps> = ({ onSelectPatient }) => {
  const {
    patients,
    followups,
    currentUser,
    addFollowup,
    markFollowupCompleted,
    reopenFollowup,
    addFollowupNote,
    deleteFollowup,
  } = useHealthcare();

  const today = getTodayISO();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'All' | 'Overdue' | 'Pending' | 'Completed'>('All');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: patients[0]?.id ?? '',
    title: '',
    dueDate: today,
    assignedStaff: currentUser?.name ?? 'Dr. Elena Vance',
    priority: 'Medium' as FollowupPriority,
  });

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const counts = useMemo(() => {
    const overdue = followups.filter((f) =>
      isFollowupOverdue(f.dueDate, f.status, today)
    ).length;
    const pending = followups.filter(
      (f) => f.status === 'Pending' && !isFollowupOverdue(f.dueDate, f.status, today)
    ).length;
    const completed = followups.filter((f) => f.status === 'Completed').length;
    return { overdue, pending, completed };
  }, [followups, today]);

  const filteredFollowups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return followups
      .filter((f) => {
        const overdue = isFollowupOverdue(f.dueDate, f.status, today);
        if (filterTab === 'Overdue' && !overdue) return false;
        if (filterTab === 'Pending' && (f.status !== 'Pending' || overdue)) return false;
        if (filterTab === 'Completed' && f.status !== 'Completed') return false;

        if (!q) return true;
        const pName = patientMap.get(f.patientId)?.name.toLowerCase() ?? '';
        return (
          f.title.toLowerCase().includes(q) ||
          f.assignedStaff.toLowerCase().includes(q) ||
          pName.includes(q) ||
          f.patientId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [followups, filterTab, searchQuery, patientMap, today]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.patientId || !form.title.trim() || !form.dueDate || !form.assignedStaff.trim()) {
      setFormError('All follow-up fields are required.');
      return;
    }
    addFollowup({
      patientId: form.patientId,
      title: form.title.trim(),
      dueDate: form.dueDate,
      assignedStaff: form.assignedStaff.trim(),
      priority: form.priority,
    });
    setForm({
      patientId: patients[0]?.id ?? '',
      title: '',
      dueDate: today,
      assignedStaff: currentUser?.name ?? 'Dr. Elena Vance',
      priority: 'Medium',
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700">Overdue Follow-ups</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-red-700 tabular-nums">
            {counts.overdue}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700">Due Today / Upcoming</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {counts.pending}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-emerald-700">Completed History</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {counts.completed}
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search follow-up tasks, patients, or staff..."
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['All', 'Overdue', 'Pending', 'Completed'] as const).map((tab) => (
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
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
          disabled={patients.length === 0}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Follow-up Task</span>
        </button>
      </div>

      {/* Follow-ups List */}
      <div className="space-y-4">
        {filteredFollowups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              No follow-up tasks in this view.
            </p>
          </div>
        ) : (
          filteredFollowups.map((fup) => {
            const patient = patientMap.get(fup.patientId);
            const overdue = isFollowupOverdue(fup.dueDate, fup.status, today);

            return (
              <article
                key={fup.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusLabel status={overdue ? 'Overdue' : fup.status} />
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <StatusLabel status={fup.priority} />
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectPatient(fup.patientId)}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        {patient?.name ?? fup.patientId} ({fup.patientId})
                      </button>
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900 pt-1">
                      {fup.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Due {formatShortDate(fup.dueDate)} · Assigned: {fup.assignedStaff}
                      {fup.completedAt && ` · Completed ${formatShortDate(fup.completedAt)} by ${fup.completedBy ?? 'Staff'}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {fup.status !== 'Completed' ? (
                      <button
                        type="button"
                        onClick={() => markFollowupCompleted(fup.id)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    ) : currentUser?.role === 'Admin' ? (
                      <button
                        type="button"
                        onClick={() => reopenFollowup(fup.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteFollowup(fup.id)}
                      aria-label={`Delete ${fup.title}`}
                      className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Staff Notes Thread */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  {fup.staffNotes.length > 0 && (
                    <div className="space-y-2">
                      {fup.staffNotes.map((note) => (
                        <div
                          key={note.id}
                          className="text-xs bg-slate-50 border border-slate-200/70 rounded-lg px-3.5 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-slate-500 mb-1">
                            <span className="font-semibold text-slate-800">
                              {note.author} · {note.role}
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatShortDate(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(fup.status !== 'Completed' || currentUser?.role === 'Admin') && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={noteDrafts[fup.id] ?? ''}
                        onChange={(e) =>
                          setNoteDrafts({ ...noteDrafts, [fup.id]: e.target.value })
                        }
                        placeholder="Log a staff follow-up note..."
                        className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const text = noteDrafts[fup.id] ?? '';
                          if (!text.trim()) return;
                          addFollowupNote(fup.id, text);
                          setNoteDrafts({ ...noteDrafts, [fup.id]: '' });
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Add Note</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* New Follow-up Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Follow-up Task"
        subtitle="Assign a post-discharge call or check-in with due date tracking."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
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
              Follow-up Task Description *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., 48-hour post-discharge vitals & medication check"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Priority *
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as FollowupPriority })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Assigned Staff Member *
            </label>
            <input
              type="text"
              value={form.assignedStaff}
              onChange={(e) => setForm({ ...form, assignedStaff: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2544] rounded-lg hover:bg-[#16335c]"
            >
              Create Follow-up
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
