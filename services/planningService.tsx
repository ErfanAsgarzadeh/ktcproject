import { apiClient } from '../lib/api';
import { ProjectNode, Dependency } from '../types/types'; // مسیر فایل تایپ‌های شما

interface GanttDataResponse {
    nodes: ProjectNode[];
    dependencies: Dependency[];
}

export const planningService = {
    // دریافت کل دیتای گانت‌چارت برای یک نسخه خاص
    getGanttData: async (revisionId: string): Promise<GanttDataResponse> => {
        const response = await apiClient.get<GanttDataResponse>(`/planning/revisions/${revisionId}/gantt-data/`);
        return response.data;
    },

    // دریافت لیست پروژه‌ها
    getProjects: async () => {
        const response = await apiClient.get('/planning/projects/');
        return response.data;
    },

    // دریافت نسخه‌های یک پروژه
    getRevisions: async (projectId: string) => {
        const response = await apiClient.get(`/planning/revisions/?project_id=${projectId}`);
        return response.data;
    },

    getMyTasks: async (revisionId: string, userId: string) => {
        const response = await apiClient.get(`/planning/activities/?revision_id=${revisionId}&assigned_user=${userId}`);
        return response.data;
    }
};