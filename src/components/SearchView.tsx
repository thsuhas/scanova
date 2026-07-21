import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X } from 'lucide-react';
import { brands } from '../data/brands';

interface Props {
  onSelectBrand: (id: string) => void;
}

export default function SearchView({ onSelectBrand }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="relative z-10 px-6 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
        <input
          autoFocus
          type="text"
          placeholder="Search brands..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3.5 rounded-xl glass-strong text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 text-sm"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="w-4 h-4 text-white/30" />
          </button>
        )}
      </motion.div>
      <div className="mt-4 space-y-2">
        {filtered.map((brand, i) => (
          <motion.button
            key={brand.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectBrand(brand.id)}
            className="w-full glass rounded-xl p-4 flex items-center gap-4 neon-border hover:shadow-neon transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden p-1.5">
              <img src={brand.logo} alt={brand.name} className="w-6 h-6 object-contain transition-transform group-hover:scale-110"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span className="text-white font-medium text-sm">{brand.name}</span>
          </motion.button>
        ))}
        {query && filtered.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">No brands found for &quot;{query}&quot;</p>
        )}
        {!query && (
          <div className="py-8 text-center">
            <SearchIcon className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Type to search brands</p>
          </div>
        )}
      </div>
    </div>
  );
}
