import { motion } from 'framer-motion';

interface BrandBackgroundProps {
  brandId: string;
}

export default function BrandBackground({ brandId }: BrandBackgroundProps) {
  const getBackground = () => {
    switch (brandId) {
      case 'nike':
        return <NikeBackground />;
      case 'adidas':
        return <AdidasBackground />;
      case 'puma':
        return <PumaBackground />;
      case 'zara':
        return <ZaraBackground />;
      case 'hm':
        return <HMBackground />;
      case 'gucci':
        return <GucciBackground />;
      case 'louisvuitton':
        return <LouisVuittonBackground />;
      case 'levis':
        return <LevisBackground />;
      case 'uniqlo':
        return <UniqloBackground />;
      case 'tommy':
        return <TommyBackground />;
      case 'calvinklein':
        return <CalvinKleinBackground />;
      case 'mango':
        return <MangoBackground />;
      case 'underarmour':
        return <UnderArmourBackground />;
      case 'reebok':
        return <ReebokBackground />;
      default:
        return <DefaultBackground />;
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {getBackground()}
    </div>
  );
}

function NikeBackground() {
  return (
    <>
      {/* Speed streaks */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 rounded-full opacity-20"
          style={{
            width: `${150 + i * 80}px`,
            background: `linear-gradient(90deg, transparent, #8B5CF6, #3B82F6, transparent)`,
            top: `${15 + i * 18}%`,
            left: '-200px',
          }}
          animate={{
            x: ['0vw', '130vw'],
          }}
          transition={{
            duration: 2 + i * 0.5,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.8,
          }}
        />
      ))}
      {/* Neon particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: i % 2 === 0 ? '#8B5CF6' : '#3B82F6',
            boxShadow: `0 0 10px ${i % 2 === 0 ? '#8B5CF6' : '#3B82F6'}`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}
      {/* Energy glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-10 -bottom-40 -right-40"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />
    </>
  );
}

function AdidasBackground() {
  return (
    <>
      {/* Diagonal lines */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-0.5 bg-white opacity-10"
          style={{
            width: '120%',
            transform: 'rotate(-45deg)',
            left: '-10%',
            top: `${10 + i * 25}%`,
          }}
          animate={{ x: [-50, 50, -50] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Geometric shapes */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`shape-${i}`}
          className="absolute border border-white/10 rotate-45"
          style={{
            width: `${60 + i * 30}px`,
            height: `${60 + i * 30}px`,
            left: `${10 + i * 15}%`,
            top: `${10 + (i % 3) * 30}%`,
          }}
          animate={{
            rotate: [45, 135, 45],
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 6 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.5,
          }}
        />
      ))}
      {/* Dynamic energy */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-10 top-1/4 -left-40"
        style={{ background: 'radial-gradient(circle, #00D4FF, transparent)' }}
        animate={{ scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function PumaBackground() {
  return (
    <>
      {/* Motion trails */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 rounded-full opacity-30"
          style={{
            width: `${100 + i * 40}px`,
            background: `linear-gradient(90deg, transparent, #EC4899, #EF4444, transparent)`,
            top: `${20 + i * 15}%`,
            right: '-150px',
          }}
          animate={{ x: ['130vw', '-130vw'] }}
          transition={{
            duration: 1.5 + i * 0.3,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.4,
          }}
        />
      ))}
      {/* Jumping particles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={`jump-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full bg-red-500/40"
          style={{
            left: `${Math.random() * 100}%`,
            bottom: '0',
          }}
          animate={{
            y: [0, -300 - Math.random() * 200, 0],
            opacity: [0, 0.6, 0],
            x: [0, (Math.random() - 0.5) * 100],
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 0.2,
          }}
        />
      ))}
      {/* Red glow */}
      <motion.div
        className="absolute w-[350px] h-[350px] rounded-full opacity-15 -top-20 right-0"
        style={{ background: 'radial-gradient(circle, #EC4899, transparent)' }}
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function ZaraBackground() {
  return (
    <>
      {/* Luxury shimmer */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.15), transparent)`,
            top: `${10 + i * 12}%`,
          }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
            x: [-100, 100, -100],
          }}
          transition={{
            duration: 5 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.7,
          }}
        />
      ))}
      {/* Elegant floating lights */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={`light-${i}`}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(212, 175, 55, 0.4), transparent)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            opacity: [0.1, 0.4, 0.1],
            scale: [1, 2, 1],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.5,
          }}
        />
      ))}
      {/* Premium feel */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-5 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, #D4AF37, transparent)' }}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function HMBackground() {
  return (
    <>
      {/* Fashion runway lights */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-px"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.3), transparent)`,
            top: `${30 + i * 20}%`,
          }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scaleX: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 1,
          }}
        />
      ))}
      {/* Soft floating glow */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`glow-${i}`}
          className="absolute w-20 h-20 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1), transparent)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.6,
          }}
        />
      ))}
    </>
  );
}

function GucciBackground() {
  return (
    <>
      {/* Luxury particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: i % 3 === 0 ? 'rgba(212, 175, 55, 0.3)' : 'rgba(0, 87, 60, 0.2)',
            boxShadow: i % 3 === 0 ? '0 0 10px rgba(212, 175, 55, 0.3)' : 'none',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -50, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 5 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
      {/* Golden shimmer */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`shimmer-${i}`}
          className="absolute w-full h-0.5"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.2), transparent)',
            top: `${20 + i * 20}%`,
          }}
          animate={{
            x: [-200, 200, -200],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 1.5,
          }}
        />
      ))}
      {/* Green luxury glow */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 top-0 left-1/4"
        style={{ background: 'radial-gradient(circle, #005B3C, transparent)' }}
        animate={{ scale: [1, 1.3, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function LouisVuittonBackground() {
  return (
    <>
      {/* Gold sparkles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: 'rgba(212, 175, 55, 0.5)',
            boxShadow: '0 0 8px rgba(212, 175, 55, 0.5)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 2, 1],
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}
      {/* Premium designer background */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-10 -top-40 -right-40"
        style={{ background: 'radial-gradient(circle, #8B4513, #D4AF37, transparent)' }}
        animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Brown luxury gradient */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10 bottom-0 left-0"
        style={{ background: 'radial-gradient(circle, #5C3D2E, transparent)' }}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function LevisBackground() {
  return (
    <>
      {/* Denim-inspired lines */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(196, 18, 48, 0.2), rgba(249, 115, 22, 0.2), transparent)`,
            top: `${15 + i * 15}%`,
          }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
            x: [-50, 50, -50],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.8,
          }}
        />
      ))}
      {/* Red tab glow */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 top-1/3 -left-40"
        style={{ background: 'radial-gradient(circle, #C41230, transparent)' }}
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function UniqloBackground() {
  return (
    <>
      {/* Red box inspired */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-lg"
          style={{
            width: `${80 + i * 20}px`,
            height: `${80 + i * 20}px`,
            border: '1px solid rgba(230, 0, 18, 0.1)',
            left: `${15 + i * 20}%`,
            top: `${10 + (i % 2) * 40}%`,
          }}
          animate={{
            rotate: [0, 90, 0],
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.5,
          }}
        />
      ))}
      {/* Red glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-10 top-0 right-0"
        style={{ background: 'radial-gradient(circle, #E60012, transparent)' }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function TommyBackground() {
  return (
    <>
      {/* Flag-inspired waves */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${i === 0 ? 'rgba(0, 32, 91, 0.2)' : i === 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(186, 12, 47, 0.2)'}, transparent)`,
            top: `${30 + i * 15}%`,
          }}
          animate={{
            x: [-100, 100, -100],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 6 + i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i,
          }}
        />
      ))}
      {/* Animated flag colors */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`flag-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: i % 3 === 0 ? 'rgba(0, 32, 91, 0.3)' : i % 3 === 1 ? 'rgba(186, 12, 47, 0.3)' : 'rgba(255, 255, 255, 0.2)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random(),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
    </>
  );
}

function CalvinKleinBackground() {
  return (
    <>
      {/* Minimal premium movement */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
            top: `${25 + i * 25}%`,
          }}
          animate={{
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 2,
          }}
        />
      ))}
      {/* Soft luxury lighting */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-5 top-1/4 right-1/4"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent)' }}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Subtle black accent */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10 bottom-0 left-0"
        style={{ background: 'radial-gradient(circle, #111, transparent)' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function MangoBackground() {
  return (
    <>
      {/* Warm moving gradients */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${200 + i * 50}px`,
            height: `${200 + i * 50}px`,
            background: `radial-gradient(circle, ${i % 2 === 0 ? 'rgba(251, 146, 60, 0.1)' : 'rgba(212, 175, 55, 0.1)'}, transparent)`,
            left: `${10 + i * 15}%`,
            top: `${10 + (i % 3) * 25}%`,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.8,
          }}
        />
      ))}
      {/* Elegant fashion glow */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`mango-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: 'rgba(251, 146, 60, 0.3)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.5,
          }}
        />
      ))}
    </>
  );
}

function UnderArmourBackground() {
  return (
    <>
      {/* Performance energy effects */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-0.5 rounded-full"
          style={{
            width: `${150 + i * 30}px`,
            background: `linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.2), rgba(59, 130, 246, 0.2), transparent)`,
            top: `${20 + i * 12}%`,
            left: '-200px',
          }}
          animate={{ x: ['0vw', '130vw'] }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.6,
          }}
        />
      ))}
      {/* Metallic motion */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={`ua-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: i % 2 === 0 ? 'rgba(148, 163, 184, 0.4)' : 'rgba(59, 130, 246, 0.3)',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + Math.random(),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}
    </>
  );
}

function ReebokBackground() {
  return (
    <>
      {/* Fitness energy particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: i % 2 === 0 ? 'rgba(228, 27, 23, 0.4)' : 'rgba(255, 255, 255, 0.2)',
            boxShadow: i % 2 === 0 ? '0 0 6px rgba(228, 27, 23, 0.3)' : 'none',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -60 - Math.random() * 40, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 3 + Math.random(),
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 0.25,
          }}
        />
      ))}
      {/* Motion streaks */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`streak-${i}`}
          className="absolute h-1 rounded-full"
          style={{
            width: `${100 + i * 40}px`,
            background: `linear-gradient(90deg, transparent, rgba(228, 27, 23, 0.3), rgba(255, 255, 255, 0.2), transparent)`,
            top: `${30 + i * 15}%`,
            right: '-150px',
          }}
          animate={{ x: ['130vw', '-130vw'] }}
          transition={{
            duration: 1.8 + i * 0.2,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 0.5,
          }}
        />
      ))}
      {/* Red energy glow */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 bottom-0 right-0"
        style={{ background: 'radial-gradient(circle, #E41B17, transparent)' }}
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

function DefaultBackground() {
  return (
    <>
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-10 -top-40 right-0"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-8 bottom-0 -left-40"
        style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        animate={{ scale: [1.1, 0.9, 1.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}
