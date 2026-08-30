import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Splash from './pages/Splash';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Scanner from './pages/Scanner';
import ProductPage from './pages/Product';
import NotFound from './pages/NotFound';
import ReceiptPage from './pages/ReceiptPage';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
              <Route path="/product/:id" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />
              <Route path="/receipt/:orderId" element={<ProtectedRoute><ReceiptPage /></ProtectedRoute>} />
              <Route path="/not-found" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
