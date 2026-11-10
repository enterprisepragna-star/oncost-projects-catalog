import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { imageUrl, formatINR } from "@/lib/api";
import { PUBLIC } from "@/constants/testIds";
import { Printer, FileDown, Calendar, MapPin, User2, Hash, Mail, ZoomIn, ShieldCheck, CheckCircle2, MessageSquare, Building2, Phone } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

const MetaItem = ({ icon: Icon, label, value, mono = false }) => (
  <div className="bg-white p-4">
    <p className="overline text-[10px] text-zinc-400 flex items-center gap-1.5 mb-1">
      <Icon size={12} className="text-[#002FA7]" />
      {label}
    </p>
    <p className={`text-sm text-zinc-900 font-medium ${mono ? "font-mono font-bold" : ""}`}>
      {value || "—"}
    </p>
  </div>
);

export default function PublicQuotationPage() {
  const { token } = useParams();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    api.get(`/share/${token}`).then(({ data }) => setQ(data)).catch((e) => {
      setErr(e.response?.data?.detail || "Quotation not available or expired");
    });
  }, [token]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-8">
      <div className="border border-zinc-200 bg-white p-10 max-w-md text-center shadow-lg">
        <span className="font-mono text-xs text-[#002FA7] font-bold uppercase tracking-wider bg-[#002FA7]/5 px-2.5 py-1">
          Quotation Notice
        </span>
        <h1 className="font-display text-2xl font-medium mt-4 text-zinc-900">Quotation Not Available</h1>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
          {err || "This proposal link may have expired or been updated by the corporate account manager."}
        </p>
      </div>
    </div>
  );

  if (!q) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-10 text-zinc-500 font-mono text-xs">
        Loading executive proposal...
      </div>
    );
  }

  const createdStr = q.created_at
    ? new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const pdfUrl = `${process.env.REACT_APP_BACKEND_URL || ""}/api/share/${token}/pdf`;

  const totalQuantity = (q.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  return (
    <div data-testid={PUBLIC.quotationContainer} className="min-h-screen bg-zinc-100/70 text-zinc-900 selection:bg-[#002FA7] selection:text-white print:bg-white">
      
      {/* Sticky Top Action Bar (hidden on print) */}
      <div className="no-print sticky top-0 z-30 glass-nav shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            <span className="logo-mark text-xl text-zinc-900">ONCOST</span>
            <span className="overline text-[9px] text-[#002FA7] tracking-[0.2em]">Official Quotation</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              data-testid={PUBLIC.printBtn}
              className="border border-zinc-300 hover:border-[#002FA7] hover:text-[#002FA7] bg-white px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Printer size={13} /> Print Document
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              data-testid={PUBLIC.downloadPdfBtn}
              className="bg-[#002FA7] hover:bg-[#002075] text-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
            >
              <FileDown size={13} /> Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* Main Quotation Sheet (Swiss Architectural Boardroom Aesthetic) */}
      <div className="max-w-5xl mx-auto my-8 md:my-12 p-6 md:p-12 bg-white border border-zinc-200 shadow-xl print:shadow-none print:border-none print:m-0 print:p-0 print-container">
        
        {/* Header Ribbon */}
        <div className="border-b-2 border-zinc-950 pb-8 flex items-start md:items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="logo-mark text-3xl tracking-tight text-zinc-950">ONCOST</span>
              <span className="text-xs font-mono text-zinc-400">·</span>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Commercial Proposal</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Pragna Enterprises · Premium Corporate &amp; Customized Gifting Solutions
            </p>
            <div className="mt-4 inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 font-mono text-[11px] font-medium">
              <ShieldCheck size={13} className="text-emerald-600" />
              Verified Commercial Quotation · ID: <span className="font-bold">{q.quotation_id}</span>
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="overline text-[10px] text-zinc-400">Prepared Exclusively For</p>
            <h2 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-zinc-950 mt-1">
              {q.customer_name || "Valued Enterprise Client"}
            </h2>
            {q.place && (
              <p className="text-xs text-zinc-500 mt-1 flex items-center md:justify-end gap-1 font-mono">
                <MapPin size={12} className="text-[#002FA7]" /> {q.place}
              </p>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 border border-zinc-200 border-t-0 mb-10">
          <MetaItem icon={Hash} label="Proposal SKU / Ref" value={q.quotation_id} mono />
          <MetaItem icon={MapPin} label="Destination Place" value={q.place || "PAN-India"} />
          <MetaItem icon={Calendar} label="Date of Issuance" value={createdStr} />
          <MetaItem icon={Calendar} label="Quotation Validity" value={q.valid_until || "15 Days from Date of Issuance"} />
        </div>

        {/* Line Items Heading */}
        <div className="flex items-baseline justify-between mb-4 border-b border-zinc-200 pb-2">
          <div>
            <span className="overline text-[#002FA7]">Curated Line Items</span>
            <p className="text-xs text-zinc-500 mt-0.5">
              {q.items.length} Product Set(s) · Total Volume: <strong className="font-mono text-zinc-800">{totalQuantity} units</strong>
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">All prices in Indian Rupees (INR)</span>
        </div>

        {/* Line Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {q.items.map((it, i) => (
            <div key={`${it.product_id || it.code}-${i}`} className="bg-white border border-zinc-200 flex flex-col justify-between print-block">
              {it.image && (
                <button
                  type="button"
                  onClick={() => setZoom({ src: imageUrl(it.image), alt: it.code, caption: `${it.code} · ${it.set_type || ""}` })}
                  className="relative block w-full aspect-[4/3] overflow-hidden bg-zinc-50 border-b border-zinc-200 cursor-zoom-in group/img print:cursor-default"
                  data-testid={`quote-item-image-${it.code}`}
                  aria-label={`Enlarge image of ${it.code}`}
                >
                  <img src={imageUrl(it.image)} alt={it.code} className="w-full h-full object-contain p-4" />
                  <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity print:hidden">
                    <ZoomIn size={11} /> Zoom
                  </span>
                </button>
              )}

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold text-[#002FA7] bg-[#002FA7]/5 px-2 py-0.5 border border-[#002FA7]/15">
                      {it.code}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      MOQ: {it.moq || 50}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-semibold text-zinc-950 mt-2">
                    {it.set_type || it.name || it.code}
                  </h3>

                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-3">
                    {it.items}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-end justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-mono text-zinc-400">Unit × Qty</span>
                    <p className="font-mono text-xs text-zinc-700">
                      {formatINR(it.unit_price)} × {it.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-mono text-zinc-400">Line Amount</span>
                    <p className="font-display text-lg font-bold text-zinc-950">
                      {formatINR(it.line_total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Commercial Summary Card */}
        <div className="border-t-2 border-zinc-950 pt-6 bg-zinc-50/60 p-6 border border-zinc-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
            
            {/* Notes & Branding Policy */}
            <div className="space-y-3">
              <span className="overline text-[#002FA7]">Terms &amp; Disclaimers</span>
              <p className="text-xs text-zinc-600 leading-relaxed">
                • Custom laser engraving or UV printing on all units included. <br />
                • Standard delivery turnaround: 10 to 15 business days upon digital artwork approval. <br />
                • Invoicing with 18% HSN-compliant GST for Input Tax Credit.
              </p>
              {q.notes && (
                <div className="mt-3 p-3 bg-white border border-zinc-200 text-xs text-zinc-700">
                  <p className="font-mono text-[10px] uppercase font-bold text-zinc-400 mb-1">Additional Notes</p>
                  <p className="whitespace-pre-line leading-relaxed">{q.notes}</p>
                </div>
              )}
            </div>

            {/* Price Ledger */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-zinc-600">
                <span>Subtotal ({totalQuantity} sets)</span>
                <span className="font-bold text-zinc-900">{formatINR(q.subtotal ?? q.total)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span>PAN-India Logistics &amp; Packaging</span>
                <span>{q.shipping_charges ? formatINR(q.shipping_charges) : "Included / As Actuals"}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <span>Goods &amp; Services Tax (GST {q.gst_percent || 18}%)</span>
                <span>{formatINR(q.gst_amount || 0)}</span>
              </div>

              <div className="pt-3 mt-2 border-t-2 border-zinc-950 flex items-baseline justify-between font-sans">
                <span className="overline text-sm text-zinc-900">Grand Total</span>
                <span className="font-display text-3xl font-bold text-zinc-950 tracking-tight">
                  {formatINR(q.total)}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Corporate Signoff & Contact */}
        <div className="mt-12 pt-8 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-500 font-mono">
          <div>
            <p className="font-bold text-zinc-900 uppercase">PRAGNA ENTERPRISES</p>
            <p className="mt-1">Corporate Division: ONCOST Gifting</p>
            <p>Bengaluru · Hyderabad · India</p>
          </div>
          <div>
            <p className="font-bold text-zinc-900 uppercase">SUPPORT &amp; DISPATCH</p>
            <p className="mt-1">hello@oncostcatalog.in</p>
            <p>Direct: +91-99999-99999</p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-bold text-zinc-900 uppercase">AUTHORISED SIGNATORY</p>
            <div className="mt-4 pt-4 border-t border-dashed border-zinc-300 inline-block min-w-[140px]">
              <span className="text-[10px] text-zinc-400">Digital Seal &amp; Signature</span>
            </div>
          </div>
        </div>

      </div>

      {zoom && <ImageLightbox {...zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
