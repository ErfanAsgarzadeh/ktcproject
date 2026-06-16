/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectNode, WbsNode, ActivityNode, Dependency, CpmData } from '../types/types';

// Calendar Helpers (Assuming Monday-Friday are working days)
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function parseDateStr(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // Handle "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" formats
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const timePart = dateStr.includes('T')
      ? dateStr.split('T')[1]
      : dateStr.includes(' ')
          ? dateStr.split(' ')[1]
          : null;

  const [year, month, day] = datePart.split('-').map(Number);

  if (timePart) {
    const timeParts = timePart.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    const seconds = timeParts[2] || 0;
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  return new Date(year, month - 1, day);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date object as "YYYY-MM-DD HH:MM:SS".
 * Used when time precision matters (e.g. comparing dates with hours).
 */
export function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/**
 * Extract only the date part ("YYYY-MM-DD") from a potentially full datetime string.
 */
export function dateOnly(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0].split(' ')[0];
}

// Adjust a date to the next available working day if it falls on a weekend
export function adjustToWorkingDay(dateStr: string, direction: 'forward' | 'backward' = 'forward'): string {
  const date = parseDateStr(dateOnly(dateStr));
  while (isWeekend(date)) {
    date.setDate(date.getDate() + (direction === 'forward' ? 1 : -1));
  }
  return formatDate(date);
}

// Add working days to a start date.
// If duration is 1 day, the finish date equals the start date.
// If duration is 2 days, finish date is next working day.
export function addWorkingDays(startDateStr: string, duration: number): string {
  if (duration <= 0) return startDateStr;
  const date = parseDateStr(adjustToWorkingDay(startDateStr, 'forward'));
  let daysAdded = 1; // start date counts as 1 day

  while (daysAdded < duration) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) {
      daysAdded++;
    }
  }
  return formatDate(date);
}

// Calculate the number of working days between start and finish dates (inclusive)
export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  
  const start = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);
  
  if (start.getTime() > end.getTime()) return 0;
  
  let count = 0;
  const current = new Date(start);
  // Normalize to date-only for day counting
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  
  while (current <= endNorm) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Recursive function to perform date and progress rollups for WBS nodes
export function performWbsRollups(nodes: ProjectNode[]): ProjectNode[] {
  // Create a deep copy of the nodes to avoid side effects
  const nodeMap = new Map<string, ProjectNode>();
  nodes.forEach(n => {
    nodeMap.set(n.id, JSON.parse(JSON.stringify(n)));
  });

  const allNodeIds = Array.from(nodeMap.keys());
  let changed = true;
  
  // We bubble up rollups iteratively until stable (normally depth levels)
  let iterations = 0;
  const maxIterations = 20; // safety ceiling
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const id of allNodeIds) {
      const node = nodeMap.get(id);
      if (!node || node.type !== 'wbs') continue;

      // Find children of this WBS node
      const children = Array.from(nodeMap.values()).filter(n => n.parentId === id);
      if (children.length === 0) continue;

      let minStart = '';
      let maxEnd = '';
      let totalProgressWeighted = 0;
      let totalDuration = 0;

      children.forEach(child => {
        if (!child.startDate || !child.endDate) return;
        
        // Use parsed timestamps for accurate comparison (handles both date-only and datetime strings)
        const childStartMs = parseDateStr(child.startDate).getTime();
        const childEndMs = parseDateStr(child.endDate).getTime();
        const minStartMs = minStart ? parseDateStr(minStart).getTime() : Infinity;
        const maxEndMs = maxEnd ? parseDateStr(maxEnd).getTime() : -Infinity;

        if (!minStart || childStartMs < minStartMs) {
          minStart = child.startDate;
        }
        if (!maxEnd || childEndMs > maxEndMs) {
          maxEnd = child.endDate;
        }

        // Weighted progress based on duration of children
        const duration = child.duration || 1;
        totalDuration += duration;
        totalProgressWeighted += (child.progress || 0) * duration;
      });

      if (minStart && maxEnd) {
        const calculatedDur = calculateWorkingDays(minStart, maxEnd);
        const calculatedProgress = totalDuration > 0 ? Math.round(totalProgressWeighted / totalDuration) : 0;

        const wbs = node as WbsNode;
        if (wbs.startDate !== minStart || wbs.endDate !== maxEnd || wbs.duration !== calculatedDur || wbs.progress !== calculatedProgress) {
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

/**
 * Traverses WBS tree and activity children, establishing sorted list for view display.
 * Employs Preorder Traversal.
 */
/**
 * Traverses WBS tree and activity children, establishing sorted list for view display.
 * Employs Preorder Traversal.
 */
export function getFlattenedHierarchyList(
    nodes: ProjectNode[],
    parentId: string | null = null,
    depth = 0,
    collapsedWbsIds: Set<string> = new Set()
): { node: ProjectNode; depth: number; isHidden: boolean }[] {

  const result: { node: ProjectNode; depth: number; isHidden: boolean }[] = [];

  // تابع کمکی برای مرتب‌سازی زمانی (اول بر اساس تاریخ شروع، سپس بر اساس کد)
  const sortChronologically = (a: ProjectNode, b: ProjectNode) => {
    const timeA = a.startDate ? parseDateStr(a.startDate).getTime() : 0;
    const timeB = b.startDate ? parseDateStr(b.startDate).getTime() : 0;

    if (timeA !== timeB) {
      return timeA - timeB; // مرتب‌سازی صعودی زمان
    }
    return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
  };

  // Filter nodes immediately under this parent
  // In Primavera, WBS nodes are ordered first, then activities under WBS
  const parentWbsChildren = nodes
      .filter(n => n.parentId === parentId && n.type === 'wbs')
      .sort(sortChronologically);

  const parentActivityChildren = nodes
      .filter(n => n.parentId === parentId && n.type === 'activity')
      .sort(sortChronologically);

  // Combined children: WBS then activities (standard schedulers)
  const sortedChildren = [...parentWbsChildren, ...parentActivityChildren];

  sortedChildren.forEach(child => {
    const isHidden = collapsedWbsIds.has(parentId || '');

    result.push({
      node: child,
      depth,
      isHidden: isHidden || collapsedWbsIds.has(child.parentId || '')
    });

    if (child.type === 'wbs') {
      const childCollapsedIds = new Set(collapsedWbsIds);
      // If parent is collapsed or this node is collapsed, pass child expansion down
      if (!child.isExpanded || collapsedWbsIds.has(child.parentId || '')) {
        childCollapsedIds.add(child.id);
      }

      const subTree = getFlattenedHierarchyList(nodes, child.id, depth + 1, childCollapsedIds);

      // Propagate hidden status down
      subTree.forEach(item => {
        result.push({
          node: item.node,
          depth: item.depth,
          isHidden: isHidden || childCollapsedIds.has(item.node.parentId || '') || item.isHidden
        });
      });
    }
  });

  return result;
}/**
 * Critical Path Method (CPM) Forward & Backward Passes.
 * Returns maps of activity IDs to floating variables (ES, EF, LS, LF, Total Float, isCritical).
 */
export function calculateCriticalPath(
  nodes: ProjectNode[],
  dependencies: Dependency[]
): Record<string, CpmData> {
  const activities = nodes.filter(n => n.type === 'activity') as ActivityNode[];
  const activityIds = activities.map(a => a.id);
  const result: Record<string, CpmData> = {};

  if (activities.length === 0) return result;

  // Let's identify the date bounds of the project
  let absoluteMinStart = '';
  let absoluteMinMs = Infinity;
  activities.forEach(act => {
    if (!act.startDate) return;
    const ms = parseDateStr(act.startDate).getTime();
    if (ms < absoluteMinMs) {
      absoluteMinMs = ms;
      absoluteMinStart = act.startDate;
    }
  });

  if (!absoluteMinStart) return result;

  const projectStartDate = parseDateStr(absoluteMinStart);

  // Helper: map dates to continuous day numbers (working days only)
  const getDayOffset = (dateStr: string): number => {
    return calculateWorkingDays(absoluteMinStart, dateStr) - 1;
  };

  // Helper: map day offsets back to Date string (working day counting)
  const getDateFromOffset = (offsetDays: number): string => {
    return addWorkingDays(absoluteMinStart, offsetDays + 1);
  };

  // Build adjacency list for scheduling (direct & reverse)
  const adjList: Record<string, string[]> = {}; // node -> successors
  const revAdjList: Record<string, string[]> = {}; // node -> predecessors

  activityIds.forEach(id => {
    adjList[id] = [];
    revAdjList[id] = [];
  });

  // Load standard dependencies. Silently skip dependencies if target nodes don't exist of if there is circularity
  dependencies.forEach(dep => {
    if (activityIds.includes(dep.fromId) && activityIds.includes(dep.toId)) {
      adjList[dep.fromId].push(dep.toId);
      revAdjList[dep.toId].push(dep.fromId);
    }
  });

  // Cycle detection via Kahn's algorithm
  const inDegree: Record<string, number> = {};
  activityIds.forEach(id => {
    inDegree[id] = revAdjList[id].length;
  });

  const queue: string[] = [];
  activityIds.forEach(id => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const topOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    topOrder.push(curr);

    adjList[curr].forEach(succ => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) {
        queue.push(succ);
      }
    });
  }

  // If topOrder count is less than activities count, we have a cycle. Let's schedule anyway by standard dates
  const hasCycle = topOrder.length < activities.length;

  // Settle on ES and EF first
  const ES: Record<string, number> = {};
  const EF: Record<string, number> = {};

  if (!hasCycle) {
    // Standard CPM Forward Pass
    topOrder.forEach(id => {
      const act = nodes.find(n => n.id === id) as ActivityNode;
      const duration = act.duration || 1;

      // Primary baseline offset from start date
      const rootOffset = getDayOffset(act.startDate);

      if (revAdjList[id].length === 0) {
        ES[id] = rootOffset >= 0 ? rootOffset : 0;
      } else {
        let maxPredEF = -1;
        revAdjList[id].forEach(predId => {
          maxPredEF = Math.max(maxPredEF, EF[predId]);
        });
        // Forward link default is Finish-to-Start. Next task starts the NEXT working day.
        ES[id] = Math.max(rootOffset, maxPredEF + 1);
      }

      EF[id] = ES[id] + duration - 1;
    });

    // CPM Backward Pass
    const LS: Record<string, number> = {};
    const LF: Record<string, number> = {};

    let maxProjectEF = -1;
    activityIds.forEach(id => {
      maxProjectEF = Math.max(maxProjectEF, EF[id]);
    });

    // Reverse topological traversal
    for (let i = topOrder.length - 1; i >= 0; i--) {
      const id = topOrder[i];
      const act = nodes.find(n => n.id === id) as ActivityNode;
      const duration = act.duration || 1;

      if (adjList[id].length === 0) {
        LF[id] = maxProjectEF;
      } else {
        let minSuccLS = Infinity;
        adjList[id].forEach(succId => {
          minSuccLS = Math.min(minSuccLS, LS[succId]);
        });
        LF[id] = minSuccLS - 1;
      }

      LS[id] = LF[id] - duration + 1;
    }

    // Wrap float outputs
    activityIds.forEach(id => {
      const totalFloat = LS[id] - ES[id];
      const isCritical = totalFloat <= 0;
      result[id] = {
        earlyStart: ES[id],
        earlyFinish: EF[id],
        lateStart: LS[id],
        lateFinish: LF[id],
        totalFloat: Math.max(0, totalFloat),
        isCritical
      };
    });

  } else {
    // If there is circular reference link, fall back safely to calendar-derived coordinates
    activities.forEach(act => {
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
    });
  }

  return result;
}

/**
 * Automatically shift dates forward if an predecessor ends later.
 * Solves network dates cleanly.
 */
export function rescheduleProject(
  nodes: ProjectNode[],
  dependencies: Dependency[]
): ProjectNode[] {
  const nodeMap = new Map<string, ProjectNode>();
  nodes.forEach(n => nodeMap.set(n.id, JSON.parse(JSON.stringify(n))));

  const activities = Array.from(nodeMap.values()).filter(n => n.type === 'activity') as ActivityNode[];
  const activityIds = activities.map(a => a.id);

  const adjList: Record<string, string[]> = {};
  const revAdjList: Record<string, string[]> = {};

  activityIds.forEach(id => {
    adjList[id] = [];
    revAdjList[id] = [];
  });

  dependencies.forEach(dep => {
    if (activityIds.includes(dep.fromId) && activityIds.includes(dep.toId)) {
      adjList[dep.fromId].push(dep.toId);
      revAdjList[dep.toId].push(dep.fromId);
    }
  });

  // Solve topological order to push changes forward
  const inDegree: Record<string, number> = {};
  activityIds.forEach(id => {
    inDegree[id] = revAdjList[id].length;
  });

  const queue: string[] = [];
  activityIds.forEach(id => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const topOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    topOrder.push(curr);

    adjList[curr].forEach(succ => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) {
        queue.push(succ);
      }
    });
  }

  // If cycle exists, cancel forward logic safely
  if (topOrder.length < activities.length) {
    return nodes;
  }

  topOrder.forEach(id => {
    const act = nodeMap.get(id) as ActivityNode;
    if (!act || revAdjList[id].length === 0) return;

    // Get latest finish of all predecessors
    let latestPredFinishDate = '';
    let latestPredFinishMs = -Infinity;
    revAdjList[id].forEach(predId => {
      const pred = nodeMap.get(predId) as ActivityNode;
      if (pred && pred.endDate) {
        const predMs = parseDateStr(pred.endDate).getTime();
        if (predMs > latestPredFinishMs) {
          latestPredFinishMs = predMs;
          latestPredFinishDate = pred.endDate;
        }
      }
    });

    if (latestPredFinishDate) {
      // Successor starts on the next working day after predecessor finish
      const nextWorkDay = addWorkingDays(dateOnly(latestPredFinishDate), 2); // 2 means jump to next working day after latestPredFinishDate
      const actStartMs = parseDateStr(act.startDate).getTime();
      const nextWorkDayMs = parseDateStr(nextWorkDay).getTime();
      if (actStartMs < nextWorkDayMs) {
        act.startDate = nextWorkDay;
        act.endDate = addWorkingDays(act.startDate, act.duration);
      }
    }
  });

  return performWbsRollups(Array.from(nodeMap.values()));
}
