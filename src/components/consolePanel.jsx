import { useRef, useEffect } from 'react';
import { Terminal, ChevronDown, ChevronUp, XCircle, Loader2, CheckCircle2, Trash2 } from 'lucide-react';

/**
 * Console Panel Component.
 * Displays the standard output (stdout) and standard error (stderr) when a user
 * executes code via the execution backend. It supports auto-scrolling, clear functionality,
 * and visual status indicators (running, success, error).
 */
export default function ConsolePanel({ isOpen, onToggle, output, isError, isRunning, onClear, theme }) {
  const outputRef = useRef(null);
  const isLight = theme === 'light';

  // Automatically scroll the terminal output to the bottom whenever new output arrives
  // or when the execution state changes.
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isRunning]);

  return (
    <div
      style={{
        height: isOpen ? '220px' : '36px',
        transition: 'height 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-color)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: '36px',
          background: 'var(--bg-elevated)',
          borderBottom: isOpen ? '1px solid var(--border-color)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          flexShrink: 0,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal style={{ width: '14px', height: '14px', color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Terminal
          </span>
          {isRunning && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: isLight ? '#2563eb' : '#60a5fa' }}>
              <Loader2 style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} />
              running…
            </span>
          )}
          {!isRunning && output !== null && !isError && output.trim() !== '' && (
            <CheckCircle2 style={{ width: '12px', height: '12px', color: isLight ? '#16a34a' : '#4ade80' }} />
          )}
          {!isRunning && output !== null && isError && (
            <XCircle style={{ width: '12px', height: '12px', color: isLight ? '#dc2626' : '#f87171' }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOpen && output !== null && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Clear output"
            >
              <Trash2 style={{ width: '13px', height: '13px' }} />
            </button>
          )}
          {isOpen
            ? <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />
            : <ChevronUp style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />
          }
        </div>
      </div>

      {isOpen && (
        <div
          ref={outputRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '10px 16px',
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Courier New", monospace',
            fontSize: '12.5px',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            background: 'var(--bg-base)',
            transition: 'background-color 0.2s ease, color 0.2s ease',
          }}
        >
          {isRunning && (
            <div style={{ color: isLight ? '#2563eb' : '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: isLight ? '#16a34a' : '#4ade80' }}>$</span>
              <span>Executing…</span>
            </div>
          )}

          {!isRunning && output === null && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Press <span style={{ color: 'var(--accent-color)', fontStyle: 'normal' }}>Run</span> to execute the active file.
            </div>
          )}

          {!isRunning && output !== null && (
            <div>
              <span style={{ color: 'var(--accent-color)', marginRight: '8px' }}>$</span>
              <pre
                style={{
                  display: 'inline',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: isError ? (isLight ? '#dc2626' : '#f87171') : (isLight ? '#16a34a' : '#86efac'),
                  margin: 0,
                }}
              >
                {output || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Process exited with no output.</span>}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
