# MediCare AI Firestore Security Specification

## 1. Data Invariants
1. **Authenticated & Email-Verified Access**: Unauthenticated or unverified users cannot read or write any collection.
2. **Ownership & Relational Integrity**: Every clinical record (`patients`, `medicines`, `appointments`, `followups`, `activities`) carries an immutable `ownerId` equal to `request.auth.uid` on creation.
3. **Referential Parent Existence**: Every `medicines`, `appointments`, and `followups` document must reference an existing `patients/{patientId}` document (via `existsAfter`/`getAfter` to support atomic batch seeding) owned by the same staff user.
4. **Anti-Privilege-Escalation on Staff Profiles**: Users creating `/users/{userId}` cannot self-assign `role == 'Admin'` unless they are the bootstrapped admin. Users cannot change their `role` or `uid` on update.
5. **Strict Schema & Boundary Enforcement**: Every document validates required/allowed keys (`hasAll` + `hasOnly`), string `.size()` limits, bounded array `.size()` limits, regex IDs (`^[a-zA-Z0-9_\\-]+$`), and server-enforced `request.time` timestamps.
6. **Terminal State Protection**: Completed or Cancelled appointments cannot be arbitrarily mutated back by non-admins without an explicit valid status transition; completed follow-ups require reopening by the owner or admin.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Patient Read**: Anonymous/null auth attempting `get /patients/PAT-1042` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: User with `email: "singhanshika5005@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role**: Normal user creating `/users/{uid}` with `role: "Admin"` -> `PERMISSION_DENIED`.
4. **Shadow/Ghost Field Injection**: Creating a patient with extra key `isAdminOverride: true` -> `PERMISSION_DENIED`.
5. **Cross-Tenant Identity Spoofing**: User A creating a patient with `ownerId: "user_B"` -> `PERMISSION_DENIED`.
6. **Orphaned Medicine Schedule**: Creating `/medicines/MED-999` referencing non-existent `patientId: "PAT-MISSING"` -> `PERMISSION_DENIED`.
7. **Cross-Owner Child Record**: User A creating `/appointments/APT-999` referencing User B's `patientId` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Creating `/patients/bad$id..slash` with invalid ID characters -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (Oversized String)**: Patient `careSummary` > 1500 chars or `medicineName` > 140 chars -> `PERMISSION_DENIED`.
10. **Unbounded Array Injection**: Medicine `reminderTimings` with > 8 entries or `logs` > 60 entries -> `PERMISSION_DENIED`.
11. **Client Timestamp Forgery**: Creating a patient with forged past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: Calling `list /patients` without filtering by `ownerId == request.auth.uid` as a non-admin -> `PERMISSION_DENIED`.
