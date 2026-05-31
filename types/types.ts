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

export type ZoomLevel = 'day' | 'week' | 'month';

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
