/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NodeType = 'wbs' | 'activity';

export interface WbsNode {
  id: string;
  code: string; // e.g. "WBS-1" or "1"
  name: string;
  parentId: string | null;
  type: 'wbs';
  isExpanded: boolean;
  // Rolled up from children
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  duration: number; // working days
  progress: number; // 0 to 100
}

export interface ActivityNode {
  id: string;
  code: string; // e.g. "A1000" or "ACT-10"
  name: string;
  parentId: string; // Must always belong to a WBS parent node
  type: 'activity';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  duration: number; // working days
  progress: number; // 0 to 100
  resources: string[]; // fallback assigned resources
  constraintType: 'ASAP' | 'MANDATORY_START' | 'FINISH_NO_LATER_THAN';
  constraintDate?: string | null;
  notes: string;
}

export type ProjectNode = WbsNode | ActivityNode;

export interface Dependency {
  id: string;
  fromId: string; // Activity ID of predecessor
  toId: string;   // Activity ID of successor
  type: 'FS' | 'SS' | 'FF' | 'SF'; // FS = Finish-to-Start (Standard)
  lag: number;    // Days of lag / waiting time
}

export type ZoomLevel = 'hour' |'day' | 'week' | 'month';

export interface CpmData {
  earlyStart: number;  // day index from project start
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;  // Slack in days. 0 means Critical Path!
  isCritical: boolean;
}

export interface ProjectTemplate {
  name: string;
  description: string;
  nodes: ProjectNode[];
  dependencies: Dependency[];
}

export interface CustomUser {
  id: string;
  username: string;
  jobTitle: string;
  employeeCode: string;
}

export interface TaskRole {
  id: string;
  revisionId: string;
  taskId: string;
  userId: string;
  role: 'owner' | 'reviewer' | 'executor' | 'project manager';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Revision {
  id: string;
  projectId: string;
  number: number;
  description: string;
  projectStart: string;
  createdAt: string;
  isBaseline: boolean;
  approvedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  taskId: string;
  userId: string;
  text: string;
  timestamp: string;
}

export interface TaskReport {
  id: string;
  taskId: string;
  userId: string;
  timestamp: string;
  status: 'on-track' | 'at-risk' | 'blocked' | 'completed' | string;
  timeSpentHours?: number;
  progressPercent: number;
  blockers?: string;
  notes?: string;

  // فیلدهای مربوط به سیستم تاییدات (Approvals)
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string; // <--- این خط را اضافه کنید
}


// ==========================================
// ACCORDING TO PYTHON MODEL DESIGN ENTITIES:
// ==========================================

export interface ResourcePool {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ResourceRole {
  id: string;
  name: string;
  description: string;
}

export interface ResourceSkill {
  id: string;
  name: string;
}

export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'COST';

export interface ResourceItem {
  id: string;
  poolId: string | null;
  code: string;
  name: string;
  resourceType: ResourceType;
  roleId: string | null;
  calendarId?: string | null;
  maxUnits: number; // default 100
  priority: number; // default 100
  isActive: boolean;
  createdAt: string;
}

export interface ResourceSkillMapping {
  id: string;
  resourceId: string;
  skillId: string;
  level: number; // default 1
}

export interface ResourceException {
  id: string;
  resourceId: string;
  startDatetime: string;
  finishDatetime: string;
  reason: string;
  isAvailable: boolean;
}

export interface ResourceRate {
  id: string;
  resourceId: string;
  effectiveFrom: string;
  regularRate: number;
  overtimeRate: number;
}

export interface Assignment {
  id: string;
  revisionId: string;
  taskId: string;
  resourceId: string;
  unitsPercent: number; // default 100
  plannedHours: number;
  actualHours: number;
}