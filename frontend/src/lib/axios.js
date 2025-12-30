import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;
console.log("Frontend API Base URL:", baseURL);

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // by adding this field browser will send the cookies to server automatically, on every single req
});

export default axiosInstance;
