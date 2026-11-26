import React from 'react';
import { Building2, LogOut, Menu } from 'lucide-react';
import type { ThemeMode } from '@/App';
import type { AdminUser, BranchOption } from '@/services/api';

interface Props {theme:ThemeMode;user:AdminUser;branches:BranchOption[];selectedBranchId:string|null;pageTitle:string;pageDescription:string;onSelectBranch:(id:string|null)=>void;onToggleTheme:()=>void;onLogout:()=>void;onToggleSidebar:()=>void}
export function DashboardHeader({user,branches,selectedBranchId,pageTitle,pageDescription,onSelectBranch,onLogout,onToggleSidebar}:Props){
  const options=user.role==='hq_admin'?branches:branches.filter(branch=>user.branchIds.includes(branch.id));
  return <header className="dash-header">
    <button className="dash-header__menu" onClick={onToggleSidebar} aria-label="เปิดเมนู"><Menu/></button>
    <div className="dash-header__title"><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
    <div className="dash-header__actions">
      <label className="dash-branch"><Building2/><select value={selectedBranchId??''} onChange={event=>onSelectBranch(event.target.value||null)} aria-label="เลือกสาขา">{user.role==='hq_admin'&&<option value="">ทุกสาขา</option>}{options.map(branch=><option key={branch.id} value={branch.id}>{branch.shortName||branch.name}</option>)}</select></label>
      <button className="dash-header__icon" onClick={onLogout} aria-label="ออกจากระบบ"><LogOut/></button>
    </div>
  </header>;
}
