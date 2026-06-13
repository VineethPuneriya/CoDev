import { useState } from 'react';
import { Terminal, Loader2 } from 'lucide-react';
import supabase from '../lib/supabaseClient';

const GitHubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const displayName = email.split('@')[0];
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: displayName } }
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (data?.user && !data.session) {
      setConfirmationPending(true);
    }
    setLoading(false);
  };

  const handleGitHubLogin = async () => {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'github'
    });
    if (authError) {
      setError(authError.message);
    }
  };

  if (confirmationPending) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="bg-emerald-500/10 p-3 rounded-full border border-emerald-500/20">
              <Terminal className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white text-center">Check Your Email</h1>
            <p className="text-sm text-slate-400 text-center leading-relaxed">
              We sent a verification link to <span className="text-indigo-400 font-medium">{email}</span>.
              Please click the link to verify your account and then return here to sign in.
            </p>
          </div>
          <button
            onClick={() => { setConfirmationPending(false); setIsSignUp(false); setEmail(''); setPassword(''); }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8 space-y-8">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="bg-indigo-500/10 p-3 rounded-full border border-indigo-500/20">
            <Terminal className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to CoDev</h1>
          <p className="text-sm text-slate-400">
            {isSignUp ? 'Create your unified workspace account' : 'Sign in to your unified workspace'}
          </p>
        </div>

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
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
            <span>{loading ? (isSignUp ? 'Creating Account…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(prev => !prev); setError(''); }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500">or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGitHubLogin}
          className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <GitHubIcon className="w-5 h-5" />
          <span>Sign in with GitHub</span>
        </button>
      </div>
    </div>
  );
}
