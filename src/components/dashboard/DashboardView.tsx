import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Pill,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useHealthcare } from '../../store/HealthcareContext';
import { ActiveRoute } from '../../types/healthcare';
import {
  addDaysISO,
  formatShortDate,
  formatTimestamp,
  getTodayISO,
  getWeekdayLabel,
  isFollowupOverdue,
} from '../../utils/dateUtils';
import { StatusLabel } from '../common/StatusLabel';

interface DashboardViewProps {
  onNavigate: (route: ActiveRoute) => void;
  onSelectPatient: (patientId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#0D9488',
  Monitoring: '#D97706',
  Recovered: '#16A34A',
  Discharged: '#64748B',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectPatient,
}) => {
  const { patients, medicines, appointments, followups, activities, attentionFlags } =
    useHealthcare();

  const today = getTodayISO();

  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const activePatients = patients.filter(
      (p) => p.status === 'Active' || p.status === 'Monitoring'
    ).length;
    const upcomingAppointments = appointments.filter(
      (a) => a.status === 'Upcoming' && a.appointmentDate >= today
    ).length;
    const pendingFollowups = followups.filter((f) => f.status === 'Pending').length;
    const overdueFollowups = followups.filter((f) =>
      isFollowupOverdue(f.dueDate, f.status, today)
    ).length;
    const activeMedicineSchedules = medicines.filter((m) => m.endDate >= today).length;

    return {
      totalPatients,
      activePatients,
      upcomingAppointments,
      pendingFollowups,
      overdueFollowups,
      activeMedicineSchedules,
    };
  }, [patients, appointments, followups, medicines, today]);

  // Weekly Appointment Analytics (rolling 7-day window: -3 days to +3 days around today)
  const weeklyAppointmentData = useMemo(() => {
    const days: {
      date: string;
      day: string;
      Upcoming: number;
      Completed: number;
      Missed: number;
    }[] = [];

    for (let offset = -3; offset <= 3; offset++) {
      const dateISO = addDaysISO(today, offset);
      const dayApts = appointments.filter((a) => a.appointmentDate === dateISO);
      days.push({
        date: dateISO,
        day: offset === 0 ? 'Today' : getWeekdayLabel(dateISO),
        Upcoming: dayApts.filter((a) => a.status === 'Upcoming').length,
        Completed: dayApts.filter((a) => a.status === 'Completed').length,
        Missed: dayApts.filter((a) => a.status === 'Missed').length,
      });
    }
    return days;
  }, [appointments, today]);

  // Patient Status Distribution
  const statusDistributionData = useMemo(() => {
    const counts: Record<string, number> = {
      Active: 0,
      Monitoring: 0,
      Recovered: 0,
      Discharged: 0,
    };
    for (const p of patients) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || '#64748B',
    }));
  }, [patients]);

  const topAttentionFlags = attentionFlags.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* KPI Metrics Row */}
      <section aria-label="Key care coordination metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('patients')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Patients</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totalPatients}
          </p>
          <p className="mt-1 text-xs text-slate-500">Registered post-discharge</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('patients')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Care Patients</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.activePatients}
          </p>
          <p className="mt-1 text-xs text-teal-700 font-medium">Active & Monitoring</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('appointments')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Upcoming Visits</span>
            <CalendarClock className="w-4 h-4 text-[#0F2544]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.upcomingAppointments}
          </p>
          <p className="mt-1 text-xs text-slate-500">Scheduled from today</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('followups')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Pending Follow-ups</span>
            <ClipboardList className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.pendingFollowups}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            <span className={stats.overdueFollowups > 0 ? 'text-red-700 font-semibold' : ''}>
              {stats.overdueFollowups} overdue
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('medicines')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Medicine Schedules</span>
            <Pill className="w-4 h-4 text-teal-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.activeMedicineSchedules}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active reminder plans</p>
        </button>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Appointment Analytics */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Weekly Appointment Analytics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                7-day clinical visit schedule around {formatShortDate(today)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F2544]" />
                Upcoming
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" />
                Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                Missed
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyAppointmentData}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Completed" stackId="a" fill="#0D9488" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Upcoming" stackId="a" fill="#0F2544" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Missed" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Patient Status Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Patient Status Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live breakdown across {patients.length} patients
            </p>
          </div>

          <div className="h-48 w-full mt-2">
            {patients.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No patient records available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {statusDistributionData
                      .filter((d) => d.value > 0)
                      .map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-auto pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            {statusDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Row: AI Attention Priority Queue + Recent Activities */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Attention Summary */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#0F2544]" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Patients Requiring Attention
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('attention')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Open AI Attention Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {topAttentionFlags.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                All discharged patients are currently on schedule with zero overdue items.
              </div>
            ) : (
              topAttentionFlags.map((flag) => (
                <div
                  key={flag.patient.id}
                  className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPatient(flag.patient.id)}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-700 text-left"
                      >
                        {flag.patient.name}
                      </button>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {flag.patient.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{flag.reasons[0]}</p>
                  </div>
                  <StatusLabel status={flag.priority} className="shrink-0 mt-0.5" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Staff Activities
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {activities.length} logged events
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {activities.slice(0, 6).map((act) => (
              <div key={act.id} className="px-6 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-900">
                    {act.action} <span className="text-slate-400 font-normal">·</span>{' '}
                    <span className="font-medium text-teal-700">{act.entityName}</span>
                  </p>
                  <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                    {formatTimestamp(act.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{act.details}</p>
                <p className="text-[11px] text-slate-400 mt-1">Recorded by {act.actor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
