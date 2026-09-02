import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Splash() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        navigate(isAuthenticated ? '/home' : '/auth', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [navigate, isAuthenticated, loading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0a1a]">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        animate={{ x: [0, 50, -30, 0], y: [0, -40, 30, 0], scale: [1, 1.2, 0.9, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        animate={{ x: [0, -40, 30, 0], y: [0, 50, -40, 0], scale: [1.1, 0.9, 1.2, 1.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #EC4899, transparent)' }}
        animate={{ x: [0, 30, -50, 0], y: [0, -30, 20, 0], scale: [0.9, 1.1, 1, 0.9] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="relative z-10"
      >
        <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center shadow-neon">
          <ScanLine className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="mt-8 text-5xl font-bold text-gradient tracking-tight relative z-10"
      >
        Scanova
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-3 text-white/40 text-sm tracking-widest uppercase relative z-10"
      >
        Scan. Shop. Go.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-12 w-48 h-1 rounded-full bg-white/10 overflow-hidden relative z-10"
      >
        <motion.div
          className="h-full rounded-full gradient-primary"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 1.8, delay: 1.2, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}
