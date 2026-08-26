import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://visitor-pass-management-h7x6.onrender.com/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // If backend sends:
    // { success: true, data: {...} }
    // return only the data object
    if (
      response.config.responseType !== "blob" &&
      response.data?.success === true &&
      response.data?.data !== undefined
    ) {
      response.data = response.data.data;
    }

    return response;
  },
  (error) => Promise.reject(error)
);

export default api;