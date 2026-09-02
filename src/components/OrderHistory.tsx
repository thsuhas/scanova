import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Eye, ShoppingBag, Calendar, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ReceiptData {
  orderId: string;
  transactionId: string;
  receiptNumber: string;
  items: {
    id: string;
    name: string;
    brand: string;
    quantity: number;
    price: number;
    image?: string;
    size?: string;
  }[];
  subtotal: number;
  gst: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  date: string;
  time: string;
  createdAt: string;
}

interface OrderHistoryProps {
  onClose: () => void;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

export default function OrderHistory({ onClose }: OrderHistoryProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let supabaseOrders: ReceiptData[] = [];

      let userId = currentUser?.id;
      if (!userId) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          userId = authData?.user?.id;
        } catch (e) {
          // fallback
        }
      }

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select(`
              order_id,
              subtotal,
              gst,
              total,
              payment_method,
              created_at,
              items,
              payments (
                transaction_id,
                receipt_number
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          if (data && data.length > 0) {
            supabaseOrders = data.map((order: any) => {
              const dateObj = new Date(order.created_at);
              const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
              const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

              const payment = order.payments?.[0];
              return {
                orderId: order.order_id,
                transactionId: payment?.transaction_id || `TXN-${order.order_id}`,
                receiptNumber: payment?.receipt_number || `RCPT-${order.order_id}`,
                items: order.items || [],
                subtotal: Number(order.subtotal),
                gst: Number(order.gst),
                discount: 0,
                total: Number(order.total),
                paymentMethod: order.payment_method,
                customerName: currentUser?.username || 'Shopper',
                date: dateStr,
                time: timeStr,
                createdAt: order.created_at,
              };
            });
          }
        } catch (err) {
          console.warn('[OrderHistory] Supabase fetch error, using local fallback:', err);
        }
      }

      // Merge with localStorage receipts if available
      try {
        const localReceipts: ReceiptData[] = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
        const combinedMap = new Map<string, ReceiptData>();
        
        // Add Supabase orders first
        supabaseOrders.forEach(o => combinedMap.set(o.orderId, o));
        
        // Add local receipts if not already present
        localReceipts.forEach(o => {
          if (!combinedMap.has(o.orderId)) {
            combinedMap.set(o.orderId, o);
          }
        });

        const merged = Array.from(combinedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setReceipts(merged);
      } catch (e) {
        console.error('LocalStorage receipts parse error:', e);
        setReceipts(supabaseOrders);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);


  const handleViewReceipt = (orderId: string) => {
    navigate(`/receipt/${orderId}`);
    onClose();
  };

  const handleDownload = async (receipt: ReceiptData) => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const receiptHtml = generateReceiptHtml(receipt);
      const opt = {
        margin: 0,
        filename: `Scanova_Receipt_${receipt.receiptNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };
      html2pdf().set(opt).from(receiptHtml).save();
    } catch (error) {
      console.log('PDF download error:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0a0a1a] overflow-auto"
    >
      {/* Header */}
      <div className="sticky top-0 glass-strong px-4 py-4 flex items-center gap-3 z-10">
        <button onClick={onClose} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Order History</h1>
      </div>

      <div className="relative z-10 px-4 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-scanova-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-lg font-medium">No orders yet</p>
            <p className="text-white/30 text-sm mt-2">Your order history will appear here</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            {receipts.map((receipt, index) => (
              <motion.div
                key={receipt.orderId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass rounded-2xl p-4 neon-border"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white font-semibold">{receipt.receiptNumber}</p>
                    <p className="text-white/40 text-xs font-mono">{receipt.orderId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gradient font-bold text-lg">{formatPrice(receipt.total)}</p>
                    <p className="text-white/40 text-xs">{receipt.items.length} items</p>
                  </div>
                </div>

                {/* Order Date */}
                <div className="flex items-center gap-2 text-white/60 text-xs mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{receipt.date} | {receipt.time}</span>
                </div>

                {/* Items Preview */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {receipt.items.slice(0, 3).map((item, i) => (
                    item.image && (
                      <div key={i} className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )
                  ))}
                  {receipt.items.length > 3 && (
                    <div className="w-12 h-12 rounded-lg glass flex items-center justify-center text-white/60 text-xs">
                      +{receipt.items.length - 3}
                    </div>
                  )}
                </div>

                {/* Payment Status */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Paid
                  </div>
                  <div className="flex items-center gap-1.5 text-white/50 text-xs">
                    <CreditCard className="w-3 h-3" />
                    {receipt.paymentMethod}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleViewReceipt(receipt.orderId)}
                    className="flex-1 py-2.5 rounded-xl glass text-white text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4 text-scanova-cyan" /> View Receipt
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDownload(receipt)}
                    className="py-2.5 px-4 rounded-xl glass text-white text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4 text-scanova-purple" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function generateReceiptHtml(receipt: ReceiptData): string {
  const itemsHtml = receipt.items.map(item => `
    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e5e7eb;">
      <div>
        <p style="font-weight: 500; color: #111827;">${item.name}</p>
        <p style="font-size: 12px; color: #6b7280;">${item.brand} x${item.quantity}</p>
      </div>
      <p style="font-weight: 500;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</p>
    </div>
  `).join('');

  return `
    <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; background: white;">
      <div style="background: linear-gradient(90deg, #9333ea, #06b6d4); padding: 24px; text-align: center;">
        <h1 style="color: white; font-size: 24px; font-weight: bold; margin: 0;">SCANOVA</h1>
        <p style="color: rgba(255,255,255,0.9); font-size: 12px;">Cashierless Shopping Receipt</p>
      </div>
      <div style="padding: 20px;">
        <div style="border-bottom: 1px dashed #e5e7eb; padding-bottom: 16px; margin-bottom: 16px;">
          <p style="font-size: 12px; color: #6b7280;">Receipt No: <strong style="color: #9333ea;">${receipt.receiptNumber}</strong></p>
          <p style="font-size: 12px; color: #6b7280;">Order ID: <strong>${receipt.orderId}</strong></p>
          <p style="font-size: 12px; color: #6b7280;">Transaction ID: ${receipt.transactionId}</p>
          <p style="font-size: 12px; color: #6b7280;">Date: ${receipt.date} | ${receipt.time}</p>
        </div>
        <div style="padding: 16px 0;">
          <p style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 12px;">ITEMS</p>
          ${itemsHtml}
        </div>
        <div style="padding-top: 16px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: #6b7280;">Subtotal</span>
            <span>₹${receipt.subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span style="color: #6b7280;">GST (18%)</span>
            <span>₹${receipt.gst.toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 8px; border-top: 2px solid #111;">
            <span style="font-weight: bold;">TOTAL PAID</span>
            <span style="font-weight: bold; font-size: 20px; color: #9333ea;">₹${receipt.total.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 12px; color: #6b7280; margin: 0;">Payment Method</p>
              <p style="font-weight: 500; margin: 4px 0 0;">${receipt.paymentMethod}</p>
            </div>
            <span style="background: #22c55e; color: white; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 12px;">SUCCESS</span>
          </div>
        </div>
      </div>
      <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #374151; margin: 0; font-weight: 500;">Thank you for shopping with Scanova!</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 4px;">www.scanova.in</p>
      </div>
    </div>
  `;
}
