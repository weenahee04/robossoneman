import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Cpu, History, ReceiptText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { type AdminUser, type DashboardData } from '@/services/api';
import type { PageName } from '@/App';

interface Props { admin:AdminUser; branchId:string|null; onNavigate:(page:PageName)=>void }
const sessionLabels:Record<string,string>={pending_payment:'รอชำระเงิน',payment_failed:'ชำระไม่สำเร็จ',ready_to_wash:'พร้อมล้าง',in_progress:'กำลังล้าง',completed:'เสร็จแล้ว',failed:'มีปัญหา',cancelled:'ยกเลิก',refunded:'คืนเงิน',expired:'หมดเวลา'};

export function DashboardWorkbenchPage({admin,branchId,onNavigate}:Props){
  const [data,setData]=useState<DashboardData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let cancelled=false;setLoading(true);setError('');api.fetchDashboard(branchId).then(value=>{if(!cancelled)setData(value)}).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'โหลดข้อมูลไม่สำเร็จ')}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[branchId]);
  const scopeName=useMemo(()=>branchId?(admin.scopes.find(scope=>scope.branchId===branchId)?.branch?.name??'สาขาที่เลือก'):(admin.role==='hq_admin'?'ทุกสาขา':'สาขาที่ได้รับสิทธิ์'),[admin,branchId]);
  const summary=data?.summary, machine=data?.machineHealth;
  const metrics=[
    {label:'รายได้วันนี้',value:`${(summary?.todayRevenue??0).toLocaleString()} บาท`,detail:'ยอดชำระที่ยืนยันแล้ว'},
    {label:'รอบล้างวันนี้',value:(summary?.todaySessions??0).toLocaleString(),detail:`กำลังให้บริการ ${summary?.activeSessions??0} รอบ`},
    {label:'เครื่องพร้อมใช้งาน',value:`${machine?.onlineRate??0}%`,detail:`ออนไลน์ ${machine?.online??0} · ออฟไลน์ ${machine?.offline??0}`},
    {label:'ลูกค้าทั้งหมด',value:(summary?.totalCustomers??0).toLocaleString(),detail:`ลูกค้าใหม่ 14 วัน ${summary?.customerGrowthCurrent??0}`},
  ];
  const quick=[
    {page:'sessions' as const,label:'ดูคิวและรอบล้าง',detail:'ติดตามงานที่กำลังให้บริการ',icon:History},
    {page:'cashier' as const,label:'รับชำระหน้าร้าน',detail:'เงินสดและหลักฐานการโอน',icon:Calculator},
    {page:'machines' as const,label:'ตรวจสถานะเครื่อง',detail:'เครื่องออนไลน์และซ่อมบำรุง',icon:Cpu},
    {page:'payments' as const,label:'ตรวจรายการชำระเงิน',detail:'สถานะและการกระทบยอด',icon:ReceiptText},
  ];
  return <div className="workbench">
    <div className="workbench__intro"><div><h2>{scopeName}</h2><p>ภาพรวมงานหน้าร้านและรายการที่ต้องติดตามวันนี้</p></div><span className="workbench__stamp">ข้อมูลตามขอบเขตสาขาที่เลือก</span></div>
    {error&&<div className="workbench__error" role="alert">{error}</div>}
    <section className="workbench__metrics" aria-label="ตัวเลขสำคัญ">{metrics.map(item=><article className="workbench__metric" key={item.label}><span>{item.label}</span><strong>{loading?'—':item.value}</strong><small>{item.detail}</small></article>)}</section>
    <div className="workbench__grid">
      <section className="workbench__panel"><div className="workbench__panel-head"><div><h3>งานที่ใช้บ่อย</h3><p>เข้าถึงงานประจำวันได้ทันที</p></div></div><div className="workbench__quick">{quick.map(item=>{const Icon=item.icon;return <button key={item.page} onClick={()=>onNavigate(item.page)}><Icon/><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>})}</div></section>
      <section className="workbench__panel"><div className="workbench__panel-head"><div><h3>สถานะที่ต้องดู</h3><p>ข้อมูลการปฏิบัติงานขณะนี้</p></div></div><div className="workbench__rows">
        <button className="workbench__row" onClick={()=>onNavigate('machines')}><span className="workbench__status" data-tone={(machine?.offline??0)+(machine?.maintenance??0)>0?'warning':'ok'}>เครื่องออฟไลน์หรือซ่อม</span><strong>{(machine?.offline??0)+(machine?.maintenance??0)} เครื่อง</strong></button>
        <button className="workbench__row" onClick={()=>onNavigate('sessions')}><span className="workbench__status" data-tone={(summary?.activeSessions??0)>0?'warning':'ok'}>รอบที่กำลังทำงาน</span><strong>{summary?.activeSessions??0} รอบ</strong></button>
        <div className="workbench__row"><span className="workbench__status" data-tone={(machine?.onlineRate??0)>=90?'ok':'danger'}>ความพร้อมของเครื่อง</span><strong>{machine?.onlineRate??0}%</strong></div>
      </div></section>
    </div>
    <div className="workbench__grid">
      <section className="workbench__panel"><div className="workbench__panel-head"><div><h3>รายได้ 7 วันล่าสุด</h3><p>เฉพาะรายการชำระที่ยืนยันแล้ว</p></div></div><div className="workbench__chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.revenueTrend??[]} margin={{top:16,right:8,left:0,bottom:0}}><CartesianGrid vertical={false} stroke="var(--dash-rule)"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'var(--dash-muted)',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--dash-muted)',fontSize:11}}/><Tooltip contentStyle={{background:'var(--dash-surface)',border:'1px solid var(--dash-rule)',borderRadius:'var(--dash-radius)'}} formatter={(value:number)=>[`${value.toLocaleString()} บาท`,'รายได้']}/><Bar dataKey="total" fill="var(--dash-accent)" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div></section>
      <section className="workbench__panel"><div className="workbench__panel-head"><div><h3>สถานะรอบวันนี้</h3><p>จำนวนรอบแยกตามขั้นตอน</p></div></div><div className="workbench__rows">{Object.entries(data?.sessionStatusSummary??{}).map(([status,count])=><div className="workbench__row" key={status}><span>{sessionLabels[status]??status.replace(/_/g,' ')}</span><strong>{count}</strong></div>)}{!loading&&!Object.keys(data?.sessionStatusSummary??{}).length&&<p className="workbench__empty">ยังไม่มีรอบล้างวันนี้</p>}</div></section>
    </div>
<section className="workbench__panel"><div className="workbench__panel-head"><div><h3>รอบล่าสุด</h3><p>รายการบริการล่าสุดในขอบเขตที่เลือก</p></div><span>{data?.recentSessions.length??0} รายการ</span></div><div className="workbench__table-wrap"><table className="workbench__table"><thead><tr><th>ลูกค้า</th><th>สาขา / เครื่อง</th><th>บริการ</th><th>สถานะ</th><th>ยอดชำระ</th><th>เวลา</th></tr></thead><tbody>{(data?.recentSessions??[]).map(session=><tr key={session.id}><td><strong>{session.user.displayName}</strong></td><td>{session.branch.shortName||session.branch.name}<br/><small>{session.machine.name}</small></td><td>{session.package.name}</td><td><span className="workbench__status" data-tone={session.status==='completed'?'ok':['payment_failed','cancelled','refunded'].includes(session.status)?'danger':'warning'}>{sessionLabels[session.status]??session.status}</span></td><td>{session.totalPrice.toLocaleString()} บาท</td><td>{new Date(session.createdAt).toLocaleString('th-TH')}</td></tr>)}</tbody></table>{!loading&&!data?.recentSessions.length&&<p className="workbench__empty">ยังไม่มีรายการล่าสุด</p>}</div></section>
  </div>;
}
