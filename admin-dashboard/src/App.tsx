import React, { useEffect, useMemo, useState } from 'react';
import { DashboardSidebar as Sidebar } from './components/DashboardSidebar';
import { DashboardHeader as TopBar } from './components/DashboardHeader';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { BranchesPage } from './pages/BranchesPage';
import { CashierPage } from './pages/CashierPage';
import { CouponsPage } from './pages/CouponsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardWorkbenchPage as DashboardPage } from './pages/DashboardWorkbenchPage';
import './styles/dashboard-system.css';
import { FeedbackInboxPage } from './pages/FeedbackInboxPage';
import { LoginPage } from './pages/LoginPage';
import { MachinesPage } from './pages/MachinesPage';
import { MembershipsPage } from './pages/MembershipsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PackagesPage } from './pages/PackagesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PaymentSetupPage } from './pages/PaymentSetupPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { RevenuePage } from './pages/RevenuePage';
import { RewardsPage } from './pages/RewardsPage';
import { SessionsPage } from './pages/SessionsPage';
import { StampManagementPage } from './pages/StampManagementPage';
import { PointsManagementPage, AuditLogsPage, MembershipPlansPage, ContentManagementPage, RewardRedemptionsPage } from './pages/OperationsPages';
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
  | 'cashier'
  | 'payments'
  | 'rewards'
  | 'stamps'
  | 'memberships'
  | 'machines'
  | 'sessions'
  | 'customers'
  | 'revenue'
  | 'points'
  | 'reward-redemptions'
  | 'membership-plans'
  | 'audit-logs'
  | 'content'
  | 'feedback';

export type ThemeMode = 'dark' | 'light';

const ADMIN_THEME_STORAGE_KEY = 'roboss-admin-theme';

export const pageMeta: Record<PageName, { title: string; description: string }> = {
  points: { title: 'พ้อยท์ลูกค้า', description: 'ยอดคงเหลือ ประวัติ และการปรับยอดพร้อมเหตุผล' },
  'reward-redemptions': { title: 'รายการแลกรางวัล', description: 'ตรวจสอบและบันทึกการส่งมอบสิทธิ์ที่ลูกค้าใช้พ้อยท์แลก' },
  'membership-plans': { title: 'แผนสมาชิก', description: 'จัดการแผนขายใหม่โดยรักษาสิทธิ์ของสมาชิกเดิม' },
  'audit-logs': { title: 'ประวัติการทำรายการ', description: 'ตรวจสอบผู้ทำรายการและข้อมูลอ้างอิงตามขอบเขตสิทธิ์' },
  content: { title: 'เนื้อหาในแอป', description: 'คำถามที่พบบ่อยและบทความสำหรับลูกค้า' },
  dashboard: {
    title: 'ภาพรวมระบบ',
    description: 'ติดตามสถานะสาขา เครื่องล้าง รายได้ และการเติบโตในภาพรวม',
  },
  branches: {
    title: 'สาขา',
    description: 'จัดการข้อมูลสาขา พื้นที่ให้บริการ และการตั้งค่าการปฏิบัติการ',
  },
  admins: {
    title: 'ผู้ดูแลระบบ',
    description: 'กำหนดบัญชีผู้ดูแล สิทธิ์ และขอบเขตการเข้าถึงของแต่ละสาขา',
  },
  policies: {
    title: 'นโยบาย',
    description: 'ควบคุมมาตรฐานกลางและค่าตั้งต้นที่ใช้กับสาขาในเครือ',
  },
  coupons: {
    title: 'คูปอง',
    description: 'สร้าง ตรวจสอบ และควบคุมสิทธิ์ส่วนลดตามเงื่อนไขจริง',
  },
  promotions: {
    title: 'โปรโมชั่น',
    description: 'บริหารแคมเปญและข้อเสนอทางการตลาดรายสาขา',
  },
  notifications: {
    title: 'การแจ้งเตือน',
    description: 'ส่งข้อความและประกาศถึงลูกค้าตามกลุ่มเป้าหมาย',
  },
  packages: {
    title: 'บริการและราคา',
    description: 'ตั้งแพ็กเกจ ราคา และบริการที่เปิดขายในแต่ละสาขา',
  },
  cashier: {
    title: 'รับชำระหน้าร้าน',
    description: 'รับเงินสดหรือสลิป และยืนยันรายการของลูกค้า',
  },
  'payment-setup': {
    title: 'ตั้งค่าชำระเงิน',
    description: 'จัดการผู้ให้บริการชำระเงิน บัญชีรับเงิน และสถานะอนุมัติ',
  },
  payments: {
    title: 'รายการชำระเงิน',
    description: 'ตรวจสถานะ ยืนยัน และกระทบยอดรายการรับเงิน',
  },
  rewards: {
    title: 'ของรางวัล',
    description: 'กำหนดของรางวัลและสิทธิประโยชน์ที่ลูกค้าแลกได้',
  },
  stamps: {
    title: 'แสตมสะสม',
    description: 'ดูยอดสะสม ประวัติ และปรับแสตมให้ลูกค้า',
  },
  memberships: {
    title: 'สมาชิกและเครดิต',
    description: 'ดูแพ็กเกจสมาชิก เครดิตคงเหลือ และประวัติการใช้สิทธิ์',
  },
  machines: {
    title: 'เครื่องล้าง',
    description: 'ดูสถานะเครื่อง คำสั่งควบคุม และข้อมูลสุขภาพของอุปกรณ์',
  },
  sessions: {
    title: 'คิวและรอบล้าง',
    description: 'ติดตามคิว งานที่กำลังล้าง และประวัติบริการแบบเรียลไทม์',
  },
  revenue: {
    title: 'รายได้',
    description: 'วิเคราะห์ยอดขาย สาขา แพ็กเกจ และแนวโน้มทางการเงิน',
  },
  customers: {
    title: 'ลูกค้า',
    description: 'ดูฐานลูกค้า ประวัติการใช้งาน รถที่ลงทะเบียน และมูลค่าสะสม',
  },
  feedback: {
    title: 'ข้อเสนอแนะ',
    description: 'ติดตามเสียงจากลูกค้าและสถานะการแก้ไขปัญหา',
  },
};

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, 'light');
  return 'light';
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
    setTheme('light');
    setCurrentUser(nextMeta.admin);
    setMeta(nextMeta);
    if (nextMeta.admin.role === 'cashier') setCurrentPage('cashier');
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
    return <div className="dash-shell" />;
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
    if (currentUser.role === 'cashier' && !['cashier', 'sessions'].includes(currentPage)) {
      return <CashierPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
    }
    switch (currentPage) {
      case 'reward-redemptions':
        return <RewardRedemptionsPage key={selectedBranchId ?? 'all'} branchId={selectedBranchId} />;
      case 'points':
        return <PointsManagementPage key={selectedBranchId ?? 'all'} admin={currentUser} branchId={selectedBranchId} />;
      case 'audit-logs':
        return <AuditLogsPage key={selectedBranchId ?? 'all'} branchId={selectedBranchId} />;
      case 'membership-plans':
        return currentUser.role === 'hq_admin' ? <MembershipPlansPage /> : <p>ไม่มีสิทธิ์เข้าถึง</p>;
      case 'content':
        return currentUser.role === 'hq_admin' ? <ContentManagementPage /> : <p>ไม่มีสิทธิ์เข้าถึง</p>;
      case 'dashboard':
        return <DashboardPage admin={currentUser} branchId={selectedBranchId} onNavigate={setCurrentPage} />;
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
      case 'cashier':
        return <CashierPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'payments':
        return <PaymentsPage admin={currentUser} branchId={selectedBranchId} />;
      case 'payment-setup':
        return <PaymentSetupPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'rewards':
        return <RewardsPage admin={currentUser} branchId={selectedBranchId} branches={meta.branches} />;
      case 'stamps':
        return <StampManagementPage admin={currentUser} branchId={selectedBranchId} />;
      case 'memberships':
        return <MembershipsPage admin={currentUser} branchId={selectedBranchId} />;
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
        return <DashboardPage admin={currentUser} branchId={selectedBranchId} onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="dash-shell">
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
      <div className="dash-main">
        <TopBar
          theme={theme}
          user={currentUser}
          branches={meta.branches}
          selectedBranchId={selectedBranchId}
          pageTitle={pageMeta[currentPage].title}
          pageDescription={pageMeta[currentPage].description}
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
        <main className="dash-content">{renderPage()}</main>
      </div>
    </div>
  );
}
