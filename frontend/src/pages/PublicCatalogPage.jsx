import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api, { API, imageUrl, formatINR } from "@/lib/api";
import { PUBLIC } from "@/constants/testIds";
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, ZoomIn, X,
  ShoppingBag, MessageSquare, Filter, ChevronDown, ChevronRight,
  Package, Star, Gift, Sparkles, Phone, Mail, MapPin, Clock, Building2,
  Grid3X3, LayoutGrid, List, Heart, ExternalLink, RotateCcw, Loader2, AlertCircle,
  CheckCircle2, ShieldCheck, Truck, SlidersHorizontal, Eye, HelpCircle, ArrowRight
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import ImageLightbox from "@/components/ImageLightbox";
import { useShortlist } from "@/lib/shortlistContext";
import ShortlistDrawer from "@/components/ShortlistDrawer";
import EnquiryModal from "@/components/EnquiryModal";
import { BUNDLED_PRODUCTS, BUNDLED_CATEGORIES } from "@/data/catalogData";

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

const FAQS = [
  {
    q: "What is the Minimum Order Quantity (MOQ)?",
    a: "Standard MOQ across most sets is 50 units. For premium executive 6-in-1 and 7-in-1 sets, MOQ starts at 50 units, while select stationery sets have an MOQ of 100 units. For customized enterprise requests exceeding 500 units, volume tier discounts apply automatically."
  },
  {
    q: "Is custom logo branding included in the listed price?",
    a: "Yes! Single-location precision laser engraving or single-color UV printing is included on minimum order quantities (MOQ). Multi-color UV print, foil debossing on vegan leather, or bespoke box sleeve printing are available upon request."
  },
  {
    q: "Can we request physical samples before confirming a bulk order?",
    a: "Absolutely. We dispatch pre-production sample kits to corporate procurement and HR teams within 48 to 72 business hours. Sample charges are fully adjusted against your final bulk invoice."
  },
  {
    q: "What are your PAN-India delivery timelines?",
    a: "Standard delivery is 10 to 15 business days following digital artwork approval and advance confirmation. Expedited air transit options are available for urgent conferences and annual summit dates."
  },
  {
    q: "Do you provide GST-compliant invoices with Input Tax Credit (ITC)?",
    a: "Yes. All quotations and final billing are issued under Pragna Enterprises with verified GSTIN (18% HSN-compliant invoicing) for seamless business tax credit."
  }
];

/* ---------- Lazy Image with placeholder & resilient API fallback ---------- */
function LazyImage({ src, alt, className, eager = false, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retried, setRetried] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setCurrentSrc(src);
    setLoaded(false);
    setError(false);
    setRetried(false);
  }, [src]);

  const handleError = () => {
    if (retried) {
      setError(true);
      return;
    }
    setRetried(true);
    if (currentSrc && currentSrc.includes("/api/images/")) {
      const filename = currentSrc.split("/api/images/")[1]?.split("?")[0];
      setCurrentSrc(`/images/${filename}`);
    } else if (currentSrc) {
      const cleanPath = currentSrc.split("?")[0].replace(/^\/?(api\/)?images\//, "");
      setCurrentSrc(`${API}/images/${cleanPath}`);
    } else {
      setError(true);
    }
  };

  return (
    <div className="relative w-full h-full bg-zinc-50 flex items-center justify-center overflow-hidden" onClick={onClick}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/80 animate-pulse">
          <Package size={28} className="text-zinc-300 stroke-1" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400 p-2 text-center">
          <Package size={24} className="stroke-1 text-zinc-300 mb-1" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Preview Available</span>
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
        className={`${className} transition-all duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/* ---------- Filter Pill ---------- */
function FilterPill({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3.5 py-1.5 transition-all flex items-center gap-1.5 whitespace-nowrap border font-medium ${
        active
          ? "border-[#002FA7] text-[#002FA7] bg-[#002FA7]/8 shadow-sm font-semibold"
          : "border-zinc-200 text-zinc-600 bg-white hover:border-zinc-400 hover:text-zinc-900"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] font-mono px-1 py-0.2 ${active ? "bg-[#002FA7]/10 text-[#002FA7]" : "bg-zinc-100 text-zinc-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ---------- Product Card (Grid Mode) ---------- */
function ProductCard({ product, index, onZoom, onQuote }) {
  const { addItem, items } = useShortlist();
  const isShortlisted = items.some((i) => i.code === product.code);
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/catalog/${encodeURIComponent(product.code.replace(/\s+/g, '-'))}`);
  };

  const inclusionsList = product.clean_items && product.clean_items.length > 0
    ? product.clean_items
    : (product.items ? product.items.split(",").map(s => s.trim()) : []);

  return (
    <article
      className="group bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
      data-testid={`product-card-${product.code}`}
    >
      <div>
        {/* Image Frame */}
        <div className="relative block w-full aspect-[4/3] overflow-hidden bg-zinc-50 border-b border-zinc-100 group/img">
          {product.image ? (
            <LazyImage
              src={imageUrl(product.image) + `?v=${product.image}`}
              alt={product.name || product.code}
              className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105 cursor-pointer"
              eager={index < 8}
              onClick={handleCardClick}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-400">
              <Package size={36} className="stroke-1" />
            </div>
          )}

          {/* Top Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
            <span className="bg-zinc-900/90 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 tracking-wider">
              {product.code}
            </span>
            {product.budget_tier && (
              <span className="bg-white/95 backdrop-blur-md text-zinc-700 text-[10px] font-mono font-medium px-2 py-0.5 border border-zinc-200 shadow-sm">
                {product.budget_tier}
              </span>
            )}
          </div>

          {/* Quick Zoom Button */}
          {product.image && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onZoom({
                  src: imageUrl(product.image),
                  alt: product.code,
                  caption: `${product.code} · ${product.name || product.set_type || ""}`,
                });
              }}
              className="absolute bottom-2.5 right-2.5 bg-zinc-900/80 hover:bg-zinc-900 text-white text-[10px] uppercase tracking-wider font-mono px-2 py-1 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
              data-testid={`product-image-${product.code}`}
              aria-label={`Enlarge image of ${product.name || product.code}`}
            >
              <ZoomIn size={12} /> Zoom
            </button>
          )}

          {/* Shortlist Quick Toggle on Image */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addItem(product);
            }}
            disabled={isShortlisted}
            className={`absolute top-2.5 right-2.5 p-2 transition-all ${
              isShortlisted
                ? "bg-emerald-50 text-emerald-600 border border-emerald-300 opacity-100 shadow-sm"
                : "bg-white/90 hover:bg-white text-zinc-600 hover:text-[#002FA7] border border-zinc-200 opacity-0 group-hover:opacity-100 shadow-sm"
            }`}
            title={isShortlisted ? "In Shortlist" : "Add to Shortlist"}
            aria-label={isShortlisted ? `${product.code} already shortlisted` : `Add ${product.code} to shortlist`}
          >
            <Heart size={14} className={isShortlisted ? "fill-emerald-600" : ""} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
            <span className="font-mono uppercase tracking-wider text-zinc-400">
              {product.set_type_display || product.set_type || "Corporate Set"}
            </span>
            <span className="text-zinc-500">
              MOQ: <strong className="font-mono text-zinc-700">{product.moq || 50}</strong>
            </span>
          </div>

          <h3
            onClick={handleCardClick}
            className="font-display text-base font-medium text-zinc-900 line-clamp-2 hover:text-[#002FA7] transition-colors cursor-pointer"
          >
            {product.name || product.set_type || product.code}
          </h3>

          {/* Inclusions Chips */}
          <div className="mt-3 flex flex-wrap gap-1">
            {inclusionsList.slice(0, 3).map((item, i) => (
              <span
                key={i}
                className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200/80 px-2 py-0.5 truncate max-w-[200px]"
              >
                {item}
              </span>
            ))}
            {inclusionsList.length > 3 && (
              <span className="text-[10px] font-mono text-[#002FA7] bg-[#002FA7]/5 border border-[#002FA7]/15 px-1.5 py-0.5">
                +{inclusionsList.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing & Actions Footer */}
      <div className="p-4 sm:p-5 pt-0">
        <div className="pt-3 border-t border-zinc-100 flex items-baseline justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-400 tracking-wider">Reseller / Unit</span>
            <p className="font-display text-xl font-bold text-zinc-900 tracking-tight">
              {formatINR(product.oncost_price)}
            </p>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            excl. 18% GST
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onQuote(product)}
            className="w-full py-2 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
            aria-label={`Request quote for ${product.code}`}
          >
            <MessageSquare size={13} />
            Quote
          </button>
          <button
            onClick={handleCardClick}
            className="w-full py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-300 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
          >
            <Eye size={13} />
            Details
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------- Showcase / Bento Card (Detailed Mode) ---------- */
function BentoCard({ product, onZoom, onQuote }) {
  const { addItem, items } = useShortlist();
  const isShortlisted = items.some((i) => i.code === product.code);
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/catalog/${encodeURIComponent(product.code.replace(/\s+/g, '-'))}`);
  };

  const inclusionsList = product.clean_items && product.clean_items.length > 0
    ? product.clean_items
    : (product.items ? product.items.split(",").map(s => s.trim()) : []);

  return (
    <article
      className="bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-xl transition-all duration-300 grid grid-cols-1 md:grid-cols-12 overflow-hidden group"
      data-testid={`product-card-${product.code}`}
    >
      {/* Left: Image */}
      <div className="md:col-span-4 bg-zinc-50 relative aspect-[4/3] md:aspect-auto border-b md:border-b-0 md:border-r border-zinc-200 flex items-center justify-center p-6 cursor-pointer" onClick={handleCardClick}>
        <LazyImage
          src={imageUrl(product.image) + `?v=${product.image}`}
          alt={product.name || product.code}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 bg-zinc-900 text-white font-mono text-[10px] font-bold px-2 py-0.5">
          {product.code}
        </span>
        {product.image && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoom({
                src: imageUrl(product.image),
                alt: product.code,
                caption: `${product.code} · ${product.name || product.set_type || ""}`,
              });
            }}
            className="absolute bottom-3 right-3 bg-zinc-900/80 hover:bg-zinc-900 text-white text-[10px] uppercase font-mono px-2 py-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ZoomIn size={12} /> Zoom
          </button>
        )}
      </div>

      {/* Center: Details & Inclusions */}
      <div className="md:col-span-5 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#002FA7] bg-[#002FA7]/8 px-2 py-0.5 font-semibold">
              {product.category || "Corporate Gift Hampers"}
            </span>
            <span className="text-zinc-400 text-xs">·</span>
            <span className="text-[11px] font-mono text-zinc-500">
              {product.set_type_display || product.set_type}
            </span>
          </div>

          <h3
            onClick={handleCardClick}
            className="font-display text-xl font-medium text-zinc-900 hover:text-[#002FA7] transition-colors cursor-pointer"
          >
            {product.name || product.set_type || product.code}
          </h3>

          <p className="text-xs text-zinc-500 mt-2 leading-relaxed line-clamp-2">
            {product.description || "Crafted specifically for executive corporate gifting with custom logo branding and presentation box packaging."}
          </p>

          {/* Inclusions */}
          <div className="mt-4 pt-3 border-t border-zinc-100">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2">Package Inclusions</p>
            <div className="flex flex-wrap gap-1.5">
              {inclusionsList.map((item, idx) => (
                <span
                  key={idx}
                  className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 px-2.5 py-1 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={11} className="text-[#002FA7]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Sparkles size={13} className="text-[#002FA7]" /> Custom Branding Included</span>
          <span className="flex items-center gap-1"><Truck size={13} className="text-[#002FA7]" /> 10-15 Days PAN-India</span>
        </div>
      </div>

      {/* Right: Commercials & Action Column */}
      <div className="md:col-span-3 bg-zinc-50/70 p-6 border-t md:border-t-0 md:border-l border-zinc-200 flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Unit Reseller Price</span>
          <p className="font-display text-2xl font-bold text-zinc-900 tracking-tight mt-0.5">
            {formatINR(product.oncost_price)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            MOQ: <strong className="font-mono text-zinc-800">{product.moq} sets</strong>
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Est. order value: <span className="font-mono text-zinc-700">{formatINR((product.oncost_price || 0) * (product.moq || 50))}</span>
          </p>

          {product.budget_tier && (
            <div className="mt-3">
              <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-zinc-200 text-zinc-700">
                {product.budget_tier}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-6">
          <button
            onClick={() => onQuote(product)}
            className="w-full py-2.5 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <MessageSquare size={13} />
            Request Quote
          </button>
          <button
            onClick={() => addItem(product)}
            disabled={isShortlisted}
            className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
              isShortlisted
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300"
            }`}
          >
            <Heart size={13} className={isShortlisted ? "fill-emerald-600" : ""} />
            {isShortlisted ? "Shortlisted" : "Add to Shortlist"}
          </button>
          <button
            onClick={handleCardClick}
            className="w-full py-1 text-[11px] text-zinc-500 hover:text-zinc-900 hover:underline flex items-center justify-center gap-1"
          >
            View Full Specifications <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------- Procurement Table Mode ---------- */
function TableMode({ products, onQuote }) {
  const { addItem, items } = useShortlist();
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
            <th className="py-3 px-4">Code / SKU</th>
            <th className="py-3 px-4">Preview</th>
            <th className="py-3 px-4">Product Name &amp; Inclusions</th>
            <th className="py-3 px-4">Category</th>
            <th className="py-3 px-4">MOQ</th>
            <th className="py-3 px-4">Unit Price</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {products.map((p) => {
            const isShortlisted = items.some((i) => i.code === p.code);
            return (
              <tr key={p.code} className="hover:bg-zinc-50/80 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                  <span className="bg-zinc-100 text-[#002FA7] px-2 py-0.5 border border-zinc-200">
                    {p.code}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div
                    onClick={() => navigate(`/catalog/${encodeURIComponent(p.code.replace(/\s+/g, '-'))}`)}
                    className="w-12 h-12 bg-zinc-50 border border-zinc-200 p-1 flex items-center justify-center cursor-pointer hover:border-zinc-400"
                  >
                    <img src={imageUrl(p.image)} alt={p.code} className="w-full h-full object-contain" />
                  </div>
                </td>
                <td className="py-3 px-4 max-w-xs">
                  <p
                    onClick={() => navigate(`/catalog/${encodeURIComponent(p.code.replace(/\s+/g, '-'))}`)}
                    className="font-medium text-zinc-900 hover:text-[#002FA7] cursor-pointer text-sm"
                  >
                    {p.name || p.set_type || p.code}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {p.clean_items ? p.clean_items.join(" · ") : p.items}
                  </p>
                </td>
                <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">
                  {p.category || "Corporate Hamper"}
                </td>
                <td className="py-3 px-4 font-mono text-zinc-700 whitespace-nowrap">
                  {p.moq || 50}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="font-display font-semibold text-zinc-900 text-sm">
                    {formatINR(p.oncost_price)}
                  </span>
                  <span className="block text-[10px] text-zinc-400 font-mono">excl. GST</span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => addItem(p)}
                      disabled={isShortlisted}
                      className={`p-1.5 border transition-all ${
                        isShortlisted
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                          : "border-zinc-300 text-zinc-500 hover:border-[#002FA7] hover:text-[#002FA7]"
                      }`}
                      title={isShortlisted ? "In Shortlist" : "Add to Shortlist"}
                    >
                      <Heart size={14} className={isShortlisted ? "fill-emerald-600" : ""} />
                    </button>
                    <button
                      onClick={() => onQuote(p)}
                      className="px-3 py-1.5 bg-[#002FA7] hover:bg-[#002075] text-white text-[11px] font-semibold uppercase tracking-wider"
                    >
                      Quote
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Main Catalog Page Controller ---------- */
export default function PublicCatalogPage() {
  const [products, setProducts] = useState(BUNDLED_PRODUCTS);
  const [categories, setCategories] = useState(BUNDLED_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("code");
  const [zoom, setZoom] = useState(null);
  const [quoteProduct, setQuoteProduct] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'bento' | 'table'

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedOccasion, setSelectedOccasion] = useState("");

  const { count: shortlistCount, setIsOpen: setShortlistOpen } = useShortlist();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);

  // Read URL params
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

  // Global hotkey ⌘K for search focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch live products
  useEffect(() => {
    api.get("/public/products")
      .then((res) => {
        if (Array.isArray(res?.data) && res.data.length > 0) {
          setProducts(res.data);
        }
      })
      .catch((err) => {
        console.warn("Live products API unavailable, using bundled catalog:", err?.message);
      });

    api.get("/public/categories")
      .then((res) => {
        if (Array.isArray(res?.data) && res.data.length > 0) {
          setCategories(res.data);
        }
      })
      .catch((err) => {
        console.warn("Live categories API unavailable, using bundled categories:", err?.message);
      });

    // Referral preservation
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

    if (selectedCategory) {
      arr = arr.filter((p) => p.category === selectedCategory);
    }

    if (selectedBudget) {
      arr = arr.filter((p) => p.budget_tier === selectedBudget);
    }

    if (selectedOccasion) {
      arr = arr.filter(
        (p) => p.occasions && p.occasions.includes(selectedOccasion)
      );
    }

    arr = [...arr];

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

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [q, sort, selectedCategory, selectedBudget, selectedOccasion]);

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

  return (
    <div data-testid={PUBLIC.catalogContainer} className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col justify-between selection:bg-[#002FA7] selection:text-white">
      
      {/* ===== LUXURY TOP ANNOUNCEMENT BANNER ===== */}
      <div className="bg-[#09090B] text-zinc-300 text-[11px] font-mono py-2 px-4 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              2026 CORPORATE CATALOG ACTIVE
            </span>
            <span className="hidden sm:inline text-zinc-600">|</span>
            <span className="hidden sm:inline text-zinc-400">
              Custom Logo Laser Branding on all MOQ Orders
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <a
              href="tel:+919999999999"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <Phone size={11} className="text-[#002FA7]" /> +91-99999-99999
            </a>
            <span className="text-zinc-700">|</span>
            <Link to="/login" className="hover:text-white transition-colors">
              Reseller / Partner Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* ===== MAIN STICKY NAVIGATION BAR ===== */}
      <nav className="sticky top-0 z-40 glass-nav shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-baseline gap-2.5 group">
              <span className="logo-mark text-2xl text-zinc-900 group-hover:text-[#002FA7] transition-colors">
                ONCOST
              </span>
              <span className="overline text-[9px] text-[#002FA7] tracking-[0.25em]">
                EXECUTIVE
              </span>
            </Link>

            {/* Nav category anchors */}
            <div className="hidden lg:flex items-center gap-1 pl-4 border-l border-zinc-200">
              <button
                onClick={() => setSelectedCategory("")}
                className={`text-xs px-3 py-1.5 transition-colors ${!selectedCategory ? "text-[#002FA7] font-semibold bg-[#002FA7]/5" : "text-zinc-600 hover:text-zinc-900"}`}
              >
                All Sets ({products.length})
              </button>
              {uniqueCategories.slice(0, 3).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3 py-1.5 transition-colors ${selectedCategory === cat ? "text-[#002FA7] font-semibold bg-[#002FA7]/5" : "text-zinc-600 hover:text-zinc-900"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Right Action Center */}
          <div className="flex items-center gap-3">
            
            {/* Search Input with Hotkey Badge */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search catalog or SKU..."
                className="pl-9 pr-14 py-2 border border-zinc-300 text-xs w-44 sm:w-64 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7]/30 outline-none bg-white transition-all shadow-inner"
                aria-label="Search catalog"
              />
              {q ? (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="hidden sm:inline absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-400 bg-zinc-100 border border-zinc-200 px-1 py-0.5">
                  ⌘K
                </span>
              )}
            </div>

            {/* Shortlist Cart Button */}
            <button
              onClick={() => setShortlistOpen(true)}
              className="relative p-2.5 border border-zinc-300 hover:border-[#002FA7] hover:text-[#002FA7] text-zinc-700 bg-white transition-all flex items-center gap-2"
              aria-label={`Open shortlist (${shortlistCount} items)`}
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline text-xs font-semibold">Shortlist</span>
              {shortlistCount > 0 ? (
                <span className="w-5 h-5 bg-[#002FA7] text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse-subtle">
                  {shortlistCount}
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">0</span>
              )}
            </button>

            {/* Quick WhatsApp Concierge Button */}
            <a
              href="https://wa.me/919999999999?text=Hi%20ONCOST%20team%2C%20I%20would%20like%20to%20enquire%20about%20corporate%20gifting%20options."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20b857] text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-sm"
            >
              <MessageSquare size={13} />
              WhatsApp
            </a>
          </div>
        </div>
      </nav>

      {/* ===== EDITORIAL HERO SECTION ===== */}
      <header className="relative bg-white border-b border-zinc-200 overflow-hidden grid-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 border border-[#002FA7]/30 bg-[#002FA7]/5 px-3 py-1 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#002FA7]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] font-semibold text-[#002FA7]">
                  Corporate Gifting · 2026 Catalog Edition
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-zinc-950 leading-[1.08]">
                Bespoke Corporate Sets. <br className="hidden sm:inline" />
                <span className="font-semibold text-[#002FA7]">Precision Engineered.</span>
              </h1>

              <p className="text-zinc-600 mt-5 max-w-2xl text-sm sm:text-base leading-relaxed">
                Discover {products.length} thoughtfully designed executive hampers, insulated smart drinkware sets, and employee onboarding packages. Complete with laser logo branding, luxury gift box packaging, and verified Pan-India delivery.
              </p>

              {/* 4 Trust Value Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-8 border-t border-zinc-200">
                <div className="p-3 bg-white border border-zinc-200">
                  <Sparkles size={16} className="text-[#002FA7] mb-1.5" />
                  <p className="text-xs font-semibold text-zinc-900">Custom Branding</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Laser &amp; UV Screen</p>
                </div>
                <div className="p-3 bg-white border border-zinc-200">
                  <Truck size={16} className="text-[#002FA7] mb-1.5" />
                  <p className="text-xs font-semibold text-zinc-900">PAN-India Dispatch</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">10-15 Business Days</p>
                </div>
                <div className="p-3 bg-white border border-zinc-200">
                  <ShieldCheck size={16} className="text-[#002FA7] mb-1.5" />
                  <p className="text-xs font-semibold text-zinc-900">100% GST Compliant</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Input Tax Credit Eligible</p>
                </div>
                <div className="p-3 bg-white border border-zinc-200">
                  <Package size={16} className="text-[#002FA7] mb-1.5" />
                  <p className="text-xs font-semibold text-zinc-900">Physical Sampling</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Shipped in 48-72h</p>
                </div>
              </div>
            </div>

            {/* Right Hero High-Contrast Stat Box */}
            <div className="lg:col-span-4 bg-zinc-900 text-white p-7 lg:p-8 border border-zinc-800 shadow-2xl relative">
              <div className="grid-bg-dark absolute inset-0 opacity-40 pointer-events-none" />
              <div className="relative z-10">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#002FA7] bg-[#002FA7]/20 px-2 py-0.5 font-bold">
                  Commercials Overview
                </span>
                <p className="font-display text-2xl font-medium mt-3 text-white">
                  Reseller Direct Pricing
                </p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Transparent tiered pricing starting from ₹300 up to ₹2,750+ per unit set.
                </p>

                <div className="mt-6 space-y-3 font-mono text-xs border-t border-zinc-800 pt-5">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total Curated Sets</span>
                    <span className="text-white font-bold">{products.length} Sets</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Starting MOQ</span>
                    <span className="text-white font-bold">50 Units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Packaging Type</span>
                    <span className="text-white font-bold">Rigid Foam Box</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Sample Turnaround</span>
                    <span className="text-emerald-400 font-bold">Fast Track</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const el = document.getElementById("catalog-products");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full mt-6 py-3 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  Explore Complete Range <ArrowDown size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ===== STICKY FILTER & CONTROLS CONSOLE ===== */}
      <section
        id="catalog-products"
        className="sticky top-[61px] z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-sm transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          
          {/* Top Bar: Count + View Modes + Filter Toggle + Sort */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            
            {/* Products Count & Active Filter Indicator */}
            <div className="flex items-center gap-3">
              <p className="text-xs text-zinc-600">
                Showing <strong className="font-mono text-zinc-950 font-bold">{filtered.length}</strong> of {products.length} sets
                {activeFilterCount > 0 && (
                  <span className="text-[#002FA7] font-semibold ml-1.5">
                    ({activeFilterCount} active filter{activeFilterCount > 1 ? "s" : ""})
                  </span>
                )}
              </p>

              {(activeFilterCount > 0 || q) && (
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-zinc-500 hover:text-red-600 font-mono flex items-center gap-1 transition-colors border-b border-dashed border-zinc-300 hover:border-red-600"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            {/* Right Controls: View Switcher + Filter Toggle + Sort */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* View Modes */}
              <div className="hidden sm:flex items-center border border-zinc-200 bg-zinc-50 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-white text-[#002FA7] shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
                  title="Grid View"
                >
                  <Grid3X3 size={15} />
                </button>
                <button
                  onClick={() => setViewMode("bento")}
                  className={`p-1.5 transition-colors ${viewMode === "bento" ? "bg-white text-[#002FA7] shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
                  title="Detailed Bento View"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 transition-colors ${viewMode === "table" ? "bg-white text-[#002FA7] shadow-xs" : "text-zinc-500 hover:text-zinc-800"}`}
                  title="Procurement Table View"
                >
                  <List size={15} />
                </button>
              </div>

              {/* Filter Panel Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`text-xs px-3 py-1.5 border flex items-center gap-1.5 transition-all font-medium ${
                  showFilters || activeFilterCount > 0
                    ? "border-[#002FA7] text-[#002FA7] bg-[#002FA7]/8 font-semibold"
                    : "border-zinc-300 text-zinc-700 hover:border-zinc-500"
                }`}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal size={13} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 bg-[#002FA7] text-white text-[9px] font-mono flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort Selector */}
              <div className="flex items-center gap-1">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="text-xs py-1.5 px-2 border border-zinc-300 bg-white text-zinc-700 outline-none focus:border-[#002FA7]"
                  aria-label="Sort products"
                >
                  <option value="code">Sort by SKU (SG Code)</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Product Name (A-Z)</option>
                </select>
              </div>

            </div>

          </div>

          {/* Quick Categories Ribbon (Always visible) */}
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider mr-1 shrink-0">Category:</span>
            <FilterPill
              label="All Collections"
              active={!selectedCategory}
              onClick={() => setSelectedCategory("")}
              count={products.length}
            />
            {uniqueCategories.map((cat) => (
              <FilterPill
                key={cat}
                label={cat}
                active={selectedCategory === cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "" : cat)}
                count={categoryCounts[cat]}
              />
            ))}
          </div>

          {/* Expandable Secondary Filter Drawer */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-zinc-200/80 space-y-4 animate-fade-up bg-zinc-50/50 p-3 border">
              
              {/* Budget Tiers */}
              <div>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Target Price Bracket
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill
                    label="Any Budget"
                    active={!selectedBudget}
                    onClick={() => setSelectedBudget("")}
                  />
                  {BUDGET_TIERS.map((tier) => (
                    <FilterPill
                      key={tier}
                      label={tier}
                      active={selectedBudget === tier}
                      onClick={() => setSelectedBudget(selectedBudget === tier ? "" : tier)}
                    />
                  ))}
                </div>
              </div>

              {/* Corporate Occasions */}
              <div>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Business Occasion &amp; Use-Case
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <FilterPill
                    label="All Occasions"
                    active={!selectedOccasion}
                    onClick={() => setSelectedOccasion("")}
                  />
                  {OCCASIONS.map((occ) => (
                    <FilterPill
                      key={occ}
                      label={occ}
                      active={selectedOccasion === occ}
                      onClick={() => setSelectedOccasion(selectedOccasion === occ ? "" : occ)}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </section>

      {/* ===== PRODUCT DISPLAY SECTION ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-zinc-400">
            <Loader2 size={36} className="animate-spin text-[#002FA7] mb-3" />
            <p className="font-mono text-sm">Syncing latest product specifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-zinc-200 p-8 text-center">
            <Search size={40} className="stroke-1 text-zinc-300 mb-3" />
            <h3 className="font-display text-xl font-medium text-zinc-800">
              No product sets match your filters
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">
              We couldn&apos;t find sets matching your search criteria. You can clear the filters to view all {products.length} corporate items.
            </p>
            <button
              onClick={resetFilters}
              className="mt-5 px-5 py-2.5 bg-[#002FA7] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hover:bg-[#002075] transition-colors"
            >
              <RotateCcw size={13} /> View Complete Catalog
            </button>
          </div>
        ) : (
          <>
            {/* View Mode Switching */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedProducts.map((p, idx) => (
                  <ProductCard
                    key={p.code || p.id}
                    product={p}
                    index={(page - 1) * ITEMS_PER_PAGE + idx}
                    onZoom={setZoom}
                    onQuote={setQuoteProduct}
                  />
                ))}
              </div>
            )}

            {viewMode === "bento" && (
              <div className="space-y-6">
                {paginatedProducts.map((p) => (
                  <BentoCard
                    key={p.code || p.id}
                    product={p}
                    onZoom={setZoom}
                    onQuote={setQuoteProduct}
                  />
                ))}
              </div>
            )}

            {viewMode === "table" && (
              <TableMode
                products={paginatedProducts}
                onQuote={setQuoteProduct}
              />
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12 pt-8 border-t border-zinc-200">
                <button
                  onClick={() => {
                    setPage(Math.max(1, page - 1));
                    document.getElementById("catalog-products")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                          <span className="text-xs text-zinc-400 px-1 font-mono">…</span>
                        )}
                        <button
                          onClick={() => {
                            setPage(p);
                            document.getElementById("catalog-products")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className={`w-8 h-8 text-xs font-mono font-bold flex items-center justify-center border transition-colors ${
                            p === page
                              ? "border-[#002FA7] bg-[#002FA7] text-white"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 bg-white"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  onClick={() => {
                    setPage(Math.min(totalPages, page + 1));
                    document.getElementById("catalog-products")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-xs border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            <p className="text-[11px] text-zinc-400 text-center mt-6 font-mono">
              Prices exclude 18% GST and standard shipping. Custom branding included on minimum order quantity (MOQ).
            </p>
          </>
        )}
      </main>

      {/* ===== ENTERPRISE HOW IT WORKS & BRANDING TECHNIQUES ===== */}
      <section className="bg-white border-t border-zinc-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="overline text-[#002FA7]">Corporate Order Workflow</span>
            <h2 className="font-display text-3xl font-light text-zinc-950 mt-1">
              Seamless Procurement from <span className="font-semibold text-[#002FA7]">Selection to Delivery</span>
            </h2>
            <p className="text-zinc-500 text-sm mt-3 leading-relaxed">
              We make corporate gifting effortless for HR, marketing, and procurement teams with guaranteed turnarounds and digital proofs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Curate & Shortlist",
                desc: "Choose products from our catalog or request bespoke combinations matching your budget tier.",
              },
              {
                step: "02",
                title: "Digital Artwork Mockup",
                desc: "Send your company logo vector. We deliver accurate 2D/3D branding mockups within 4 hours.",
              },
              {
                step: "03",
                title: "Physical Sample Approval",
                desc: "We dispatch a finished pre-production sample kit to your office before bulk manufacturing begins.",
              },
              {
                step: "04",
                title: "PAN-India Bulk Dispatch",
                desc: "Packed in custom foam rigid boxes and delivered across single or multiple office locations with tracking.",
              },
            ].map((st) => (
              <div key={st.step} className="p-6 border border-zinc-200 bg-zinc-50/50 hover:bg-white hover:border-[#002FA7] transition-all">
                <span className="font-mono text-2xl font-bold text-[#002FA7] opacity-60">{st.step}</span>
                <h4 className="font-display text-base font-semibold text-zinc-900 mt-2">{st.title}</h4>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>

          {/* Branding Techniques Matrix */}
          <div className="mt-14 pt-12 border-t border-zinc-200">
            <h3 className="font-display text-xl font-medium text-zinc-900 text-center mb-8">
              Available Corporate Branding Technologies
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border border-zinc-200 bg-white">
                <p className="font-mono text-xs font-bold text-[#002FA7]">Laser Engraving</p>
                <p className="text-xs text-zinc-600 mt-1">Permanent high-definition metallic etch on stainless flasks, metal pens, and cardholders.</p>
              </div>
              <div className="p-4 border border-zinc-200 bg-white">
                <p className="font-mono text-xs font-bold text-[#002FA7]">UV Color Screen Print</p>
                <p className="text-xs text-zinc-600 mt-1">Vibrant multi-color logo reproduction with scratch-resistant cured inks for tech items.</p>
              </div>
              <div className="p-4 border border-zinc-200 bg-white">
                <p className="font-mono text-xs font-bold text-[#002FA7]">Blind &amp; Foil Debossing</p>
                <p className="text-xs text-zinc-600 mt-1">Indented texture and gold/silver metallic foil debossing on vegan leather journal covers.</p>
              </div>
              <div className="p-4 border border-zinc-200 bg-white">
                <p className="font-mono text-xs font-bold text-[#002FA7]">Bespoke Box Sleeves</p>
                <p className="text-xs text-zinc-600 mt-1">Full-bleed customized packaging outer sleeves with your corporate brand identity and messaging.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FREQUENTLY ASKED QUESTIONS ===== */}
      <section className="bg-zinc-50 border-t border-zinc-200 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="overline text-[#002FA7]">Answers For Procurement</span>
            <h2 className="font-display text-2xl sm:text-3xl font-light text-zinc-950 mt-1">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((item, idx) => (
              <div key={idx} className="bg-white border border-zinc-200 p-5 shadow-xs">
                <h4 className="font-display text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <span className="font-mono text-xs text-[#002FA7]">Q{idx + 1}.</span> {item.q}
                </h4>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed pl-6">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LUXURY FOOTER ===== */}
      <footer className="bg-zinc-950 text-white border-t border-zinc-800 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-zinc-800">
            
            {/* Col 1: Brand */}
            <div className="space-y-3">
              <span className="logo-mark text-2xl text-white">ONCOST</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pragna Enterprises corporate gifting division. Providing premium curated hampers, drinkware, and tech accessories with bespoke branding across India.
              </p>
              <div className="pt-2 text-xs font-mono text-zinc-500">
                GSTIN available on verified corporate invoices.
              </div>
            </div>

            {/* Col 2: Categories */}
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white mb-3">
                Key Collections
              </p>
              <ul className="space-y-2 text-xs text-zinc-400">
                {uniqueCategories.map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => {
                        setSelectedCategory(c);
                        document.getElementById("catalog-products")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="hover:text-white transition-colors"
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Portal Links */}
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white mb-3">
                Portals &amp; Resellers
              </p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li>
                  <Link to="/partners/register" className="hover:text-white transition-colors">
                    Become a Referral Partner
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Reseller / Partner Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Admin Management Console
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Corporate Contact */}
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white mb-3">
                Direct Corporate Desk
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bengaluru · Hyderabad · PAN-India Operations
              </p>
              <div className="mt-3 space-y-1.5 text-xs">
                <a
                  href="mailto:hello@oncostcatalog.in"
                  className="text-zinc-300 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Mail size={13} className="text-[#002FA7]" /> hello@oncostcatalog.in
                </a>
                <a
                  href="https://wa.me/919999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#25D366] hover:underline flex items-center gap-2"
                >
                  <MessageSquare size={13} /> Chat on WhatsApp (+91-99999-99999)
                </a>
              </div>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
            <p>© {new Date().getFullYear()} ONCOST · PRAGNA ENTERPRISES. All rights reserved.</p>
            <p>Running on Localhost · Client Data Protected</p>
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
