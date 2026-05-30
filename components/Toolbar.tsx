/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { 
  Play, 
  Layers, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  ZoomIn, 
  Settings, 
  Printer, 
  FileJson, 
  AlertTriangle,
  FolderPlus,
  GitCommit,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  Sparkles,
  Eye,
  Edit3,
  ServerCog
} from 'lucide-react';
import { ZoomLevel, ProjectNode, Dependency } from '../types/types';

interface ToolbarProps {
  projectName: string;
  revisionNumber: number;
  onExitToHub: () => void;
  zoomLevel: ZoomLevel;
  onSelectZoom: (zoom: ZoomLevel) => void;
  showCriticalPath: boolean;
  onToggleCriticalPath: () => void;
  autoSchedule: boolean;
  onToggleAutoSchedule: () => void;
  onRunF9Scheduler: () => void;
  nodes: ProjectNode[];
  dependencies: Dependency[];
  selectedNodeId: string | null;
  onAddWbs: () => void;
  onAddActivity: () => void;
  onDeleteSelected: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  ganttFilter: 'both' | 'wbs' | 'activity';
  onSelectGanttFilter: (filter: 'both' | 'wbs' | 'activity') => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onLaunchToBackend: () => void;
}

export default function Toolbar({
  projectName,
  revisionNumber,
  onExitToHub,
  zoomLevel,
  onSelectZoom,
  showCriticalPath,
  onToggleCriticalPath,
  autoSchedule,
  onToggleAutoSchedule,
  onRunF9Scheduler,
  nodes,
  dependencies,
  selectedNodeId,
  onAddWbs,
  onAddActivity,
  onDeleteSelected,
  onExportCsv,
  onExportJson,
  onImportJson,
  onPrint,
  ganttFilter,
  onSelectGanttFilter,
  isEditMode,
  onToggleEditMode,
  onLaunchToBackend,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive metrics
  const totalWbs = nodes.filter(n => n.type === 'wbs').length;
  const totalActivities = nodes.filter(n => n.type === 'activity').length;
  const projectRoot = nodes.find(n => n.parentId === null && n.type === 'wbs') || nodes[0];
  
  const projectStart = projectRoot?.startDate || '—';
  const projectEnd = projectRoot?.endDate || '—';
  const projectDuration = projectRoot?.duration || 0;
  const projectProgress = projectRoot?.progress || 0;

  // Count active critical path tasks (under simple CPM run)
  const isCriticalCount = nodes.filter(n => n.type === 'activity' && (n as any).isCritical).length;
  const criticalPercent = totalActivities > 0 ? Math.round((isCriticalCount / totalActivities) * 100) : 0;

  return (
    <header className="bg-white/5 backdrop-blur-md text-slate-100 border-b border-white/10 p-4 flex flex-col gap-3 shrink-0 shadow-xl select-none z-20">
      {/* Top Bar: Title & Primary Templates & Critical Path & F9 Solver */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onExitToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all text-xs cursor-pointer"
            title="Return to Projects & Revisions Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Project Hub</span>
          </button>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <div className="bg-cyan-500 rounded-lg w-8 h-8 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
            P
          </div>
          <div>
            <h1 className="text-lg font-semibold font-sans tracking-tight text-white flex items-center gap-2">
              Nexus Enterprise
              <span className="text-xs font-mono font-normal text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
                / {projectName}
              </span>
            </h1>
          </div>
        </div>

        {/* Active Revision Identifier */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
            Active Revision Level:
          </span>
          <span className="text-xs font-bold text-cyan-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-mono tracking-wider shadow-inner">
            Rev {revisionNumber}
          </span>
        </div>

        {/* TimeScale Zoom & Active Critical Actions */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Dark Mode Theme Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 bg-black/20 rounded-lg border border-white/10 shadow-inner backdrop-blur-sm cursor-default select-none" title="Cosmic Slate Dark Theme Active">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Dark Theme</span>
          </div>

          {/* Gantt View Scope */}
          <div className="flex items-center bg-black/20 rounded-lg border border-white/10 p-0.5 shadow-inner backdrop-blur-sm" title="Filters left table and Gantt grid view scope">
            {[
              { id: 'both', label: 'WBS & Tasks' },
              { id: 'wbs', label: 'WBS Only' },
              { id: 'activity', label: 'Tasks Only' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => onSelectGanttFilter(f.id as 'both' | 'wbs' | 'activity')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                  ganttFilter === f.id
                    ? 'bg-white/10 text-white border border-white/10 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Zoom scale */}
          <div className="flex items-center bg-black/20 rounded-lg border border-white/10 p-0.5 shadow-inner backdrop-blur-sm">
            {(['day', 'week', 'month'] as ZoomLevel[]).map(level => (
              <button
                key={level}
                onClick={() => onSelectZoom(level)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                  zoomLevel === level
                    ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {level}s
              </button>
            ))}
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={onToggleCriticalPath}
            title="Highlights activities with zero total float in red on the Gantt timeline."
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all backdrop-blur-sm ${
              showCriticalPath
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30 font-semibold'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-rose-400' : 'text-slate-400'}`} />
            <span>Critical Path</span>
          </button>

          {/* Primavera F9 Solve Network dates */}
          <button
            onClick={onRunF9Scheduler}
            title="Primavera F9: Solves CPM forward/backward passes and pushes dates to respect Finish-to-Start lags."
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-205 border border-cyan-500/30 shadow transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin-hover" />
            <span>Schedule (F9)</span>
          </button>
        </div>
      </div>

      {/* Middle Bar: Key Primavera Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white/5 p-3 rounded-xl border border-white/10 text-xs shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-1 border-r border-white/5 px-2 last:border-0 overflow-hidden truncate">
          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">WBS / Activity Count</span>
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
            <span className="text-cyan-400 font-bold">{totalWbs}</span> WBS 
            <span className="text-slate-600">|</span> 
            <span className="text-indigo-405 font-bold">{totalActivities}</span> Acts
          </span>
        </div>
        <div className="flex flex-col gap-1 border-r border-white/5 px-2 last:border-0 overflow-hidden truncate">
          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Project Bounds</span>
          <span className="font-mono text-slate-300 mt-0.5">
            {projectStart} <span className="text-slate-500">to</span> {projectEnd}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-r border-white/5 px-2 last:border-0 overflow-hidden truncate">
          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Total Duration</span>
          <span className="font-semibold text-slate-200 mt-0.5">
            <span className="text-cyan-400 font-mono font-bold text-[13px]">{projectDuration}</span> Days
          </span>
        </div>
        <div className="flex flex-col gap-1 border-r border-white/5 px-2 last:border-0 overflow-hidden truncate">
          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Project Rollup</span>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-20 bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-cyan-400 h-full rounded-full transition-all duration-350 shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                style={{ width: `${projectProgress}%` }}
              />
            </div>
            <span className="font-mono font-bold text-cyan-400 text-xs">{projectProgress}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 px-2 overflow-hidden truncate">
          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Critical Volume</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`font-mono font-bold text-[13px] ${criticalPercent > 40 ? 'text-rose-400' : 'text-slate-350'}`}>
              {criticalPercent}%
            </span>
            <span className="text-slate-500">critical</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Interactive Crew Actions - Row Manipulation & Data Backups */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-transparent border-t border-white/5 pt-2">
        {/* Node Editing Commands */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-white/5 mr-2">
            <button
              onClick={() => isEditMode ? onToggleEditMode() : null}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                !isEditMode ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Mode</span>
            </button>
            <button
              onClick={() => !isEditMode ? onToggleEditMode() : null}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                isEditMode ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Mode</span>
            </button>
          </div>

          {isEditMode && (
            <>
              <button
                onClick={onAddWbs}
                title="Adds a new Work Breakdown Structure node under the selected row, or at the root standard layout."
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg transition-all cursor-pointer backdrop-blur-sm"
              >
                <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Add WBS Node</span>
              </button>
              
              <button
                onClick={onAddActivity}
                title="Adds an executable schedule task inside the selected WBS item."
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg transition-all cursor-pointer backdrop-blur-sm"
              >
                <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Activity Node</span>
              </button>

              <button
                onClick={onDeleteSelected}
                disabled={!selectedNodeId}
                title="Delete the currently focused outline item from the scheduler."
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer backdrop-blur-sm ${
                  selectedNodeId
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-350 hover:bg-rose-500/20'
                    : 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Node</span>
              </button>

              <button
                onClick={onLaunchToBackend}
                title="Launch to backend for calculation and revision of the plan."
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white border border-indigo-400 rounded-lg transition-all cursor-pointer shadow-lg shadow-indigo-500/20 font-bold ml-2"
              >
                <ServerCog className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>Launch & Calculate Plan</span>
              </button>
            </>
          )}

          {selectedNodeId && (
            <span className="text-[11px] font-mono text-slate-350 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm ml-2">
              Focused: <span className="text-cyan-400 font-semibold">{(nodes.find(n => n.id === selectedNodeId) as any)?.code || selectedNodeId}</span>
            </span>
          )}
        </div>

        {/* Backup export imports & printer prints */}
        <div className="flex items-center gap-2 text-slate-300">
          <button
            onClick={onExportCsv}
            title="Export full grid data as CSV sheets."
            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-emerald-400 transition-all backdrop-blur-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button
            onClick={onExportJson}
            title="Export full scheduler states as high-fidelity JSON files."
            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-cyan-400 transition-all backdrop-blur-sm cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import an Apex JSON schedule backup."
            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-indigo-405 transition-all backdrop-blur-sm cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImportJson}
            accept=".json"
            className="hidden"
          />
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button
            onClick={onPrint}
            title="Optimize sheet and timescale styles for printing or PDF exports."
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-305 hover:text-white rounded-lg transition-all backdrop-blur-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>
    </header>
  );
}
