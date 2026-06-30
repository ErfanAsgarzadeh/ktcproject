'use client'

import React from 'react';
import BudgetManagement from '@/components/BudgetManagement';

export default function BudgetPage() {
    return (
        <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-1 relative">
                <BudgetManagement />
            </div>
        </div>
    );
}
