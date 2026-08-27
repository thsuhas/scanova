import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, CameraOff, Keyboard, ArrowLeft, ScanLine, AlertCircle, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import productsData from '../data/products.json';
import { brands } from '../data/brands';
import BrandBackground from '../components/BrandBackground';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: number;
  image: string;
}

const products: Product[] = productsData;

type ScannerStatus = 'idle' | 'requesting' | 'connected' | 'scanning' | 'detected' | 'error' | 'no-camera' | 'denied';

export default function Scanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get('brand');
  const brand = brands.find(b => b.id === brandId);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing scanner...');
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scannedRef = useRef(false);
  const isMountedRef = useRef(true);

  const handleBarcode = useCallback(async (code: string) => {
    console.log('[Scanner] Barcode detected:', code);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', code)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log('[Scanner] Product found:', data.name);
        navigate(`/product/${data.id}`);
      } else {
        console.log('[Scanner] Product not found for barcode:', code);
        navigate(`/not-found?barcode=${code}`);
      }
    } catch (err) {
      console.error('[Scanner] Database lookup error:', err);
      // Fallback search locally
      const product = products.find(p => p.id === code);
      if (product) {
        navigate(`/product/${product.id}`);
      } else {
        navigate(`/not-found?barcode=${code}`);
      }
    }
  }, [navigate]);

  const stopScanner = useCallback(() => {
    console.log('[Scanner] Stopping scanner...');
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {
        console.log('[Scanner] Error resetting reader:', e);
      }
      readerRef.current = null;
    }
    scannedRef.current = false;
    if (isMountedRef.current) {
      setStatus('idle');
      setStatusMessage('Scanner stopped');
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (scannedRef.current) return;

    console.log('[Scanner] Starting scanner...');
    setStatus('requesting');
    setStatusMessage('Requesting Camera Access...');
    setErrorMessage('');
    scannedRef.current = false;

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      console.log('[Scanner] Listing video devices...');
      const videoInputDevices = await reader.listVideoInputDevices();
      console.log('[Scanner] Found', videoInputDevices.length, 'video devices');

      if (videoInputDevices.length === 0) {
        console.error('[Scanner] No camera device found');
        setStatus('no-camera');
        setStatusMessage('No camera device found');
        setErrorMessage('No camera found. Please connect a camera and try again.');
        return;
      }

      // Prefer back camera on mobile devices
      let selectedDevice = videoInputDevices[0];
      const backCamera = videoInputDevices.find(
        device => device.label.toLowerCase().includes('back') ||
                  device.label.toLowerCase().includes('rear') ||
                  device.label.toLowerCase().includes('environment')
      );
      if (backCamera) {
        selectedDevice = backCamera;
        console.log('[Scanner] Using back camera:', backCamera.label);
      } else {
        console.log('[Scanner] Using camera:', selectedDevice.label);
      }

      if (!isMountedRef.current) {
        console.log('[Scanner] Component unmounted, aborting');
        return;
      }

      setStatus('connected');
      setStatusMessage('Camera Connected');

      // Small delay to ensure video element is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        console.error('[Scanner] Video element not found');
        setStatus('error');
        setStatusMessage('Video element not found');
        setErrorMessage('Failed to initialize video element. Please refresh and try again.');
        return;
      }

      console.log('[Scanner] Starting video decode...');
      setStatus('scanning');
      setStatusMessage('Scanning Barcode...');

      reader.decodeFromVideoDevice(selectedDevice.deviceId, videoRef.current, (result, err) => {
        if (!isMountedRef.current) return;

        if (result && !scannedRef.current) {
          console.log('[Scanner] Barcode detected in callback:', result.getText());
          scannedRef.current = true;
          setStatus('detected');
          setStatusMessage('Barcode Detected!');

          // Stop scanner immediately
          setTimeout(() => {
            stopScanner();
            handleBarcode(result.getText());
          }, 300);
        }

        if (err && !(err instanceof NotFoundException)) {
          // Only log non-NotFound errors
          console.log('[Scanner] Scanner error:', err.name, err.message);
        }
      });

      console.log('[Scanner] Scanner started successfully');

    } catch (err: any) {
      console.error('[Scanner] Camera error:', err);
      if (!isMountedRef.current) return;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setStatusMessage('Camera Access Denied');
        setErrorMessage('Camera access denied. Please allow camera permission and refresh the page.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('no-camera');
        setStatusMessage('No Camera Found');
        setErrorMessage('No camera device found. Please connect a camera and try again.');
      } else {
        setStatus('error');
        setStatusMessage('Scanner Error');
        setErrorMessage(`Camera error: ${err.message || 'Unknown error'}. Please refresh and try again.`);
      }
    }
  }, [stopScanner, handleBarcode]);

  // Auto-start scanner when component mounts
  useEffect(() => {
    console.log('[Scanner] Component mounted, auto-starting scanner...');
    isMountedRef.current = true;

    // Start scanner after a short delay to ensure DOM is ready
    const startTimer = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      console.log('[Scanner] Component unmounting, cleaning up...');
      isMountedRef.current = false;
      clearTimeout(startTimer);
      if (readerRef.current) {
        try {
          readerRef.current.reset();
        } catch (e) {
          console.log('[Scanner] Cleanup error:', e);
        }
        readerRef.current = null;
      }
    };
  }, [startScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    console.log('[Scanner] Manual barcode entry:', manualCode.trim());
    stopScanner();
    handleBarcode(manualCode.trim());
  };

  const handleRetry = () => {
    startScanner();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'requesting': return 'text-yellow-400';
      case 'connected': return 'text-blue-400';
      case 'scanning': return 'text-scanova-cyan';
      case 'detected': return 'text-green-400';
      case 'error':
      case 'denied': return 'text-red-400';
      case 'no-camera': return 'text-orange-400';
      default: return 'text-white/40';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden pb-6">
      {/* Brand-specific Animated Background */}
      <BrandBackground brandId={brandId || ''} />

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 glass-strong px-4 py-4 flex items-center gap-3"
      >
        <button
          onClick={() => { stopScanner(); navigate('/home'); }}
          className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-scanova-purple" />
          <h1 className="text-lg font-bold text-white">Scanner</h1>
        </div>
        {brand && (
          <div className="ml-auto px-3 py-1 rounded-full glass text-xs text-white/60">{brand.name}</div>
        )}
      </motion.div>

      {/* Scanner Content */}
      <div className="relative z-10 flex flex-col items-center px-4 py-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="glass rounded-3xl p-6 neon-border max-w-[420px] w-full"
        >
          {/* Status Bar */}
          <div className="flex items-center justify-center gap-2 mb-4 py-2 px-3 rounded-xl bg-white/5">
            {(status === 'requesting' || status === 'scanning') && (
              <Loader2 className="w-4 h-4 animate-spin text-scanova-cyan" />
            )}
            {status === 'detected' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
              >
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
            {(status === 'error' || status === 'denied' || status === 'no-camera') && (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {statusMessage}
            </span>
          </div>

          {/* Camera Preview */}
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 mb-5 border border-white/10">
            {status === 'scanning' || status === 'connected' ? (
              <>
                {/* Video Element */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />

                {/* Scanning Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Scanning Line */}
                  <motion.div
                    className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-scanova-purple to-transparent"
                    animate={{ top: ['15%', '85%', '15%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)' }}
                  />

                  {/* Corner Brackets */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-scanova-purple rounded-tl-lg" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-scanova-purple rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-scanova-purple rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-scanova-purple rounded-br-lg" />

                  {/* Center Target */}
                  <div className="absolute w-32 h-32 border-2 border-white/20 rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-scanova-purple/50" />
                  </div>
                </div>
              </>
            ) : status === 'requesting' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/40">
                <Loader2 className="w-12 h-12 text-scanova-purple animate-spin" />
                <p className="text-white/50 text-sm">Initializing camera...</p>
              </div>
            ) : status === 'detected' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-green-500/10">
                <ScanLine className="w-12 h-12 text-green-400" />
                <p className="text-green-400 text-sm font-medium">Barcode detected!</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/40">
                <Camera className="w-12 h-12 text-white/20" strokeWidth={1.5} />
                <p className="text-white/30 text-sm">
                  {status === 'denied' ? 'Camera access denied' :
                   status === 'no-camera' ? 'No camera found' :
                   status === 'error' ? 'Scanner error' : 'Scanner ready'}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {(status === 'idle' || status === 'error') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetry}
                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon"
              >
                <Camera className="w-4 h-4" /> Start Scanner
              </motion.button>
            )}

            {(status === 'connected' || status === 'scanning') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={stopScanner}
                className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <CameraOff className="w-4 h-4" /> Stop Scanner
              </motion.button>
            )}

            {(status === 'denied' || status === 'no-camera') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetry}
                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon"
              >
                <Camera className="w-4 h-4" /> Retry
              </motion.button>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30"
            >
              <p className="text-red-400 text-sm text-center">{errorMessage}</p>
            </motion.div>
          )}
        </motion.div>

        {/* Manual Barcode Entry */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5 neon-border max-w-[420px] w-full mt-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="w-4 h-4 text-scanova-cyan" />
            <h3 className="text-sm font-semibold text-white/80">Enter Barcode Manually</h3>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-3">
            <input
              type="text"
              placeholder="Enter a barcode"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl glass text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-scanova-purple/50"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold"
            >
              Search
            </motion.button>
          </form>
          <p className="text-white/30 text-xs mt-3 text-center">
            Can't scan? Type the barcode manually above.
          </p>
        </motion.div>

        {/* Debug Info (only in development) */}
        <div className="mt-4 text-white/20 text-xs text-center max-w-[420px]">
          <p>Available product IDs: {products.slice(0, 5).map(p => p.id).join(', ')}...</p>
        </div>
      </div>
    </div>
  );
}
