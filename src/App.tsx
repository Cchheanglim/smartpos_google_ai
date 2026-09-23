import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './views/DashboardView';
import { CheckoutView } from './views/CheckoutView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { ProductsView } from './views/ProductsView';
import { StaffView } from './views/StaffView';
import { TasksView } from './views/TasksView';
import { ReportsView } from './views/ReportsView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';

export const AppContent: React.FC = () => {
  const { activeTab, flash, sidebarCollapsed, isAuthenticated, isLogoutModalOpen } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'checkout':
        return <CheckoutView />;
      case 'history':
        return <SalesHistoryView />;
      case 'products':
        return <ProductsView />;
      case 'staff':
        return <StaffView />;
      case 'tasks':
        return <TasksView />;
      case 'business_dashboard':
        return <ReportsView subView="analytics" />;
      case 'business_health':
        return <ReportsView subView="health" />;
      case 'crm_dashboard':
        return <ReportsView subView="crm" />;
      case 'profile':
        return <ProfileView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className={`app-container layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="main-wrapper content-col">
        <TopHeader onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)} />
        <main className="content-area main">
          {flash && (
            <div
              className={`flash-banner flash-${flash.type}`}
              role="alert"
            >
              <span>
                {flash.type === 'success' && <i className="fa-solid fa-circle-check" style={{ marginRight: '8px' }}></i>}
                {flash.type === 'error' && <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i>}
                {flash.type === 'warning' && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>}
                {flash.text}
              </span>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
      {isLogoutModalOpen && <LogoutConfirmModal />}
    </div>
  );
};

export default AppContent;
