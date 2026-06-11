import { useState, useCallback } from 'react';
import { Plus, Trash2, Play, CheckCircle2, XCircle, Loader2, FlaskConical, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const defaultTestCase = () => ({ id: Date.now() + Math.random(), input: '', expectedOutput: '' });

export default function AlgorithmicArena({ getCode, language, workspaceId, token }) {
  const [testCases, setTestCases] = useState([defaultTestCase()]);
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  const addTestCase = useCallback(() => {
    setTestCases(prev => [...prev, defaultTestCase()]);
  }, []);

  const removeTestCase = useCallback((id) => {
    setTestCases(prev => prev.filter(tc => tc.id !== id));
  }, []);

  const updateTestCase = useCallback((id, field, value) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
  }, []);

  const runAllTests = useCallback(async () => {
    const code = getCode();
    if (!code || !code.trim()) {
      setError('No code in the editor. Write a solution first.');
      return;
    }
    const validCases = testCases.filter(tc => tc.expectedOutput.trim() !== '');
    if (validCases.length === 0) {
      setError('Add at least one test case with an expected output.');
      return;
    }

    setIsRunning(true);
    setResults(null);
    setError(null);

    try {
      const res = await fetch('http://localhost:5000/api/execute/test-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code,
          language: language || 'python',
          testCases: validCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Execution failed.');
      } else {
        setResults(data);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [getCode, testCases, language, token]);

  const totalPassed = results?.totalPassed ?? 0;
  const totalFailed = results?.totalFailed ?? 0;
  const total = results?.total ?? 0;

  return (
    <div className="flex flex-col shrink-0 transition-[max-height] duration-300 ease-in-out overflow-hidden bg-[var(--bg-base)] border-t border-[var(--border-color)]" style={{ maxHeight: isOpen ? '480px' : '36px' }}>
      <div
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center justify-between px-3.5 h-9 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] cursor-pointer select-none shrink-0 transition-colors duration-300"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FlaskConical style={{ width: '14px', height: '14px', color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Algorithmic Arena
          </span>
          {results && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px', background: totalFailed === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: totalFailed === 0 ? '#4ade80' : '#f87171', border: `1px solid ${totalFailed === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {totalPassed}/{total} passed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-run-all-tests"
            onClick={(e) => { e.stopPropagation(); runAllTests(); }}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-[var(--accent-color)] text-[var(--accent-color)] bg-opacity-10 text-[11px] font-bold cursor-pointer transition-all disabled:cursor-not-allowed hover:bg-[var(--accent-color)] hover:text-white"
            style={{ background: isRunning ? 'rgba(167,139,250,0.1)' : 'transparent' }}
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isRunning ? 'Running…' : 'Run All Tests'}
          </button>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
        </div>
      </div>

      {isOpen && (
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '12px' }}>
              <XCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {testCases.map((tc, idx) => {
              const result = results?.results?.[idx] ?? null;
              return (
                <TestCaseRow
                  key={tc.id}
                  index={idx}
                  tc={tc}
                  result={result}
                  onUpdate={updateTestCase}
                  onRemove={removeTestCase}
                  canRemove={testCases.length > 1}
                />
              );
            })}
          </div>

          <button
            onClick={addTestCase}
            className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg border border-dashed border-[var(--accent-color)] opacity-50 hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-xs font-medium cursor-pointer transition-all"
          >
            <Plus className="w-3 h-3" />
            Add Test Case
          </button>

          {!results && !isRunning && (
            <div className="text-center py-4 text-[var(--text-muted)] text-xs italic font-medium">
              Ready to evaluate your code. Run the test suite to see output here.
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TestCaseRow({ index, tc, result, onUpdate, onRemove, canRemove }) {
  const passed = result?.passed;
  const hasPassed = result !== null && passed === true;
  const hasFailed = result !== null && passed === false;

  const borderColor = hasPassed ? 'rgba(34,197,94,0.3)' : hasFailed ? 'rgba(239,68,68,0.3)' : 'var(--border-color)';
  const bgColor = hasPassed ? 'rgba(34,197,94,0.04)' : hasFailed ? 'rgba(239,68,68,0.04)' : 'var(--bg-overlay)';

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: bgColor, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${borderColor}`, background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Case #{index + 1}
          </span>
          {hasPassed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#4ade80', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '1px 7px', borderRadius: '8px' }}>
              <CheckCircle2 style={{ width: '10px', height: '10px' }} /> Passed
            </span>
          )}
          {hasFailed && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 7px', borderRadius: '8px' }}>
              <XCircle style={{ width: '10px', height: '10px' }} /> Failed
            </span>
          )}
          {result && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#475569' }}>
              <Clock style={{ width: '9px', height: '9px' }} />
              {result.elapsedMs}ms
            </span>
          )}
        </div>
        {canRemove && (
          <button
            onClick={() => onRemove(tc.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Remove test case"
          >
            <Trash2 style={{ width: '12px', height: '12px' }} />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: hasFailed && result?.actualOutput !== undefined ? `1px solid ${borderColor}` : 'none' }}>
        <div style={{ padding: '8px 10px', borderRight: `1px solid var(--border-color)` }}>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Input (stdin)
          </label>
          <textarea
            value={tc.input}
            onChange={e => onUpdate(tc.id, 'input', e.target.value)}
            placeholder="Enter stdin input…"
            rows={2}
            className="w-full bg-transparent border-none outline-none resize-none text-[var(--text-primary)] text-xs font-mono p-0"
          />
        </div>
        <div style={{ padding: '8px 10px' }}>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Expected Output
          </label>
          <textarea
            value={tc.expectedOutput}
            onChange={e => onUpdate(tc.id, 'expectedOutput', e.target.value)}
            placeholder="Enter expected stdout…"
            rows={2}
            className="w-full bg-transparent border-none outline-none resize-none text-[var(--text-primary)] text-xs font-mono p-0"
          />
        </div>
      </div>

      {hasFailed && result?.actualOutput !== undefined && (
        <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.05)' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Actual Output
          </span>
          <pre style={{ margin: '3px 0 0', fontSize: '12px', fontFamily: '"Fira Code", monospace', color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {result.actualOutput || <span style={{ fontStyle: 'italic', color: '#4b5563' }}>empty</span>}
          </pre>
        </div>
      )}
    </div>
  );
}
