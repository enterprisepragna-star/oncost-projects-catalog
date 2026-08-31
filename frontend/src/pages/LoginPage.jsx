import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AUTH } from "@/constants/testIds";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function formatErr(detail) {
  if (!detail) return "Login failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || "").join(" ").trim();
  return String(detail);
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("admin@oncostcatalog.in");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await login(identifier, password);
      toast.success("Welcome to ONCOST");
      const role = u?.role || "admin";
      nav(role === "admin" || role === "super_admin" ? "/admin" : "/partner/dashboard");
    } catch (e) {
      setErr(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#09090B] text-white p-12 relative">
        <div className="grid-bg absolute inset-0 opacity-20" />
        <div className="relative z-10">
          <p className="overline text-white/70">est. 2026</p>
          <h1 className="font-display text-7xl font-light mt-3">ONCOST</h1>
          <p className="mt-4 text-white/70 text-sm max-w-xs">
            The reseller console for premium corporate gift sets. Manage your catalog, set
            margins, ship quotations.
          </p>
        </div>
        <div className="relative z-10">
          <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
            {["Catalog", "Rules", "Quotes"].map((t, i) => (
              <div key={t} className="bg-[#09090B] p-4">
                <p className="overline text-white/60">{`0${i + 1}`}</p>
                <p className="mt-1 font-display text-xl">{t}</p>
              </div>
            ))}
          </div>
          <p className="tag-strip text-white/50 mt-6">ONCOST • Bengaluru • India</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <p className="overline">Admin sign in</p>
          <h2 className="font-display text-4xl font-medium mt-2 tracking-tight">
            Welcome back.
          </h2>
          <p className="text-zinc-500 text-sm mt-2">
            Enter your credentials to manage products & quotations.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="overline text-[10px]">Email or Employee ID</label>
              <div className="mt-2 relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  data-testid={AUTH.loginEmail}
                  required
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-zinc-300 focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/20 text-sm outline-none transition-all"
                  placeholder="admin@oncostcatalog.in  or  ONCOST-EMP-0001"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">Partners can sign in with their Employee ID.</p>
            </div>
            <div>
              <label className="overline text-[10px]">Password</label>
              <div className="mt-2 relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  data-testid={AUTH.loginPassword}
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-zinc-300 focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/20 text-sm outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="mt-2 text-right">
                <a
                  href="/forgot-password"
                  data-testid="login-forgot-password"
                  className="text-[11px] text-[#002FA7] hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            {err && (
              <div className="border border-red-200 bg-red-50 text-red-700 text-xs p-3">
                {err}
              </div>
            )}

            <button
              data-testid={AUTH.loginSubmit}
              disabled={busy}
              type="submit"
              className="w-full bg-[#002FA7] hover:bg-[#002277] text-white py-3 flex items-center justify-center gap-2 text-sm font-medium transition-all disabled:opacity-50"
            >
              {busy ? "Signing in…" : (<>Sign in <ArrowRight size={14} /></>)}
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 mt-8 leading-relaxed">
            Not a partner yet?{" "}
            <a href="/partners/register" className="text-[#002FA7] underline">
              Apply to join the ONCOST network →
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
