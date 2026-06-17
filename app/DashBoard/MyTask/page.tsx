'use client'
import React, { useState, useEffect } from 'react';
import MyTasks from '../../../components/MyTasks'
import { Project, Revision, CustomUser, TaskRole, ChatMessage } from '../../../types/types';
import { apiClient } from '../../../lib/api'

export default function MyTasksUser() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [users, setUsers] = useState<CustomUser[]>([]);
    const [currentUser, setCurrentUser] = useState<CustomUser | null>(null); // اضافه شدن استیت کاربر فعلی
    const [taskRoles, setTaskRoles] = useState<TaskRole[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLightMode, setIsLightMode] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // ۱. ابتدا مشخصات کاربر لاگین شده را دریافت می‌کنیم
                const profileRes = await apiClient.get('/auth/profile/');

                // بر اساس ساختار بک‌اند شما، ممکن است دیتا داخل آرایه باشد یا یک آبجکت مستقیم
                const loggedInUser = profileRes.data.results ? profileRes.data.results[0] : profileRes.data;

                if (!loggedInUser || !loggedInUser.id) {
                    console.error("اطلاعات کاربری یافت نشد!");
                    setIsLoading(false);
                    return;
                }

                // ست کردن کاربر لاگین شده و قرار دادن او به عنوان لیست یوزرها
                setCurrentUser(loggedInUser);
                setUsers([loggedInUser]);

                // ۲. حالا تسک‌ها و رول‌ها را فقط برای این کاربر فراخوانی می‌کنیم
                // دقت کنید: نام کوئری‌پارامتر (?user_id=) ممکن است در بک‌اند شما (?user=) باشد
                const [projRes, revRes, rolesRes, chatsRes,tasksRes] = await Promise.all([
                    apiClient.get('/planning/projects/'),
                    apiClient.get('/planning/revisions/'),
                    apiClient.get(`/planning/task-roles/?user_id=${loggedInUser.id}`), // فیلتر بر اساس کاربر
                    apiClient.get(`/planning/task-chats/`), // در صورت نیاز این را هم میتوانید با ?user_id فیلتر کنید
                    apiClient.get(`/planning/activities/?user_id=${loggedInUser.id}`)
                ]);

                setProjects(projRes.data.results || projRes.data);
                setRevisions(revRes.data.results || revRes.data);
                setTaskRoles(rolesRes.data.results || rolesRes.data);
                setTasks(tasksRes.data.results || tasksRes.data);
                const formattedChats = (chatsRes.data.results || chatsRes.data).map((chat: any) => ({
                    id: chat.id,
                    taskId: chat.task,
                    userId: chat.user,
                    text: chat.text || '',
                    timestamp: chat.timestamp,
                    fileUrl: chat.file_url || null,
                    fileName: chat.file_name || '',
                    fileType: chat.file_type || '',
                }));
                setChatMessages(formattedChats);

            } catch (error) {
                console.error("خطا در دریافت اطلاعات از سرور:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const handleAddChatMessage = async (taskId: string, userId: string, text: string, file?: File | null) => {
        try {
            const formData = new FormData();
            formData.append('task', taskId);
            formData.append('text', text || '');
            if (file) {
                formData.append('file', file);
            }

            const res = await apiClient.post('/planning/task-chats/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newMsg: ChatMessage = {
                id: res.data.id,
                taskId: res.data.task,
                userId: res.data.user,
                text: res.data.text || '',
                timestamp: res.data.timestamp,
                fileUrl: res.data.file_url || null,
                fileName: res.data.file_name || '',
                fileType: res.data.file_type || '',
            };
            setChatMessages(prev => [...prev, newMsg]);
        } catch (error) {
            console.error("خطا در ارسال پیام:", error);
        }
    };

    const handleGlobalProgressUpdate = (revisionId: string, taskId: string, progress: number) => {
        console.log(`Global Task Progress Updated: Task ${taskId} is now at ${progress}%`);
    };

    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center font-mono text-sm" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-accent)' }}>در حال برقراری ارتباط با سرور...</div>;
    }

    return(
        <div className="h-screen w-screen overflow-hidden">
            <MyTasks
                users={users} // فقط یک کاربر (کاربر لاگین شده) پاس داده می‌شود
                currentUser={currentUser} // پاس دادن کاربر فعلی به کامپوننت فرزند
                projects={projects}
                revisions={revisions}
                taskRoles={taskRoles} // تسک‌های فیلتر شده
                tasks={tasks}
                chatMessages={chatMessages}
                onExit={() => window.history.back()}
                onAddChatMessage={handleAddChatMessage}
                onGlobalProgressUpdate={handleGlobalProgressUpdate}
                isLightMode={isLightMode}
                onToggleTheme={() => setIsLightMode(!isLightMode)}

            />
        </div>
    )
}