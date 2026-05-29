import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('ch_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use(r => r, e => { if (e.response?.status === 401) { localStorage.removeItem('ch_token'); window.location.href = '/login'; } return Promise.reject(e); });
export default api;
