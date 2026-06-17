/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { ProjectNode, ActivityNode, Dependency, ZoomLevel } from '../types/types';
import { parseDateStr, formatDate, isWeekend } from '../utils/scheduler';
import { jalaliFromDate, JALALI_MONTHS, JALALI_WEEKDAYS } from '../utils/jalali';
import { ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';

interface GanttChartProps {
  flattenedNodes: { node: ProjectNode; depth: number; isHidden: boolean }[];
  dependencies: Dependency[];
  zoomLevel: ZoomLevel;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  showCriticalPath: boolean;
  onGanttScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  ganttContainerRef: React.RefObject<HTMLDivElement | null>;
  isEditMode?: boolean;
  projectStart?: string | null;   // revision/project start (Gregorian)
  projectEnd?: string | null;     // revision/project end (Gregorian)
}

export default function GanttChart({
                                     flattenedNodes,
                                     dependencies,
                                     zoomLevel,
                                     selectedNodeId,
                                     onSelectNode,
                                     showCriticalPath,
                                     onGanttScroll,
                                     ganttContainerRef,
                                     isEditMode = true,
                                     projectStart,
                                     projectEnd,
                                   }: GanttChartProps) {
  const visibleRows = useMemo(() => flattenedNodes.filter(row => !row.isHidden), [flattenedNodes]);

  // Determine timeline boundary dates: from project start → last task end
  const { timelineStart, timelineEnd, calendarDays } = useMemo(() => {
    let minDate = '';
    let maxDate = '';
    let minMs = Infinity;
    let maxMs = -Infinity;

    // Seed with the project/revision start & end if provided
    const seedStart = projectStart ? projectStart.split('T')[0].split(' ')[0] : '';
    const seedEnd = projectEnd ? projectEnd.split('T')[0].split(' ')[0] : '';
    if (seedStart) { minMs = parseDateStr(seedStart).getTime(); minDate = seedStart; }
    if (seedEnd) { maxMs = parseDateStr(seedEnd).getTime(); maxDate = seedEnd; }

    flattenedNodes.forEach(({ node }) => {
      if (!node.startDate || !node.endDate) return;
      const startMs = parseDateStr(node.startDate).getTime();
      const endMs = parseDateStr(node.endDate).getTime();
      if (startMs < minMs) { minMs = startMs; minDate = node.startDate; }
      if (endMs > maxMs) { maxMs = endMs; maxDate = node.endDate; }
    });

    // Default to reasonable bounds if empty
    if (!minDate) {
      const today = new Date();
      minDate = formatDate(today);
      const future = new Date();
      future.setDate(future.getDate() + 45);
      maxDate = formatDate(future);
    }

    const startDateOnly = minDate.split('T')[0].split(' ')[0];
    const endDateOnly   = maxDate.split('T')[0].split(' ')[0];

    // Small leading buffer (2 days) so the project start sits near the left edge
    const start = parseDateStr(startDateOnly);
    start.setDate(start.getDate() - 2);

    // Small trailing buffer (7 days) after the last task / project end
    const end = parseDateStr(endDateOnly);
    end.setDate(end.getDate() + 7);

    const totalMs = end.getTime() - start.getTime();
    const daysCount = Math.max(1, Math.ceil(totalMs / (24 * 60 * 60 * 1000)));

    return {
      timelineStart: start,
      timelineEnd: end,
      calendarDays: daysCount,
    };
  }, [flattenedNodes, projectStart, projectEnd]);

  const timelineStartStr = useMemo(() => formatDate(timelineStart), [timelineStart]);

  // Width variables per columns
  const columnWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'hour': return 40;
      case 'day': return 36;
      case 'week': return 64;
      case 'month': return 120;
    }
  }, [zoomLevel]);

  // Total width of Gantt grid scroll canvas
  const canvasWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'hour': return Math.min(calendarDays, 14) * 24 * columnWidth;
      case 'day': return calendarDays * columnWidth;
      case 'week': return Math.ceil(calendarDays / 7) * columnWidth;
      case 'month': return Math.ceil(calendarDays / 30.5) * columnWidth;
    }
  }, [zoomLevel, calendarDays, columnWidth]);

  // Parse a date string that may include a time component.
  // Supports both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" formats.
  const parseDateTimeStr = (str: string): Date => {
    if (!str) return new Date(NaN);
    // Normalise: replace space separator with 'T' so Date constructor handles it
    const normalised = str.trim().replace(' ', 'T');
    const d = new Date(normalised);
    // Fallback: strip time part and use parseDateStr if still invalid
    if (isNaN(d.getTime())) return parseDateStr(str.split(' ')[0]);
    return d;
  };

  // Returns elapsed milliseconds from timelineStart to the given datetime string.
  const getMsFromBase = (dateStr: string): number => {
    if (!dateStr) return 0;
    const d = parseDateTimeStr(dateStr);
    return d.getTime() - timelineStart.getTime();
  };

  // Convert a datetime string to a pixel X position on the canvas.
  // Hour zoom: every column = 1 hour = columnWidth px  → use ms precision
  // Day zoom : every column = 1 day                   → snap to day
  // Week/Month: proportional to days
  const getX = (dateStr: string): number => {
    const ms = getMsFromBase(dateStr);
    const MS_PER_HOUR = 60 * 60 * 1000;
    const MS_PER_DAY  = 24 * MS_PER_HOUR;

    switch (zoomLevel) {
      case 'hour':
        // Each columnWidth = 1 hour; use full ms precision so 10:03 ≠ 10:00
        return (ms / MS_PER_HOUR) * columnWidth;
      case 'day':
        return (ms / MS_PER_DAY) * columnWidth;
      case 'week':
        return (ms / MS_PER_DAY / 7) * columnWidth;
      case 'month':
        return (ms / MS_PER_DAY / 30.43) * columnWidth;
    }
  };

  // Width of a bar from startStr to endStr using exact ms difference (no +1 day).
  // For day/week/month zoom the old +1-day inclusive rounding is preserved for
  // whole-day tasks; for hour zoom we use the raw duration in hours.
  const getWidth = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const s = parseDateTimeStr(startStr);
    const e = parseDateTimeStr(endStr);
    const durationMs = e.getTime() - s.getTime();
    if (durationMs <= 0) return 0;

    const MS_PER_HOUR = 60 * 60 * 1000;
    const MS_PER_DAY  = 24 * MS_PER_HOUR;

    switch (zoomLevel) {
      case 'hour':
        // Exact hour-precision width — no rounding up to whole days
        return (durationMs / MS_PER_HOUR) * columnWidth;
      case 'day': {
        // +1 inclusive only for whole-day tasks (no time component)
        const hasTime = startStr.includes(':') && startStr.split(' ')[1] !== '00:00:00';
        const totalDays = hasTime
            ? durationMs / MS_PER_DAY
            : Math.ceil(durationMs / MS_PER_DAY) + 1;
        return totalDays * columnWidth;
      }
      case 'week':
        return (durationMs / MS_PER_DAY / 7) * columnWidth;
      case 'month':
        return (durationMs / MS_PER_DAY / 30.43) * columnWidth;
    }
  };

  // Build TimeScale Headers cells
  const originalHeaders = useMemo(() => {
    const items = [];
    const current = new Date(timelineStart);

    if (zoomLevel === 'hour') {
      // Show a 14-day window around the actual data rather than the buffer start.
      // timelineStart is padded back ~3 weeks; start the hour columns from there
      // but cap total columns to 14 days (336 columns) for performance.
      const hourEnd = new Date(timelineStart);
      hourEnd.setDate(hourEnd.getDate() + 14);
      const cap = hourEnd < timelineEnd ? hourEnd : timelineEnd;
      while (current <= cap) {
        items.push({
          date: new Date(current),
          isWeekend: isWeekend(current),
          dateStr: formatDate(current),
          hour: current.getHours(),
        });
        current.setHours(current.getHours() + 1);
      }
    } else if (zoomLevel === 'day') {
      while (current <= timelineEnd) {
        items.push({
          date: new Date(current),
          isWeekend: isWeekend(current),
          dateStr: formatDate(current),
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (zoomLevel === 'week') {
      // Step weekly
      while (current <= timelineEnd) {
        items.push({
          date: new Date(current),
          dateStr: formatDate(current),
        });
        current.setDate(current.getDate() + 7);
      }
    } else if (zoomLevel === 'month') {
      // Step monthly
      while (current <= timelineEnd) {
        items.push({
          date: new Date(current),
          dateStr: formatDate(current),
        });
        current.setMonth(current.getMonth() + 1);
      }
    }
    return items;
  }, [zoomLevel, timelineStart, timelineEnd]);

  // Group Top Scale labels: Month titles + Year titles
  const parentHeaders = useMemo(() => {
    const groups: { label: string; width: number }[] = [];
    if (originalHeaders.length === 0) return [];

    let currentLabel = '';
    let currentWidth = 0;

    originalHeaders.forEach((item, index) => {
      let label = '';
      if (zoomLevel === 'hour') {
        // Group by day: "سه‌شنبه ۲۷ خرداد"
        const j = jalaliFromDate(item.date);
        label = `${JALALI_WEEKDAYS[item.date.getDay()]} ${j.jd} ${JALALI_MONTHS[j.jm - 1]}`;
      } else if (zoomLevel === 'day') {
        // Label format: "خرداد ۱۴۰۵"
        const j = jalaliFromDate(item.date);
        label = `${JALALI_MONTHS[j.jm - 1]} ${j.jy}`;
      } else if (zoomLevel === 'week') {
        const j = jalaliFromDate(item.date);
        label = `${JALALI_MONTHS[j.jm - 1]} ${j.jy}`;
      } else {
        // Jalali year
        label = jalaliFromDate(item.date).jy.toString();
      }

      if (index === 0) {
        currentLabel = label;
        currentWidth = columnWidth;
      } else if (label === currentLabel) {
        currentWidth += columnWidth;
      } else {
        groups.push({ label: currentLabel, width: currentWidth });
        currentLabel = label;
        currentWidth = columnWidth;
      }

      if (index === originalHeaders.length - 1) {
        groups.push({ label: currentLabel, width: currentWidth });
      }
    });

    return groups;
  }, [originalHeaders, zoomLevel, columnWidth]);

  // Compute dependency link paths
  const linkPaths = useMemo(() => {
    const paths: { path: string; isCritical: boolean; key: string }[] = [];
    const visibleNodeIds = visibleRows.map(r => r.node.id);
    const nodeIndexMap = new Map<string, number>();

    visibleRows.forEach((row, i) => {
      nodeIndexMap.set(row.node.id, i);
    });

    dependencies.forEach(dep => {
      const fromIdx = nodeIndexMap.get(dep.fromId);
      const toIdx = nodeIndexMap.get(dep.toId);

      if (fromIdx !== undefined && toIdx !== undefined) {
        const fromNode = flattenedNodes.find(n => n.node.id === dep.fromId)?.node;
        const toNode = flattenedNodes.find(n => n.node.id === dep.toId)?.node;

        if (!fromNode || !toNode) return;

        // xCoordinates
        const fromRight = getX(fromNode.endDate) + getWidth(fromNode.startDate, fromNode.endDate);
        const toLeft = getX(toNode.startDate);

        // yCoordinates (Row heights are 40px, cell center is +20)
        const y1 = fromIdx * 40 + 20;
        const y2 = toIdx * 40 + 20;

        // Is both nodes critical?
        const isCritical = showCriticalPath &&
            (fromNode as any).isCritical &&
            (toNode as any).isCritical;

        // Drawing Orthogonal Step curves: Step right, step up/down, step right
        let path = '';
        const stepOffset = 14;

        if (toLeft >= fromRight + stepOffset) {
          // Normal gap: rightwards FS link flow
          const midX = fromRight + (toLeft - fromRight) / 2;
          path = `M ${fromRight} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${toLeft} ${y2}`;
        } else {
          // Overlap: successor starts before predecessor finishes (reversing lag or error)
          const midY = y1 + (y2 - y1) / 2;
          const curveX1 = fromRight + stepOffset;
          const curveX2 = toLeft - stepOffset;
          path = `M ${fromRight} ${y1} L ${curveX1} ${y1} L ${curveX1} ${midY} L ${curveX2} ${midY} L ${curveX2} ${y2} L ${toLeft} ${y2}`;
        }

        paths.push({
          path,
          isCritical,
          key: `${dep.id}-${fromNode.id}-${toNode.id}`
        });
      }
    });

    return paths;
  }, [dependencies, visibleRows, zoomLevel, showCriticalPath, flattenedNodes]);

  // ─────────────────────────────────────────
  // Drag-to-pan (grab & move horizontally/vertically)
  // ─────────────────────────────────────────
  const isPanning = useRef(false);
  const didPan = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left button only
    const el = ganttContainerRef.current;
    if (!el) return;
    isPanning.current = true;
    didPan.current = false;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  }, [ganttContainerRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    const el = ganttContainerRef.current;
    if (!el) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didPan.current = true;
    el.scrollLeft = panStart.current.scrollLeft - dx;
    el.scrollTop = panStart.current.scrollTop - dy;
  }, [ganttContainerRef]);

  const endPan = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Suppress row click if a pan/drag just happened
  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (didPan.current) {
      e.stopPropagation();
      e.preventDefault();
      didPan.current = false;
    }
  }, []);

  // Mouse-wheel → horizontal scroll when Shift is held (native), and
  // expose smooth scroll buttons for explicit left/right navigation.
  const scrollByAmount = useCallback((amount: number) => {
    const el = ganttContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, [ganttContainerRef]);

  // Recenter: scroll back to the project start (or today if it's in range).
  const goToStart = useCallback(() => {
    const el = ganttContainerRef.current;
    if (!el) return;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Prefer "today" if it falls within the visible timeline, else project start.
    const now = new Date();
    let targetMs = now.getTime();
    if (now < timelineStart || now > timelineEnd) {
      // jump to the project/timeline start instead
      targetMs = timelineStart.getTime();
    }
    const daysFromStart = (targetMs - timelineStart.getTime()) / MS_PER_DAY;

    let x = 0;
    switch (zoomLevel) {
      case 'hour': x = daysFromStart * 24 * columnWidth; break;
      case 'day': x = daysFromStart * columnWidth; break;
      case 'week': x = (daysFromStart / 7) * columnWidth; break;
      case 'month': x = (daysFromStart / 30.43) * columnWidth; break;
    }
    // leave a little padding on the left
    el.scrollTo({ left: Math.max(0, x - 80), behavior: 'smooth' });
  }, [ganttContainerRef, timelineStart, timelineEnd, zoomLevel, columnWidth]);

  return (
      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative select-none">
        {/* ◀ ▶ Floating navigation buttons */}
        <button
            type="button"
            onClick={() => scrollByAmount(-Math.max(300, columnWidth * 6))}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-accent)' }}
            title="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
            type="button"
            onClick={() => scrollByAmount(Math.max(300, columnWidth * 6))}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-accent)' }}
            title="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Recenter / "Go to start" button */}
        <button
            type="button"
            onClick={goToStart}
            className="absolute right-2 top-2 z-30 flex items-center gap-1.5 px-3 h-8 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 text-[11px] font-bold"
            style={{ backgroundColor: 'var(--text-accent)', color: '#ffffff', border: '1px solid var(--border-medium)' }}
            title="بازگشت به شروع پروژه / امروز"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>برو به شروع</span>
        </button>

        {/* 1. Synced Double Header Timescale Row */}
        <div
            ref={ganttContainerRef}
            onScroll={onGanttScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={endPan}
            onMouseLeave={endPan}
            onClickCapture={handleClickCapture}
            className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative cursor-grab active:cursor-grabbing"
        >
          <div style={{ width: `${canvasWidth}px` }} className="relative h-full">

            {/* Timescale headers wrapper */}
            <div className="sticky top-0 z-20 bg-white/5 backdrop-blur-md border-b border-white/10">
              {/* Top scale (Months / Years labels) */}
              <div className="h-6 border-b border-white/5 flex text-[10px] font-mono text-slate-300 select-none items-center">
                {parentHeaders.map((p, idx) => (
                    <div
                        key={idx}
                        style={{ width: `${p.width}px` }}
                        className="px-2 truncate border-r border-white/5 text-left shrink-0 py-0.5 font-medium"
                    >
                      {p.label}
                    </div>
                ))}
              </div>

              {/* Bottom scale (Days / Week indices / Month lists) */}
              <div className="h-6 flex text-[9px] font-mono font-medium text-slate-400 select-none items-center">
                {originalHeaders.map((item, idx) => {
                  let label = '';
                  if (zoomLevel === 'hour') {
                    // e.g. "09" or "14"
                    label = item.date.getHours().toString().padStart(2, '0');
                  } else if (zoomLevel === 'day') {
                    // Jalali day-of-month e.g. "27"
                    label = jalaliFromDate(item.date).jd.toString();
                  } else if (zoomLevel === 'week') {
                    // Jalali day-of-month for the week start
                    label = `${jalaliFromDate(item.date).jd}`;
                  } else {
                    // Jalali month short name
                    label = JALALI_MONTHS[jalaliFromDate(item.date).jm - 1];
                  }

                  const isWknd = (zoomLevel === 'day' || zoomLevel === 'hour') && item.isWeekend;

                  return (
                      <div
                          key={idx}
                          style={{ width: `${columnWidth}px` }}
                          className={`text-center h-full border-r border-white/5 flex items-center justify-center shrink-0 py-0.5 ${
                              isWknd ? 'bg-white/5 text-cyan-400/80 font-semibold' : ''
                          }`}
                      >
                        {label}
                      </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Vertical grid lines background (Visible weekends only in day zoom for extra elegance) */}
            {(zoomLevel === 'day' || zoomLevel === 'hour') && (
                <div className="absolute top-12 bottom-0 left-0 right-0 pointer-events-none flex">
                  {originalHeaders.map((item, idx) => (
                      <div
                          key={idx}
                          style={{ width: `${columnWidth}px` }}
                          className={`border-r border-white/5 h-full shrink-0 ${
                              item.isWeekend ? 'bg-white/[0.02]' : ''
                          }`}
                      />
                  ))}
                </div>
            )}

            {/* 3. Gantt SVG Dependency Lines */}
            <svg
                style={{ width: `${canvasWidth}px`, height: `${visibleRows.length * 40 + 44}px` }}
                className="absolute top-12 left-0 pointer-events-none z-10"
            >
              <defs>
                {/* Slate Gray normal arrow head */}
                <marker id="arrow-gray" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
                </marker>
                {/* Rose Red critical arrow head */}
                <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                </marker>
              </defs>

              {linkPaths.map(link => (
                  <path
                      key={link.key}
                      d={link.path}
                      fill="none"
                      stroke={link.isCritical ? '#ef4444' : '#06b6d4'}
                      strokeWidth={link.isCritical ? '2' : '1.25'}
                      strokeDasharray={link.isCritical ? '0' : '2.1'}
                      markerEnd={link.isCritical ? 'url(#arrow-red)' : 'url(#arrow-gray)'}
                      className="transition-all duration-300"
                  />
              ))}
            </svg>

            {/* 4. Bars container list */}
            <div className="absolute top-12 left-0 right-0 flex flex-col z-0">
              {visibleRows.map(({ node }) => {
                const startX = getX(node.startDate);
                const barWidth = Math.max(8, getWidth(node.startDate, node.endDate));
                const isWbs = node.type === 'wbs';
                const isSelected = selectedNodeId === node.id;
                const isCritical = (node as any).isCritical;

                return (
                    <div
                        key={`${node.type}-${node.id}`}
                        onClick={() => onSelectNode(node.id)}
                        className={`h-10 border-b border-white/5 relative w-full flex items-center shrink-0 cursor-pointer transition-colors ${
                            isSelected ? 'bg-cyan-500/5' : 'hover:bg-white/5'
                        }`}
                    >
                      {/* Visual Bar Elements */}
                      {isWbs ? (
                          /* SUMMARY WBS Row (Standard black flat brackets) */
                          <div
                              style={{ left: `${startX}px`, width: `${barWidth}px` }}
                              className="absolute h-3 top-3.5 z-10 select-none group"
                          >
                            {/* Black brackets bar */}
                            <div className="absolute left-0 right-0 top-1 h-1.5 bg-cyan-400 rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                            {/* Left diamond end bracket */}
                            <div className="absolute left-0 top-0 w-3 h-3 bg-cyan-200 rotate-45 border border-cyan-500" />
                            {/* Right diamond end bracket */}
                            <div className="absolute right-0 top-1.5 w-3 h-3 bg-cyan-205 rotate-45 border border-cyan-500" />
                            {/* Rollup Name flag inside or next */}
                            <span className="absolute left-1.5 -top-5.5 text-[10px] font-sans font-semibold text-slate-300 whitespace-nowrap scale-95 uppercase tracking-wide">
                        {node.code} ({node.progress}%)
                      </span>
                          </div>
                      ) : (
                          /* ACTIVITY terminal row (Standard blue/green or CPM critical path crimson) */
                          <div
                              style={{ left: `${startX}px`, width: `${barWidth}px` }}
                              className={`absolute h-5 rounded hover:scale-[1.01] hover:shadow-lg shadow-cyan-500/10 border overflow-hidden select-none flex items-center group transition-all duration-300 backdrop-blur-xs ${
                                  isCritical
                                      ? 'bg-rose-950/40 border-rose-500'
                                      : 'bg-cyan-950/40 border-cyan-500/50'
                              }`}
                          >
                            {/* Render overlay showing work progress % */}
                            <div
                                style={{ width: `${node.progress}%` }}
                                className={`h-full opacity-70 ${
                                    isCritical ? 'bg-rose-550' : 'bg-cyan-500'
                                }`}
                            />

                            {/* Overlap stats indicators */}
                            <div className="absolute inset-0 px-2 flex items-center justify-between text-[9px] font-mono text-white/90 drop-shadow select-none">
                              <span>{node.code}</span>
                              {barWidth > 45 && (
                                  <span className="font-bold">{node.progress}%</span>
                              )}
                            </div>
                          </div>
                      )}

                      {/* Right hand informational label next to Gantt activity bars */}
                      {!isWbs && (
                          <span
                              style={{ left: `${startX + barWidth + 8}px` }}
                              className="absolute text-[10px] text-slate-350 truncate max-w-sm font-sans select-none pointer-events-none whitespace-nowrap mt-0.5"
                          >
                      {node.name}
                            {((node as ActivityNode).resources && (node as ActivityNode).resources.length > 0) && (
                                <span className="text-slate-400 font-medium ml-1.5 font-mono px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md backdrop-blur-sm">
      [{typeof (node as ActivityNode).resources[0] === 'object'
                                    ? (node as ActivityNode).resources[0].name
                                    : (node as ActivityNode).resources[0]}]
    </span>
                            )}
                    </span>
                      )}
                    </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
  );
}
