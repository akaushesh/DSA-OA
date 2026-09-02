import API from './axios';

export const startAttempt = (questionSetId) => API.post('/attempts/start', { questionSetId });
export const endAttempt = (id, timedOut = false) => API.put(`/attempts/${id}/end`, { timedOut });
export const getAttempt = (id) => API.get(`/attempts/${id}`);
export const deleteAttempt = (id) => API.delete(`/attempts/${id}`);
export const myAttempts = (params) => API.get('/attempts/my', { params });
export const allAttempts = (params) => API.get('/attempts/all', { params });
