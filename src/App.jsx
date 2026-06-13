import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import supabase from './lib/supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Workspace from './pages/Workspace';

const TOKEN_KEY = 'codev_token';
const USER_KEY = 'codev_user';

function ProtectedRoute({ session, backendReady, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!backendReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Initializing workspace…</p>
        </div>
      </div>
    );
  }
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);

  const exchangeToken = async (supabaseUser) => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    if (existingToken) {
      setBackendReady(true);
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/auth/token-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: supabaseUser.email,
          name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0]
        })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setBackendReady(true);
      }
    } catch (_) {}
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        exchangeToken(currentSession.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession?.user) {
          exchangeToken(currentSession.user);
        }
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setBackendReady(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Routes>
          <Route path="/" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute session={session} backendReady={backendReady}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/:id"
            element={
              <ProtectedRoute session={session} backendReady={backendReady}>
                <Workspace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
