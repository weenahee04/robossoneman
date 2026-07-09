import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, History, Minus, Plus, Search, ShieldCheck, Stamp, UserRound } from 'lucide-react';
import api, {
  type AdminStampCustomerRecord,
  type AdminStampHistory,
  type AdminStampSummary,
  type AdminUser,
} from '@/services/api';

interface StampManagementPageProps {
  admin: AdminUser;
  branchId: string | null;
}

const emptySummary: AdminStampSummary = {
  totalCustomers: 0,
  activeCards: 0,
  readyToClaim: 0,
  totalCurrentStamps: 0,
  totalEarnedInScope: 0,
};

export function StampManagementPage({ admin, branchId }: StampManagementPageProps) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<AdminStampCustomerRecord[]>([]);
  const [summary, setSummary] = useState<AdminStampSummary>(emptySummary);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<AdminStampHistory | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.user.id === selectedUserId) ?? customers[0] ?? null,
    [customers, selectedUserId]
  );

  async function loadStamps(nextSearch = search) {
    setLoading(true);
    try {
      const response = await api.fetchAdminStamps({
        branchId,
        limit: 100,
        search: nextSearch || undefined,
      });
      setCustomers(response.data);
      setSummary(response.summary);
      setSelectedUserId((current) => {
        if (current && response.data.some((item) => item.user.id === current)) {
          return current;
        }
        return response.data[0]?.user.id ?? null;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'โหลดข้อมูลแสตมไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadStamps(search);
    }, 180);

    return () => clearTimeout(handle);
  }, [branchId, search]);

  useEffect(() => {
    if (!selectedCustomer) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    api
      .fetchAdminStampHistory(selectedCustomer.user.id, branchId)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || 'โหลดประวัติแสตมไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedCustomer?.user.id]);

  async function handleAdjust(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedCustomer) {
      return;
    }

    setSaving(true);
    setSuccess(null);
    try {
      const result = await api.adjustAdminStamp(
        selectedCustomer.user.id,
        {
          delta,
          reason,
        },
        branchId
      );
      setReason('');
      setSuccess(`ปรับแสตมจาก ${result.beforeCount} เป็น ${result.afterCount} แล้ว`);
      await loadStamps(search);
      const nextHistory = await api.fetchAdminStampHistory(selectedCustomer.user.id, branchId);
      setHistory(nextHistory);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'ปรับแสตมไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  const canAdjust = admin.role === 'hq_admin' || admin.scopes.some((scope) => scope.canManageCoupons);

  return (
    <div className="max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-700">Stamp Coupon</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">จัดการแสตมลูกค้า</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            ดูยอดแสตมรายลูกค้า ตรวจประวัติการได้รับแสตม และปรับแสตมแบบมี audit log ทุกครั้ง
          </p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            กันโกงเปิดใช้งาน
          </div>
          <p className="mt-1 text-xs text-red-700/80">แสตมจากรอบล้างจริงให้ได้ครั้งเดียว ส่วนการปรับมือถูกบันทึกเหตุผล</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="ลูกค้าในขอบเขต" value={summary.totalCustomers} />
        <SummaryCard label="บัตรแสตมที่เปิดอยู่" value={summary.activeCards} />
        <SummaryCard label="พร้อมรับรางวัล" value={summary.readyToClaim} tone="red" />
        <SummaryCard label="แสตมคงเหลือรวม" value={summary.totalCurrentStamps} />
        <SummaryCard label="แสตมที่ได้จากสาขา" value={summary.totalEarnedInScope} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(520px,1.25fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่อ เบอร์โทร หรือ LINE user id"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-red-400"
            />
          </div>

          <div className="mt-4 space-y-3">
            {loading && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">กำลังโหลดข้อมูล...</div>}
            {!loading && !customers.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                ยังไม่มีลูกค้าที่มีรอบล้างในขอบเขตนี้
              </div>
            )}
            {customers.map((customer) => {
              const active = selectedCustomer?.user.id === customer.user.id;
              return (
                <button
                  key={customer.user.id}
                  onClick={() => setSelectedUserId(customer.user.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active ? 'border-red-200 bg-red-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-red-100 hover:bg-red-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 font-bold text-white">
                        {customer.user.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{customer.user.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{customer.user.phone || customer.user.lineUserId}</p>
                      </div>
                    </div>
                    {customer.readyToClaim && (
                      <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-semibold text-white">ครบแล้ว</span>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>แสตมปัจจุบัน</span>
                      <span className="font-semibold text-slate-800">
                        {customer.currentCount}/{customer.targetCount}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(customer.progressPercent, 100)}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          {selectedCustomer ? (
            <>
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                      <UserRound className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-950">{selectedCustomer.user.displayName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedCustomer.user.phone || selectedCustomer.user.lineUserId}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Badge>ล้างแล้ว {selectedCustomer.totalWashesInScope.toLocaleString()} ครั้ง</Badge>
                        <Badge>รับรางวัลแล้ว {selectedCustomer.claimedRewards.toLocaleString()} ครั้ง</Badge>
                        <Badge>ยอดใช้จ่าย {selectedCustomer.totalSpendInScope.toLocaleString()} บาท</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Stamp Card</p>
                    <p className="mt-2 text-4xl font-black text-slate-950">
                      {selectedCustomer.currentCount}
                      <span className="text-lg text-slate-400">/{selectedCustomer.targetCount}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedCustomer.readyToClaim ? 'ครบเงื่อนไขรับคูปองล้างฟรี' : 'ยังสะสมไม่ครบ'}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAdjust} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
                <div className="mb-4 flex items-center gap-2">
                  <Stamp className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-bold text-slate-950">ปรับแสตมแบบมีหลักฐาน</h3>
                    <p className="text-xs text-slate-500">ใช้เฉพาะกรณีแก้ไขงานหน้าร้าน เช่น เครื่องไม่ส่ง event หรือคืนสิทธิ์ให้ลูกค้า</p>
                  </div>
                </div>

                {!canAdjust && (
                  <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    บัญชีนี้ไม่มีสิทธิ์จัดการคูปอง/แสตมในขอบเขตสาขา
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-[170px_1fr_auto]">
                  <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setDelta((value) => Math.max(value - 1, -10))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-red-700"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={-10}
                      max={10}
                      value={delta}
                      onChange={(event) => setDelta(Number(event.target.value))}
                      className="min-w-0 flex-1 bg-transparent text-center text-lg font-black text-slate-950 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setDelta((value) => Math.min(value + 1, 10))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-red-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="เหตุผล เช่น เครื่องไม่ส่ง event หลังล้างเสร็จ"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-400"
                    required
                    minLength={8}
                  />
                  <button
                    type="submit"
                    disabled={!canAdjust || saving}
                    className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </form>

              <div className="grid gap-5 lg:grid-cols-2">
                <HistoryPanel title="ประวัติแสตมจากรอบล้างจริง" loading={historyLoading}>
                  {history?.transactions.length ? (
                    history.transactions.slice(0, 8).map((transaction) => (
                      <TimelineItem
                        key={transaction.id}
                        title={`+${transaction.stampCount} แสตม`}
                        description={`${transaction.package.name} · ${transaction.branch.shortName || transaction.branch.name}`}
                        meta={new Date(transaction.createdAt).toLocaleString()}
                      />
                    ))
                  ) : (
                    <EmptyHistory text="ยังไม่มีประวัติรับแสตมจากรอบล้าง" />
                  )}
                </HistoryPanel>

                <HistoryPanel title="ประวัติการปรับมือโดยแอดมิน" loading={historyLoading}>
                  {history?.adjustments.length ? (
                    history.adjustments.slice(0, 8).map((adjustment) => (
                      <TimelineItem
                        key={adjustment.id}
                        title={`${adjustment.metadata?.delta > 0 ? '+' : ''}${adjustment.metadata?.delta ?? 0} แสตม`}
                        description={adjustment.metadata?.reason ?? adjustment.action}
                        meta={`${new Date(adjustment.createdAt).toLocaleString()} · ${adjustment.adminUser?.name ?? 'system'}`}
                      />
                    ))
                  ) : (
                    <EmptyHistory text="ยังไม่มีรายการปรับมือ" />
                  )}
                </HistoryPanel>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-10 text-center text-slate-500">
              เลือกลูกค้าเพื่อดูและจัดการแสตม
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'red' }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone === 'red' ? 'border-red-100 bg-red-50/90' : 'border-slate-200 bg-white/90'}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value.toLocaleString()}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">{children}</span>;
}

function HistoryPanel({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-red-600" />
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      <div className="space-y-3">
        {loading ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">กำลังโหลดประวัติ...</div> : children}
      </div>
    </div>
  );
}

function TimelineItem({ title, description, meta }: { title: string; description: string; meta: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
        <CalendarClock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        <p className="mt-1 text-xs text-slate-400">{meta}</p>
      </div>
    </div>
  );
}

function EmptyHistory({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>;
}
