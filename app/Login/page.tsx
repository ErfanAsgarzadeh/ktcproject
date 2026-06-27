'use client';

import { useRouter } from 'next/navigation';
import LoginPage from '@/components/LoginPage'; // مسیر را بر اساس پروژه خودتون تنظیم کنید
import { useTheme } from 'next-themes';
import { CustomUser } from '@/types/types';

export default function LoginRoute() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    // این تابع بعد از اینکه توکن با موفقیت از بک‌اند گرفته شد اجرا میشه
    const handleLoginSuccess = (user: CustomUser) => {
        // میتونید اطلاعات کاربر رو در Context یا State منیجر ذخیره کنید
        // و بعد کاربر رو به صفحه داشبورد بفرستید
        router.push('/Home');
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <LoginPage
            users={[]} // چون دیگه از دیتابیس بک‌اند میخونیم نیازی به دیتای فیک اینجا نیست
            onLoginSuccess={handleLoginSuccess}
            isLightMode={theme === 'light'}
            onToggleTheme={toggleTheme}
        />
    );
}