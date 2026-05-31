'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {Moon,Sun} from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    // State برای اطمینان از اینکه کامپوننت در کلاینت رندر شده است (جلوگیری از خطای Hydration)
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // تا زمانی که کامپوننت لود نشده، یک فضای خالی با همان ابعاد رندر می‌کنیم
    // تا دکمه‌های کناری هنگام لود شدن جابه‌جا نشوند (جلوگیری از Layout Shift)
    if (!mounted) {
        return <div className="w-9 h-9" />;
    }

    // تابع تغییر تم بین تاریک و روشن
    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none"
            aria-label="تغییر تم"
        >
            {theme === 'dark' ? (
                // آیکون خورشید (هنگامی که در حالت تاریک هستیم نمایش داده می‌شود تا به روشن برگردیم)
                <Moon/>
            ) : (
                // آیکون ماه (هنگامی که در حالت روشن هستیم نمایش داده می‌شود)
                <Sun/>
            )}
        </button>
    );
}