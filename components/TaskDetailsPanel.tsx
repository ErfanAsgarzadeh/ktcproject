/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  UserPlus,
  CalendarClock,
  GitMerge,
  Clock,
  Award,
  X,
  Plus,
  TrendingUp,
  Scale,
  MessageSquare,
  Send,
  ExternalLink
} from 'lucide-react';
import { ProjectNode, ActivityNode, Dependency, CustomUser, TaskRole, ChatMessage } from '../types/types';

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
}

export default function TaskDetailsPanel({
                                           selectedNode,
                                           onClose,
                                           onUpdateNode,
                                           dependencies,
                                           allNodes,
                                           onAddDependency,
                                           onDeleteDependency,
                                           users,
                                           taskRoles,
                                           onAddTaskRole,
                                           onDeleteTaskRole,
                                           onAddActivity,
                                           isEditMode = true,
                                           chatMessages = [],
                                           onAddChatMessage,
                                           onOpenChat,
                                         }: TaskDetailsPanelProps) {
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
  const isCritical = (selectedNode as any).isCritical;
  const cpmData = (selectedNode as any).cpmData;

  // Find direct predecessors for selected activity
  const predecessors = dependencies.filter(d => d.toId === selectedNode.id);
  // Find direct successors
  const successors = dependencies.filter(d => d.fromId === selectedNode.id);

  // Filter possible predecessors (only other activities)
  const candidateActivities = allNodes.filter(
      n => n.type === 'activity' && n.id !== selectedNode.id
  ) as ActivityNode[];

  const handleAddField = (field: keyof ActivityNode, val: any) => {
    onUpdateNode(selectedNode.id, { [field]: val });
  };

  // Add useState at the top of the component logic
  const [selectedAssignee, setSelectedAssignee] = React.useState<string>('');
  const [selectedRole, setSelectedRole] = React.useState<string>('owner');

  const handlePredecessorSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const predId = (form.elements.namedItem('predecessorSelect') as HTMLSelectElement).value;
    if (predId) {
      onAddDependency(predId, selectedNode.id);
    }
  };

  const handleAssignUser = () => {
    if (selectedAssignee && selectedRole) {
      onAddTaskRole(selectedNode.id, selectedAssignee, selectedRole as any);
      setSelectedAssignee('');
      setSelectedRole('owner');
    }
  };

  return (
      <div className="relative h-full bg-transparent text-slate-200 flex flex-col overflow-hidden border-l border-white/5 select-none">
        {/* Inspector Header */}
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-100">
              {isWbs ? 'WBS Summary Inspector' : 'Activity Properties'}
            </h3>
          </div>
          <button
              onClick={onClose}
              className="p-1 hover:bg-white/5 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary fields form scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          {/* Node Heading Identifier */}
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-mono text-cyan-400 font-semibold mb-1 uppercase tracking-wider">
              ID Code: {selectedNode.code}
            </div>
            <input
                type="text"
                value={selectedNode.name}
                onChange={(e) => handleAddField('name', e.target.value)}
                disabled={!isEditMode}
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 capitalize transition-all disabled:opacity-50"
                placeholder="Item Description"
            />
          </div>

          {isEditMode && isWbs && onAddActivity && (
              <div className="bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/25 backdrop-blur-md">
                <h4 className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-2">
                  WBS Child Task Management
                </h4>
                <button
                    onClick={() => onAddActivity(selectedNode.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-cyan-500/15 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Create Task under WBS</span>
                </button>
              </div>
          )}

          {/* Schedule Bounds */}
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5 text-cyan-400" />
              Dates & Durations
            </h4>
            <div className="grid grid-cols-2 gap-3.5 bg-white/5 p-3.5 rounded-xl border border-white/10 backdrop-blur-sm">
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Start Date</label>
                <input
                    type="date"
                    disabled={!isEditMode || isWbs}
                    value={selectedNode.startDate}
                    onChange={(e) => handleAddField('startDate', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono disabled:opacity-50 disabled:bg-white/[0.02]/50 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">Finish Date</label>
                <input
                    type="date"
                    disabled={!isEditMode || isWbs}
                    value={selectedNode.endDate}
                    onChange={(e) => handleAddField('endDate', e.target.value)}
                    className="w-full bg-black/40 border border-white/5 text-xs text-slate-300 rounded-lg p-2 font-mono disabled:opacity-50 disabled:bg-white/[0.02]/50 focus:border-cyan-400 focus:outline-none"
                />
              </div>
                <div className="col-span-2">
                    {(() => {
                        // تبدیل عدد اعشاری بک‌اند به ساعت و دقیقه برای نمایش در UI
                        const totalDuration = Number(selectedNode.duration) || 0;
                        const currentHours = Math.floor(totalDuration);
                        const currentMins = Math.round((totalDuration - currentHours) * 60);

                        return (
                            <>
                                <label className="block text-[10px] text-slate-400 font-medium mb-1">
                                    Duration (HH:MM): <span className="text-cyan-400 font-bold font-mono">
            {String(currentHours).padStart(2, '0')}:{String(currentMins).padStart(2, '0')}
          </span>
                                </label>
                                <div className="flex gap-2 items-center">
                                    {/* ورودی ساعت */}
                                    <input
                                        type="number"
                                        disabled={!isEditMode || isWbs}
                                        min="0"
                                        placeholder="ساعت"
                                        value={currentHours}
                                        onChange={(e) => {
                                            const newHours = parseInt(e.target.value) || 0;
                                            // ترکیب ساعت جدید با دقیقه فعلی و تبدیل به عدد اعشاری
                                            const newDurationFloat = newHours + (currentMins / 60);
                                            // ارسال به بک‌اند با حداکثر 4 رقم اعشار
                                            handleAddField('duration', Number(newDurationFloat.toFixed(4)));
                                        }}
                                        className="w-full bg-black/40 border border-white/5 text-xs text-slate-200 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none"
                                    />
                                    <span className="text-slate-400 font-bold">:</span>
                                    {/* ورودی دقیقه */}
                                    <input
                                        type="number"
                                        disabled={!isEditMode || isWbs}
                                        min="0"
                                        max="59"
                                        placeholder="دقیقه"
                                        value={currentMins}
                                        onChange={(e) => {
                                            let newMins = parseInt(e.target.value) || 0;
                                            if (newMins > 59) newMins = 59; // محدودسازی دقیقه
                                            // ترکیب ساعت فعلی با دقیقه جدید و تبدیل به عدد اعشاری
                                            const newDurationFloat = currentHours + (newMins / 60);
                                            // ارسال به بک‌اند
                                            handleAddField('duration', Number(newDurationFloat.toFixed(4)));
                                        }}
                                        className="w-full bg-black/40 border border-white/5 text-xs text-slate-200 rounded-lg p-2 font-mono disabled:opacity-50 focus:border-cyan-400 focus:outline-none"
                                    />
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
          </div>

          {/* Progress Tracker Slider (for terminal nodes editable) */}
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              % Completion Tracker
            </h4>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-4 backdrop-blur-sm">
              <div className="flex-1">
                <input
                    type="range"
                    disabled={isWbs}
                    min="0"
                    max="100"
                    value={selectedNode.progress}
                    onChange={(e) => handleAddField('progress', parseInt(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                  <span>0% Not Started</span>
                  <span>100% Completed</span>
                </div>
              </div>
              <div className="bg-black/35 px-3 py-1.5 rounded-lg border border-white/5 text-center shrink-0">
              <span className="font-mono text-cyan-400 font-bold text-sm block">
                {selectedNode.progress}%
              </span>
                <span className="text-[9px] text-slate-500 block uppercase font-mono">Closed</span>
              </div>
            </div>
          </div>

          {/* Wbs CPM Telemetry Stats or Resources */}
          {/* Task Roles Assignments (New) */}
          {!isWbs && (
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  Task Roles (CustomUser assignments)
                </h4>

                {/* List current roles */}
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {(() => {
                    const assignedRoles = taskRoles.filter(tr => tr.taskId === selectedNode.id);
                    if (assignedRoles.length === 0) {
                      return (
                          <div className="text-[10px] italic text-slate-600 pl-1">
                            No custom user roles allocated to this task row.
                          </div>
                      );
                    }
                    return assignedRoles.map(role => {
                      const assignee = users.find(u => u.id === role.userId);
                      let badgeStyle = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                      if (role.role === 'reviewer') badgeStyle = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                      if (role.role === 'executor') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      if (role.role === 'project manager') badgeStyle = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

                      return (
                          <div
                              key={role.id}
                              className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5 text-xs font-sans group hover:border-white/15 transition-all animate-fade-in"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wide border ${badgeStyle}`}>
                            {role.role}
                          </span>
                                <strong className="text-white text-xs">{assignee?.username || 'Unknown Assignee'}</strong>
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono">
                                {assignee ? `${assignee.jobTitle} • ${assignee.employeeCode}` : 'Deregistered from pool'}
                              </div>
                            </div>
                            {isEditMode && (
                                <button
                                    type="button"
                                    onClick={() => onDeleteTaskRole(role.id)}
                                    className="p-1 hover:bg-white/5 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                                    title="Deallocate role"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                          </div>
                      );
                    });
                  })()}
                </div>

                {/* Quick Assign Form */}
                {isEditMode && users.length > 0 ? (
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 font-sans pt-1">
                      <select
                          value={selectedAssignee}
                          onChange={e => setSelectedAssignee(e.target.value)}
                          className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-205 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="" className="bg-slate-900 text-slate-500 text-[11px]">Choose User...</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id} className="bg-slate-950 text-slate-200">
                              {u.username} ({u.employeeCode})
                            </option>
                        ))}
                      </select>

                      <select
                          value={selectedRole}
                          onChange={e => setSelectedRole(e.target.value)}
                          className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-205 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="owner" className="bg-slate-950 text-slate-202 text-xs">Owner</option>
                        <option value="reviewer" className="bg-slate-950 text-slate-202 text-xs">Reviewer</option>
                        <option value="executor" className="bg-slate-950 text-slate-202 text-xs">Executor</option>
                        <option value="project manager" className="bg-slate-950 text-slate-202 text-xs">PM</option>
                      </select>

                      <button
                          type="button"
                          onClick={handleAssignUser}
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-all flex items-center justify-center cursor-pointer font-bold disabled:opacity-50"
                          title="Assign User role"
                          disabled={!selectedAssignee}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                ) : isEditMode ? (
                    <div className="text-[10px] text-slate-500 bg-black/20 p-2.5 rounded-lg border border-white/5 font-sans leading-relaxed">
                      ℹ️ Go to the **Company Team Pool** tab in the main hub to register team members before assigning them to tasks.
                    </div>
                ) : null}
              </div>
          )}

          {/* Resources Assignees */}
          {!isWbs && (
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  Alternative Resources Allocations
                </h4>
                <input
                    type="text"
                    disabled={!isEditMode}
                    placeholder="e.g. Lead Dev, Designer, Analyst (comma-separated)"
                    value={(selectedNode as ActivityNode).resources?.join(', ') || ''}
                    onChange={(e) => handleAddField('resources', e.target.value.split(',').map(s => s.trim()))}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none transition-all disabled:opacity-50"
                />
              </div>
          )}

          {/* Primavera/CPM Telemetry Stats (For Activities) */}
          {!isWbs && (
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-2 backdrop-blur-sm">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-[10px] font-bold font-mono text-slate-200 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> WBS CPM Telemetry
              </span>
                  {isCritical ? (
                      <span className="text-[8px] font-mono font-bold bg-rose-500/20 border border-rose-500/50 text-rose-300 px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-widest shadow">
                  Critical Path
                </span>
                  ) : (
                      <span className="text-[8px] font-mono font-medium bg-white/5 text-slate-400 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-white/5">
                  Non-Critical
                </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Early Start:</span>
                    <span className="text-cyan-400 font-semibold">{cpmData ? `Day ${cpmData.earlyStart}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Early Finish:</span>
                    <span className="text-cyan-400 font-semibold">{cpmData ? `Day ${cpmData.earlyFinish}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 border-t border-white/5 pt-1.5">
                    <span>Late Start:</span>
                    <span className="text-indigo-400 font-semibold">{cpmData ? `Day ${cpmData.lateStart}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 border-t border-white/5 pt-1.5">
                    <span>Late Finish:</span>
                    <span className="text-indigo-400 font-semibold">{cpmData ? `Day ${cpmData.lateFinish}` : '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px] font-mono mt-1">
              <span className="text-slate-400 flex items-center gap-1 uppercase text-[9px] font-bold tracking-wide">
                <Scale className="w-3.5 h-3.5 text-cyan-400" /> Total Float (Slack):
              </span>
                  <span className={`font-bold px-2 py-0.5 rounded ${isCritical ? 'bg-rose-500/10 text-rose-405 text-rose-400 border border-rose-500/35 font-mono text-[11px]' : 'bg-cyan-550/10 text-cyan-400 border border-cyan-500/20'}`}>
                {cpmData ? `${cpmData.totalFloat} days` : '0 days'}
              </span>
                </div>
              </div>
          )}

          {/* Predecessors Connections */}
          {!isWbs && (
              <div>
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-cyan-405 text-cyan-400" />
                  Predecessors Links
                </h4>

                {/* List current predecessors */}
                <div className="space-y-1.5 mb-3.5">
                  {predecessors.map(pred => {
                    const predNode = allNodes.find(n => n.id === pred.fromId);
                    return (
                        <div
                            key={pred.id}
                            className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/5 text-xs font-mono"
                        >
                    <span className="text-cyan-400 uppercase">
                      FS: <strong className="text-indigo-400 font-bold">{predNode?.code || '—'}</strong>
                    </span>
                          {isEditMode && (
                              <button
                                  onClick={() => onDeleteDependency(pred.id)}
                                  className="p-1 hover:bg-white/5 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                          )}
                        </div>
                    );
                  })}
                  {predecessors.length === 0 && (
                      <div className="text-[10px] italic text-slate-600 pl-1">
                        No predecessor links configured. Starts immediately at project baseline.
                      </div>
                  )}
                </div>

                {/* Form to connect a new predecessor */}
                {isEditMode && (
                    <form onSubmit={handlePredecessorSubmit} className="flex gap-1.5 font-sans">
                      <select
                          name="predecessorSelect"
                          className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="" className="bg-slate-900 text-slate-300">Select Predecessor...</option>
                        {candidateActivities.map(act => (
                            <option key={act.id} value={act.id} className="bg-slate-900 text-slate-205">
                              {act.code} - {act.name}
                            </option>
                        ))}
                      </select>
                      <button
                          type="submit"
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </form>
                )}
              </div>
          )}

          {/* Notebook Activity Log area */}
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2">
              Workspace Notes & Logs
            </h4>
            <textarea
                disabled={!isEditMode}
                value={(selectedNode as any).notes || ''}
                onChange={(e) => handleAddField('notes', e.target.value)}
                rows={3}
                placeholder="Log crew notes, construction safety bounds, or API code commits..."
                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 font-sans focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
            />
          </div>

          {/* Task Chat Log Toggle (View Mode Only) */}
          {!isEditMode && !isWbs && (
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col items-center">
                <button
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-lg text-xs tracking-wide font-mono text-cyan-300 transition-colors shadow-sm"
                    onClick={onOpenChat}
                >
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Open Collaboration Chat
                </button>
              </div>
          )}

        </div>
      </div>
  );
}
