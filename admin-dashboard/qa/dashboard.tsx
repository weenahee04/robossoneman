// Development-only dashboard preview. All data is local fixture data.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/styles/dashboard-system.css';
import { DashboardSidebar } from '../src/components/DashboardSidebar';
import { DashboardHeader } from '../src/components/DashboardHeader';
import { DashboardWorkbenchPage } from '../src/pages/DashboardWorkbenchPage';
import { QAModulePage } from './QAModulePage';
import type { AdminUser, BranchOption, DashboardData } from '../src/services/api';
import { pageMeta, type PageName } from '../src/App';

if(!import.meta.env.DEV) throw new Error('QA preview is development-only');
const branch:BranchOption={id:'branch-qa',code:'RAMA9',name:'ROBOSS ล้างมอไซค์ พระราม 9',shortName:'พระราม 9',isActive:true};
const admin:AdminUser={id:'admin-qa',email:'qa@roboss.local',name:'ผู้ดูแลระบบ',role:'hq_admin',isActive:true,branchIds:[],scopes:[{branchId:branch.id,canViewRevenue:true,canManageMachines:true,canManageCoupons:true,branch}]};
const fixture:DashboardData={
  admin,selectedBranchId:null,summary:{totalBranches:4,totalMachines:12,activeMachines:10,totalSessions:1840,todaySessions:36,activeSessions:4,totalRevenue:485200,todayRevenue:8450,totalCustomers:720,customerGrowthCurrent:31,customerGrowthPrevious:26},
  machineSummary:{idle:6,reserved:1,washing:3,maintenance:1,offline:1},machineHealth:{online:10,offline:1,maintenance:1,washing:3,idle:6,reserved:1,onlineRate:83},
  sessionStatusSummary:{pending_payment:2,payment_failed:1,ready_to_wash:1,in_progress:3,completed:29,cancelled:0,refunded:0},
  revenueTrend:[{date:'4 ก.ย.',total:6200,sessions:28,avgTicket:221},{date:'5 ก.ย.',total:7300,sessions:31,avgTicket:235},{date:'6 ก.ย.',total:6800,sessions:27,avgTicket:251},{date:'7 ก.ย.',total:9100,sessions:39,avgTicket:233},{date:'8 ก.ย.',total:7600,sessions:32,avgTicket:237},{date:'9 ก.ย.',total:8800,sessions:35,avgTicket:251},{date:'วันนี้',total:8450,sessions:36,avgTicket:234}],
  customerGrowthTrend:[],branchPerformance:[],recentSessions:[
    {id:'s1',branchId:branch.id,machineId:'m1',userId:'u1',status:'in_progress',currentStep:3,totalSteps:6,progress:52,carSize:'M',totalPrice:199,rating:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),branch,machine:{id:'m1',name:'ช่องล้าง 01',status:'washing'},package:{id:'p1',name:'Shine Mode'},user:{id:'u1',displayName:'ลูกค้าหน้าร้าน'}},
    {id:'s2',branchId:branch.id,machineId:'m2',userId:'u2',status:'completed',currentStep:6,totalSteps:6,progress:100,carSize:'S',totalPrice:99,rating:5,createdAt:new Date(Date.now()-900000).toISOString(),updatedAt:new Date().toISOString(),branch,machine:{id:'m2',name:'ช่องล้าง 02',status:'idle'},package:{id:'p2',name:'Quick Wash'},user:{id:'u2',displayName:'สมาชิก ROBOSS'}},
  ]
};
window.localStorage.setItem('roboss_admin_access_token','qa');
window.fetch=async(input)=>String(input).includes('/api/admin/dashboard')?Response.json({data:fixture}):Response.json({message:'QA blocks external requests'},{status:404});
const pageIds = new Set<PageName>(Object.keys(pageMeta) as PageName[]);
function readPage(){const value=new URLSearchParams(window.location.search).get('page') as PageName|null;return value&&pageIds.has(value)?value:'dashboard'}
function Preview(){
  const[page,setPage]=useState<PageName>(readPage),[mobile,setMobile]=useState(false),[branchId,setBranchId]=useState<string|null>(null);
  useEffect(()=>{const onPop=()=>setPage(readPage());window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
  const navigate=(next:PageName)=>{setPage(next);const url=new URL(window.location.href);next==='dashboard'?url.searchParams.delete('page'):url.searchParams.set('page',next);window.history.pushState({},'',url)};
  const meta=pageMeta[page];
  return <div className="dash-shell"><DashboardSidebar currentPage={page} onNavigate={navigate} collapsed={false} onToggle={()=>{}} mobileOpen={mobile} onCloseMobile={()=>setMobile(false)} user={admin}/><div className="dash-main"><DashboardHeader theme="light" user={admin} branches={[branch]} selectedBranchId={branchId} pageTitle={meta.title} pageDescription="ตัวอย่างหน้าตา · ใช้ข้อมูลจำลอง ไม่เชื่อมฐานข้อมูลจริง" onSelectBranch={setBranchId} onToggleTheme={()=>{}} onLogout={()=>{}} onToggleSidebar={()=>setMobile(true)}/><main className="dash-content">{page==='dashboard'?<DashboardWorkbenchPage admin={admin} branchId={branchId} onNavigate={navigate}/>:<QAModulePage page={page}/>}</main></div></div>
}
createRoot(document.getElementById('root')!).render(<Preview/>);
