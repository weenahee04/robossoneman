import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { BranchesPage } from './pages/BranchesPage';
import { CouponsPage } from './pages/CouponsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeedbackInboxPage } from './pages/FeedbackInboxPage';
import { LoginPage } from './pages/LoginPage';
import { MachinesPage } from './pages/MachinesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PackagesPage } from './pages/PackagesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PaymentSetupPage } from './pages/PaymentSetupPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { RevenuePage } from './pages/RevenuePage';
import { RewardsPage } from './pages/RewardsPage';
import { SessionsPage } from './pages/SessionsPage';
import api, { type AdminMeta, type AdminUser, type BranchOption } from './services/api';

export type PageName =
  | 'dashboard'
  | 'branches'
  | 'payment-setup'
  | 'admins'
  | 'policies'
  | 'coupons'
  | 'promotions'
  | 'notifications'
  | 'packages'
  | 'payments'
  | 'rewards'
  | 'machines'
  | 'sessions'
  | 'customers'
  | 'revenue'
  | 'feedback';

export type ThemeMode = 'dark' | 'light';

const ADMIN_THEME_STORAGE_KEY = 'roboss-admin-theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const savedTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return 'dark';
}

function getDefaultBranchSelection(admin: AdminUser | null, branches: BranchOption[]) {
  if (!admin) {
    return null;
  }

  if (admin.role === 'hq_admin') {
    return null;
  }

  return admin.branchIds[0] ?? branches[0]?.id ?? null;
}

export function App() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [meta, setMeta] = useState<AdminMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<PageName>('dashboard');
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function bootstrapSession() {
    const admin = await api.getCurrentAdmin();
    if (!admin) {
      setCurrentUser(null);
      setMeta(null);
      setSelectedBranchId(null);
      setIsBootstrapping(false);
      return;
    }

    const nextMeta = await api.fetchMeta();
    setCurrentUser(nextMeta.admin);
    setMeta(nextMeta);
    setSelectedBranchId((current) => {
      if (current && nextMeta.branches.some((branch) => branch.id === current)) {
        return current;
      }
      return getDefaultBranchSelection(nextMeta.admin, nextMeta.branches);
    });
    setIsBootstrapping(false);
  }

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  }, [theme]);

  const visibleBranchIds = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (selectedBranchId) {
      return [selectedBranchId];
    }

    if (currentUser.role === 'hq_admin') {
      return meta?.branches.map((branch) => branch.id) ?? [];
    }

    return currentUser.branchIds;
  }, [currentUser, meta?.branches, selectedBranchId]);

  if (isBootstrapping) {
    return <div className="min-h-screen bg-[linear-gradient(180deg,#050505_0%,#140808_100%)]" />;
  }

  if (!currentUser || !meta) {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
        onLogin={async () => {
          setIsBootstrapping(true);
          await bootstrapSession();
        }}
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage admin={currentUser} branchId={selectedBranchId} />;
      case 'branches':
        return (
          <BranchesPage
            admin={currentUser}
            branchId={selectedBranchId}
            branches={meta.branches}
            onBranchesChanged={async () => {
              const nextMeta = await api.fetchMeta();
              setMeta(nextMeta);
            }}
          />
        );
      case 'admins':
        return <AdminUsersPage admin={currentUser} branches={meta.branches} />;
      case 'policies':
        return <PoliciesPage admin={currentUser} branches={meta.branches} />;
      case 'coupons':
        return <CouponsPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'promotions':
        return <PromotionsPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'notifications':
        return <NotificationsPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'packages':
        return <PackagesPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'payments':
        return <PaymentsPage admin={currentUser} branchId={selectedBranchId} />;
      case 'payment-setup':
        return <PaymentSetupPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'rewards':
        return <RewardsPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'machines':
        return <MachinesPage admin={currentUser} branchId={selectedBranchId} realtimeBranchIds={visibleBranchIds} />;
      case 'sessions':
        return <SessionsPage admin={currentUser} branchId={selectedBranchId} realtimeBranchIds={visibleBranchIds} />;
      case 'revenue':
        return <RevenuePage admin={currentUser} branchId={selectedBranchId} />;
      case 'customers':
        return <CustomersPage admin={currentUser} branchId={selectedBranchId} />;
      case 'feedback':
        return <FeedbackInboxPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      default:
        return <DashboardPage admin={currentUser} branchId={selectedBranchId} />;
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#050505_0%,#140808_100%)] lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setMobileSidebarOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        user={currentUser}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <TopBar
          theme={theme}
          user={currentUser}
          branches={meta.branches}
          selectedBranchId={selectedBranchId}
          onSelectBranch={setSelectedBranchId}
          onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          onLogout={() => {
            api.logout();
            setCurrentUser(null);
            setMeta(null);
            setSelectedBranchId(null);
          }}
          onToggleSidebar={() => setMobileSidebarOpen((current) => !current)}
        />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:p-6">{renderPage()}</main>
      </div>
    </div>
  );
}
