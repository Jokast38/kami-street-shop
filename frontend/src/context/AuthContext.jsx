import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("admin_token"));
  const [email, setEmail] = useState(localStorage.getItem("admin_email"));

  const login = async (em, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email: em, password });
    localStorage.setItem("admin_token", data.access_token);
    localStorage.setItem("admin_email", data.email);
    setToken(data.access_token);
    setEmail(data.email);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    setToken(null);
    setEmail(null);
  };

  const authAxios = axios.create({ baseURL: API });
  authAxios.interceptors.request.use((cfg) => {
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  return (
    <AuthContext.Provider value={{ token, email, login, logout, authAxios }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
