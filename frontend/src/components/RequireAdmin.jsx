import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireAdmin({ children }) {
  const { token, authReady } = useAuth();
  if (!authReady) return <div className="min-h-screen bg-background" />;
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}
