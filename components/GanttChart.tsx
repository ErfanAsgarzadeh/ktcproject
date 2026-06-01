/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ProjectNode, ActivityNode, Dependency, ZoomLevel } from '../types/types';
import { parseDateStr, formatDate, isWeekend } from '../utils/scheduler';

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
}: GanttChartProps) {
  const visibleRows = useMemo(() => flattenedNodes.filter(row => !row.isHidden), [flattenedNodes]);

  // Determine timeline boundary dates based on the project spectrum
  const { timelineStart, timelineEnd, calendarDays } = useMemo(() => {
    let minDate = '';
    let maxDate = '';

    flattenedNodes.forEach(({ node }) => {
      if (!node.startDate || !node.endDate) return;
      if (!minDate || node.startDate < minDate) minDate = node.startDate;
      if (!maxDate || node.endDate > maxDate) maxDate = node.endDate;
    });

    // Default to reasonable bounds if empty
    if (!minDate) {
      const today = new Date();
      minDate = formatDate(today);
      const future = new Date();
      future.setDate(future.getDate() + 45);
      maxDate = formatDate(future);
    }

    // Buffer range: Align start to previous Monday, and end to next Friday
    const start = parseDateStr(minDate);
    const dayOfWeek = start.getDay(); // 0 is Sunday, 1 is Mon etc
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    start.setDate(start.getDate() - (daysToSubtract + 7)); // Add extra 1 week buffer

    const end = parseDateStr(maxDate);
    const daysToAdd = 5 - end.getDay();
    end.setDate(end.getDate() + (daysToAdd <= 0 ? 7 : daysToAdd) + 14); // Add extra 2 weeks buffer

    const totalMs = end.getTime() - start.getTime();
    const daysCount = Math.ceil(totalMs / (24 * 60 * 60 * 1000));

    return {
      timelineStart: start,
      timelineEnd: end,
      calendarDays: daysCount,
    };
  }, [flattenedNodes]);

  const timelineStartStr = useMemo(() => formatDate(timelineStart), [timelineStart]);

  // Width variables per columns
  const columnWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return 36;
      case 'week': return 64;
      case 'month': return 120;
    }
  }, [zoomLevel]);

  // Total width of Gantt grid scroll canvas
  const canvasWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return calendarDays * columnWidth;
      case 'week': return Math.ceil(calendarDays / 7) * columnWidth;
      case 'month': return Math.ceil(calendarDays / 30.5) * columnWidth;
    }
  }, [zoomLevel, calendarDays, columnWidth]);

  // Map dates to precise horizontal pixel positions from timeline start.
  // Returns number of calendar days between baseline and target date.
  const getDaysFromBase = (testDateStr: string): number => {
    if (!testDateStr) return 0;
    const testDate = parseDateStr(testDateStr);
    const msDiff = testDate.getTime() - timelineStart.getTime();
    return Math.floor(msDiff / (24 * 60 * 60 * 1000));
  };

  const getX = (dateStr: string): number => {
    const days = getDaysFromBase(dateStr);
    switch (zoomLevel) {
      case 'day':
        return days * columnWidth;
      case 'week':
        return (days / 7) * columnWidth;
      case 'month':
        return (days / 30.43) * columnWidth;
    }
  };

  const getWidth = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr || startStr > endStr) return 0;
    const s = parseDateStr(startStr);
    const e = parseDateStr(endStr);
    const totalDays = Math.ceil((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1; // inclusive

    switch (zoomLevel) {
      case 'day':
        return totalDays * columnWidth;
      case 'week':
        return (totalDays / 7) * columnWidth;
      case 'month':
        return (totalDays / 30.43) * columnWidth;
    }
  };

  // Build TimeScale Headers cells
  const originalHeaders = useMemo(() => {
    const items = [];
    const current = new Date(timelineStart);
    
    if (zoomLevel === 'day') {
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
      if (zoomLevel === 'day') {
        // Label format: "June 2026"
        label = item.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (zoomLevel === 'week') {
        label = item.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        label = item.date.getFullYear().toString();
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

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative select-none">
      {/* 1. Synced Double Header Timescale Row */}
      <div 
        ref={ganttContainerRef}
        onScroll={onGanttScroll}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative"
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
                if (zoomLevel === 'day') {
                  // e.g. "27"
                  label = item.date.getDate().toString();
                } else if (zoomLevel === 'week') {
                  // e.g. "W27"
                  label = `W${item.date.getDate().toString().padStart(2, '0')}`;
                } else {
                  // e.g. "Jun"
                  label = item.date.toLocaleDateString('en-US', { month: 'short' });
                }

                const isWknd = zoomLevel === 'day' && item.isWeekend;

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
          {zoomLevel === 'day' && (
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
                          [{(node as ActivityNode).resources[0]}]
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
