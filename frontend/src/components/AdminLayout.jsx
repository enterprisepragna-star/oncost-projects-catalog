import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ADMIN, AUTH } from "@/constants/testIds";
import {
  Boxes, Package, Receipt, Settings2, LogOut, PlusSquare, Layers, Menu, X,
  CheckCircle2, FolderTree, Percent, UserPlus, Handshake, Coins, Wallet, Sparkles,
  ExternalLink, ShieldCheck, ChevronRight
} from "lucide-react";

const NavItem = ({ to, label, icon: Icon, testid, onClick }) => {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      onClick={onClick}
      data-testid={testid}
      className={`group flex items-center justify-between px-4 py-2.5 transition-all text-xs font-medium border-l-2 ${
        active
          ? "bg-[#002FA7] text-white border-white font-semibold shadow-xs"
          : "border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={15} strokeWidth={active ? 2.2 : 1.7} className={active ? "text-white" : "text-zinc-400 group-hover:text-zinc-700"} />
        <span className="tracking-tight">{label}</span>
      </div>
      {active && <ChevronRight size={12} className="text-white/70" />}
    </Link>
  );
};

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const onLogout = async () => {
    await logout();
    nav("/login");
  };
  const closeMobile = () => setMobileOpen(false);

  const sidebar = (
    <>
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-zinc-200 flex items-center justify-between bg-white">
        <Link to="/admin" onClick={closeMobile} className="flex items-baseline gap-2">
          <span className="logo-mark text-2xl text-zinc-950">ONCOST</span>
          <span className="overline text-[9px] text-[#002FA7] font-bold">Admin OS</span>
        </Link>
        <button onClick={closeMobile} className="lg:hidden p-1.5 hover:bg-zinc-100 text-zinc-500" aria-label="Close menu">
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-2 bg-zinc-100/70 border-b border-zinc-200 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span>ENVIRONMENT: LOCALHOST</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-6">
        <div>
          <p className="overline px-5 mb-2 text-[10px] text-zinc-400 font-bold">Catalog Operations</p>
          <NavItem to="/admin/products" label="Products &amp; Inventory" icon={Package} testid={ADMIN.navProducts} onClick={closeMobile} />
          <NavItem to="/admin/categories" label="Categories Taxonomy" icon={FolderTree} testid="nav-categories" onClick={closeMobile} />
          <NavItem to="/admin/pricing-rule" label="Pricing Rules &amp; Margins" icon={Settings2} testid={ADMIN.navPricing} onClick={closeMobile} />
          <NavItem to="/admin/discount" label="Discount Schedules" icon={Percent} testid="nav-discount" onClick={closeMobile} />
        </div>

        <div>
          <p className="overline px-5 mb-2 text-[10px] text-zinc-400 font-bold">Quotations &amp; Sales</p>
          <NavItem to="/admin/quotations/new" label="Draft New Quotation" icon={PlusSquare} testid={ADMIN.navNewQuote} onClick={closeMobile} />
          <NavItem to="/admin/quotations" label="All Quotations" icon={Receipt} testid={ADMIN.navQuotations} onClick={closeMobile} />
          <NavItem to="/admin/sales" label="Accepted Commercial Deals" icon={CheckCircle2} testid="nav-sales" onClick={closeMobile} />
        </div>

        <div>
          <p className="overline px-5 mb-2 text-[10px] text-zinc-400 font-bold">OPMS · Partner Network</p>
          <NavItem to="/admin/opms/partners" label="Partner Directory" icon={UserPlus} testid="nav-partners" onClick={closeMobile} />
          <NavItem to="/admin/opms/leads" label="Enterprise Leads Pipeline" icon={Handshake} testid="nav-leads" onClick={closeMobile} />
          <NavItem to="/admin/opms/commission-rules" label="Commission Rules" icon={Percent} testid="nav-commission-rules" onClick={closeMobile} />
          <NavItem to="/admin/opms/commissions" label="Payout Ledger" icon={Wallet} testid="nav-commissions" onClick={closeMobile} />
          <NavItem to="/admin/opms/incentives" label="Partner Incentives" icon={Sparkles} testid="nav-incentives" onClick={closeMobile} />
        </div>

        <div>
          <p className="overline px-5 mb-2 text-[10px] text-zinc-400 font-bold">Public Storefront</p>
          <NavItem to="/catalog" label="Launch Public Catalog" icon={Boxes} testid="nav-public-catalog" onClick={closeMobile} />
        </div>
      </nav>

      {/* User Footer Profile */}
      <div className="border-t border-zinc-200 p-4 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-[#002FA7] text-white flex items-center justify-center font-bold text-xs font-mono">
            {user?.email?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-900 truncate">{user?.name || "Administrator"}</p>
            <p className="text-[11px] text-zinc-500 truncate font-mono">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          data-testid={AUTH.logoutBtn}
          className="w-full flex items-center justify-center gap-2 border border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition-all"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50 text-zinc-900 selection:bg-[#002FA7] selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-zinc-200 bg-zinc-50/70 flex-col">
        {sidebar}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={closeMobile} />
          <aside className="relative w-[280px] bg-white border-r border-zinc-200 flex flex-col shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top Navbar */}
        <header className="border-b border-zinc-200 px-5 lg:px-8 py-3.5 bg-white flex items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-zinc-100 text-zinc-600"
              aria-label="Open navigation menu"
              data-testid="admin-mobile-menu"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <Layers size={13} className="text-[#002FA7]" />
              <span className="hidden sm:inline">ONCOST / Administration Console</span>
              <span className="sm:hidden font-display text-sm font-bold text-zinc-900">ONCOST Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Localhost Isolated
            </span>
            <a
              href="/catalog"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-[#002FA7] hover:underline flex items-center gap-1"
            >
              Open Catalog <ExternalLink size={12} />
            </a>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-5 lg:p-8 max-w-[1400px] w-full mx-auto animate-fade-up flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
