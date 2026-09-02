import API from './axios';

export const getProblems = (params) => API.get('/problems/admin', { params });
export const getProblem = (id, admin = false) => API.get(admin ? `/problems/admin/${id}` : `/problems/${id}`);
export const createProblem = (data) => API.post('/problems/admin', data);
export const updateProblem = (id, data) => API.put(`/problems/admin/${id}`, data);
export const deleteProblem = (id) => API.delete(`/problems/admin/${id}`);
