'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    if (!mounted) return <div className="w-9 h-9" />;

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            }}
        >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
            {isDark ? 'LIGHT' : 'DARK'}
        </button>
    );
}
