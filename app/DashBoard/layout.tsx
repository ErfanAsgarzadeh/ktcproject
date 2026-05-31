'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';

export default function DashboardLayout({
                                          children, // این متغیر شامل محتوای هر صفحه از داشبورد است
                                        }: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // بررسی لاگین بودن کاربر (محافظت از کل صفحات داشبورد)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/Login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) {
    return (
        <div className=" flex items-center justify-center bg-[#0a0f1d]">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
  }

  // قالب اصلی داشبورد شامل Navbar ثابت و محتوای متغیر
  return (
      <div className=" bg-slate-50 dark:bg-[#0a0f1d] ">
        {/* Navbar ثابت برای تمام صفحات داشبورد */}
        <Navbar />

        {/* محتوای صفحات مختلف در این قسمت قرار می‌گیرد */}
        <main className="  transition-all duration-300 ">
          {children}
        </main>
      </div>
  );
}