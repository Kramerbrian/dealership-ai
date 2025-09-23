"use client";
import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Activity,
  DollarSign,
  Settings,
  Users,
  BarChart3,
  Clock,
  FileText,
  Menu,
  X,
  Bell,
  User,
  LogOut
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Queue Management', href: '/admin/queue', icon: Activity },
  { name: 'Cost Management', href: '/admin/cost', icon: DollarSign },
  { name: 'Enterprise Hub', href: '/admin/enterprise', icon: BarChart3 },
  { name: 'System Monitor', href: '/admin/monitoring', icon: Activity },
  { name: 'Batch Processor', href: '/admin/batch', icon: Clock },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Reports', href: '/admin/reports', icon: FileText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isActivePath = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 flex z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DA</span>
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                DealershipAI
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
            </div>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                } group flex items-center px-3 py-2 text-sm font-medium rounded-l-md transition-colors`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon
                  className={`${
                    active
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                  } mr-3 flex-shrink-0 h-5 w-5 transition-colors`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </div>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">admin@dealershipai.com</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center">
              <button
                className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="ml-4 md:ml-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {navigation.find(item => isActivePath(item.href))?.name || 'Admin Panel'}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white dark:ring-gray-800"></span>
              </button>

              {/* User menu */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}