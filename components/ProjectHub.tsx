/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FolderOpen, 
  Users, 
  Layers, 
  Plus, 
  Trash2, 
  PlayCircle, 
  Calendar, 
  ChevronRight, 
  Sparkles,
  Database,
  Building,
  UserCheck,
  FileText,
  Copy
} from 'lucide-react';
import { Project, Revision, CustomUser } from '../types/types';

interface ProjectHubProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string, description: string) => void;
  onDeleteProject: (id: string) => void;
  
  revisions: Revision[];
  activeRevisionId: string | null;
  onSelectRevision: (id: string) => void;
  onAddRevision: (projectId: string, description: string, projectStart: string) => void;
  onDuplicateRevision: (revisionId: string, description: string) => void;
  onDeleteRevision: (id: string) => void;
  
  users: CustomUser[];
  onAddUser: (username: string, jobTitle: string, employeeCode: string) => void;
  onDeleteUser: (id: string) => void;
  
  onEnterWorkspace: () => void;
  nodesCountByRevision: Record<string, number>;
}

export default function ProjectHub({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  
  revisions,
  activeRevisionId,
  onSelectRevision,
  onAddRevision,
  onDuplicateRevision,
  onDeleteRevision,
  
  users,
  onAddUser,
  onDeleteUser,
  
  onEnterWorkspace,
  nodesCountByRevision,
}: ProjectHubProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'team'>('projects');
  
  // States for new project form
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  // States for new revision form
  const [newRevDesc, setNewRevDesc] = useState('');
  const [newRevStart, setNewRevStart] = useState('2026-06-01');

  // States for duplicate revision description
  const [duplicateModeId, setDuplicateModeId] = useState<string | null>(null);
  const [dupDesc, setDupDesc] = useState('Safety & Overtime Acceleration Run');

  // States for new user form
  const [newUsername, setNewUsername] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newEmployeeCode, setNewEmployeeCode] = useState('');

  const selectedProject = projects.find(p => p.id === activeProjectId);
  const selectedProjectRevisions = revisions.filter(r => r.projectId === activeProjectId);
  const selectedRevision = revisions.find(r => r.id === activeRevisionId);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    onAddProject(newProjName.trim(), newProjDesc.trim());
    setNewProjName('');
    setNewProjDesc('');
  };

  const handleCreateRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    onAddRevision(activeProjectId, newRevDesc.trim() || 'Custom Schedule Adjustment', newRevStart);
    setNewRevDesc('');
  };

  const handleDuplicateClick = (revId: string, currentNum: number) => {
    setDuplicateModeId(revId);
    setDupDesc(`Replanned revision cloned from Rev ${currentNum}`);
  };

  const handleConfirmDuplicate = (revId: string) => {
    onDuplicateRevision(revId, dupDesc.trim());
    setDuplicateModeId(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    onAddUser(
      newUsername.trim(), 
      newJobTitle.trim() || 'General Specialist', 
      newEmployeeCode.trim() || `EMP-${Math.floor(100 + Math.random() * 900)}`
    );
    setNewUsername('');
    setNewJobTitle('');
    setNewEmployeeCode('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-gradient-to-br from-[#0c1224] to-[#070b14] text-slate-200 select-none relative p-6 md:p-12">
      {/* Background radial glowing gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-12 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none z-0" />

      <div className="max-w-6xl w-full mx-auto space-y-8 z-10">
        
        {/* Hub Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500 rounded-xl w-10 h-10 flex items-center justify-center font-bold text-white shadow-xl shadow-cyan-500/20 text-lg">
                N
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                  Nexus Project & Revision Hub
                </h1>
                <p className="text-xs text-slate-400">
                  Select and replicate scheduled revisions aligned with critical path calculations.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="inline-flex rounded-xl p-1 bg-black/40 border border-white/5 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'projects'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Projects & Revisions</span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'team'
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Company Team Pool</span>
            </button>
          </div>
        </div>

        {/* CONTROLS AREA BY ACTIVE TAB */}
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* COLUMN 1: Projects Selector (Left 5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Projects Directory
                </h2>
                <span className="text-xs text-slate-500 py-0.5 px-2 bg-white/5 rounded-full border border-white/5">
                  {projects.length} Total
                </span>
              </div>

              {/* Projects cards container */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                {projects.map(proj => {
                  const isProjSelected = proj.id === activeProjectId;
                  const revsCount = revisions.filter(r => r.projectId === proj.id).length;
                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProject(proj.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                        isProjSelected
                          ? 'bg-white/10 border-cyan-500 shadow-xl shadow-cyan-500/5 backdrop-blur-lg'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 pr-6">
                          <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {proj.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {proj.description || 'No project description added.'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(proj.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all self-start ml-2"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                        <span>Revs: <strong className="text-cyan-400">{revsCount}</strong></span>
                        <span>Created: {new Date(proj.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}

                {projects.length === 0 && (
                  <div className="p-8 text-center text-slate-500 italic bg-white/5 rounded-xl border border-white/10">
                    No projects exist in database. Register a new project below!
                  </div>
                )}
              </div>

              {/* Create New Project Form */}
              <form onSubmit={handleCreateProject} className="bg-white/5 p-5 rounded-xl border border-white/10 space-y-4 backdrop-blur-sm">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  📐 Initialize New Database Project
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Project Name, e.g. Mars Cargo Substructure"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-all font-sans"
                  />
                  <textarea
                    placeholder="Project Scope Description..."
                    value={newProjDesc}
                    onChange={(e) => setNewProjDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-all font-sans resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Provision Project Workspace</span>
                </button>
              </form>
            </div>

            {/* COLUMN 2: Selected Project's Revisions Directory (Right 7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {selectedProject ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                        Selected Project Context
                      </span>
                      <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <Building className="w-5 h-5 text-indigo-400" />
                        {selectedProject.name}
                      </h2>
                    </div>
                    <span className="text-xs text-slate-450 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-mono">
                      {selectedProjectRevisions.length} Relational Revisions
                    </span>
                  </div>

                  {/* Revisions Stack list */}
                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                    {selectedProjectRevisions.slice().sort((a,b) => b.number - a.number).map(rev => {
                      const isRevSelected = rev.id === activeRevisionId;
                      const hasDuplicateMode = duplicateModeId === rev.id;
                      const taskCount = nodesCountByRevision[rev.id] || 0;
                      
                      return (
                        <div
                          key={rev.id}
                          className={`p-5 rounded-xl border transition-all flex flex-col gap-3 relative ${
                            isRevSelected
                              ? 'bg-gradient-to-r from-cyan-950/20 via-indigo-950/10 to-transparent border-cyan-450 shadow-md'
                              : 'bg-white/5 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  isRevSelected 
                                    ? 'bg-cyan-500 text-white' 
                                    : 'bg-white/10 text-slate-300'
                                }`}>
                                  REVISION {rev.number}
                                </span>
                                {rev.isBaseline && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase">
                                    Baseline Active
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-450 font-mono">
                                  Bounds start: {rev.projectStart}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 pt-1 font-medium italic">
                                "{rev.description || 'No description supplied.'}"
                              </p>
                              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3 pt-1">
                                <span>Tasks Stacked: <strong className="text-white">{taskCount} Node elements</strong></span>
                                <span>•</span>
                                <span>Created: {new Date(rev.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* Revision operations */}
                            <div className="flex items-center gap-1.5 shrink-0 self-start">
                              <button
                                onClick={() => handleDuplicateClick(rev.id, rev.number)}
                                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-all"
                                title="CPM: Copy Revision model to new Replanned version"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteRevision(rev.id)}
                                className="p-2 text-slate-500 hover:text-rose-450 hover:bg-white/5 rounded-lg transition-all"
                                title="Delete Revision"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Inline copy duplicator interface if active */}
                          {hasDuplicateMode && (
                            <div className="bg-black/40 p-3.5 rounded-lg border border-cyan-500/30 mt-1 space-y-3 font-sans">
                              <div className="space-y-1.5">
                                <label className="block text-[10px] text-cyan-300 uppercase font-mono font-bold">
                                  Branch and Replanning Cycle Description
                                </label>
                                <input
                                  type="text"
                                  value={dupDesc}
                                  onChange={(e) => setDupDesc(e.target.value)}
                                  className="w-full bg-black/60 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                                  placeholder="Specify notes for copy cycle, e.g. Acceleration Plan"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setDuplicateModeId(null)}
                                  className="px-3 py-1.5 text-slate-400 hover:text-white rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDuplicate(rev.id)}
                                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded font-medium cursor-pointer flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Duplicate & Commit</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Big Load / Enter Workspace buttons */}
                          <div className="flex justify-between items-center bg-white/[0.02] -mx-5 -mb-5 p-3 px-5 rounded-b-xl border-t border-white/5 mt-2">
                            <span className="text-[10px] font-mono text-slate-500">
                              Revision Identifier: <code className="text-slate-400 font-bold">{rev.id.split('-')[1] || rev.id.substring(0,8)}</code>
                            </span>
                            
                            <button
                              onClick={() => {
                                onSelectRevision(rev.id);
                                onEnterWorkspace();
                              }}
                              className={`flex items-center gap-1.5 p-1.5 px-3 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer ${
                                isRevSelected
                                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/10'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-205 border border-white/10'
                              }`}
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>{isRevSelected ? 'Enter Selected Workspace' : 'Select & Open Workspace'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {selectedProjectRevisions.length === 0 && (
                      <div className="p-8 text-center text-slate-500 italic bg-white/5 rounded-xl border border-white/10">
                        No revisions configured for this project. Setup a revision level below.
                      </div>
                    )}
                  </div>

                  {/* Create New Revision Form */}
                  <form onSubmit={handleCreateRevision} className="bg-white/5 p-5 rounded-xl border border-white/10 space-y-4 backdrop-blur-sm">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      ⛓️ Create a New Revision Context (Replan Base)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Revision Milestone Notes</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Weather Delayed Reprojection, Rev 3"
                          value={newRevDesc}
                          onChange={(e) => setNewRevDesc(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-all font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Project Network Start Date</label>
                        <input
                          type="date"
                          required
                          value={newRevStart}
                          onChange={(e) => setNewRevStart(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Commit Revision Schema</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-full bg-white/5 rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 border border-white/10">
                    <Database className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-300">No Active Project Selected</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Choose a project card from the directory list on the left to review its versioned revisions and open the active WBS workspace.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* COLUMN 1: Enter User Roster */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  National Staff & Resources Registry
                </h2>
                <span className="text-xs text-slate-500 py-0.5 px-2 bg-white/5 rounded-full border border-white/5">
                  {users.length} Active Users
                </span>
              </div>

              {/* Members card grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {users.map(user => (
                  <div
                    key={user.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-4 group hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-550/20 text-indigo-300 font-bold text-sm flex items-center justify-center tracking-wide uppercase shrink-0">
                        {user.username.substring(0, 2)}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          {user.username}
                        </h4>
                        <p className="text-[10px] text-slate-450 font-medium">
                          {user.jobTitle}
                        </p>
                        <code className="text-[9px] text-cyan-400 font-mono uppercase font-bold">
                          {user.employeeCode}
                        </code>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteUser(user.id)}
                      className="p-1 px-1.5 text-slate-500 group-hover:text-rose-400 rounded hover:bg-white/5 transition-all"
                      title="Deregister Team Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="col-span-2 p-12 text-center text-slate-500 italic bg-white/5 rounded-xl border border-white/10">
                    No resources or staff registered in general system index.
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: User Creation Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-5 backdrop-blur-sm">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Staff Register Form
                  </h3>
                  <p className="text-[11px] text-slate-450">
                    Create entries representing site leads, corporate safety assessors, database leads, and legal counsels.
                  </p>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3 font-sans">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-455 font-semibold">User Real Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bob Richardson"
                      value={newUsername}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                      onChange={(e) => setNewUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-455 font-semibold">Assigned Job Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Principal Structural Lead"
                      value={newJobTitle}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                      onChange={(e) => setNewJobTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-slate-455 font-semibold">Employee ID Badge</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-139"
                      value={newEmployeeCode}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                      onChange={(e) => setNewEmployeeCode(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-gradient-to-r from-cyan-550 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-semibold text-xs rounded-lg shadow-lg shadow-indigo-500/10 transition-all flex items-center justify-center gap-1 cursor-pointer pt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register CustomUser</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
