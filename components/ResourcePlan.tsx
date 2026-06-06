'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  Filter,
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  Briefcase,
  Target,
  TrendingUp,
  User,
  Tag,
  LayoutGrid,
  List,
  GitBranch,
  Zap,
} from 'lucide-react';
import { CustomUser, TaskRole, Project, Revision, ActivityNode, ProjectNode } from '../types/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourcePlanProps {
  users: CustomUser[];
  taskRoles: TaskRole[];
  projects: Project[];
  revisions: Revision[];
  nodes: ProjectNode[];         // all activity + wbs nodes
  activeRevisionId: string | null;
  onExit?: () => void;
}

interface EnrichedTaskRole extends TaskRole {
  task: ActivityNode | null;
  project: Project | null;
  revision: Revision | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner:           { label: 'Owner',           color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25' },
  reviewer:        { label: 'Reviewer',        color: 'text-indigo-300',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/25' },
  executor:        { label: 'Executor',        color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  'project manager': { label: 'PM',            color: 'text-purple-300',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25' },
};

const getRoleMeta = (role: string) =>
  ROLE_META[role] ?? { label: role, color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/25' };

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

const progressColor = (p: number) => {
  if (p >= 80) return 'from-emerald-500 to-teal-400';
  if (p >= 40) return 'from-amber-500 to-yellow-400';
  return 'from-rose-500 to-pink-400';
};

const tasksBurden = (roles: EnrichedTaskRole[]) => {
  const total = roles.length;
  const done  = roles.filter(r => (r.task?.progress ?? 0) >= 100).length;
  return { total, done };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = getRoleMeta(role);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono tracking-wide border ${m.bg} ${m.color} ${m.border}`}>
      <Tag className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

function MiniProgress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${progressColor(value)} transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-400 w-7 text-right">{value}%</span>
    </div>
  );
}

function TaskCard({ role }: { role: EnrichedTaskRole }) {
  const task = role.task;
  const progress = task?.progress ?? 0;
  const isComplete = progress >= 100;

  return (
    <div className={`
      group relative rounded-xl border transition-all duration-200
      ${isComplete
        ? 'bg-emerald-900/10 border-emerald-500/15 hover:border-emerald-500/30'
        : 'bg-slate-800/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'}
      p-3.5
    `}>
      {/* Role badge */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            : <Activity className="w-3.5 h-3.5 text-cyan-400/70 shrink-0" />
          }
          <p className="text-xs font-medium text-slate-200 truncate leading-snug">
            {task?.name ?? <span className="text-slate-500 italic">Unknown Task</span>}
          </p>
        </div>
        <RoleBadge role={role.role} />
      </div>

      {/* Progress bar */}
      <MiniProgress value={progress} />

      {/* Meta row */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {task?.code && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <GitBranch className="w-2.5 h-2.5" />{task.code}
          </span>
        )}
        {task?.startDate && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Calendar className="w-2.5 h-2.5" />{fmtDate(task.startDate)}
          </span>
        )}
        {task?.endDate && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="w-2.5 h-2.5" />→ {fmtDate(task.endDate)}
          </span>
        )}
        {role.project && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Briefcase className="w-2.5 h-2.5" />{role.project.name}
          </span>
        )}
      </div>
    </div>
  );
}

function ResourceRow({ user, roles, isExpanded, onToggle }: {
  user: CustomUser;
  roles: EnrichedTaskRole[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { total, done } = tasksBurden(roles);
  const avgProgress = roles.length
    ? Math.round(roles.reduce((sum, r) => sum + (r.task?.progress ?? 0), 0) / roles.length)
    : 0;

  const roleBreakdown = Object.entries(
    roles.reduce((acc, r) => ({ ...acc, [r.role]: (acc[r.role] ?? 0) + 1 }), {} as Record<string, number>)
  );

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden bg-slate-900/50 backdrop-blur-sm">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center font-bold text-sm text-cyan-300 font-mono">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          {done === total && total > 0 && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100">{user.username}</span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-md">
              {user.jobTitle || 'Resource'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">{user.employeeCode}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-4">
            {/* Mini overall bar */}
            <div className="flex items-center gap-1.5 flex-1 max-w-32">
              <div className="flex-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${progressColor(avgProgress)}`}
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-500">{avgProgress}%</span>
            </div>

            {/* Role pills */}
            <div className="flex gap-1.5 flex-wrap">
              {roleBreakdown.map(([role, count]) => {
                const m = getRoleMeta(role);
                return (
                  <span key={role} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${m.bg} ${m.color} ${m.border}`}>
                    {m.label} ×{count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-slate-200">{total}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-emerald-400">{done}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Done</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-rose-400">{total - done}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Active</div>
          </div>
        </div>

        {/* Chevron */}
        <div className="shrink-0 text-slate-500">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Task grid */}
      {isExpanded && (
        <div className="border-t border-white/5 px-5 py-4">
          {roles.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No tasks assigned.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {roles.map(role => (
                <TaskCard key={role.id} role={role} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResourcePlan({
  users,
  taskRoles,
  projects,
  revisions,
  nodes,
  activeRevisionId,
  onExit,
}: ResourcePlanProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [sortBy, setSortBy] = useState<'name' | 'tasks' | 'progress'>('tasks');

  // Enrich task roles with task/project/revision data
  const enriched = useMemo<EnrichedTaskRole[]>(() => {
    return taskRoles.map(tr => {
      const task = nodes.find(n => n.id === tr.taskId && n.type === 'activity') as ActivityNode | undefined;
      const revision = revisions.find(r => r.id === tr.revisionId) ?? null;
      const project = revision ? projects.find(p => p.id === revision.projectId) ?? null : null;
      return { ...tr, task: task ?? null, revision, project };
    });
  }, [taskRoles, nodes, revisions, projects]);

  // Filter
  const filtered = useMemo(() => {
    return enriched.filter(r => {
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchUser = users.find(u => u.id === r.userId);
        return (
          matchUser?.username.toLowerCase().includes(q) ||
          r.task?.name.toLowerCase().includes(q) ||
          r.task?.code.toLowerCase().includes(q) ||
          r.project?.name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enriched, roleFilter, search, users]);

  // Group by user
  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedTaskRole[]>();
    for (const role of filtered) {
      if (!map.has(role.userId)) map.set(role.userId, []);
      map.get(role.userId)!.push(role);
    }
    const entries = [...map.entries()].map(([uid, roles]) => {
      const user = users.find(u => String(u.id) === String(uid));
      const avgProgress = roles.length
        ? roles.reduce((s, r) => s + (r.task?.progress ?? 0), 0) / roles.length
        : 0;
      return { uid, user, roles, avgProgress };
    });

    entries.sort((a, b) => {
      if (sortBy === 'tasks')    return b.roles.length - a.roles.length;
      if (sortBy === 'progress') return b.avgProgress - a.avgProgress;
      return (a.user?.username ?? '').localeCompare(b.user?.username ?? '');
    });

    return entries;
  }, [filtered, users, sortBy]);

  const toggleUser = (uid: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const expandAll  = () => setExpandedUsers(new Set(grouped.map(g => g.uid)));
  const collapseAll = () => setExpandedUsers(new Set());

  // Summary stats
  const totalAssignments = filtered.length;
  const uniqueResources  = grouped.length;
  const totalComplete    = filtered.filter(r => (r.task?.progress ?? 0) >= 100).length;
  const unassignedTasks  = nodes.filter(n => n.type === 'activity' && !taskRoles.some(r => r.taskId === n.id)).length;

  return (
    <div className="min-h-screen bg-[#07090f] text-slate-200 font-sans">

      {/* ── Background glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[700px] h-[400px] bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5 text-cyan-400 w-[18px] h-[18px]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">Resource Plan</h1>
                  <p className="text-[11px] text-slate-500">All assigned tasks across team members</p>
                </div>
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/5">
              <button
                onClick={() => setViewMode('grouped')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'flat' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users,        label: 'Resources',     value: uniqueResources,    color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
            { icon: Target,       label: 'Assignments',   value: totalAssignments,   color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
            { icon: CheckCircle2, label: 'Completed',     value: totalComplete,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { icon: AlertTriangle,label: 'Unassigned',    value: unassignedTasks,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className={`${color} mb-2`}><Icon className="w-4 h-4" /></div>
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search resource or task…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-900/60 border border-white/8 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-500" />
            <div className="flex rounded-lg p-0.5 bg-slate-900/60 border border-white/8 gap-0.5">
              {['all', 'owner', 'executor', 'reviewer', 'project manager'].map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors capitalize ${
                    roleFilter === r ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {r === 'all' ? 'All' : getRoleMeta(r).label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-900/60 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/40 font-mono"
          >
            <option value="tasks">Sort: Most Tasks</option>
            <option value="progress">Sort: Progress</option>
            <option value="name">Sort: Name A–Z</option>
          </select>

          {/* Expand/collapse */}
          {viewMode === 'grouped' && (
            <div className="flex gap-1.5">
              <button onClick={expandAll} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono">
                Expand all
              </button>
              <button onClick={collapseAll} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono">
                Collapse
              </button>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400 font-medium">No assignments found</p>
            <p className="text-xs text-slate-600 mt-1">Adjust filters or assign users to tasks via the WBS table.</p>
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped view */
          <div className="space-y-3">
            {grouped.map(({ uid, user, roles }) => (
              user ? (
                <ResourceRow
                  key={uid}
                  user={user}
                  roles={roles}
                  isExpanded={expandedUsers.has(uid)}
                  onToggle={() => toggleUser(uid)}
                />
              ) : null
            ))}
          </div>
        ) : (
          /* Flat table view */
          <div className="rounded-2xl border border-white/5 overflow-hidden bg-slate-900/50">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 bg-black/20">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Resource</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Task</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Role</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Project</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Start</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">End</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 min-w-28">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((role, i) => {
                    const user = users.find(u => String(u.id) === String(role.userId));
                    return (
                      <tr
                        key={role.id}
                        className={`border-b border-white/[0.04] hover:bg-white/2 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-[9px] font-bold font-mono text-cyan-300 shrink-0">
                              {(user?.username ?? '?').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-slate-200 font-medium">{user?.username ?? '—'}</div>
                              <div className="text-[9px] text-slate-500 font-mono">{user?.jobTitle}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-200 font-medium max-w-48 truncate">{role.task?.name ?? '—'}</div>
                          {role.task?.code && <div className="text-[9px] font-mono text-slate-500">{role.task.code}</div>}
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={role.role} /></td>
                        <td className="px-4 py-3 text-slate-400 max-w-32 truncate">{role.project?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{fmtDate(role.task?.startDate)}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{fmtDate(role.task?.endDate)}</td>
                        <td className="px-4 py-3 min-w-28"><MiniProgress value={role.task?.progress ?? 0} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer legend ── */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5 text-[10px] text-slate-600 font-mono">
          {Object.entries(ROLE_META).map(([key, m]) => (
            <span key={key} className={`flex items-center gap-1.5 ${m.color}`}>
              <span className={`w-2 h-2 rounded-full ${m.bg} border ${m.border}`} />
              {m.label}
            </span>
          ))}
          <span className="ml-auto">{totalAssignments} total assignments · {uniqueResources} resources</span>
        </div>
      </div>
    </div>
  );
}
