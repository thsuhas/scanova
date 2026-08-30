import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ScanLine, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    const { error } = await login(email, password);
    if (error) {
      setError(error.message || 'Login failed');
    } else {
      navigate('/home');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !email || !password || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    const { error } = await signup(username, email, password);
    if (error) {
      setError(error.message || 'Signup failed');
    } else {
      navigate('/home');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!email) { setError('Please enter your email'); return; }
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message || 'Failed to send reset email');
    } else {
      setSuccessMessage("If an account exists for this email, we've sent a password reset link.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0a0a1a]">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-15 -top-40 -left-40"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }}
        animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-10 -bottom-32 -right-32"
        style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }}
        animate={{ scale: [1.1, 0.9, 1.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-neon mb-4">
            <ScanLine className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-gradient">Scanova</h1>
          <p className="text-white/30 text-sm mt-1">
            {isForgotPassword ? 'Reset your Scanova password' : (isLogin ? 'Welcome back' : 'Create your account')}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={isForgotPassword ? 'forgot' : (isLogin ? 'login' : 'signup')}
            initial={{ opacity: 0, x: isForgotPassword ? 20 : (isLogin ? -20 : 20) }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isForgotPassword ? -20 : (isLogin ? 20 : -20) }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl glass text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 transition-all"
                  />
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-sm text-center">
                    {error}
                  </motion.p>
                )}
                {successMessage && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-green-400 text-sm text-center">
                    {successMessage}
                  </motion.p>
                )}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold text-base shadow-neon hover:shadow-lg transition-shadow"
                >
                  Send Reset Link
                </motion.button>
              </form>
            ) : (
              <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl glass text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 transition-all"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={isLogin ? 'text' : 'email'}
                    placeholder={isLogin ? 'Username or Email' : 'Email'}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl glass text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 transition-all"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl glass text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {!isLogin && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3.5 rounded-xl glass text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-scanova-purple/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                )}
                {error && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-sm text-center">
                    {error}
                  </motion.p>
                )}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold text-base shadow-neon hover:shadow-lg transition-shadow"
                >
                  {isLogin ? 'Log In' : 'Sign Up'}
                </motion.button>
              </form>
            )}

            {isForgotPassword ? (
              <div className="mt-6 glass rounded-xl p-4 text-center">
                <button
                  onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
                  className="text-scanova-purple font-semibold text-sm hover:text-scanova-purple-light transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                {isLogin && (
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMessage(''); }}
                      className="text-scanova-cyan text-sm hover:text-scanova-neon-blue transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <div className="mt-6 glass rounded-xl p-4 text-center">
                  <p className="text-white/50 text-sm">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  </p>
                  <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="mt-2 text-scanova-purple font-semibold text-sm hover:text-scanova-purple-light transition-colors"
                  >
                    {isLogin ? 'Sign Up' : 'Log In'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
