'use client';

import React from 'react';
import Link from 'next/link';
import {
    LayoutDashboard,
    ClipboardCheck,
    ListTodo,
    UserCheck,
    BarChart3,
    Users,
    CalendarRange,
    TrendingUp,
} from 'lucide-react';

const pages = [
    {
        title: 'Project Workspace',
        description: 'Gantt chart, WBS tree, CPM scheduling, and full project planning workspace.',
        href: '/DashBoard',
        icon: LayoutDashboard,
        color: '#0d9488',
        bgColor: 'rgba(13, 148, 136, 0.08)',
        borderColor: 'rgba(13, 148, 136, 0.2)',
    },
    {
        title: 'My Tasks',
        description: 'View tasks assigned to you, report progress, and track your workload.',
        href: '/DashBoard/MyTask',
        icon: ListTodo,
        color: '#6366f1',
        bgColor: 'rgba(99, 102, 241, 0.08)',
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    {
        title: 'Approve Tasks',
        description: 'Review and approve task progress reports submitted by team members.',
        href: '/DashBoard/ApproveTask',
        icon: ClipboardCheck,
        color: '#059669',
        bgColor: 'rgba(5, 150, 105, 0.08)',
        borderColor: 'rgba(5, 150, 105, 0.2)',
    },
    {
        title: 'Personal Tasks',
        description: 'Manage your personal to-do list and private tasks outside projects.',
        href: '/DashBoard/PersonalTask',
        icon: UserCheck,
        color: '#d97706',
        bgColor: 'rgba(217, 119, 6, 0.08)',
        borderColor: 'rgba(217, 119, 6, 0.2)',
    },
    {
        title: 'Resource Plan',
        description: 'Plan and assign resources to tasks across project revisions.',
        href: '/DashBoard/ResourcePlan',
        icon: CalendarRange,
        color: '#0ea5e9',
        bgColor: 'rgba(14, 165, 233, 0.08)',
        borderColor: 'rgba(14, 165, 233, 0.2)',
    },
    {
        title: 'Resource Load Map',
        description: 'Visualize resource utilization histogram and detect overloads.',
        href: '/DashBoard/ResourceLoadMap',
        icon: BarChart3,
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.08)',
        borderColor: 'rgba(236, 72, 153, 0.2)',
    },
    {
        title: 'Resource Management',
        description: 'Create and manage resource pools, roles, skills, and rates.',
        href: '/DashBoard/ResourceManagement',
        icon: Users,
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.08)',
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    {
        title: 'Variance Control (EVM)',
        description: 'Earned Value Management dashboard — SPI, CPI, and forecasting.',
        href: '/DashBoard/Variance',
        icon: TrendingUp,
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
];

export default function HomePage() {
    return (
        <div className="h-[calc(100vh-60px)] overflow-y-auto p-6 md:p-10">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-10">
                <h1
                    className="text-2xl md:text-3xl font-bold tracking-tight mb-2"
                    style={{ color: 'var(--text-primary)' }}
                >
                    Dashboard
                </h1>
                <p
                    className="text-sm md:text-base max-w-xl"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    Select a module to get started. Each section provides specialized tools for project planning and control.
                </p>
            </div>

            {/* Cards Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {pages.map((page) => {
                    const Icon = page.icon;
                    return (
                        <Link
                            key={page.href}
                            href={page.href}
                            className="group block rounded-2xl p-5 border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                            style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-medium)',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = page.borderColor;
                                e.currentTarget.style.boxShadow = `0 8px 30px ${page.bgColor}`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-medium)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                        >
                            {/* Icon */}
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                                style={{
                                    backgroundColor: page.bgColor,
                                    border: `1px solid ${page.borderColor}`,
                                }}
                            >
                                <Icon size={22} style={{ color: page.color }} />
                            </div>

                            {/* Title */}
                            <h3
                                className="text-sm font-bold mb-1.5 transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {page.title}
                            </h3>

                            {/* Description */}
                            <p
                                className="text-xs leading-relaxed"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {page.description}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
