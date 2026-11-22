import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createDemoDatabase } from '../data/demoData';
import {
  auth,
  ConnectionCheckResult,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  ActivityLog,
  Appointment,
  AppointmentStatus,
  AttentionFlag,
  DoseStatus,
  Followup,
  MedicineDoseLog,
  MedicineSchedule,
  Patient,
  StaffUser,
} from '../types/healthcare';
import { evaluateAttentionFlags } from '../utils/attentionRules';
import { getTodayISO } from '../utils/dateUtils';

interface HealthcareContextValue {
  isLoading: boolean;
  authReady: boolean;
  connectionStatus: ConnectionCheckResult | null;
  error: string | null;
  clearError: () => void;
  currentUser: StaffUser | null;
  patients: Patient[];
  medicines: MedicineSchedule[];
  appointments: Appointment[];
  followups: Followup[];
  activities: ActivityLog[];
  attentionFlags: AttentionFlag[];

  // Auth
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Patients CRUD
  addPatient: (input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Patient>;
  updatePatient: (
    id: string,
    updates: Partial<Omit<Patient, 'id' | 'createdAt'>>
  ) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;

  // Medicines CRUD & Dose Tracking
  addMedicine: (
    input: Omit<MedicineSchedule, 'id' | 'logs' | 'createdAt'>
  ) => Promise<MedicineSchedule>;
  updateMedicine: (
    id: string,
    updates: Partial<Omit<MedicineSchedule, 'id' | 'createdAt'>>
  ) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  recordDoseStatus: (medicineId: string, logId: string, status: DoseStatus) => Promise<void>;
  addTodayDoseLogsIfMissing: (medicineId: string) => Promise<void>;

  // Appointments CRUD
  addAppointment: (
    input: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Appointment>;
  updateAppointment: (
    id: string,
    updates: Partial<Omit<Appointment, 'id' | 'createdAt'>>
  ) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;

  // Follow-ups CRUD
  addFollowup: (
    input: Omit<Followup, 'id' | 'staffNotes' | 'createdAt' | 'status'>
  ) => Promise<Followup>;
  markFollowupCompleted: (id: string, completionNote?: string) => Promise<void>;
  reopenFollowup: (id: string) => Promise<void>;
  addFollowupNote: (followupId: string, note: string) => Promise<void>;
  deleteFollowup: (id: string) => Promise<void>;

  // Demo utilities
  resetDemoDatabase: () => Promise<void>;
}

const HealthcareContext = createContext<HealthcareContextValue | null>(null);

function generateId(prefix: string): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${num}${suffix}`;
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function toIsoString(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

export const HealthcareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionCheckResult | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<MedicineSchedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  // Startup Firestore connectivity check
  useEffect(() => {
    let active = true;
    testConnection().then((result) => {
      if (active) {
        setConnectionStatus(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCurrentUser(null);
        setPatients([]);
        setMedicines([]);
        setAppointments([]);
        setFollowups([]);
        setActivities([]);
        setAuthReady(true);
        setIsLoading(false);
        return;
      }

      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setCurrentUser({
            id: user.uid,
            uid: user.uid,
            name: String(data.name ?? user.displayName ?? 'Clinical Staff'),
            email: String(data.email ?? user.email ?? ''),
            role: (data.role as StaffUser['role']) ?? 'Care Coordinator',
            department: String(data.department ?? 'Post-Discharge Care Unit'),
            avatarUrl: data.avatarUrl ? String(data.avatarUrl) : user.photoURL ?? undefined,
            createdAt: toIsoString(data.createdAt),
          });
        } else {
          const isBootstrappedAdmin = user.email === 'singhanshika5005@gmail.com';
          const profilePayload: Record<string, unknown> = {
            uid: user.uid,
            name: clampStr(user.displayName || 'Clinical Staff', 120) || 'Clinical Staff',
            email: clampStr(user.email || 'staff@medicare.org', 160),
            role: isBootstrappedAdmin ? 'Admin' : 'Care Coordinator',
            department: 'Post-Discharge Care Unit',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (user.photoURL) {
            profilePayload.avatarUrl = clampStr(user.photoURL, 500);
          }
          await setDoc(userRef, profilePayload);
          setCurrentUser({
            id: user.uid,
            uid: user.uid,
            name: String(profilePayload.name),
            email: String(profilePayload.email),
            role: profilePayload.role as StaffUser['role'],
            department: String(profilePayload.department),
            avatarUrl: user.photoURL ?? undefined,
            createdAt: new Date().toISOString(),
          });
        }
        testConnection().then(setConnectionStatus);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      } finally {
        setAuthReady(true);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const seedDemoDataForUser = async (uid: string, actor: string) => {
    const demo = createDemoDatabase();
    const uidTag = sanitizeId(uid).slice(0, 6) || 'DEMO';

    try {
      // Batch 1: Seed parent patient records first
      const patientBatch = writeBatch(db);
      const idMap = new Map<string, string>();
      for (const p of demo.patients) {
        const scopedId = sanitizeId(`${p.id}-${uidTag}`);
        idMap.set(p.id, scopedId);
        patientBatch.set(doc(db, 'patients', scopedId), {
          id: scopedId,
          ownerId: uid,
          name: clampStr(p.name, 120),
          age: Math.min(120, Math.max(0, Number(p.age))),
          gender: p.gender,
          phone: clampStr(p.phone, 40) || 'N/A',
          email: clampStr(p.email, 160),
          address: clampStr(p.address, 240),
          medicalCondition: clampStr(p.medicalCondition, 200),
          dischargeDate: p.dischargeDate,
          attendingPhysician: clampStr(p.attendingPhysician, 120),
          ward: clampStr(p.ward, 120),
          status: p.status,
          emergencyContactName: clampStr(p.emergencyContactName, 120),
          emergencyContactPhone: clampStr(p.emergencyContactPhone, 40),
          careSummary: clampStr(p.careSummary, 1500),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await patientBatch.commit();

      // Chunk child records into batches of <=5 docs so rule parent lookups stay <=10 per batch
      const childOps: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];

      for (const m of demo.medicines) {
        const scopedId = sanitizeId(`${m.id}-${uidTag}`);
        const patientId = idMap.get(m.patientId) ?? m.patientId;
        childOps.push({
          ref: doc(db, 'medicines', scopedId),
          data: {
            id: scopedId,
            ownerId: uid,
            patientId,
            medicineName: clampStr(m.medicineName, 140),
            dosageInstructions: clampStr(m.dosageInstructions, 240),
            frequency: m.frequency,
            startDate: m.startDate,
            endDate: m.endDate,
            reminderTimings: m.reminderTimings.slice(0, 8),
            logs: m.logs.slice(0, 60),
            notes: clampStr(m.notes, 500),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      for (const a of demo.appointments) {
        const scopedId = sanitizeId(`${a.id}-${uidTag}`);
        const patientId = idMap.get(a.patientId) ?? a.patientId;
        childOps.push({
          ref: doc(db, 'appointments', scopedId),
          data: {
            id: scopedId,
            ownerId: uid,
            patientId,
            title: clampStr(a.title, 160),
            doctorName: clampStr(a.doctorName, 120),
            department: clampStr(a.department, 120),
            appointmentDate: a.appointmentDate,
            appointmentTime: a.appointmentTime,
            type: a.type,
            status: a.status,
            notes: clampStr(a.notes, 600),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
      }

      for (const f of demo.followups) {
        const scopedId = sanitizeId(`${f.id}-${uidTag}`);
        const patientId = idMap.get(f.patientId) ?? f.patientId;
        const payload: Record<string, unknown> = {
          id: scopedId,
          ownerId: uid,
          patientId,
          title: clampStr(f.title, 200),
          dueDate: f.dueDate,
          assignedStaff: clampStr(f.assignedStaff, 120),
          priority: f.priority,
          status: f.status,
          staffNotes: f.staffNotes.slice(0, 30),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (f.completedAt) payload.completedAt = clampStr(f.completedAt, 40);
        if (f.completedBy) payload.completedBy = clampStr(f.completedBy, 120);
        childOps.push({ ref: doc(db, 'followups', scopedId), data: payload });
      }

      for (const act of demo.activities) {
        const scopedId = sanitizeId(`${act.id}-${uidTag}`);
        childOps.push({
          ref: doc(db, 'activities', scopedId),
          data: {
            id: scopedId,
            ownerId: uid,
            timestamp: serverTimestamp(),
            actor: clampStr(actor, 120),
            action: clampStr(act.action, 100),
            entityType: act.entityType,
            entityName: clampStr(act.entityName, 200),
            details: clampStr(act.details, 500),
          },
        });
      }

      const CHUNK_SIZE = 5;
      for (let i = 0; i < childOps.length; i += CHUNK_SIZE) {
        const chunkBatch = writeBatch(db);
        for (const op of childOps.slice(i, i + CHUNK_SIZE)) {
          chunkBatch.set(op.ref, op.data);
        }
        await chunkBatch.commit();
      }

      localStorage.setItem(`medicare_seeded_${uid}`, '1');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'patients (seed batch)');
    }
  };

  // Real-time Firestore listeners (only when auth is ready and user is authenticated)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const uid = firebaseUser.uid;
    const seedKey = `medicare_seeded_${uid}`;
    let seedingInProgress = false;

    const patientsQuery = query(collection(db, 'patients'), where('ownerId', '==', uid));
    const medicinesQuery = query(collection(db, 'medicines'), where('ownerId', '==', uid));
    const appointmentsQuery = query(collection(db, 'appointments'), where('ownerId', '==', uid));
    const followupsQuery = query(collection(db, 'followups'), where('ownerId', '==', uid));
    const activitiesQuery = query(collection(db, 'activities'), where('ownerId', '==', uid));

    const unsubPatients = onSnapshot(
      patientsQuery,
      (snap) => {
        const list: Patient[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ''),
            age: Number(data.age ?? 0),
            gender: (data.gender as Patient['gender']) ?? 'Other',
            phone: String(data.phone ?? ''),
            email: String(data.email ?? ''),
            address: String(data.address ?? ''),
            medicalCondition: String(data.medicalCondition ?? ''),
            dischargeDate: String(data.dischargeDate ?? ''),
            attendingPhysician: String(data.attendingPhysician ?? ''),
            ward: String(data.ward ?? ''),
            status: (data.status as Patient['status']) ?? 'Active',
            emergencyContactName: String(data.emergencyContactName ?? ''),
            emergencyContactPhone: String(data.emergencyContactPhone ?? ''),
            careSummary: String(data.careSummary ?? ''),
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setPatients(list);

        if (snap.empty && !localStorage.getItem(seedKey) && !seedingInProgress) {
          seedingInProgress = true;
          seedDemoDataForUser(uid, firebaseUser.displayName || 'Clinical Staff').catch(
            (err) => {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Unable to seed initial demo records to Firestore.'
              );
            }
          );
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'patients');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const unsubMedicines = onSnapshot(
      medicinesQuery,
      (snap) => {
        const list: MedicineSchedule[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            patientId: String(data.patientId ?? ''),
            medicineName: String(data.medicineName ?? ''),
            dosageInstructions: String(data.dosageInstructions ?? ''),
            frequency: (data.frequency as MedicineSchedule['frequency']) ?? 'Once Daily',
            startDate: String(data.startDate ?? ''),
            endDate: String(data.endDate ?? ''),
            reminderTimings: Array.isArray(data.reminderTimings)
              ? data.reminderTimings.map(String)
              : [],
            logs: Array.isArray(data.logs) ? (data.logs as MedicineDoseLog[]) : [],
            notes: data.notes ? String(data.notes) : '',
            createdAt: toIsoString(data.createdAt),
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setMedicines(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'medicines');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const unsubAppointments = onSnapshot(
      appointmentsQuery,
      (snap) => {
        const list: Appointment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            patientId: String(data.patientId ?? ''),
            title: String(data.title ?? ''),
            doctorName: String(data.doctorName ?? ''),
            department: String(data.department ?? ''),
            appointmentDate: String(data.appointmentDate ?? ''),
            appointmentTime: String(data.appointmentTime ?? ''),
            type: (data.type as Appointment['type']) ?? 'In-Person',
            status: (data.status as Appointment['status']) ?? 'Upcoming',
            notes: data.notes ? String(data.notes) : '',
            createdAt: toIsoString(data.createdAt),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setAppointments(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'appointments');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const unsubFollowups = onSnapshot(
      followupsQuery,
      (snap) => {
        const list: Followup[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            patientId: String(data.patientId ?? ''),
            title: String(data.title ?? ''),
            dueDate: String(data.dueDate ?? ''),
            assignedStaff: String(data.assignedStaff ?? ''),
            priority: (data.priority as Followup['priority']) ?? 'Medium',
            status: (data.status as Followup['status']) ?? 'Pending',
            staffNotes: Array.isArray(data.staffNotes) ? data.staffNotes : [],
            completedAt: data.completedAt ? String(data.completedAt) : undefined,
            completedBy: data.completedBy ? String(data.completedBy) : undefined,
            createdAt: toIsoString(data.createdAt),
          };
        });
        setFollowups(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'followups');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const unsubActivities = onSnapshot(
      activitiesQuery,
      (snap) => {
        const list: ActivityLog[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            timestamp: toIsoString(data.timestamp),
            actor: String(data.actor ?? ''),
            action: String(data.action ?? ''),
            entityType: (data.entityType as ActivityLog['entityType']) ?? 'system',
            entityName: String(data.entityName ?? ''),
            details: String(data.details ?? ''),
          };
        });
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setActivities(list.slice(0, 40));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'activities');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      unsubPatients();
      unsubMedicines();
      unsubAppointments();
      unsubFollowups();
      unsubActivities();
    };
  }, [authReady, firebaseUser]);

  const actorName = currentUser?.name ?? firebaseUser?.displayName ?? 'Clinical Staff';

  const logActivity = async (
    entry: Omit<ActivityLog, 'id' | 'timestamp' | 'actor'>
  ) => {
    if (!firebaseUser) return;
    const id = generateId('ACT');
    try {
      await setDoc(doc(db, 'activities', id), {
        id,
        ownerId: firebaseUser.uid,
        timestamp: serverTimestamp(),
        actor: clampStr(actorName, 120),
        action: clampStr(entry.action, 100),
        entityType: entry.entityType,
        entityName: clampStr(entry.entityName, 200),
        details: clampStr(entry.details, 500),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `activities/${id}`);
    }
  };

  // Auth handlers
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.';
      return { ok: false, error: message };
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Patients CRUD
  const addPatient = async (
    input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Patient> => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const id = generateId('PAT');
    const now = new Date().toISOString();
    const payload = {
      id,
      ownerId: firebaseUser.uid,
      name: clampStr(input.name, 120),
      age: Math.min(120, Math.max(0, Math.round(Number(input.age)))),
      gender: input.gender,
      phone: clampStr(input.phone, 40) || 'N/A',
      email: clampStr(input.email, 160),
      address: clampStr(input.address, 240),
      medicalCondition: clampStr(input.medicalCondition, 200),
      dischargeDate: input.dischargeDate,
      attendingPhysician: clampStr(input.attendingPhysician, 120),
      ward: clampStr(input.ward, 120),
      status: input.status,
      emergencyContactName: clampStr(input.emergencyContactName, 120),
      emergencyContactPhone: clampStr(input.emergencyContactPhone, 40),
      careSummary: clampStr(input.careSummary, 1500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'patients', id), payload);
      await logActivity({
        action: 'Added Patient',
        entityType: 'patient',
        entityName: `${payload.name} (${id})`,
        details: `Discharged ${payload.dischargeDate} · ${payload.medicalCondition}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `patients/${id}`);
    }

    return { ...input, id, createdAt: now, updatedAt: now };
  };

  const updatePatient = async (
    id: string,
    updates: Partial<Omit<Patient, 'id' | 'createdAt'>>
  ) => {
    if (!firebaseUser) return;
    const target = patients.find((p) => p.id === id);
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.name !== undefined) updatePayload.name = clampStr(updates.name, 120);
    if (updates.age !== undefined)
      updatePayload.age = Math.min(120, Math.max(0, Math.round(Number(updates.age))));
    if (updates.gender !== undefined) updatePayload.gender = updates.gender;
    if (updates.phone !== undefined) updatePayload.phone = clampStr(updates.phone, 40);
    if (updates.email !== undefined) updatePayload.email = clampStr(updates.email, 160);
    if (updates.address !== undefined) updatePayload.address = clampStr(updates.address, 240);
    if (updates.medicalCondition !== undefined)
      updatePayload.medicalCondition = clampStr(updates.medicalCondition, 200);
    if (updates.dischargeDate !== undefined)
      updatePayload.dischargeDate = updates.dischargeDate;
    if (updates.attendingPhysician !== undefined)
      updatePayload.attendingPhysician = clampStr(updates.attendingPhysician, 120);
    if (updates.ward !== undefined) updatePayload.ward = clampStr(updates.ward, 120);
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.emergencyContactName !== undefined)
      updatePayload.emergencyContactName = clampStr(updates.emergencyContactName, 120);
    if (updates.emergencyContactPhone !== undefined)
      updatePayload.emergencyContactPhone = clampStr(updates.emergencyContactPhone, 40);
    if (updates.careSummary !== undefined)
      updatePayload.careSummary = clampStr(updates.careSummary, 1500);

    try {
      await updateDoc(doc(db, 'patients', id), updatePayload);
      await logActivity({
        action: 'Updated Patient',
        entityType: 'patient',
        entityName: `${updates.name ?? target?.name ?? id} (${id})`,
        details: updates.status
          ? `Status set to ${updates.status}.`
          : 'Updated clinical and contact details.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `patients/${id}`);
    }
  };

  const deletePatient = async (id: string) => {
    if (!firebaseUser) return;
    const target = patients.find((p) => p.id === id);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'patients', id));
    medicines
      .filter((m) => m.patientId === id)
      .forEach((m) => batch.delete(doc(db, 'medicines', m.id)));
    appointments
      .filter((a) => a.patientId === id)
      .forEach((a) => batch.delete(doc(db, 'appointments', a.id)));
    followups
      .filter((f) => f.patientId === id)
      .forEach((f) => batch.delete(doc(db, 'followups', f.id)));

    try {
      await batch.commit();
      await logActivity({
        action: 'Deleted Patient',
        entityType: 'patient',
        entityName: `${target?.name ?? id} (${id})`,
        details: 'Removed patient record and linked schedules.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `patients/${id}`);
    }
  };

  // Medicines CRUD & Dose tracking
  const addMedicine = async (
    input: Omit<MedicineSchedule, 'id' | 'logs' | 'createdAt'>
  ): Promise<MedicineSchedule> => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const id = generateId('MED');
    const today = getTodayISO();
    const logDate = input.startDate > today ? input.startDate : today;
    const timings = input.reminderTimings.slice(0, 8);
    const initialLogs: MedicineDoseLog[] = timings.map((time) => ({
      id: generateId('LOG'),
      date: logDate,
      time,
      status: 'Pending',
    }));

    const payload = {
      id,
      ownerId: firebaseUser.uid,
      patientId: input.patientId,
      medicineName: clampStr(input.medicineName, 140),
      dosageInstructions: clampStr(input.dosageInstructions, 240),
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      reminderTimings: timings,
      logs: initialLogs,
      notes: clampStr(input.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'medicines', id), payload);
      const patient = patients.find((p) => p.id === input.patientId);
      await logActivity({
        action: 'Added Medicine Schedule',
        entityType: 'medicine',
        entityName: `${payload.medicineName} · ${patient?.name ?? input.patientId}`,
        details: `${payload.frequency} (${timings.join(', ')}).`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `medicines/${id}`);
    }

    return { ...input, id, logs: initialLogs, createdAt: new Date().toISOString() };
  };

  const updateMedicine = async (
    id: string,
    updates: Partial<Omit<MedicineSchedule, 'id' | 'createdAt'>>
  ) => {
    if (!firebaseUser) return;
    const target = medicines.find((m) => m.id === id);
    const updatePayload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.medicineName !== undefined)
      updatePayload.medicineName = clampStr(updates.medicineName, 140);
    if (updates.dosageInstructions !== undefined)
      updatePayload.dosageInstructions = clampStr(updates.dosageInstructions, 240);
    if (updates.frequency !== undefined) updatePayload.frequency = updates.frequency;
    if (updates.startDate !== undefined) updatePayload.startDate = updates.startDate;
    if (updates.endDate !== undefined) updatePayload.endDate = updates.endDate;
    if (updates.reminderTimings !== undefined)
      updatePayload.reminderTimings = updates.reminderTimings.slice(0, 8);
    if (updates.notes !== undefined) updatePayload.notes = clampStr(updates.notes, 500);

    try {
      await updateDoc(doc(db, 'medicines', id), updatePayload);
      const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
      await logActivity({
        action: 'Updated Medicine',
        entityType: 'medicine',
        entityName: `${updates.medicineName ?? target?.medicineName ?? id} · ${
          patient?.name ?? target?.patientId ?? ''
        }`,
        details: 'Updated dosage schedule or reminder timings.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `medicines/${id}`);
    }
  };

  const deleteMedicine = async (id: string) => {
    if (!firebaseUser) return;
    const target = medicines.find((m) => m.id === id);
    const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
    try {
      await deleteDoc(doc(db, 'medicines', id));
      await logActivity({
        action: 'Removed Medicine',
        entityType: 'medicine',
        entityName: `${target?.medicineName ?? id} · ${patient?.name ?? ''}`,
        details: 'Deleted medicine reminder schedule.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `medicines/${id}`);
    }
  };

  const recordDoseStatus = async (
    medicineId: string,
    logId: string,
    status: DoseStatus
  ) => {
    if (!firebaseUser) return;
    const targetMed = medicines.find((m) => m.id === medicineId);
    if (!targetMed) return;
    const now = new Date().toISOString();
    let recordedTime = '';
    const updatedLogs = targetMed.logs
      .map((log) => {
        if (log.id !== logId) return log;
        recordedTime = log.time;
        return {
          ...log,
          status,
          recordedAt: now,
          recordedBy: actorName,
        };
      })
      .slice(-60);

    try {
      await updateDoc(doc(db, 'medicines', medicineId), {
        logs: updatedLogs,
        updatedAt: serverTimestamp(),
      });
      const patient = patients.find((p) => p.id === targetMed.patientId);
      await logActivity({
        action: `Dose ${status}`,
        entityType: 'medicine',
        entityName: `${targetMed.medicineName} · ${patient?.name ?? targetMed.patientId}`,
        details: `Scheduled ${recordedTime} slot marked ${status}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `medicines/${medicineId}`);
    }
  };

  const addTodayDoseLogsIfMissing = async (medicineId: string) => {
    if (!firebaseUser) return;
    const targetMed = medicines.find((m) => m.id === medicineId);
    if (!targetMed) return;
    const today = getTodayISO();
    const existingTimes = new Set(
      targetMed.logs.filter((l) => l.date === today).map((l) => l.time)
    );
    const newLogs = targetMed.reminderTimings
      .filter((t) => !existingTimes.has(t))
      .map((t) => ({
        id: generateId('LOG'),
        date: today,
        time: t,
        status: 'Pending' as DoseStatus,
      }));
    if (newLogs.length === 0) return;

    const updatedLogs = [...targetMed.logs, ...newLogs].slice(-60);
    try {
      await updateDoc(doc(db, 'medicines', medicineId), {
        logs: updatedLogs,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `medicines/${medicineId}`);
    }
  };

  // Appointments CRUD
  const addAppointment = async (
    input: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Appointment> => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const id = generateId('APT');
    const now = new Date().toISOString();
    const payload = {
      id,
      ownerId: firebaseUser.uid,
      patientId: input.patientId,
      title: clampStr(input.title, 160),
      doctorName: clampStr(input.doctorName, 120),
      department: clampStr(input.department, 120) || 'Outpatient Clinic',
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      type: input.type,
      status: input.status,
      notes: clampStr(input.notes, 600),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'appointments', id), payload);
      const patient = patients.find((p) => p.id === input.patientId);
      await logActivity({
        action: 'Scheduled Appointment',
        entityType: 'appointment',
        entityName: `${payload.title} · ${patient?.name ?? input.patientId}`,
        details: `${payload.appointmentDate} at ${payload.appointmentTime} with ${payload.doctorName}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `appointments/${id}`);
    }

    return { ...input, id, createdAt: now, updatedAt: now };
  };

  const updateAppointment = async (
    id: string,
    updates: Partial<Omit<Appointment, 'id' | 'createdAt'>>
  ) => {
    if (!firebaseUser) return;
    const target = appointments.find((a) => a.id === id);
    const updatePayload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) updatePayload.title = clampStr(updates.title, 160);
    if (updates.doctorName !== undefined)
      updatePayload.doctorName = clampStr(updates.doctorName, 120);
    if (updates.department !== undefined)
      updatePayload.department = clampStr(updates.department, 120) || 'Outpatient Clinic';
    if (updates.appointmentDate !== undefined)
      updatePayload.appointmentDate = updates.appointmentDate;
    if (updates.appointmentTime !== undefined)
      updatePayload.appointmentTime = updates.appointmentTime;
    if (updates.type !== undefined) updatePayload.type = updates.type;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.notes !== undefined) updatePayload.notes = clampStr(updates.notes, 600);

    try {
      await updateDoc(doc(db, 'appointments', id), updatePayload);
      const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
      await logActivity({
        action: 'Updated Appointment',
        entityType: 'appointment',
        entityName: `${updates.title ?? target?.title ?? id} · ${
          patient?.name ?? target?.patientId ?? ''
        }`,
        details: `Updated to ${updates.appointmentDate ?? target?.appointmentDate ?? ''} (${
          updates.status ?? target?.status ?? ''
        }).`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    if (!firebaseUser) return;
    const target = appointments.find((a) => a.id === id);
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        updatedAt: serverTimestamp(),
      });
      const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
      await logActivity({
        action: `Appointment ${status}`,
        entityType: 'appointment',
        entityName: `${target?.title ?? id} · ${patient?.name ?? ''}`,
        details: `Appointment status changed from ${target?.status ?? ''} to ${status}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!firebaseUser) return;
    const target = appointments.find((a) => a.id === id);
    const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      await logActivity({
        action: 'Deleted Appointment',
        entityType: 'appointment',
        entityName: `${target?.title ?? id} · ${patient?.name ?? ''}`,
        details: 'Removed appointment record.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${id}`);
    }
  };

  // Follow-ups CRUD
  const addFollowup = async (
    input: Omit<Followup, 'id' | 'staffNotes' | 'createdAt' | 'status'>
  ): Promise<Followup> => {
    if (!firebaseUser) throw new Error('Not authenticated');
    const id = generateId('FUP');
    const now = new Date().toISOString();
    const payload = {
      id,
      ownerId: firebaseUser.uid,
      patientId: input.patientId,
      title: clampStr(input.title, 200),
      dueDate: input.dueDate,
      assignedStaff: clampStr(input.assignedStaff, 120),
      priority: input.priority,
      status: 'Pending' as const,
      staffNotes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'followups', id), payload);
      const patient = patients.find((p) => p.id === input.patientId);
      await logActivity({
        action: 'Created Follow-up',
        entityType: 'followup',
        entityName: `${patient?.name ?? input.patientId}`,
        details: `${payload.title} (Due ${payload.dueDate}).`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `followups/${id}`);
    }

    return {
      ...input,
      id,
      status: 'Pending',
      staffNotes: [],
      createdAt: now,
    };
  };

  const markFollowupCompleted = async (id: string, completionNote?: string) => {
    if (!firebaseUser) return;
    const target = followups.find((f) => f.id === id);
    if (!target) return;
    const today = getTodayISO();
    const extraNote =
      completionNote && completionNote.trim()
        ? [
            {
              id: generateId('NOTE'),
              author: clampStr(actorName, 120),
              role: currentUser?.role ?? 'Staff',
              note: clampStr(completionNote, 500),
              createdAt: today,
            },
          ]
        : [];
    const updatedNotes = [...target.staffNotes, ...extraNote].slice(-30);

    try {
      await updateDoc(doc(db, 'followups', id), {
        status: 'Completed',
        completedAt: today,
        completedBy: clampStr(actorName, 120),
        staffNotes: updatedNotes,
        updatedAt: serverTimestamp(),
      });
      const patient = patients.find((p) => p.id === target.patientId);
      await logActivity({
        action: 'Completed Follow-up',
        entityType: 'followup',
        entityName: `${target.title} · ${patient?.name ?? target.patientId}`,
        details: completionNote?.trim() || `Marked completed on ${today}.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `followups/${id}`);
    }
  };

  const reopenFollowup = async (id: string) => {
    if (!firebaseUser) return;
    const target = followups.find((f) => f.id === id);
    try {
      await updateDoc(doc(db, 'followups', id), {
        status: 'Pending',
        completedAt: deleteField(),
        completedBy: deleteField(),
        updatedAt: serverTimestamp(),
      });
      const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
      await logActivity({
        action: 'Reopened Follow-up',
        entityType: 'followup',
        entityName: `${target?.title ?? id} · ${patient?.name ?? ''}`,
        details: 'Returned follow-up task to Pending queue.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `followups/${id}`);
    }
  };

  const addFollowupNote = async (followupId: string, note: string) => {
    if (!firebaseUser) return;
    const trimmed = clampStr(note, 500);
    if (!trimmed) return;
    const target = followups.find((f) => f.id === followupId);
    if (!target) return;
    const today = getTodayISO();
    const updatedNotes = [
      ...target.staffNotes,
      {
        id: generateId('NOTE'),
        author: clampStr(actorName, 120),
        role: currentUser?.role ?? 'Staff',
        note: trimmed,
        createdAt: today,
      },
    ].slice(-30);

    try {
      await updateDoc(doc(db, 'followups', followupId), {
        staffNotes: updatedNotes,
        updatedAt: serverTimestamp(),
      });
      const patient = patients.find((p) => p.id === target.patientId);
      await logActivity({
        action: 'Added Staff Note',
        entityType: 'followup',
        entityName: `${patient?.name ?? target.patientId}`,
        details: trimmed,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `followups/${followupId}`);
    }
  };

  const deleteFollowup = async (id: string) => {
    if (!firebaseUser) return;
    const target = followups.find((f) => f.id === id);
    const patient = target ? patients.find((p) => p.id === target.patientId) : undefined;
    try {
      await deleteDoc(doc(db, 'followups', id));
      await logActivity({
        action: 'Deleted Follow-up',
        entityType: 'followup',
        entityName: `${target?.title ?? id} · ${patient?.name ?? ''}`,
        details: 'Removed follow-up task.',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `followups/${id}`);
    }
  };

  const resetDemoDatabase = async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      const collections = ['activities', 'followups', 'appointments', 'medicines', 'patients'];
      const deleteBatch = writeBatch(db);
      for (const colName of collections) {
        const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', uid)));
        snap.docs.forEach((d) => deleteBatch.delete(d.ref));
      }
      await deleteBatch.commit();
      await seedDemoDataForUser(uid, actorName);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resetDemoDatabase');
    }
  };

  const attentionFlags = useMemo(
    () =>
      evaluateAttentionFlags(
        patients,
        medicines,
        appointments,
        followups,
        getTodayISO()
      ),
    [patients, medicines, appointments, followups]
  );

  const value: HealthcareContextValue = {
    isLoading,
    authReady,
    connectionStatus,
    error,
    clearError: () => setError(null),
    currentUser,
    patients,
    medicines,
    appointments,
    followups,
    activities,
    attentionFlags,
    signInWithGoogle,
    logout,
    addPatient,
    updatePatient,
    deletePatient,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    recordDoseStatus,
    addTodayDoseLogsIfMissing,
    addAppointment,
    updateAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    addFollowup,
    markFollowupCompleted,
    reopenFollowup,
    addFollowupNote,
    deleteFollowup,
    resetDemoDatabase,
  };

  return (
    <HealthcareContext.Provider value={value}>{children}</HealthcareContext.Provider>
  );
};

export function useHealthcare() {
  const ctx = useContext(HealthcareContext);
  if (!ctx) {
    throw new Error('useHealthcare must be used within a HealthcareProvider');
  }
  return ctx;
}
