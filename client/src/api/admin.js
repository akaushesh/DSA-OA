import API from './axios';

export const getStats = () => API.get('/admin/stats');
export const listUsers = (params) => API.get('/admin/users', { params });
export const updateUserRole = (id, role) => API.patch(`/admin/users/${id}/role`, { role });
