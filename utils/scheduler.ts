/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectNode, WbsNode, ActivityNode, Dependency, CpmData } from '../types/types';


// =====================
// Calendar Helpers
// =====================

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}


// Parse: "YYYY-MM-DD HH:mm"
export function parseDateStr(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split(' ');

  const [year, month, day] = datePart.split('-').map(Number);

  let hours = 0;
  let minutes = 0;

  if (timePart) {
    const [h, m] = timePart.split(':').map(Number);
    hours = h || 0;
    minutes = m || 0;
  }

  return new Date(year, month - 1, day, hours, minutes);
}


// Format: "YYYY-MM-DD HH:mm"
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  return `${y}-${m}-${d} ${hh}:${mm}`;
}


// Adjust to working day
export function adjustToWorkingDay(
    dateStr: string,
    direction: 'forward' | 'backward' = 'forward'
): string {
  const date = parseDateStr(dateStr);

  while (isWeekend(date)) {
    date.setDate(date.getDate() + (direction === 'forward' ? 1 : -1));
  }

  return formatDate(date);
}


// Add working days (keeps time)
export function addWorkingDays(startDateStr: string, duration: number): string {
  if (duration <= 0) return startDateStr;

  const start = parseDateStr(adjustToWorkingDay(startDateStr, 'forward'));
  const baseHour = start.getHours();
  const baseMinute = start.getMinutes();

  let daysAdded = 1;

  while (daysAdded < duration) {
    start.setDate(start.getDate() + 1);

    if (!isWeekend(start)) {
      daysAdded++;
    }
  }

  start.setHours(baseHour, baseMinute);

  return formatDate(start);
}


// Working-day difference
export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);

  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}


// =====================
// WBS Rollups
// =====================

export function performWbsRollups(nodes: ProjectNode[]): ProjectNode[] {
  const nodeMap = new Map<string, ProjectNode>();

  nodes.forEach(n => {
    nodeMap.set(n.id, JSON.parse(JSON.stringify(n)));
  });

  const allNodeIds = Array.from(nodeMap.keys());

  let changed = true;
  let iterations = 0;
  const maxIterations = 20;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const id of allNodeIds) {
      const node = nodeMap.get(id);
      if (!node || node.type !== 'wbs') continue;

      const children = Array.from(nodeMap.values()).filter(n => n.parentId === id);
      if (!children.length) continue;

      let minStart = '';
      let maxEnd = '';
      let totalProgressWeighted = 0;
      let totalDuration = 0;

      for (const child of children) {
        if (!child.startDate || !child.endDate) continue;

        const childStart = parseDateStr(child.startDate);
        const childEnd = parseDateStr(child.endDate);

        if (!minStart || childStart < parseDateStr(minStart)) {
          minStart = child.startDate;
        }

        if (!maxEnd || childEnd > parseDateStr(maxEnd)) {
          maxEnd = child.endDate;
        }

        const duration = child.duration || 1;
        totalDuration += duration;
        totalProgressWeighted += (child.progress || 0) * duration;
      }

      if (minStart && maxEnd) {
        const calculatedDur = calculateWorkingDays(minStart, maxEnd);
        const calculatedProgress =
            totalDuration > 0
                ? Math.round(totalProgressWeighted / totalDuration)
                : 0;

        const wbs = node as WbsNode;

        if (
            wbs.startDate !== minStart ||
            wbs.endDate !== maxEnd ||
            wbs.duration !== calculatedDur ||
            wbs.progress !== calculatedProgress
        ) {
          wbs.startDate = minStart;
          wbs.endDate = maxEnd;
          wbs.duration = calculatedDur;
          wbs.progress = calculatedProgress;
          changed = true;
        }
      }
    }
  }

  return Array.from(nodeMap.values());
}


// =====================
// Hierarchy Flatten
// =====================

export function getFlattenedHierarchyList(
    nodes: ProjectNode[],
    parentId: string | null = null,
    depth = 0,
    collapsedWbsIds: Set<string> = new Set()
): { node: ProjectNode; depth: number; isHidden: boolean }[] {

  const result: { node: ProjectNode; depth: number; isHidden: boolean }[] = [];

  const sortChronologically = (a: ProjectNode, b: ProjectNode) => {
    const timeA = a.startDate ? parseDateStr(a.startDate).getTime() : 0;
    const timeB = b.startDate ? parseDateStr(b.startDate).getTime() : 0;

    if (timeA !== timeB) return timeA - timeB;

    return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
  };

  const wbsChildren = nodes
      .filter(n => n.parentId === parentId && n.type === 'wbs')
      .sort(sortChronologically);

  const actChildren = nodes
      .filter(n => n.parentId === parentId && n.type === 'activity')
      .sort(sortChronologically);

  const children = [...wbsChildren, ...actChildren];

  for (const child of children) {
    const isHidden = collapsedWbsIds.has(parentId || '');

    result.push({
      node: child,
      depth,
      isHidden
    });

    if (child.type === 'wbs') {
      const nextCollapsed = new Set(collapsedWbsIds);

      if (!child.isExpanded || collapsedWbsIds.has(child.parentId || '')) {
        nextCollapsed.add(child.id);
      }

      const sub = getFlattenedHierarchyList(nodes, child.id, depth + 1, nextCollapsed);

      for (const item of sub) {
        result.push({
          node: item.node,
          depth: item.depth,
          isHidden: isHidden || nextCollapsed.has(item.node.parentId || '') || item.isHidden
        });
      }
    }
  }

  return result;
}


// =====================
// CPM Calculation
// =====================

export function calculateCriticalPath(
    nodes: ProjectNode[],
    dependencies: Dependency[]
): Record<string, CpmData> {

  const activities = nodes.filter(n => n.type === 'activity') as ActivityNode[];
  const activityIds = activities.map(a => a.id);

  const result: Record<string, CpmData> = {};

  if (!activities.length) return result;

  let absoluteMinStart = activities[0].startDate;

  for (const act of activities) {
    if (parseDateStr(act.startDate) < parseDateStr(absoluteMinStart)) {
      absoluteMinStart = act.startDate;
    }
  }

  const getDayOffset = (dateStr: string): number =>
      calculateWorkingDays(absoluteMinStart, dateStr) - 1;

  const adjList: Record<string, string[]> = {};
  const revAdjList: Record<string, string[]> = {};

  activityIds.forEach(id => {
    adjList[id] = [];
    revAdjList[id] = [];
  });

  for (const dep of dependencies) {
    if (activityIds.includes(dep.fromId) && activityIds.includes(dep.toId)) {
      adjList[dep.fromId].push(dep.toId);
      revAdjList[dep.toId].push(dep.fromId);
    }
  }

  const inDegree: Record<string, number> = {};
  activityIds.forEach(id => {
    inDegree[id] = revAdjList[id].length;
  });

  const queue = activityIds.filter(id => inDegree[id] === 0);
  const topOrder: string[] = [];

  while (queue.length) {
    const curr = queue.shift()!;
    topOrder.push(curr);

    for (const succ of adjList[curr]) {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    }
  }

  const hasCycle = topOrder.length < activityIds.length;

  const ES: Record<string, number> = {};
  const EF: Record<string, number> = {};

  if (!hasCycle) {

    for (const id of topOrder) {
      const act = activities.find(a => a.id === id)!;
      const duration = act.duration || 1;

      const rootOffset = getDayOffset(act.startDate);

      if (!revAdjList[id].length) {
        ES[id] = Math.max(0, rootOffset);
      } else {
        let maxEF = -1;

        for (const pred of revAdjList[id]) {
          maxEF = Math.max(maxEF, EF[pred]);
        }

        ES[id] = Math.max(rootOffset, maxEF + 1);
      }

      EF[id] = ES[id] + duration - 1;
    }

    const LS: Record<string, number> = {};
    const LF: Record<string, number> = {};

    let maxEF = Math.max(...Object.values(EF));

    for (let i = topOrder.length - 1; i >= 0; i--) {
      const id = topOrder[i];
      const act = activities.find(a => a.id === id)!;
      const duration = act.duration || 1;

      if (!adjList[id].length) {
        LF[id] = maxEF;
      } else {
        let minLS = Infinity;

        for (const succ of adjList[id]) {
          minLS = Math.min(minLS, LS[succ]);
        }

        LF[id] = minLS - 1;
      }

      LS[id] = LF[id] - duration + 1;
    }

    for (const id of activityIds) {
      const tf = LS[id] - ES[id];

      result[id] = {
        earlyStart: ES[id],
        earlyFinish: EF[id],
        lateStart: LS[id],
        lateFinish: LF[id],
        totalFloat: Math.max(0, tf),
        isCritical: tf <= 0
      };
    }

  } else {
    for (const act of activities) {
      const os = getDayOffset(act.startDate);
      const oe = getDayOffset(act.endDate);

      result[act.id] = {
        earlyStart: os,
        earlyFinish: oe,
        lateStart: os,
        lateFinish: oe,
        totalFloat: 0,
        isCritical: false
      };
    }
  }

  return result;
}


// =====================
// Reschedule
// =====================

export function rescheduleProject(
    nodes: ProjectNode[],
    dependencies: Dependency[]
): ProjectNode[] {

  const nodeMap = new Map<string, ProjectNode>();

  nodes.forEach(n => {
    nodeMap.set(n.id, JSON.parse(JSON.stringify(n)));
  });

  const activities = Array.from(nodeMap.values()).filter(n => n.type === 'activity') as ActivityNode[];
  const ids = activities.map(a => a.id);

  const adj: Record<string, string[]> = {};
  const rev: Record<string, string[]> = {};

  ids.forEach(id => {
    adj[id] = [];
    rev[id] = [];
  });

  for (const dep of dependencies) {
    if (ids.includes(dep.fromId) && ids.includes(dep.toId)) {
      adj[dep.fromId].push(dep.toId);
      rev[dep.toId].push(dep.fromId);
    }
  }

  const indeg: Record<string, number> = {};
  ids.forEach(id => (indeg[id] = rev[id].length));

  const queue = ids.filter(id => indeg[id] === 0);
  const order: string[] = [];

  while (queue.length) {
    const curr = queue.shift()!;
    order.push(curr);

    for (const s of adj[curr]) {
      indeg[s]--;
      if (indeg[s] === 0) queue.push(s);
    }
  }

  if (order.length < ids.length) return nodes;

  for (const id of order) {
    const act = nodeMap.get(id) as ActivityNode;
    if (!act) continue;

    let latestFinish = '';

    for (const pred of rev[id]) {
      const p = nodeMap.get(pred) as ActivityNode;
      if (!p) continue;

      if (!latestFinish || parseDateStr(p.endDate) > parseDateStr(latestFinish)) {
        latestFinish = p.endDate;
      }
    }

    if (latestFinish) {
      const next = addWorkingDays(latestFinish, 2);

      if (act.startDate < next) {
        act.startDate = next;
        act.endDate = addWorkingDays(act.startDate, act.duration);
      }
    }
  }

  return performWbsRollups(Array.from(nodeMap.values()));
}