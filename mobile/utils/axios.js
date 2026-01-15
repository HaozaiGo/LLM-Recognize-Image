import axios from 'axios';
import { API_URL } from '../config';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 1800000,
});

export default axiosInstance;

