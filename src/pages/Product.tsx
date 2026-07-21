import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Eye, Check, X } from 'lucide-react';
import productsData from '../data/products.json';
import { brands } from '../data/brands';
import { useCart } from '../contexts/CartContext';
import BrandBackground from '../components/BrandBackground';

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
  const [added, setAdded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const product = products.find(p => p.id === id);

  if (!product) {
    navigate('/not-found');
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
        className="relative mx-4 mt-4 rounded-3xl overflow-hidden aspect-square neon-border"
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
              <CartModal onClose={() => setShowCart(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartModal({ onClose }: { onClose: () => void }) {
  const { items, removeItem, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);

  const handleCheckout = () => {
    setShowPayment(true);
  };

  const handlePaymentComplete = () => {
    clearCart();
    setShowPayment(false);
    onClose();
    navigate('/home');
  };

  return (
    <>
      {!showPayment ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Your Cart</h3>
            <button onClick={onClose} className="p-2 rounded-xl glass">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {items.map(item => (
                  <div key={item.id} className="glass rounded-xl p-4 flex gap-3">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{item.name}</p>
                      <p className="text-white/40 text-xs">{item.brand} • {item.size}</p>
                      <p className="text-scanova-cyan font-semibold text-sm">{formatPrice(item.price)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => removeItem(item.id)} className="text-white/40 hover:text-red-400 text-xs">Remove</button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white text-sm">-</button>
                        <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white text-sm">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass rounded-xl p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/40">Items</span>
                  <span className="text-white">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white font-medium">Total</span>
                  <span className="text-xl font-bold text-gradient">{formatPrice(totalPrice)}</span>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCheckout}
                className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold shadow-neon">
                Checkout • {formatPrice(totalPrice)}
              </motion.button>
            </>
          )}
        </>
      ) : (
        <PaymentModal
          totalItems={totalItems}
          totalPrice={totalPrice}
          onComplete={handlePaymentComplete}
          onBack={() => setShowPayment(false)}
        />
      )}
    </>
  );
}

function PaymentModal({ totalItems, totalPrice, onComplete, onBack }: { totalItems: number; totalPrice: number; onComplete: () => void; onBack: () => void }) {
  const [paymentComplete, setPaymentComplete] = useState(false);

  const handleMarkComplete = () => {
    setPaymentComplete(true);
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  if (paymentComplete) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6"
        >
          <Check className="w-10 h-10 text-green-400" />
        </motion.div>
        <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
        <p className="text-white/60">Thank you for shopping with Scanova</p>
      </motion.div>
    );
  }

  // Generate a simple QR-like pattern (decorative)
  const qrPattern = Array.from({ length: 9 }, (_, i) =>
    Array.from({ length: 9 }, (_, j) => {
      if ((i < 3 && j < 3) || (i < 3 && j > 5) || (i > 5 && j < 3)) {
        return ((i + j) % 2 === 0) ? '1' : '0';
      }
      return Math.random() > 0.5 ? '1' : '0';
    }).join('')
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-2 rounded-xl glass text-white/60 text-sm">Back</button>
        <h3 className="text-lg font-bold text-white">Payment</h3>
        <div className="w-10" />
      </div>

      {/* Order Summary */}
      <div className="glass rounded-xl p-4 mb-4">
        <p className="text-white/40 text-xs mb-2">Order Summary</p>
        <div className="flex justify-between mb-1">
          <span className="text-white text-sm">Total Items</span>
          <span className="text-white font-medium">{totalItems}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white font-medium">Amount</span>
          <span className="text-xl font-bold text-gradient">{formatPrice(totalPrice)}</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="glass rounded-xl p-6 mb-4 text-center">
        <p className="text-white/60 text-sm mb-4">Scan QR Code to Pay</p>
        <div className="inline-block p-4 bg-white rounded-xl">
          {qrPattern.map((row, i) => (
            <div key={i} className="flex">
              {row.split('').map((cell, j) => (
                <div key={j} className={`w-3 h-3 ${cell === '1' ? 'bg-black' : 'bg-white'}`} />
              ))}
            </div>
          ))}
        </div>
        <p className="text-scanova-cyan font-mono text-lg mt-4">{formatPrice(totalPrice)}</p>
      </div>

      {/* Payment Options */}
      <div className="space-y-2 mb-6">
        <p className="text-white/40 text-xs mb-2">Pay with UPI App</p>
        <div className="grid grid-cols-3 gap-2">
          <button className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white font-bold text-xs">Pe</div>
            <span className="text-white/60 text-xs">PhonePe</span>
          </button>
          <button className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-xs">GPay</div>
            <span className="text-white/60 text-xs">Google Pay</span>
          </button>
          <button className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-xs">Pa</div>
            <span className="text-white/60 text-xs">Paytm</span>
          </button>
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={handleMarkComplete}
        className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold shadow-neon">
        Mark Payment Complete
      </motion.button>

      <p className="text-white/20 text-xs text-center mt-3">Demo payment flow only</p>
    </>
  );
}
