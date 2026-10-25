import React, { useState } from "react";
import api, { formatINR } from "@/lib/api";
import { X, CheckCircle2, MessageSquare, Send, ShieldCheck, Clock, Building2, User, Mail, Phone, MapPin, Calendar, Layers } from "lucide-react";
import { toast } from "sonner";

export default function EnquiryModal({ isOpen, onClose, product = null, items = [], onSubmitted = null }) {
  const isSingle = Boolean(product);
  const enquiryItems = isSingle ? [product] : items;

  const defaultQty = isSingle ? (product.moq || 50) : (items[0]?.quantity || 50);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    location: "",
    required_date: "",
    quantity: defaultQty,
    branding_needed: true,
    branding_notes: "",
    notes: "",
    hp: "", // Honeypot spam trap
  });

  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error("Please provide your name, email, and phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        location: formData.location.trim(),
        required_date: formData.required_date.trim(),
        quantity: Number(formData.quantity) || 50,
        branding_needed: formData.branding_needed,
        branding_notes: formData.branding_notes.trim(),
        notes: formData.notes.trim(),
        items: enquiryItems.map((it) => ({
          code: it.code,
          name: it.name || it.set_type || it.code,
          quantity: it.quantity || formData.quantity || 50,
          oncost_price: it.oncost_price,
          moq: it.moq || 50,
        })),
        hp: formData.hp,
        referral_code: localStorage.getItem("oncost_ref") || null,
      };

      const { data } = await api.post("/public/enquiry", payload);
      setSuccessResult(data);
      if (onSubmitted) onSubmitted(data);
      toast.success("Quotation enquiry submitted successfully!");
    } catch (err) {
      console.error("Enquiry submission failed:", err);
      toast.error(err?.response?.data?.detail || "Failed to submit enquiry. Please try again or reach out on WhatsApp.");
    } finally {
      setSubmitting(false);
    }
  };

  const getWhatsAppMessage = () => {
    const codeList = enquiryItems.map((it) => `${it.code} (${it.name || ""})`).join(", ");
    return encodeURIComponent(
      `Hi ONCOST team,\nI would like to request an official corporate quotation:\n\n` +
      `*Products:* ${codeList}\n` +
      `*Quantity:* ${formData.quantity || 50} units\n` +
      `*Company:* ${formData.company || "Corporate Buyer"}\n` +
      `*Location:* ${formData.location || "India"}\n` +
      `*Target Date:* ${formData.required_date || "Earliest available"}\n` +
      `*Branding:* ${formData.branding_needed ? "Yes, custom logo required" : "Standard packaging"}\n\n` +
      `Please share availability and commercial quotation.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="relative w-full max-w-2xl bg-white border border-zinc-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-50 border-b border-zinc-200">
          <div>
            <span className="overline text-[10px] text-[#002FA7]">Corporate Gifting Proposal</span>
            <h2 className="text-xl font-display font-medium text-zinc-900 mt-0.5">
              {isSingle ? `Request a Quote · ${product.code}` : `Bulk Quotation Enquiry (${enquiryItems.length} Products)`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {successResult ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 mx-auto bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <span className="overline text-[11px] text-emerald-700">Enquiry Confirmed</span>
                <h3 className="text-2xl font-display font-medium text-zinc-900 mt-1">
                  Reference: {successResult.reference}
                </h3>
                <p className="text-sm text-zinc-600 max-w-md mx-auto mt-2 leading-relaxed">
                  {successResult.message}
                </p>
              </div>

              {/* Summary card */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 text-left max-w-md mx-auto space-y-2 text-xs">
                <p className="font-mono text-zinc-500 uppercase tracking-wider text-[10px]">Enquiry Details</p>
                <p><span className="font-medium text-zinc-900">Name:</span> {formData.name} ({formData.company})</p>
                <p><span className="font-medium text-zinc-900">Contact:</span> {formData.phone} · {formData.email}</p>
                <p><span className="font-medium text-zinc-900">Products:</span> {enquiryItems.map((i) => i.code).join(", ")}</p>
                <p><span className="font-medium text-zinc-900">Units:</span> {formData.quantity}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <a
                  href={`https://wa.me/919999999999?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium tracking-wide uppercase flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageSquare size={14} /> Send WhatsApp Copy
                </a>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-medium tracking-wide uppercase transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Product preview list */}
              <div className="p-3.5 bg-zinc-50 border border-zinc-200">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-zinc-700">Selected Product(s)</span>
                  <span>{enquiryItems.length} item{enquiryItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {enquiryItems.map((item) => (
                    <div key={item.code} className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/60 last:border-none">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#002FA7] bg-[#002FA7]/10 px-1.5 py-0.5 text-[10px]">
                          {item.code}
                        </span>
                        <span className="font-medium text-zinc-800 line-clamp-1">
                          {item.name || item.set_type}
                        </span>
                      </div>
                      <div className="text-right pl-2">
                        <span className="font-mono font-medium text-zinc-900">{formatINR(item.oncost_price)}</span>
                        <span className="text-[10px] text-zinc-400 block">MOQ {item.moq || 50}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Honeypot field (hidden from genuine users) */}
              <div className="hidden" aria-hidden="true">
                <label>Do not fill this</label>
                <input
                  type="text"
                  tabIndex="-1"
                  autoComplete="off"
                  value={formData.hp}
                  onChange={(e) => setFormData({ ...formData, hp: e.target.value })}
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <User size={12} className="text-zinc-400" /> Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Nair"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <Building2 size={12} className="text-zinc-400" /> Company / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Infosys Ltd."
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <Mail size={12} className="text-zinc-400" /> Official Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="priya@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <Phone size={12} className="text-zinc-400" /> Phone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>
              </div>

              {/* Requirement Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <Layers size={12} className="text-zinc-400" /> Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">MOQ applies (typically 50-100)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <MapPin size={12} className="text-zinc-400" /> Delivery City / State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru, KA"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-zinc-400" /> Target Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.required_date}
                    onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                  />
                </div>
              </div>

              {/* Branding Requirement */}
              <div className="p-3 bg-zinc-50 border border-zinc-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={formData.branding_needed}
                    onChange={(e) => setFormData({ ...formData, branding_needed: e.target.checked })}
                    className="w-4 h-4 text-[#002FA7] border-zinc-300 rounded focus:ring-[#002FA7]"
                  />
                  <span>Include custom company logo branding on products & box</span>
                </label>
                {formData.branding_needed && (
                  <input
                    type="text"
                    placeholder="Logo branding details (e.g. 1-color UV print on flask + gold foil on box)"
                    value={formData.branding_notes}
                    onChange={(e) => setFormData({ ...formData, branding_notes: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 focus:border-[#002FA7] outline-none"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Additional Notes / Specific Budget Instructions
                </label>
                <textarea
                  rows="2"
                  placeholder="Mention any custom packaging, sample requests, or delivery timelines..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 focus:border-[#002FA7] focus:ring-1 focus:ring-[#002FA7] outline-none"
                />
              </div>

              {/* Trust Badges Strip */}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 flex-wrap gap-2">
                <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-600" /> GST Invoice with HSN breakdown</span>
                <span className="flex items-center gap-1"><Clock size={13} className="text-[#002FA7]" /> Quote within 2-4 business hours</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                <a
                  href={`https://wa.me/919999999999?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1.5"
                >
                  <MessageSquare size={13} /> Or chat directly on WhatsApp
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-zinc-300 text-xs text-zinc-600 hover:bg-zinc-100 uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-[#002FA7] hover:bg-[#002277] text-white text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={13} /> {submitting ? "Submitting…" : "Request Quotation"}
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
