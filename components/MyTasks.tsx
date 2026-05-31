import React, { useState, useEffect } from 'react';
import { CustomUser, TaskRole, Project, Revision, ProjectNode, ChatMessage } from '../types/types';
import { Send } from 'lucide-react';
import { planningService } from '../services/planningService'; // ایمپورت سرویس API

interface MyTasksProps {
  users: CustomUser[];
  activeRevisionId: string; // به جای پاس دادن کل دیتابیس، فقط ID ریویژن فعال را پاس دهید
  chatMessages: ChatMessage[];
  onAddChatMessage: (taskId: string, userId: string, text: string) => void;
  onGlobalProgressUpdate: (revisionId: string, taskId: string, progress: number) => void;
}

export default function MyTasks({
                                  users, activeRevisionId, chatMessages, onAddChatMessage, onGlobalProgressUpdate
                                }: MyTasksProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [selectedTaskObj, setSelectedTaskObj] = useState<any>(null);
  const [chatInput, setChatInput] = useState<string>('');

  // استیت جدید برای نگهداری تسک‌های واقعی دریافتی از سرور
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // جایگزینی کدهای LocalStorage با فراخوانی API
  useEffect(() => {
    const fetchUserTasks = async () => {
      if (!selectedUserId || !activeRevisionId) return;

      setLoading(true);
      try {
        // دریافت مستقیم تسک‌ها از بک‌اند جنگو
        const tasks = await planningService.getMyTasks(activeRevisionId, selectedUserId);

        // مپ کردن دیتا به فرمتی که رابط کاربری انتظار دارد (مانند نقش و آبجکت تسک)
        const formattedTasks = tasks.map((task: any) => ({
          role: 'executor', // این مورد را می‌توانید از API نقش‌ها بخوانید
          node: task,
          projectName: "Project Name", // در صورت نیاز از استیت گلوبال بگیرید
          revisionNumber: 1
        }));

        setUserTasks(formattedTasks);
      } catch (error) {
        console.error("خطا در دریافت تسک‌های کاربر", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTasks();
  }, [selectedUserId, activeRevisionId])}

// ... ادامه کامپوننت شما (بخش رندر JSX نیاز به تغییر خاصی ندارد)