import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);

const getLineTotal = (item) => {
  const bundleQuantity = Number(item.bundle_quantity) || 2;
  const bundlePrice = Number(item.bundle_price);
  if (item.bundle_enabled && bundlePrice > 0 && item.quantity >= bundleQuantity) {
    const bundles = Math.floor(item.quantity / bundleQuantity);
    const remainder = item.quantity % bundleQuantity;
    return bundles * bundlePrice + remainder * item.price;
  }
  return item.price * item.quantity;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ks_cart") || "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("ks_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item) => {
    setItems((prev) => {
      const key = `${item.product_id}|${item.variation_id || ""}`;
      const existing = prev.find((i) => `${i.product_id}|${i.variation_id || ""}` === key);
      if (existing) {
        return prev.map((i) => i === existing ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
    toast.success(`${item.name} ajouté au panier`);
    setOpen(true);
  };

  const removeItem = (product_id, variation_id) => {
    setItems((prev) => prev.filter((i) => !(i.product_id === product_id && (i.variation_id || "") === (variation_id || ""))));
  };

  const updateQty = (product_id, variation_id, qty) => {
    if (qty < 1) return removeItem(product_id, variation_id);
    setItems((prev) => prev.map((i) =>
      i.product_id === product_id && (i.variation_id || "") === (variation_id || "")
        ? { ...i, quantity: qty } : i));
  };

  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + getLineTotal(i), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clear, total, count, open, setOpen, getLineTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
