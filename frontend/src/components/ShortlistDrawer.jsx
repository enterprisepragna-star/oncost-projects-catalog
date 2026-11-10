import React, { useState } from "react";
import { useShortlist } from "@/lib/shortlistContext";
import { imageUrl, formatINR } from "@/lib/api";
import { X, Trash2, ShoppingBag, MessageSquare, ArrowRight, Layers, Package, Sparkles } from "lucide-react";
import EnquiryModal from "@/components/EnquiryModal";

export default function ShortlistDrawer() {
  const { items, removeItem, updateQuantity, clearShortlist, count, isOpen, setIsOpen } = useShortlist();
  const [showEnquiry, setShowEnquiry] = useState(false);

  if (!isOpen) return null;

  const totalEstimate = items.reduce((sum, it) => sum + (it.oncost_price || 0) * (it.quantity || it.moq || 50), 0);
  const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantity) || Number(it.moq) || 50), 0);

  const getWhatsAppMessage = () => {
    const list = items
      .map((it) => `• ${it.code} (${it.name || it.set_type}): ${it.quantity || it.moq || 50} units @ ${formatINR(it.oncost_price)}`)
      .join("\n");
    return encodeURIComponent(
      `Hi ONCOST team,\nI have shortlisted ${items.length} product sets on your catalog:\n\n${list}\n\n` +
      `Total Estimated Units: ${totalUnits}\n` +
      `Estimated Order Value: ${formatINR(totalEstimate)} (excl. 18% GST)\n\n` +
      `Please provide formal quotation and sample availability.`
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#002FA7]/10 text-[#002FA7] flex items-center justify-center font-bold">
              <ShoppingBag size={16} />
            </div>
            <div>
              <h2 className="font-display font-medium text-base text-zinc-950">
                Corporate Shortlist
              </h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {count} {count === 1 ? "Product Set" : "Product Sets"} Selected
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200 transition-colors"
            aria-label="Close shortlist drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 ? (
            <div className="py-24 text-center space-y-4 text-zinc-400">
              <div className="w-16 h-16 mx-auto bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-300">
                <ShoppingBag size={28} className="stroke-1" />
              </div>
              <div>
                <p className="font-display text-base font-medium text-zinc-800">Your shortlist is empty</p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-relaxed">
                  Click the heart icon on any product in the catalog to bundle sets together for a combined formal quotation.
                </p>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.code}
                className="flex gap-3 p-3 bg-zinc-50 border border-zinc-200 group hover:border-zinc-300 transition-colors"
              >
                {item.image ? (
                  <div className="w-16 h-16 bg-white border border-zinc-200 shrink-0 p-1 flex items-center justify-center">
                    <img
                      src={imageUrl(item.image)}
                      alt={item.code}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white border border-zinc-200 shrink-0 flex items-center justify-center text-zinc-300">
                    <Package size={20} />
                  </div>
                )}
                
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[#002FA7] bg-[#002FA7]/8 px-1.5 py-0.5">
                        {item.code}
                      </span>
                      <h4 className="text-xs font-semibold text-zinc-900 truncate mt-1">
                        {item.name || item.set_type}
                      </h4>
                    </div>
                    <button
                      onClick={() => removeItem(item.code)}
                      className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                      title="Remove set"
                      aria-label={`Remove ${item.code}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500 font-mono">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity || item.moq || 50}
                        onChange={(e) => updateQuantity(item.code, Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 text-xs font-mono border border-zinc-300 text-center bg-white focus:border-[#002FA7] outline-none"
                      />
                    </div>
                    <span className="font-mono font-bold text-zinc-900">
                      {formatINR((item.oncost_price || 0) * (item.quantity || item.moq || 50))}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && (
          <div className="p-6 bg-zinc-50 border-t border-zinc-200 space-y-3">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-zinc-600 font-mono">Indicative Order Subtotal:</span>
              <span className="font-display text-xl font-bold text-zinc-950">
                {formatINR(totalEstimate)}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono leading-tight">
              *Excludes 18% GST and transit. Custom laser logo branding included on minimum order quantity (MOQ).
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowEnquiry(true)}
                className="w-full py-3 bg-[#002FA7] hover:bg-[#002075] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>Request Combined Quotation</span>
                <ArrowRight size={13} />
              </button>

              <div className="flex gap-2">
                <a
                  href={`https://wa.me/919999999999?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-[#25D366] hover:bg-[#20b857] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <MessageSquare size={13} />
                  <span>Send to WhatsApp</span>
                </a>
                <button
                  onClick={clearShortlist}
                  className="px-3.5 py-2 border border-zinc-300 text-zinc-600 hover:text-red-600 hover:bg-zinc-100 text-xs font-medium transition-colors"
                  title="Clear all shortlist items"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {showEnquiry && (
        <EnquiryModal
          isOpen={showEnquiry}
          onClose={() => setShowEnquiry(false)}
          items={items}
          onSubmitted={() => {
            clearShortlist();
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
