import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { imageUrl, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  LogOut, TrendingUp, Users, ShoppingBag, Coins, Award, Bell, User2, Copy, Handshake,
  ArrowRight, ExternalLink, ShieldCheck, Check, Sparkles, Layers, QrCode
} from "lucide-react";

const referralLink = (code) => {
  if (!code) return "";
  const base =
    process.env.REACT_APP_PUBLIC_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/refer/${code}`;
};

export default function PartnerDashboardPage() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [d, m] = await Promise.all([
          api.get("/partner/dashboard"),
          api.get("/partner/me"),
        ]);
        setData(d.data);
        setMe(m.data);
      } catch {
        toast.error("Could not load partner dashboard");
      }
    })();
  }, []);

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  const copy = (v, label) => {
    navigator.clipboard.writeText(v);
    setCopiedCode(label || v);
    toast.success(`Copied ${label || "code"} to clipboard`);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  if (!data || !me) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-10 text-zinc-500 font-mono text-xs">
        Loading partner intelligence console...
      </div>
    );
  }

  const p = me.partner || {};
  const t = data.totals || {};

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-[#002FA7] selection:text-white">
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="logo-mark text-2xl text-zinc-950">ONCOST</span>
              <span className="overline text-[9px] text-[#002FA7]">Partner Portal</span>
            </Link>

            {/* Nav anchors */}
            <nav className="hidden md:flex items-center gap-1 border-l border-zinc-200 pl-4 text-xs font-medium">
              <Link to="/partner/dashboard" className="px-3 py-1.5 text-[#002FA7] font-semibold bg-[#002FA7]/5">
                Dashboard
              </Link>
              <Link to="/partner/leads" className="px-3 py-1.5 text-zinc-600 hover:text-zinc-900 transition-colors">
                My Leads
              </Link>
              <Link to="/partner/commissions" className="px-3 py-1.5 text-zinc-600 hover:text-zinc-900 transition-colors">
                Commissions
              </Link>
              <Link to="/partner/profile" className="px-3 py-1.5 text-zinc-600 hover:text-zinc-900 transition-colors">
                Profile
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {p.photo ? (
                <img src={imageUrl(p.photo)} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-300" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-mono text-xs font-bold text-zinc-600">
                  {(p.full_name || me.user?.name || "P")[0]}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-zinc-900 leading-tight">{p.full_name || me.user?.name || me.user?.email}</p>
                <p className="text-[10px] text-zinc-500 font-mono">{p.employee_id || "Active Partner"}</p>
              </div>
            </div>

            <button
              onClick={onLogout}
              data-testid="partner-logout"
              className="text-xs text-zinc-500 hover:text-red-600 hover:bg-zinc-100 p-2 border border-zinc-200 transition-colors flex items-center gap-1"
              title="Sign Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Welcome Header */}
        <div className="border-b border-zinc-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="overline text-[#002FA7]">Executive Cockpit</span>
            <h1 className="font-display text-3xl sm:text-4xl font-light text-zinc-950 mt-1">
              Welcome, <span className="font-semibold text-zinc-950">{(p.full_name || "Partner").split(" ")[0]}</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              Role: <strong className="text-zinc-800">{me.role_label || "Corporate Referral Partner"}</strong> · Employee ID: <strong className="text-zinc-800">{p.employee_id || "—"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/catalog"
              target="_blank"
              className="px-4 py-2 border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag size={13} /> Browse Catalog <ExternalLink size={11} />
            </Link>
            <Link
              to="/partner/leads"
              className="px-4 py-2 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5"
            >
              <Handshake size={13} /> View Leads
            </Link>
          </div>
        </div>

        {/* 8-Metric KPI Grid */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Inbound Leads" value={t.total_leads} icon={Users} />
          <KpiCard label="Closed Deals" value={t.closed_leads} icon={TrendingUp} />
          <KpiCard label="Sales (Current Month)" value={t.sales_month} icon={ShoppingBag} money />
          <KpiCard label="Sales (Year to Date)" value={t.sales_year} icon={ShoppingBag} money />
          <KpiCard label="Commissions Earned" value={t.commission_earned} icon={Coins} money highlight />
          <KpiCard label="Pending Settlement" value={t.commission_pending} icon={Coins} money />
          <KpiCard label="Monthly Target" value={t.monthly_target} icon={Award} money />
          <KpiCard label="Leaderboard Rank" value={data.leaderboard_rank || "Top Tier"} icon={Award} />
        </div>

        {/* 2-Column Content: Referral Toolkit + Activity Notifications */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Referral Toolkit (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Codes Card */}
            <div className="bg-white border border-zinc-200 p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Official Partner Credentials
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Auto-Attributed Tracking</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CodeCell
                  label="Employee ID"
                  value={p.employee_id}
                  copy={() => copy(p.employee_id, "Employee ID")}
                  copied={copiedCode === "Employee ID"}
                />
                <CodeCell
                  label="Partner Internal Code"
                  value={p.partner_code}
                  copy={() => copy(p.partner_code, "Partner Code")}
                  copied={copiedCode === "Partner Code"}
                />
                <CodeCell
                  label="Public Referral Tag"
                  value={p.referral_code}
                  copy={() => copy(p.referral_code, "Referral Tag")}
                  copied={copiedCode === "Referral Tag"}
                  accent
                />
              </div>

              {/* Shareable Referral Card */}
              {p.referral_code && (
                <div className="mt-6 border border-emerald-300 bg-emerald-50/50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="overline text-[10px] text-emerald-800 font-bold">
                        Bespoke Referral Portal Link
                      </span>
                      <p className="mt-1 text-xs text-emerald-950/80 leading-relaxed max-w-xl">
                        Share this branded link with corporate HR and procurement heads. Inquiries submitted via this portal automatically attach to your profile and track commissions upon order confirmation.
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <code
                          data-testid="partner-referral-link"
                          className="font-mono text-xs bg-white border border-emerald-300 px-3 py-1.5 text-zinc-900 select-all"
                        >
                          {referralLink(p.referral_code)}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2.5 pt-3 border-t border-emerald-200/80">
                    <button
                      data-testid="partner-referral-copy"
                      onClick={() => copy(referralLink(p.referral_code), "Referral Link")}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {copiedCode === "Referral Link" ? <Check size={13} /> : <Copy size={13} />}
                      {copiedCode === "Referral Link" ? "Link Copied!" : "Copy Link"}
                    </button>
                    <a
                      data-testid="partner-referral-whatsapp"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Hi! I'm an executive partner with ONCOST — premium corporate gifting. Explore our 2026 curated catalog & share requirements directly: ${referralLink(p.referral_code)}`
                      )}`}
                      className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20b857] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Handshake size={13} /> Share on WhatsApp
                    </a>
                    <a
                      data-testid="partner-referral-preview"
                      target="_blank"
                      rel="noreferrer"
                      href={referralLink(p.referral_code)}
                      className="px-3.5 py-1.5 bg-white border border-emerald-300 hover:border-emerald-600 text-emerald-800 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      Preview Landing Page <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline Notice */}
            <div className="border border-zinc-200 bg-white p-5 flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-semibold text-zinc-900">Enterprise Commission Settlement Policy</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Commissions are computed and accrued immediately upon client advance receipt and delivered order confirmation.
                </p>
              </div>
              <Link to="/partner/commissions" className="text-xs text-[#002FA7] font-semibold hover:underline shrink-0 ml-4">
                View Ledger →
              </Link>
            </div>

          </div>

          {/* Right: Notifications & Quick Jumps (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white border border-zinc-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 pb-3">
                <Bell size={15} className="text-[#002FA7]" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Recent Announcements
                </h3>
              </div>

              {(data.notifications || []).length === 0 ? (
                <div className="py-8 text-center text-zinc-400">
                  <p className="text-xs font-mono">No active notifications</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Updates on payouts and leads will appear here.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.notifications.map((n, i) => (
                    <li key={i} className="border-l-2 border-[#002FA7] pl-3 py-1">
                      <p className="text-xs font-semibold text-zinc-900">{n.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 space-y-2 pt-4 border-t border-zinc-100">
                <Link
                  to="/partner/leads"
                  data-testid="partner-my-leads-cta"
                  className="w-full py-2.5 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-between px-4 transition-colors"
                >
                  <span className="flex items-center gap-2"><Handshake size={14} /> Open My Leads</span>
                  <ArrowRight size={13} />
                </Link>
                <Link
                  to="/partner/commissions"
                  data-testid="partner-commissions-cta"
                  className="w-full py-2.5 border border-zinc-300 hover:border-[#002FA7] text-zinc-800 text-xs font-semibold uppercase tracking-wider flex items-center justify-between px-4 transition-colors"
                >
                  <span className="flex items-center gap-2"><Coins size={14} /> My Commissions Ledger</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

function KpiCard({ label, value, icon: Icon, money, highlight }) {
  const display = money ? formatINR(value || 0) : String(value || 0);
  return (
    <div className={`p-4 border transition-all ${
      highlight ? "border-[#002FA7] bg-[#002FA7]/5" : "border-zinc-200 bg-white"
    }`}>
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon size={13} className={highlight ? "text-[#002FA7]" : "text-zinc-400"} />
        <span className="overline text-[10px] text-zinc-500">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold mt-2 text-zinc-950 tracking-tight">
        {display}
      </p>
    </div>
  );
}

function CodeCell({ label, value, copy, copied, accent }) {
  return (
    <div className={`border p-3.5 transition-colors ${
      accent ? "border-emerald-300 bg-emerald-50/60" : "border-zinc-200 bg-white"
    }`}>
      <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-zinc-900 break-all">{value || "—"}</span>
        {value && (
          <button
            onClick={copy}
            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
