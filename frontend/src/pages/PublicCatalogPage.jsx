import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api, { API, imageUrl, formatINR } from "@/lib/api";
import { PUBLIC } from "@/constants/testIds";
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, ZoomIn, X,
  ShoppingBag, MessageSquare, Filter, ChevronDown, ChevronRight,
  Package, Star, Gift, Sparkles, Phone, Mail, MapPin, Clock, Building2,
  Grid3X3, List, Heart, ExternalLink, RotateCcw, Loader2, AlertCircle
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import ImageLightbox from "@/components/ImageLightbox";
import { useShortlist, ShortlistProvider } from "@/lib/shortlistContext";
import ShortlistDrawer from "@/components/ShortlistDrawer";
import EnquiryModal from "@/components/EnquiryModal";

const ITEMS_PER_PAGE = 12;

const BUDGET_TIERS = [
  "Under ₹500",
  "₹500 - ₹1,000",
  "₹1,000 - ₹2,000",
  "Above ₹2,000",
];

const OCCASIONS = [
  "Employee Onboarding",
  "Corporate Gifting",
  "Diwali & Festive",
  "Conferences & Events",
  "Executive & Leadership",
];

/* ---------- Lazy Image with placeholder & resilient API fallback ---------- */
function LazyImage({ src, alt, className, eager = false, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef(null);

  useEffect(() => {
    setCurrentSrc(src);
    setLoaded(false);
    setError(false);
  }, [src]);

  const handleError = () => {
    if (currentSrc && currentSrc.startsWith("/images/")) {
      const cleanPath = currentSrc.split("?")[0].replace(/^\/images\//, "");
      setCurrentSrc(`${API}/images/${cleanPath}`);
    } else {
      setError(true);
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-100" onClick={onClick}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 animate-pulse">
          <Package size={32} className="text-zinc-300" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400">
          <AlertCircle size={24} />
          <span className="text-[10px] mt-1">Image unavailable</span>
        </div>
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/* ---------- Filter Chip ---------- */
function FilterChip({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 border transition-all flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? "border-[#002FA7] text-[#002FA7] bg-[#002FA7]/5 font-medium"
          : "border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:bg-zinc-50"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] font-mono ${active ? "text-[#002FA7]" : "text-zinc-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ---------- Product Card ---------- */
function ProductCard({ product, index, onZoom, onQuote }) {
  const { addItem, items } = useShortlist();
  const isShortlisted = items.some((i) => i.code === product.code);
  const navigate = useNavigate();

  return (
    <article
      className="group bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-lg transition-all duration-300"
      data-testid={`product-card-${product.code}`}
    >
      {/* Image */}
      {product.image && (
        <button
          type="button"
          onClick={() =>
            onZoom({
              src: imageUrl(product.image),
              alt: product.code,
              caption: `${product.code} · ${product.name || product.set_type || ""}`,
            })
          }
          className="relative block w-full aspect-[4/3] overflow-hidden bg-white cursor-zoom-in group/img border-b border-zinc-100"
          data-testid={`product-image-${product.code}`}
          aria-label={`Enlarge image of ${product.name || product.code}`}
        >
          <LazyImage
            src={imageUrl(product.image) + `?v=${product.image}`}
            alt={product.name || product.code}
            className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
            eager={index < 6}
          />
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] uppercase tracking-wider font-mono px-2 py-1 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
            <ZoomIn size={11} /> Enlarge
          </span>
          {product.budget_tier && (
            <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-mono font-medium text-zinc-700 px-2 py-0.5 border border-zinc-200">
              {product.budget_tier}
            </span>
          )}
        </button>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-[#002FA7] bg-[#002FA7]/5 px-1.5 py-0.5">
                {product.code}
              </span>
              {product.category && (
                <span className="text-[10px] text-zinc-400 truncate hidden sm:inline">
                  {product.category}
                </span>
              )}
            </div>
            <h3
              className="font-display text-base font-medium mt-1.5 line-clamp-2 cursor-pointer hover:text-[#002FA7] transition-colors"
              onClick={() => navigate(`/catalog/${encodeURIComponent(product.code.replace(/\s+/g, '-'))}`)}
            >
              {product.name || product.set_type || product.code}
            </h3>
          </div>
        </div>

        {/* Items */}
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed line-clamp-2">
          {product.clean_items
            ? product.clean_items.join(" · ")
            : product.items}
        </p>

        {/* Price & MOQ row */}
        <div className="flex items-end justify-between mt-3 pt-3 border-t border-zinc-100">
          <div>
            <p className="font-display text-xl font-semibold text-zinc-900">
              {formatINR(product.oncost_price)}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              per set · MOQ {product.moq}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => addItem(product)}
              disabled={isShortlisted}
              className={`p-2 border transition-all ${
                isShortlisted
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                  : "border-zinc-300 text-zinc-500 hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-[#002FA7]/5"
              }`}
              title={isShortlisted ? "Already shortlisted" : "Add to shortlist"}
              aria-label={isShortlisted ? `${product.code} already shortlisted` : `Add ${product.code} to shortlist`}
            >
              {isShortlisted ? <Heart size={14} className="fill-emerald-600" /> : <Heart size={14} />}
            </button>
            <button
              onClick={() => onQuote(product)}
              className="px-3 py-2 bg-[#002FA7] hover:bg-[#001d6f] text-white text-[11px] font-medium uppercase tracking-wider transition-colors flex items-center gap-1"
              aria-label={`Request quote for ${product.code}`}
            >
              <MessageSquare size={12} />
              Quote
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------- Main Page ---------- */
function CatalogPageInner() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("code");
  const [zoom, setZoom] = useState(null);
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedOccasion, setSelectedOccasion] = useState("");

  const { count: shortlistCount, setIsOpen: setShortlistOpen } = useShortlist();

  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial URL params
  useEffect(() => {
    const cat = searchParams.get("category");
    const budget = searchParams.get("budget");
    const occasion = searchParams.get("occasion");
    const search = searchParams.get("q");
    if (cat) setSelectedCategory(cat);
    if (budget) setSelectedBudget(budget);
    if (occasion) setSelectedOccasion(occasion);
    if (search) setQ(search);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/public/products"),
      api.get("/public/categories"),
    ])
      .then(([prodRes, catRes]) => {
        setProducts(prodRes.data);
        setCategories(catRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Preserve referral tag
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) localStorage.setItem("oncost_ref", ref.toUpperCase());
    } catch {
      /* noop */
    }
  }, []);

  const activeFilterCount = [selectedCategory, selectedBudget, selectedOccasion].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSelectedCategory("");
    setSelectedBudget("");
    setSelectedOccasion("");
    setQ("");
    setSort("code");
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = products;

    // Text search
    if (s) {
      arr = arr.filter(
        (p) =>
          String(p.code ?? "").toLowerCase().includes(s) ||
          String(p.name ?? "").toLowerCase().includes(s) ||
          String(p.set_type ?? "").toLowerCase().includes(s) ||
          String(p.items ?? "").toLowerCase().includes(s) ||
          String(p.description ?? "").toLowerCase().includes(s) ||
          (p.clean_items && p.clean_items.some((ci) => ci.toLowerCase().includes(s)))
      );
    }

    // Category filter
    if (selectedCategory) {
      arr = arr.filter((p) => p.category === selectedCategory);
    }

    // Budget filter
    if (selectedBudget) {
      arr = arr.filter((p) => p.budget_tier === selectedBudget);
    }

    // Occasion filter
    if (selectedOccasion) {
      arr = arr.filter(
        (p) => p.occasions && p.occasions.includes(selectedOccasion)
      );
    }

    arr = [...arr];

    // Sort
    if (sort === "price_asc") {
      arr.sort((a, b) => (a.oncost_price || 0) - (b.oncost_price || 0));
    } else if (sort === "price_desc") {
      arr.sort((a, b) => (b.oncost_price || 0) - (a.oncost_price || 0));
    } else if (sort === "name") {
      arr.sort((a, b) =>
        String(a.name || a.set_type || "").localeCompare(
          String(b.name || b.set_type || "")
        )
      );
    } else {
      arr.sort((a, b) =>
        String(a?.code ?? "").localeCompare(String(b?.code ?? ""))
      );
    }

    return arr;
  }, [products, q, sort, selectedCategory, selectedBudget, selectedOccasion]);

  // Paginated products
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, sort, selectedCategory, selectedBudget, selectedOccasion]);

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }, [products]);

  const SortBtn = ({ value, label, icon: Icon }) => (
    <button
      onClick={() => setSort(value)}
      className={`text-xs px-3 py-1.5 border transition-all flex items-center gap-1.5 ${
        sort === value
          ? "border-[#002FA7] text-[#002FA7] bg-[#002FA7]/5 font-medium"
          : "border-zinc-300 text-zinc-600 hover:border-zinc-500"
      }`}
      aria-pressed={sort === value}
    >
      <Icon size={11} />
      {label}
    </button>
  );

  return (
    <div
      data-testid={PUBLIC.catalogContainer}
      className="min-h-screen bg-zinc-50"
    >
      {/* ===== NAVIGATION ===== */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-white/90 border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="logo-mark text-2xl text-zinc-900">ONCOST</span>
              <span className="overline text-[9px] text-[#002FA7] hidden sm:inline">
                catalog 2026
              </span>
            </Link>
            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-1 ml-4">
              <Link
                to="/catalog"
                className="text-xs font-medium text-[#002FA7] bg-[#002FA7]/5 px-3 py-1.5"
              >
                Catalog
              </Link>
              <a
                href="#about"
                className="text-xs text-zinc-600 hover:text-zinc-900 px-3 py-1.5 transition-colors"
              >
                About
              </a>
              <a
                href="#contact"
                className="text-xs text-zinc-600 hover:text-zinc-900 px-3 py-1.5 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, codes..."
                className="pl-9 pr-8 py-2 border border-zinc-300 text-sm w-40 sm:w-56 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7]/20 outline-none bg-zinc-50 focus:bg-white transition-colors"
                aria-label="Search catalog"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Shortlist Badge */}
            <button
              onClick={() => setShortlistOpen(true)}
              className="relative p-2 border border-zinc-300 hover:border-[#002FA7] hover:text-[#002FA7] text-zinc-600 transition-all"
              aria-label={`Open shortlist (${shortlistCount} items)`}
            >
              <ShoppingBag size={16} />
              {shortlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#002FA7] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {shortlistCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <p className="overline text-[#002FA7]">
                Corporate Gifting · 2026
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight mt-2 max-w-2xl text-zinc-900">
                Premium Corporate Gifting{" "}
                <span className="text-[#002FA7] font-medium">Made Simple.</span>
              </h1>
              <p className="text-zinc-500 mt-4 max-w-xl text-sm leading-relaxed">
                Discover {products.length} thoughtfully curated gift sets for
                every business occasion. Compare options, shortlist your
                favourites, and request customised quotations instantly.
              </p>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-2">
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Gift size={13} className="text-[#002FA7]" /> Custom Branding
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-[#002FA7]" /> PAN-India
                  Delivery
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-[#002FA7]" /> 10-15 Business
                  Days
                </span>
                <span className="flex items-center gap-1">
                  <Building2 size={13} className="text-[#002FA7]" /> GST Invoice
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FILTER BAR ===== */}
      <div className="sticky top-[53px] z-20 bg-white/95 backdrop-blur border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          {/* Top row: Result count + Sort + Filter toggle */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-xs text-zinc-500">
                <span className="font-mono font-bold text-zinc-900">
                  {filtered.length}
                </span>{" "}
                product{filtered.length !== 1 ? "s" : ""}
                {activeFilterCount > 0 && (
                  <span className="text-[#002FA7] ml-1">
                    · {activeFilterCount} filter
                    {activeFilterCount > 1 ? "s" : ""} applied
                  </span>
                )}
              </p>
              {(activeFilterCount > 0 || q) && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-zinc-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                  aria-label="Reset all filters"
                >
                  <RotateCcw size={11} /> Reset filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`text-xs px-3 py-1.5 border flex items-center gap-1.5 transition-all ${
                  showFilters || activeFilterCount > 0
                    ? "border-[#002FA7] text-[#002FA7] bg-[#002FA7]/5"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-500"
                }`}
                aria-expanded={showFilters}
              >
                <Filter size={12} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 bg-[#002FA7] text-white text-[9px] font-mono flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                <span className="overline text-[10px] mr-1">Sort</span>
                <SortBtn value="code" label="Code" icon={ArrowUpDown} />
                <SortBtn value="price_asc" label="Price ↑" icon={ArrowUp} />
                <SortBtn value="price_desc" label="Price ↓" icon={ArrowDown} />
                <SortBtn value="name" label="Name" icon={ArrowUpDown} />
              </div>
            </div>
          </div>

          {/* Filter Panel (expandable) */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-zinc-100 space-y-3 animate-fade-up">
              {/* Category */}
              <div>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Category
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    label="All"
                    active={!selectedCategory}
                    onClick={() => setSelectedCategory("")}
                    count={products.length}
                  />
                  {uniqueCategories.map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      active={selectedCategory === cat}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === cat ? "" : cat
                        )
                      }
                      count={categoryCounts[cat]}
                    />
                  ))}
                </div>
              </div>

              {/* Budget Tier */}
              <div>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Budget
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    label="Any Budget"
                    active={!selectedBudget}
                    onClick={() => setSelectedBudget("")}
                  />
                  {BUDGET_TIERS.map((tier) => (
                    <FilterChip
                      key={tier}
                      label={tier}
                      active={selectedBudget === tier}
                      onClick={() =>
                        setSelectedBudget(selectedBudget === tier ? "" : tier)
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Occasion */}
              <div>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Occasion
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterChip
                    label="All Occasions"
                    active={!selectedOccasion}
                    onClick={() => setSelectedOccasion("")}
                  />
                  {OCCASIONS.map((occ) => (
                    <FilterChip
                      key={occ}
                      label={occ}
                      active={selectedOccasion === occ}
                      onClick={() =>
                        setSelectedOccasion(
                          selectedOccasion === occ ? "" : occ
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Mobile Sort */}
              <div className="sm:hidden">
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Sort By
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <SortBtn value="code" label="Code" icon={ArrowUpDown} />
                  <SortBtn value="price_asc" label="Price ↑" icon={ArrowUp} />
                  <SortBtn
                    value="price_desc"
                    label="Price ↓"
                    icon={ArrowDown}
                  />
                  <SortBtn value="name" label="Name" icon={ArrowUpDown} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== PRODUCT GRID ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 size={32} className="animate-spin mb-3" />
            <p className="text-sm">Loading catalog...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Search size={32} className="mb-3 stroke-1" />
            <p className="font-medium text-zinc-700 text-sm">
              No products match your filters
            </p>
            <p className="text-xs mt-1 text-zinc-500 max-w-xs text-center">
              Try adjusting your search or filters. We have {products.length}{" "}
              products in the complete catalog.
            </p>
            <button
              onClick={resetFilters}
              className="mt-4 text-xs text-[#002FA7] hover:underline flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedProducts.map((p, idx) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  index={(page - 1) * ITEMS_PER_PAGE + idx}
                  onZoom={setZoom}
                  onQuote={setQuoteProduct}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10 pt-6 border-t border-zinc-200">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - page) <= 1) return true;
                      return false;
                    })
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="text-xs text-zinc-400 px-1">…</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 text-xs font-mono flex items-center justify-center border transition-colors ${
                            p === page
                              ? "border-[#002FA7] bg-[#002FA7] text-white"
                              : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-xs border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Price disclaimer */}
            <p className="text-[10px] text-zinc-400 text-center mt-6">
              All prices are exclusive of 18% GST and shipping charges. Custom
              branding included on MOQ orders. Volume discounts available on
              request.
            </p>
          </>
        )}
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section
        id="about"
        className="bg-white border-t border-zinc-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <p className="overline text-[#002FA7]">About ONCOST</p>
              <h2 className="font-display text-2xl sm:text-3xl font-medium mt-2 text-zinc-900">
                Premium Corporate &amp; Customized Gifting Solutions
              </h2>
              <p className="text-sm text-zinc-600 mt-4 leading-relaxed">
                ONCOST by Pragna Enterprises is your trusted partner for
                corporate gifting across India. We serve HR teams, procurement
                departments, event managers, and business leaders who need
                high-quality, customisable gift sets for every professional
                occasion — from employee onboarding and festive celebrations to
                executive recognition and conference giveaways.
              </p>
              <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
                Every product in our catalog is carefully sourced, quality-assured,
                and available with custom logo branding. We handle everything from
                design approval to PAN-India doorstep delivery with GST-compliant
                invoicing.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Curated Products", value: `${products.length}+`, icon: Package },
                { label: "Business Days", value: "10-15", icon: Clock },
                { label: "Custom Branding", value: "Included", icon: Sparkles },
                { label: "PAN-India", value: "Delivery", icon: MapPin },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 border border-zinc-200 bg-zinc-50"
                >
                  <stat.icon size={18} className="text-[#002FA7] mb-2" />
                  <p className="font-display text-xl font-semibold text-zinc-900">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTACT SECTION ===== */}
      <section
        id="contact"
        className="border-t border-zinc-200 bg-zinc-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center max-w-xl mx-auto">
            <p className="overline text-[#002FA7]">Get In Touch</p>
            <h2 className="font-display text-2xl sm:text-3xl font-medium mt-2 text-zinc-900">
              Ready to Order?
            </h2>
            <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
              Request a quotation through our catalog, or reach out directly.
              Our corporate gifting specialists respond within 2-4 business
              hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <a
                href="mailto:hello@oncostcatalog.in"
                className="px-5 py-2.5 bg-[#002FA7] hover:bg-[#001d6f] text-white text-xs font-medium uppercase tracking-wider flex items-center gap-2 transition-colors"
              >
                <Mail size={14} /> hello@oncostcatalog.in
              </a>
              <a
                href="https://wa.me/919999999999?text=Hi%20ONCOST%20team%2C%20I%20would%20like%20to%20enquire%20about%20corporate%20gifting."
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium uppercase tracking-wider flex items-center gap-2 transition-colors"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-white border-t border-zinc-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
            <div className="flex items-center gap-4">
              <span className="logo-mark text-lg text-zinc-900">ONCOST</span>
              <span className="font-mono">
                © {new Date().getFullYear()} Pragna Enterprises
              </span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <span>Hyderabad · Bengaluru · India</span>
              <span>·</span>
              <span>GSTIN Available on Request</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MODALS & OVERLAYS ===== */}
      {zoom && <ImageLightbox {...zoom} onClose={() => setZoom(null)} />}

      {quoteProduct && (
        <EnquiryModal
          isOpen={!!quoteProduct}
          onClose={() => setQuoteProduct(null)}
          product={quoteProduct}
        />
      )}

      <ShortlistDrawer />
    </div>
  );
}

/* ---------- Wrapped export with ShortlistProvider ---------- */
export default function PublicCatalogPage() {
  return (
    <ShortlistProvider>
      <CatalogPageInner />
    </ShortlistProvider>
  );
}
