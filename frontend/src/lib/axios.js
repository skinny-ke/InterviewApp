import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;
console.log("Frontend API Base URL:", baseURL);

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

// Store getToken function globally for interceptor
let getTokenFn = null;

export const setAxiosAuth = (getToken) => {
  getTokenFn = getToken;
};

// Add request interceptor to log outgoing requests
axiosInstance.interceptors.request.use(
  async (config) => {
    // Add Clerk authentication token if available
    if (getTokenFn) {
      try {
        const token = await getTokenFn();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("Error getting Clerk token:", error);
      }
    }
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
    console.log("Axios Response Success:", response.status, response.config.method?.toUpperCase(), response.config.url, response.data);
    return response;
  },
  (error) => {
    // Handle network errors where error.response is undefined
    if (!error.response) {
      const errorInfo = {
        type: 'Network Error',
        message: error.message,
        code: error.code,
        config: {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
        },
        suggestion: error.code === 'ERR_NETWORK_CHANGED' 
          ? 'Backend server may have crashed or restarted. Check backend logs.'
          : error.code === 'ECONNREFUSED'
          ? 'Backend server is not running. Start it with: cd backend && npm run dev'
          : 'Check if backend server is running and accessible.'
      };
      console.error("Axios Network Error:", errorInfo);
    } else {
      // Handle HTTP errors (4xx, 5xx) where error.response exists
      console.error("Axios HTTP Error:", {
        status: error.response.status,
        statusText: error.response.statusText,
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        message: error.message,
        data: error.response.data
      });
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
