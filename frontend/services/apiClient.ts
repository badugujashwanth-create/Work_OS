import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://zettalogix-workos.onrender.com/api';

const apiClient = axios.create({
  baseURL,
  withCredentials: true
});

type RefreshCallback = (token: string) => void;

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('workhub-token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: RefreshCallback[] = [];

const processQueue = (token: string) => {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
};

const requestRefreshToken = async () => {
  if (typeof window === 'undefined') throw new Error('No refresh context');
  const refreshToken = localStorage.getItem('workhub-refresh');
  if (!refreshToken) throw new Error('Missing refresh token');
  const { data } = await axios.post<{ token: string; refreshToken: string }>(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { withCredentials: true }
  );
  localStorage.setItem('workhub-token', data.token);
  localStorage.setItem('workhub-refresh', data.refreshToken);
  apiClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
  return data.token;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const token = await requestRefreshToken();
      processQueue(token);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      isRefreshing = false;
      return apiClient(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      refreshQueue = [];
      if (typeof window !== 'undefined') {
        localStorage.removeItem('workhub-token');
        localStorage.removeItem('workhub-refresh');
      }
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
