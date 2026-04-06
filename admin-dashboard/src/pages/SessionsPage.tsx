import React, { useEffect, useMemo, useState } from 'react';
import { Eye, History } from 'lucide-react';
import api, { type AdminUser, type SessionRecord } from '@/services/api';
import { subscribeAdminRealtime } from '@/services/realtime';

interface SessionsPageProps {
  admin: AdminUser;
  branchId: string | null;
  realtimeBranchIds: string[];
}

const statusTabs = ['all', 'pending_payment', 'ready_to_wash', 'in_progress', 'completed', 'cancelled'] as const;

function getSessionStatusLabel(status: (typeof statusTabs)[number] | SessionRecord['status']) {
  switch (status) {
    case 'all':
      return 'ทั้งหมด';
    case 'pending_payment':
      return 'รอชำระเงิน';
    case 'ready_to_wash':
      return 'พร้อมล้าง';
    case 'in_progress':
      return 'กำลังดำเนินการ';
    case 'completed':
      return 'เสร็จสิ้น';
    case 'cancelled':
      return 'ยกเลิก';
    default:
      return String(status).replace(/_/g, ' ');
  }
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) {
    return 'ไม่มีข้อมูล';
  }

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

export function SessionsPage({ branchId, realtimeBranchIds }: SessionsPageProps) {
  const [selectedStatus, setSelectedสถานะ] = useState<(typeof statusTabs)[number]>('all');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.fetchSessions({
          branchId,
          limit: 50,
          status: selectedStatus,
        });

        if (!cancelled) {
          setSessions(response.data);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'โหลดข้อมูลรอบล้างไม่สำเร็จ');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedStatus]);

  useEffect(() => {
    return subscribeAdminRealtime(realtimeBranchIds, (event) => {
      if (event.type !== 'session_update') {
        return;
      }

      if (branchId && event.branchId !== branchId) {
        return;
      }

      setSessions((current) => {
        const next = [...current];
        const index = next.findIndex((session) => session.id === event.session.id);

        if (index === -1) {
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
  }, [branchId, realtimeBranchIds]);

  const filtered = useMemo(() => {
    if (selectedStatus === 'all') {
      return sessions;
    }

    return sessions.filter((session) => session.status === selectedStatus);
  }, [sessions, selectedStatus]);

  return (
    <div className="max-w-[1400px] space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">รอบล้าง</h2>
        <p className="mt-1 text-sm text-gray-500">คิวปฏิบัติงานแบบเรียลไทม์พร้อมการมองเห็นรอบตามขอบเขตสาขา</p>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedสถานะ(tab)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              selectedStatus === tab ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.03] text-gray-400 hover:text-white'
            }`}
          >
            {getSessionStatusLabel(tab)} ({tab === 'all' ? sessions.length : sessions.filter((session) => session.status === tab).length})
          </button>
        ))}
      </div>

      <div className="space-y-4 lg:hidden">
        {filtered.map((session) => (
          <div key={session.id} className="gradient-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-white">{session.user.displayName}</p>
                <p className="truncate text-xs text-gray-500">{session.id}</p>
              </div>
              <button className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white">
                <Eye className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <InfoRow label="สาขา / เครื่อง" value={`${session.branch.shortName || session.branch.name} / ${session.machine.name}`} />
              <InfoRow label="แพ็กเกจ" value={`${session.package.name} (${session.carSize})`} />
              <InfoRow label="สถานะ" value={getSessionStatusLabel(session.status)} />
              <InfoRow label="การชำระเงิน" value={getPaymentStatusLabel(session.payment?.status)} />
            </div>

            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3">
              <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                <span>
                  ขั้นตอน {session.currentStep}/{session.totalSteps}
                </span>
                <span>{session.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div className="h-2 rounded-full bg-red-500" style={{ width: `${session.progress}%` }} />
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-400">สร้างเมื่อ {new Date(session.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="gradient-card hidden overflow-hidden rounded-2xl lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">ลูกค้า</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">สาขา / เครื่อง</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">แพ็กเกจ</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">สถานะ</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">การชำระเงิน</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">ความคืบหน้า</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">สร้างเมื่อ</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => (
                <tr key={session.id} className="border-b border-gray-800/30 hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{session.user.displayName}</p>
                    <p className="text-xs text-gray-600">{session.id}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300">
                    <p>{session.branch.shortName || session.branch.name}</p>
                    <p className="text-xs text-gray-600">{session.machine.name}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300">
                    {session.package.name} ({session.carSize})
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-200">
                      {getSessionStatusLabel(session.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-200">
                      {getPaymentStatusLabel(session.payment?.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="w-32">
                      <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                        <span>
                          ขั้นตอน {session.currentStep}/{session.totalSteps}
                        </span>
                        <span>{session.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-red-500" style={{ width: `${session.progress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">{new Date(session.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-4 text-right">
                    <button className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!filtered.length && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center text-gray-500">
          <History className="mx-auto mb-3 h-8 w-8 opacity-40" />
          ไม่พบรอบล้างตามตัวกรองที่เลือก
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}



