import API from './axios';

export const getQuestionSets = (params) => API.get('/questionsets', { params });
export const getQuestionSet = (id) => API.get(`/questionsets/${id}`);
export const createQuestionSet = (data) => API.post('/questionsets', data);
export const importQuestionSet = (data) => API.post('/questionsets/import', data);
export const updateQuestionSet = (id, data) => API.put(`/questionsets/admin/${id}`, data);
export const deleteQuestionSet = (id) => API.delete(`/questionsets/admin/${id}`);
