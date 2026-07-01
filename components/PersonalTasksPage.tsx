import React, { useState, useEffect } from 'react';
import {
  Project,
  Revision,
  ProjectNode,
  TaskRole,
  CustomUser
} from '@/types/types';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Trash2,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Edit2,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import JalaliDatePicker from './JalaliDatePicker';
import { gregorianToJalaliString } from '../utils/jalali';

interface PersonalTasksPageProps {
  users: CustomUser[];
  projects: Project[];
  revisions: Revision[];
  taskRoles: TaskRole[];
  onExit: () => void;
  isLightMode: boolean;
  currentUser: CustomUser | null;
}

export default function PersonalTasksPage({
                                            users,
                                            currentUser
                                          }: PersonalTasksPageProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [title, setTitle] = useState('');
  const [startDateStr, setStartDateStr] = useState('2026-06-08');
  const [durationHours, setDurationHours] = useState<number>(1);
  const [description, setDescription] = useState('');

  // States برای مدیریت نقش‌ها
  const [taskRoles, setTaskRoles] = useState<TaskRole[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('owner');

  // State مربوط به حالت ویرایش
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [, setEditingRevisionId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [personalTasks, setPersonalTasks] = useState<ProjectNode[]>([]);
  const [allTaskRolesMap, setAllTaskRolesMap] = useState<Record<string, any[]>>({});
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const formattedToday = `${yyyy}-${mm}-${dd}`;

  useEffect(() => {
    const fetchPersonalTasks = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get('/planning/personal-tasks/');
        setPersonalTasks(response.data);

        // Fetch all task roles for these tasks
        const taskIds = response.data.map((t: any) => t.id);
        if (taskIds.length > 0) {
          try {
            const rolesRes = await apiClient.get('/planning/task-roles/');
            const allRoles = rolesRes.data.results || rolesRes.data || [];
            // Group roles by taskId
            const rolesMap: Record<string, any[]> = {};
            allRoles.forEach((role: any) => {
              const tid = String(role.taskId || role.task_id || role.task || '');
              if (taskIds.includes(tid)) {
                if (!rolesMap[tid]) rolesMap[tid] = [];
                rolesMap[tid].push(role);
              }
            });
            setAllTaskRolesMap(rolesMap);
          } catch (err) {
            console.error("Could not fetch task roles:", err);
          }
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Failed to load tasks from server.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonalTasks();
  }, []);

  // تابع ریست کردن فرم
  const resetForm = () => {
    setEditingTaskId(null);
    setEditingRevisionId(null);
    setTitle('');
    setDescription('');
    setDurationHours(40);
    setTaskRoles([]); // ریست کردن نقش‌ها هنگام خروج از حالت ویرایش
  };

  // هندلر کلیک روی ردیف جدول برای فعال کردن حالت ویرایش
  const handleRowClick = async (task: any) => {
    setEditingTaskId(task.id);
    setEditingRevisionId(task.revisionId || task.revision_id || task.revision || null);
    setTitle(task.name);
    setDescription(task.description || '');

    // حل مشکل تاریخ: جدا کردن بخش YYYY-MM-DD از ساعت
    if (task.startDate) {
      const onlyDate = task.startDate.split(' ')[0];
      setStartDateStr(onlyDate);
    } else {
      setStartDateStr(formattedToday);
    }

    setDurationHours(task.duration);

    const executorName = task.resources?.[0];
    if (executorName) {
      const matchedUser = users.find(u => u.username === executorName || u.username.toLowerCase() === String(executorName).toLowerCase());
      if (matchedUser) setSelectedUserId(matchedUser.id);
    }

    // دریافت نقش‌های این تسک از سرور (اختیاری: اگر بک‌اند این API را دارد)
    try {
      const rolesRes = await apiClient.get(`/planning/task-roles/?taskId=${task.id}`);
      setTaskRoles(rolesRes.data || []);
    } catch (err) {
      console.error("Could not fetch roles for this task", err);
      // Fallback
      setTaskRoles(task.roles || []);
    }
  };

  // ارسال اطلاعات به دیتابیس (ایجاد یا آپدیت)
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please provide a valid task title.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      title: title,
      start_date: startDateStr,
      duration_hours: durationHours,
      description: description,
      user_id: selectedUserId,
      current_user: currentUser,
    };

    try {
      if (editingTaskId) {
        const response = await apiClient.patch(`/planning/personal-tasks/${editingTaskId}/`, payload);
        setPersonalTasks(prev => prev.map(t => t.id === editingTaskId ? response.data : t));
        setSuccessMsg(`Personal Task "${title}" successfully updated.`);
      } else {
        const response = await apiClient.post('/planning/personal-tasks/create/', payload);
        setPersonalTasks(prev => [response.data, ...prev]);
        setSuccessMsg(`Personal Task "${title}" successfully committed to backend.`);
      }

      resetForm();
      setTimeout(() => setSuccessMsg(null), 4000);

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || "Network error while saving task.";
      setErrorMsg(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // حذف تسک
  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();

    if (window.confirm("Are you sure you want to cancel and remove this systemic personal task?")) {
      try {
        await apiClient.delete(`/planning/personal-tasks/${taskId}/`);
        setPersonalTasks(prev => prev.filter(t => t.id !== taskId));

        if (editingTaskId === taskId) resetForm();

      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || "Failed to delete task from server.";
        alert(errorMessage);
        console.error(err);
      }
    }
  };

  // افزودن نقش جدید به تسک (فقط در حالت ویرایش امکان پذیر است)
  const handleAssignUser = async () => {
    if (!selectedAssignee || !selectedRole) return;

    if (!editingTaskId) {
      alert("Please create (Commit) the task first, then click on it to add new roles.");
      return;
    }

    try {
      const res = await apiClient.post('/planning/task-roles/', {
        revisionId: 16,
        taskId: editingTaskId,
        userId: selectedAssignee,
        role: selectedRole
      });

      setTaskRoles(prev => [...prev, res.data]);
      setSelectedAssignee('');
      setSelectedRole('owner');
    } catch (err) {
      console.error("Error saving task role:", err);
      alert("Error assigning user! This role may already be assigned to the selected user.");
    }
  };

  // حذف نقش از تسک
  const handleDeleteTaskRole = async (id: string) => {
    try {
      await apiClient.delete(`/planning/task-roles/${id}/`);
      setTaskRoles(prev => prev.filter(tr => tr.id !== id));
    } catch (err) {
      console.error("Error deleting task role:", err);
      alert("Error removing user assignment.");
    }
  };

  return (
      <div className="h-full min-h-0 w-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {/* Header */}
        <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl shrink-0 z-25">
          <div className="flex items-center gap-4">


            <div className="h-5 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#22d3ee]/10 rounded-xl border border-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>Personal Task Transaction Center</h1>
                <p className="text-[10px] text-slate-400 font-sans">Commit and audit atomic user tasks.</p>
              </div>
            </div>
          </div>


        </header>

        {/* Main Container Workspace */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

          {/* Left Side: Create / Edit form */}
          <div className="w-full lg:w-[400px] xl:w-[430px] max-h-[44%] lg:max-h-none lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 p-4 overflow-y-auto" style={{ backgroundColor: 'var(--overlay-bg)' }}>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase font-mono tracking-wider ${editingTaskId ? 'text-amber-400' : 'text-slate-300'}`}>
                  {editingTaskId ? 'Edit Personal Task' : 'Commit Personal Task'}
                </h3>
                {editingTaskId && (
                    <button
                        type="button"
                        onClick={resetForm}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Cancel Edit
                    </button>
                )}
              </div>

              {successMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2 text-xs text-emerald-400 animate-fade-in">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
              )}

              {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-400 animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Target User (Executor)</label>
                <div className="relative">
                  <select
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      className="w-full bg-[#11162a]/90 border border-white/10 hover:border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all cursor-pointer font-bold appearance-none"
                  >
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.username.toUpperCase()} ({u.jobTitle || 'Team Member'})</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</span>
                </div>
              </div>

              {/* بخش افزودن نقش (Roles) */}
              <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10 mt-4">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block mb-1">
                  Additional Roles {editingTaskId ? '' : '(Requires Edit Mode)'}
                </label>

                {!editingTaskId ? (
                    <div className="text-[10px] text-slate-500 bg-black/20 p-2.5 rounded-lg border border-white/5 font-sans leading-relaxed">
                      ℹ️ Save/Commit the task first, then click on it from the list to assign additional roles.
                    </div>
                ) : (
                    <>
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 font-sans">
                        <select
                            value={selectedAssignee}
                            onChange={e => setSelectedAssignee(e.target.value)}
                            className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
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
                            className="bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                        >
                          <option value="owner" className="bg-slate-950 text-slate-200">Owner</option>
                          <option value="reviewer" className="bg-slate-950 text-slate-200">Reviewer</option>
                          <option value="executor" className="bg-slate-950 text-slate-200">Executor</option>
                          <option value="project manager" className="bg-slate-950 text-slate-200">PM</option>
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

                      {/* لیست نقش‌های اضافه شده */}
                      {taskRoles && taskRoles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {taskRoles.map((role: any) => {
                              const roleUserId = String(role.userId || role.user_id || role.user || '');
                              const assignedUser = users.find(u => String(u.id) === roleUserId);
                              return (
                                  <div key={role.id} className="flex justify-between items-center bg-black/40 border border-white/5 px-2 py-1.5 rounded-lg text-[10px]">
                            <span className="text-slate-300">
                              {assignedUser?.username || 'Unknown'} - <span className="text-cyan-400 capitalize">{role.role}</span>
                            </span>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTaskRole(role.id)}
                                        className="text-rose-400 hover:text-rose-300 p-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                              );
                            })}
                          </div>
                      )}
                    </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Task Title</label>
                <input
                    type="text"
                    required
                    placeholder="e.g. Audit regional compliance permits documentation"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full border border-white/10 hover:border-cyan-500/30 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs placeholder-slate-500 focus:outline-none transition-all font-sans"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">Description</label>
                <textarea
                    required
                    placeholder="Description..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full min-h-20 max-h-36 resize-y border border-white/10 hover:border-cyan-500/30 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs placeholder-slate-500 focus:outline-none transition-all font-sans"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Start Date
                </label>
                <JalaliDatePicker
                    required
                    value={startDateStr}
                    onChange={(iso) => setStartDateStr(iso)}
                    className="w-full bg-[#11162a]/90 border border-white/10 hover:border-cyan-500/30 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono flex items-center justify-between gap-2"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Duration (Hours)
              </span>
                  <span className="text-cyan-400 font-bold">{durationHours} Hrs</span>
                </label>
                <div className="flex gap-2">
                  <input
                      type="number"
                      min="1"
                      required
                      value={durationHours}
                      onChange={e => setDurationHours(Number(e.target.value) || 1)}
                      className="w-full bg-[#11162a]/90 border border-white/10 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono"
                  />

                  <div className="flex shrink-0 gap-1.5">
                    <button
                        type="button"
                        onClick={() => setDurationHours(8)}
                        className="px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono rounded-lg transition-all cursor-pointer"
                    >
                      1 Day
                    </button>
                    <button
                        type="button"
                        onClick={() => setDurationHours(40)}
                        className="px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono rounded-lg transition-all cursor-pointer"
                    >
                      1 Wk
                    </button>
                  </div>
                </div>
              </div>

              <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]
            ${isSubmitting ? 'bg-cyan-500/50 text-slate-800 cursor-not-allowed' :
                      editingTaskId ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer' :
                          'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer'}`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    editingTaskId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {isSubmitting ? (editingTaskId ? 'Updating...' : 'Committing...') :
                    (editingTaskId ? 'Update personal_task' : 'Commit personal_task')}
              </button>
            </form>
          </div>

          {/* Right Side: Server Tasks List */}
          <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Active Tasks Audit Ledger</h2>
                <p className="text-[11px] text-slate-400">Live data fetched directly from Django backend.</p>
              </div>

              <div className="flex items-center gap-2  px-3.5 py-1.5 rounded-xl font-mono text-[10px]"
                   style={{ color: 'var(--text-primary)' }} >
                <span className="text-slate-400">Total committed count:</span>
                <strong className="text-cyan-400 font-extrabold">{personalTasks.length}</strong>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-0 flex flex-col">
              {isLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-cyan-500" />
                    <p className="text-xs">Loading tasks from server via Axios...</p>
                  </div>
              ) : (
                  <div className="overflow-auto min-h-0 flex-1">
                  <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                    <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono tracking-wider text-[10px] uppercase">
                      <th className="p-3 pl-4">System ID</th>
                      <th className="p-3">Personal Task Title</th>
                      <th className="p-3">Assigned Team</th>
                      <th className="p-3">Proposed Start</th>
                      <th className="p-3 text-center">Duration</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                    {personalTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-16 text-center text-slate-500 italic">
                            <div className="max-w-xs mx-auto space-y-2">
                              <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto opacity-40" />
                              <p className="font-bold text-slate-400 text-xs">No Server Tasks Found</p>
                              <p className="text-[10px] text-slate-500 leading-normal">Your tasks will appear here once successfully synced with the database.</p>
                            </div>
                          </td>
                        </tr>
                    ) : (
                        personalTasks.map(task => {
                          const isEditing = editingTaskId === task.id;

                          return (
                              <tr
                                  key={task.id}
                                  onClick={() => handleRowClick(task)}
                                  className={`cursor-pointer transition-colors ${
                                      isEditing
                                          ? '--bg-active '
                                          : 'hover:bg-white/[0.03]'
                                  }`}
                                  style={{
                                    backgroundColor: isEditing ? 'var(--overlay-bg)' : undefined,
                                  }}                             >
                                <td className="p-3 pl-4 font-mono font-bold text-cyan-400 text-[10px] tracking-wide">{task.code}</td>
                                <td className="p-3 font-bold max-w-sm truncate" style={{ color: 'var(--text-primary)' }} title={task.name}>{task.name}</td>
                                <td className="p-3">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {(() => {
                                      const roles = allTaskRolesMap[task.id] || [];
                                      if (roles.length === 0) {
                                        return <span className="text-[10px] text-slate-500 italic">No one assigned</span>;
                                      }
                                      return roles.map((role: any, idx: number) => {
                                        const roleUserId = String(role.userId || role.user_id || role.user || '');
                                        const matchedUser = users.find(u => String(u.id) === roleUserId);
                                        const roleName = role.role || 'assigned';
                                        const roleColors: Record<string, string> = {
                                          owner: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
                                          reviewer: 'bg-violet-500/10 border-violet-500/25 text-violet-300',
                                          executor: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300',
                                          'project manager': 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
                                        };
                                        const colorClass = roleColors[roleName] || 'bg-white/5 border-white/10 text-slate-300';
                                        return (
                                            <div key={idx} className={`flex items-center gap-1 border rounded-lg px-2 py-1 ${colorClass}`}>
                                              <span className="text-[9px] font-bold font-mono uppercase">{roleName.substring(0, 3)}</span>
                                              <span className="text-[10px] font-medium">{matchedUser?.username || 'User'}</span>
                                            </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-[10px] text-slate-300">{gregorianToJalaliString(task.startDate)}</td>
                                <td className="p-3 text-center font-mono text-xs">
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 px-2 py-0.5 rounded font-extrabold text-[10px]">
                          {task.duration}
                        </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                      onClick={(e) => handleDeleteTask(e, task.id)}
                                      className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                      title="Delete personal task record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                          );
                        })
                    )}
                    </tbody>
                  </table>
                  </div>
              )}
            </div>
          </div>

        </div>
      </div>
  );
}
