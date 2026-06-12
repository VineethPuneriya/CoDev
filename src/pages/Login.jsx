import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Loader2 } from 'lucide-react';

const TOKEN_KEY = 'codev_token';
const USER_KEY = 'codev_user';

/**
 * Login Component.
 * Handles user authentication (login and registration) and token management.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const wipeParams = new URLSearchParams(window.location.search);
  if (wipeParams.get('wipe') === 'true') {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  /**
   * Submits the login credentials to the backend.
   * Stores the JWT token and user details in localStorage upon success.
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setError('Network error — is the server running?');
      setLoading(false);
    }
  };

  /**
   * Registers a new user.
   * Auto-logs in the user and redirects to the dashboard upon successful registration.
   */
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const name = email.split('@')[0];
    try {
      const res = await fetch('http://localhost:5000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }
      const loginRes = await fetch('http://localhost:5000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const loginData = await loginRes.json();
      localStorage.setItem(TOKEN_KEY, loginData.token);
      localStorage.setItem(USER_KEY, JSON.stringify(loginData.user));
      navigate('/dashboard');
    } catch (err) {
      setError('Network error — is the server running?');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8 space-y-8">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="bg-indigo-500/10 p-3 rounded-full border border-indigo-500/20">
            <Terminal className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to CoDev</h1>
          <p className="text-sm text-slate-400">Sign in to your unified workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2.5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>

          <button
            type="button"
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-300 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center"
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
