/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef,useState } from 'react';
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
  ServerCog,
  Lock,
  CheckCircle,
  Copy, ChevronUp, ChevronDown, Sun
} from 'lucide-react';
import { ZoomLevel, ProjectNode, Dependency } from '../types/types';
import { gregorianToJalaliString } from '../utils/jalali';

interface ToolbarProps {
  projectName: string;
  revisionNumber: number;
  revisionStart?: string; // اضافه شد
  revisionEnd?: string;   // اضافه شد
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
  onImportMsp: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  ganttFilter: 'both' | 'wbs' | 'activity';
  onSelectGanttFilter: (filter: 'both' | 'wbs' | 'activity') => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onLaunchToBackend: () => void;

  isRevisionLocked: boolean;
  onApproveRevision: () => void;
  onCreateDraft: () => void;
}

export default function Toolbar({
                                  projectName,
                                  revisionNumber,
                                  revisionStart,
                                  revisionEnd,
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
                                  onImportMsp,
                                  onPrint,
                                  ganttFilter,
                                  onSelectGanttFilter,
                                  isEditMode,
                                  onToggleEditMode,
                                  onLaunchToBackend,
                                  isRevisionLocked,
                                  onApproveRevision,
                                  onCreateDraft,
                                }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive metrics
  const totalWbs = nodes.filter(n => n.type === 'wbs').length;
  const totalActivities = nodes.filter(n => n.type === 'activity').length;
  const projectRoot = nodes.find(n => n.parentId === null && n.type === 'wbs') || nodes[0];

  // خواندن اطلاعات مستقیما از دیتابیس ریویژن به جای گره‌های جدول
  const displayStart = revisionStart ? gregorianToJalaliString(revisionStart) : (projectRoot?.startDate ? gregorianToJalaliString(projectRoot.startDate) : '—');
  const displayEnd = revisionEnd ? gregorianToJalaliString(revisionEnd) : (projectRoot?.endDate ? gregorianToJalaliString(projectRoot.endDate) : '—');

  // محاسبه مدت زمان (Duration) بر اساس تاریخ شروع و پایان ریویژن
  let displayDuration = projectRoot?.duration || 0;
  if (revisionStart && revisionEnd) {
    const sDate = new Date(revisionStart);
    const eDate = new Date(revisionEnd);
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      const diffTime = eDate.getTime() - sDate.getTime();
      displayDuration = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
    }
  }

  const projectProgress = projectRoot?.progress || 0;
  const isCriticalCount = nodes.filter(n => n.type === 'activity' && (n as any).isCritical).length;
  const criticalPercent = totalActivities > 0 ? Math.round((isCriticalCount / totalActivities) * 100) : 0;


  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('nexus_toolbar_collapsed') === 'true');


  if (isCollapsed) {
    return (
        <header className="bg-white/5 backdrop-blur-md text-slate-100 border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 shrink-0 shadow-lg select-none z-20 transition-all duration-300">
          {/* Left Side: Exit Button & Title */}
          <div className="flex items-center gap-2">
            <button
                onClick={onExitToHub}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all text-xs cursor-pointer"
                title="Return to Projects & Revisions Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Hub</span>
            </button>
            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
            <h1 className="text-xs font-semibold font-sans tracking-tight text-white flex items-center gap-1.5">
              <span className="text-cyan-400 font-bold bg-cyan-400/15 px-1.5 py-0.5 rounded text-[10px]">P</span>
              <span className="truncate max-w-[120px] md:max-w-[200px]">{projectName}</span>
            </h1>
            <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded border border-cyan-400/20">
            R{revisionNumber}
          </span>
          </div>

          {/* Middle Stats Rollup */}
          <div className="hidden md:flex items-center gap-4 text-[11px] font-mono bg-black/20 px-3 py-1 rounded-lg border border-white/5">
            <div>
              <span className="text-slate-400">WBS/Acts: </span>
              <span className="text-cyan-400 font-bold">{totalWbs}</span><span className="text-slate-500">/</span><span className="text-indigo-400 font-bold">{totalActivities}</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div>
              <span className="text-slate-400">Duration: </span>
              <span className="text-slate-200 font-bold">{displayDuration}d</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Rollup:</span>
              <div className="w-12 bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${projectProgress}%` }} />
              </div>
              <span className="text-cyan-400 font-bold">{projectProgress}%</span>
            </div>
          </div>

          {/* Right Actions: Theme Toggle, CPM Highlight, F9 Solver, and Expand */}
          <div className="flex items-center gap-2">
            {/* Quick theme toggle */}


            {/* Quick Critical path toggle */}
            <button
                onClick={onToggleCriticalPath}
                title="Highlights activities with zero total float in red on the Gantt timeline."
                className={`p-1.5 rounded-lg border transition-all ${
                    showCriticalPath
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-semibold'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-rose-400' : 'text-slate-400'}`} />
            </button>

            {/* Quick F9 Solve Network dates */}
            <button
                onClick={onRunF9Scheduler}
                title="Run CPM F9 solver"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin-hover" />
              <span className="hidden sm:inline">F9</span>
            </button>

            <div className="h-4 w-px bg-white/10 mx-0.5" />

            {/* Expand Toggle */}
            <button
                onClick={() => {
                  setIsCollapsed(false);
                  localStorage.setItem('nexus_toolbar_collapsed', 'false');
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-cyan-500 hover:bg-cyan-400 rounded-lg shadow-md hover:shadow-cyan-500/10 cursor-pointer transition-all active:scale-95"
                title="Expand Navigation Toolbar Control Panel"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expand</span>
            </button>
          </div>
        </header>
    );
  }






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
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border font-mono tracking-wider shadow-inner flex items-center gap-1.5 ${
                    isRevisionLocked
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-white/5 text-cyan-400 border-white/10'
                }`}>
            Rev {revisionNumber}
                  {isRevisionLocked ? <Lock className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          </span>
              </h1>
            </div>
          </div>

          {/* Active Revision Identifier */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
                onClick={onToggleCriticalPath}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all backdrop-blur-sm ${
                    showCriticalPath
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30 font-semibold'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-rose-400' : 'text-slate-400'}`} />
              <span>Critical Path</span>
            </button>

            <button
                onClick={onRunF9Scheduler}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-205 border border-cyan-500/30 shadow transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin-hover" />
              <span>Schedule (F9)</span>
            </button>
            <button
                onClick={() => {
                  setIsCollapsed(true);
                  localStorage.setItem('nexus_toolbar_collapsed', 'true');
                }}
                title="Collapse the toolbar to save space"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 shadow transition-all active:scale-95 cursor-pointer backdrop-blur-sm ml-1"
            >
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Collapse</span>
            </button>
          </div>


          {/* TimeScale Zoom & Active Critical Actions */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="flex items-center gap-1.5  py-1 text-[11px] font-medium text-slate-400 bg-black/20 rounded-lg border border-white/10 shadow-inner backdrop-blur-sm cursor-default select-none">

            </div>

            <div className="flex items-center bg-black/20 rounded-lg border border-white/10 p-0.5 shadow-inner backdrop-blur-sm">
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

            <div className="flex items-center bg-black/20 rounded-lg border border-white/10 p-0.5 shadow-inner backdrop-blur-sm">
              {(['hour', 'day', 'week', 'month'] as ZoomLevel[]).map(level => (
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
            {displayStart} <span className="text-slate-500">to</span> {displayEnd}
          </span>
          </div>
          <div className="flex flex-col gap-1 border-r border-white/5 px-2 last:border-0 overflow-hidden truncate">
            <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">Total Duration</span>
            <span className="font-semibold text-slate-200 mt-0.5">
            <span className="text-cyan-400 font-mono font-bold text-[13px]">{displayDuration}</span> Days
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
            <div className={`flex items-center rounded-lg p-0.5 border mr-2 ${isRevisionLocked ? 'bg-rose-950/20 border-rose-500/20 opacity-70' : 'bg-black/30 border-white/5'}`}>
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
                  disabled={isRevisionLocked}
                  title={isRevisionLocked ? "نسخه قفل است و قابل ویرایش نیست" : "ویرایش پروژه"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      isEditMode ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Mode</span>
              </button>
            </div>

            <div className="h-6 w-px bg-white/10 mx-1 print:hidden" />

            {isRevisionLocked ? (
                <button
                    onClick={onCreateDraft}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-lg transition-all cursor-pointer shadow-lg shadow-emerald-500/20 font-bold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Create New Draft (Replan)</span>
                </button>
            ) : (
                <button
                    onClick={onApproveRevision}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/50 rounded-lg transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Approve & Lock Revision</span>
                </button>
            )}

            <div className="h-6 w-px bg-white/10 mx-1 print:hidden" />

            {isEditMode && (
                <>


                  <button
                      onClick={onAddWbs}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg transition-all cursor-pointer backdrop-blur-sm"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Add WBS Node</span>
                  </button>
                  <button
                      onClick={onAddActivity}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg transition-all cursor-pointer backdrop-blur-sm"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Add Activity Node</span>
                  </button>

                  <button
                      onClick={onDeleteSelected}
                      disabled={!selectedNodeId}
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
                className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-emerald-400 transition-all backdrop-blur-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
                onClick={onExportJson}
                className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-cyan-400 transition-all backdrop-blur-sm cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
            </button>
            <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-300 hover:text-emerald-400 transition-all backdrop-blur-sm cursor-pointer"
                title="Import MS Project (.xml)"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={onImportMsp}
                accept=".xml"
                className="hidden"
            />
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button
                onClick={onPrint}
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