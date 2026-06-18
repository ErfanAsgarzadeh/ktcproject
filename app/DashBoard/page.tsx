/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Toolbar from '../../components/Toolbar';
import WbsTable from '../../components/WbsTable';
import GanttChart from '../../components/GanttChart';
import TaskDetailsPanel from '../../components/TaskDetailsPanel';
import ProjectHub from '../../components/ProjectHub';
import { ProjectNode, ActivityNode, Dependency, ZoomLevel, Project, Revision, CustomUser, TaskRole, ChatMessage } from '../../types/types';
import {
  performWbsRollups,
  calculateCriticalPath,
  rescheduleProject,
  getFlattenedHierarchyList,
} from '../../utils/scheduler';
import { HelpCircle, CodeSquare, FolderOpen, MessageSquare, ExternalLink, X, Send, Lock, CheckCircle, Copy } from 'lucide-react';
import { apiClient } from '../../lib/api';

export default function App() {
  // ==========================================
  // 1. Primary States
  // ==========================================
  const [currentView, setCurrentView] = useState<'hub' | 'workspace'>('hub');

  const [projects, setProjects] = useState<Project[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [users, setUsers] = useState<CustomUser[]>([]);
  const [taskRoles, setTaskRoles] = useState<TaskRole[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);

  const [nodes, setNodes] = useState<ProjectNode[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(true);
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInputForModal, setChatInputForModal] = useState<string>('');
  const [chatUserIdForModal, setChatUserIdForModal] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [chatUserId, setChatUserId] = useState('');

  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [ganttFilter, setGanttFilter] = useState<'both' | 'wbs' | 'activity'>('both');
  const [wbsTableWidth, setWbsTableWidth] = useState<number>(550);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement | null>(null);


  const [resources, setResources] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/planning/resources/')
        .then(res => setResources(res.data))
        .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (activeRevisionId && currentView === 'workspace') {
      apiClient.get(`/planning/assignments/?revision_id=${activeRevisionId}`)
          .then(res => setAssignments(res.data))
          .catch(err => console.error(err));
    }
  }, [activeRevisionId, currentView]);


  const handleAddAssignment = async (taskId: string, resourceId: string, unitsPercent: number) => {
    try {
      const res = await apiClient.post('/planning/assignments/', {
        revisionId: activeRevisionId,
        taskId: taskId,
        resourceId:resourceId,
        unitsPercent: unitsPercent
      });
      setAssignments(prev => [...prev, res.data]);
    } catch (err) {
      alert("خطا در تخصیص منبع. احتمالاً قبلاً اضافه شده است.");
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await apiClient.delete(`/planning/assignments/${assignmentId}/`);
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) { console.error(err); }
  };

  // ── Handler برای ذخیره اطلاعات واقعی (Actual Start/Finish/Progress) ──
  const handleSaveActual = async (taskId: string, data: { actualStart?: string; actualFinish?: string; progress: number }) => {
    try {
      await apiClient.patch(`/planning/activities/${taskId}/`, {
        actual_start: data.actualStart || null,
        actual_finish: data.actualFinish || null,
        progress: data.progress,
      });

      // آپدیت لوکال: progress تسک را در state آپدیت کن
      setNodes(prev => prev.map(n =>
          n.id === taskId
              ? {
                ...n,
                progress: data.progress,
                actual: {
                  actualStart: data.actualStart || '',
                  actualFinish: data.actualFinish || '',
                  progress: data.progress,
                }
              } as any
              : n
      ));
    } catch (err) {
      console.error("Error saving actual data:", err);
      alert("خطا در ذخیره اطلاعات واقعی تسک.");
    }
  };
  // ==========================================
  // 2. Data Fetching (API Integration)
  // ==========================================
  useEffect(() => {
    apiClient.get('/planning/projects/')
        .then(res => setProjects(res.data))
        .catch(err => console.error('Failed to fetch projects:', err));

    apiClient.get('/auth/users/')
        .then(res => setUsers(res.data))
        .catch(err => console.log('Users API might not be ready yet.', err));
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      apiClient.get(`/planning/revisions/?project_id=${activeProjectId}`)
          .then(res => setRevisions(res.data))
          .catch(err => console.error('Failed to fetch revisions:', err));
    } else {
      setRevisions([]);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeRevisionId && currentView === 'workspace') {
      apiClient.get(`/planning/revisions/${activeRevisionId}/gantt-data/`)
          .then(res => {
            const fetchedNodes = res.data.nodes || [];
            const fetchedDeps = res.data.dependencies || [];

            const rolled = performWbsRollups(fetchedNodes);
            const cpmMapped = updateCpmResults(rolled, fetchedDeps);

            setNodes(cpmMapped);
            setDependencies(fetchedDeps);

            const root = cpmMapped.find(n => n.parentId === null);
            setSelectedNodeId(root ? root.id : cpmMapped[0]?.id || null);
          })
          .catch(err => console.error('Failed to fetch Gantt data:', err));
      apiClient.get(`/planning/task-roles/?revision_id=${activeRevisionId}`)
          .then(res => setTaskRoles(res.data))
          .catch(err => console.error('Failed to fetch task roles:', err));
    }

  }, [activeRevisionId, currentView]);

  const handleImportMsp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // اطمینان از انتخاب پروژه و نسخه
    if (!activeProjectId || !activeRevisionId) {
      alert("لطفاً ابتدا یک پروژه و نسخه (Revision) فعال را انتخاب کنید.");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', activeProjectId); // استفاده از State فعال
    formData.append('revision_id', activeRevisionId); // استفاده از State فعال
    if (selectedNodeId) {
      formData.append('active_node_id', selectedNodeId);
    }
    setIsLaunching(true);

    try {
      const res = await apiClient.post('/planning/import-msp/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert(`اطلاعات با موفقیت به نسخه جاری اضافه شد! ${res.data.tasks} تسک و ${res.data.wbs_nodes} گره WBS اضافه گردید.`);

      // رفرش کردن اطلاعات صفحه برای نمایش تغییرات جدید
      // دریافت مجدد دیتای گانت‌چارت برای نسخه فعلی
      apiClient.get(`/planning/revisions/${activeRevisionId}/gantt-data/`)
          .then(res => {
            const fetchedNodes = res.data.nodes || [];
            const fetchedDeps = res.data.dependencies || [];
            const rolled = performWbsRollups(fetchedNodes);
            const cpmMapped = updateCpmResults(rolled, fetchedDeps);
            setNodes(cpmMapped);
            setDependencies(fetchedDeps);
          });

    } catch (error) {
      console.error("Error importing MSP file:", error);
      alert("خطا در ایمپورت فایل. لطفاً مطمئن شوید فایل خروجی استاندارد XML است.");
    } finally {
      setIsLaunching(false);
      if (e.target) e.target.value = '';
    }
  };
  // ==========================================
  // 3. Helper Functions & Derived State
  // ==========================================
  const updateCpmResults = (currentNodes: ProjectNode[], currentDeps: Dependency[]): ProjectNode[] => {
    const cpm = calculateCriticalPath(currentNodes, currentDeps);
    return currentNodes.map(node => {
      if (node.type === 'activity') {
        const data = cpm[node.id];
        const backendMetrics = (node as any).metrics; // گرفتن متریک‌های سمت بک‌اند

        return {
          ...node,
          // اولویت با دیتای بک‌اند است، اگر نبود از فرمول لوکال استفاده کن
          isCritical: backendMetrics ? backendMetrics.isCritical : (data ? data.isCritical : false),
          totalFloat: backendMetrics ? (backendMetrics.totalFloatHours ) : (data ? data.totalFloat : 0),
          cpmData: data || null
        } as any;
      }
      return node;
    });
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const activeRevision = revisions.find(r => r.id === activeRevisionId) || null;
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  // منطق هوشمند بررسی وضعیت قفل
  const isRevisionLocked = Boolean(activeRevision?.approvedAt);
  const effectiveEditMode = isRevisionLocked ? false : isEditMode;

  const flattenedNodes = useMemo(() => {
    const list = getFlattenedHierarchyList(nodes, null, 0);
    if (ganttFilter === 'wbs') return list.filter(item => item.node.type === 'wbs');
    if (ganttFilter === 'activity') return list.filter(item => item.node.type === 'activity');
    console.log(list)
    return list;
  }, [nodes, ganttFilter]);

  const nodesCountByRevision = useMemo(() => {
    const counts: Record<string, number> = {};
    revisions.forEach(rev => counts[rev.id] = nodes.length);
    return counts;
  }, [revisions, nodes]);

  // ==========================================
  // 4. Standalone Chat View Check
  // ==========================================
  if (typeof window !== 'undefined') {
    const urlParams = new URL(window.location.href).searchParams;
    const chatTaskId = urlParams.get('chat');

    if (chatTaskId) {
      const activeTask = nodes.find(n => n.id === chatTaskId);
      const taskMessages = chatMessages.filter(m => m.taskId === chatTaskId).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return (
          <div className="h-full w-full flex flex-col font-sans" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="bg-white/5 backdrop-blur-md px-4 py-3 border-b border-white/10 shrink-0 select-none flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h4 className="text-[12px] font-mono uppercase tracking-wider text-slate-300">
                  Collaboration Chat: <span className="text-cyan-400">{activeTask?.name || chatTaskId}</span>
                </h4>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
              {taskMessages.length === 0 && (
                  <div className="text-[11px] italic text-slate-500 text-center mt-10 p-6 bg-white/5 rounded-xl border border-white/5 mx-auto max-w-sm">No messages yet.</div>
              )}
              {taskMessages.map(msg => {
                const sender = users.find(u => u.id === msg.userId);
                return (
                    <div key={msg.id} className="bg-black/40 border border-white/5 rounded-xl p-3 shadow-sm max-w-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-cyan-400">{sender?.username || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                         {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                      </div>
                      <p className="text-[13px] text-slate-300 bg-white/[0.02] p-3 rounded-lg inline-block w-full">{msg.text}</p>
                    </div>
                )
              })}
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!chatInput.trim() || !chatUserId) return;
              const newMessage: ChatMessage = {
                id: `msg-${Date.now()}`, taskId: chatTaskId, userId: chatUserId, text: chatInput.trim(), timestamp: new Date().toISOString()
              };
              setChatMessages([...chatMessages, newMessage]);
              setChatInput('');
            }} className="p-4 bg-black/40 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <select
                    value={chatUserId}
                    onChange={e => setChatUserId(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-400 w-1/4 shrink-0"
                >
                  <option value="">Post as...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <input
                    value={chatInput} onChange={e=>setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 min-w-0"
                />
                <button
                    type="submit" disabled={!chatInput.trim() || !chatUserId}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-white px-5 py-2 rounded-lg shrink-0 font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
      );
    }
  }

  // ==========================================
  // 5. Event Handlers (API & Logic)
  // ==========================================
  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    const projRevs = revisions.filter(r => r.projectId === id);
    if (projRevs.length > 0) setActiveRevisionId(projRevs[0].id);
  };

  const handleSelectRevision = (id: string) => setActiveRevisionId(id);

  const handleAddProject = async (name: string, description: string, startDate: string, endDate: string, calendarId?: string | null) => {
    try {
      // ارسال پارامترهای جدید به بک‌اند
      const res = await apiClient.post('/planning/projects/', {
        name,
        description,
        start_date: startDate,
        end_date: endDate,
        calendarId: calendarId || null
      });

      setProjects([...projects, res.data]);
      setActiveProjectId(res.data.id);

      // پس از ایجاد پروژه، بلافاصله لیست ریویژن‌های آن را درخواست می‌کنیم
      // تا ریویژن صفری که بک‌اند خودکار ساخته را دریافت کنیم.
      const revRes = await apiClient.get(`/planning/revisions/?project_id=${res.data.id}`);
      setRevisions(revRes.data);

      if (revRes.data.length > 0) {
        // ریویژن صفر را به عنوان ریویژن فعال انتخاب می‌کنیم
        const revZero = revRes.data.find((r: any) => r.number === 0) || revRes.data[0];
        setActiveRevisionId(revZero.id);
      }
    } catch (err) {
      console.error("Error creating project:", err);
    }
  };

  // الصاق/تغییر تقویم یک پروژه موجود
  const handleAttachCalendar = async (projectId: string, calendarId: string | null) => {
    try {
      const res = await apiClient.patch(`/planning/projects/${projectId}/`, { calendarId: calendarId || null });
      setProjects(prev => prev.map(p => p.id === projectId ? res.data : p));
    } catch (err) {
      console.error("Error attaching calendar:", err);
      alert("خطا در الصاق تقویم به پروژه.");
    }
  };

  const handleUpdateRevisionDates = async (revisionId: string, newStart: string, newEnd: string) => {    try {
      // ارسال درخواست پچ به بک‌اند برای آپدیت تاریخ‌ها
      await apiClient.patch(`/planning/revisions/${revisionId}/`, {
        projectStart: newStart,
        projectEnd: newEnd
      });

      // آپدیت کردن استیت در فرانت‌اند تا تغییرات بلافاصله دیده شود
      setRevisions(prev => prev.map(r =>
          r.id === revisionId
              ? { ...r, projectStart: newStart, projectEnd: newEnd }
              : r
      ));
    } catch (err) {
      console.error("Error updating revision dates", err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await apiClient.delete(`/planning/projects/${id}/`);
      setProjects(projects.filter(p => p.id !== id));
      setActiveProjectId(null);
    } catch (err) { console.error("Error deleting project", err); }
  };

  const handleAddRevision = async (projectId: string, description: string, projectStart: string) => {
    try {
      const res = await apiClient.post('/planning/revisions/', { projectId, description, projectStart, isBaseline: false });
      setRevisions([...revisions, res.data]);
      setActiveRevisionId(res.data.id);
    } catch (err) { console.error("Error creating revision", err); }
  };

  const handleDuplicateRevision = async (revisionId: string, description: string) => {
    const sourceRev = revisions.find(r => r.id === revisionId);
    if (!sourceRev) return;
    handleAddRevision(sourceRev.projectId, description || `Clone of Rev ${sourceRev.number}`, sourceRev.projectStart);
  };

  const handleDeleteRevision = async (id: string) => {
    try {
      await apiClient.delete(`/planning/revisions/${id}/`);
      setRevisions(revisions.filter(r => r.id !== id));
      setActiveRevisionId(null);
    } catch (err) { console.error("Error deleting revision", err); }
  };

  const handleUpdateNode = async (id: string, updatedFields: Partial<ProjectNode>) => {
    if (!effectiveEditMode) return;

    // اگه تاریخ یا مدت زمان دستی ادیت میشه، reschedule نباید اون‌ها رو overwrite کنه
    const isManualDateEdit = 'startDate' in updatedFields || 'endDate' in updatedFields || 'duration' in updatedFields;

    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, ...updatedFields } as any : n);
      let solved = performWbsRollups(next);
      if (autoSchedule && !isManualDateEdit) solved = rescheduleProject(solved, dependencies); // ← تنها تغییر
      return updateCpmResults(solved, dependencies);
    });

    try {
      const nodeType = nodes.find(n => n.id === id)?.type; // ← stale closure رو هم درست کردیم
      const endpoint = nodeType === 'wbs' ? `/planning/wbs-nodes/${id}/` : `/planning/activities/${id}/`;
      await apiClient.patch(endpoint, updatedFields);
    } catch (error) { console.error("Error updating node:", error); }
  };

  // جابجایی ترتیب تسک‌ها با drag & drop (فقط بین هم‌نیاهای زیر یک نود)
  const handleReorderTask = async (draggedId: string, targetId: string) => {
    if (!effectiveEditMode) return;
    const dragged = nodes.find(n => n.id === draggedId);
    const target = nodes.find(n => n.id === targetId);
    if (!dragged || !target) return;
    if (dragged.type !== 'activity' || target.type !== 'activity') return;
    if (dragged.parentId !== target.parentId) return; // فقط داخل همان نود

    // هم‌نیاهای فعلی به ترتیب نمایش (sequence سپس تاریخ)
    const siblings = nodes
        .filter(n => n.type === 'activity' && n.parentId === dragged.parentId)
        .sort((a, b) => {
          const sa = (a as any).sequence || 0;
          const sb = (b as any).sequence || 0;
          if (sa !== sb && sa > 0 && sb > 0) return sa - sb;
          const ta = a.startDate ? new Date(a.startDate.replace(' ', 'T')).getTime() : 0;
          const tb = b.startDate ? new Date(b.startDate.replace(' ', 'T')).getTime() : 0;
          return ta - tb;
        });

    const fromIdx = siblings.findIndex(n => n.id === draggedId);
    const toIdx = siblings.findIndex(n => n.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // تخصیص sequence جدید 1..N
    const updates = reordered.map((n, i) => ({ id: n.id, sequence: i + 1 }));

    // آپدیت لوکال
    setNodes(prev => prev.map(n => {
      const u = updates.find(x => x.id === n.id);
      return u ? ({ ...n, sequence: u.sequence } as any) : n;
    }));

    // ذخیره در بک‌اند
    try {
      await Promise.all(
          updates.map(u => apiClient.patch(`/planning/activities/${u.id}/`, { sequence: u.sequence }))
      );
    } catch (error) {
      console.error('Error reordering tasks:', error);
    }
  };

  const handleToggleExpand = (id: string) => {
    setNodes(prev => prev.map(n => n.id === id && n.type === 'wbs' ? { ...n, isExpanded: !n.isExpanded } : n));
  };

  const handleAddWbs = async () => {
    if (!activeRevisionId || !effectiveEditMode) return;
    try {
      const res = await apiClient.post('/planning/wbs-nodes/', {
        revisionId: activeRevisionId, name: 'New Phase Summary Segment', type: 'wbs', parentId: selectedNodeId || null, startDate: '2026-06-01', endDate: '2026-06-05',
      });
      setNodes(prev => performWbsRollups([...prev, res.data]));
      setSelectedNodeId(res.data.id);
    } catch (err) { console.error(err); }
  };

  const handleAddActivity = async (targetParentId?: string) => {
    if (!activeRevisionId || !effectiveEditMode) return;
    let parentId: string | null = (targetParentId && typeof targetParentId === 'string') ? targetParentId : null;
    if (!parentId && selectedNodeId) {
      const selected = nodes.find(n => n.id === selectedNodeId);
      parentId = selected?.type === 'wbs' ? selected.id : (selected?.parentId || null);
    }

    try {
      const res = await apiClient.post('/planning/activities/', {
        revision_id: activeRevisionId, name: 'New Task Activity', parentId: parentId, startDate: '2026-06-01', endDate: '2026-06-05',
      });
      setNodes(prev => {
        const next = [...prev, res.data];
        const rolled = performWbsRollups(next);
        return updateCpmResults(rolled, dependencies);
      });
      setSelectedNodeId(res.data.id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteNode = async (id: string) => {
    if (!effectiveEditMode) return;
    try {
      const node = nodes.find(n => n.id === id);
      const endpoint = node?.type === 'wbs' ? `/planning/wbs-nodes/${id}/` : `/planning/activities/${id}/`;
      await apiClient.delete(endpoint);
      setNodes(prev => {
        const remaining = prev.filter(n => n.id !== id && n.parentId !== id);
        let solved = performWbsRollups(remaining);
        if (autoSchedule) solved = rescheduleProject(solved, dependencies);
        return updateCpmResults(solved, dependencies);
      });
      if (selectedNodeId === id) setSelectedNodeId(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteSelected = () => {
    if (selectedNodeId) handleDeleteNode(selectedNodeId);
  };

  const handleAddDependency = async (
      fromId: string,
      toId: string,
      type: string = 'FS',   // ← اضافه
      lag: number = 0        // ← اضافه
  ) => {
    if (!effectiveEditMode || fromId === toId || dependencies.some(d => d.fromId === fromId && d.toId === toId)) return;
    try {
      const res = await apiClient.post('/planning/dependencies/', {
        revisionId: activeRevisionId, fromId, toId, type, lag  // ← دیگه هاردکد نیست
      });
      const nextDeps = [...dependencies, res.data];
      setDependencies(nextDeps);
      setNodes(prev => {
        let solved = prev;
        if (autoSchedule) solved = rescheduleProject(prev, nextDeps);
        return updateCpmResults(solved, nextDeps);
      });
    } catch (err) { console.error(err); }
  };

  const handleDeleteDependency = async (depId: string) => {
    if (!effectiveEditMode) return;
    try {
      await apiClient.delete(`/planning/dependencies/${depId}/`);
      const nextDeps = dependencies.filter(d => d.id !== depId);
      setDependencies(nextDeps);
      setNodes(prev => {
        let solved = prev;
        if (autoSchedule) solved = rescheduleProject(prev, nextDeps);
        return updateCpmResults(solved, nextDeps);
      });
    } catch (err) { console.error(err); }
  };

  const handleUpdatePredecessors = (activityId: string, codesString: string) => {
    if (!effectiveEditMode) return;
    const codes = codesString.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    let nextDeps = dependencies.filter(d => d.toId !== activityId);
    codes.forEach((code, index) => {
      const predNode = nodes.find(n => n.code.toUpperCase() === code && n.type === 'activity');
      if (predNode && predNode.id !== activityId) {
        nextDeps.push({ id: `dep-temp-${Date.now()}-${index}`, fromId: predNode.id, toId: activityId, type: 'FS', lag: 0 });
      }
    });
    setDependencies(nextDeps);
    setNodes(prev => {
      let solved = autoSchedule ? rescheduleProject(prev, nextDeps) : performWbsRollups(prev);
      return updateCpmResults(solved, nextDeps);
    });
  };

  const handleRunF9Scheduler = () => {
    setNodes(prev => updateCpmResults(rescheduleProject(prev, dependencies), dependencies));
  };

  // ==========================================
  // New Revision API Handlers
  // ==========================================
  const handleApproveRevision = async () => {
    if (!activeRevisionId) return;
    if (!window.confirm("آیا از تایید و قفل کردن این نسخه اطمینان دارید؟ بعد از تایید، هیچ تغییری در این نسخه امکان‌پذیر نخواهد بود.")) return;

    try {
      await apiClient.post(`/planning/revisions/${activeRevisionId}/approve/`);
      setRevisions(prev => prev.map(r =>
          r.id === activeRevisionId ? { ...r, approvedAt: new Date().toISOString() } : r
      ));
      setIsEditMode(false);
    } catch (err) {
      console.error("Error approving revision", err);
      alert("خطا در قفل کردن نسخه.");
    }
  };

  const handleCreateDraft = async () => {
    if (!activeRevisionId) return;

    // دریافت دلیل/توضیح از کاربر (اجباری)
    const description = window.prompt(
      "لطفاً دلیل ساخت پیش‌نویس جدید را وارد کنید:\n(این فیلد اجباری است)",
      ""
    );

    // اگر کاربر Cancel زد یا خالی گذاشت، متوقف شود
    if (!description || !description.trim()) {
      alert("وارد کردن توضیحات برای ساخت پیش‌نویس الزامی است.");
      return;
    }

    try {
      setIsLaunching(true);
      const res = await apiClient.post(`/planning/revisions/${activeRevisionId}/create-draft/`, {
        description: description.trim(),
      });
      setRevisions([...revisions, res.data]);
      setActiveRevisionId(res.data.id);
      setIsEditMode(true);
    } catch (err) {
      console.error("Error creating draft", err);
      alert("خطا در ساخت پیش‌نویس جدید.");
    } finally {
      setIsLaunching(false);
    }
  };

  const handleAddChatMessage = (taskId: string, userId: string, text: string) => {
    setChatMessages([...chatMessages, { id: `msg-${Date.now()}`, taskId, userId, text, timestamp: new Date().toISOString() }]);
  };

  const handleAddTaskRole = async (taskId: string, userId: string, role: any) => {
    if (activeRevisionId && effectiveEditMode) {
      try {
        // ارسال دیتا به بک‌اند
        const res =await apiClient.post('/planning/task-roles/', {
          revisionId: activeRevisionId,
          taskId: taskId,
          userId: userId,
          role: role
        });

        // جایگذاری دیتای برگشتی (که دارای id واقعی دیتابیس است) در فرانت‌اند
        setTaskRoles([...taskRoles, res.data]);
      } catch (err) {
        console.error("Error saving task role:", err);
        alert("خطا در تخصیص کاربر! ممکن است این نقش قبلاً برای کاربر انتخاب شده باشد.");
      }
    }
  };
  const handleDeleteTaskRole = async (id: string) => {
    if(effectiveEditMode) {
      try {
        // حذف مستقیم از دیتابیس بک‌اند
        await apiClient.delete(`/planning/task-roles/${id}/`);

        // آپدیت کردن لیست در ظاهر سایت
        setTaskRoles(taskRoles.filter(tr => tr.id !== id));
      } catch (err) {
        console.error("Error deleting task role:", err);
        alert("خطا در حذف تخصیص کاربر.");
      }
    }
  };

  const handleExportCsv = () => { alert("Export logic executed."); };
  const handleExportJson = () => { alert("Export logic executed."); };

  const handlePrint = () => { window.print(); };

  const handleLaunchToBackend = () => {
    setIsLaunching(true);
    setTimeout(() => {
      if (nodes.length > 0) setNodes(rescheduleProject(nodes, dependencies));
      setIsLaunching(false);
      setIsEditMode(false);
    }, 1500);
  };

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setWbsTableWidth(Math.max(320, Math.min(window.innerWidth - 320, moveEvent.clientX)));
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (ganttContainerRef.current) ganttContainerRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableContainerRef.current) tableContainerRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleRunCPM = async () => {
    // اطمینان از اینکه در حالت ادیت هستیم و نسخه‌ای انتخاب شده
    if (!activeRevisionId || isRevisionLocked || !isEditMode) return;

    try {
      // در صورت نیاز، می‌توانید یک State برای Loading اینجا true کنید
      // setIsLoading(true);
      const res = await apiClient.post(`/planning/revisions/${activeRevisionId}/run-cpm/`);



      // گرفتن دیتای جدید و آپدیت کردن استیت‌های گانت‌چارت
      const updatedData = await res.data;

      // فرض بر این است که متدهای setNodes و setDependencies را دارید
      setNodes(updatedData.nodes);
      setDependencies(updatedData.dependencies);

      // یک نوتیفیکیشن موفقیت‌آمیز به کاربر نشان دهید
      console.log("محاسبات با موفقیت انجام شد و گراف آپدیت شد!");

    } catch (error) {
      console.error("Failed to execute CPM engine:", error);
      alert("ارتباط با سرور برای انجام محاسبات قطع شد.");
    } finally {
      // setIsLoading(false);
    }
  };


  // ==========================================
  // 6. Main UI Render
  // ==========================================
  return (
      <div className="flex flex-col h-full w-full overflow-hidden font-sans relative" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="absolute top-[-10%] left-[-10%] w-full h-[40%] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-full h-[50%] bg-cyan-600/15 blur-[150px] rounded-full pointer-events-none z-0"></div>

        {currentView === 'hub' ? (
            <ProjectHub
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProject}
                onAddProject={handleAddProject}
                onDeleteProject={handleDeleteProject}
                revisions={revisions}
                activeRevisionId={activeRevisionId}
                onSelectRevision={handleSelectRevision}
                onAddRevision={handleAddRevision}
                onUpdateRevisionDates={handleUpdateRevisionDates}
                onDuplicateRevision={handleDuplicateRevision}
                onDeleteRevision={handleDeleteRevision}
                onEnterWorkspace={() => setCurrentView('workspace')}
                nodesCountByRevision={nodesCountByRevision}
                onAttachCalendar={handleAttachCalendar}
            />
        ) : (
            <>
              <Toolbar
                  projectName={activeProject?.name || 'Commercial Construction'}
                  revisionNumber={activeRevision?.number || 1}
                  onExitToHub={() => setCurrentView('hub')}
                  zoomLevel={zoomLevel}
                  onSelectZoom={setZoomLevel}
                  showCriticalPath={showCriticalPath}
                  onToggleCriticalPath={() => setShowCriticalPath(!showCriticalPath)}
                  autoSchedule={autoSchedule}
                  onToggleAutoSchedule={() => setAutoSchedule(!autoSchedule)}
                  onRunF9Scheduler={handleRunCPM}
                  nodes={nodes}
                  dependencies={dependencies}
                  selectedNodeId={selectedNodeId}
                  onAddWbs={handleAddWbs}
                  onAddActivity={handleAddActivity}
                  onDeleteSelected={handleDeleteSelected}
                  onExportCsv={handleExportCsv}
                  onExportJson={handleExportJson}
                  onImportMsp={handleImportMsp}
                  onPrint={handlePrint}
                  ganttFilter={ganttFilter}
                  onSelectGanttFilter={setGanttFilter}
                  isEditMode={effectiveEditMode}
                  isRevisionLocked={isRevisionLocked}
                  onApproveRevision={handleApproveRevision}
                  onCreateDraft={handleCreateDraft}
                  revisionStart={activeRevision?.projectStart}
                  revisionEnd={(activeRevision as any)?.projectEnd}
                  onToggleEditMode={() => {
                    if (!isRevisionLocked) setIsEditMode(!isEditMode);
                  }}
                  onLaunchToBackend={handleLaunchToBackend}
              />

              <div className="flex-1 flex overflow-hidden relative print:block z-10">
                {isLaunching && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-auto">
                      <div className="flex items-center gap-3 bg-indigo-500 text-white font-semibold font-mono tracking-wide shadow-[0_0_20px_rgba(99,102,241,0.5)] px-6 py-4 rounded-xl border border-indigo-400">
                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Processing Project Revisions via Backend Server...
                      </div>
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden min-w-0 print:block">
                  <div style={{ width: `${wbsTableWidth}px` }} className="min-w-[320px] shrink-0 flex flex-col overflow-hidden border-r border-white/10 print:hidden bg-white/[0.03] backdrop-blur-xl">
                    <div className="bg-white/5 border-b border-white/10 h-11 px-4 flex flex-row items-center justify-between shrink-0 select-none print:hidden">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Project Data Structure</span>
                      </div>
                    </div>

                    <WbsTable
                        flattenedNodes={flattenedNodes}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={setSelectedNodeId}
                        onToggleExpand={handleToggleExpand}
                        onUpdateNode={handleUpdateNode}
                        onUpdatePredecessors={handleUpdatePredecessors}
                        dependencies={dependencies}
                        allNodes={nodes}
                        onAddSubNode={handleAddActivity}
                        onDeleteNode={handleDeleteNode}
                        tableContainerRef={tableContainerRef}
                        onTableScroll={handleTableScroll}
                        taskRoles={taskRoles.filter(tr => tr.revisionId === activeRevisionId)}
                        users={users}
                        isEditMode={effectiveEditMode}
                        onReorderTask={handleReorderTask}
                    />
                  </div>

                  <div onMouseDown={handleDividerMouseDown} className="w-1.5 hover:w-2 bg-white/5 hover:bg-cyan-500 cursor-col-resize shrink-0 transition-all duration-150 h-full select-none z-30 flex items-center justify-center group" title="Drag to resize Gantt columns">
                    <div className="h-10 w-1 bg-white/20 group-hover:bg-white/70 rounded-full pointer-events-none transition-colors" />
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden print:w-full print:overflow-visible bg-white/[0.01]">
                    <div className="bg-white/5 border-b border-white/10 h-11 px-4 flex items-center justify-between shrink-0 select-none print:hidden">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <CodeSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Standard Interactive Gantt Canvas</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded border border-white/10 flex items-center gap-1.5 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span>Zoom Scale: <strong className="text-cyan-300 capitalize">{zoomLevel}s</strong></span>
                      </div>
                    </div>

                    <GanttChart
                        flattenedNodes={flattenedNodes}
                        dependencies={dependencies}
                        zoomLevel={zoomLevel}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={(id) => { setSelectedNodeId(id); setIsInspectorOpen(true); }}
                        showCriticalPath={showCriticalPath}
                        onGanttScroll={handleGanttScroll}
                        ganttContainerRef={ganttContainerRef}
                        isEditMode={effectiveEditMode}
                        projectStart={activeRevision?.projectStart}
                        projectEnd={(activeRevision as any)?.projectEnd}
                    />
                  </div>
                </div>

                {isInspectorOpen && (
                    <aside className="w-[320px] shrink-0 absolute right-0 top-0 bottom-0 z-30 lg:relative lg:z-10 shadow-2xl lg:shadow-none print:hidden transition-all duration-300 bg-white/5 backdrop-blur-2xl border-l border-white/10">
                      <TaskDetailsPanel
                          selectedNode={selectedNode}
                          onClose={() => setIsInspectorOpen(false)}
                          onUpdateNode={handleUpdateNode}
                          dependencies={dependencies}
                          allNodes={nodes}
                          onAddDependency={handleAddDependency}
                          onDeleteDependency={handleDeleteDependency}
                          users={users}
                          taskRoles={taskRoles.filter(tr => tr.revisionId === activeRevisionId)}
                          onAddTaskRole={handleAddTaskRole}
                          onDeleteTaskRole={handleDeleteTaskRole}
                          onAddActivity={handleAddActivity}
                          isEditMode={effectiveEditMode}
                          chatMessages={chatMessages}
                          onAddChatMessage={handleAddChatMessage}
                          onOpenChat={() => setIsChatOpen(true)}
                          resources={resources}
                          assignments={assignments}
                          onAddAssignment={handleAddAssignment}
                          onDeleteAssignment={handleDeleteAssignment}
                          onSaveActual={handleSaveActual}
                      />
                    </aside>
                )}
              </div>

              <footer className="h-7 border-t border-white/10 bg-white/5 backdrop-blur-md px-3 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0 select-none print:hidden z-10">
                <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
                  <span>Workspace: {activeProject?.name} (Auto-Schedule {autoSchedule ? 'On' : 'Off'})</span>
                </div>
                <div className="flex items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1 hover:text-cyan-300 transition-colors cursor-help" title="To reschedule network connections using FS lag limits, hit Schedule (F9)">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> F9 Scheduler Guide
              </span>
                  <span>Time: 2026 UTC Bounds</span>
                </div>
              </footer>

              {/* Full Screen Chat Modal Overlay */}
              {!effectiveEditMode && isChatOpen && selectedNode && selectedNode.type !== 'wbs' && (
                  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[150] flex items-center justify-center p-0 md:p-6 overflow-hidden">
                    <div className="bg-slate-900 border border-white/10 shadow-3xl w-full h-full md:rounded-xl flex flex-col overflow-hidden max-w-5xl">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-cyan-400 animate-pulse" />
                          <div>
                            <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-200">Task Collaboration Chat</h4>
                            <p className="text-[11px] text-slate-400">Selected: <span className="text-cyan-400">{selectedNode.name}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { window.open(`/?chat=${selectedNode.id}`, 'ChatWindow', 'width=450,height=600'); setIsChatOpen(false); }} className="text-slate-400 hover:text-cyan-400 p-1.5 hover:bg-white/5 rounded transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white p-1.5 hover:bg-white/5 rounded transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto w-full flex justify-center scrollbar-thin scrollbar-thumb-white/10 p-6">
                        <div className="w-full max-w-4xl space-y-4">
                          {(() => {
                            const nodeMessages = chatMessages.filter(m => m.taskId === selectedNode.id).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                            if (nodeMessages.length === 0) {
                              return <div className="text-xs italic text-slate-500 text-center py-12 bg-black/20 rounded-xl border border-white/5 mx-auto max-w-md my-12">No chat messages for this task yet. Start the conversation!</div>;
                            }
                            return nodeMessages.map(msg => {
                              const sender = users.find(u => u.id === msg.userId);
                              return (
                                  <div key={msg.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 shadow-sm hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">{sender?.username || 'Unknown User'}<span className="text-[10px] font-mono text-slate-500 font-normal py-0.5 px-2 bg-white/5 rounded">{sender?.jobTitle || 'N/A'}</span></span>
                                      <span className="text-[10px] text-slate-500 font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-relaxed font-sans break-words bg-white/[0.01] p-3 rounded-lg inline-block w-full">{msg.text}</p>
                                  </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 border-t border-white/10 shrink-0 w-full flex justify-center p-4 sm:p-6 pb-6 shadow-2xl">
                        <form onSubmit={(e) => { e.preventDefault(); if (!chatInputForModal.trim() || !chatUserIdForModal) return; handleAddChatMessage(selectedNode.id, chatUserIdForModal, chatInputForModal.trim()); setChatInputForModal(''); }} className="w-full max-w-4xl space-y-4">
                          <div className="flex items-center gap-3">
                            <select value={chatUserIdForModal} onChange={e => setChatUserIdForModal(e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 shrink-0 basis-1/3 sm:basis-1/4">
                              <option value="">Post as...</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                            <input type="text" value={chatInputForModal} onChange={e => setChatInputForModal(e.target.value)} placeholder="Type a message..." className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 min-w-0" />
                            <button type="submit" disabled={!chatInputForModal.trim() || !chatUserIdForModal} className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-lg font-mono text-xs transition-colors shrink-0 flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /><span>Send</span></button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
              )}
            </>
        )}
      </div>
  );
}