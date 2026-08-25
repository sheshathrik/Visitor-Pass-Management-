import axios from 'axios';

const API = axios.create({
  baseURL: 'https://visitor-pass-management-1-aa5j.onrender.com/api',
});

export default API;
