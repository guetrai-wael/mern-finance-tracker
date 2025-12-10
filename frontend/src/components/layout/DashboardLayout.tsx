// Dashboard layout with navigation
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiHome,
  FiCreditCard,
  FiTag,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiLogOut,
  FiMenu,
  FiX,
  FiUser,
  FiPieChart
} from "react-icons/fi";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: FiHome },
    { name: "Transactions", href: "/transactions", icon: FiCreditCard },
    { name: "Categories", href: "/categories", icon: FiTag },
    { name: "Budgets", href: "/budgets", icon: FiTarget },
    { name: "Goals", href: "/goals", icon: FiTrendingUp },
    { name: "Settings", href: "/settings", icon: FiUser },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: FiUsers }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-slate-900/50 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:h-screen lg:overflow-y-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
              <FiPieChart className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Chahrity</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-slate-700"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100%-5rem)] justify-between p-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                    ${
                      isActive
                        ? "bg-primary-50 text-primary-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`
                      mr-3 h-5 w-5 transition-colors
                      ${
                        isActive
                          ? "text-primary-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="border-t border-slate-100 pt-4 mt-6">
            <div className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                <FiUser className="h-5 w-5" />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <FiLogOut className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                <FiMenu className="h-6 w-6" />
              </button>
              <span className="font-bold text-slate-900">Chahrity</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {user?.name?.charAt(0) || 'U'}
            </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto focus:outline-none p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
