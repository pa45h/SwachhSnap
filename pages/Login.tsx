
import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from "firebase/auth";
import logo from '../public/logo.jpeg'


interface LoginProps {
  onLogin: () => void;
  onShowRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      onLogin();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid credentials. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const quickSelect = (e: string) => {
    setEmail(e);
    setPassword('demopass123');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 text-black bgimg">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#1A73E8] rounded-3xl mb-3 shadow-xl shadow-blue-100">
            <img className='rounded-2xl' src={logo} alt="" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent outline-none transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A73E8] text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>
            <div className="mt-8 text-center">
                <p className="text-sm text-gray-500">
                  Don't have an account?{' '}
                  <button
                    onClick={onShowRegister}
                    className="text-[#1A73E8] font-bold hover:underline"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
        </div>


      </div>
    </div>
  );
};
