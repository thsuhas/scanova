import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, CameraOff, Keyboard, ArrowLeft, ScanLine, AlertCircle, Loader2, ShieldAlert, AlertTriangle, RefreshCw, Ban } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException, DecodeHintType, BarcodeFormat } from '@zxing/library';
import productsData from '../data/products.json';
import { brands } from '../data/brands';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { evaluateBarcodeTampering, computeCombinedSecurity, saveBarcodeTamperingDetection } from '../services/fraudService';
import BrandBackground from '../components/BrandBackground';

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

interface TamperingAlertState {
  isOpen: boolean;
  barcode: string;
  score: number;
  level: 'low' | 'medium' | 'high';
  tamperingType: string;
}

export default function Scanner() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get('brand');
  const brand = brands.find(b => b.id === brandId);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing scanner...');
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tamperingAlert, setTamperingAlert] = useState<TamperingAlertState | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const scannedRef = useRef(false);
  const isMountedRef = useRef(true);
  const handleBarcodeRef = useRef<((code: string, snapshot?: string | null) => Promise<void>) | null>(null);


  const stopScanner = useCallback(() => {
    console.log('[Scanner] Stopping scanner...');
    
    // Explicitly release camera tracks to prevent resource leaks
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      } catch (e) {
        console.log('[Scanner] Error stopping media tracks:', e);
      }
      videoRef.current.srcObject = null;
    }

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
      // Optimize configuration by enabling only specific retail formats
      const hints = new Map();
      const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

      const reader = new BrowserMultiFormatReader(hints);
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

      if (!videoRef.current || !isMountedRef.current) return;

      console.log('[Scanner] Starting video decode...');
      setStatus('scanning');
      setStatusMessage('Scanning Barcode...');

      // Start decoding
      reader.decodeFromVideoDevice(selectedDevice.deviceId, videoRef.current, (result, err) => {
        if (!isMountedRef.current) return;

        if (result && !scannedRef.current) {
          console.log('[Scanner] Barcode detected in callback:', result.getText());
          scannedRef.current = true;
          setStatus('detected');
          setStatusMessage('Barcode Detected!');

          // Capture current video frame snapshot for CV physical tampering inspection
          let snapshot: string | null = null;
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                snapshot = canvas.toDataURL('image/png');
              }
            } catch (e) {
              console.warn('[Scanner] Could not capture frame snapshot for CV check:', e);
            }
          }

          // Immediately stop camera tracks and decoding to prevent duplicates
          stopScanner();
          
          // Execute callback
          if (handleBarcodeRef.current) {
            handleBarcodeRef.current(result.getText(), snapshot);
          }
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
        setErrorMessage('Camera permission is required to scan barcodes. Please enable camera permissions in your browser settings and try again.');
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
  }, [stopScanner]);

  const handleDismissTamperingAlert = useCallback(() => {
    setTamperingAlert(null);
    setErrorMessage('');
    startScanner();
  }, [startScanner]);

  const handleBarcode = useCallback(async (code: string, imageSnapshot?: string | null) => {
    const normalized = code.trim();
    if (!normalized) {
      setErrorMessage('Invalid barcode');
      setStatus('error');
      setStatusMessage('Invalid Barcode');
      return;
    }

    console.log('[Scanner] Searching for product with barcode:', normalized);
    setStatus('requesting');
    setStatusMessage('Searching product...');

    // If camera frame snapshot is available, run CV physical barcode tampering check
    if (imageSnapshot) {
      try {
        const cvResult = await evaluateBarcodeTampering(imageSnapshot, normalized);
        if (cvResult) {
          console.log('[Scanner] Barcode CV tampering evaluation:', cvResult);

          // Save CV evaluation result to Supabase barcode_tampering_detections table
          saveBarcodeTamperingDetection({
            userId: currentUser?.id || null,
            username: currentUser?.username || null,
            barcode: normalized,
            tamperingResult: cvResult,
          }).catch(err => console.warn('[Scanner] Non-blocking database logging error:', err));

          try {
            sessionStorage.setItem('last_scanned_barcode_tampering', JSON.stringify(cvResult));
            const combinedSec = computeCombinedSecurity(null, cvResult);
            sessionStorage.setItem('scanova_combined_security', JSON.stringify(combinedSec));
          } catch (e) {
            // ignore session storage error
          }

          // Enforce security gate if high physical tampering is detected
          if (cvResult.detected || cvResult.level === 'high') {
            console.warn('[Scanner] Security Block: Physical barcode tampering detected!');
            setStatus('error');
            setStatusMessage('Tampering Detected');
            setTamperingAlert({
              isOpen: true,
              barcode: normalized,
              score: cvResult.score,
              level: cvResult.level,
              tamperingType: cvResult.tampering_type || 'physical_alteration',
            });
            // Stop purchase flow: do not proceed to product page or cart
            return;
          }
        }
      } catch (cvErr) {
        console.warn('[Scanner] Non-blocking CV evaluation skipped due to error:', cvErr);
      }
    }

    try {
      // Single efficient indexed query
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', normalized)
        .maybeSingle();


      if (error) throw error;

      if (data) {
        console.log('[Scanner] Product found:', data.name);
        setStatus('detected');
        setStatusMessage('Product Found!');
        navigate(`/product/${data.id}`);
      } else {
        // Fallback search locally
        const localProduct = products.find(p => p.id === normalized);
        if (localProduct) {
          console.log('[Scanner] Product found locally:', localProduct.name);
          setStatus('detected');
          setStatusMessage('Product Found!');
          navigate(`/product/${localProduct.id}`);
        } else {
          console.log('[Scanner] Product not found:', normalized);
          setStatus('error');
          setStatusMessage('Product Not Found');
          setErrorMessage('Product not found');
          // Allow scanning again after 2 seconds
          setTimeout(() => {
            if (isMountedRef.current) {
              setErrorMessage('');
              startScanner();
            }
          }, 2000);
        }
      }
    } catch (err) {
      console.error('[Scanner] Database lookup error:', err);
      // Fallback search locally
      const localProduct = products.find(p => p.id === normalized);
      if (localProduct) {
        setStatus('detected');
        setStatusMessage('Product Found!');
        navigate(`/product/${localProduct.id}`);
      } else {
        setStatus('error');
        setStatusMessage('Database Error');
        setErrorMessage('Unable to find the product. Please try again.');
        // Allow scanning again after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setErrorMessage('');
            startScanner();
          }
        }, 2000);
      }
    }
  }, [navigate, startScanner]);

  // Keep the ref updated with the latest callback reference
  useEffect(() => {
    handleBarcodeRef.current = handleBarcode;
  }, [handleBarcode]);

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
      
      // Explicitly stop all streams and tracks on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
        } catch (e) {
          console.log('[Scanner] Unmount stream track stop error:', e);
        }
        videoRef.current.srcObject = null;
      }

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
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden pb-12">
      {/* Brand-specific Animated Background */}
      <BrandBackground brandId={brandId || ''} />

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 glass-strong px-4 py-4 flex items-center gap-3 border-b border-white/5"
      >
        <button
          onClick={() => { stopScanner(); navigate('/home'); }}
          className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-scanova-purple" />
          <h1 className="text-lg font-bold text-white tracking-wide">Self-Checkout</h1>
        </div>
        {brand && (
          <div className="ml-auto px-3 py-1 rounded-full glass text-xs text-white/60 font-medium">{brand.name}</div>
        )}
      </motion.div>

      {/* Scanner Content */}
      <div className="relative z-10 flex flex-col items-center px-4 py-8 max-w-[480px] mx-auto w-full">
        {/* Page Heading & Instruction */}
        <div className="text-center mb-8">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-extrabold text-white tracking-tight mb-2"
          >
            Scan Your Product
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-white/50 max-w-[320px] mx-auto leading-relaxed"
          >
            Point your camera at the barcode to instantly find your product.
          </motion.p>
        </div>

        {/* Scanner Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="glass rounded-3xl p-6 border border-white/10 shadow-xl w-full flex flex-col gap-5"
        >
          {/* Camera Preview */}
          <div className="relative w-full max-w-[340px] aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 mx-auto border border-white/5 shadow-inner">
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Subtle Scanning Line */}
                  <motion.div
                    className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-scanova-purple to-transparent"
                    animate={{ top: ['15%', '85%', '15%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)' }}
                  />

                  {/* Corner Brackets */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-scanova-purple/80 rounded-tl-lg" />
                  <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-scanova-purple/80 rounded-tr-lg" />
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-scanova-purple/80 rounded-bl-lg" />
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-scanova-purple/80 rounded-br-lg" />

                  {/* Center Target Box */}
                  <div className="absolute w-28 h-28 border border-white/15 rounded-lg flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-scanova-purple/40" />
                  </div>
                </div>
              </>
            ) : status === 'requesting' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/40">
                <Loader2 className="w-10 h-10 text-scanova-purple animate-spin" />
                <p className="text-white/40 text-xs">Initializing camera stream...</p>
              </div>
            ) : status === 'detected' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-green-500/10">
                <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <ScanLine className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-green-400 text-sm font-semibold">Barcode detected!</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/50">
                <Camera className="w-10 h-10 text-white/15" strokeWidth={1.5} />
                <p className="text-white/20 text-xs text-center max-w-[200px]">
                  {status === 'denied' ? 'Camera access was denied. Please update browser settings.' :
                   status === 'no-camera' ? 'No video input hardware detected.' :
                   status === 'error' ? 'A camera error occurred.' : 'Camera is stopped.'}
                </p>
              </div>
            )}
          </div>

          {/* Status Bar Indicator */}
          <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-white/5 border border-white/5 max-w-[240px] mx-auto">
            {(status === 'requesting' || status === 'scanning') && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-scanova-cyan" />
            )}
            {status === 'detected' && (
              <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {(status === 'error' || status === 'denied' || status === 'no-camera') && (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusColor()}`}>
              {status === 'scanning' ? 'Ready to scan' : statusMessage}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {(status === 'idle' || status === 'error') && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleRetry}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon transition-all"
              >
                <Camera className="w-4 h-4" /> Start Scanner
              </motion.button>
            )}

            {(status === 'connected' || status === 'scanning') && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={stopScanner}
                className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <CameraOff className="w-4 h-4" /> Stop Scanner
              </motion.button>
            )}

            {(status === 'denied' || status === 'no-camera') && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleRetry}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-neon transition-all"
              >
                <Camera className="w-4 h-4" /> Retry Connection
              </motion.button>
            )}
          </div>

          {/* Error Message Panel */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-red-500/5 border border-red-500/10"
            >
              <p className="text-red-400 text-xs text-center font-medium">{errorMessage}</p>
            </motion.div>
          )}
        </motion.div>

        {/* OR Divider Separator */}
        <div className="flex items-center gap-3 w-full my-6">
          <div className="h-[1px] flex-1 bg-white/5" />
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Or</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>

        {/* Manual Barcode entry Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-6 border border-white/10 shadow-xl w-full"
        >
          <div className="flex items-center gap-2 mb-1">
            <Keyboard className="w-4 h-4 text-scanova-cyan" />
            <h3 className="text-sm font-semibold text-white/80">Enter Barcode Manually</h3>
          </div>
          <p className="text-xs text-white/40 mb-4">Can't scan? Enter the barcode number below.</p>
          
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label htmlFor="manual-barcode-input" className="sr-only">Barcode Number</label>
              <input
                id="manual-barcode-input"
                type="text"
                placeholder="Enter barcode number"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-scanova-cyan/35 focus:border-scanova-cyan transition-all"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold shadow-neon flex items-center justify-center gap-2 transition-all"
            >
              Search Product
            </motion.button>
          </form>
        </motion.div>

        {/* Debug Info (only in development) */}
        <div className="mt-6 text-white/10 text-[10px] text-center max-w-[320px]">
          <p>Available barcodes: {products.slice(0, 4).map(p => p.id).join(', ')}...</p>
        </div>
      </div>

      {/* User-Visible Security Warning Modal for HIGH Barcode Tampering */}
      {tamperingAlert && tamperingAlert.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md p-6 rounded-3xl bg-[#140f22] border-2 border-red-500/50 shadow-2xl shadow-red-500/25 text-white flex flex-col gap-5"
          >
            {/* Header with Alert Icon */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 shrink-0">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-red-400 tracking-wide flex items-center gap-1.5">
                  🚨 Barcode Tampering Detected
                </h3>
                <p className="text-xs text-white/60">This barcode appears to be physically tampered with.</p>
              </div>
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/20 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                <span className="text-white/50">Tampering Risk Level</span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/30 border border-red-500/50 text-red-300 font-bold uppercase tracking-wider">
                  {tamperingAlert.level.toUpperCase()} RISK
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                <span className="text-white/50">Tampering Probability</span>
                <span className="font-mono font-bold text-red-400">
                  {(tamperingAlert.score * 100).toFixed(1)}% (score: {tamperingAlert.score})
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                <span className="text-white/50">Detected Tamper Type</span>
                <span className="font-semibold text-white/90 capitalize">
                  {tamperingAlert.tamperingType.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                <span className="text-white/50">Scanned Barcode</span>
                <span className="font-mono font-semibold text-white/80">{tamperingAlert.barcode}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-white/50">Security Action</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5" /> Item Blocked from Purchase
                </span>
              </div>
            </div>

            <p className="text-xs text-white/50 text-center leading-relaxed">
              For security and inventory integrity, physically altered barcodes cannot be added to your cart. Please rescan a genuine item.
            </p>

            {/* Rescan Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDismissTamperingAlert}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Rescan Barcode
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

