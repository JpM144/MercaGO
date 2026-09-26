import { createContext, useContext, useEffect, useState } from 'react';

const CART_KEY = 'techstore_cart';

const CartContext = createContext(null);

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const nextQuantity = Math.min(product.stock, (existing?.quantity ?? 0) + quantity);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: nextQuantity } : item,
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
  };

  const removeItem = (productId) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const setQuantity = (productId, quantity) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(quantity, item.product.stock)),
            }
          : item,
      ),
    );
  };

  const clear = () => setItems([]);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, setQuantity, clear, totalCount, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
