import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  History,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import api, { type AdminSessionLogs, type AdminUser, type ServiceTaskRecord, type SessionRecord } from '@/services/api';
import { subscribeAdminRealtime } from '@/services/realtime';

interface SessionsPageProps {
  admin: AdminUser;
  branchId: string | null;
  realtimeBranchIds: string[];
}

const statusTabs = ['active', 'all', 'pending_payment', 'ready_to_wash', 'in_progress', 'completed', 'cancelled'] as const;
const activeStatuses = ['pending_payment', 'ready_to_wash', 'in_progress'] as const;

function getSessionStatusLabel(status: (typeof statusTabs)[number] | SessionRecord['status']) {
  switch (status) {
    case 'active':
      return 'คิวหน้าร้าน';
    case 'all':
      return 'ทั้งหมด';
    case 'pending_payment':
      return 'รอชำระเงิน';
    case 'ready_to_wash':
      return 'พร้อมเริ่มงาน';
    case 'in_progress':
      return 'กำลังบริการ';
    case 'completed':
      return 'เสร็จสิ้น';
    case 'cancelled':
      return 'ยกเลิก';
    default:
      return String(status).replace(/_/g, ' ');
  }
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) return 'ไม่มีข้อมูล';

  switch (status) {
    case 'pending':
      return 'รอดำเนินการ';
    case 'confirmed':
      return 'ยืนยันแล้ว';
    case 'failed':
      return 'ไม่สำเร็จ';
    case 'cancelled':
      return 'ยกเลิก';
    case 'refunded':
      return 'คืนเงินแล้ว';
    case 'expired':
      return 'หมดอายุ';
    default:
      return status.replace(/_/g, ' ');
  }
}

function getTaskTone(task: ServiceTaskRecord) {
  if (task.status === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (task.status === 'doing') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (task.status === 'waiting') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (task.status === 'blocked') return 'border-slate-200 bg-slate-50 text-slate-500';
  return task.priority === 'high'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-slate-200 bg-slate-50 text-slate-700';
}

function getQueuePriority(session: SessionRecord) {
  if (session.membership?.vipFastLane && session.status !== 'completed') return 0;
  if (session.status === 'ready_to_wash') return 1;
  if (session.status === 'in_progress') return 2;
  if (session.status === 'pending_payment') return 3;
  return 4;
}

export function SessionsPage({ branchId, realtimeBranchIds }: SessionsPageProps) {
  const [selectedStatus, setSelectedStatus] = useState<(typeof statusTabs)[number]>('active');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdminSessionLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.fetchSessions({
        branchId,
        limit: 100,
        status: selectedStatus === 'active' ? 'all' : selectedStatus,
      });
      setSessions(response.data);
      setSelectedSessionId((current) => {
        if (current && response.data.some((session) => session.id === current)) return current;
        const active = response.data.find((session) => activeStatuses.includes(session.status as any));
        return active?.id ?? response.data[0]?.id ?? null;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'โหลดข้อมูลรอบล้างไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [branchId, selectedStatus]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    return subscribeAdminRealtime(realtimeBranchIds, (event) => {
      if (event.type !== 'session_update') return;
      if (branchId && event.branchId !== branchId) return;

      setSessions((current) => {
        const next = [...current];
        const index = next.findIndex((session) => session.id === event.session.id);

        if (index === -1) {
          void loadSessions();
          return next;
        }

        next[index] = {
          ...next[index],
          status: event.session.status,
          progress: event.session.progress ?? next[index].progress,
          currentStep: event.session.currentStep ?? next[index].currentStep,
          totalSteps: event.session.totalSteps ?? next[index].totalSteps,
          completedAt: event.session.completedAt ?? next[index].completedAt,
          updatedAt: event.session.updatedAt ?? next[index].updatedAt,
          payment: next[index].payment
            ? {
                ...next[index].payment,
                status: event.session.paymentStatus ?? next[index].payment.status,
              }
            : next[index].payment,
          machine: event.machine
            ? {
                ...next[index].machine,
                status: event.machine.status,
              }
            : next[index].machine,
        };

        return next;
      });
    });
  }, [branchId, loadSessions, realtimeBranchIds]);

  const filtered = useMemo(() => {
    const base =
      selectedStatus === 'active'
        ? sessions.filter((session) => activeStatuses.includes(session.status as any))
        : selectedStatus === 'all'
          ? sessions
          : sessions.filter((session) => session.status === selectedStatus);

    return [...base].sort((a, b) => {
      const priority = getQueuePriority(a) - getQueuePriority(b);
      if (priority !== 0) return priority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sessions, selectedStatus]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? filtered[0] ?? null,
    [filtered, selectedSessionId, sessions]
  );

  useEffect(() => {
    if (!selectedSession) {
      setLogs(null);
      return;
    }

    let cancelled = false;
    setLogLoading(true);
    api
      .fetchSessionLogs(selectedSession.id, branchId)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {
        if (!cancelled) setLogs(null);
      })
      .finally(() => {
        if (!cancelled) setLogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedSession?.id]);

  const summary = useMemo(
    () => ({
      active: sessions.filter((session) => activeStatuses.includes(session.status as any)).length,
      ready: sessions.filter((session) => session.status === 'ready_to_wash').length,
      vip: sessions.filter((session) => session.membership?.vipFastLane && activeStatuses.includes(session.status as any)).length,
      completed: sessions.filter((session) => session.status === 'completed').length,
    }),
    [sessions]
  );

  return (
    <div className="w-full max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-700">Staff Service Dashboard</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">หน้าจอพนักงานหน้าร้าน</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            รายการที่ลูกค้าซื้อหรือเลือกโหมดจะแสดงเป็นคิวงาน พร้อม checklist, สิทธิ์ membership และ log สำหรับตรวจสอบย้อนหลัง
          </p>
        </div>
        <button
          onClick={() => void loadSessions()}
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50"
        >
          <RefreshCcw className="h-4 w-4" />
          รีเฟรชคิว
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="คิวหน้าร้าน" value={summary.active} icon={ClipboardList} tone="red" />
        <Metric label="พร้อมเริ่มงาน" value={summary.ready} icon={Timer} />
        <Metric label="VIP Active Member" value={summary.vip} icon={Sparkles} tone="red" />
        <Metric label="เสร็จแล้ว" value={summary.completed} icon={CheckCircle2} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedStatus(tab)}
            className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-black transition-colors ${
              selectedStatus === tab ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-red-700'
            }`}
          >
            {getSessionStatusLabel(tab)} ({tab === 'active' ? summary.active : tab === 'all' ? sessions.length : sessions.filter((session) => session.status === tab).length})
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(520px,1.25fr)]">
        <section className="space-y-3">
          {loading && <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500">กำลังโหลดคิว...</div>}
          {!loading && !filtered.length && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-10 text-center text-slate-500">
              <History className="mx-auto mb-3 h-8 w-8 opacity-40" />
              ยังไม่มีคิวในตัวกรองนี้
            </div>
          )}
          {filtered.map((session) => (
            <SessionQueueCard
              key={session.id}
              session={session}
              active={selectedSession?.id === session.id}
              onSelect={() => setSelectedSessionId(session.id)}
            />
          ))}
        </section>

        <section className="min-w-0">
          {selectedSession ? (
            <SessionDetailPanel session={selectedSession} logs={logs} logLoading={logLoading} />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-10 text-center text-slate-500">
              เลือกคิวเพื่อดู service checklist และ log
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = 'slate',
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'red' | 'slate';
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone === 'red' ? 'border-red-100 bg-red-50/90' : 'border-slate-200 bg-white/90'}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone === 'red' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value.toLocaleString()}</p>
    </div>
  );
}

function SessionQueueCard({ session, active, onSelect }: { session: SessionRecord; active: boolean; onSelect: () => void }) {
  const pendingTasks = session.serviceTasks?.filter((task) => task.status !== 'done').length ?? 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active ? 'border-red-200 bg-red-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-red-100 hover:bg-red-50/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-black text-slate-950">{session.user.displayName}</p>
            {session.membership?.vipFastLane && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                VIP
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {session.branch.shortName || session.branch.name} / {session.machine.name}
          </p>
        </div>
        <Eye className="h-4 w-4 flex-shrink-0 text-slate-400" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <InfoChip label="บริการ" value={`${session.package.name} (${session.carSize})`} />
        <InfoChip label="สถานะ" value={getSessionStatusLabel(session.status)} />
        <InfoChip label="ชำระเงิน" value={getPaymentStatusLabel(session.payment?.status)} />
        <InfoChip label="งานค้าง" value={`${pendingTasks} รายการ`} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>
            ขั้นตอน {session.currentStep}/{session.totalSteps}
          </span>
          <span>{session.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-red-500" style={{ width: `${session.progress}%` }} />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">สร้างเมื่อ {new Date(session.createdAt).toLocaleString('th-TH')}</p>
    </button>
  );
}

function SessionDetailPanel({
  session,
  logs,
  logLoading,
}: {
  session: SessionRecord;
  logs: AdminSessionLogs | null;
  logLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Selected Queue</p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-950">{session.user.displayName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {session.package.name} / {session.branch.shortName || session.branch.name} / {session.machine.name}
            </p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              {session.membership?.active
                ? `${session.membership.planName ?? 'Active Member'} · Wash ${session.membership.washUsed ?? 0}/${session.membership.washLimit ?? 0}`
                : 'Regular customer'}
            </div>
            <p className="mt-1 text-xs text-red-700/80">{getSessionStatusLabel(session.status)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoChip label="ยอดชำระ" value={`${session.totalPrice.toLocaleString()} บาท`} />
          <InfoChip label="Payment ref" value={session.payment?.reference || '-'} />
          <InfoChip label="เบอร์/LINE" value={session.user.phone || session.user.lineUserId || '-'} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-red-600" />
          <h3 className="font-black text-slate-950">Service Checklist</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(session.serviceTasks ?? []).map((task) => (
            <div key={task.key} className={`rounded-2xl border p-4 ${getTaskTone(task)}`}>
              <div className="flex items-start gap-3">
                {task.status === 'done' ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="font-black">{task.title}</p>
                  <p className="mt-1 text-xs opacity-80">{task.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-red-600" />
          <h3 className="font-black text-slate-950">History & Log</h3>
        </div>
        <div className="space-y-3">
          {logLoading && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">กำลังโหลด log...</div>}
          {!logLoading && !(logs?.timeline.length ?? 0) && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">ยังไม่มี log เพิ่มเติม</div>
          )}
          {!logLoading &&
            logs?.timeline.slice(0, 18).map((item, index) => (
              <div key={`${item.type}-${item.at}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
                  <Timer className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{item.detail || item.type}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(item.at).toLocaleString('th-TH')}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
