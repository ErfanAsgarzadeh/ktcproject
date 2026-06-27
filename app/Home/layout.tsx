'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from '@/components/navbar';
import { apiClient } from '@/lib/api';

const ALWAYS_ALLOWED = ['/DashBoard/Home', '/DashBoard/Profile'];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = هنوز چک نشده

  useEffect(() => {
    // فقط یک بار در mount چک می‌کنیم — نه هر بار pathname تغییر کرد
    apiClient.get('/auth/profile/')
      .then(res => {
        setIsAuthenticated(true);

        // گارد دسترسی صفحه
        const allowed: string[] | null | undefined = res.data?.allowedPages;
        if (allowed == null) return;
        if (ALWAYS_ALLOWED.includes(pathname)) return;
        if (!allowed.includes(pathname)) {
          router.replace('/DashBoard/Home');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        router.push('/Login');
      });
  }, []); // ← فقط یک بار اجرا می‌شود

  // هنوز در حال چک کردن است
  if (isAuthenticated === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // احراز هویت ناموفق — router.push در useEffect انجام می‌شود
  if (!isAuthenticated) return null;

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Navbar />
      <main className="flex-1 overflow-hidden transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
