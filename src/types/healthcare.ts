export type PatientStatus = 'Active' | 'Monitoring' | 'Recovered' | 'Discharged';

export interface StaffUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: 'Care Coordinator' | 'Head Nurse' | 'Attending Physician' | 'Admin';
  department: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Patient {
  id: string; // e.g., PAT-1042
  name: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  phone: string;
  email: string;
  address: string;
  medicalCondition: string;
  dischargeDate: string; // YYYY-MM-DD
  attendingPhysician: string;
  ward: string;
  status: PatientStatus;
  emergencyContactName: string;
  emergencyContactPhone: string;
  careSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type DoseStatus = 'Pending' | 'Taken' | 'Missed';

export interface MedicineDoseLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: DoseStatus;
  recordedAt?: string;
  recordedBy?: string;
}

export interface MedicineSchedule {
  id: string;
  patientId: string;
  medicineName: string;
  dosageInstructions: string;
  frequency: 'Once Daily' | 'Twice Daily' | 'Three Times Daily' | 'Every 12 Hours' | 'As Directed';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reminderTimings: string[]; // e.g., ["08:00", "20:00"]
  logs: MedicineDoseLog[];
  notes?: string;
  createdAt: string;
}

export type AppointmentStatus = 'Upcoming' | 'Completed' | 'Cancelled' | 'Missed';
export type AppointmentType = 'In-Person' | 'Telehealth' | 'Lab Review' | 'Post-Op Check';

export interface Appointment {
  id: string;
  patientId: string;
  title: string;
  doctorName: string;
  department: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowupPriority = 'High' | 'Medium' | 'Low';
export type FollowupStatus = 'Pending' | 'Completed';

export interface StaffNote {
  id: string;
  author: string;
  role: string;
  note: string;
  createdAt: string;
}

export interface Followup {
  id: string;
  patientId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  assignedStaff: string;
  priority: FollowupPriority;
  status: FollowupStatus;
  staffNotes: StaffNote[];
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: 'patient' | 'medicine' | 'appointment' | 'followup' | 'system';
  entityName: string;
  details: string;
}

export interface AttentionFlag {
  patient: Patient;
  priority: 'High' | 'Medium' | 'Low';
  score: number;
  reasons: string[];
  overdueFollowupCount: number;
  missedAppointmentCount: number;
  missedDoseCount: number;
  pendingTodayDoseCount: number;
  daysSinceDischarge: number;
}

export type ActiveRoute =
  | 'dashboard'
  | 'patients'
  | 'patient-detail'
  | 'medicines'
  | 'appointments'
  | 'attention'
  | 'followups'
  | 'firebase-setup';
