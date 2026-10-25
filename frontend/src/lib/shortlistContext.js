import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

const ShortlistContext = createContext(null);

export function ShortlistProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("oncost_shortlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("oncost_shortlist", JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const addItem = (product, quantity = null) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.code === product.code);
      if (existing) {
        toast.info(`${product.code} is already in your shortlist.`);
        return prev;
      }
      toast.success(`Added ${product.code} to your shortlist`);
      return [
        ...prev,
        {
          id: product.id,
          code: product.code,
          name: product.name || product.set_type || product.code,
          image: product.image,
          oncost_price: product.oncost_price,
          moq: product.moq || 50,
          quantity: quantity || product.moq || 50,
          category: product.category,
        },
      ];
    });
  };

  const removeItem = (code) => {
    setItems((prev) => prev.filter((p) => p.code !== code));
    toast.info(`Removed ${code} from shortlist`);
  };

  const updateQuantity = (code, qty) => {
    setItems((prev) =>
      prev.map((it) => (it.code === code ? { ...it, quantity: Math.max(1, qty) } : it))
    );
  };

  const clearShortlist = () => {
    setItems([]);
  };

  return (
    <ShortlistContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearShortlist,
        count: items.length,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </ShortlistContext.Provider>
  );
}

export function useShortlist() {
  const ctx = useContext(ShortlistContext);
  if (!ctx) {
    throw new Error("useShortlist must be used within a ShortlistProvider");
  }
  return ctx;
}
