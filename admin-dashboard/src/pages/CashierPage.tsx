import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Camera,
  CheckCircle2,
  CreditCard,
  Loader2,
  ReceiptText,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import api, {
  type AdminPackageRecord,
  type AdminUser,
  type BranchOption,
  type MachineRecord,
  type PaymentRecord,
} from '@/services/api';

interface CashierPageProps {
  admin: AdminUser;
  branchId: string | null;
  branches: BranchOption[];
}

type CarSize = 'S' | 'M' | 'L';
type PaymentMethod = 'cash' | 'manual';

const carSizes: Array<{ value: CarSize; label: string }> = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
];

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'cash', label: 'เงินสด / Cash', icon: Banknote },
  { value: 'manual', label: 'โอน / Slip', icon: CreditCard },
];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatMoney(value: number) {
  return `${value.toLocaleString()} บาท`;
}

function getPricesForBranch(pkg: AdminPackageRecord, branchId: string) {
  return pkg.branchConfigs.find((config) => config.branchId === branchId)?.effectivePrices ?? pkg.prices;
}

function getCashierReadyMachines(machineData: MachineRecord[]) {
  return machineData.filter((machine) => machine.isEnabled && machine.status === 'idle' && !machine.currentSessionId);
}

function getCashierErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Machine already has an active session') {
    return 'เครื่องนี้มีรอบล้างค้างอยู่ กรุณาเลือกเครื่องที่ว่าง หรือปิดรอบเดิมในเมนูรอบล้างก่อน';
  }
  if (message === 'Machine is not available') {
    return 'เครื่องนี้ยังไม่พร้อมใช้งาน กรุณาเลือกเครื่องสถานะว่าง';
  }
  return message || 'ยืนยันรายการไม่สำเร็จ';
}

export function CashierPage({ admin, branchId, branches }: CashierPageProps) {
  const availableBranches = useMemo(
    () => branches.filter((branch) => branch.isActive && (admin.role === 'hq_admin' || admin.branchIds.includes(branch.id))),
    [admin.branchIds, admin.role, branches]
  );

  const initialBranchId = branchId ?? availableBranches[0]?.id ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [packages, setPackages] = useState<AdminPackageRecord[]>([]);
  const [machineId, setMachineId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [carSize, setCarSize] = useState<CarSize>('M');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [note, setNote] = useState('');
  const [receiptImage, setReceiptImage] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (branchId) {
      setSelectedBranchId(branchId);
    } else if (!selectedBranchId && availableBranches[0]) {
      setSelectedBranchId(availableBranches[0].id);
    }
  }, [availableBranches, branchId, selectedBranchId]);

  useEffect(() => {
    if (!selectedBranchId) {
      return;
    }

    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      api.fetchMachines({ branchId: selectedBranchId }),
      api.fetchAdminPackages({ branchId: selectedBranchId, includeInactive: false }),
    ])
      .then(([machineData, packageData]) => {
        if (cancelled) return;
        const enabledMachines = getCashierReadyMachines(machineData);
        const sellablePackages = packageData.filter((item) =>
          item.branchConfigs.some((config) => config.branchId === selectedBranchId && config.isActive && config.isVisible)
        );
        setMachines(enabledMachines);
        setPackages(sellablePackages);
        setMachineId((current) => (enabledMachines.some((machine) => machine.id === current) ? current : enabledMachines[0]?.id ?? ''));
        setPackageId((current) => (sellablePackages.some((item) => item.id === current) ? current : sellablePackages[0]?.id ?? ''));
        setError(null);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || 'โหลดข้อมูลแคชเชียร์ไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBranchId]);

  const selectedPackage = packages.find((item) => item.id === packageId) ?? null;
  const selectedMachine = machines.find((item) => item.id === machineId) ?? null;
  const selectedPrices = selectedPackage ? getPricesForBranch(selectedPackage, selectedBranchId) : null;
  const expectedPrice = selectedPrices?.[carSize] ?? 0;

  useEffect(() => {
    if (expectedPrice > 0) {
      setAmount(expectedPrice);
    }
  }, [expectedPrice]);

  async function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 1_000_000) {
      setError('รูปหลักฐานใหญ่เกินไป กรุณาใช้รูปไม่เกิน 1MB');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setReceiptImage(dataUrl);
    setReceiptName(file.name);
    setError(null);
  }

  function resetForm() {
    setCustomerName('');
    setCustomerPhone('');
    setLineUserId('');
    setNote('');
    setReceiptImage('');
    setReceiptName('');
    setPaymentMethod('cash');
    setAmount(expectedPrice);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBranchId || !machineId || !packageId || amount <= 0) {
      setError('กรุณาเลือกสาขา เครื่อง แพ็กเกจ และยอดเงินให้ครบ');
      return;
    }

    setSaving(true);
    setSuccessPayment(null);
    try {
      const payment = await api.createCashierPayment({
        branchId: selectedBranchId,
        machineId,
        packageId,
        carSize,
        amount,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        lineUserId: lineUserId.trim() || undefined,
        receiptImage: receiptImage || undefined,
        note: note.trim() || undefined,
      });
      setSuccessPayment(payment);
      resetForm();
      const nextMachines = await api.fetchMachines({ branchId: selectedBranchId });
      const nextEnabledMachines = getCashierReadyMachines(nextMachines);
      setMachines(nextEnabledMachines);
      setMachineId(nextEnabledMachines[0]?.id ?? '');
      setError(null);
    } catch (err: any) {
      setError(getCashierErrorMessage(err));
      const nextMachines = await api.fetchMachines({ branchId: selectedBranchId }).catch(() => null);
      if (nextMachines) {
        const nextEnabledMachines = getCashierReadyMachines(nextMachines);
        setMachines(nextEnabledMachines);
        setMachineId((current) => (nextEnabledMachines.some((machine) => machine.id === current) ? current : nextEnabledMachines[0]?.id ?? ''));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-700">Cashier</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">รับเงินหน้าร้าน</h2>
          <p className="mt-1 text-sm text-slate-600">Cash in, take photo, confirm.</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">
          สร้างรายการแบบยืนยันแล้ว พร้อม audit log
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {successPayment && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5" />
            ยืนยันแล้ว {successPayment.reference}
          </div>
          <p className="mt-1">
            {successPayment.session.user.displayName} • {successPayment.session.machine.name} • {formatMoney(successPayment.amount)}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_rgba(148,163,184,0.13)] sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">รายการล้าง</h3>
              <p className="text-xs text-slate-500">Service / Machine / Price</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="สาขา / Branch">
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="input"
              >
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.shortName || branch.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="เครื่อง / Machine">
              <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className="input">
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.code} • {machine.name} • ว่าง
                  </option>
                ))}
              </select>
              {!loadingOptions && machines.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  ไม่มีเครื่องว่างในสาขานี้ ตอนนี้เครื่องที่มีรอบค้าง/กำลังล้างจะไม่ให้รับเงินซ้ำ
                </p>
              )}
            </Field>
          </div>

          <Field label="แพ็กเกจ / Package">
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((item) => {
                const active = item.id === packageId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPackageId(item.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active ? 'border-red-300 bg-red-50 shadow-sm' : 'border-slate-200 bg-white hover:border-red-200'
                    }`}
                  >
                    <p className="font-black text-slate-950">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.code}</p>
                    <p className="mt-3 text-sm font-bold text-red-700">
                      M {formatMoney(getPricesForBranch(item, selectedBranchId).M)}
                    </p>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <Field label="ขนาดรถ / Size">
              <div className="grid grid-cols-3 gap-2">
                {carSizes.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setCarSize(size.value)}
                    className={`h-12 rounded-2xl border text-lg font-black ${
                      carSize === size.value ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="ยอดรับจริง / Amount">
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <input
                  type="number"
                  min={1}
                  value={amount || ''}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="input text-xl font-black sm:text-2xl"
                />
                <button
                  type="button"
                  onClick={() => setAmount(expectedPrice)}
                  className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-700"
                >
                  ราคาเต็ม
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">ราคาตามระบบ {formatMoney(expectedPrice)}</p>
            </Field>
          </div>
        </section>

        <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_rgba(148,163,184,0.13)] sm:rounded-3xl sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">ลูกค้าและหลักฐาน</h3>
              <p className="text-xs text-slate-500">Customer / Evidence</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า">
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="input" placeholder="Walk-in Customer" />
            </Field>
            <Field label="เบอร์โทร">
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="input" placeholder="08xxxxxxxx" />
            </Field>
          </div>

          <Field label="LINE user id ถ้ามี">
            <input value={lineUserId} onChange={(event) => setLineUserId(event.target.value)} className="input" placeholder="เว้นว่างได้" />
          </Field>

          <Field label="วิธีรับเงิน">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black ${
                      paymentMethod === method.value ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="รูปสลิป / หลักฐาน">
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50/50 p-4 text-center transition hover:bg-red-50">
              <Camera className="h-8 w-8 text-red-600" />
              <span className="mt-2 text-sm font-bold text-slate-900">{receiptName || 'ถ่ายรูปหรือเลือกรูป'}</span>
              <span className="mt-1 text-xs text-slate-500">JPG / PNG ไม่เกิน 1MB</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="hidden" />
            </label>
            {receiptImage && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <img src={receiptImage} alt="receipt preview" className="max-h-48 w-full object-cover" />
              </div>
            )}
          </Field>

          <Field label="หมายเหตุ">
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input min-h-20 resize-none" placeholder="เช่น ลูกค้าจ่ายเงินสดหน้าเคาน์เตอร์" />
          </Field>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Summary label="เครื่อง" value={selectedMachine?.code || '-'} />
              <Summary label="ยอดรับ" value={formatMoney(amount || 0)} />
              <Summary label="สถานะ" value="ยืนยันทันที" />
              <Summary label="รอบล้าง" value="พร้อมเริ่ม" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 sm:gap-3">
            <button
              type="submit"
              disabled={saving || loadingOptions || !machineId || !packageId || amount <= 0}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-black text-white shadow-lg shadow-red-500/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              ยืนยันรับเงิน
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-700"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}
