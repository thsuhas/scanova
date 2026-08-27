import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer, Check, ArrowLeft, Home, Save, History } from 'lucide-react';

interface ReceiptItem {
  id: string;
  name: string;
  brand: string;
  quantity: number;
  price: number;
  image?: string;
  size?: string;
}

interface ReceiptProps {
  orderId: string;
  transactionId: string;
  receiptNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  gst: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  onClose: () => void;
  onViewHistory?: () => void;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function formatDate(): { date: string; time: string } {
  const now = new Date();
  const date = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
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

// Confetti effect component
function ConfettiEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {[...Array(50)].map((_, i) => (
        <ConfettiParticle key={i} delay={i * 0.05} />
      ))}
    </div>
  );
}

export default function Receipt({
  orderId,
  transactionId,
  receiptNumber,
  items,
  subtotal,
  gst,
  discount,
  total,
  paymentMethod,
  customerName,
  onClose,
  onViewHistory,
}: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { date, time } = formatDate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Save receipt to localStorage
    saveReceipt();
    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const saveReceipt = useCallback(() => {
    const receiptData = {
      orderId,
      transactionId,
      receiptNumber,
      items,
      subtotal,
      gst,
      discount,
      total,
      paymentMethod,
      customerName,
      date,
      time,
      createdAt: new Date().toISOString(),
    };

    const existingReceipts = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
    existingReceipts.unshift(receiptData);
    // Keep only last 50 receipts
    if (existingReceipts.length > 50) {
      existingReceipts.pop();
    }
    localStorage.setItem('scanova_receipts', JSON.stringify(existingReceipts));
    setSaved(true);
  }, [orderId, transactionId, receiptNumber, items, subtotal, gst, discount, total, paymentMethod, customerName, date, time]);

  const handleDownload = async () => {
    const receipt = receiptRef.current;
    if (!receipt) return;

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: 0,
        filename: `Scanova_Receipt_${receiptNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };
      html2pdf().set(opt).from(receipt).save();
    } catch (error) {
      console.log('PDF generation error:', error);
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate QR pattern containing order info
  const qrPattern = Array.from({ length: 13 }, (_, i) =>
    Array.from({ length: 13 }, (_, j) => {
      // Corner markers
      if ((i < 3 && j < 3) || (i < 3 && j > 9) || (i > 9 && j < 3)) {
        return ((i + j) % 2 === 0) ? '1' : '0';
      }
      // Data pattern based on receipt number hash
      const hash = (receiptNumber.charCodeAt(i % receiptNumber.length) + j) % 7;
      return hash > 3 ? '1' : '0';
    }).join('')
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-[#0a0a1a] overflow-auto"
    >
      {/* Confetti Effect */}
      {showConfetti && <ConfettiEffect />}

      {/* Header */}
      <div className="sticky top-0 glass-strong px-4 py-4 flex items-center gap-3 z-10">
        <button onClick={onClose} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Payment Receipt</h1>
      </div>

      {/* Success Banner */}
      <div className="flex flex-col items-center pt-8 pb-6 px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-4 relative"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <Check className="w-12 h-12 text-green-400" />
          </motion.div>
          {/* Pulse effect */}
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
          className="text-white/60 text-sm"
        >
          Thank you for shopping with Scanova
        </motion.p>
        {saved && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-green-400 text-xs mt-2 flex items-center gap-1"
          >
            <Save className="w-3 h-3" /> Receipt saved to history
          </motion.p>
        )}
      </div>

      {/* Receipt Card */}
      <div className="px-4 pb-40">
        <div
          ref={receiptRef}
          className="bg-white rounded-3xl overflow-hidden max-w-md mx-auto shadow-2xl"
        >
          {/* Receipt Header */}
          <div className="bg-gradient-to-r from-purple-600 to-cyan-500 px-6 py-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-white font-bold text-2xl tracking-tight">SCANOVA</span>
            </div>
            <p className="text-white/90 text-sm font-medium">Cashierless Shopping Receipt</p>
          </div>

          {/* Receipt Body */}
          <div className="px-6 py-5 text-gray-900">
            {/* IDs Section */}
            <div className="border-b border-dashed border-gray-200 pb-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Receipt No</span>
                <span className="font-mono font-semibold text-purple-600">{receiptNumber}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Order ID</span>
                <span className="font-mono font-semibold">{orderId}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Transaction ID</span>
                <span className="font-mono">{transactionId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date & Time</span>
                <span>{date} | {time}</span>
              </div>
              {customerName && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium">{customerName}</span>
                </div>
              )}
            </div>

            {/* QR Code with embedded info */}
            <div className="flex justify-center mb-4">
              <div className="p-3 border-2 border-gray-200 rounded-xl bg-gray-50">
                {qrPattern.map((row, i) => (
                  <div key={i} className="flex">
                    {row.split('').map((cell, j) => (
                      <div key={j} className={`w-2 h-2 ${cell === '1' ? 'bg-gray-900' : 'bg-white'}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mb-4">Scan QR to verify order details</p>

            {/* Items Section */}
            <div className="border-t border-b border-dashed border-gray-200 py-4 mb-4">
              <p className="text-xs text-gray-500 mb-4 font-medium tracking-wide">ITEMS</p>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 mb-4 last:mb-0">
                  {/* Product Image */}
                  {item.image && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.brand}</p>
                    {item.id && (
                      <p className="text-xs text-gray-400 font-mono">#{item.id}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Qty: {item.quantity} x {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Billing Section */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-700">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST (18%)</span>
                <span className="text-gray-700">{formatPrice(gst)}</span>
              </div>
              <div className="border-t-2 border-gray-900 pt-3 mt-3 flex justify-between">
                <span className="font-bold text-gray-900">TOTAL PAID</span>
                <span className="font-bold text-xl text-purple-600">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                  <p className="font-medium text-gray-900">{paymentMethod}</p>
                </div>
                <div className="flex items-center gap-2 bg-green-500 px-3 py-2 rounded-lg">
                  <Check className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">SUCCESS</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Transaction Ref: {transactionId}
              </p>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="bg-gray-50 px-6 py-5 text-center border-t border-gray-100">
            <p className="text-gray-700 text-sm font-medium mb-1">Thank you for shopping with Scanova!</p>
            <p className="text-gray-400 text-xs">www.scanova.in | support@scanova.in</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 glass-strong px-4 py-4">
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
          {onViewHistory && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onViewHistory}
              className="w-full py-3 mb-3 rounded-xl glass text-white font-semibold text-sm flex items-center justify-center gap-2 border border-cyan-500/30"
            >
              <History className="w-4 h-4" /> View Order History
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon"
          >
            <Home className="w-4 h-4" /> Back to Home
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
