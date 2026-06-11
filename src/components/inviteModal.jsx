import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InviteModal({ isOpen, onClose, workspaceId, token }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setStatus(null);
      setMessage('');
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setStatus(null);
    setMessage('');
    try {
      const res = await fetch(`http://localhost:5000/projects/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Invitation failed. Please try again.');
      } else {
        setStatus('success');
        setMessage(data.message || `${trimmed} has been added to the project.`);
        closeTimerRef.current = setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      setStatus('error');
      setMessage(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleInvite();
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #334155',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          margin: '0 16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus style={{ width: '16px', height: '16px', color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                Invite Collaborator
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                Grant access to this workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#475569', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="colleague@company.com"
              disabled={isLoading || status === 'success'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0f172a',
                border: `1px solid ${status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : '#334155'}`,
                borderRadius: '8px',
                padding: '10px 12px 10px 36px',
                fontSize: '13.5px',
                color: '#e2e8f0',
                outline: 'none',
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={e => { if (!status) e.target.style.borderColor = '#6366f1'; }}
              onBlur={e => { if (!status) e.target.style.borderColor = '#334155'; }}
            />
          </div>

          {status && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: status === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${status === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              animation: 'fadeIn 0.2s ease',
            }}>
              {status === 'success'
                ? <CheckCircle2 style={{ width: '15px', height: '15px', color: '#22c55e', flexShrink: 0, marginTop: '1px' }} />
                : <AlertCircle style={{ width: '15px', height: '15px', color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
              }
              <span style={{ fontSize: '13px', color: status === 'success' ? '#4ade80' : '#f87171', lineHeight: 1.4 }}>
                {message}
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '0 24px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={isLoading || !email.trim() || status === 'success'}
            style={{
              background: isLoading || status === 'success' ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: isLoading || !email.trim() || status === 'success' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
              boxShadow: isLoading || status === 'success' ? 'none' : '0 4px 12px rgba(99,102,241,0.35)',
            }}
          >
            {isLoading
              ? <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
              : <UserPlus style={{ width: '13px', height: '13px' }} />
            }
            {isLoading ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
