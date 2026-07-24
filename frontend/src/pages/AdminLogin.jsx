import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Connecté");
      nav("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Identifiants invalides");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 grain">
      <form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-10 relative z-10" data-testid="admin-login-form">
        <Lock className="w-8 h-8 text-accent mb-4" />
        <h1 className="display text-2xl font-black mb-2">Admin — Kami Street</h1>
        <p className="text-sm text-muted-foreground mb-8">Accès réservé aux administrateurs.</p>
        <div className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input data-testid="admin-email-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input data-testid="admin-password-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button disabled={loading} type="submit" className="cta-primary rounded-none w-full h-12" data-testid="admin-login-btn">
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </div>
      </form>
    </div>
  );
}
