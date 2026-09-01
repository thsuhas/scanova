import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Eye, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import productsData from '../data/products.json';
import { brands } from '../data/brands';
import { useCart } from '../contexts/CartContext';
import BrandBackground from '../components/BrandBackground';
import CartDrawer from '../components/CartDrawer';

interface Product {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: number;
  image: string;
}

const products: Product[] = productsData;

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, totalItems } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, brand, size, price, image')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        // Fetch inventory stock count
        const { data: invData } = await supabase
          .from('inventory')
          .select('stock')
          .eq('product_id', id)
          .maybeSingle();

        if (invData) {
          setStock(invData.stock);
        } else {
          setStock(20);
        }

        if (data) {
          setProduct({
            id: data.id,
            name: data.name,
            brand: data.brand,
            size: data.size,
            price: Number(data.price),
            image: data.image || '',
          });
        } else {
          // Fallback search locally
          const localProd = products.find(p => p.id === id);
          if (localProd) {
            setProduct(localProd);
          } else {
            navigate(`/not-found?barcode=${id}`);
          }
        }
      } catch (err) {
        console.error('Error fetching product:', err);
        const localProd = products.find(p => p.id === id);
        if (localProd) {
          setProduct(localProd);
          setStock(20);
        } else {
          navigate(`/not-found?barcode=${id}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate]);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-scanova-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    navigate(`/not-found?barcode=${id}`);
    return null;
  }

  // Find brand ID for product's brand name
  const brandInfo = brands.find(b => b.name === product.brand);
  const brandId = brandInfo?.id || '';

  const handleAddToCart = () => {
    addItem({ id: product.id, name: product.name, brand: product.brand, size: product.size, price: product.price, image: product.image });
    setAdded(true);
    setShowToast(true);
    setTimeout(() => {
      setAdded(false);
      setShowToast(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative pb-24">
      <BrandBackground brandId={brandId} />

      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 glass-strong px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Product Details</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative mx-auto mt-6 rounded-3xl overflow-hidden aspect-square neon-border w-[240px] sm:w-[280px] md:w-[320px]"
      >
        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <span className="px-3 py-1 rounded-full glass text-xs font-medium text-scanova-cyan">{product.brand}</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="px-6 py-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{product.name}</h2>
          <p className="text-white/40 text-sm mt-1">Barcode: {product.id}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass rounded-xl px-4 py-2">
            <p className="text-white/40 text-xs">Size</p>
            <p className="text-white font-semibold text-sm">{product.size}</p>
          </div>
          <div className="glass rounded-xl px-4 py-2">
            <p className="text-white/40 text-xs">Brand</p>
            <p className="text-white font-semibold text-sm">{product.brand}</p>
          </div>
          <div className="glass rounded-xl px-4 py-2">
            <p className="text-white/40 text-xs">Stock Level</p>
            <p className={`font-semibold text-sm ${stock !== null && stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stock !== null ? (stock > 0 ? `${stock} available` : 'Out of Stock') : 'In Stock'}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gradient">{formatPrice(product.price)}</span>
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 z-40 glass-strong px-4 py-4 border-t border-white/5">
        <div className="flex gap-3 max-w-lg mx-auto">
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleAddToCart}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${added ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'glass neon-border text-white hover:shadow-neon'}`}>
            {added ? <><Check className="w-4 h-4" /> Added</> : <><ShoppingCart className="w-4 h-4" /> Add to Cart</>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCart(true)}
            className="flex-1 py-3.5 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon">
            <Eye className="w-4 h-4" /> View Cart {totalItems > 0 && `(${totalItems})`}
          </motion.button>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-green-500/20 border border-green-500/40 backdrop-blur-lg"
          >
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium text-sm">Added to cart!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md glass-strong rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-auto"
            >
              <CartDrawer onClose={() => setShowCart(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

