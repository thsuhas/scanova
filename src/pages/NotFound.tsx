import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Package, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function NotFound() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const barcode = searchParams.get('barcode') || '';
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', brand: '', price: '', barcode });
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.brand || !formData.price) {
      alert('Please fill in all fields');
      return;
    }

    setIsSaving(true);
    try {
      const priceNum = parseFloat(formData.price);
      if (isNaN(priceNum)) {
        alert('Invalid price format');
        return;
      }

      // 1. Insert product into Supabase
      const { error: productError } = await supabase
        .from('products')
        .insert({
          id: formData.barcode,
          name: formData.name,
          brand: formData.brand,
          price: priceNum,
          size: 'M', // default size
          image: 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600' // default placeholder
        });

      if (productError) throw productError;

      // 2. Initialize stock in inventory
      const { error: invError } = await supabase
        .from('inventory')
        .insert({
          product_id: formData.barcode,
          stock: 20
        });

      if (invError) throw invError;

      setShowModal(false);
      navigate(`/product/${formData.barcode}`);
    } catch (err) {
      console.error('Error mapping product:', err);
      alert('Failed to map product. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative flex flex-col">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-10 top-1/4 left-1/2 -translate-x-1/2"
        style={{ background: 'radial-gradient(circle, #EF4444, transparent)' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 glass-strong px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Product Lookup</h1>
      </motion.div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6"
        >
          <Package className="w-10 h-10 text-red-400" strokeWidth={1.5} />
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-white mb-2">Product Not Found</motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-white/40 text-sm mb-2">No product matches this barcode.</motion.p>

        {barcode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="px-4 py-2 rounded-xl glass text-scanova-cyan font-mono text-sm mb-8">
            Barcode: {barcode}
          </motion.div>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className="px-8 py-3 rounded-xl gradient-primary text-white font-semibold flex items-center gap-2 shadow-neon">
          <Plus className="w-4 h-4" /> Add / Map Product
        </motion.button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-strong rounded-3xl p-6 neon-border max-w-sm w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Map Product</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg glass">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                <input placeholder="Product Name" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-scanova-purple/50" />
                <input placeholder="Brand" value={formData.brand}
                  onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-scanova-purple/50" />
                <input placeholder="Price (in ₹)" type="number" value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-scanova-purple/50" />
                <input placeholder="Barcode ID" value={formData.barcode} readOnly
                  className="w-full px-4 py-3 rounded-xl glass text-white/50 placeholder-white/30 text-sm" />
              </div>
              <motion.button 
                whileTap={{ scale: 0.97 }} 
                onClick={handleSaveProduct}
                disabled={isSaving}
                className="w-full mt-5 py-3.5 rounded-xl gradient-primary text-white font-semibold shadow-neon disabled:opacity-50 flex items-center justify-center gap-2">
                {isSaving ? 'Saving...' : 'Save Product'}
              </motion.button>
              <p className="text-white/20 text-xs text-center mt-3">This is a demo feature</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
