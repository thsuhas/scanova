import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Minus, Trash2, ShoppingCart, Check, Loader2, Receipt, ArrowLeft } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}${random}`;
}

function generateTransactionId(): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `TXN-${random}${timestamp}`;
}

function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCPT-${year}${random}`;
}

function formatDate(): { date: string; time: string } {
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

interface PaymentSuccessData {
  orderId: string;
  transactionId: string;
  receiptNumber: string;
  paymentMethod: string;
}

export default function CartDrawer({ onClose }: Props) {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, totalItems, totalPrice, clearCart } = useCart();
  const { currentUser } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentComplete = async (method: string) => {
    setIsProcessing(true);
    const id = generateOrderId();
    const txnId = generateTransactionId();
    const rcptNum = generateReceiptNumber();

    // Calculate amounts
    const subtotal = totalPrice;
    const gst = Math.round(subtotal * 0.18);
    const total = subtotal + gst;
    const { date, time } = formatDate();

    // Prepare order items
    const orderItems = items.map(item => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      size: item.size,
    }));

    // Attempt atomic checkout RPC in Supabase first
    let dbOrderId = '';
    try {
      const { data: rpcOrderId, error: rpcError } = await supabase.rpc('create_checkout_order', {
        p_order_id: id,
        p_items: orderItems,
        p_subtotal: subtotal,
        p_gst: gst,
        p_total: total,
        p_payment_method: method,
        p_transaction_id: txnId,
        p_receipt_number: rcptNum,
      });

      if (!rpcError && rpcOrderId) {
        dbOrderId = rpcOrderId;
      } else {
        throw rpcError || new Error('RPC returned null');
      }
    } catch (rpcErr) {
      console.warn('[Checkout] Atomic RPC unavailable, falling back to sequential inserts:', rpcErr);

      // Save order to Supabase
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_id: id,
            user_id: currentUser?.id || null,
            items: orderItems,
            subtotal,
            gst,
            total,
            payment_method: method,
            payment_status: 'completed',
          })
          .select()
          .single();

        if (!orderError && orderData) {
          dbOrderId = orderData.id;
        }
      } catch (err) {
        console.error('Order save error:', err);
      }

      // Save normalized order items to Supabase
      if (dbOrderId) {
        try {
          const orderItemsPayload = items.map(item => ({
            order_id: dbOrderId,
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
            size: item.size
          }));

          await supabase.from('order_items').insert(orderItemsPayload);
        } catch (err) {
          console.error('Order items save error:', err);
        }
      }

      // Save payment to Supabase
      if (dbOrderId) {
        try {
          await supabase.from('payments').insert({
            order_id: dbOrderId,
            transaction_id: txnId,
            receipt_number: rcptNum,
            amount: total,
            payment_method: method,
            payment_status: 'completed'
          });
        } catch (err) {
          console.error('Payment save error:', err);
        }
      }

      // Update stock levels in inventory
      try {
        for (const item of items) {
          await supabase.rpc('decrement_stock', { p_id: item.id, p_qty: item.quantity });
        }
      } catch (err) {
        console.error('Inventory stock update error:', err);
      }
    }


    // Create receipt data
    const receiptData = {
      orderId: id,
      transactionId: txnId,
      receiptNumber: rcptNum,
      items: orderItems,
      subtotal,
      gst,
      discount: 0,
      total,
      paymentMethod: method,
      customerName: currentUser?.username,
      date,
      time,
      createdAt: new Date().toISOString(),
    };

    // Save receipt to localStorage
    const existingReceipts = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
    existingReceipts.unshift(receiptData);
    if (existingReceipts.length > 50) existingReceipts.pop();
    localStorage.setItem('scanova_receipts', JSON.stringify(existingReceipts));

    // Show success screen
    setSuccessData({
      orderId: id,
      transactionId: txnId,
      receiptNumber: rcptNum,
      paymentMethod: method,
    });
    setShowPayment(false);
    setShowSuccess(true);
    setIsProcessing(false);
  };

  const handleViewBill = () => {
    if (!successData) return;
    // Clear cart and navigate to receipt page
    clearCart();
    navigate(`/receipt/${successData.orderId}`);
    onClose();
  };

  const handleBackToHome = () => {
    clearCart();
    onClose();
  };

  // Calculate GST (assuming 18%)
  const subtotal = totalPrice;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  // Payment Success Screen
  if (showSuccess && successData) {
    return (
      <div className="relative z-10 px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-28 h-28 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-6 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <Check className="w-14 h-14 text-green-400" />
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-green-500"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-2 text-center"
        >
          Payment Successful!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/60 text-sm mb-6 text-center"
        >
          Thank you for shopping with Scanova
        </motion.p>

        {/* Order Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl p-4 w-full max-w-xs mb-6 text-center"
        >
          <p className="text-white/40 text-xs mb-1">Order ID</p>
          <p className="text-white font-mono font-semibold mb-3">{successData.orderId}</p>
          <p className="text-white/40 text-xs mb-1">Amount Paid</p>
          <p className="text-gradient font-bold text-xl">{formatPrice(total)}</p>
        </motion.div>

        {/* VIEW BILL Button - Large and prominent */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleViewBill}
          className="w-full max-w-xs py-4 rounded-xl gradient-primary text-white font-bold text-lg flex items-center justify-center gap-3 shadow-neon mb-4"
          style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)' }}
        >
          <Receipt className="w-6 h-6" /> VIEW BILL
        </motion.button>

        {/* Download PDF */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={handleBackToHome}
          className="text-white/50 text-sm hover:text-white/70 transition-colors"
        >
          Back to Home
        </motion.button>
      </div>
    );
  }

  // Payment Screen
  if (showPayment) {
    const qrPattern = Array.from({ length: 9 }, (_, i) =>
      Array.from({ length: 9 }, (_, j) => {
        if ((i < 3 && j < 3) || (i < 3 && j > 5) || (i > 5 && j < 3)) {
          return ((i + j) % 2 === 0) ? '1' : '0';
        }
        return Math.random() > 0.5 ? '1' : '0';
      }).join('')
    );

    const upiApps = [
      { name: 'PhonePe', id: 'phonepe', color: 'bg-purple-500', label: 'Pe' },
      { name: 'Google Pay', id: 'gpay', color: 'bg-blue-500', label: 'GPay' },
      { name: 'Paytm', id: 'paytm', color: 'bg-sky-500', label: 'Pa' },
    ];

    return (
      <div className="relative z-10 px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setShowPayment(false)} className="p-2 rounded-xl glass text-white/60 text-sm" disabled={isProcessing}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-white">Payment</h2>
          <div className="w-10" />
        </div>

        {/* Order Summary */}
        <div className="glass rounded-xl p-4 mb-4">
          <p className="text-white/40 text-xs mb-2">Order Summary</p>
          <div className="flex justify-between mb-1">
            <span className="text-white text-sm">Total Items</span>
            <span className="text-white font-medium">{totalItems}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-white text-sm">Subtotal</span>
            <span className="text-white font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-white text-sm">GST (18%)</span>
            <span className="text-white font-medium">{formatPrice(gst)}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
            <span className="text-white font-medium">Amount</span>
            <span className="text-xl font-bold text-gradient">{formatPrice(total)}</span>
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
          <p className="text-scanova-cyan font-mono text-lg mt-4">{formatPrice(total)}</p>
        </div>

        {/* Payment Options */}
        <div className="space-y-2 mb-6">
          <p className="text-white/40 text-xs mb-2">Pay with UPI App</p>
          <div className="grid grid-cols-3 gap-2">
            {upiApps.map(app => (
              <button
                key={app.id}
                onClick={() => handlePaymentComplete(app.name)}
                disabled={isProcessing}
                className="glass rounded-xl p-3 flex flex-col items-center gap-1 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <div className={`w-10 h-10 rounded-lg ${app.color} flex items-center justify-center text-white font-bold text-xs`}>
                  {app.label}
                </div>
                <span className="text-white/60 text-xs">{app.name}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handlePaymentComplete('UPI')}
          disabled={isProcessing}
          className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold shadow-neon flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Mark Payment Complete'
          )}
        </motion.button>

        <p className="text-white/20 text-xs text-center mt-3">Demo payment flow only</p>
      </div>
    );
  }

  // Cart View
  return (
    <div className="relative z-10 px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-scanova-purple" />
            <h2 className="text-lg font-bold text-white">Your Cart</h2>
            <span className="px-2 py-0.5 rounded-full glass text-xs text-scanova-cyan">{totalItems}</span>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
              Clear All
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Your cart is empty</p>
            <p className="text-white/20 text-xs mt-1">Scan products to add items</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-3 flex gap-3 neon-border"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.brand} - Size {item.size}</p>
                    <p className="text-scanova-cyan text-sm font-semibold mt-1">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={() => removeItem(item.id)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-lg glass flex items-center justify-center">
                        <Minus className="w-3 h-3 text-white/60" />
                      </button>
                      <span className="text-white text-xs font-medium w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-lg glass flex items-center justify-center">
                        <Plus className="w-3 h-3 text-white/60" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 glass rounded-xl p-4 neon-border">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/40">Total Items</span>
                <span className="text-white font-medium">{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 font-medium">Total</span>
                <span className="text-xl font-bold text-gradient">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowPayment(true)}
              className="w-full mt-4 py-3.5 rounded-xl gradient-primary text-white font-semibold flex items-center justify-center gap-2 shadow-neon"
            >
              Checkout - {formatPrice(totalPrice)}
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
}
