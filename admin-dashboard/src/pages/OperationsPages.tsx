import React, { useEffect, useState } from 'react';
import type { AdminUser } from '../services/api';
import { operations, query, type PageResult, type PointsCustomer, type PointEntry, type AuditEntry, type PlanDraft, type PlanRecord, type ContentDraft, type ContentRecord } from '../services/operations';
import '../styles/operations.css';

function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    if (!path) { setLoading(false); return; }
    setLoading(true);
    operations.get<T>(path).then(value => { if (!cancelled) setData(value); }).catch(err => { if (!cancelled) setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, revision]);
  return { data, error, loading, reload: () => setRevision(n => n + 1) };
}
function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return <>{loading && <p className="ops-message" role="status">กำลังโหลดข้อมูล…</p>}{error && <div className="ops-message" role="alert"><p>{error}</p><button type="button" onClick={retry}>ลองใหม่</button></div>}</>;
}
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (n: number) => void }) {
  return <nav className="ops-toolbar" aria-label="แบ่งหน้ารายการ"><span>{total.toLocaleString()} รายการ · หน้า {page} / {Math.max(1, Math.ceil(total / 25))}</span><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>ก่อนหน้า</button><button type="button" disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>ถัดไป</button></nav>;
}
function Search({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <form className="ops-toolbar" onSubmit={e => { e.preventDefault(); onSearch(value.trim()); }}><label className="ops-search">ค้นหารายการ<input type="search" value={value} onChange={e => setValue(e.target.value)} maxLength={120} /></label><button type="submit">ค้นหา</button></form>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="ops-field"><span>{label}</span>{children}</label>; }
const date = (value: string) => new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

export function PointsManagementPage({ admin, branchId }: { admin: AdminUser; branchId: string | null }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [selected, setSelected] = useState<PointsCustomer | null>(null);
  const list = useData<PageResult<PointsCustomer>>(query('points', { page, search, branchId }));
  const [historyPage, setHistoryPage] = useState(1);
  const history = useData<PageResult<PointEntry>>(selected ? query(`points/${encodeURIComponent(selected.id)}/history`, { branchId, page: historyPage }) : null);
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => { setPage(1); setSelected(null); }, [branchId]);
  function resetAttempt() { setRequestId(crypto.randomUUID()); setConfirmed(false); setError(''); setMessage(''); }
  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    if (!Number.isInteger(Number(amount)) || Number(amount) === 0 || !confirmed) { setError('ระบุจำนวนเต็มที่ไม่ใช่ศูนย์ และยืนยันการปรับยอด'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await operations.adjustPoints(selected.id, { amount: Number(amount), reason, requestId });
      setSelected({ ...selected, wallet: { balance: result.data.balanceAfter, lifetimeEarned: selected.wallet?.lifetimeEarned ?? 0, lifetimeRedeemed: selected.wallet?.lifetimeRedeemed ?? 0 } });
      setMessage(`บันทึกแล้ว · ยอดคงเหลือ ${result.data.balanceAfter.toLocaleString()} พ้อยท์`);
      setAmount(''); setReason(''); setConfirmed(false); setRequestId(crypto.randomUUID()); list.reload(); history.reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'ปรับพ้อยท์ไม่สำเร็จ'); } finally { setBusy(false); }
  }
  return <div className="ops-page"><h1>พ้อยท์ลูกค้า</h1><p className="ops-muted">ยอดกระเป๋าพ้อยท์เป็นยอดรวมของลูกค้า การปรับยอดทำได้เฉพาะสำนักงานใหญ่และต้องระบุเหตุผล</p>
    <Search onSearch={value => { setSearch(value); setPage(1); }} /><Status {...list} retry={list.reload} />
{list.data && <><div className="ops-table"><table><thead><tr><th>ลูกค้า</th><th>พ้อยท์คงเหลือ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{list.data.data.map(user => <tr key={user.id}><td data-label="ลูกค้า"><strong>{user.displayName}</strong><small>{user.phone || 'ไม่ระบุเบอร์โทร'}</small></td><td data-label="พ้อยท์">{(user.wallet?.balance ?? 0).toLocaleString()}</td><td data-label="สถานะ">{user.isActive ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}</td><td><button type="button" disabled={busy} onClick={() => { setSelected(user); setHistoryPage(1); setAmount(''); setReason(''); resetAttempt(); }}>ดูประวัติ</button></td></tr>)}</tbody></table></div>{!list.data.data.length && <p className="ops-empty">ไม่พบลูกค้า ลองเปลี่ยนคำค้นหรือสาขา</p>}<Pager page={page} total={list.data.total} onPage={setPage} /></>}
    {selected && <section className="ops-panel"><div className="ops-toolbar"><h2>{selected.displayName}</h2><button type="button" disabled={busy} onClick={() => setSelected(null)}>ปิดรายละเอียด</button></div><p>คงเหลือ {(selected.wallet?.balance ?? 0).toLocaleString()} พ้อยท์</p>
      {admin.role === 'hq_admin' && selected.isActive && <form onSubmit={adjust} className="ops-form" aria-busy={busy}>
        <div className="ops-grid"><Field label="จำนวนพ้อยท์ (+ เพิ่ม / − ลด)"><input type="number" required min={-1000000} max={1000000} step={1} value={amount} disabled={busy} onChange={e => { setAmount(e.target.value); resetAttempt(); }} /></Field><Field label="เหตุผลการปรับ (อย่างน้อย 5 ตัวอักษร)"><input required minLength={5} maxLength={500} value={reason} disabled={busy} onChange={e => { setReason(e.target.value); resetAttempt(); }} /></Field></div>
        <label className="ops-check"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />ยืนยันปรับ {amount || '0'} พ้อยท์ให้ลูกค้ารายนี้</label>
        <p className="ops-muted">การปรับนี้ไม่เพิ่มยอดสะสมตลอดชีพหรือเปลี่ยนระดับสมาชิก</p><button className="ops-primary" disabled={busy} type="submit">{busy ? 'กำลังบันทึก…' : 'บันทึกการปรับ'}</button>
      </form>}
      {error && <p role="alert" className="ops-message">{error}</p>}{message && <p role="status" className="ops-message">{message}</p>}
      <h2>ประวัติพ้อยท์</h2><p className="ops-muted">{admin.role === 'hq_admin' && !branchId ? 'ทุกรายการของลูกค้า' : 'เฉพาะรายการที่ระบุสาขาในขอบเขตที่เลือก'}</p><Status {...history} retry={history.reload} />
      {history.data && <><div className="ops-list">{history.data.data.map(item => <article key={item.id}><strong>{item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} พ้อยท์</strong><p>{item.description}</p><small>{date(item.createdAt)} · คงเหลือ {item.balanceAfter.toLocaleString()}</small></article>)}</div>{!history.data.data.length && <p className="ops-empty">ยังไม่มีรายการในขอบเขตนี้</p>}<Pager page={historyPage} total={history.data.total} onPage={setHistoryPage} /></>}
    </section>}
  </div>;
}

export function AuditLogsPage({ branchId }: { branchId: string | null }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState('');
  const list = useData<PageResult<AuditEntry>>(query('audit-logs', { page, search, branchId }));
  useEffect(() => setPage(1), [branchId]);
  return <div className="ops-page"><h1>ประวัติการทำรายการ</h1><p className="ops-muted">ค้นหาชื่อการทำรายการหรือรหัสข้อมูล ประวัตินี้อ่านอย่างเดียวและแสดงตามสิทธิ์สาขา</p><Search onSearch={value => { setSearch(value); setPage(1); }} /><Status {...list} retry={list.reload} />
    {list.data && <><div className="ops-table"><table><thead><tr><th>เวลา / ผู้ทำรายการ</th><th>การทำรายการ</th><th>สาขา</th><th>ข้อมูลอ้างอิง</th></tr></thead><tbody>{list.data.data.map(item => <tr key={item.id}><td data-label="เวลา"><strong>{date(item.createdAt)}</strong><small>{item.adminUser?.name || item.actorType}</small></td><td data-label="รายการ">{item.action}</td><td data-label="สาขา">{item.branch?.name || 'ส่วนกลาง'}</td><td data-label="อ้างอิง"><span>{item.entityType}</span><small>{item.entityId || '—'}</small></td></tr>)}</tbody></table></div>{!list.data.data.length && <p className="ops-empty">ไม่พบประวัติที่ตรงกับตัวกรอง</p>}<Pager page={page} total={list.data.total} onPage={setPage} /></>}
  </div>;
}

const emptyPlan: PlanDraft = { code: '', name: '', description: '', price: 1, durationMonths: 6, group: 'bundle', washLimit: 1, grapheneLimit: 0, freeVacuumPerVisit: false, vipFastLane: false, isActive: false, sortOrder: 0 };
export function MembershipPlansPage() {
  const list = useData<{ data: PlanRecord[] }>('/api/admin/membership-plans');
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan), [showForm, setShowForm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await operations.createPlan(draft); setDraft(emptyPlan); setShowForm(false); list.reload(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function toggle(plan: PlanRecord) { if (busy) return; setBusy(true); setError(''); try { await operations.activatePlan(plan.id, !plan.isActive); list.reload(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <div className="ops-page"><h1>แผนสมาชิก</h1><p className="ops-muted">สร้างราคาและสิทธิ์สำหรับการขายครั้งใหม่ ปิดการขายได้โดยไม่กระทบสมาชิกเดิม หากต้องเปลี่ยนสิทธิ์ให้สร้างแผนใหม่</p><button type="button" disabled={busy} onClick={() => { setShowForm(!showForm); setError(''); }}>{showForm ? 'ปิดฟอร์ม' : 'สร้างแผนใหม่'}</button>{error && <p role="alert" className="ops-message">{error}</p>}
    {showForm && <form onSubmit={save} className="ops-panel ops-form" aria-busy={busy}><h2>รายละเอียดแผนใหม่</h2><fieldset disabled={busy}>
      <div className="ops-grid"><Field label="รหัสแผน (ห้ามซ้ำ)"><input required pattern="[A-Za-z0-9_-]{2,64}" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} /></Field><Field label="ชื่อแผน"><input required maxLength={160} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field></div>
      <Field label="ประเภทแผน"><select value={draft.group} onChange={e => setDraft({ ...draft, group: e.target.value as PlanDraft['group'] })}><option value="bundle">แพ็กเกจจำนวนครั้ง</option><option value="membership">สมาชิก</option><option value="motorcycle">มอเตอร์ไซค์</option></select></Field>
      <Field label="คำอธิบายสิทธิ์"><textarea maxLength={2000} value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
      <div className="ops-grid">{([{ key: 'durationMonths', label: 'อายุสิทธิ์ (เดือน)', min: 1, max: 60 }, { key: 'price', label: 'ราคา (บาท)', min: 1, max: 1000000 }, { key: 'washLimit', label: 'จำนวนล้าง', min: 1, max: 10000 }, { key: 'grapheneLimit', label: 'จำนวนเคลือบ', min: 0, max: draft.washLimit }, { key: 'sortOrder', label: 'ลำดับแสดง', min: 0, max: 10000 }] as const).map(f => <Field key={f.key} label={f.label}><input type="number" required min={f.min} max={f.max} step={1} value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: Number(e.target.value) })} /></Field>)}</div>
      {([{ key: 'freeVacuumPerVisit', label: 'ดูดฝุ่นฟรีต่อครั้ง' }, { key: 'vipFastLane', label: 'สิทธิ์คิว VIP' }, { key: 'isActive', label: 'เปิดขายในแอปลูกค้าทันที' }] as const).map(f => <label className="ops-check" key={f.key}><input type="checkbox" checked={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.checked })} />{f.label}</label>)}
      <button type="submit" className="ops-primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'สร้างแผน'}</button>
    </fieldset></form>}
    <Status {...list} retry={list.reload} />{list.data && <div className="ops-list">{list.data.data.map(plan => <article key={plan.id}><div className="ops-toolbar"><h2>{plan.name}</h2><span>{plan.isActive ? 'เปิดขาย' : 'ปิดขาย'}</span><button type="button" disabled={busy} onClick={() => void toggle(plan)}>{plan.isActive ? 'ปิดการขาย' : 'เปิดการขาย'}</button></div><p>{plan.price.toLocaleString()} บาท · ล้าง {plan.washLimit} ครั้ง · เคลือบ {plan.grapheneLimit} ครั้ง</p><p className="ops-muted">{plan.description}</p><small>{plan.code} · สมาชิกที่ซื้อ {plan._count.memberships} รายการ</small></article>)}{!list.data.data.length && <p className="ops-empty">ยังไม่มีแผนสมาชิก กดสร้างแผนใหม่เพื่อเริ่มต้น</p>}</div>}
  </div>;
}

const emptyContent: ContentDraft = { kind: 'faq', slug: '', title: '', body: '', category: 'ทั่วไป', imageUrl: '', isPublished: false, sortOrder: 0 };
interface Redemption { id: string; customerName: string; rewardName: string; amount: number; createdAt: string; status: 'pending' | 'fulfilled'; fulfilledAt: string | null }
export function RewardRedemptionsPage({ branchId }: { branchId: string | null }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState('');
  const list = useData<PageResult<Redemption>>(query('reward-redemptions', { branchId, page, search }));
  const [selected, setSelected] = useState<Redemption | null>(null), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function fulfill(e: React.FormEvent) {
    e.preventDefault(); if (!selected || busy) return; setBusy(true); setError('');
    try { await operations.get(`/api/admin/reward-redemptions/${encodeURIComponent(selected.id)}/fulfill`, { method: 'POST', body: JSON.stringify({ note }) }); setSelected(null); setNote(''); list.reload(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="ops-page"><h1>รายการแลกรางวัล</h1><p className="ops-muted">ตรวจสอบรางวัลที่ลูกค้าใช้พ้อยท์แลก และบันทึกเมื่อส่งมอบแล้ว การยืนยันนี้ไม่หักพ้อยท์ซ้ำและไม่คืนพ้อยท์อัตโนมัติ</p>
    <Search onSearch={value => { setSearch(value); setPage(1); }} /><Status {...list} retry={list.reload} />
    {selected && <form className="ops-panel ops-form" onSubmit={fulfill} aria-busy={busy}><h2>ส่งมอบ {selected.rewardName}</h2><p>ให้ {selected.customerName} · {Math.abs(selected.amount).toLocaleString()} พ้อยท์</p><Field label="หลักฐานหรือหมายเหตุการส่งมอบ"><input required minLength={3} maxLength={500} disabled={busy} value={note} onChange={e => setNote(e.target.value)} /></Field>{error && <p role="alert">{error}</p>}<div className="ops-toolbar"><button className="ops-primary" disabled={busy} type="submit">{busy ? 'กำลังบันทึก…' : 'ยืนยันส่งมอบแล้ว'}</button><button type="button" disabled={busy} onClick={() => setSelected(null)}>ยกเลิก</button></div></form>}
    {list.data && <><div className="ops-list">{list.data.data.map(item => <article key={item.id}><div className="ops-toolbar"><h2>{item.rewardName}</h2><span>{item.status === 'fulfilled' ? 'ส่งมอบแล้ว' : 'รอส่งมอบ'}</span>{item.status === 'pending' && <button type="button" disabled={busy} onClick={() => { setSelected(item); setNote(''); setError(''); }}>ส่งมอบรางวัล</button>}</div><p>{item.customerName} · {Math.abs(item.amount).toLocaleString()} พ้อยท์</p><small>{date(item.createdAt)}{item.fulfilledAt ? ` · ส่งมอบ ${date(item.fulfilledAt)}` : ''}</small></article>)}</div>{!list.data.data.length && <p className="ops-empty">ยังไม่มีรายการแลกรางวัลในขอบเขตนี้</p>}<Pager page={page} total={list.data.total} onPage={setPage} /></>}
  </div>;
}

export function ContentManagementPage() {
  const [page, setPage] = useState(1), [kind, setKind] = useState('faq'), [search, setSearch] = useState('');
  const list = useData<PageResult<ContentRecord>>(query('content', { kind, page, search }));
  const [draft, setDraft] = useState<ContentDraft | null>(null), [existing, setExisting] = useState<ContentRecord | undefined>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function edit(item: ContentRecord) { setExisting(item); setDraft({ kind: item.kind, slug: item.slug, title: item.title, body: item.body, category: item.category, imageUrl: item.imageUrl, sortOrder: item.sortOrder, isPublished: item.isPublished }); setError(''); }
  async function save(e: React.FormEvent) { e.preventDefault(); if (!draft || busy) return; setBusy(true); setError(''); try { await operations.saveContent(draft, existing); setDraft(null); setExisting(undefined); list.reload(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <div className="ops-page"><h1>เนื้อหาในแอป</h1><p className="ops-muted">จัดการคำถามที่พบบ่อยและบทความ บันทึกเป็นฉบับร่างก่อนเผยแพร่ เนื้อหาใช้ข้อความธรรมดาเพื่อความปลอดภัย</p>
    <div className="ops-toolbar"><label>ประเภท<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="faq">คำถามที่พบบ่อย</option><option value="article">บทความ</option></select></label><button type="button" disabled={busy} onClick={() => { setExisting(undefined); setDraft({ ...emptyContent, kind: kind as ContentDraft['kind'] }); setError(''); }}>เพิ่มเนื้อหา</button></div>
    {draft && <form className="ops-panel ops-form" onSubmit={save} aria-busy={busy}><h2>{existing ? 'แก้ไขเนื้อหา' : 'เพิ่มเนื้อหาใหม่'}</h2><fieldset disabled={busy}>
      <div className="ops-grid"><Field label="รหัส URL (ภาษาอังกฤษ)"><input required pattern="[a-z0-9_-]{2,100}" value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} /></Field><Field label="หมวดหมู่"><input maxLength={100} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></Field></div>
      <Field label={draft.kind === 'faq' ? 'คำถาม' : 'ชื่อบทความ'}><input required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field><Field label={draft.kind === 'faq' ? 'คำตอบ' : 'เนื้อหา (ขึ้นบรรทัดใหม่เพื่อแบ่งย่อหน้า)'}><textarea required maxLength={30000} rows={7} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></Field>
      {draft.kind === 'article' && <Field label="URL รูปภาพ HTTPS (ไม่บังคับ)"><input type="url" value={draft.imageUrl || ''} onChange={e => setDraft({ ...draft, imageUrl: e.target.value })} /></Field>}
      <Field label="ลำดับแสดง"><input type="number" required min={0} max={10000} value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: Number(e.target.value) })} /></Field>
      <label className="ops-check"><input type="checkbox" checked={draft.isPublished} onChange={e => setDraft({ ...draft, isPublished: e.target.checked })} />เผยแพร่ให้ลูกค้าเห็น</label>
      <details><summary>ดูตัวอย่างข้อความ</summary><h3>{draft.title}</h3><p className="ops-prose">{draft.body}</p></details>
      {error && <p role="alert" className="ops-message">{error}</p>}<div className="ops-toolbar"><button className="ops-primary" disabled={busy} type="submit">{busy ? 'กำลังบันทึก…' : draft.isPublished ? 'บันทึกและเผยแพร่' : 'บันทึกฉบับร่าง'}</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>ยกเลิก</button></div>
    </fieldset></form>}
    <Search onSearch={value => { setSearch(value); setPage(1); }} /><Status {...list} retry={list.reload} />
    {list.data && <><div className="ops-list">{list.data.data.map(item => <article key={item.id}><div className="ops-toolbar"><h2>{item.title}</h2><button type="button" disabled={busy} onClick={() => edit(item)}>แก้ไข</button></div><small>{item.category} · {item.isPublished ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'} · {date(item.updatedAt)}</small><p className="ops-excerpt">{item.body}</p></article>)}</div>{!list.data.data.length && <p className="ops-empty">ยังไม่มีเนื้อหาในหมวดนี้ กดเพิ่มเนื้อหาเพื่อจัดการจากหลังบ้าน</p>}<Pager page={page} total={list.data.total} onPage={setPage} /></>}
  </div>;
}
