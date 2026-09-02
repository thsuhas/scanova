import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, ScanLine, ShoppingCart, LogOut, Receipt, History, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import OrderHistory from './OrderHistory';

interface Props {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: Props) {
  const { currentUser, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orderCount, setOrderCount] = useState<number>(() => {
    const receipts = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
    return receipts.length;
  });

  useEffect(() => {
    const fetchOrderCount = async () => {
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
          const { count, error } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

          if (!error && typeof count === 'number') {
            const localReceipts = JSON.parse(localStorage.getItem('scanova_receipts') || '[]');
            setOrderCount(Math.max(count, localReceipts.length));
          }
        } catch (e) {
          // fallback to local count
        }
      }
    };

    fetchOrderCount();
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleViewHistory = () => {
    setShowOrderHistory(true);
  };

  const handleCloseHistory = () => {
    setShowOrderHistory(false);
  };

  if (showOrderHistory) {
    return <OrderHistory onClose={handleCloseHistory} />;
  }

  const stats = [
    { icon: ScanLine, label: 'Scanned Products', value: '0' },
    { icon: ShoppingCart, label: 'Cart Items', value: totalItems.toString() },
    { icon: Receipt, label: 'Orders', value: orderCount.toString() },
  ];

  const details = [
    { icon: User, label: 'Username', value: currentUser?.username || '\u2014' },
    { icon: Mail, label: 'Email', value: currentUser?.email || '\u2014' },
    { icon: Shield, label: 'Account Status', value: 'Active' },
    { icon: Calendar, label: 'Member Since', value: 'Today' },
  ];

  return (
    <div className="relative z-10 px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 neon-border text-center mb-4"
      >
        <div className="w-20 h-20 rounded-full gradient-primary mx-auto flex items-center justify-center mb-3 shadow-neon">
          <span className="text-2xl font-bold text-white">
            {currentUser?.username?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white">{currentUser?.username}</h3>
        <p className="text-white/40 text-sm">{currentUser?.email}</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-3 text-center neon-border"
            >
              <Icon className="w-4 h-4 text-scanova-cyan mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{stat.value}</p>
              <p className="text-white/40 text-[10px]">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Order History Button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleViewHistory}
        className="w-full glass rounded-xl p-4 neon-border flex items-center justify-between mb-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <History className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold">Order History</p>
            <p className="text-white/40 text-xs">View all your past orders</p>
          </div>
        </div>
        <ArrowLeft className="w-5 h-5 text-white/40 rotate-180" />
      </motion.button>

      <div className="glass rounded-2xl p-4 neon-border space-y-3 mb-6">
        {details.map((d, i) => {
          const Icon = d.icon;
          return (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              <Icon className="w-4 h-4 text-white/30 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white/40 text-xs">{d.label}</p>
                <p className="text-white text-sm font-medium">{d.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-white/15 text-xs text-center mb-4">Scanova v1.0.0</p>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleLogout}
        className="w-full py-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Log Out
      </motion.button>
    </div>
  );
}
