import React, { useState } from "react";
import { useShortlist } from "@/lib/shortlistContext";
import { imageUrl, formatINR } from "@/lib/api";
import { X, Trash2, ShoppingBag, MessageSquare, ArrowRight, Layers } from "lucide-react";
import EnquiryModal from "@/components/EnquiryModal";

export default function ShortlistDrawer() {
  const { items, removeItem, updateQuantity, clearShortlist, count, isOpen, setIsOpen } = useShortlist();
  const [showEnquiry, setShowEnquiry] = useState(false);

  if (!isOpen) return null;

  const totalEstimate = items.reduce((sum, it) => sum + (it.oncost_price || 0) * (it.quantity || it.moq || 50), 0);

  const getWhatsAppMessage = () => {
    const list = items
      .map((it) => `• ${it.code} (${it.name || it.set_type}): ${it.quantity} units @ ${formatINR(it.oncost_price)}`)
      .join("\n");
    return encodeURIComponent(
      `Hi ONCOST team,\nI have shortlisted ${items.length} products on your catalog website:\n\n${list}\n\n` +
      `Estimated Order Value: ${formatINR(totalEstimate)} (excl. tax & branding)\n` +
      `Please provide formal quotation and availability.`
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#002FA7]" />
            <h2 className="font-display font-medium text-lg text-zinc-900">
              Quotation Shortlist ({count})
            </h2>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="py-20 text-center space-y-4 text-zinc-400">
              <ShoppingBag size={44} className="mx-auto stroke-1" />
              <div>
                <p className="font-medium text-zinc-700 text-sm">Your shortlist is empty</p>
                <p className="text-xs mt-1 text-zinc-500">
                  Browse our catalog and click “+ Shortlist” on any product to bundle multiple items into a single quotation request.
                </p>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.code}
                className="flex gap-3 p-3 bg-zinc-50/80 border border-zinc-200 group"
              >
                {item.image && (
                  <div className="w-16 h-16 bg-white border border-zinc-200 flex-shrink-0 p-1">
                    <img
                      src={imageUrl(item.image)}
                      alt={item.code}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[#002FA7]">
                        {item.code}
                      </span>
                      <h4 className="text-xs font-medium text-zinc-900 truncate">
                        {item.name || item.set_type}
                      </h4>
                    </div>
                    <button
                      onClick={() => removeItem(item.code)}
                      className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                      title="Remove"
                      aria-label={`Remove ${item.code}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity || item.moq || 50}
                        onChange={(e) => updateQuantity(item.code, Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 text-xs font-mono border border-zinc-300 text-center focus:border-[#002FA7] outline-none"
                      />
                    </div>
                    <span className="font-mono font-medium text-zinc-900">
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
              <span className="text-zinc-500">Indicative Subtotal ({count} items)</span>
              <span className="font-display text-xl font-medium text-zinc-900">
                {formatINR(totalEstimate)}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              *Exclusive of 18% GST and shipping. Volume discounts and customization will be factored into the final quote.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setShowEnquiry(true)}
                className="w-full py-2.5 bg-[#002FA7] hover:bg-[#002277] text-white text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <span>Request Combined Quote</span>
                <ArrowRight size={13} />
              </button>

              <div className="flex gap-2">
                <a
                  href={`https://wa.me/919999999999?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp Quote</span>
                </a>
                <button
                  onClick={clearShortlist}
                  className="px-3 py-2 border border-zinc-300 text-zinc-600 hover:text-red-600 hover:bg-zinc-100 text-xs transition-colors"
                  title="Clear all"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
