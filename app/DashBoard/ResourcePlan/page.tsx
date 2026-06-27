'use client';

import React, { useState, useEffect } from 'react';
import ResourcePlan from '../../../components/ResourcePlan';
import { Project, Revision, CustomUser, TaskRole, ProjectNode } from '../../../types/types';
import { apiClient } from '../../../lib/api';

export default function ResourcePlanPage() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [revisions, setRevisions]   = useState<Revision[]>([]);
  const [users, setUsers]           = useState<CustomUser[]>([]);
  const [taskRoles, setTaskRoles]   = useState<TaskRole[]>([]);
  const [nodes, setNodes]           = useState<ProjectNode[]>([]);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        // ۱. بارگذاری لیست پروژه‌ها، کاربران و تمام ریویژن‌ها به صورت موازی
        const [projRes, userRes, revRes] = await Promise.all([
          apiClient.get('/planning/projects/'),
          apiClient.get('/auth/users/'),
          apiClient.get('/planning/revisions/'),
        ]);

        const projectList: Project[]   = projRes.data.results  ?? projRes.data;
        const userList: CustomUser[]   = userRes.data.results  ?? userRes.data;
        const revisionList: Revision[] = revRes.data.results   ?? revRes.data;

        setProjects(projectList);
        setUsers(userList);
        setRevisions(revisionList);

        // ۲. پیدا کردن آخرین ریویژن فعال برای "تک تک پروژه‌ها"
        const latestRevisionsPerProject = projectList.map(proj => {
          const projRevs = revisionList.filter(r => String(r.projectId) === String(proj.id));
          return projRevs.sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];
        }).filter(Boolean); // حذف مقادیر تهی برای پروژه‌هایی که هنوز ریویژن ندارند

        if (latestRevisionsPerProject.length === 0) {
          setIsLoading(false);
          return;
        }

        // استخراج آرایه‌ای از IDهای تمام ریویژن‌های فعال
        const activeRevIds = latestRevisionsPerProject.map(r => r.id);

        // ۳. درخواست موازی برای دریافت دیتای گانت (Nodes) تمام ریویژن‌های فعال + نقش‌ها
        const rolesPromise = apiClient.get('/planning/task-roles/');
        const ganttPromises = activeRevIds.map(revId =>
            apiClient.get(`/planning/revisions/${revId}/gantt-data/`)
        );

        const [rolesRes, ...ganttResponses] = await Promise.all([
          rolesPromise,
          ...ganttPromises
        ]);

        // ۴. فیلتر کردن نقش‌ها در فرانت‌اند (فقط نقش‌های مربوط به ریویژن‌های فعالِ پروژه‌ها حفظ شوند)
        const allRoles: TaskRole[] = rolesRes.data.results ?? rolesRes.data;
        const filteredRoles = allRoles.filter(role => activeRevIds.includes(role.revisionId));
        setTaskRoles(filteredRoles);

        // ۵. ترکیب (Combine) تمام گره‌های دریافتی از پروژه‌های مختلف در یک آرایه واحد
        const combinedNodes = ganttResponses.reduce((acc: ProjectNode[], res) => {
          const ganttData = res.data;
          const nodeList: ProjectNode[] = ganttData.nodes ?? ganttData;
          return [...acc, ...nodeList];
        }, []);

        setNodes(combinedNodes);

        // به عنوان پیش‌فرض، ID اولین ریویژن را ست می‌کنیم (یا کلا null پاس بدهید)
        setActiveRevisionId(activeRevIds[0] || null);

      } catch (err: any) {
        console.error('ResourcePlan load error:', err);
        setError(err?.response?.data?.detail ?? 'Failed to load resource data.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);
  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="w-10 h-10 border-[3px] border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Loading resource plan…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p className="text-sm text-rose-400 font-mono">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 hover:bg-white/10 transition-colors font-mono"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ResourcePlan
      users={users}
      taskRoles={taskRoles}
      projects={projects}
      revisions={revisions}
      nodes={nodes}
      activeRevisionId={activeRevisionId}
      onExit={() => window.history.back()}
    />
  );
}
