import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE ?? '/api';

export const api = axios.create({ baseURL, withCredentials: true });

// Attach access token (kept in memory by the auth store).
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// On 401, try a one-time refresh then replay.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing ??= api
        .post('/admin/auth/refresh')
        .then((res) => res.data.accessToken as string)
        .catch(() => null)
        .finally(() => {
          refreshing = null;
        });
      const token = await refreshing;
      if (token) {
        setAccessToken(token);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
