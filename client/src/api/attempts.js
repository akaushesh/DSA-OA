import API from './axios';

export const startAttempt = (questionSetId, data = {}) => API.post('/attempts/start', { questionSetId, ...data });
export const endAttempt = (id, timedOut = false) => API.put(`/attempts/${id}/end`, { timedOut });
export const getAttempt = (id) => API.get(`/attempts/${id}`);
export const deleteAttempt = (id) => API.delete(`/attempts/${id}`);
export const myAttempts = (params) => API.get('/attempts/my', { params });
export const allAttempts = (params) => API.get('/attempts/all', { params });
export const saveTimers = (id, data) => API.patch(`/attempts/${id}/timers`, data);
export const adjustAttemptTime = (id, data) => API.post(`/attempts/${id}/adjust-time`, data);
export const resetAttempt = (id) => API.post(`/attempts/${id}/reset`);
export const stopAttempt = (id) => API.post(`/attempts/${id}/stop`);
