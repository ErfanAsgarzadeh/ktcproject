import axios from 'axios';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    // withCredentials لازم است تا مرورگر httpOnly Cookie را با هر درخواست ارسال کند
    withCredentials: true,
});

// ── helper: خواندن مقدار یک cookie با نام مشخص ──────────────────────────────
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

// ── Request interceptor: اضافه کردن CSRF token به mutation‌ها ──────────────
// توکن JWT دیگر اینجا اضافه نمی‌شود — مرورگر httpOnly Cookie را خودکار ارسال می‌کند.
// فقط X-CSRFToken را برای POST/PUT/PATCH/DELETE اضافه می‌کنیم.
apiClient.interceptors.request.use(
    (config) => {
        const method = config.method?.toUpperCase();
        const isMutation = method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

        if (isMutation) {
            const csrfToken = getCookie('csrftoken');
            if (csrfToken && config.headers) {
                config.headers['X-CSRFToken'] = csrfToken;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor: مدیریت 401 و refresh خودکار ──────────────────────
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown) {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(undefined);
        }
    });
    failedQueue = [];
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // اگر endpoint خود refresh است، بی‌نهایت loop نشود
            if (originalRequest.url?.includes('/auth/token/refresh/')) {
                // refresh token هم منقضی شده — کاربر باید دوباره login کند
                if (typeof window !== 'undefined') {
                    window.location.href = '/Login';
                }
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // درخواست‌های موازی صبر می‌کنند تا refresh تمام شود
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => apiClient(originalRequest))
                  .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // refresh token در httpOnly Cookie است — فقط endpoint را صدا می‌زنیم
                await apiClient.post('/auth/token/refresh/');
                processQueue(null);
                // درخواست اصلی را دوباره اجرا کن (cookie جدید خودکار اعمال می‌شود)
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                // refresh هم ناموفق بود — به صفحه Login هدایت کن
                if (typeof window !== 'undefined') {
                    window.location.href = '/Login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
