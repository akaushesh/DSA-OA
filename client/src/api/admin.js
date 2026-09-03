import API from './axios';

export const getStats = () => API.get('/admin/stats');
export const listUsers = (params) => API.get('/admin/users', { params });
export const getUserDetails = (id) => API.get(`/admin/users/${id}/details`);
export const updateUserRole = (id, role) => API.patch(`/admin/users/${id}/role`, { role });
