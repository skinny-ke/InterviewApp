import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;
console.log("Frontend API Base URL:", baseURL);

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

// Add request interceptor to log outgoing requests
axiosInstance.interceptors.request.use(
  (config) => {
    console.log("Axios Request:", config.method?.toUpperCase(), config.url, config.headers);
    return config;
  },
  (error) => {
    console.error("Axios Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor to log responses
axiosInstance.interceptors.response.use(
  (response) => {
    console.log("Axios Response:", response.status, response.config.method?.toUpperCase(), response.config.url);
    return response;
  },
  (error) => {
    console.error("Axios Response Error:", error.response?.status, error.response?.config?.method?.toUpperCase(), error.response?.config?.url, error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
