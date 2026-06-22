/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, UserPlus, CalendarClock, GitMerge, Clock, Award, X, Plus,
  TrendingUp, Scale, MessageSquare, Briefcase, CheckCircle2, Play
} from 'lucide-react';
import { ProjectNode, ActivityNode, Dependency, CustomUser, TaskRole, ChatMessage } from '../types/types';
import JalaliDatePicker from './JalaliDatePicker';

interface TaskDetailsPanelProps {
  selectedNode: ProjectNode | null;
  onClose: () => void;
  onUpdateNode: (id: string, updatedFields: Partial<ProjectNode>) => void;
  dependencies: Dependency[];
  allNodes: ProjectNode[];
  onAddDependency: (fromId: string, toId: string) => void;
  onDeleteDependency: (id: string) => void;
  users: CustomUser[];
  taskRoles: TaskRole[];
  onAddTaskRole: (taskId: string, userId: string, role: 'owner' | 'reviewer' | 'executor' | 'project manager') => void;
  onDeleteTaskRole: (roleId: string) => void;
  onAddActivity?: (parentId: string) => void;
  isEditMode?: boolean;
  chatMessages: ChatMessage[];
  onAddChatMessage: (taskId: string, userId: string, text: string) => void;
  onOpenChat: () => void;
  // پراپ‌های سیستم تخصیص منابع
  resources?: any[];
  assignments?: any[];
  onAddAssignment?: (taskId: string, resourceId: string, unitsPercent: number) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  // پراپ برای ارسال اطلاعات واقعی (actual) به بک‌اند
  onSaveActual?: (taskId: string, data: { actualStart?: string; actualFinish?: string; progress: number }) => void;
}

export default function TaskDetailsPanel({
                                           selectedNode, onClose, onUpdateNode, dependencies, allNodes, onAddDependency,
                                           onDeleteDependency, users, taskRoles, onAddTaskRole, onDeleteTaskRole,
                                           onAddActivity, isEditMode = true, chatMessages = [], onAddChatMessage, onOpenChat,
                                           resources = [], assignments = [], onAddAssignment, onDeleteAssignment, onSaveActual
                                         }: TaskDetailsPanelProps) {

  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('reviewer');
  const [assignableUsers, setAssignableUsers] = useState<CustomUser[]>([]);

  // استیت‌های فرم وابستگی
  const [selectedPredId, setSelectedPredId] = useState<string>('');
  const [selectedDepType, setSelectedDepType] = useState<string>('FS');
  const [selectedLag, setSelectedLag] = useState<number>(0);

  // استیت‌های فرم تخصیص منابع
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [selectedUnits, setSelectedUnits] = useState<number>(100);

  // ── استیت‌های Actual Data (شروع/پایان واقعی و درصد پیشرفت) ──
  const [actualStart, setActualStart] = useState<string>('');
  const [actualFinish, setActualFinish] = useState<string>('');
  const [actualProgress, setActualProgress] = useState<number>(0);
  const [isSavingActual, setIsSavingActual] = useState<boolean>(false);

  // ── Local copy of the node so edits don't clobber each other ──
  const [localNode, setLocalNode] = useState<ProjectNode | null>(selectedNode);

  useEffect(() => {
    setLocalNode(selectedNode);
    // بازنشانی فیلدهای actual هنگام تعویض تسک
    const nodeActual = (selectedNode as any)?.actual;
    setActualStart(nodeActual?.actualStart || '');
    setActualFinish(nodeActual?.actualFinish || '');
    setActualProgress(nodeActual?.progress ?? selectedNode?.progress ?? 0);
  }, [selectedNode?.id]);

  // واکشی افراد قابل انتخاب برای نقش از بک‌اند (بر اساس قوانین فاز ۳)
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'activity') {
      setAssignableUsers([]);
      return;
    }
    import('../lib/api').then(({ apiClient }) => {
      apiClient.get(`/planning/task-roles/assignable-users/?taskId=${selectedNode.id}&role=${selectedRole}`)
          .then(res => setAssignableUsers(res.data || []))
          .catch(() => setAssignableUsers([]));
    });
  }, [selectedNode?.id, selectedRole]);

  const handleLocalChange = (field: string, val: any) => {
    setLocalNode(prev => prev ? { ...prev, [field]: val } : prev);
  };

  const handleCommit = (field: string, val: any) => {
    if (selectedNode) {
      onUpdateNode(selectedNode.id, { [field]: val } as Partial<ProjectNode>);
    }
  };

  if (!selectedNode) {
    return (
        <div className="h-full bg-transparent p-6 flex flex-col items-center justify-center text-center select-none text-slate-400">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-cyan-400 border border-white/10 shadow-lg mb-4 backdrop-blur-md">
            <Award className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2">Primavera Inspector Panel</h3>
          <p className="text-xs max-w-xs leading-relaxed text-slate-500">
            Double-click any cell in the table or select a row on the Gantt chart to load resource details, predecessors, scheduler lags, and critical path telemetry.
          </p>
        </div>
    );
  }

  const isWbs = selectedNode.type === 'wbs';
  const cpmData = (selectedNode as any).cpmData;
  const metrics = (selectedNode as any).metrics;
  const isCritical = metrics?.isCritical ?? (selectedNode as any).isCritical;

  const formatMetricDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return dateStr.split('T')[0] || dateStr.split(' ')[0];
  };

  const predecessors = dependencies.filter(d => d.toId === selectedNode.id);
  const candidateActivities = allNodes.filter(n => n.type === 'activity' && n.id !== selectedNode.id) as ActivityNode[];

  const handleAddField = (field: keyof ActivityNode, val: any) => {
    onUpdateNode(selectedNode.id, { [field]: val });
  };

  const handleAddPredecessor = () => {
    if (selectedPredId) {
      (onAddDependency as any)(selectedPredId, selectedNode.id, selectedDepType, selectedLag);
      setSelectedPredId('');
      setSelectedDepType('FS');
      setSelectedLag(0);
    }
  };

  const handleAssignUser = () => {
    if (selectedAssignee && selectedRole) {
      onAddTaskRole(selectedNode.id, selectedAssignee, selectedRole as any);
      setSelectedAssignee('');
      setSelectedRole('reviewer');
    }
  };

  const handleAssignResource = () => {
    if (selectedResourceId && onAddAssignment) {
      onAddAssignment(selectedNode.id, selectedResourceId, selectedUnits);
      setSelectedResourceId('');
      setSelectedUnits(100);
    }
  };

  return (
      <div className="relative h-full bg-transparent text-slate-200 flex flex-col overflow-hidden border-l border-white/5 select-none">
        {/* Header */}
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-100">
              {isWbs ? 'WBS Summary Inspector' : 'Activity Properties'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          <div className="bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-mono text-cyan-400 font-semibold mb-1 uppercase tracking-wider">ID Code: {selectedNode.code}</div>
            <input
                type="text" value={localNode?.name ?? ''} onChange={(e) => handleLocalChange('name', e.target.value)} onBlur={(e) => handleCommit('name', e.target.value)} disabled={!isEditMode}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 capitalize transition-all disabled:opacity-50"
            />
          </div>

          {isEditMode && isWbs && onAddActivity && (
              <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/25 backdrop-blur-md">
                <h4 className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-2">WBS Child Task Management</h4>
                <button onClick={() => onAddActivity(selectedNode.id)} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-cyan-500/15 cursor-pointer">
                  <Plus className="w-4 h-4 text-white" /><span>Create Task under WBS</span>
                </button>
              </div>
          )}

          {/* Dates & Durations */}
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5 text-cyan-400" />Dates & Durations</h4>
            <div className="grid grid-cols-2 gap-3.5 bg-white/5 p-3.5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Start Date</label>
                <JalaliDatePicker disabled={!isEditMode || isWbs} value={localNode?.startDate ?? ''} onChange={(iso) => { handleLocalChange('startDate', iso); handleCommit('startDate', iso); }} className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none flex items-center justify-between gap-2" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Finish Date</label>
                <JalaliDatePicker disabled={!isEditMode || isWbs} value={localNode?.endDate ?? ''} onChange={(iso) => { handleLocalChange('endDate', iso); handleCommit('endDate', iso); }} className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none flex items-center justify-between gap-2" />
              </div>
              <div className="col-span-2">
                {(() => {
                  const totalDuration = Number(localNode?.duration) || 0;
                  const currentHours = Math.floor(totalDuration);
                  const currentMins = Math.round((totalDuration - currentHours) * 60);

                  return (
                      <>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Duration (HH:MM): <span className="text-cyan-400 font-bold font-mono">{String(currentHours).padStart(2, '0')}:{String(currentMins).padStart(2, '0')}</span></label>
                        <div className="flex gap-2 items-center">
                          <input type="number" disabled={!isEditMode || isWbs} min="0" value={currentHours} onChange={(e) => { const v = Number(((parseInt(e.target.value) || 0) + (currentMins / 60)).toFixed(4)); handleLocalChange('duration', v); }} onBlur={(e) => { const v = Number(((parseInt(e.target.value) || 0) + (currentMins / 60)).toFixed(4)); handleCommit('duration', v); }} className="w-full bg-black/40 border border-white/5 text-xs text-slate-200 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none" />
                          <span className="text-slate-400 font-bold">:</span>
                          <input type="number" disabled={!isEditMode || isWbs} min="0" max="59" value={currentMins} onChange={(e) => { let m = parseInt(e.target.value) || 0; if (m > 59) m = 59; const v = Number((currentHours + m / 60).toFixed(4)); handleLocalChange('duration', v); }} onBlur={(e) => { let m = parseInt(e.target.value) || 0; if (m > 59) m = 59; const v = Number((currentHours + m / 60).toFixed(4)); handleCommit('duration', v); }} className="w-full bg-black/40 border border-white/5 text-xs text-slate-200 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none" />
                        </div>
                      </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* === ردیف دو ستونه: درصد پیشرفت و وزن تسک === */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* اسلایدر درصد پیشرفت */}
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                % Progress
              </h4>
              <div className="bg-white/5 p-2.5 h-12 rounded-xl border border-white/10 flex items-center gap-2 backdrop-blur-sm">
                <input type="range" disabled={isWbs} min="0" max="100" value={localNode?.progress || 0} onChange={(e) => { handleLocalChange('progress', parseInt(e.target.value)); handleCommit('progress', parseInt(e.target.value)); }} className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50" />
                <span className="font-mono text-cyan-400 font-bold text-xs shrink-0">{localNode?.progress || 0}%</span>
              </div>
            </div>

            {/* اینپوت وزن تسک */}
            <div>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                Task Weight
              </h4>
              <div className="bg-white/5 p-2 h-12 rounded-xl border border-white/10 flex items-center gap-1 backdrop-blur-sm">
                <input
                    type="number"
                    disabled={!isEditMode || isWbs}
                    min="0" max="100" step="0.01"
                    value={(localNode as any)?.weight || 0}
                    onChange={(e) => handleLocalChange('weight', parseFloat(e.target.value) || 0)}
                    onBlur={(e) => handleCommit('weight', parseFloat(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-white/5 text-xs text-slate-200 rounded-lg p-1 text-center font-mono focus:border-amber-400 focus:outline-none"
                    placeholder="0.00"
                />
                <span className="text-[9px] text-slate-500 font-mono pr-1">%</span>
              </div>
            </div>
          </div>

          {/* ═══ Actual Execution Data (شروع/پایان واقعی + پیشرفت) ═══ */}
          {!isWbs && (
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />Actual Execution Data
                </h4>
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-3 backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Actual Start</label>
                      <div className="space-y-1.5">
                        <JalaliDatePicker
                            value={actualStart ? actualStart.split('T')[0] : ''}
                            onChange={(iso) => {
                              const time = actualStart && actualStart.includes('T') ? actualStart.split('T')[1].slice(0, 5) : '00:00';
                              setActualStart(`${iso}T${time}`);
                            }}
                            className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono focus:border-emerald-400 focus:outline-none flex items-center justify-between gap-2"
                        />
                        <input
                            type="time"
                            value={actualStart && actualStart.includes('T') ? actualStart.split('T')[1].slice(0, 5) : ''}
                            onChange={(e) => {
                              const date = actualStart ? actualStart.split('T')[0] : '';
                              if (date) setActualStart(`${date}T${e.target.value || '00:00'}`);
                            }}
                            className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Actual Finish</label>
                      <div className="space-y-1.5">
                        <JalaliDatePicker
                            value={actualFinish ? actualFinish.split('T')[0] : ''}
                            onChange={(iso) => {
                              const time = actualFinish && actualFinish.includes('T') ? actualFinish.split('T')[1].slice(0, 5) : '00:00';
                              setActualFinish(`${iso}T${time}`);
                            }}
                            className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono focus:border-emerald-400 focus:outline-none flex items-center justify-between gap-2"
                        />
                        <input
                            type="time"
                            value={actualFinish && actualFinish.includes('T') ? actualFinish.split('T')[1].slice(0, 5) : ''}
                            onChange={(e) => {
                              const date = actualFinish ? actualFinish.split('T')[0] : '';
                              if (date) setActualFinish(`${date}T${e.target.value || '00:00'}`);
                            }}
                            className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-medium mb-1">
                      Progress: <span className="text-emerald-400 font-bold font-mono">{actualProgress}%</span>
                    </label>
                    <input
                        type="range"
                        min="0" max="100"
                        value={actualProgress}
                        onChange={(e) => setActualProgress(parseInt(e.target.value))}
                        className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                  <button
                      type="button"
                      disabled={isSavingActual}
                      onClick={async () => {
                        if (!selectedNode || !onSaveActual) return;
                        setIsSavingActual(true);
                        try {
                          await onSaveActual(selectedNode.id, {
                            actualStart: actualStart || undefined,
                            actualFinish: actualFinish || undefined,
                            progress: actualProgress,
                          });
                        } finally {
                          setIsSavingActual(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSavingActual ? 'Saving...' : 'Save Actual Data'}</span>
                  </button>
                </div>
              </div>
          )}

          {/* Task Roles Assignments */}
          {!isWbs && (
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1"><UserPlus className="w-3.5 h-3.5 text-cyan-400" />Task Roles (Users)</h4>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {(() => {
                    const assignedRoles = taskRoles.filter(tr => tr.taskId === selectedNode.id);
                    if (assignedRoles.length === 0) return <div className="text-[10px] italic text-slate-600 pl-1">No roles allocated.</div>;
                    return assignedRoles.map(role => {
                      const assignee = users.find(u => String(u.id) === String(role.userId))
                          || assignableUsers.find(u => String(u.id) === String(role.userId));
                      return (
                          <div key={role.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5 text-xs font-sans group">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wide border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{role.role}</span>
                                <strong className="text-white text-xs">{assignee?.username || 'Unknown'}</strong>
                              </div>
                            </div>
                            {isEditMode && <button type="button" onClick={() => onDeleteTaskRole(role.id)} className="p-1 hover:bg-white/5 text-slate-500 hover:text-rose-400 rounded"><X className="w-3.5 h-3.5" /></button>}
                          </div>
                      );
                    });
                  })()}
                </div>

                {isEditMode && (
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 font-sans pt-1">
                      <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-205 focus:outline-none focus:border-cyan-400">
                        <option value="" className="bg-slate-900 text-slate-500">
                          {assignableUsers.length === 0 ? 'بدون نیروی مجاز...' : 'Choose User...'}
                        </option>
                        {assignableUsers.map(u => <option key={u.id} value={u.id} className="bg-slate-950 text-slate-200">{u.username}</option>)}
                      </select>
                      <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400">
                        <option value="reviewer" className="bg-slate-950 text-slate-200 text-xs">Reviewer</option>
                        <option value="executor" className="bg-slate-950 text-slate-200 text-xs">Executor</option>
                      </select>
                      <button type="button" onClick={handleAssignUser} disabled={!selectedAssignee} className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                    </div>
                )}
              </div>
          )}

          {/* Resource Assignments System */}
          {!isWbs && (
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  Resource Allocations
                </h4>

                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {(() => {
                    const taskAssignments = assignments.filter(a => a.task === selectedNode.id || a.taskId === selectedNode.id);
                    if (taskAssignments.length === 0) return <div className="text-[10px] italic text-slate-600 pl-1">No resources assigned.</div>;

                    return taskAssignments.map(asgn => {
                      const resItem = resources.find(r => r.id === asgn.resourceId);
                      return (
                          <div key={asgn.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5 text-xs font-sans group">
                            <div className="space-y-0.5 flex-1 pr-2">
                              <div className="flex items-center justify-between w-full">
                                <strong className="text-white text-[11px] truncate">{resItem?.name || 'Unknown Resource'}</strong>
                                <span className="font-mono text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 rounded">{asgn.units_percent}%</span>
                              </div>
                            </div>
                            {isEditMode && onDeleteAssignment && (
                                <button type="button" onClick={() => onDeleteAssignment(asgn.id)} className="p-1 hover:bg-white/5 text-slate-500 hover:text-rose-400 rounded shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                          </div>
                      );
                    });
                  })()}
                </div>

                {isEditMode && resources.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-2 font-sans pt-2">

                      {/* 1. لیست کشویی انتخاب منبع */}
                      <select
                          value={selectedResourceId}
                          onChange={e => setSelectedResourceId(e.target.value)}
                          className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 truncate shadow-inner"
                      >
                        <option value="" className="bg-slate-900 text-slate-500">1. Select Resource...</option>
                        {resources.map(r => (
                            <option key={r.id} value={r.id} className="bg-slate-950 text-slate-200">
                              {r.name} ({r.resource_type})
                            </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* 2. ورودی درصد استفاده از منبع */}
                        <div className="relative flex items-center w-20 shrink-0">
                          <input
                              type="number"
                              min="1" max="100"
                              value={selectedUnits}
                              onChange={e => setSelectedUnits(Number(e.target.value))}
                              className="w-full bg-black/40 border border-white/10 rounded-lg pl-2 pr-6 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 shadow-inner"
                              title="Units / Allocation Percentage"
                          />
                          <span className="absolute right-2.5 text-[10px] text-slate-500 font-bold pointer-events-none">%</span>
                        </div>

                        {/* 3. دکمه اضافه کردن (به‌روز شده و واضح‌تر) */}
                        <button
                            type="button"
                            onClick={handleAssignResource}
                            disabled={!selectedResourceId}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800/50 disabled:text-slate-500 text-white border border-transparent disabled:border-white/5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 font-bold shadow-lg shadow-emerald-500/10 active:scale-95 duration-100"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-wider">Add</span>
                        </button>
                      </div>

                    </div>
                ) : isEditMode && (
                    <div className="text-[10px] text-slate-500 italic pl-1 bg-black/20 p-2 rounded-lg border border-white/5">
                      No resources available in the pool.
                    </div>
                )}
              </div>
          )}

          {/* CPM Telemetry & Predecessors Links */}
          {!isWbs && (
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-2 backdrop-blur-sm">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[10px] font-bold font-mono text-slate-200 uppercase tracking-wide flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400" /> WBS CPM Telemetry</span>
                  {isCritical ? <span className="text-[8px] font-mono font-bold bg-rose-500/20 border border-rose-500/50 text-rose-300 px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-widest shadow">Critical Path</span> : <span className="text-[8px] font-mono font-medium bg-white/5 text-slate-400 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-white/5">Non-Critical</span>}
                </div>
              </div>
          )}

          {!isWbs && (
              <div className="space-y-3">
                {/* ─── Predecessors ─── */}
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
                    Predecessors
                  </h4>
                  <div className="space-y-1.5 mb-2 max-h-[140px] overflow-y-auto pr-1">
                    {predecessors.length === 0
                        ? <div className="text-[10px] italic text-slate-600 pl-1">No predecessors defined.</div>
                        : predecessors.map(pred => {
                          const predNode = allNodes.find(n => n.id === pred.fromId);
                          const depType = (pred as any).type || 'FS';
                          const lag = (pred as any).lag ?? 0;
                          return (
                              <div key={pred.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/5 text-xs font-mono gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border shrink-0 ${
                                    depType === 'FS' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' :
                                        depType === 'SS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                                            depType === 'FF' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                                                'bg-rose-500/10 text-rose-400 border-rose-500/25'
                                }`}>{depType}</span>
                                  <strong className="text-indigo-300 truncate">{predNode?.code || '—'}</strong>
                                  <span className="text-slate-500 truncate">{predNode?.name || ''}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {lag !== 0 && (
                                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                          lag > 0
                                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                      }`}>
                                    {lag > 0 ? `+${lag}d` : `${lag}d`}
                                  </span>
                                  )}
                                  {isEditMode && (
                                      <button onClick={() => onDeleteDependency(pred.id)} className="p-1 hover:bg-white/5 text-slate-500 hover:text-rose-400 rounded">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                  )}
                                </div>
                              </div>
                          );
                        })
                    }
                  </div>

                  {/* فرم افزودن وابستگی */}
                  {isEditMode && candidateActivities.length > 0 && (
                      <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">Add Predecessor</div>
                        {/* ردیف اول: انتخاب فعالیت */}
                        <select
                            value={selectedPredId}
                            onChange={e => setSelectedPredId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="" className="bg-slate-900 text-slate-500">Select activity...</option>
                          {candidateActivities
                              .filter(n => !predecessors.some(p => p.fromId === n.id))
                              .map(n => (
                                  <option key={n.id} value={n.id} className="bg-slate-950 text-slate-200">
                                    {n.code} — {n.name}
                                  </option>
                              ))
                          }
                        </select>

                        {/* ردیف دوم: نوع + Lag/Lead + دکمه */}
                        <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                          {/* نوع وابستگی */}
                          <div className="flex gap-1">
                            {(['FS','SS','FF','SF'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setSelectedDepType(t)}
                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                                        selectedDepType === t
                                            ? t === 'FS' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' :
                                                t === 'SS' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' :
                                                    t === 'FF' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                                                        'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                            : 'bg-black/30 text-slate-500 border-white/5 hover:border-white/15'
                                    }`}
                                >
                                  {t}
                                </button>
                            ))}
                          </div>

                          {/* Lag / Lead */}
                          <div className="relative">
                            <input
                                type="number"
                                value={selectedLag}
                                onChange={e => setSelectedLag(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg pl-2 pr-8 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                                placeholder="0"
                                title="Lag (positive) / Lead (negative) in days"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 pointer-events-none font-mono">
                            {selectedLag > 0 ? 'lag' : selectedLag < 0 ? 'lead' : 'd'}
                          </span>
                          </div>

                          {/* دکمه Add */}
                          <button
                              type="button"
                              onClick={handleAddPredecessor}
                              disabled={!selectedPredId}
                              className="px-1.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800/50 disabled:text-slate-500 text-white rounded-lg transition-all flex items-center gap-1 text-xs font-bold disabled:border-white/5 border border-transparent shadow-lg shadow-cyan-500/10 active:scale-95 shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* راهنمای نوع وابستگی */}

                      </div>
                  )}
                </div>

                {/* ─── Successors (فقط نمایش) ─── */}
                <div>
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <GitMerge className="w-3.5 h-3.5 text-violet-400 rotate-180" />
                    Successors
                  </h4>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {(() => {
                      const successors = dependencies.filter(d => d.fromId === selectedNode.id);
                      if (successors.length === 0)
                        return <div className="text-[10px] italic text-slate-600 pl-1">No successors.</div>;
                      return successors.map(succ => {
                        const succNode = allNodes.find(n => n.id === succ.toId);
                        const depType = (succ as any).type || 'FS';
                        const lag = (succ as any).lag ?? 0;
                        return (
                            <div key={succ.id} className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5 text-xs font-mono">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border shrink-0 ${
                                depType === 'FS' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' :
                                    depType === 'SS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                                        depType === 'FF' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                                            'bg-rose-500/10 text-rose-400 border-rose-500/25'
                            }`}>{depType}</span>
                              <strong className="text-violet-300 truncate">{succNode?.code || '—'}</strong>
                              <span className="text-slate-500 truncate flex-1">{succNode?.name || ''}</span>
                              {lag !== 0 && (
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                                      lag > 0
                                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                  }`}>
                                {lag > 0 ? `+${lag}d` : `${lag}d`}
                              </span>
                              )}
                            </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}