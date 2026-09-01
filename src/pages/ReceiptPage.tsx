import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Printer, Check, Home, History, AlertCircle } from 'lucide-react';
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
  exitStatus?: string;
}


function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

// Confetti particle component
function ConfettiParticle({ delay }: { delay: number }) {
  const colors = ['#8B5CF6', '#06B6D4', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const startX = Math.random() * 100;
  const size = 6 + Math.random() * 8;

  return (
    <motion.div
      initial={{ y: -20, x: `${startX}vw`, rotate: 0, opacity: 1 }}
      animate={{
        y: '100vh',
        x: `${startX + (Math.random() - 0.5) * 30}vw`,
        rotate: 720,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        delay,
        ease: 'easeOut',
      }}
      className="fixed top-0 z-[60] pointer-events-none"
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
    />
  );
}

function ConfettiEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {[...Array(50)].map((_, i) => (
        <ConfettiParticle key={i} delay={i * 0.05} />
      ))}
    </div>
  );
}

export default function ReceiptPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setNotFound(true);
      return;
    }

    const fetchReceipt = async () => {
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
            user_id,
            exit_status,
            payments (
              transaction_id,
              receipt_number
            )
          `)
          .eq('order_id', orderId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          let customerName = 'Customer';
          if (data.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', data.user_id)
              .maybeSingle();
            if (profileData?.username) {
              customerName = profileData.username;
            }
          }

          const dateObj = new Date(data.created_at);
          const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

          const payment = (data.payments as any)?.[0];
          setReceipt({
            orderId: data.order_id,
            transactionId: payment?.transaction_id || `TXN-FALLBACK`,
            receiptNumber: payment?.receipt_number || `RCPT-FALLBACK`,
            items: data.items || [],
            subtotal: Number(data.subtotal),
            gst: Number(data.gst),
            discount: 0,
            total: Number(data.total),
            paymentMethod: data.payment_method,
            customerName,
            date: dateStr,
            time: timeStr,
            createdAt: data.created_at,
            exitStatus: data.exit_status || 'pending',
          });
        } else {
          // Fallback to local storage
          const storedReceipts = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
          const foundReceipt = storedReceipts.find((r: ReceiptData) => r.orderId === orderId);
          if (foundReceipt) {
            setReceipt(foundReceipt);
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setNotFound(true);
      }
    };

    fetchReceipt();

    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [orderId]);

  const handleDownload = useCallback(async () => {
    if (!receipt || !receiptRef.current) return;

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `Scanova_Receipt_${receipt.receiptNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };
      html2pdf().set(opt).from(receiptRef.current).save();
    } catch (error) {
      console.log('PDF generation error:', error);
      window.print();
    }
  }, [receipt]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Generate QR pattern
  const qrPattern = receipt ? Array.from({ length: 13 }, (_, i) =>
    Array.from({ length: 13 }, (_, j) => {
      if ((i < 3 && j < 3) || (i < 3 && j > 9) || (i > 9 && j < 3)) {
        return ((i + j) % 2 === 0) ? '1' : '0';
      }
      const hash = (receipt.receiptNumber.charCodeAt(i % receipt.receiptNumber.length) + j) % 7;
      return hash > 3 ? '1' : '0';
    }).join('')
  ) : [];

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center px-6">
        <AlertCircle className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No Receipt Found</h2>
        <p className="text-white/40 text-sm text-center mb-6">
          The receipt you're looking for doesn't exist or has been removed.
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/home')}
          className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Back to Home
        </motion.button>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-scanova-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#0a0a1a] overflow-auto pb-28 print:bg-white print:pb-0"
    >
      {/* Confetti Effect */}
      {showConfetti && <div className="print:hidden"><ConfettiEffect /></div>}

      {/* Header */}
      <div className="sticky top-0 glass-strong px-4 py-4 flex items-center gap-3 z-10 print:hidden border-b border-white/5">
        <button onClick={() => navigate('/home')} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
          <Home className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">Payment Receipt</h1>
      </div>

      {/* Success Banner */}
      <div className="flex flex-col items-center pt-8 pb-6 px-4 print:hidden">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-4 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <Check className="w-10 h-10 text-green-400" />
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-green-500"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white mb-1"
        >
          Payment Successful!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/40 text-sm"
        >
          Thank you for shopping with Scanova
        </motion.p>
      </div>

      {/* Receipt Card */}
      <div className="px-4 print:p-0 print:m-0">
        <div
          ref={receiptRef}
          className="bg-white rounded-3xl overflow-hidden max-w-md mx-auto shadow-2xl print:shadow-none print:rounded-none print:w-full print:max-w-none print:border-0"
        >
          {/* Receipt Header */}
          <div className="bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-6 text-center print:from-white print:to-white print:text-black print:border-b print:border-gray-200">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur print:border print:border-gray-200 print:bg-gray-50">
                <span className="text-white font-extrabold text-xl print:text-purple-600">S</span>
              </div>
              <span className="text-white font-extrabold text-2xl tracking-tight print:text-black">SCANOVA</span>
            </div>
            <p className="text-white/90 text-sm font-medium print:text-gray-500">Smart Self-Checkout</p>
          </div>

          {/* Receipt Body */}
          <div className="px-6 py-5 text-gray-900">
            {/* IDs Section */}
            <div className="border-b border-dashed border-gray-200 pb-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">Receipt No</span>
                <span className="font-mono font-bold text-purple-600 print:text-purple-700">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">Order ID</span>
                <span className="font-mono font-semibold text-gray-700">{receipt.orderId}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">Transaction ID</span>
                <span className="font-mono text-gray-600">{receipt.transactionId}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400 font-medium">Date & Time</span>
                <span className="text-gray-700">{receipt.date} | {receipt.time}</span>
              </div>
              {receipt.customerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-medium">Customer</span>
                  <span className="font-semibold text-gray-700">{receipt.customerName}</span>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center mb-4">
              <div className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 print:bg-white print:border-gray-300">
                {qrPattern.map((row, i) => (
                  <div key={i} className="flex">
                    {row.split('').map((cell, j) => (
                      <div key={j} className={`w-2 h-2 ${cell === '1' ? 'bg-gray-900' : 'bg-white'}`} />
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] font-medium text-gray-400 mt-2">Scan QR to verify order details</p>
            </div>

            {/* Items Section */}
            <div className="border-t border-b border-dashed border-gray-200 py-4 mb-4">
              <p className="text-xs text-gray-400 mb-4 font-bold tracking-widest uppercase">Items</p>
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex gap-3 mb-4 last:mb-0">
                  {item.image && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 print:border-gray-200">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 font-medium">{item.brand} {item.size ? `• Size: ${item.size}` : ''}</p>
                    {item.id && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{item.id}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 font-medium">
                      Qty: {item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-950">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Billing Section */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-800 font-medium">{formatPrice(receipt.subtotal)}</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Discount</span>
                  <span>-{formatPrice(receipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST (18%)</span>
                <span className="text-gray-800 font-medium">{formatPrice(receipt.gst)}</span>
              </div>
              <div className="border-t-2 border-gray-950 pt-3 mt-3 flex justify-between items-center">
                <span className="font-extrabold text-gray-950 tracking-wide text-sm">TOTAL PAID</span>
                <span className="font-extrabold text-2xl text-purple-600 print:text-purple-800">{formatPrice(receipt.total)}</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="bg-green-50/50 border border-green-200/60 rounded-xl px-4 py-4 mb-2 print:border-gray-200 print:bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Payment Method</p>
                  <p className="font-bold text-gray-900 text-sm">{receipt.paymentMethod}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-green-600/10 border border-green-500/20 px-3 py-1.5 rounded-lg print:border-gray-400 print:bg-white">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-extrabold text-xs tracking-wider uppercase">Success</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 font-mono">
                Transaction Ref: {receipt.transactionId}
              </p>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="bg-gray-50/50 px-6 py-5 text-center border-t border-gray-100 print:bg-white print:border-gray-200">
            <p className="text-gray-700 text-sm font-semibold mb-1">Thank you for shopping with Scanova!</p>
            <p className="text-gray-400 text-xs">Smart Self-Checkout</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 glass-strong px-4 py-4 print:hidden">
        <div className="max-w-md mx-auto">
          <div className="flex gap-3 mb-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl glass neon-border text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download PDF
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePrint}
              className="flex-1 py-3 rounded-xl glass neon-border text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon"
          >
            <Home className="w-4 h-4" /> Back to Home
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
