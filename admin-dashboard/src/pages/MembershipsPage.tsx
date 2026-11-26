import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gauge,
  History,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import api, {
  type AdminMembershipRecord,
  type AdminMembershipPurchaseRecord,
  type AdminMembershipSummary,
  type AdminUser,
  type MembershipStatus,
} from '@/services/api';

interface MembershipsPageProps {
  admin: AdminUser;
  branchId: string | null;
}

type ViewName = 'overview' | 'reviews' | 'plans' | 'members';

const emptySummary: AdminMembershipSummary = {
  totalMembers: 0,
  activeMembers: 0,
  pendingMembers: 0,
  expiredMembers: 0,
  cancelledMembers: 0,
  totalRevenue: 0,
  availableWashCredits: 0,
  availableGrapheneCredits: 0,
};

const statusOptions: Array<MembershipStatus | 'all'> = ['all', 'active', 'pending', 'expired', 'cancelled'];
const statusLabels: Record<MembershipStatus | 'all', string> = {
  all: 'ทั้งหมด',
  active: 'กำลังใช้งาน',
  pending: 'รอยืนยัน',
  expired: 'หมดอายุ',
  cancelled: 'ยกเลิก',
};

function formatMoney(value?: number | null) {
  return `฿${Math.round(value ?? 0).toLocaleString()}`;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function getStatusTone(status: MembershipStatus) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'expired':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    case 'cancelled':
      return 'border-red-200 bg-red-50 text-red-700';
  }
}

export function MembershipsPage({ admin, branchId }: MembershipsPageProps) {
  const [memberships, setMemberships] = useState<AdminMembershipRecord[]>([]);
  const [summary, setSummary] = useState<AdminMembershipSummary>(emptySummary);
  const [view, setView] = useState<ViewName>('overview');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MembershipStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<AdminMembershipPurchaseRecord[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<AdminMembershipPurchaseRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.fetchAdminMemberships({ branchId, limit: 100, status: 'all' })
      .then((response) => {
        if (cancelled) return;
        setMemberships(response.data);
        setSummary(response.summary);
        setError(null);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'ไม่สามารถโหลดข้อมูลสมาชิกได้');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    if (admin.role !== 'hq_admin') return;
    let cancelled = false;
    setReviewLoading(true);
    api.fetchAdminMembershipPurchases()
      .then((items) => {
        if (!cancelled) {
          setPurchases(items);
          setReviewError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setReviewError(err instanceof Error ? err.message : 'ไม่สามารถโหลดคิวตรวจสลิปได้');
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [admin.role]);

  const handleReview = async (purchase: AdminMembershipPurchaseRecord, action: 'approve' | 'reject') => {
    const prompt = action === 'approve'
      ? `ยืนยันอนุมัติยอด ${formatMoney(purchase.amount)} สำหรับ ${purchase.userName}?`
      : `ยืนยันปฏิเสธรายการ ${purchase.reference}?`;
    if (!window.confirm(prompt)) return;

    setReviewActionId(purchase.id);
    setReviewError(null);
    try {
      if (action === 'approve') {
        await api.approveAdminMembershipPurchase(purchase.id);
      } else {
        await api.rejectAdminMembershipPurchase(purchase.id);
      }
      setPurchases((items) => items.filter((item) => item.id !== purchase.id));
      setSelectedSlip((current) => current?.id === purchase.id ? null : current);
      const refreshed = await api.fetchAdminMemberships({ branchId, limit: 100, status: 'all' });
      setMemberships(refreshed.data);
      setSummary(refreshed.summary);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'อัปเดตสถานะรายการไม่สำเร็จ');
    } finally {
      setReviewActionId(null);
    }
  };

  const filteredMemberships = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('th');
    return memberships.filter((membership) => {
      const matchesStatus = status === 'all' || membership.status === status;
      const matchesKeyword = !keyword || [
        membership.user.displayName,
        membership.user.phone,
        membership.user.lineUserId,
        membership.paymentReference,
        membership.plan.name,
      ].some((value) => value?.toLocaleLowerCase('th').includes(keyword));
      return matchesStatus && matchesKeyword;
    });
  }, [memberships, search, status]);

  const planStats = useMemo(() => {
    const plans = new Map<string, {
      code: string;
      name: string;
      price: number;
      washLimit: number;
      grapheneLimit: number;
      sold: number;
      active: number;
      revenue: number;
      washesUsed: number;
      washCredits: number;
    }>();
    memberships.forEach((membership) => {
      const current = plans.get(membership.plan.code) ?? {
        code: membership.plan.code,
        name: membership.plan.name,
        price: membership.plan.price,
        washLimit: membership.plan.washLimit,
        grapheneLimit: membership.plan.grapheneLimit,
        sold: 0,
        active: 0,
        revenue: 0,
        washesUsed: 0,
        washCredits: 0,
      };
      current.sold += 1;
      current.active += membership.status === 'active' ? 1 : 0;
      current.revenue += membership.paymentStatus !== 'refunded' ? membership.paymentAmount : 0;
      current.washesUsed += membership.washUsed;
      current.washCredits += membership.plan.washLimit;
      plans.set(membership.plan.code, current);
    });
    return Array.from(plans.values()).sort((a, b) => b.revenue - a.revenue);
  }, [memberships]);

  const expiringSoon = useMemo(() => memberships.filter((membership) => {
    if (membership.status !== 'active' || !membership.expiresAt) return false;
    const days = (new Date(membership.expiresAt).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 30;
  }), [memberships]);

  const recentActivity = useMemo(() => [...memberships]
    .filter((membership) => membership.activatedAt || membership.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt || b.activatedAt || 0).getTime() - new Date(a.lastUsedAt || a.activatedAt || 0).getTime())
    .slice(0, 6), [memberships]);

  const activeRate = summary.totalMembers ? Math.round((summary.activeMembers / summary.totalMembers) * 100) : 0;

  return (
    <div className="max-w-[1500px] space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(148,163,184,0.12)]">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/20">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-950">ศูนย์จัดการแพ็กเกจสมาชิก</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {admin.role === 'hq_admin' ? 'ทุกสาขา' : 'เฉพาะสาขาที่ดูแล'}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">ดูยอดขาย จำนวนสิทธิ์คงเหลือ และประวัติการใช้แพ็กเกจในหน้าเดียว</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-black text-emerald-800">ตัดสิทธิ์อัตโนมัติ</p>
              <p className="text-[11px] text-emerald-700/70">เมื่อรอบล้างเสร็จ ระบบจะบันทึกการใช้งานทันที</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 bg-slate-50/70 px-3 py-2 no-scrollbar">
          <ViewButton active={view === 'overview'} onClick={() => setView('overview')} icon={Gauge} label="ภาพรวม" />
          {admin.role === 'hq_admin' && (
            <ViewButton active={view === 'reviews'} onClick={() => setView('reviews')} icon={Sparkles} label="ตรวจสลิป" count={purchases.filter((item) => item.purchaseStatus === 'pending_review').length} />
          )}
          <ViewButton active={view === 'plans'} onClick={() => setView('plans')} icon={PackageCheck} label="แพ็กเกจ" count={planStats.length} />
          <ViewButton active={view === 'members'} onClick={() => setView('members')} icon={Users} label="ลูกค้าสมาชิก" count={summary.totalMembers} />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {view === 'overview' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="แพ็กเกจที่ขาย" value={summary.totalMembers.toLocaleString()} detail={`${summary.activeMembers} กำลังใช้งาน`} icon={Crown} tone="red" />
            <SummaryCard label="ยอดขายแพ็กเกจ" value={formatMoney(summary.totalRevenue)} detail="รวมรายการที่ไม่คืนเงิน" icon={CircleDollarSign} />
            <SummaryCard label="สิทธิ์ล้างคงเหลือ" value={`${summary.availableWashCredits.toLocaleString()} ครั้ง`} detail="พร้อมให้ลูกค้าใช้งาน" icon={Gauge} />
            <SummaryCard label="อัตราใช้งานอยู่" value={`${activeRate}%`} detail={`${expiringSoon.length} แพ็กใกล้หมดอายุ`} icon={CheckCircle2} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">แพ็กเกจที่ขายดี</h3>
                  <p className="mt-1 text-xs text-slate-500">เรียงจากยอดขายสะสม</p>
                </div>
                <button type="button" onClick={() => setView('plans')} className="flex items-center gap-1 text-xs font-bold text-red-700">ดูทั้งหมด <ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 space-y-3">
                {loading && <LoadingState />}
                {!loading && !planStats.length && <EmptyState text="ยังไม่มีการขายแพ็กเกจ" />}
                {planStats.slice(0, 4).map((plan, index) => (
                  <div key={plan.code} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${index === 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{plan.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">ขาย {plan.sold} · ใช้งานอยู่ {plan.active}</p>
                    </div>
                    <p className="font-black text-slate-950">{formatMoney(plan.revenue)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-black text-slate-950">กิจกรรมล่าสุด</h3>
                  <p className="mt-1 text-xs text-slate-500">เปิดแพ็กเกจและใช้สิทธิ์ล่าสุด</p>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                {!recentActivity.length && <EmptyState text="ยังไม่มีประวัติการใช้งาน" />}
                {recentActivity.map((membership) => {
                  const used = Boolean(membership.lastUsedAt);
                  return (
                    <div key={membership.id} className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${used ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {used ? <History className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{membership.user.displayName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{used ? `ใช้สิทธิ์ ${membership.washUsed}/${membership.plan.washLimit} ครั้ง` : `เปิด ${membership.plan.name}`}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{formatDate(membership.lastUsedAt || membership.activatedAt, true)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {expiringSoon.length > 0 && (
            <button type="button" onClick={() => { setStatus('active'); setView('members'); }} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
              <CalendarClock className="h-5 w-5 flex-shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="text-sm font-black text-amber-900">มี {expiringSoon.length} แพ็กเกจใกล้หมดอายุใน 30 วัน</p>
                <p className="mt-0.5 text-xs text-amber-700">เปิดรายชื่อลูกค้าเพื่อติดตามต่ออายุ</p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-700" />
            </button>
          )}
        </>
      )}

      {view === 'reviews' && admin.role === 'hq_admin' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">คิวตรวจสลิปแพ็กสมาชิก</h3>
              <p className="mt-1 text-sm text-slate-500">เปิดดูสลิปและตรวจยอด/เลขอ้างอิงก่อนอนุมัติ รายการที่ยังไม่แนบสลิปจะอนุมัติไม่ได้</p>
            </div>
            <span className="text-xs font-bold text-slate-400">ค้างตรวจ {purchases.filter((item) => item.purchaseStatus === 'pending_review').length} รายการ</span>
          </div>

          {reviewError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{reviewError}</div>}
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {reviewLoading && <LoadingState />}
            {!reviewLoading && purchases.length === 0 && <EmptyState text="ไม่มีรายการซื้อแพ็กสมาชิกที่รอดำเนินการ" />}
            {purchases.map((purchase) => {
              const canApprove = purchase.purchaseStatus === 'pending_review' && Boolean(purchase.slipImage);
              const actionPending = reviewActionId === purchase.id;
              return (
                <article key={purchase.id} className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="grid min-h-[220px] sm:grid-cols-[190px_1fr]">
                    <button
                      type="button"
                      onClick={() => purchase.slipImage && setSelectedSlip(purchase)}
                      disabled={!purchase.slipImage}
                      className="min-h-[180px] overflow-hidden bg-slate-100 disabled:cursor-default"
                    >
                      {purchase.slipImage ? (
                        <img src={purchase.slipImage} alt={`สลิป ${purchase.reference}`} className="h-full w-full object-cover transition hover:scale-[1.02]" />
                      ) : (
                        <span className="flex h-full items-center justify-center p-5 text-center text-xs font-bold text-slate-400">ลูกค้ายังไม่แนบสลิป</span>
                      )}
                    </button>
                    <div className="flex flex-col p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{purchase.userName}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{purchase.planName}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${canApprove ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {canApprove ? 'รอตรวจสลิป' : 'รอลูกค้าโอน'}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div><dt className="text-slate-400">ยอดชำระ</dt><dd className="mt-1 text-base font-black text-red-700">{formatMoney(purchase.amount)}</dd></div>
                        <div><dt className="text-slate-400">ส่งสลิปเมื่อ</dt><dd className="mt-1 font-bold text-slate-700">{formatDate(purchase.slipUploadedAt, true)}</dd></div>
                        <div className="col-span-2"><dt className="text-slate-400">เลขอ้างอิง</dt><dd className="mt-1 break-all font-mono font-bold text-slate-700">{purchase.reference || '-'}</dd></div>
                        {purchase.slipImageHash && <div className="col-span-2"><dt className="text-slate-400">แฮชสลิป</dt><dd className="mt-1 font-mono text-slate-600">{purchase.slipImageHash}</dd></div>}
                      </dl>
                      <div className="mt-auto flex gap-2 pt-4">
                        <button type="button" onClick={() => void handleReview(purchase, 'reject')} disabled={actionPending} className="flex-1 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-black text-red-700 disabled:opacity-50">ปฏิเสธ</button>
                        <button type="button" onClick={() => void handleReview(purchase, 'approve')} disabled={!canApprove || actionPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                          {actionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          อนุมัติ
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {view === 'plans' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">ผลการขายแยกตามแพ็กเกจ</h3>
              <p className="mt-1 text-sm text-slate-500">เทียบยอดขาย สมาชิกที่ยังใช้งาน และจำนวนครั้งที่ใช้ไปแล้ว</p>
            </div>
            <span className="text-xs font-bold text-slate-400">อัปเดตจากรายการสมาชิกจริง</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading && <LoadingState />}
            {!loading && !planStats.length && <EmptyState text="ยังไม่มีข้อมูลแพ็กเกจที่ขาย" />}
            {planStats.map((plan) => {
              const usageRate = plan.washCredits ? Math.round((plan.washesUsed / plan.washCredits) * 100) : 0;
              return (
                <article key={plan.code} className="rounded-3xl border border-slate-200 p-5 transition hover:border-red-200 hover:shadow-lg hover:shadow-slate-200/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700">{plan.code}</span>
                      <h4 className="mt-2 truncate font-black text-slate-950">{plan.name}</h4>
                    </div>
                    <p className="text-lg font-black text-slate-950">{formatMoney(plan.price)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <SmallMetric label="ขายแล้ว" value={`${plan.sold}`} />
                    <SmallMetric label="ใช้งานอยู่" value={`${plan.active}`} />
                    <SmallMetric label="สิทธิ์/แพ็ก" value={`${plan.washLimit}`} />
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs"><span className="font-bold text-slate-600">ใช้สิทธิ์แล้ว</span><span className="font-black text-slate-900">{plan.washesUsed}/{plan.washCredits}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-600" style={{ width: `${Math.min(usageRate, 100)}%` }} /></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">ยอดขายสะสม</span><span className="font-black text-red-700">{formatMoney(plan.revenue)}</span></div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {view === 'members' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อลูกค้า เบอร์โทร แพ็กเกจ หรือเลขอ้างอิง" className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-red-400" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {statusOptions.map((item) => (
                <button key={item} type="button" onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black ${status === item ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>{statusLabels[item]}</button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3 lg:hidden">
            {loading && <LoadingState />}
            {!loading && !filteredMemberships.length && <EmptyState text="ไม่พบสมาชิกตามเงื่อนไข" />}
            {filteredMemberships.map((membership) => <MembershipCard key={membership.id} membership={membership} />)}
          </div>

          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">ลูกค้า / แพ็กเกจ</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3">การใช้งาน</th><th className="px-3 py-3">คงเหลือ</th><th className="px-3 py-3">ใช้งานล่าสุด</th><th className="px-3 py-3 text-right">ยอดชำระ</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="py-8"><LoadingState /></td></tr>}
                {!loading && !filteredMemberships.length && <tr><td colSpan={6} className="py-8"><EmptyState text="ไม่พบสมาชิกตามเงื่อนไข" /></td></tr>}
                {filteredMemberships.map((membership) => (
                  <tr key={membership.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 font-black text-red-700">{membership.user.displayName.slice(0, 1)}</div><div><p className="font-black text-slate-950">{membership.user.displayName}</p><p className="mt-0.5 text-xs text-slate-500">{membership.plan.name}</p></div></div></td>
                    <td className="px-3 py-4"><StatusPill status={membership.status} /></td>
                    <td className="px-3 py-4"><p className="font-black text-slate-900">{membership.washUsed}/{membership.plan.washLimit} ครั้ง</p><p className="mt-0.5 text-xs text-slate-400">กราฟีน {membership.grapheneUsed}/{membership.plan.grapheneLimit}</p></td>
                    <td className="px-3 py-4"><p className="font-black text-red-700">{membership.washRemaining} ครั้ง</p><p className="mt-0.5 text-xs text-slate-400">หมดอายุ {formatDate(membership.expiresAt)}</p></td>
                    <td className="px-3 py-4 text-slate-600">{formatDate(membership.lastUsedAt, true)}</td>
                    <td className="px-3 py-4 text-right"><p className="font-black text-slate-950">{formatMoney(membership.paymentAmount)}</p><p className="mt-0.5 text-xs text-slate-400">{membership.paymentReference || '-'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedSlip?.slipImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="ตรวจสลิปแพ็กสมาชิก" onClick={() => setSelectedSlip(null)}>
          <div className="max-h-[92vh] max-w-3xl overflow-auto rounded-3xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4 px-2 pt-1">
              <div><p className="font-black text-slate-950">{selectedSlip.userName}</p><p className="text-xs text-slate-500">{selectedSlip.reference}</p></div>
              <button type="button" onClick={() => setSelectedSlip(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">ปิด</button>
            </div>
            <img src={selectedSlip.slipImage} alt={`สลิป ${selectedSlip.reference}`} className="max-h-[78vh] w-auto rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; count?: number }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition ${active ? 'bg-white text-red-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}{count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-red-50 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{count}</span>}</button>;
}

function SummaryCard({ label, value, detail, icon: Icon, tone = 'slate' }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }>; tone?: 'red' | 'slate' }) {
  return <div className={`rounded-3xl border p-5 ${tone === 'red' ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone === 'red' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-5 w-5" /></div></div><p className={`mt-3 text-xs font-bold ${tone === 'red' ? 'text-red-700' : 'text-slate-400'}`}>{detail}</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>;
}

function StatusPill({ status }: { status: MembershipStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusTone(status)}`}>{statusLabels[status]}</span>;
}

function MembershipCard({ membership }: { membership: AdminMembershipRecord }) {
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-950">{membership.user.displayName}</p><p className="mt-1 truncate text-xs text-slate-500">{membership.plan.name}</p></div><StatusPill status={membership.status} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><SmallMetric label="ใช้ไปแล้ว" value={`${membership.washUsed}/${membership.plan.washLimit} ครั้ง`} /><SmallMetric label="คงเหลือ" value={`${membership.washRemaining} ครั้ง`} /><SmallMetric label="ล่าสุด" value={formatDate(membership.lastUsedAt)} /><SmallMetric label="ยอดชำระ" value={formatMoney(membership.paymentAmount)} /></div>
    </article>
  );
}

function LoadingState() {
  return <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">กำลังโหลดข้อมูลสมาชิก...</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-slate-400" />{text}</div>;
}
