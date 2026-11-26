// Development-only fixture surface. No request from this page reaches an API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { PointsManagementPage, AuditLogsPage, MembershipPlansPage, ContentManagementPage, RewardRedemptionsPage } from '../src/pages/OperationsPages';
import type { AdminUser } from '../src/services/api';

if (!import.meta.env.DEV) throw new Error('QA fixtures are development-only');
const now = '2026-09-10T03:00:00.000Z';
let balance = 250, failed = false, empty = false;
const history: any[] = [];
const redemptions = [{ id: 'redemption-qa', customerName: 'ลูกค้าทดสอบ', rewardName: 'คูปองส่วนลดค่าล้าง', amount: -100, createdAt: now, status: 'pending', fulfilledAt: null as string | null }];
const plans: any[] = [{ id: 'plan-qa', code: 'QA_WASH', name: 'แพ็กเกจล้าง 10 ครั้ง', description: 'ข้อมูลจำลองสำหรับตรวจหน้าจอ ไม่ใช่แพ็กเกจขายจริง', price: 990, washLimit: 10, grapheneLimit: 2, group: 'bundle', durationMonths: 6, isActive: true, _count: { memberships: 5 } }];
const content: any[] = [{ id: 'faq-qa', kind: 'faq', slug: 'before-wash', category: 'ก่อนใช้บริการ', title: 'ต้องเตรียมรถก่อนล้างอย่างไร?', body: 'จอดรถให้ตรงช่องที่กำหนด และปฏิบัติตามคำแนะนำของสาขา', imageUrl: null, sortOrder: 0, isPublished: true, version: 1, updatedAt: now }];
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.href), path = url.pathname;
  if (!path.startsWith('/api/admin/')) throw new Error('QA surface blocks all external API calls');
  if (failed) return Response.json({ message: 'จำลอง: เซิร์ฟเวอร์ไม่พร้อมใช้งาน กรุณาลองใหม่' }, { status: 503 });
  const body = init?.body ? JSON.parse(String(init.body)) : {}, method = init?.method ?? 'GET';
  const rows = (data: unknown[]) => ({ data: empty ? [] : data, total: empty ? 0 : data.length, page: 1, limit: 25 });
  if (path.endsWith('/adjust')) {
    balance += body.amount;
    const row = { id: body.requestId, amount: body.amount, balanceAfter: balance, description: body.reason, createdAt: now };
    history.unshift(row); return Response.json({ data: row });
  }
  if (path.endsWith('/history')) return Response.json(rows(history));
  if (path.endsWith('/points')) return Response.json(rows([{ id: 'customer-qa', displayName: 'ลูกค้าทดสอบ', phone: 'ข้อมูลจำลอง', isActive: true, wallet: { balance, lifetimeEarned: 500, lifetimeRedeemed: 250 } }]));
  if (path.endsWith('/audit-logs')) return Response.json(rows([{ id: 'audit-qa', action: 'admin.points.adjust', actorType: 'admin', entityType: 'points_transaction', entityId: 'transaction-qa', createdAt: now, adminUser: { name: 'ผู้ดูแลทดสอบ' }, branch: { name: 'สาขาทดสอบ' } }]));
  if (path.endsWith('/fulfill')) { redemptions[0].status = 'fulfilled'; redemptions[0].fulfilledAt = now; return Response.json({ data: redemptions[0] }); }
  if (path.endsWith('/reward-redemptions')) return Response.json(rows(redemptions));
  if (path.includes('/membership-plans')) {
    if (method === 'POST') plans.push({ ...body, id: crypto.randomUUID(), _count: { memberships: 0 } });
    if (method === 'PATCH') Object.assign(plans.find(p => path.endsWith(p.id)), body);
    return Response.json({ data: empty ? [] : plans });
  }
  if (path.includes('/content')) {
    if (method === 'POST') content.push({ ...body, id: crypto.randomUUID(), version: 1, updatedAt: now });
    if (method === 'PATCH') Object.assign(content.find(p => path.endsWith(p.id)), body, { version: body.version + 1, updatedAt: now });
    return Response.json(rows(content.filter(item => !url.searchParams.has('kind') || item.kind === url.searchParams.get('kind'))));
  }
  return Response.json({ message: 'Missing QA fixture' }, { status: 404 });
};

function Preview() {
  const params = new URLSearchParams(location.search);
  const [page, setPage] = useState(params.get('page') || 'points'), [revision, setRevision] = useState(0), [branch, setBranch] = useState(params.get('role') === 'branch');
  const admin = { role: branch ? 'branch_admin' : 'hq_admin' } as AdminUser;
  const views: Record<string, React.ReactNode> = {
    points: <PointsManagementPage admin={admin} branchId={null} />,
    rewards: <RewardRedemptionsPage branchId={null} />,
    plans: <MembershipPlansPage />,
    content: <ContentManagementPage />,
    audit: <AuditLogsPage branchId={null} />,
  };
  return <main style={{ padding: 16, maxWidth: 1280, margin: 'auto' }}>
    <header className="ops-page" style={{ marginBottom: 24 }}><strong>QA เท่านั้น — ข้อมูลจำลอง ไม่เชื่อมระบบจริง</strong>
      <nav className="ops-toolbar" aria-label="หน้าทดสอบ">{Object.keys(views).map(key => <button key={key} onClick={() => setPage(key)}>{key}</button>)}</nav>
      <div className="ops-toolbar"><button onClick={() => { failed = !failed; setRevision(n => n + 1); }}>จำลองข้อผิดพลาด</button><button onClick={() => { empty = !empty; setRevision(n => n + 1); }}>จำลองรายการว่าง</button><button onClick={() => setBranch(!branch)}>{branch ? 'เปลี่ยนเป็น HQ' : 'เปลี่ยนเป็นสาขา'}</button></div>
    </header><section key={`${page}-${revision}-${branch}`}>{views[page]}</section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
