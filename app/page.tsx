/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */
'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Toolbar from '../components/Toolbar';
import WbsTable from '../components/WbsTable';
import GanttChart from '../components/GanttChart';
import TaskDetailsPanel from '../components/TaskDetailsPanel';
import ProjectHub from '../components/ProjectHub';
import { TEMPLATES } from '../test/templates';
import { ProjectNode, ActivityNode, Dependency, ZoomLevel, Project, Revision, CustomUser, TaskRole, ChatMessage } from '../types/types';
import {
  performWbsRollups,
  calculateCriticalPath,
  rescheduleProject,
  getFlattenedHierarchyList,
  adjustToWorkingDay,
  addWorkingDays
} from '../utils/scheduler';
import { HelpCircle, Sparkles, CodeSquare, FolderOpen, MessageSquare, ExternalLink, X, Send } from 'lucide-react';


const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Substructure & Superstructure Construction',
    description: 'An enterprise-level substructure and superstructure building schedule with nested WBS layers, structural dependencies, and critical path branches.',
    createdAt: new Date('2026-05-20T08:00:00Z').toISOString()
  },
  {
    id: 'proj-2',
    name: 'Enterprise Cloud App Release V2',
    description: 'Software launch and engineering plan outlining sprint grooming, core infrastructure development, QA cycles, multi-stage deployments, and legal compliance.',
    createdAt: new Date('2026-05-24T08:00:00Z').toISOString()
  }
];

const DEFAULT_REVISIONS: Revision[] = [
  {
    id: 'rev-1',
    projectId: 'proj-1',
    number: 1,
    description: 'Approved Baseline Schedule Level-2',
    projectStart: '2026-06-01',
    createdAt: new Date('2026-05-20T09:00:00Z').toISOString(),
    isBaseline: true
  },
  {
    id: 'rev-2',
    projectId: 'proj-2',
    number: 1,
    description: 'Primary Multi-Cloud Rollout Strategy',
    projectStart: '2026-06-01',
    createdAt: new Date('2026-05-24T09:00:00Z').toISOString(),
    isBaseline: true
  }
];

const DEFAULT_USERS: CustomUser[] = [
  { id: 'user-1', username: 'Alice Green', jobTitle: 'Principal Planner & PM', employeeCode: 'EMP-111' },
  { id: 'user-2', username: 'Bob Peterson', jobTitle: 'Structural Subcontractor', employeeCode: 'EMP-112' },
  { id: 'user-3', username: 'Carlos Santana', jobTitle: 'Lead SRE Architect', employeeCode: 'EMP-113' },
  { id: 'user-4', username: 'Diana Prince', jobTitle: 'QA Compliance Officer', employeeCode: 'EMP-114' },
  { id: 'user-5', username: 'Evan Wright', jobTitle: 'Legal Assessor', employeeCode: 'EMP-115' }
];

const DEFAULT_TASK_ROLES: TaskRole[] = [
  { id: 'tr-1', revisionId: 'rev-1', taskId: 'act-blueprints', userId: 'user-1', role: 'project manager' },
  { id: 'tr-2', revisionId: 'rev-1', taskId: 'act-structural', userId: 'user-2', role: 'executor' },
  { id: 'tr-3', revisionId: 'rev-1', taskId: 'act-permits', userId: 'user-1', role: 'reviewer' },
  { id: 'tr-4', revisionId: 'rev-2', taskId: 'sw-figma', userId: 'user-1', role: 'owner' },
  { id: 'tr-5', revisionId: 'rev-2', taskId: 'sw-backend-api', userId: 'user-3', role: 'executor' },
  { id: 'tr-6', revisionId: 'rev-2', taskId: 'sw-frontend-ui', userId: 'user-3', role: 'project manager' },
  { id: 'tr-7', revisionId: 'rev-2', taskId: 'sw-qa-test', userId: 'user-4', role: 'reviewer' },
];

export default function App() {
  // 1. Primary States
  const [currentView, setCurrentView] = useState<'hub' | 'workspace'>('hub');

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('nexus_projects');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('nexus_projects', JSON.stringify(DEFAULT_PROJECTS));
    return DEFAULT_PROJECTS;
  });

  const [revisions, setRevisions] = useState<Revision[]>(() => {
    const saved = localStorage.getItem('nexus_revisions');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('nexus_revisions', JSON.stringify(DEFAULT_REVISIONS));
    return DEFAULT_REVISIONS;
  });

  const [users, setUsers] = useState<CustomUser[]>(() => {
    const saved = localStorage.getItem('nexus_users');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('nexus_users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  });

  useEffect(() => {
    // Fetch data from backend API
    fetch('/api/projects')
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) setProjects(data);
        })
        .catch(err => console.error('Failed to fetch projects from backend:', err));

    fetch('/api/users')
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) setUsers(data);
        })
        .catch(err => console.error('Failed to fetch users from backend:', err));
  }, []);

  const [taskRoles, setTaskRoles] = useState<TaskRole[]>(() => {
    const saved = localStorage.getItem('nexus_task_roles');
    if (saved) return JSON.parse(saved);
    localStorage.setItem('nexus_task_roles', JSON.stringify(DEFAULT_TASK_ROLES));
    return DEFAULT_TASK_ROLES;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('nexus_chat_messages');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = localStorage.getItem('nexus_active_project_id');
    return saved || 'proj-1';
  });

  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(() => {
    const saved = localStorage.getItem('nexus_active_revision_id');
    return saved || 'rev-1';
  });

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

  // Check if we are rendering in standalone chat view
  if (typeof window !== 'undefined') {
    const urlParams = new URL(window.location.href).searchParams;
    const chatTaskId = urlParams.get('chat');

    if (chatTaskId) {
      const activeTask = nodes.find(n => n.id === chatTaskId) || JSON.parse(localStorage.getItem(`nexus_nodes_${activeRevisionId}`) || '[]').find((n:any) => n.id === chatTaskId);

      const taskMessages = chatMessages.filter(m => m.taskId === chatTaskId).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return (
          <div className="h-screen w-full bg-[#0a0f1d] text-slate-200 flex flex-col font-sans">
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
                id: `msg-${Date.now()}`,
                taskId: chatTaskId,
                userId: chatUserId,
                text: chatInput.trim(),
                timestamp: new Date().toISOString()
              };
              const updated = [...chatMessages, newMessage];
              setChatMessages(updated);
              localStorage.setItem('nexus_chat_messages', JSON.stringify(updated));

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
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [ganttFilter, setGanttFilter] = useState<'both' | 'wbs' | 'activity'>('both');
  const [wbsTableWidth, setWbsTableWidth] = useState<number>(550);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.max(320, Math.min(window.innerWidth - 320, moveEvent.clientX));
      setWbsTableWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 2. Browser Scroll Sync Refs
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement | null>(null);

  // Helper: append calculated CPM variables onto activity nodes
  const updateCpmResults = (currentNodes: ProjectNode[], currentDeps: Dependency[]): ProjectNode[] => {
    const cpm = calculateCriticalPath(currentNodes, currentDeps);
    return currentNodes.map(node => {
      if (node.type === 'activity') {
        const data = cpm[node.id];
        return {
          ...node,
          isCritical: data ? data.isCritical : false,
          totalFloat: data ? data.totalFloat : 0,
          cpmData: data || null
        } as any;
      }
      return node;
    });
  };

  // Bootstrap initial schedules in localStorage on mount
  useEffect(() => {
    if (!localStorage.getItem('nexus_nodes_rev-1')) {
      localStorage.setItem('nexus_nodes_rev-1', JSON.stringify(TEMPLATES.construction.nodes));
      localStorage.setItem('nexus_dependencies_rev-1', JSON.stringify(TEMPLATES.construction.dependencies));
    }
    if (!localStorage.getItem('nexus_nodes_rev-2')) {
      localStorage.setItem('nexus_nodes_rev-2', JSON.stringify(TEMPLATES.software.nodes));
      localStorage.setItem('nexus_dependencies_rev-2', JSON.stringify(TEMPLATES.software.dependencies));
    }
  }, []);

  // Sync state when revision ID changes
  useEffect(() => {
    if (!activeRevisionId) {
      setNodes([]);
      setDependencies([]);
      return;
    }

    const savedNodesStr = localStorage.getItem(`nexus_nodes_${activeRevisionId}`);
    const savedDepsStr = localStorage.getItem(`nexus_dependencies_${activeRevisionId}`);

    let activeNodes: ProjectNode[] = [];
    let activeDeps: Dependency[] = [];

    if (savedNodesStr && savedDepsStr) {
      try {
        activeNodes = JSON.parse(savedNodesStr);
        activeDeps = JSON.parse(savedDepsStr);
      } catch (_) {
        activeNodes = TEMPLATES.construction.nodes;
        activeDeps = TEMPLATES.construction.dependencies;
      }
    } else {
      const revObj = revisions.find(r => r.id === activeRevisionId);
      if (revObj?.projectId === 'proj-2') {
        activeNodes = TEMPLATES.software.nodes;
        activeDeps = TEMPLATES.software.dependencies;
      } else {
        activeNodes = TEMPLATES.construction.nodes;
        activeDeps = TEMPLATES.construction.dependencies;
      }
      localStorage.setItem(`nexus_nodes_${activeRevisionId}`, JSON.stringify(activeNodes));
      localStorage.setItem(`nexus_dependencies_${activeRevisionId}`, JSON.stringify(activeDeps));
    }

    const rolled = performWbsRollups(activeNodes);
    const cpmMapped = updateCpmResults(rolled, activeDeps);

    setNodes(cpmMapped);
    setDependencies(activeDeps);

    const root = cpmMapped.find(n => n.parentId === null);
    setSelectedNodeId(root ? root.id : cpmMapped[0]?.id || null);
  }, [activeRevisionId]);

  // Persist nodes & dependencies on state changes
  useEffect(() => {
    if (activeRevisionId && nodes.length > 0) {
      localStorage.setItem(`nexus_nodes_${activeRevisionId}`, JSON.stringify(nodes));
    }
  }, [nodes, activeRevisionId]);

  useEffect(() => {
    if (activeRevisionId && dependencies.length > 0) {
      localStorage.setItem(`nexus_dependencies_${activeRevisionId}`, JSON.stringify(dependencies));
    }
  }, [dependencies, activeRevisionId]);

  // Relational operations definitions
  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    localStorage.setItem('nexus_active_project_id', id);
    const projRevs = revisions.filter(r => r.projectId === id);
    if (projRevs.length > 0) {
      const sorted = projRevs.sort((a,b) => a.number - b.number);
      setActiveRevisionId(sorted[0].id);
      localStorage.setItem('nexus_active_revision_id', sorted[0].id);
    } else {
      setActiveRevisionId(null);
    }
  };

  const handleSelectRevision = (id: string) => {
    setActiveRevisionId(id);
    localStorage.setItem('nexus_active_revision_id', id);
  };

  const handleAddProject = (name: string, description: string) => {
    const newProjId = `proj-${Date.now()}`;
    const newProj: Project = {
      id: newProjId,
      name,
      description,
      createdAt: new Date().toISOString()
    };

    const newRevId = `rev-${Date.now()}`;
    const newRev: Revision = {
      id: newRevId,
      projectId: newProjId,
      number: 1,
      description: 'Initial provisioned baseline schedule',
      projectStart: '2026-06-01',
      createdAt: new Date().toISOString(),
      isBaseline: true
    };

    const updatedProjects = [...projects, newProj];
    const updatedRevisions = [...revisions, newRev];

    setProjects(updatedProjects);
    setRevisions(updatedRevisions);

    localStorage.setItem('nexus_projects', JSON.stringify(updatedProjects));
    localStorage.setItem('nexus_revisions', JSON.stringify(updatedRevisions));

    // Seed empty nodes list + WBS root for custom projects
    const initialNodes: ProjectNode[] = [
      {
        id: `node-${Date.now()}-root`,
        code: '1',
        name: `${name} Root WBS`,
        parentId: null,
        type: 'wbs',
        isExpanded: true,
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        duration: 1,
        progress: 0
      }
    ];
    localStorage.setItem(`nexus_nodes_${newRevId}`, JSON.stringify(initialNodes));
    localStorage.setItem(`nexus_dependencies_${newRevId}`, JSON.stringify([]));

    setActiveProjectId(newProjId);
    setActiveRevisionId(newRevId);
    localStorage.setItem('nexus_active_project_id', newProjId);
    localStorage.setItem('nexus_active_revision_id', newRevId);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem('nexus_projects', JSON.stringify(updated));

    const revsToRemove = revisions.filter(r => r.projectId === id);
    const remainingRevs = revisions.filter(r => r.projectId !== id);
    setRevisions(remainingRevs);
    localStorage.setItem('nexus_revisions', JSON.stringify(remainingRevs));

    revsToRemove.forEach(r => {
      localStorage.removeItem(`nexus_nodes_${r.id}`);
      localStorage.removeItem(`nexus_dependencies_${r.id}`);
    });

    if (activeProjectId === id) {
      const nextActiveId = updated[0]?.id || null;
      setActiveProjectId(nextActiveId);
      localStorage.setItem('nexus_active_project_id', nextActiveId || '');
      if (nextActiveId) {
        const nextRevs = remainingRevs.filter(r => r.projectId === nextActiveId);
        setActiveRevisionId(nextRevs[0]?.id || null);
        localStorage.setItem('nexus_active_revision_id', nextRevs[0]?.id || '');
      } else {
        setActiveRevisionId(null);
        localStorage.setItem('nexus_active_revision_id', '');
      }
    }
  };

  const handleAddRevision = (projectId: string, description: string, projectStart: string) => {
    const projRevs = revisions.filter(r => r.projectId === projectId);
    const maxNum = projRevs.reduce((max, r) => Math.max(max, r.number), 0);

    const newRevId = `rev-${Date.now()}`;
    const newRev: Revision = {
      id: newRevId,
      projectId,
      number: maxNum + 1,
      description,
      projectStart,
      createdAt: new Date().toISOString(),
      isBaseline: false
    };

    const updated = [...revisions, newRev];
    setRevisions(updated);
    localStorage.setItem('nexus_revisions', JSON.stringify(updated));

    // Clone from standard structures
    const prevRev = projRevs.sort((a,b) => b.number - a.number)[0];
    let nodesToClone: ProjectNode[] = [];
    let depsToClone: Dependency[] = [];

    if (prevRev) {
      const savedNodes = localStorage.getItem(`nexus_nodes_${prevRev.id}`);
      const savedDeps = localStorage.getItem(`nexus_dependencies_${prevRev.id}`);
      if (savedNodes && savedDeps) {
        try {
          nodesToClone = JSON.parse(savedNodes);
          depsToClone = JSON.parse(savedDeps);
        } catch (_) {}
      }
    }
    if (nodesToClone.length === 0) {
      nodesToClone = [
        {
          id: `node-${Date.now()}-root`,
          code: '1',
          name: `Revision Root`,
          parentId: null,
          type: 'wbs',
          isExpanded: true,
          startDate: projectStart,
          endDate: projectStart,
          duration: 1,
          progress: 0
        }
      ];
    }

    localStorage.setItem(`nexus_nodes_${newRevId}`, JSON.stringify(nodesToClone));
    localStorage.setItem(`nexus_dependencies_${newRevId}`, JSON.stringify(depsToClone));

    setActiveRevisionId(newRevId);
    localStorage.setItem('nexus_active_revision_id', newRevId);
  };

  const handleDuplicateRevision = (revisionId: string, description: string) => {
    const sourceRev = revisions.find(r => r.id === revisionId);
    if (!sourceRev) return;

    const projRevs = revisions.filter(r => r.projectId === sourceRev.projectId);
    const maxNum = projRevs.reduce((max, r) => Math.max(max, r.number), 0);

    const newRevId = `rev-${Date.now()}`;
    const newRev: Revision = {
      id: newRevId,
      projectId: sourceRev.projectId,
      number: maxNum + 1,
      description: description || `Clone of Rev ${sourceRev.number}`,
      projectStart: sourceRev.projectStart,
      createdAt: new Date().toISOString(),
      isBaseline: false
    };

    const updatedRevs = [...revisions, newRev];
    setRevisions(updatedRevs);
    localStorage.setItem('nexus_revisions', JSON.stringify(updatedRevs));

    const srcNodes = localStorage.getItem(`nexus_nodes_${revisionId}`) || JSON.stringify(nodes);
    const srcDeps = localStorage.getItem(`nexus_dependencies_${revisionId}`) || JSON.stringify(dependencies);

    localStorage.setItem(`nexus_nodes_${newRevId}`, srcNodes);
    localStorage.setItem(`nexus_dependencies_${newRevId}`, srcDeps);

    const revRoles = taskRoles.filter(tr => tr.revisionId === revisionId);
    const duplicatedRoles = revRoles.map(tr => ({
      ...tr,
      id: `tr-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      revisionId: newRevId
    }));
    const updatedRoles = [...taskRoles, ...duplicatedRoles];
    setTaskRoles(updatedRoles);
    localStorage.setItem('nexus_task_roles', JSON.stringify(updatedRoles));

    setActiveRevisionId(newRevId);
    localStorage.setItem('nexus_active_revision_id', newRevId);
  };

  const handleDeleteRevision = (id: string) => {
    const projRevs = revisions.filter(r => r.projectId === activeProjectId);
    if (projRevs.length <= 1) {
      alert('Each project requires at least one tracking revision in database.');
      return;
    }

    const remaining = revisions.filter(r => r.id !== id);
    setRevisions(remaining);
    localStorage.setItem('nexus_revisions', JSON.stringify(remaining));

    localStorage.removeItem(`nexus_nodes_${id}`);
    localStorage.removeItem(`nexus_dependencies_${id}`);

    const remainingRoles = taskRoles.filter(tr => tr.revisionId !== id);
    setTaskRoles(remainingRoles);
    localStorage.setItem('nexus_task_roles', JSON.stringify(remainingRoles));

    if (activeRevisionId === id) {
      const projectRemainingRevs = remaining.filter(r => r.projectId === activeProjectId);
      const nextRevId = projectRemainingRevs[0]?.id || null;
      setActiveRevisionId(nextRevId);
      localStorage.setItem('nexus_active_revision_id', nextRevId || '');
    }
  };

  const handleAddUser = (username: string, jobTitle: string, employeeCode: string) => {
    const newUser: CustomUser = {
      id: `user-${Date.now()}`,
      username,
      jobTitle,
      employeeCode
    };
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem('nexus_users', JSON.stringify(updated));
  };

  const handleDeleteUser = (id: string) => {
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem('nexus_users', JSON.stringify(updated));

    const updatedRoles = taskRoles.filter(tr => tr.userId !== id);
    setTaskRoles(updatedRoles);
    localStorage.setItem('nexus_task_roles', JSON.stringify(updatedRoles));
  };

  const handleAddTaskRole = (taskId: string, userId: string, role: 'owner' | 'reviewer' | 'executor' | 'project manager') => {
    if (!activeRevisionId) return;
    const filtered = taskRoles.filter(tr => !(tr.revisionId === activeRevisionId && tr.taskId === taskId && tr.role === role));

    const newRole: TaskRole = {
      id: `tr-${Date.now()}`,
      revisionId: activeRevisionId,
      taskId,
      userId,
      role
    };

    const updated = [...filtered, newRole];
    setTaskRoles(updated);
    localStorage.setItem('nexus_task_roles', JSON.stringify(updated));
  };

  const handleDeleteTaskRole = (roleId: string) => {
    const updated = taskRoles.filter(tr => tr.id !== roleId);
    setTaskRoles(updated);
    localStorage.setItem('nexus_task_roles', JSON.stringify(updated));
  };

  const handleAddChatMessage = (taskId: string, userId: string, text: string) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      taskId,
      userId,
      text,
      timestamp: new Date().toISOString()
    };
    const updated = [...chatMessages, newMessage];
    setChatMessages(updated);
    localStorage.setItem('nexus_chat_messages', JSON.stringify(updated));
  };

  // Counting nodes dynamically per revision
  const nodesCountByRevision = useMemo(() => {
    const counts: Record<string, number> = {};
    revisions.forEach(rev => {
      const saved = localStorage.getItem(`nexus_nodes_${rev.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          counts[rev.id] = Array.isArray(parsed) ? parsed.length : 0;
        } catch (_) {
          counts[rev.id] = 0;
        }
      } else {
        counts[rev.id] = rev.projectId === 'proj-2' ? TEMPLATES.software.nodes.length : TEMPLATES.construction.nodes.length;
      }
    });
    return counts;
  }, [revisions, nodes]);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const activeRevision = revisions.find(r => r.id === activeRevisionId) || null;


  // 4. Calculate Flattened Hierarchy List for linear display
  const flattenedNodes = useMemo(() => {
    const list = getFlattenedHierarchyList(nodes, null, 0);
    if (ganttFilter === 'wbs') {
      return list.filter(item => item.node.type === 'wbs');
    }
    if (ganttFilter === 'activity') {
      return list.filter(item => item.node.type === 'activity');
    }
    return list;
  }, [nodes, ganttFilter]);

  // Synchronized scroll bindings
  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (ganttContainerRef.current) {
      ganttContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // 5. Node updates (inline & sidebar edits)
  const handleUpdateNode = (id: string, updatedFields: Partial<ProjectNode>) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, ...updatedFields } as any : n);
      // Recalc rollup summaries
      let solved = performWbsRollups(next);
      if (autoSchedule) {
        solved = rescheduleProject(solved, dependencies);
      }
      return updateCpmResults(solved, dependencies);
    });
  };

  // Specialty parsing of predecessors input cell
  const handleUpdatePredecessors = (activityId: string, codesString: string) => {
    const codes = codesString.split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

    // Filter out previous dependencies targeting this activity
    let nextDeps = dependencies.filter(d => d.toId !== activityId);

    // Map entered codes back to activity database IDs
    codes.forEach((code, index) => {
      const predNode = nodes.find(n => n.code.toUpperCase() === code && n.type === 'activity');
      if (predNode && predNode.id !== activityId) {
        nextDeps.push({
          id: `dep-${Date.now()}-${index}-${Math.floor(Math.random() * 100)}`,
          fromId: predNode.id,
          toId: activityId,
          type: 'FS',
          lag: 0
        });
      }
    });

    setDependencies(nextDeps);

    setNodes(prev => {
      let solved = prev;
      if (autoSchedule) {
        solved = rescheduleProject(prev, nextDeps);
      } else {
        solved = performWbsRollups(prev);
      }
      return updateCpmResults(solved, nextDeps);
    });
  };

  // Manual Primavera schedule solver F9 trigger
  const handleRunF9Scheduler = () => {
    setNodes(prev => {
      const solved = rescheduleProject(prev, dependencies);
      return updateCpmResults(solved, dependencies);
    });
  };

  // 6. Action items: WBS & Activity Node Creation
  const handleAddWbs = () => {
    let parentId: string | null = null;
    let codePrefix = '1';

    if (selectedNodeId) {
      const selected = nodes.find(n => n.id === selectedNodeId);
      if (selected) {
        if (selected.type === 'wbs') {
          parentId = selected.id;
          codePrefix = `${selected.code}`;
        } else {
          parentId = selected.parentId;
          const parentWbs = nodes.find(n => n.id === selected.parentId);
          if (parentWbs) codePrefix = `${parentWbs.code}`;
        }
      }
    }

    const sameParentCount = nodes.filter(n => n.parentId === parentId && n.type === 'wbs').length;
    const newCode = parentId ? `${codePrefix}.${sameParentCount + 1}` : `${sameParentCount + 1}`;
    const newId = `wbs-${Date.now()}`;

    const newWbs: ProjectNode = {
      id: newId,
      code: newCode,
      name: 'New Phase Summary Segment',
      parentId,
      type: 'wbs',
      isExpanded: true,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      duration: 5,
      progress: 0,
    };

    setNodes(prev => {
      const next = [...prev, newWbs];
      return performWbsRollups(next);
    });
    setSelectedNodeId(newId);
    setIsInspectorOpen(true);
  };

  const handleAddActivity = (targetParentId?: string) => {
    // Activities MUST belong to a parent WBS.
    let parentId: string | null = (targetParentId && typeof targetParentId === 'string') ? targetParentId : null;

    if (!parentId && selectedNodeId) {
      const selected = nodes.find(n => n.id === selectedNodeId);
      if (selected) {
        if (selected.type === 'wbs') {
          parentId = selected.id;
        } else {
          parentId = selected.parentId;
        }
      }
    }

    // Fallback: If no selected nodes or WBS exist, capture the first available WBS parent.
    if (!parentId) {
      const firstWbs = nodes.find(n => n.type === 'wbs');
      if (firstWbs) {
        parentId = firstWbs.id;
      } else {
        // Edge fallback: Auto bootstrap a default project root WBS so nodes are insertable.
        const rId = 'wbs-auto-bootstrap';
        const rootWbs: ProjectNode = {
          id: rId,
          code: '1',
          name: 'Apex Main Schedule',
          parentId: null,
          type: 'wbs',
          isExpanded: true,
          startDate: '2026-06-01',
          endDate: '2026-06-15',
          duration: 10,
          progress: 0
        };
        parentId = rId;
        setNodes(p => [rootWbs]);
      }
    }

    const newId = `act-${Date.now()}`;
    const randCodeNum = Math.floor(1000 + Math.random() * 9000);
    const newAct: ProjectNode = {
      id: newId,
      code: `A${randCodeNum}`,
      name: 'New Subcontractor Task Row',
      parentId: parentId!,
      type: 'activity',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      duration: 5,
      progress: 0,
      resources: ['Resource Assignee'],
      constraintType: 'ASAP',
      notes: ''
    };

    setNodes(prev => {
      const next = [...prev, newAct];
      const rolled = performWbsRollups(next);
      return updateCpmResults(rolled, dependencies);
    });
    setSelectedNodeId(newId);
    setIsInspectorOpen(true);
  };

  const handleDeleteSelected = () => {
    if (!selectedNodeId) return;
    handleDeleteNode(selectedNodeId);
  };

  const handleDeleteNode = (id: string) => {
    // Delete target node, and all nested kids recursively (in case it is a WBS)
    const getChildrenRecursiveIds = (nodeId: string): string[] => {
      const kids = nodes.filter(n => n.parentId === nodeId);
      let list = kids.map(k => k.id);
      kids.forEach(k => {
        list = [...list, ...getChildrenRecursiveIds(k.id)];
      });
      return list;
    };

    const idsToDelete = [id, ...getChildrenRecursiveIds(id)];

    const remainingNodes = nodes.filter(n => !idsToDelete.includes(n.id));
    const remainingDeps = dependencies.filter(
        d => !idsToDelete.includes(d.fromId) && !idsToDelete.includes(d.toId)
    );

    setDependencies(remainingDeps);
    setNodes(prev => {
      let solved = performWbsRollups(remainingNodes);
      if (autoSchedule) {
        solved = rescheduleProject(solved, remainingDeps);
      }
      return updateCpmResults(solved, remainingDeps);
    });

    if (selectedNodeId && idsToDelete.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  // Node WBS expansion collapse toggles
  const handleToggleExpand = (id: string) => {
    setNodes(prev =>
        prev.map(n => n.id === id && n.type === 'wbs'
            ? { ...n, isExpanded: !n.isExpanded }
            : n
        )
    );
  };

  // Add dependency link manually inside inspector
  const handleAddDependency = (fromId: string, toId: string) => {
    // Simple cycle prevention check
    if (fromId === toId) return;

    // Direct duplicates blocker
    const isDup = dependencies.some(d => d.fromId === fromId && d.toId === toId);
    if (isDup) return;

    const newDep: Dependency = {
      id: `dep-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      fromId,
      toId,
      type: 'FS',
      lag: 0,
    };

    const nextDeps = [...dependencies, newDep];
    setDependencies(nextDeps);

    setNodes(prev => {
      let solved = prev;
      if (autoSchedule) {
        solved = rescheduleProject(prev, nextDeps);
      }
      return updateCpmResults(solved, nextDeps);
    });
  };

  const handleDeleteDependency = (depId: string) => {
    const nextDeps = dependencies.filter(d => d.id !== depId);
    setDependencies(nextDeps);
    setNodes(prev => {
      let solved = prev;
      if (autoSchedule) {
        solved = rescheduleProject(prev, nextDeps);
      }
      return updateCpmResults(solved, nextDeps);
    });
  };

  // 7. Interactive Backups File Export & Imports
  const handleExportCsv = () => {
    // Create CSV columns
    const headers = [
      'Type',
      'Code',
      'Name',
      'Start Date',
      'Finish Date',
      'Duration (Days)',
      'Progress',
      'Resources',
      'Predecessors',
      'Notes'
    ];

    const getPredecessorsCsvString = (nodeId: string): string => {
      const preds = dependencies.filter(d => d.toId === nodeId);
      return preds.map(p => {
        const predNode = nodes.find(n => n.id === p.fromId);
        return predNode ? predNode.code : '';
      }).filter(Boolean).join('; '); // Semicolon avoids breaking CSV comma structures
    };

    const rows = flattenedNodes.map(({ node }) => {
      const isAct = node.type === 'activity';
      const r = isAct ? (node as ActivityNode) : null;

      const values = [
        node.type.toUpperCase(),
        `"${node.code}"`,
        `"${node.name.replace(/"/g, '""')}"`,
        node.startDate,
        node.endDate,
        node.duration,
        `${node.progress}%`,
        isAct ? `"${r?.resources?.join('; ') || ''}"` : '""',
        isAct ? `"${getPredecessorsCsvString(node.id)}"` : '""',
        `"${(isAct ? r?.notes : (node as any).notes || '')?.replace(/"/g, '""')}"`
      ];
      return values.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nexus_Schedule_${(activeProject?.name || 'Project').replace(/\s+/g, '_')}_Rev_${activeRevision?.number || 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLaunchToBackend = () => {
    setIsLaunching(true);

    // Simulate backend network latency and processing
    setTimeout(() => {
      // Run the network calculation
      if (nodes.length > 0) {
        try {
          const calculatedNodes = rescheduleProject(nodes, dependencies);
          setNodes(calculatedNodes);
        } catch (e) {
          console.error('Calculation failed', e);
        }
      }
      setIsLaunching(false);
      setIsEditMode(false); // Drop back to view mode after processing
    }, 1500);
  };

  const handleExportJson = () => {
    const backupObj = {
      projectName: activeProject?.name,
      revisionNumber: activeRevision?.number || 1,
      nodes,
      dependencies,
      zoomLevel,
      showCriticalPath,
      autoSchedule,
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nexus_Backup_${(activeProject?.name || 'project').replace(/\s+/g, '_')}_Rev_${activeRevision?.number || 1}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.nodes)) {
          setNodes(updateCpmResults(parsed.nodes, parsed.dependencies || []));
          setDependencies(parsed.dependencies || []);
          if (parsed.zoomLevel) setZoomLevel(parsed.zoomLevel);
          if (parsed.showCriticalPath !== undefined) setShowCriticalPath(parsed.showCriticalPath);
          if (parsed.autoSchedule !== undefined) setAutoSchedule(parsed.autoSchedule);

          const root = parsed.nodes.find((n: any) => n.parentId === null);
          setSelectedNodeId(root ? root.id : parsed.nodes[0]?.id || null);
          setIsInspectorOpen(true);
        } else {
          alert('Invalid schedule format! Make sure the JSON contains a list of nodes.');
        }
      } catch (err) {
        alert('Failed to parse file! JSON is corrupted.');
      }
    };
    reader.readAsText(file);
  };

  const handlePrint = () => {
    window.print();
  };

  // Selected item retrieval
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
      <div className="flex flex-col h-screen bg-[#0a0f1d] text-slate-200 overflow-hidden font-sans relative">
        {/* Background glowing ambient circles */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/15 blur-[150px] rounded-full pointer-events-none z-0"></div>

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
                onDuplicateRevision={handleDuplicateRevision}
                onDeleteRevision={handleDeleteRevision}
                users={users}
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
                onEnterWorkspace={() => setCurrentView('workspace')}
                nodesCountByRevision={nodesCountByRevision}
            />
        ) : (
            <>
              {/* 1. Header Toolbar Component */}
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
                  onRunF9Scheduler={handleRunF9Scheduler}
                  nodes={nodes}
                  dependencies={dependencies}
                  selectedNodeId={selectedNodeId}
                  onAddWbs={handleAddWbs}
                  onAddActivity={handleAddActivity}
                  onDeleteSelected={handleDeleteSelected}
                  onExportCsv={handleExportCsv}
                  onExportJson={handleExportJson}
                  onImportJson={handleImportJson}
                  onPrint={handlePrint}
                  ganttFilter={ganttFilter}
                  onSelectGanttFilter={setGanttFilter}
                  isEditMode={isEditMode}
                  onToggleEditMode={() => setIsEditMode(!isEditMode)}
                  onLaunchToBackend={handleLaunchToBackend}
              />

              {/* 2. Main Workspace (Side-by-side Table & Gantt Timeline Grid + Slide-out Details Inspector) */}
              <div className="flex-1 flex overflow-hidden relative print:block z-10">
                {isLaunching && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-auto">
                      <div className="flex items-center gap-3 bg-indigo-500 text-white font-semibold font-mono tracking-wide shadow-[0_0_20px_rgba(99,102,241,0.5)] px-6 py-4 rounded-xl border border-indigo-400">
                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Processing Project Revisions via Backend Server...
                      </div>
                    </div>
                )}

                {/* Core Schedule Canvas Split wrapper */}
                <div className="flex-1 flex overflow-hidden min-w-0 print:block">

                  {/* Left Spreadsheet Tree Table Pane */}
                  <div
                      style={{ width: `${wbsTableWidth}px` }}
                      className="min-w-[320px] shrink-0 flex flex-col overflow-hidden border-r border-white/10 print:hidden bg-white/[0.03] backdrop-blur-xl"
                  >
                    {/* WbsTable Pane Header Spacer Component to align exactly with Gantt */}
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
                        isEditMode={isEditMode}
                    />
                  </div>

                  {/* Resizable Divider Drag Handle */}
                  <div
                      onMouseDown={handleDividerMouseDown}
                      className="w-1.5 hover:w-2 bg-white/5 hover:bg-cyan-500 cursor-col-resize shrink-0 transition-all duration-150 h-full select-none z-30 flex items-center justify-center group"
                      title="Drag to resize Gantt columns"
                  >
                    <div className="h-10 w-1 bg-white/20 group-hover:bg-white/70 rounded-full pointer-events-none transition-colors" />
                  </div>

                  {/* Right Gantt Visual Timeline Viewport Pane */}
                  <div className="flex-1 flex flex-col overflow-hidden print:w-full print:overflow-visible bg-white/[0.01]">
                    <div className="bg-white/5 border-b border-white/10 h-11 px-4 flex items-center justify-between shrink-0 select-none print:hidden">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <CodeSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Standard Interactive Gantt Canvas</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded border border-white/10 flex items-center gap-1.5 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-cyan-455 bg-cyan-400 animate-pulse" />
                        <span>Zoom Scale: <strong className="text-cyan-300 capitalize">{zoomLevel}s</strong></span>
                      </div>
                    </div>

                    <GanttChart
                        flattenedNodes={flattenedNodes}
                        dependencies={dependencies}
                        zoomLevel={zoomLevel}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={(id) => {
                          setSelectedNodeId(id);
                          setIsInspectorOpen(true);
                        }}
                        showCriticalPath={showCriticalPath}
                        onGanttScroll={handleGanttScroll}
                        ganttContainerRef={ganttContainerRef}
                        isEditMode={isEditMode}
                    />
                  </div>
                </div>

                {/* 3. Sliding properties inspector split pane on desktop */}
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
                          isEditMode={isEditMode}
                          chatMessages={chatMessages}
                          onAddChatMessage={handleAddChatMessage}
                          onOpenChat={() => setIsChatOpen(true)}
                      />
                    </aside>
                )}

              </div>

              {/* 4. Bottom status footer bar */}
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
              {!isEditMode && isChatOpen && selectedNode && selectedNode.type !== 'wbs' && (
                  <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[150] flex items-center justify-center p-0 md:p-6 overflow-hidden">
                    <div className="bg-slate-900 border border-white/10 shadow-3xl w-full h-full md:rounded-xl flex flex-col overflow-hidden max-w-5xl">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/5">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-cyan-400 animate-pulse" />
                          <div>
                            <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-200">
                              Task Collaboration Chat
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Selected: <span className="text-cyan-400">{selectedNode.name}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                              onClick={() => {
                                window.open(`/?chat=${selectedNode.id}`, 'ChatWindow', 'width=450,height=600');
                                setIsChatOpen(false);
                              }}
                              className="text-slate-400 hover:text-cyan-400 p-1.5 hover:bg-white/5 rounded transition-colors"
                              title="Open in new window"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                              onClick={() => setIsChatOpen(false)}
                              className="text-slate-400 hover:text-white p-1.5 hover:bg-white/5 rounded transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Message Log scrollable section */}
                      <div className="flex-1 overflow-y-auto w-full flex justify-center scrollbar-thin scrollbar-thumb-white/10 p-6">
                        <div className="w-full max-w-4xl space-y-4">
                          {(() => {
                            const nodeMessages = chatMessages.filter(m => m.taskId === selectedNode.id).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                            if (nodeMessages.length === 0) {
                              return (
                                  <div className="text-xs italic text-slate-500 text-center py-12 bg-black/20 rounded-xl border border-white/5 mx-auto max-w-md my-12">
                                    No chat messages for this task yet. Start the conversation!
                                  </div>
                              );
                            }
                            return nodeMessages.map(msg => {
                              const sender = users.find(u => u.id === msg.userId);
                              return (
                                  <div key={msg.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 shadow-sm hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                                {sender?.username || 'Unknown User'}
                                <span className="text-[10px] font-mono text-slate-500 font-normal py-0.5 px-2 bg-white/5 rounded">
                                 {sender?.jobTitle || 'N/A'}
                                </span>
                              </span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-relaxed font-sans break-words bg-white/[0.01] p-3 rounded-lg inline-block w-full">
                                      {msg.text}
                                    </p>
                                  </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Send Chat input form */}
                      <div className="bg-slate-800/60 border-t border-white/10 shrink-0 w-full flex justify-center p-4 sm:p-6 pb-6 shadow-2xl">
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatInputForModal.trim() || !chatUserIdForModal) return;
                          handleAddChatMessage(selectedNode.id, chatUserIdForModal, chatInputForModal.trim());
                          setChatInputForModal('');
                        }} className="w-full max-w-4xl space-y-4">
                          <div className="flex items-center gap-3">
                            <select
                                value={chatUserIdForModal}
                                onChange={e => setChatUserIdForModal(e.target.value)}
                                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 shrink-0 basis-1/3 sm:basis-1/4"
                            >
                              <option value="">Post as...</option>
                              {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.username}</option>
                              ))}
                            </select>
                            <input
                                type="text"
                                value={chatInputForModal}
                                onChange={e => setChatInputForModal(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 min-w-0"
                            />
                            <button
                                type="submit"
                                disabled={!chatInputForModal.trim() || !chatUserIdForModal}
                                className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-lg font-mono text-xs transition-colors shrink-0 flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Send</span>
                            </button>
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
