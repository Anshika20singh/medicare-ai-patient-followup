import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { Patient, PatientStatus } from '../../types/healthcare';
import { formatShortDate, getTodayISO } from '../../utils/dateUtils';
import { Modal } from '../common/Modal';
import { StatusLabel } from '../common/StatusLabel';

interface PatientsViewProps {
  onSelectPatient: (patientId: string) => void;
}

interface PatientFormState {
  name: string;
  age: string;
  gender: Patient['gender'];
  phone: string;
  email: string;
  address: string;
  medicalCondition: string;
  dischargeDate: string;
  attendingPhysician: string;
  ward: string;
  status: PatientStatus;
  emergencyContactName: string;
  emergencyContactPhone: string;
  careSummary: string;
}

const emptyForm = (): PatientFormState => ({
  name: '',
  age: '',
  gender: 'Female',
  phone: '',
  email: '',
  address: '',
  medicalCondition: '',
  dischargeDate: getTodayISO(),
  attendingPhysician: '',
  ward: '',
  status: 'Active',
  emergencyContactName: '',
  emergencyContactPhone: '',
  careSummary: '',
});

export const PatientsView: React.FC<PatientsViewProps> = ({ onSelectPatient }) => {
  const { patients, addPatient, updatePatient, deletePatient } = useHealthcare();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PatientStatus>('All');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.medicalCondition.toLowerCase().includes(q) ||
        p.attendingPhysician.toLowerCase().includes(q)
      );
    });
  }, [patients, searchQuery, statusFilter]);

  const openAddModal = () => {
    setEditingPatient(null);
    setForm(emptyForm());
    setFormError(null);
    setFormModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setForm({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      medicalCondition: patient.medicalCondition,
      dischargeDate: patient.dischargeDate,
      attendingPhysician: patient.attendingPhysician,
      ward: patient.ward,
      status: patient.status,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      careSummary: patient.careSummary,
    });
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAge = Number(form.age);
    if (!form.name.trim()) {
      setFormError('Patient full name is required.');
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      setFormError('Please enter a valid patient age between 0 and 120.');
      return;
    }
    if (!form.phone.trim()) {
      setFormError('Primary contact phone number is required.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!form.medicalCondition.trim() || !form.dischargeDate) {
      setFormError('Medical condition and discharge date are required.');
      return;
    }
    if (!form.attendingPhysician.trim()) {
      setFormError('Attending physician is required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      age: Math.round(parsedAge),
      gender: form.gender,
      phone: form.phone.trim(),
      email: form.email.trim() || 'not-provided@example.org',
      address: form.address.trim() || 'Address on file',
      medicalCondition: form.medicalCondition.trim(),
      dischargeDate: form.dischargeDate,
      attendingPhysician: form.attendingPhysician.trim(),
      ward: form.ward.trim() || 'General Care Unit',
      status: form.status,
      emergencyContactName: form.emergencyContactName.trim() || 'Not specified',
      emergencyContactPhone: form.emergencyContactPhone.trim() || form.phone.trim(),
      careSummary: form.careSummary.trim() || 'Post-discharge outpatient care follow-up.',
    };

    if (editingPatient) {
      updatePatient(editingPatient.id, payload);
    } else {
      addPatient(payload);
    }
    setFormModalOpen(false);
  };

  const statusTabs: ('All' | PatientStatus)[] = [
    'All',
    'Active',
    'Monitoring',
    'Recovered',
    'Discharged',
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
              placeholder="Search by patient name, ID (PAT-1042), or condition..."
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
          onClick={openAddModal}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Patient</span>
        </button>
      </div>

      {/* Patients Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
              No matching patient records
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Adjust your search filter or register a newly discharged patient.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-[#0F2544] text-white text-sm font-semibold rounded-lg hover:bg-[#16335c] transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Patient</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Patient ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Medical Condition</th>
                  <th className="py-3 px-4">Discharge Date</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap">
                      {patient.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectPatient(patient.id)}
                        className="font-semibold text-slate-900 hover:text-teal-700 text-left"
                      >
                        {patient.name}
                      </button>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {patient.age} yrs · {patient.gender} · {patient.attendingPhysician}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">
                        {patient.medicalCondition}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{patient.ward}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatShortDate(patient.dischargeDate)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="font-mono tabular-nums">{patient.phone}</div>
                      <div className="text-slate-400 truncate max-w-[160px]">{patient.email}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusLabel status={patient.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectPatient(patient.id)}
                          title="View patient details"
                          className="px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(patient)}
                          title="Edit patient"
                          aria-label={`Edit ${patient.name}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(patient)}
                          title="Delete patient"
                          aria-label={`Delete ${patient.name}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Patient Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingPatient ? `Edit Patient · ${editingPatient.id}` : 'Register Discharged Patient'}
        subtitle="All clinical and contact fields persist immediately across refreshes."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Clara Henderson (Demo)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
              <input
                type="number"
                min={0}
                max={120}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="64"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as Patient['gender'] })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Care Status *
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PatientStatus })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                <option value="Active">Active</option>
                <option value="Monitoring">Monitoring</option>
                <option value="Recovered">Recovered</option>
                <option value="Discharged">Discharged</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Discharge Date *
              </label>
              <input
                type="date"
                value={form.dischargeDate}
                onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Medical Condition / Procedure *
              </label>
              <input
                type="text"
                value={form.medicalCondition}
                onChange={(e) => setForm({ ...form, medicalCondition: e.target.value })}
                placeholder="e.g., Post-CABG Recovery"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attending Physician *
              </label>
              <input
                type="text"
                value={form.attendingPhysician}
                onChange={(e) => setForm({ ...form, attendingPhysician: e.target.value })}
                placeholder="e.g., Dr. Priya Nair"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 234-5678"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="patient@example.org"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Discharge Ward
              </label>
              <input
                type="text"
                value={form.ward}
                onChange={(e) => setForm({ ...form, ward: e.target.value })}
                placeholder="Cardiology 4A"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, City"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="Relative / Caregiver"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency Phone
              </label>
              <input
                type="tel"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="(555) 234-9999"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Discharge Care Summary
            </label>
            <textarea
              rows={3}
              value={form.careSummary}
              onChange={(e) => setForm({ ...form, careSummary: e.target.value })}
              placeholder="Key discharge instructions, mobility milestones, or monitoring reminders..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFormModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2544] rounded-lg hover:bg-[#16335c] transition-colors"
            >
              {editingPatient ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Patient Record"
        subtitle="This action removes the patient and all linked reminders, visits, and follow-ups."
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirm permanent deletion of{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.name}</span> (
              <span className="font-mono">{deleteTarget.id}</span>)?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePatient(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete Record
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
