import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://visitor-pass-management-1-aa5j.onrender.com/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use((response) => {
  if (
    response.config.responseType !== "blob" &&
    response.data?.success === true
  ) {
    response.data = response.data.data;
  }

  return response;
});

export default api;