import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { BranchesPage } from './pages/BranchesPage';
import { MachinesPage } from './pages/MachinesPage';
import { SessionsPage } from './pages/SessionsPage';
import { RevenuePage } from './pages/RevenuePage';
import { CustomersPage } from './pages/CustomersPage';
import { PackagesPage } from './pages/PackagesPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import api from './services/api';
import { type AdminUser } from './services/mockData';

type PageName = 'dashboard' | 'branches' | 'machines' | 'sessions' | 'customers' | 'packages' | 'revenue' | 'settings';

export function App() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [currentPage, setCurrentPage] = useState<PageName>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!currentUser) {
    return <LoginPage onLogin={(user) => setCurrentUser(user)} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':  return <DashboardPage />;
      case 'branches':   return <BranchesPage />;
      case 'machines':   return <MachinesPage />;
      case 'sessions':   return <SessionsPage />;
      case 'revenue':    return <RevenuePage />;
      case 'customers':  return <CustomersPage />;
      case 'packages':   return <PackagesPage />;
      case 'settings':   return <SettingsPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={currentUser}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          user={currentUser}
          onLogout={() => { api.logout(); setCurrentUser(null); }}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
