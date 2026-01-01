'use client';

import { Sidebar } from '../navigation';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * Main layout component with sidebar navigation
 * Provides consistent layout structure across all pages
 * @requirements 3.1 - UI feature organization
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-0">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
