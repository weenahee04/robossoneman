import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Gauge,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import api, {
  type AdminMembershipRecord,
  type AdminMembershipSummary,
  type AdminUser,
  type MembershipStatus,
} from '@/services/api';

interface MembershipsPageProps {
  admin: AdminUser;
  branchId: string | null;
}

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

function formatMoney(value?: number | null) {
  return `${Math.round(value ?? 0).toLocaleString()} THB`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

export function MembershipsPage({ admin, branchId }: MembershipsPageProps) {
  const [memberships, setMemberships] = useState<AdminMembershipRecord[]>([]);
  const [summary, setSummary] = useState<AdminMembershipSummary>(emptySummary);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MembershipStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMemberships(nextSearch = search, nextStatus = status) {
    setLoading(true);
    try {
      const response = await api.fetchAdminMemberships({
        branchId,
        limit: 100,
        search: nextSearch || undefined,
        status: nextStatus,
      });
      setMemberships(response.data);
      setSummary(response.summary);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Load memberships failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadMemberships(search, status);
    }, 180);

    return () => clearTimeout(handle);
  }, [branchId, search, status]);

  const activeRate = useMemo(() => {
    if (!summary.totalMembers) return 0;
    return Math.round((summary.activeMembers / summary.totalMembers) * 100);
  }, [summary.activeMembers, summary.totalMembers]);

  return (
    <div className="max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-700">Active Member System</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">ROBOSS Active Members</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Track activated memberships, prepaid bundles, remaining wash credits, Graphene Shield usage, payment references, and customer access state.
          </p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-4 w-4" />
            {admin.role === 'hq_admin' ? 'HQ view' : 'Branch view'}
          </div>
          <p className="mt-1 text-xs text-red-700/80">Only active packages unlock customer benefits.</p>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total members" value={summary.totalMembers.toLocaleString()} icon={Crown} />
        <SummaryCard label="Active" value={summary.activeMembers.toLocaleString()} icon={CheckCircle2} tone="red" detail={`${activeRate}% active`} />
        <SummaryCard label="Package sales" value={formatMoney(summary.totalRevenue)} icon={WalletCards} />
        <SummaryCard label="Wash credits left" value={summary.availableWashCredits.toLocaleString()} icon={Gauge} />
        <SummaryCard label="Graphene credits left" value={summary.availableGrapheneCredits.toLocaleString()} icon={Sparkles} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_rgba(148,163,184,0.13)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, phone, LINE user id, or payment ref"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-red-400"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {statusOptions.map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-black capitalize transition ${
                  status === item ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:text-red-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3 lg:hidden">
          {loading && <LoadingState />}
          {!loading && !memberships.length && <EmptyState />}
          {!loading && memberships.map((membership) => <MembershipCard key={membership.id} membership={membership} />)}
        </div>

        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-3 text-left text-xs uppercase tracking-wider text-slate-400">Customer</th>
                <th className="px-3 py-3 text-left text-xs uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-slate-400">Wash</th>
                <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-slate-400">Graphene</th>
                <th className="px-3 py-3 text-right text-xs uppercase tracking-wider text-slate-400">Paid</th>
                <th className="px-3 py-3 text-left text-xs uppercase tracking-wider text-slate-400">Reference</th>
                <th className="px-3 py-3 text-left text-xs uppercase tracking-wider text-slate-400">Activated</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8">
                    <LoadingState />
                  </td>
                </tr>
              )}
              {!loading && !memberships.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8">
                    <EmptyState />
                  </td>
                </tr>
              )}
              {!loading &&
                memberships.map((membership) => (
                  <tr key={membership.id} className="border-b border-slate-100">
                    <td className="px-3 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 font-bold text-red-700">
                          {membership.user.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-950">{membership.user.displayName}</p>
                          <p className="truncate text-xs text-slate-500">{membership.user.phone || membership.user.lineUserId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <StatusPill status={membership.status} />
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-slate-900">
                      {membership.washUsed}/{membership.plan.washLimit}
                      <p className="text-xs font-medium text-slate-400">{membership.washRemaining} left</p>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-slate-900">
                      {membership.grapheneUsed}/{membership.plan.grapheneLimit}
                      <p className="text-xs font-medium text-slate-400">{membership.grapheneRemaining} left</p>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-slate-900">{formatMoney(membership.paymentAmount)}</td>
                    <td className="px-3 py-4 text-slate-600">{membership.paymentReference || '-'}</td>
                    <td className="px-3 py-4 text-slate-600">{formatDate(membership.activatedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = 'slate',
  detail,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'red' | 'slate';
  detail?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone === 'red' ? 'border-red-100 bg-red-50/90' : 'border-slate-200 bg-white/90'}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone === 'red' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold text-red-700">{detail}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: MembershipStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${getStatusTone(status)}`}>{status}</span>;
}

function MembershipCard({ membership }: { membership: AdminMembershipRecord }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">{membership.user.displayName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{membership.user.phone || membership.user.lineUserId}</p>
        </div>
        <StatusPill status={membership.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <CreditBox label="Wash" value={`${membership.washUsed}/${membership.plan.washLimit}`} sub={`${membership.washRemaining} left`} />
        <CreditBox label="Graphene" value={`${membership.grapheneUsed}/${membership.plan.grapheneLimit}`} sub={`${membership.grapheneRemaining} left`} />
        <CreditBox label="Paid" value={formatMoney(membership.paymentAmount)} sub={membership.paymentStatus} />
        <CreditBox label="Activated" value={formatDate(membership.activatedAt)} sub={membership.paymentReference || '-'} />
      </div>
    </div>
  );
}

function CreditBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      Loading memberships...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      No active member packages found.
    </div>
  );
}
