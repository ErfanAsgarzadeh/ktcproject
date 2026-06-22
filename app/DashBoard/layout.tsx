'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from '@/components/navbar';
import { apiClient } from '@/lib/api';

// صفحاتی که گاردِ دسترسی روی آن‌ها اعمال نمی‌شود (همیشه در دسترس)
const ALWAYS_ALLOWED = ['/DashBoard/Home', '/DashBoard/Profile'];

export default function DashboardLayout({
                                          children,
                                        }: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // با Cookie-based auth، احراز هویت را با صدا زدن profile endpoint چک می‌کنیم
    // اگر Cookie معتبر باشد، 200 برمی‌گردد؛ وگرنه 401 که interceptor handle می‌کند
    apiClient.get('/auth/profile/')
      .then(res => {
        setIsAuthenticated(true);

        // گاردِ دسترسیِ صفحه
        const allowed: string[] | null | undefined = res.data?.allowedPages;
        if (allowed == null) return;
        if (ALWAYS_ALLOWED.includes(pathname)) return;
        if (!allowed.includes(pathname)) {
          router.replace('/DashBoard/Home');
        }
      })
      .catch(() => {
        // 401 → interceptor به /Login هدایت می‌کند
        router.push('/Login');
      });
  }, [pathname, router]);

  if (!isAuthenticated) {
    return (
        <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
  }

  return (
      <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <Navbar />
        <main className="flex-1 overflow-hidden transition-all duration-300">
          {children}
        </main>
      </div>
  );
}
