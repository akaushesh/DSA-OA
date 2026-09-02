import axios from "axios";



const baseURL = `${import.meta.env.VITE_API_HOST}${import.meta.env.VITE_API_BASE_URL}`;



const API = axios.create({
  baseURL: baseURL,
  withCredentials: true
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  res => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await axios.post(`{BASE_URL}/refresh-token`, {}, {
          withCredentials: true
        });
        const newAccessToken = refreshResponse.data.data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);
        API.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(err);
  }
);

export default API;