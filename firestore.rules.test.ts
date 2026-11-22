/**
 * Phase 0 Adversarial Security Verification Spec for MediCare AI Firestore Rules.
 * Verifies the "Dirty Dozen" payloads against the security invariants documented in security_spec.md.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated patient read',
    collection: 'patients',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payload: { auth: null, path: 'patients/PAT-1042' },
  },
  {
    id: 2,
    name: 'Unverified email admin spoof',
    collection: 'patients',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { auth: { uid: 'spoof', email: 'singhanshika5005@gmail.com', email_verified: false } },
  },
  {
    id: 3,
    name: 'Self-assigned Admin role on user creation',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'user_1', name: 'Mallory', email: 'm@clinic.org', role: 'Admin', department: 'IT' },
  },
  {
    id: 4,
    name: 'Shadow ghost field injection on patient create',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'PAT-9001', ownerId: 'user_1', isAdminOverride: true },
  },
  {
    id: 5,
    name: 'Cross-tenant ownerId spoofing',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'PAT-9002', ownerId: 'user_2', name: 'Victim Patient' },
  },
  {
    id: 6,
    name: 'Orphaned medicine schedule referencing missing patient',
    collection: 'medicines',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'MED-999', ownerId: 'user_1', patientId: 'PAT-NONEXISTENT', medicineName: 'Aspirin' },
  },
  {
    id: 7,
    name: 'Cross-owner appointment attachment',
    collection: 'appointments',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'APT-999', ownerId: 'user_1', patientId: 'PAT-BELONGS-TO-USER-2' },
  },
  {
    id: 8,
    name: 'Invalid document ID poisoning',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { docId: 'bad$id!@#', name: 'Test' },
  },
  {
    id: 9,
    name: 'Oversized string payload (careSummary > 1500 chars)',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'PAT-9003', ownerId: 'user_1', careSummary: 'A'.repeat(2000) },
  },
  {
    id: 10,
    name: 'Unbounded array injection on reminderTimings',
    collection: 'medicines',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { reminderTimings: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'] },
  },
  {
    id: 11,
    name: 'Client-forged createdAt timestamp',
    collection: 'patients',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 12,
    name: 'Blanket list query without ownerId filter',
    collection: 'patients',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payload: { query: 'collection(db, "patients")' },
  },
];
