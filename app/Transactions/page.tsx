'use client'

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import CostTransactionManager from '@/components/CostTransactionManager';

export default function CostTransactionsPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen w-full flex flex-col " style={{ backgroundColor: 'var(--bg-primary)' }}>
           {/* بخش اصلی نمایش فرم و لایه مدیریت هزینه‌ها */}
            <div className="flex-1  relative">
                <CostTransactionManager />
            </div>

        </div>
    );
}