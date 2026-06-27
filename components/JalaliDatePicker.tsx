/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JalaliDatePicker — a dependency-free Persian (Shamsi) date picker.
 *
 * - `value`    : Gregorian ISO string "YYYY-MM-DD" (what the backend uses)
 * - `onChange` : called with a Gregorian ISO string "YYYY-MM-DD"
 *
 * The calendar popup is rendered through a React portal (to <body>) with
 * fixed positioning, so it is NEVER clipped by overflow-hidden / backdrop-blur
 * ancestors and always sits above other layers.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  JALALI_MONTHS,
  isoToJalaliParts,
  jalaliPartsToIso,
  jalaliMonthLength,
  jalaliToGregorian,
  todayJalali,
  gregorianToJalaliString,
} from '../utils/jalali';

interface JalaliDatePickerProps {
  value?: string | null;            // Gregorian "YYYY-MM-DD"
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const WEEK_HEADERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // شنبه..جمعه
const POPUP_WIDTH = 248;
const POPUP_HEIGHT = 320;

function jalaliStartWeekday(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7; // Persian week starts Saturday
}

export default function JalaliDatePicker({
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  placeholder = 'انتخاب تاریخ',
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const selected = useMemo(() => isoToJalaliParts(value), [value]);

  const [viewYear, setViewYear] = useState<number>(selected?.jy ?? todayJalali().jy);
  const [viewMonth, setViewMonth] = useState<number>(selected?.jm ?? todayJalali().jm);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.jy);
      setViewMonth(selected.jm);
    }
  }, [selected?.jy, selected?.jm]);

  // Compute popup position from the trigger rect (fixed coordinates)
  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let top = rect.bottom + 4;
    // Flip above if not enough room below
    if (top + POPUP_HEIGHT > window.innerHeight && rect.top - POPUP_HEIGHT - 4 > 0) {
      top = rect.top - POPUP_HEIGHT - 4;
    }
    let left = rect.left;
    // Keep within viewport horizontally
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - POPUP_WIDTH - 8);
    }
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  // Close on outside click (consider both trigger and popup)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        popupRef.current && !popupRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayText = value ? gregorianToJalaliString(value) : '';

  const goPrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleSelectDay = (day: number) => {
    onChange(jalaliPartsToIso(viewYear, viewMonth, day));
    setOpen(false);
  };

  const monthLength = jalaliMonthLength(viewYear, viewMonth);
  const startWeekday = jalaliStartWeekday(viewYear, viewMonth);
  const today = todayJalali();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= monthLength; d++) cells.push(d);

  const popup = open ? createPortal(
    <div
      ref={popupRef}
      dir="rtl"
      className="fixed p-3 rounded-xl"
      style={{
        top: coords.top,
        left: coords.left,
        width: POPUP_WIDTH,
        zIndex: 9999,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Header: month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={goPrevMonth} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
          {JALALI_MONTHS[viewMonth - 1]} {viewYear}
        </span>
        <button type="button" onClick={goNextMonth} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_HEADERS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: 'var(--text-tertiary)' }}>
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const isSelected = selected && selected.jy === viewYear && selected.jm === viewMonth && selected.jd === day;
          const isToday = today.jy === viewYear && today.jm === viewMonth && today.jd === day;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectDay(day)}
              className="aspect-square flex items-center justify-center text-[11px] rounded-lg transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--text-accent)' : 'transparent',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                border: isToday && !isSelected ? '1px solid var(--text-accent)' : '1px solid transparent',
                fontWeight: isSelected || isToday ? 700 : 400,
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer: Today shortcut */}
      <div className="mt-3 pt-2 flex justify-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => {
            const t = todayJalali();
            onChange(jalaliPartsToIso(t.jy, t.jm, t.jd));
            setOpen(false);
          }}
          className="text-[10px] font-mono px-3 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-accent)', backgroundColor: 'var(--overlay-bg)' }}
        >
          Today
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" dir="rtl">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 text-left  ${className}`}
        style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-medium)',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          color: 'var(--text-primary)',
        }}
      >
        <span className={displayText ? '' : 'opacity-50'} style={{ fontFamily: 'var(--font-mono)' }}>
          {displayText || placeholder}
        </span>
        <CalendarIcon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-accent)' }} />
      </button>

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        />
      )}

      {popup}
    </div>
  );
}
