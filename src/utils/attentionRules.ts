import {
  Appointment,
  AttentionFlag,
  Followup,
  MedicineSchedule,
  Patient,
} from '../types/healthcare';
import { diffDaysISO, getTodayISO, isFollowupOverdue } from './dateUtils';

/**
 * Transparent rule-based operational monitoring engine.
 * Evaluates administrative follow-up adherence, appointment attendance,
 * and scheduled medication reminders.
 * Does NOT perform medical diagnosis or treatment recommendations.
 */
export function evaluateAttentionFlags(
  patients: Patient[],
  medicines: MedicineSchedule[],
  appointments: Appointment[],
  followups: Followup[],
  todayISO: string = getTodayISO()
): AttentionFlag[] {
  const flags: AttentionFlag[] = [];

  for (const patient of patients) {
    // Patients who are already fully Recovered or Discharged with no open issues are still checked
    // for overdue items so nothing slips through, while healthy Discharged patients without open triggers aren't flagged.
    const patientFollowups = followups.filter((f) => f.patientId === patient.id);
    const patientAppointments = appointments.filter((a) => a.patientId === patient.id);
    const patientMedicines = medicines.filter(
      (m) => m.patientId === patient.id && m.startDate <= todayISO && m.endDate >= todayISO
    );

    const overdueFollowups = patientFollowups.filter((f) =>
      isFollowupOverdue(f.dueDate, f.status, todayISO)
    );
    const pendingFollowups = patientFollowups.filter(
      (f) => f.status === 'Pending' && f.dueDate >= todayISO
    );
    const missedAppointments = patientAppointments.filter((a) => a.status === 'Missed');

    const allLogs = patientMedicines.flatMap((m) =>
      m.logs.map((log) => ({ ...log, medicineName: m.medicineName }))
    );
    const missedDoses = allLogs.filter((l) => l.status === 'Missed');
    const pendingTodayDoses = allLogs.filter(
      (l) => l.date === todayISO && l.status === 'Pending'
    );

    const daysSinceDischarge = Math.max(0, diffDaysISO(patient.dischargeDate, todayISO));

    let score = 0;
    const reasons: string[] = [];

    // Rule 1: Overdue Follow-ups
    if (overdueFollowups.length > 0) {
      const oldestDaysOverdue = Math.max(
        ...overdueFollowups.map((f) => Math.max(1, diffDaysISO(f.dueDate, todayISO)))
      );
      score += 35 + Math.min(20, (overdueFollowups.length - 1) * 15) + (oldestDaysOverdue >= 3 ? 10 : 0);
      reasons.push(
        `${overdueFollowups.length} overdue follow-up ${
          overdueFollowups.length === 1 ? 'task' : 'tasks'
        } (oldest ${oldestDaysOverdue} ${oldestDaysOverdue === 1 ? 'day' : 'days'} past due)`
      );
    }

    // Rule 2: Missed Appointments
    if (missedAppointments.length > 0) {
      score += 35 + Math.min(20, (missedAppointments.length - 1) * 15);
      reasons.push(
        `${missedAppointments.length} missed ${
          missedAppointments.length === 1 ? 'appointment' : 'appointments'
        } requiring rescheduling`
      );
    }

    // Rule 3: Missed Medication Reminders
    if (missedDoses.length > 0) {
      const medNames = Array.from(new Set(missedDoses.map((d) => d.medicineName))).slice(0, 2);
      score += 20 + Math.min(20, (missedDoses.length - 1) * 10);
      reasons.push(
        `${missedDoses.length} missed medicine ${
          missedDoses.length === 1 ? 'dose' : 'doses'
        } (${medNames.join(', ')})`
      );
    }

    // Rule 4: Pending Medication Reminders Today
    if (pendingTodayDoses.length > 0) {
      score += 12;
      reasons.push(
        `${pendingTodayDoses.length} pending medicine ${
          pendingTodayDoses.length === 1 ? 'reminder' : 'reminders'
        } scheduled for today`
      );
    }

    // Rule 5: Early Post-Discharge Monitoring Window (0–7 days) with open tasks
    if (
      patient.status === 'Monitoring' &&
      daysSinceDischarge <= 7 &&
      (pendingFollowups.length > 0 || pendingTodayDoses.length > 0)
    ) {
      score += 15;
      reasons.push(
        `Active post-discharge monitoring window (${daysSinceDischarge} ${
          daysSinceDischarge === 1 ? 'day' : 'days'
        } since discharge)`
      );
    } else if (patient.status === 'Monitoring' && reasons.length === 0) {
      score += 10;
      reasons.push('Patient is currently in Monitoring status without recent completed check-in');
    }

    if (reasons.length === 0) {
      continue;
    }

    let priority: 'High' | 'Medium' | 'Low' = 'Low';
    if (
      score >= 50 ||
      (overdueFollowups.length > 0 && missedAppointments.length > 0) ||
      missedDoses.length >= 2 ||
      overdueFollowups.some((f) => diffDaysISO(f.dueDate, todayISO) >= 3)
    ) {
      priority = 'High';
    } else if (score >= 25 || overdueFollowups.length > 0 || missedAppointments.length > 0 || missedDoses.length > 0) {
      priority = 'Medium';
    }

    flags.push({
      patient,
      priority,
      score,
      reasons,
      overdueFollowupCount: overdueFollowups.length,
      missedAppointmentCount: missedAppointments.length,
      missedDoseCount: missedDoses.length,
      pendingTodayDoseCount: pendingTodayDoses.length,
      daysSinceDischarge,
    });
  }

  const priorityRank = { High: 3, Medium: 2, Low: 1 };
  return flags.sort((a, b) => {
    if (priorityRank[b.priority] !== priorityRank[a.priority]) {
      return priorityRank[b.priority] - priorityRank[a.priority];
    }
    return b.score - a.score;
  });
}
