import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { API, imageUrl, formatINR } from "@/lib/api";
import {
  ArrowLeft, MessageSquare, Heart, ShieldCheck, Truck, Sparkles,
  Package, ZoomIn, CheckCircle2, ChevronRight, Share2, AlertCircle, Loader2, Phone, Mail,
  Calculator, FileText, Check, Copy, ExternalLink, HelpCircle
} from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import EnquiryModal from "@/components/EnquiryModal";
import ShortlistDrawer from "@/components/ShortlistDrawer";
import { useShortlist } from "@/lib/shortlistContext";
import { BUNDLED_PRODUCTS } from "@/data/catalogData";

export default function PublicProductDetailPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const initialProduct = BUNDLED_PRODUCTS.find(
    (p) => norm(p.code) === norm(code) || norm(p.name) === norm(code) || p.id === code
  ) || null;

  const initialRelated = initialProduct
    ? BUNDLED_PRODUCTS.filter(
        (p) => p.code !== initialProduct.code &&
        (p.category === initialProduct.category || p.budget_tier === initialProduct.budget_tier)
      ).slice(0, 4)
    : [];

  const [product, setProduct] = useState(initialProduct);
  const [related, setRelated] = useState(initialRelated);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("inclusions");

  // Interactive quantity calculator state
  const [quantity, setQuantity] = useState(initialProduct?.moq || 50);

  const { addItem, items, setIsOpen: setShortlistOpen, count: shortlistCount } = useShortlist();
  const isShortlisted = product && items.some((i) => i.code === product.code);

  useEffect(() => {
    if (!code) return;

    if (initialProduct) {
      setProduct(initialProduct);
      setRelated(initialRelated);
      setQuantity(initialProduct.moq || 50);
      setLoading(false);
      document.title = `${initialProduct.name || initialProduct.code} | ONCOST Corporate Gifting`;
    } else {
      setLoading(true);
    }
    setError(null);

    Promise.all([
      api.get(`/public/products/${encodeURIComponent(code)}`).catch(() => ({ data: null })),
      api.get("/public/products").catch(() => ({ data: [] }))
    ])
      .then(([detailRes, allRes]) => {
        let pData = detailRes?.data;
        let allList = Array.isArray(allRes?.data) && allRes.data.length > 0 ? allRes.data : BUNDLED_PRODUCTS;

        if (!pData) {
          pData = allList.find((p) => norm(p.code) === norm(code) || norm(p.name) === norm(code) || p.id === code);
        }

        if (!pData && !initialProduct) {
          setError("Product not found or currently unavailable.");
          return;
        }

        if (pData) {
          setProduct(pData);
          setQuantity(pData.moq || 50);
          const rel = allList
            .filter(
              (p) =>
                p.code !== pData.code &&
                (p.category === pData.category || p.budget_tier === pData.budget_tier)
            )
            .slice(0, 4);
          setRelated(rel);
          document.title = `${pData.name || pData.code} | ONCOST Corporate Gifting`;
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch live product detail:", err?.message);
        if (!initialProduct) {
          setError("Product not found or currently unavailable.");
        }
      })
      .finally(() => setLoading(false));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume tier pricing computation
  const basePrice = product?.oncost_price || 0;
  const volumeDiscountPercent = useMemo(() => {
    if (quantity >= 500) return 10;
    if (quantity >= 250) return 5;
    return 0;
  }, [quantity]);

  const effectiveUnitPrice = useMemo(() => {
    if (volumeDiscountPercent > 0) {
      return Math.round(basePrice * (1 - volumeDiscountPercent / 100));
    }
    return basePrice;
  }, [basePrice, volumeDiscountPercent]);

  const subtotal = effectiveUnitPrice * quantity;
  const estimatedGst = Math.round(subtotal * 0.18);
  const totalWithGst = subtotal + estimatedGst;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || product?.code,
        text: `Explore ${product?.name || product?.code} corporate gift set on ONCOST`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const whatsappMessage = product
    ? encodeURIComponent(
        `Hi ONCOST team, I would like to request a quotation for:\n` +
        `Product: ${product.code} - ${product.name || product.set_type}\n` +
        `Required Quantity: ${quantity} units\n` +
        `Product Link: ${window.location.href}\n` +
        `Please confirm sample availability and timeline.`
      )
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-zinc-500">
        <Loader2 size={36} className="animate-spin text-[#002FA7] mb-3" />
        <p className="font-mono text-sm">Loading executive specifications...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h1 className="text-2xl font-display font-semibold text-zinc-900 mb-2">Product Not Found</h1>
        <p className="text-sm text-zinc-500 max-w-md mb-6">{error || "The product set you requested is not available in our catalog."}</p>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#002FA7] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#002075] transition-colors"
        >
          <ArrowLeft size={16} /> Return to Catalog
        </Link>
      </div>
    );
  }

  const inclusionsList = product.clean_items && product.clean_items.length > 0
    ? product.clean_items
    : (product.items ? product.items.split(",").map(s => s.trim()) : []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 selection:bg-[#002FA7] selection:text-white flex flex-col justify-between">
      
      {/* ===== TOP NAVIGATION BAR ===== */}
      <nav className="sticky top-0 z-40 glass-nav shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-[#002FA7] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Catalog
            </Link>
            <span className="text-zinc-300">|</span>
            <Link to="/" className="flex items-baseline gap-2">
              <span className="logo-mark text-xl text-zinc-900">ONCOST</span>
              <span className="overline text-[9px] text-[#002FA7]">2026</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="p-2 border border-zinc-200 bg-white hover:border-zinc-400 text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1.5 text-xs"
              title="Share or Copy Link"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
              <span className="hidden sm:inline">{copied ? "Link Copied!" : "Share"}</span>
            </button>

            <button
              onClick={() => setShortlistOpen(true)}
              className="relative p-2 border border-zinc-300 hover:border-[#002FA7] hover:text-[#002FA7] text-zinc-700 bg-white transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <Heart size={14} className={isShortlisted ? "fill-emerald-600 text-emerald-600" : ""} />
              <span className="hidden sm:inline">Shortlist</span>
              {shortlistCount > 0 && (
                <span className="w-4 h-4 bg-[#002FA7] text-white text-[9px] font-mono flex items-center justify-center">
                  {shortlistCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ===== BREADCRUMB BAR ===== */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 text-xs text-zinc-500 overflow-x-auto whitespace-nowrap">
          <Link to="/catalog" className="hover:text-zinc-900">Catalog</Link>
          <ChevronRight size={12} className="text-zinc-300" />
          <Link to={`/catalog?category=${encodeURIComponent(product.category || "")}`} className="hover:text-zinc-900">
            {product.category || "Corporate Hampers"}
          </Link>
          <ChevronRight size={12} className="text-zinc-300" />
          <span className="font-mono text-zinc-900 font-bold">{product.code}</span>
        </div>
      </div>

      {/* ===== PRODUCT SHOWCASE HERO ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* LEFT: IMAGE & GALLERY (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative aspect-[4/3] bg-white border border-zinc-200 p-6 flex items-center justify-center group overflow-hidden shadow-sm">
              <img
                src={imageUrl(product.image) + `?v=${product.image}`}
                alt={product.name || product.code}
                className="w-full h-full object-contain cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
                onClick={() => setZoom({
                  src: imageUrl(product.image),
                  alt: product.code,
                  caption: `${product.code} · ${product.name || product.set_type}`,
                })}
              />

              {/* Badges on Image */}
              <div className="absolute top-3 left-3 flex flex-col gap-1">
                <span className="bg-zinc-950 text-white font-mono text-[10px] font-bold px-2.5 py-1 tracking-wider shadow-sm">
                  {product.code}
                </span>
                {product.budget_tier && (
                  <span className="bg-white/95 backdrop-blur-md text-zinc-700 font-mono text-[10px] font-semibold px-2 py-0.5 border border-zinc-200 shadow-xs">
                    {product.budget_tier}
                  </span>
                )}
              </div>

              {/* Zoom Trigger Button */}
              <button
                onClick={() => setZoom({
                  src: imageUrl(product.image),
                  alt: product.code,
                  caption: `${product.code} · ${product.name || product.set_type}`,
                })}
                className="absolute bottom-3 right-3 bg-zinc-900/80 hover:bg-zinc-900 text-white text-[10px] uppercase font-mono px-2.5 py-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ZoomIn size={13} /> Click to Enlarge
              </button>
            </div>

            {/* Quick Guarantees Pill Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-white border border-zinc-200">
                <Sparkles size={16} className="text-[#002FA7] mx-auto mb-1" />
                <p className="font-semibold text-zinc-900 text-[11px]">Free Branding</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">On All MOQ Sets</p>
              </div>
              <div className="p-3 bg-white border border-zinc-200">
                <Truck size={16} className="text-[#002FA7] mx-auto mb-1" />
                <p className="font-semibold text-zinc-900 text-[11px]">10-15 Days</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">PAN-India Dispatch</p>
              </div>
              <div className="p-3 bg-white border border-zinc-200">
                <ShieldCheck size={16} className="text-[#002FA7] mx-auto mb-1" />
                <p className="font-semibold text-zinc-900 text-[11px]">GST 18% ITC</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Full Tax Invoicing</p>
              </div>
            </div>
          </div>

          {/* RIGHT: COMMERCIAL DETAILS & PROCUREMENT CALCULATOR (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Header Titles */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#002FA7] bg-[#002FA7]/8 px-2.5 py-0.5 font-bold">
                  {product.category || "Corporate Gift Hampers"}
                </span>
                <span className="text-zinc-300">·</span>
                <span className="text-xs font-mono text-zinc-500">
                  {product.set_type_display || product.set_type || "Corporate Hamper"}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-medium text-zinc-950 tracking-tight">
                {product.name || product.set_type || product.code}
              </h1>

              <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
                {product.description || "A meticulously curated executive corporate gift ensemble featuring premium materials, precision protective foam inserts, and bespoke logo branding."}
              </p>
            </div>

            {/* INTERACTIVE PROCUREMENT CALCULATOR */}
            <div className="bg-white border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-[#002FA7]" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Procurement Cost &amp; Volume Calculator
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Live Estimates</span>
              </div>

              {/* Quantity Preset Steppers */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label className="font-semibold text-zinc-700">Order Quantity (Units):</label>
                  <span className="font-mono text-zinc-500">Minimum Order: {product.moq || 50}</span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {[50, 100, 250, 500, 1000].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setQuantity(qty)}
                      className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                        quantity === qty
                          ? "border-[#002FA7] bg-[#002FA7] text-white font-bold"
                          : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {qty} units
                    </button>
                  ))}
                  <div className="flex items-center border border-zinc-300 ml-auto">
                    <input
                      type="number"
                      min={product.moq || 50}
                      step={10}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 50))}
                      className="w-24 px-2 py-1.5 text-xs font-mono text-right outline-none"
                    />
                    <span className="px-2 text-xs text-zinc-400 font-mono bg-zinc-50 border-l border-zinc-300">
                      units
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Price Breakdown Grid */}
              <div className="mt-5 p-4 bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Standard Base Price</span>
                  <span className="text-zinc-700">{formatINR(basePrice)} / set</span>
                </div>

                {volumeDiscountPercent > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 font-bold">
                    <span>Volume Tier Discount ({volumeDiscountPercent}%)</span>
                    <span>- {formatINR(basePrice - effectiveUnitPrice)} / set</span>
                  </div>
                )}

                <div className="flex justify-between items-center font-semibold pt-1 border-t border-zinc-200">
                  <span className="text-zinc-800">Effective Unit Price</span>
                  <span className="text-[#002FA7] text-sm">{formatINR(effectiveUnitPrice)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-zinc-600">
                  <span>Subtotal ({quantity} sets)</span>
                  <span>{formatINR(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-zinc-500">
                  <span>Estimated 18% GST</span>
                  <span>{formatINR(estimatedGst)}</span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t-2 border-zinc-900 font-sans">
                  <span className="font-bold text-zinc-900 text-sm">Estimated Total (incl. GST)</span>
                  <span className="font-display text-2xl font-bold text-zinc-950">{formatINR(totalWithGst)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="py-3 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare size={15} />
                  Request Official Quotation
                </button>

                <button
                  onClick={() => addItem(product, quantity)}
                  disabled={isShortlisted}
                  className={`py-3 text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                    isShortlisted
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 shadow-xs"
                  }`}
                >
                  <Heart size={15} className={isShortlisted ? "fill-emerald-600" : ""} />
                  {isShortlisted ? "Item in Shortlist" : "Add to Shortlist"}
                </button>
              </div>

              {/* Instant WhatsApp Link */}
              <div className="mt-3">
                <a
                  href={`https://wa.me/919999999999?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-[#25D366] hover:bg-[#20b857] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageSquare size={14} />
                  Discuss with Specialist on WhatsApp
                </a>
              </div>

            </div>

          </div>

        </div>

        {/* ===== DETAILED SPECIFICATIONS TABS ===== */}
        <section className="mt-14 pt-10 border-t border-zinc-200">
          <div className="flex items-center gap-2 border-b border-zinc-200 overflow-x-auto no-scrollbar pb-px">
            {[
              { id: "inclusions", label: `Included Items (${inclusionsList.length})` },
              { id: "branding", label: "Branding Capabilities" },
              { id: "packaging", label: "Packaging & Protection" },
              { id: "compliance", label: "Commercial Terms & GST" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-5 text-xs font-medium uppercase tracking-wider border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "border-[#002FA7] text-[#002FA7] font-bold bg-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-zinc-200 border-t-0 p-6 sm:p-8">
            
            {/* Inclusions Tab */}
            {activeTab === "inclusions" && (
              <div className="space-y-4 animate-fade-up">
                <h3 className="font-display text-lg font-medium text-zinc-900">
                  Items Comprising this Corporate Set:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {inclusionsList.map((item, idx) => (
                    <div key={idx} className="p-4 bg-zinc-50 border border-zinc-200 flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#002FA7]/10 text-[#002FA7] font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900">{item}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Corporate Grade Component</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Branding Tab */}
            {activeTab === "branding" && (
              <div className="space-y-4 animate-fade-up">
                <h3 className="font-display text-lg font-medium text-zinc-900">
                  Custom Corporate Branding Specs
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
                  {product.branding_options || "Laser Engraving, UV Screen Printing, Custom Foil Debossing"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 border border-zinc-200 bg-zinc-50">
                    <p className="font-mono text-xs font-bold text-zinc-900">Metallic Etching</p>
                    <p className="text-xs text-zinc-500 mt-1">High-contrast fiber laser etching on drinkware, metal pens, and visiting card cases.</p>
                  </div>
                  <div className="p-4 border border-zinc-200 bg-zinc-50">
                    <p className="font-mono text-xs font-bold text-zinc-900">Foil Debossing</p>
                    <p className="text-xs text-zinc-500 mt-1">Imprinted heat deboss on hardcover executive journals with optional gold or silver foil.</p>
                  </div>
                  <div className="p-4 border border-zinc-200 bg-zinc-50">
                    <p className="font-mono text-xs font-bold text-zinc-900">Digital Artwork Proof</p>
                    <p className="text-xs text-zinc-500 mt-1">Receive high-resolution scale digital mockups within 4 hours of sending your logo vector.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Packaging Tab */}
            {activeTab === "packaging" && (
              <div className="space-y-4 animate-fade-up">
                <h3 className="font-display text-lg font-medium text-zinc-900">
                  Presentation Packaging &amp; Transit Safety
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
                  {product.packaging_type || "Premium Matte Gift Box with Precision Protective Foam Cutouts"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-zinc-50 border border-zinc-200">
                    <p className="font-mono text-xs font-bold text-zinc-900">High-Density EVA Foam</p>
                    <p className="text-xs text-zinc-500 mt-1">Each item rests securely in laser-cut precision foam pockets, preventing damage during Pan-India courier transit.</p>
                  </div>
                  <div className="p-4 bg-zinc-50 border border-zinc-200">
                    <p className="font-mono text-xs font-bold text-zinc-900">Outer Transit Master Carton</p>
                    <p className="text-xs text-zinc-500 mt-1">Sets are bundled into 5-ply corrugated export-grade cartons with corner protectors for safe logistics.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === "compliance" && (
              <div className="space-y-4 animate-fade-up">
                <h3 className="font-display text-lg font-medium text-zinc-900">
                  Commercial Terms &amp; Invoicing
                </h3>
                <div className="space-y-2 text-xs text-zinc-600">
                  <p>• <strong>Tax Invoicing:</strong> Issued by Pragna Enterprises with official GSTIN (18% Goods &amp; Services Tax).</p>
                  <p>• <strong>Payment Terms:</strong> 50% advance upon digital artwork signoff; balance prior to dispatch or on delivery for approved corporate accounts.</p>
                  <p>• <strong>Delivery Lead Time:</strong> Standard dispatch within 10-15 business days. Express shipping available upon request.</p>
                  <p>• <strong>Physical Samples:</strong> Shipped via air courier within 48-72 business hours upon request.</p>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* ===== RELATED PRODUCTS ===== */}
        {related.length > 0 && (
          <section className="mt-16 pt-10 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="overline text-[#002FA7]">Curated Recommendations</span>
                <h2 className="font-display text-2xl font-medium text-zinc-900 mt-0.5">
                  Frequently Paired Corporate Sets
                </h2>
              </div>
              <Link to="/catalog" className="text-xs font-medium text-[#002FA7] hover:underline flex items-center gap-1">
                View All Catalog <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {related.map((rel) => (
                <div
                  key={rel.code}
                  onClick={() => navigate(`/catalog/${encodeURIComponent(rel.code.replace(/\s+/g, '-'))}`)}
                  className="bg-white border border-zinc-200 hover:border-zinc-400 p-4 transition-all hover:shadow-lg cursor-pointer group"
                >
                  <div className="w-full aspect-[4/3] bg-zinc-50 p-3 mb-3 border border-zinc-100 flex items-center justify-center">
                    <img src={imageUrl(rel.image)} alt={rel.code} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <span className="text-[10px] font-mono text-[#002FA7] font-bold">{rel.code}</span>
                  <h4 className="font-display text-sm font-medium text-zinc-900 truncate mt-0.5 group-hover:text-[#002FA7]">
                    {rel.name || rel.set_type}
                  </h4>
                  <p className="font-display text-base font-bold text-zinc-900 mt-2">
                    {formatINR(rel.oncost_price)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* ===== FOOTER ===== */}
      <footer className="bg-zinc-950 text-white border-t border-zinc-800 py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 font-mono gap-4">
          <div className="flex items-center gap-3">
            <span className="logo-mark text-lg text-white">ONCOST</span>
            <span>© {new Date().getFullYear()} Pragna Enterprises</span>
          </div>
          <p>Localhost Preview · All Commercial Data Protected</p>
        </div>
      </footer>

      {/* Lightbox & Modals */}
      {zoom && <ImageLightbox {...zoom} onClose={() => setZoom(null)} />}

      {quoteOpen && (
        <EnquiryModal
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          product={{ ...product, quantity }}
        />
      )}

      <ShortlistDrawer />
    </div>
  );
}
