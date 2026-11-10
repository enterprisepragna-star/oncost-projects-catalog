import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AUTH } from "@/constants/testIds";
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, Building2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

function formatErr(detail) {
  if (!detail) return "Login failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || "").join(" ").trim();
  return String(detail);
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("admin@oncostcatalog.in");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const u = await login(identifier, password);
      toast.success("Welcome back to ONCOST");
      const role = u?.role || "admin";
      nav(role === "admin" || role === "super_admin" ? "/admin" : "/partner/dashboard");
    } catch (e) {
      setErr(formatErr(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const fillAdminDemo = () => {
    setIdentifier("admin@oncostcatalog.in");
    setPassword("admin123");
    toast.info("Filled admin demo credentials");
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-zinc-900 selection:bg-[#002FA7] selection:text-white">
      
      {/* Left Brand Showcase (5 cols on large screens) */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-[#09090B] text-white p-12 relative overflow-hidden">
        <div className="grid-bg-dark absolute inset-0 opacity-40 pointer-events-none" />
        
        {/* Top */}
        <div className="relative z-10">
          <Link to="/catalog" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-8 font-mono">
            <ChevronLeft size={14} /> Return to Public Catalog
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#002FA7]" />
            <span className="overline text-[#002FA7] tracking-[0.25em]">CORPORATE RESELLER CONSOLE</span>
          </div>
          <h1 className="font-display text-6xl font-light tracking-tight mt-3 text-white">
            ONCOST
          </h1>
          <p className="mt-4 text-zinc-400 text-sm leading-relaxed max-w-sm">
            The enterprise procurement console for executive corporate gifts, custom laser branding, and partner margins.
          </p>
        </div>

        {/* Center Pillars */}
        <div className="relative z-10 space-y-4 my-8">
          <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
            {[
              { num: "01", title: "Catalog", sub: "90+ Sets" },
              { num: "02", title: "Quotes", sub: "Instant PDF" },
              { num: "03", title: "OPMS", sub: "Partner Engine" },
            ].map((col) => (
              <div key={col.num} className="bg-[#09090B] p-4">
                <span className="font-mono text-[10px] text-zinc-500 font-bold">{col.num}</span>
                <p className="font-display text-base font-semibold text-white mt-1">{col.title}</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{col.sub}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white/5 border border-white/10 text-xs text-zinc-300 flex items-start gap-3">
            <ShieldCheck size={18} className="text-[#002FA7] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Strict Data Privacy &amp; Localhost Execution. Enterprise quotation formulas &amp; dealer margins are encrypted.
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 text-xs text-zinc-500 font-mono flex items-center justify-between border-t border-zinc-800 pt-4">
          <span>Pragna Enterprises</span>
          <span>Bengaluru · Hyderabad</span>
        </div>
      </div>

      {/* Right Login Form (7 cols on large screens) */}
      <div className="lg:col-span-7 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-md mx-auto">
          
          <div className="lg:hidden mb-6">
            <Link to="/catalog" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-mono">
              <ChevronLeft size={14} /> Back to Catalog
            </Link>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-[#002FA7] font-bold uppercase tracking-wider bg-[#002FA7]/8 px-2 py-0.5">
              Secure Access
            </span>
            <span className="text-zinc-300">·</span>
            <span className="text-xs text-zinc-400 font-mono">Console v2.0</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950 mt-1">
            Sign In to Console
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm mt-2 leading-relaxed">
            Enter your administrator email or Partner Employee ID to manage quotations, products, and commissions.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {/* Identifier input */}
            <div>
              <label className="overline text-[10px] text-zinc-600 block mb-1.5">
                Email Address or Employee ID
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  data-testid={AUTH.loginEmail}
                  required
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7]/30 text-xs sm:text-sm outline-none transition-all bg-white"
                  placeholder="admin@oncostcatalog.in or ONCOST-EMP-0001"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                Partners can sign in with their assigned Employee ID.
              </p>
            </div>

            {/* Password input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="overline text-[10px] text-zinc-600">Password</label>
                <Link
                  to="/forgot-password"
                  data-testid="login-forgot-password"
                  className="text-[11px] text-[#002FA7] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  data-testid={AUTH.loginPassword}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7]/30 text-xs sm:text-sm outline-none transition-all bg-white"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error Feedback */}
            {err && (
              <div className="border border-red-200 bg-red-50 text-red-700 text-xs p-3 font-mono">
                {err}
              </div>
            )}

            {/* Submit Button */}
            <button
              data-testid={AUTH.loginSubmit}
              disabled={busy}
              type="submit"
              className="w-full bg-[#002FA7] hover:bg-[#002075] text-white py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
            >
              {busy ? "Authenticating…" : (<>Sign In to Console <ArrowRight size={14} /></>)}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-8 pt-6 border-t border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-zinc-400 font-bold">Localhost Quick Fill:</span>
              <button
                type="button"
                onClick={fillAdminDemo}
                className="text-[11px] text-[#002FA7] hover:underline font-mono font-semibold"
              >
                Fill Admin Credentials
              </button>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 font-mono space-y-1">
              <p>Email: <strong className="text-zinc-900">admin@oncostcatalog.in</strong></p>
              <p>Password: <strong className="text-zinc-900">admin123</strong> (or env config)</p>
            </div>
          </div>

          {/* Registration link */}
          <p className="text-xs text-zinc-500 mt-6 leading-relaxed">
            Interested in representing ONCOST as a corporate gifting partner?{" "}
            <Link to="/partners/register" className="text-[#002FA7] font-semibold hover:underline">
              Apply to become a partner →
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
}
