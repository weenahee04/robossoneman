import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Lock, Save, Settings2, ShieldCheck, Unlock } from 'lucide-react';
import api, {
  type AdminUser,
  type BranchOption,
  type BranchPaymentApprovalStatus,
  type BranchPaymentCapabilityRecord,
  type BranchPaymentConfigRecord,
  type BranchPaymentMode,
  type BranchPaymentProvider,
  type PaymentConfigAuditEntry,
  type PaymentGovernanceOverview,
} from '@/services/api';

interface PaymentSetupPageProps {
  admin: AdminUser;
  branchId: string | null;
  branches: BranchOption[];
}

type DraftState = {
  displayName: string;
  statementName: string;
  mode: BranchPaymentMode;
  provider: BranchPaymentProvider;
  promptPayId: string;
  promptPayName: string;
  isActive: boolean;
  supportsReferenceBinding: boolean;
  supportsSliplessConfirmation: boolean;
};

const defaultDraft: DraftState = {
  displayName: '',
  statementName: '',
  mode: 'manual_promptpay',
  provider: 'promptpay_manual',
  promptPayId: '',
  promptPayName: '',
  isActive: true,
  supportsReferenceBinding: true,
  supportsSliplessConfirmation: false,
};

function getCredentialValue(config: BranchPaymentConfigRecord | null, key: string) {
  return config?.credentials.find((credential) => credential.key === key)?.maskedValue ?? '';
}

function buildDraft(config: BranchPaymentConfigRecord | null): DraftState {
  if (!config) {
    return defaultDraft;
  }

  return {
    displayName: config.displayName,
    statementName: config.statementName ?? '',
    mode: config.mode,
    provider: config.provider,
    promptPayId: getCredentialValue(config, 'promptpay_id'),
    promptPayName: getCredentialValue(config, 'promptpay_name'),
    isActive: config.isActive,
    supportsReferenceBinding: config.capabilities?.supportsReferenceBinding ?? true,
    supportsSliplessConfirmation: config.capabilities?.supportsSliplessConfirmation ?? false,
  };
}

function getStatusTone(status: BranchPaymentApprovalStatus) {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'pending_review':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'rejected':
      return 'border-red-500/20 bg-red-500/10 text-red-300';
    default:
      return 'border-white/10 bg-white/5 text-gray-300';
  }
}

function formatAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return '';
  }

  const entries = Object.entries(metadata as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);

  return entries.join(' | ');
}

function getApprovalStatusLabel(status: BranchPaymentApprovalStatus) {
  switch (status) {
    case 'approved':
      return 'อนุมัติแล้ว';
    case 'pending_review':
      return 'รอตรวจสอบ';
    case 'rejected':
      return 'ไม่อนุมัติ';
    default:
      return status;
  }
}

export function PaymentSetupPage({ admin, branchId, branches }: PaymentSetupPageProps) {
  const [configs, setConfigs] = useState<BranchPaymentConfigRecord[]>([]);
  const [governance, setGovernance] = useState<PaymentGovernanceOverview | null>(null);
  const [auditEntries, setAuditEntries] = useState<PaymentConfigAuditEntry[]>([]);
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isHq = admin.role === 'hq_admin';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [paymentConfigs, governanceData] = await Promise.all([
          api.fetchBranchPaymentConfigs(branchId),
          isHq ? api.fetchPaymentGovernanceOverview() : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setConfigs(paymentConfigs);
        setGovernance(governanceData);
        const targetConfig = branchId ? paymentConfigs.find((config) => config.branchId === branchId) ?? null : null;
        setDraft(buildDraft(targetConfig));
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'โหลดการตั้งค่าการชำระเงินไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, isHq]);

  const selectedConfig = useMemo(
    () => (branchId ? configs.find((config) => config.branchId === branchId) ?? null : null),
    [branchId, configs]
  );
  const selectedBranch = useMemo(
    () => (branchId ? branches.find((branch) => branch.id === branchId) ?? null : null),
    [branchId, branches]
  );
  const selectedGovernance = useMemo(
    () => governance?.items.find((item) => item.config.branchId === branchId) ?? null,
    [branchId, governance]
  );

  useEffect(() => {
    setDraft(buildDraft(selectedConfig));
  }, [selectedConfig]);

  useEffect(() => {
    let cancelled = false;

    if (!isHq || !selectedConfig) {
      setAuditEntries([]);
      return;
    }

    (async () => {
      try {
        const data = await api.fetchPaymentConfigAudit(selectedConfig.id);
        if (!cancelled) {
          setAuditEntries(data.entries);
        }
      } catch (err: any) {
        if (!cancelled) {
          setAuditEntries([]);
          setError(err.message || 'โหลดประวัติการตรวจสอบการชำระเงินไม่สำเร็จ');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHq, selectedConfig?.id]);

  const summary = useMemo(() => {
    return configs.reduce(
      (acc, config) => {
        acc.total += 1;
        if (config.isActive) {
          acc.active += 1;
        }
        if (config.provider === 'promptpay_manual') {
          acc.manualPromptPay += 1;
        }
        if (config.capabilities?.supportsSliplessConfirmation) {
          acc.slipless += 1;
        }
        return acc;
      },
      {
        total: 0,
        active: 0,
        manualPromptPay: 0,
        slipless: 0,
      }
    );
  }, [configs]);

  const canEdit = (!isHq || Boolean(branchId)) && !(selectedConfig?.isLocked && !isHq);

  async function refreshGovernance(selectedConfigId?: string) {
    if (!isHq) {
      return;
    }

    const governanceData = await api.fetchPaymentGovernanceOverview();
    setGovernance(governanceData);

    const targetId = selectedConfigId ?? selectedConfig?.id;
    if (targetId) {
      const audit = await api.fetchPaymentConfigAudit(targetId);
      setAuditEntries(audit.entries);
    }
  }

  async function handleSave() {
    if (!branchId) {
      setError('กรุณาเลือกสาขาก่อนแก้ไขการตั้งค่าการชำระเงิน');
      return;
    }

    if (!draft.displayName.trim() || !draft.promptPayId.trim() || !draft.promptPayName.trim()) {
      setError('กรุณากรอกชื่อที่แสดง รหัส PromptPay และชื่อ PromptPay ให้ครบ');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        mode: draft.mode,
        provider: draft.provider,
        isActive: draft.isActive,
        displayName: draft.displayName.trim(),
        statementName: draft.statementName.trim() || null,
        credentials: [
          { key: 'promptpay_id', value: draft.promptPayId.trim(), isSecret: false },
          { key: 'promptpay_name', value: draft.promptPayName.trim(), isSecret: false },
        ],
        capabilities: {
          supportsReferenceBinding: draft.supportsReferenceBinding,
          supportsSliplessConfirmation: draft.supportsSliplessConfirmation,
        } satisfies Partial<BranchPaymentCapabilityRecord>,
      };

      const nextConfig = selectedConfig
        ? await api.updateBranchPaymentConfig(selectedConfig.id, payload)
        : await api.createBranchPaymentConfig({
            branchId,
            settlementOwnerType: isHq ? 'hq' : 'franchisee',
            ...payload,
          });

      setConfigs((current) => {
        const withoutCurrent = current.filter((config) => config.id !== nextConfig.id);
        return [...withoutCurrent, nextConfig].sort((a, b) => a.branchId.localeCompare(b.branchId));
      });
      setDraft(buildDraft(nextConfig));
      await refreshGovernance(nextConfig.id);
      setSuccess(isHq ? 'บันทึกการตั้งค่าการชำระเงินสำเร็จ' : 'บันทึกการตั้งค่าแล้วและส่งให้ HQ ตรวจสอบเรียบร้อย');
    } catch (err: any) {
      setError(err.message || 'บันทึกการตั้งค่าการชำระเงินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivation() {
    if (!selectedConfig) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const nextConfig = await api.setBranchPaymentConfigActivation(selectedConfig.id, !selectedConfig.isActive);
      setConfigs((current) => current.map((config) => (config.id === nextConfig.id ? nextConfig : config)));
      setDraft(buildDraft(nextConfig));
      await refreshGovernance(nextConfig.id);
      setSuccess(nextConfig.isActive ? 'เปิดใช้งานการตั้งค่าการชำระเงินแล้ว' : 'ปิดใช้งานการตั้งค่าการชำระเงินแล้ว');
    } catch (err: any) {
      setError(err.message || 'อัปเดตสถานะการตั้งค่าการชำระเงินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleGovernanceUpdate(payload: Partial<{ isLocked: boolean; approvalStatus: BranchPaymentApprovalStatus }>) {
    if (!selectedConfig) {
      return;
    }

    try {
      setGovernanceBusy(true);
      setError(null);
      const nextConfig = await api.updatePaymentConfigGovernance(selectedConfig.id, payload);
      setConfigs((current) => current.map((config) => (config.id === nextConfig.id ? nextConfig : config)));
      await refreshGovernance(nextConfig.id);
      setSuccess('อัปเดตสถานะการกำกับดูแลสำเร็จ');
    } catch (err: any) {
      setError(err.message || 'อัปเดตการกำกับดูแลไม่สำเร็จ');
    } finally {
      setGovernanceBusy(false);
    }
  }

  return (
    <div className="max-w-[1480px] space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">ตั้งค่าการชำระเงินสาขา</h2>
          <p className="mt-1 text-sm text-gray-500">
            ตั้งค่าปลายทางการรับเงินของแต่ละสาขา แล้วให้ HQ ตรวจสอบ อนุมัติ และล็อกค่าที่พร้อมใช้งานจริง
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="รายการตั้งค่า" value={summary.total} />
          <SummaryCard label="เปิดใช้งาน" value={summary.active} />
          <SummaryCard label="พร้อมเพย์แบบกำหนดเอง" value={summary.manualPromptPay} />
          <SummaryCard label="พร้อมยืนยันอัตโนมัติ" value={summary.slipless} />
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div>}

      {isHq && governance && (
        <section className="gradient-card rounded-[28px] p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500">การกำกับดูแลจาก HQ</p>
              <h3 className="text-xl font-bold text-white">ความพร้อมของระบบรับชำระทั้งเครือข่าย</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard label="อนุมัติแล้ว" value={governance.summary.approved} />
              <SummaryCard label="รอตรวจสอบ" value={governance.summary.pendingReview} />
              <SummaryCard label="ล็อกแล้ว" value={governance.summary.locked} />
              <SummaryCard label="พร้อมใช้งาน" value={governance.summary.ready} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                <tr>
                  <th className="px-3 py-3">สาขา</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-3 py-3">การล็อก</th>
                  <th className="px-3 py-3">โหมด</th>
                  <th className="px-3 py-3">ความพร้อม</th>
                </tr>
              </thead>
              <tbody>
                {governance.items.map((item) => (
                  <tr key={item.config.id} className="border-t border-white/5 text-gray-200">
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium text-white">{item.config.branch.shortName || item.config.branch.name}</p>
                        <p className="text-xs text-gray-500">{item.config.displayName}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${getStatusTone(item.config.approvalStatus)}`}>
                        {getApprovalStatusLabel(item.config.approvalStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">{item.config.isLocked ? 'ล็อกแล้ว' : 'แก้ไขได้'}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{item.config.mode}</td>
                    <td className="px-3 py-3 text-xs text-gray-400">{item.readiness.ready ? 'พร้อมใช้งาน' : 'ต้องติดตามต่อ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <div className="gradient-card rounded-[28px] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500">การตั้งค่ารายสาขา</p>
                  <h3 className="text-xl font-bold text-white">รายการปลายทางรับชำระเงิน</h3>
                </div>
              </div>

            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    branchId === config.branchId ? 'border-red-500/30 bg-red-500/10' : 'border-white/5 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{config.branch.shortName || config.branch.name}</p>
                      <p className="text-xs text-gray-500">{config.displayName}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${
                          config.isActive
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-gray-400'
                        }`}
                      >
                        {config.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${getStatusTone(config.approvalStatus)}`}>
                        {getApprovalStatusLabel(config.approvalStatus)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-gray-400">
                    <p>โหมด: {config.mode}</p>
                    <p>ผู้ให้บริการ: {config.provider}</p>
                    <p>รหัส PromptPay: {getCredentialValue(config, 'promptpay_id') || 'ยังไม่ระบุ'}</p>
                    <p>การล็อกจาก HQ: {config.isLocked ? 'เปิดอยู่' : 'ปิดอยู่'}</p>
                  </div>
                </div>
              ))}

              {!configs.length && !loading && (
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-sm text-gray-500">
                  ไม่พบการตั้งค่าการชำระเงินในขอบเขตปัจจุบัน
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="gradient-card rounded-[28px] p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                  <Settings2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500">แบบฟอร์มปลายทางรับเงิน</p>
                  <h3 className="text-xl font-bold text-white">
                    {selectedBranch ? `ตั้งค่า ${selectedBranch.shortName || selectedBranch.name}` : 'เลือกสาขาเพื่อแก้ไขการตั้งค่าการชำระเงิน'}
                  </h3>
                </div>
              </div>
              {selectedConfig && (
                <button
                  onClick={() => void handleToggleActivation()}
                  disabled={saving || !canEdit}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  {selectedConfig.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                </button>
              )}
            </div>

            {isHq && !branchId && (
              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                เลือกสาขาจากแถบด้านบนเพื่อแก้ไขการตั้งค่าการชำระเงินหรือควบคุมการกำกับดูแล
              </div>
            )}

            {!isHq && selectedConfig?.isLocked && (
              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                การตั้งค่านี้ถูกล็อกโดย HQ กรุณาติดต่อ HQ เพื่อปลดล็อกก่อนแก้ไขจากฝั่งสาขา
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ชื่อที่แสดง" value={draft.displayName} onChange={(value) => setDraft((current) => ({ ...current, displayName: value }))} disabled={!canEdit} />
              <Field label="ชื่อบนรายการเดินบัญชี" value={draft.statementName} onChange={(value) => setDraft((current) => ({ ...current, statementName: value }))} disabled={!canEdit} />

              <SelectField
                label="โหมด"
                value={draft.mode}
                onChange={(value) => setDraft((current) => ({ ...current, mode: value as BranchPaymentMode }))}
                disabled={!canEdit}
                options={[
                  { value: 'manual_promptpay', label: 'manual_promptpay' },
                  { value: 'branch_managed', label: 'จัดการโดยสาขา' },
                  { value: 'hq_managed', label: 'จัดการโดย HQ' },
                ]}
              />

              <SelectField
                label="ผู้ให้บริการ"
                value={draft.provider}
                onChange={(value) => setDraft((current) => ({ ...current, provider: value as BranchPaymentProvider }))}
                disabled={!canEdit}
                options={[
                  { value: 'promptpay_manual', label: 'promptpay_manual' },
                  { value: 'custom', label: 'custom' },
                  { value: 'bank_qr', label: 'bank_qr' },
                  { value: 'opn', label: 'opn' },
                  { value: 'stripe', label: 'stripe' },
                ]}
              />

              <Field label="รหัส PromptPay" value={draft.promptPayId} onChange={(value) => setDraft((current) => ({ ...current, promptPayId: value }))} disabled={!canEdit} />
              <Field label="ชื่อ PromptPay" value={draft.promptPayName} onChange={(value) => setDraft((current) => ({ ...current, promptPayName: value }))} disabled={!canEdit} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <ToggleRow
                label="เปิดใช้งานการตั้งค่า"
                description="ใช้ค่าชุดนี้เป็นปลายทางรับชำระเงินจริงของสาขา"
                checked={draft.isActive}
                disabled={!canEdit}
                onChange={(checked) => setDraft((current) => ({ ...current, isActive: checked }))}
              />
              <ToggleRow
                label="ผูกเลขอ้างอิงกับรอบล้าง"
                description="เชื่อมเลขอ้างอิงของผู้ให้บริการกลับไปยังรอบล้างเพื่อใช้กระทบยอด"
                checked={draft.supportsReferenceBinding}
                disabled={!canEdit}
                onChange={(checked) => setDraft((current) => ({ ...current, supportsReferenceBinding: checked }))}
              />
              <ToggleRow
                label="ยืนยันอัตโนมัติแบบไม่ใช้สลิป"
                description="เตรียมสาขาให้รองรับการยืนยันอัตโนมัติโดยไม่ต้องอัปโหลดสลิป"
                checked={draft.supportsSliplessConfirmation}
                disabled={!canEdit}
                onChange={(checked) => setDraft((current) => ({ ...current, supportsSliplessConfirmation: checked }))}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void handleSave()}
                disabled={!canEdit || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'กำลังบันทึก...' : selectedConfig ? 'อัปเดตการตั้งค่าการชำระเงิน' : 'สร้างการตั้งค่าการชำระเงิน'}
              </button>
              <span className="text-xs text-gray-500">
                เมื่อสาขาแก้ไขข้อมูล ระบบจะส่งกลับไปอยู่สถานะรอตรวจสอบจนกว่า HQ จะอนุมัติอีกครั้ง
              </span>
            </div>
          </div>

          <div className="gradient-card rounded-[28px] p-6">
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-white" />
              <h3 className="text-lg font-bold text-white">เช็กลิสต์ความพร้อม</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ChecklistRow label="มีการตั้งค่าการชำระเงินแล้ว" ready={Boolean(selectedConfig)} />
              <ChecklistRow label="ระบุรหัส PromptPay แล้ว" ready={Boolean(draft.promptPayId.trim())} />
              <ChecklistRow label="ระบุชื่อ PromptPay แล้ว" ready={Boolean(draft.promptPayName.trim())} />
              <ChecklistRow label="เปิดใช้งานแล้ว" ready={draft.isActive} />
              <ChecklistRow label="เปิดผูกเลขอ้างอิงแล้ว" ready={draft.supportsReferenceBinding} />
              <ChecklistRow label="เตรียมยืนยันอัตโนมัติแล้ว" ready={draft.supportsSliplessConfirmation} />
              {selectedConfig && <ChecklistRow label="HQ อนุมัติแล้ว" ready={selectedConfig.approvalStatus === 'approved'} />}
              {selectedConfig && <ChecklistRow label="HQ ล็อกการตั้งค่าแล้ว" ready={selectedConfig.isLocked} />}
            </div>
          </div>

          {isHq && selectedConfig && (
            <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.05fr)]">
              <div className="gradient-card rounded-[28px] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-white" />
                  <h3 className="text-lg font-bold text-white">ตัวควบคุมการกำกับดูแล</h3>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-sm text-white">สถานะปัจจุบัน</p>
                    <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${getStatusTone(selectedConfig.approvalStatus)}`}>
                      {getApprovalStatusLabel(selectedConfig.approvalStatus)}
                    </p>
                    {selectedConfig.approvedAt && (
                      <p className="mt-2 text-xs text-gray-500">อนุมัติเมื่อ {new Date(selectedConfig.approvedAt).toLocaleString()}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <button
                      onClick={() => void handleGovernanceUpdate({ approvalStatus: 'approved' })}
                      disabled={governanceBusy}
                      className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => void handleGovernanceUpdate({ approvalStatus: 'pending_review' })}
                      disabled={governanceBusy}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-60"
                    >
                      ส่งกลับไปตรวจสอบ
                    </button>
                    <button
                      onClick={() => void handleGovernanceUpdate({ approvalStatus: 'rejected' })}
                      disabled={governanceBusy}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-60"
                    >
                      ไม่อนุมัติ
                    </button>
                    <button
                      onClick={() => void handleGovernanceUpdate({ isLocked: !selectedConfig.isLocked })}
                      disabled={governanceBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {selectedConfig.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {selectedConfig.isLocked ? 'ปลดล็อกการตั้งค่า' : 'ล็อกการตั้งค่า'}
                    </button>
                  </div>

                  {selectedGovernance && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-xs text-gray-400">
                      <p>พร้อมนำขึ้นใช้งาน: {selectedGovernance.readiness.ready ? 'ใช่' : 'ไม่'}</p>
                      <p className="mt-1">รหัส PromptPay: {selectedGovernance.readiness.hasPromptPayId ? 'มีแล้ว' : 'ยังไม่มี'}</p>
                      <p className="mt-1">ชื่อ PromptPay: {selectedGovernance.readiness.hasPromptPayName ? 'มีแล้ว' : 'ยังไม่มี'}</p>
                      <p className="mt-1">การผูกเลขอ้างอิง: {selectedGovernance.readiness.supportsReferenceBinding ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="gradient-card rounded-[28px] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-white" />
                  <h3 className="text-lg font-bold text-white">ประวัติการเปลี่ยนแปลง</h3>
                </div>

                <div className="space-y-3">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-white">{entry.action}</p>
                          <p className="text-xs text-gray-500">
                            {entry.adminUser ? `${entry.adminUser.name} (${entry.adminUser.role})` : entry.actorType}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                      {formatAuditMetadata(entry.metadata) && (
                        <p className="mt-2 text-xs text-gray-400">{formatAuditMetadata(entry.metadata)}</p>
                      )}
                    </div>
                  ))}

                  {!auditEntries.length && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm text-gray-500">
                      ยังไม่มีประวัติการเปลี่ยนแปลงสำหรับการตั้งค่านี้
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-400">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20 disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-400">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 text-sm text-white focus:border-red-500/50 focus:outline-none disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div>
        <p className="font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500 disabled:opacity-50"
      />
    </label>
  );
}

function ChecklistRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <CheckCircle2 className={`h-4 w-4 ${ready ? 'text-emerald-300' : 'text-gray-600'}`} />
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-gray-500">{ready ? 'พร้อม' : 'รอดำเนินการ'}</p>
      </div>
    </div>
  );
}
