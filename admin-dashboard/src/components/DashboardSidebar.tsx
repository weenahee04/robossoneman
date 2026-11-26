import React from 'react';
import { BarChart3, Building2, Calculator, Cpu, Crown, FileText, Gift, History, LayoutDashboard, Megaphone, MessageSquare, Package, ReceiptText, Settings, ShieldCheck, Stamp, TicketPercent, TrendingUp, Users, WalletCards, X } from 'lucide-react';
import type { PageName } from '@/App';
import type { AdminUser } from '@/services/api';

interface Props { currentPage:PageName; onNavigate:(page:PageName)=>void; collapsed:boolean; onToggle:()=>void; mobileOpen:boolean; onCloseMobile:()=>void; user:AdminUser }
type Item={id:PageName;label:string;icon:React.ComponentType<{className?:string}>};
type Group={label:string;items:Item[]};

export function DashboardSidebar({currentPage,onNavigate,mobileOpen,onCloseMobile,user}:Props){
  const groups:Group[]=user.role==='cashier' ? [{label:'งานแคชเชียร์',items:[{id:'cashier',label:'รับชำระหน้าร้าน',icon:Calculator},{id:'sessions',label:'คิวและรอบล้าง',icon:History}]}] : [
    {label:'ภาพรวม',items:[{id:'dashboard',label:'แดชบอร์ด',icon:LayoutDashboard}]},
    {label:'งานประจำวัน',items:[{id:'sessions',label:'คิวและรอบล้าง',icon:History},{id:'cashier',label:'รับชำระหน้าร้าน',icon:Calculator},{id:'machines',label:'สถานะเครื่อง',icon:Cpu},{id:'payments',label:'รายการชำระเงิน',icon:ReceiptText}]},
    {label:'ลูกค้า',items:[{id:'customers',label:'ข้อมูลลูกค้า',icon:Users},{id:'memberships',label:'สมาชิกและเครดิต',icon:Crown},{id:'points',label:'พ้อยท์ลูกค้า',icon:BarChart3},{id:'coupons',label:'คูปอง',icon:TicketPercent},{id:'stamps',label:'แสตมสะสม',icon:Stamp},{id:'rewards',label:'ของรางวัล',icon:Gift},{id:'reward-redemptions',label:'รายการแลกรางวัล',icon:Gift}]},
    {label:'การตลาด',items:[{id:'promotions',label:'โปรโมชัน',icon:Megaphone},{id:'notifications',label:'ส่งข่าวสาร',icon:FileText},{id:'feedback',label:'ปัญหาและข้อเสนอแนะ',icon:MessageSquare}]},
    {label:'ธุรกิจ',items:[{id:'revenue',label:'รายได้และรายงาน',icon:TrendingUp},{id:'packages',label:'บริการและราคา',icon:Package},{id:'branches',label:user.role==='hq_admin'?'จัดการสาขา':'ข้อมูลสาขา',icon:Building2},{id:'payment-setup',label:'ตั้งค่ารับเงิน',icon:WalletCards},{id:'audit-logs',label:'ประวัติการทำรายการ',icon:History}]},
  ];
  if(user.role==='hq_admin') groups.push({label:'ตั้งค่าระบบ',items:[{id:'admins',label:'ผู้ดูแลและสิทธิ์',icon:ShieldCheck},{id:'policies',label:'นโยบายส่วนกลาง',icon:Settings},{id:'membership-plans',label:'แผนสมาชิก',icon:Crown},{id:'content',label:'เนื้อหาในแอป',icon:FileText}]});
  return <>
    {mobileOpen&&<button className="dash-sidebar__backdrop" aria-label="ปิดเมนู" onClick={onCloseMobile}/>} 
    <aside className="dash-sidebar" data-open={mobileOpen} aria-label="เมนูหลังบ้าน">
      <div className="dash-sidebar__brand"><span className="dash-sidebar__mark">RB</span><div><strong>ROBOSS</strong><small>CONTROL CENTER</small></div><button className="ml-auto md:hidden" aria-label="ปิดเมนู" onClick={onCloseMobile}><X/></button></div>
      <div className="dash-sidebar__scope"><span>สิทธิ์การใช้งาน</span><strong>{user.role==='hq_admin'?'สำนักงานใหญ่ · ทุกสาขา':user.role==='cashier'?'แคชเชียร์ · งานหน้าร้าน':`ผู้ดูแลสาขา · ${user.branchIds.length} สาขา`}</strong></div>
      <nav className="dash-sidebar__nav">{groups.map(group=><section className="dash-sidebar__group" key={group.label}><p className="dash-sidebar__group-label">{group.label}</p>{group.items.map(item=>{const Icon=item.icon;return <button key={item.id} className="dash-sidebar__link" aria-current={currentPage===item.id?'page':undefined} onClick={()=>{onNavigate(item.id);onCloseMobile();}}><Icon/><span>{item.label}</span></button>})}</section>)}</nav>
      <div className="dash-sidebar__account"><span className="dash-sidebar__avatar">{user.name.slice(0,1).toUpperCase()}</span><div className="min-w-0"><strong>{user.name}</strong><small>{user.email}</small></div></div>
    </aside>
  </>;
}
