import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: number;
  image: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  totalItems: number;
  totalPrice: number;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch cart items from Supabase when user logs in, or fallback to localStorage
  useEffect(() => {
    const fetchCart = async () => {
      setLoading(true);
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('cart_items')
            .select(`
              quantity,
              product_id,
              products (
                id,
                name,
                brand,
                size,
                price,
                image
              )
            `)
            .eq('user_id', currentUser.id);

          if (error) throw error;

          if (data && data.length > 0) {
            const mapped: CartItem[] = data
              .filter(item => item.products !== null)
              .map(item => {
                const prod = item.products as any;
                return {
                  id: item.product_id,
                  name: prod.name,
                  brand: prod.brand,
                  size: prod.size,
                  price: Number(prod.price),
                  image: prod.image,
                  quantity: item.quantity
                };
              });
            setItems(mapped);
            localStorage.setItem('scanova_cart', JSON.stringify(mapped));
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[CartContext] Supabase fetch cart failed, using local fallback:', err);
        }
      }

      // Guest / Offline fallback
      try {
        const stored = localStorage.getItem('scanova_cart');
        if (stored) {
          setItems(JSON.parse(stored));
        }
      } catch (e) {
        console.error('LocalStorage cart parse error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, [currentUser]);

  // Persist items to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem('scanova_cart', JSON.stringify(items));
    } catch (e) {
      console.error('LocalStorage set error:', e);
    }
  }, [items]);


  const addItem = useCallback(async (item: Omit<CartItem, 'quantity'>) => {
    if (!currentUser) return;

    // Determine target quantity
    const existing = items.find(i => i.id === item.id);
    const newQty = existing ? existing.quantity + 1 : 1;

    // Update local state instantly (Optimistic UI)
    setItems(prev => {
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    try {
      const { error } = await supabase
        .from('cart_items')
        .upsert({
          user_id: currentUser.id,
          product_id: item.id,
          quantity: newQty
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error adding item to cart:', err);
    }
  }, [currentUser, items]);

  const removeItem = useCallback(async (id: string) => {
    if (!currentUser) return;

    // Update local state instantly
    setItems(prev => prev.filter(i => i.id !== id));

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('product_id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error removing item from cart:', err);
    }
  }, [currentUser]);

  const updateQuantity = useCallback(async (id: string, quantity: number) => {
    if (!currentUser) return;

    if (quantity < 1) {
      removeItem(id);
      return;
    }

    // Update local state instantly
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('user_id', currentUser.id)
        .eq('product_id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating cart item quantity:', err);
    }
  }, [currentUser, removeItem]);

  const clearCart = useCallback(async () => {
    if (!currentUser) return;

    setItems([]);

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', currentUser.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error clearing cart:', err);
    }
  }, [currentUser]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, totalItems, totalPrice, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
