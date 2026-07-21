import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanLine, Search, ShoppingCart, User as UserIcon, Home as HomeIcon, ChevronRight } from 'lucide-react';
import { brands } from '../data/brands';
import { useCart } from '../contexts/CartContext';
import SearchView from '../components/SearchView';
import CartDrawer from '../components/CartDrawer';
import ProfileModal from '../components/ProfileModal';

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-10 -top-60 -left-60"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 30, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-8 top-1/2 -right-60"
        style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        animate={{ x: [0, -30, 20, 0], y: [0, 40, -30, 0], scale: [1.05, 0.9, 1.1, 1.05] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-6 bottom-0 left-1/3"
        style={{ background: 'radial-gradient(circle, #EC4899, transparent)' }}
        animate={{ x: [0, 30, -40, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-scanova-purple/30"
          style={{ left: `${10 + i * 12}%`, top: `${15 + (i % 4) * 20}%` }}
          animate={{ y: [0, -40, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        />
      ))}
    </div>
  );
}

function BrandCard({ brand, index, onClick }: { brand: typeof brands[0]; index: number; onClick: () => void }) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const id = Date.now();
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id });
      setTimeout(() => setRipple(null), 600);
    }
    onClick();
  };

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.06 * index,
        type: 'spring',
        stiffness: 180,
        damping: 18,
      }}
      whileHover={{
        y: -8,
        scale: 1.04,
        transition: { type: 'spring', stiffness: 400, damping: 15 },
      }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-300 group"
      style={{
        background: brand.gradient,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${brand.color}44`,
        boxShadow: `0 0 20px ${brand.glow}, 0 4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* Hover glow intensify */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{
          boxShadow: `inset 0 0 60px ${brand.glow}, 0 0 40px ${brand.glow}`,
        }}
      />

      {/* Subtle top highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-30"
        style={{ background: `linear-gradient(90deg, transparent, ${brand.color}, transparent)` }}
      />

      {/* Logo container */}
      <div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden p-3 transition-all duration-300 group-hover:scale-105"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${brand.color}30`,
          boxShadow: `0 0 15px ${brand.glow}40, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        <img
          src={brand.logo}
          alt={brand.name}
          className="w-12 h-12 object-contain transition-all duration-300 group-hover:scale-110"
          onError={e => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.setAttribute('data-fallback', 'true');
              parent.innerHTML = `<span style="font-size:18px;font-weight:700;color:${brand.color}">${brand.name.charAt(0)}</span>`;
            }
          }}
        />
        {/* Inner glow ring */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ boxShadow: `inset 0 0 20px ${brand.glow}60` }}
        />
      </div>

      {/* Brand name */}
      <p className="text-white font-semibold text-sm relative z-10">{brand.name}</p>

      {/* Tap to Shop */}
      <span
        className="flex items-center gap-1 text-xs font-medium relative z-10 transition-all duration-300 group-hover:gap-2"
        style={{ color: `${brand.color}99` }}
      >
        Tap to Shop
        <ChevronRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px opacity-20"
        style={{ background: `linear-gradient(90deg, transparent, ${brand.color}, transparent)` }}
      />

      {/* Ripple effect */}
      {ripple && (
        <motion.span
          key={ripple.id}
          initial={{ width: 0, height: 0, opacity: 0.5 }}
          animate={{ width: 300, height: 300, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute rounded-full pointer-events-none z-20"
          style={{
            left: ripple.x - 150,
            top: ripple.y - 150,
            background: `${brand.color}30`,
          }}
        />
      )}
    </motion.button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'cart' | 'profile'>('home');

  const handleBrandSelect = (brandId: string) => {
    navigate(`/scanner?brand=${brandId}`);
  };

  const tabs = [
    { id: 'home' as const, icon: HomeIcon, label: 'Home' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'cart' as const, icon: ShoppingCart, label: 'Cart' },
    { id: 'profile' as const, icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative pb-24">
      <AnimatedBackground />

      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 glass-strong px-6 py-4 flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-white" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-gradient">Scanova</h1>
      </motion.div>

      {activeTab === 'home' && (
        <div className="relative z-10 px-5 py-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-2xl font-bold text-white">Shop by Brand</h2>
            <p className="text-white/40 text-sm mt-1">Modern cashier-less shopping experience.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
            {brands.map((brand, i) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                index={i}
                onClick={() => handleBrandSelect(brand.id)}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'search' && <SearchView onSelectBrand={(id) => { setActiveTab('home'); handleBrandSelect(id); }} />}
      {activeTab === 'cart' && <CartDrawer onClose={() => setActiveTab('home')} />}
      {activeTab === 'profile' && <ProfileModal onClose={() => setActiveTab('home')} />}

      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-strong rounded-2xl px-2 py-2 flex items-center justify-around max-w-md mx-auto shadow-glass neon-border"
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors"
              >
                <motion.div animate={isActive ? { scale: 1.15 } : { scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-scanova-purple' : 'text-white/40'}`} strokeWidth={isActive ? 2.5 : 1.5} />
                </motion.div>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-scanova-purple' : 'text-white/30'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div layoutId="activeTab" className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full gradient-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                )}
                {tab.id === 'cart' && totalItems > 0 && (
                  <span className="absolute -top-0.5 right-2 w-4 h-4 rounded-full bg-scanova-pink text-[9px] text-white flex items-center justify-center font-bold">
                    {totalItems}
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
