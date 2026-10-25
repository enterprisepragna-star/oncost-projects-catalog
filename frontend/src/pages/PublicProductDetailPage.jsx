import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api, { imageUrl, formatINR } from "@/lib/api";
import {
  ArrowLeft, MessageSquare, Heart, ShieldCheck, Truck, Sparkles,
  Package, ZoomIn, CheckCircle2, ChevronRight, Share2, AlertCircle, Loader2, Phone, Mail
} from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import EnquiryModal from "@/components/EnquiryModal";
import ShortlistDrawer from "@/components/ShortlistDrawer";
import { useShortlist, ShortlistProvider } from "@/lib/shortlistContext";

function ProductDetailInner() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { addItem, items } = useShortlist();
  const isShortlisted = product && items.some((i) => i.code === product.code);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);

    // Fetch product detail and all products for related items
    Promise.all([
      api.get(`/public/products/${encodeURIComponent(code)}`),
      api.get("/public/products")
    ])
      .then(([detailRes, allRes]) => {
        setProduct(detailRes.data);
        const rel = (allRes.data || [])
          .filter(
            (p) =>
              p.code !== detailRes.data.code &&
              (p.category === detailRes.data.category || p.budget_tier === detailRes.data.budget_tier)
          )
          .slice(0, 4);
        setRelated(rel);
        
        // Update document title for SEO
        document.title = `${detailRes.data.name || detailRes.data.code} | ONCOST Corporate Gifting`;
      })
      .catch((err) => {
        console.error("Failed to fetch product:", err);
        setError("Product not found or currently unavailable.");
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || product?.code,
        text: `Check out ${product?.name || product?.code} corporate gift set on ONCOST`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const whatsappUrl = product
    ? `https://wa.me/919999999999?text=${encodeURIComponent(
        `Hi ONCOST team, I would like to enquire about Product ${product.code} - ${product.name || product.set_type}. Quantity required: ~${product.moq} sets. Link: ${window.location.href}`
      )}`
    : "#";

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-zinc-500">
        <Loader2 size={36} className="animate-spin text-[#002FA7] mb-3" />
        <p className="font-mono text-sm">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h1 className="text-2xl font-display font-semibold text-zinc-900 mb-2">Product Not Found</h1>
        <p className="text-sm text-zinc-500 max-w-md mb-6">{error || "The product you requested could not be located in our catalog."}</p>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#002FA7] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#001d6f] transition-colors"
        >
          <ArrowLeft size={16} /> Back to Catalog
        </Link>
      </div>
    );
  }

  // Schema.org Product structured data
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name || product.code,
    "image": [imageUrl(product.image)],
    "description": product.description || product.items,
    "sku": product.code,
    "mpn": product.code,
    "brand": {
      "@type": "Brand",
      "name": "ONCOST"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": product.oncost_price,
      "priceValidUntil": "2027-12-31",
      "availability": "https://schema.org/InStock",
      "url": window.location.href
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      {/* Top utility banner */}
      <div className="bg-zinc-900 text-zinc-300 text-xs py-2 px-4 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] tracking-wide">
            <span className="flex items-center gap-1.5 text-zinc-100 font-medium">
              <ShieldCheck size={13} className="text-emerald-400" />
              Pan-India Corporate Fulfillment
            </span>
            <span className="hidden sm:inline text-zinc-500">|</span>
            <span className="hidden sm:inline text-zinc-400">Custom Logo Engraving & Embossing</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <a href="mailto:hello@oncostcatalog.in" className="hover:text-white transition-colors flex items-center gap-1">
              <Mail size={12} /> hello@oncostcatalog.in
            </a>
            <a
              href="https://wa.me/919999999999?text=Hi%20ONCOST%20team%2C%20I%20have%20a%20corporate%20gifting%20enquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#25D366] hover:underline font-mono"
            >
              WhatsApp Support
            </a>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/catalog"
              className="p-2 -ml-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-sm transition-colors flex items-center gap-1 text-xs"
              title="Return to Catalog"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline font-mono">Catalog</span>
            </Link>
            <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
            <Link to="/catalog" className="flex items-baseline gap-2">
              <span className="logo-mark text-2xl font-bold tracking-tight text-[#002FA7]">ONCOST</span>
              <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase hidden md:inline">
                · Executive Gifting
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="p-2 border border-zinc-200 hover:border-zinc-400 text-zinc-600 hover:text-zinc-900 text-xs flex items-center gap-1.5 transition-colors"
              title="Share this product"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline font-mono text-[11px]">{copied ? "Copied Link!" : "Share"}</span>
            </button>
            <button
              onClick={() => setQuoteOpen(true)}
              className="px-4 py-2 bg-[#002FA7] hover:bg-[#001d6f] text-white text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare size={14} />
              <span>Request Quote</span>
            </button>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <li>
            <Link to="/catalog" className="hover:text-[#002FA7] transition-colors">Catalog</Link>
          </li>
          <li><ChevronRight size={12} className="text-zinc-300" /></li>
          {product.category && (
            <>
              <li>
                <Link to={`/catalog?category=${encodeURIComponent(product.category)}`} className="hover:text-[#002FA7] transition-colors truncate max-w-[150px] inline-block">
                  {product.category}
                </Link>
              </li>
              <li><ChevronRight size={12} className="text-zinc-300" /></li>
            </>
          )}
          <li className="text-zinc-900 font-semibold truncate max-w-[200px]">
            {product.code}
          </li>
        </ol>
      </nav>

      {/* Main Product Showcase Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Image with Zoom */}
          <div className="lg:col-span-6 xl:col-span-7">
            <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden sticky top-24">
              <div
                className="relative aspect-[4/3] bg-zinc-50 flex items-center justify-center cursor-zoom-in group"
                onClick={() =>
                  setZoom({
                    src: imageUrl(product.image),
                    alt: product.name || product.code,
                    caption: `${product.code} · ${product.name || product.set_type}`,
                  })
                }
              >
                <img
                  src={imageUrl(product.image)}
                  alt={product.name || product.code}
                  className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                />
                <button
                  type="button"
                  className="absolute bottom-4 right-4 bg-black/75 hover:bg-black text-white text-xs px-3 py-1.5 font-mono flex items-center gap-1.5 backdrop-blur-sm transition-all"
                  aria-label="Enlarge product image"
                >
                  <ZoomIn size={14} /> Enlarge Preview
                </button>
                {product.budget_tier && (
                  <span className="absolute top-4 left-4 bg-white/95 text-zinc-900 text-xs font-mono font-medium px-2.5 py-1 border border-zinc-200 shadow-sm">
                    {product.budget_tier}
                  </span>
                )}
              </div>

              {/* Quality & Fulfillment badges below image */}
              <div className="grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100 p-4 bg-zinc-50/50 text-center">
                <div className="p-2">
                  <Package size={18} className="mx-auto text-zinc-600 mb-1" />
                  <p className="text-[11px] font-semibold text-zinc-800">Gift Packaging</p>
                  <p className="text-[10px] text-zinc-500">Matte box & foam cutout</p>
                </div>
                <div className="p-2">
                  <Sparkles size={18} className="mx-auto text-[#002FA7] mb-1" />
                  <p className="text-[11px] font-semibold text-zinc-800">Custom Branding</p>
                  <p className="text-[10px] text-zinc-500">Laser & UV printing</p>
                </div>
                <div className="p-2">
                  <Truck size={18} className="mx-auto text-emerald-600 mb-1" />
                  <p className="text-[11px] font-semibold text-zinc-800">Pan-India Ship</p>
                  <p className="text-[10px] text-zinc-500">Direct office delivery</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Product Info & Actions */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between">
            <div>
              {/* Product Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-[#002FA7] bg-[#002FA7]/10 px-2.5 py-1 rounded-sm">
                  {product.code}
                </span>
                {product.set_type_display && (
                  <span className="font-mono text-xs bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-sm">
                    {product.set_type_display} COMBO
                  </span>
                )}
                {product.category && (
                  <span className="text-xs text-zinc-500 border border-zinc-200 px-2.5 py-1 rounded-sm">
                    {product.category}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight leading-tight">
                {product.name || product.set_type || product.code}
              </h1>

              {/* Price Banner */}
              <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl sm:text-4xl font-bold text-zinc-900">
                    {formatINR(product.oncost_price)}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    per set / unit
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={14} />
                  <span>Minimum Order Quantity (MOQ): {product.moq} sets</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed border-t border-zinc-200/60 pt-2 font-mono">
                  {product.price_disclaimer || "Prices are exclusive of 18% GST and shipping. Custom logo engraving/printing included on MOQ."}
                </p>
              </div>

              {/* CTA Action Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="w-full py-3.5 bg-[#002FA7] hover:bg-[#001d6f] text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow"
                >
                  <MessageSquare size={16} />
                  <span>Request Custom Quotation</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageSquare size={15} /> WhatsApp Quote
                  </a>
                  <button
                    onClick={() => addItem(product)}
                    disabled={isShortlisted}
                    className={`py-3 border text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      isShortlisted
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
                        : "border-zinc-300 text-zinc-700 hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-[#002FA7]/5"
                    }`}
                  >
                    <Heart size={15} className={isShortlisted ? "fill-emerald-600 text-emerald-600" : ""} />
                    <span>{isShortlisted ? "Shortlisted" : "Add to Shortlist"}</span>
                  </button>
                </div>
              </div>

              {/* Inclusions / Clean Items list */}
              <div className="mt-8 border-t border-zinc-200 pt-6">
                <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">
                  Included Set Components ({product.clean_items ? product.clean_items.length : "Full Ensemble"})
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(product.clean_items || (product.items ? product.items.split(",") : [])).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-zinc-700 bg-zinc-50 p-2.5 border border-zinc-100 rounded-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#002FA7] shrink-0" />
                      <span className="font-medium">{item.trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Branding, Delivery & Packaging Specifications */}
              <div className="mt-6 border-t border-zinc-200 pt-6 space-y-4">
                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Custom Branding Methods
                  </h4>
                  <p className="text-xs text-zinc-700 mt-1 leading-relaxed">
                    {product.branding_options || "Laser Engraving, UV Screen Printing, Custom Foil Debossing"}
                  </p>
                </div>

                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Indicative Delivery Timeframe
                  </h4>
                  <p className="text-xs text-zinc-700 mt-1 leading-relaxed">
                    {product.indicative_delivery || "7-12 business days following artwork sample approval (Pan-India express dispatch)"}
                  </p>
                </div>

                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                    Packaging Standard
                  </h4>
                  <p className="text-xs text-zinc-700 mt-1 leading-relaxed">
                    {product.packaging_type || "Premium Rigid Matte Gift Box with Precision Protective Foam Cutouts"}
                  </p>
                </div>

                {product.occasions && product.occasions.length > 0 && (
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
                      Recommended Occasions
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {product.occasions.map((occ, i) => (
                        <span key={i} className="text-[11px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-sm">
                          {occ}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Assistance Card */}
            <div className="mt-8 p-4 bg-zinc-50 border border-zinc-200 rounded-sm flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-zinc-900">Need 200+ sets or custom color matching?</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Talk to our enterprise corporate gifting managers directly.</p>
              </div>
              <a
                href="mailto:hello@oncostcatalog.in"
                className="shrink-0 px-3 py-2 bg-white border border-zinc-300 hover:border-zinc-500 text-xs font-mono font-medium text-zinc-800 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>

        {/* Related Products Carousel / Grid */}
        {related.length > 0 && (
          <section className="mt-16 pt-12 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[#002FA7]">Curated Recommendations</span>
                <h2 className="font-display text-xl font-semibold text-zinc-900 mt-1">Similar Executive Gift Sets</h2>
              </div>
              <Link to="/catalog" className="text-xs font-mono text-[#002FA7] hover:underline flex items-center gap-1">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((rel) => (
                <article
                  key={rel.code}
                  className="bg-white border border-zinc-200 hover:border-zinc-400 hover:shadow-md transition-all p-3 cursor-pointer group"
                  onClick={() => navigate(`/catalog/${encodeURIComponent(rel.code.replace(/\s+/g, '-'))}`)}
                >
                  <div className="aspect-[4/3] bg-zinc-50 mb-3 flex items-center justify-center overflow-hidden">
                    <img
                      src={imageUrl(rel.image)}
                      alt={rel.name || rel.code}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#002FA7] bg-[#002FA7]/5 px-1 py-0.5">
                    {rel.code}
                  </span>
                  <h4 className="font-display text-xs font-medium text-zinc-900 mt-1 line-clamp-1 group-hover:text-[#002FA7]">
                    {rel.name || rel.set_type}
                  </h4>
                  <p className="font-display text-sm font-bold text-zinc-900 mt-1">
                    {formatINR(rel.oncost_price)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-900 text-zinc-400 py-12 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
            <div className="flex items-center gap-3">
              <span className="logo-mark text-xl font-bold text-white tracking-tight">ONCOST</span>
              <span className="text-zinc-600">|</span>
              <span className="font-mono text-[11px] text-zinc-400">© {new Date().getFullYear()} Pragna Enterprises</span>
            </div>
            <p className="font-mono text-[11px] text-zinc-500">
              Corporate Gifting & Fulfillment Specialists · Hyderabad · Bengaluru · Pan-India
            </p>
          </div>
        </div>
      </footer>

      {/* Lightbox & Modal overlays */}
      {zoom && <ImageLightbox {...zoom} onClose={() => setZoom(null)} />}
      {quoteOpen && (
        <EnquiryModal
          isOpen={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          product={product}
        />
      )}
      <ShortlistDrawer />
    </div>
  );
}

export default function PublicProductDetailPage() {
  return (
    <ShortlistProvider>
      <ProductDetailInner />
    </ShortlistProvider>
  );
}
