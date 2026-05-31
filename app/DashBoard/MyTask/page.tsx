

'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react';
import  MyTasks from '../../../components/MyTasks'
import { ProjectNode, ActivityNode, Dependency, ZoomLevel, Project, Revision, CustomUser, TaskRole, ChatMessage } from './types';


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


export default function MyTasksUser(){

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


    return(
        <div>
            <MyTasks
                users={users}
                projects={projects}
                revisions={revisions}
                taskRoles={taskRoles}
                chatMessages={chatMessages}

                onAddChatMessage={handleAddChatMessage}
                onGlobalProgressUpdate={handleGlobalProgressUpdate}

                onToggleTheme={() => setIsLightMode(!isLightMode)}
            />
        </div>

    )
}