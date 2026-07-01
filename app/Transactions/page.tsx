'use client'

import React from 'react';
import CostTransactionManager from '@/components/CostTransactionManager';

export default function CostTransactionsPage() {
    return (
        <div className="h-full min-h-0 w-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-1 min-h-0 relative overflow-hidden">
                <CostTransactionManager />
            </div>
        </div>
    );
}
