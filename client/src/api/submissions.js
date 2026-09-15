import API from './axios';

export const submitCode = (data) => API.post('/submissions', data);
export const runCustomCode = (data) => API.post('/submissions/custom', data);
export const getSubmission = (id) => API.get(`/submissions/${id}`);
export const mySubmissions = (params) => API.get('/submissions/my', { params });
