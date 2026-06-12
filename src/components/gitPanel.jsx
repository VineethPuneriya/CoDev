import React, { useState, useEffect } from 'react';
import { X, GitCommit, GitPullRequest, GitMerge, RefreshCw, CheckCircle2, ShieldAlert, Clock } from 'lucide-react';

/**
 * Git Panel Component.
 * Interfaces with the backend git routes to fetch working tree status, commit logs,
 * and pull requests. Provides UI for creating and managing PRs.
 */
export default function GitPanel({ isOpen, onClose, projectId, token, isAdmin }) {
  const [activeTab, setActiveTab] = useState('staging'); // 'staging', 'logs'
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [prs, setPrs] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  /**
   * Fetches Git status, logs, and active pull requests simultaneously
   * to populate the staging and commit history tabs.
   */
  const fetchData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const [statusRes, logsRes, prsRes] = await Promise.all([
        fetch(`http://localhost:5000/projects/${projectId}/git/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`http://localhost:5000/projects/${projectId}/git/logs`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`http://localhost:5000/projects/${projectId}/git/pull-requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const statusData = await statusRes.json();
      const logsData = await logsRes.json();
      const prsData = await prsRes.json();
      
      setFiles(statusData.files || []);
      setLogs(logsData.logs || []);
      setPrs(prsData.prs || []);
    } catch (err) {
      setIsError(true);
      setStatusMessage('Failed to fetch version control data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setTitle('');
      setStatusMessage(null);
    }
  }, [isOpen, projectId]);

  /**
   * Submits a new Pull Request.
   * This signals the backend to stage all modified/untracked files, commit them,
   * and create a logical Pull Request record in the database.
   */
  const handleCreatePR = async () => {
    if (!title.trim()) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`http://localhost:5000/projects/${projectId}/git/pull-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description: '' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create PR');
      setIsError(false);
      setStatusMessage('Pull Request created successfully');
      setTitle('');
      fetchData();
    } catch (err) {
      setIsError(true);
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePR = async (prId, status) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`http://localhost:5000/projects/${projectId}/git/pull-requests/${prId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update PR');
      setIsError(false);
      setStatusMessage(`PR ${status === 'MERGED' ? 'Merged' : 'Rejected'} successfully`);
      fetchData();
    } catch (err) {
      setIsError(true);
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg shadow-2xl w-[600px] flex flex-col overflow-hidden max-h-[85vh] transition-colors duration-300">
        
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-overlay)] border-b border-[var(--border-color)] transition-colors duration-300">
          <div className="flex items-center space-x-2 text-[var(--text-primary)] font-medium">
            <GitPullRequest className="w-5 h-5 text-[var(--accent-color)]" />
            <span>Version Control</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-base)] transition-colors duration-300">
          <button
            onClick={() => setActiveTab('staging')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'staging' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)] bg-[var(--bg-elevated)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Staging & PRs
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'logs' ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)] bg-[var(--bg-elevated)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            Commit Logs
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          {loading && !actionLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'staging' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Modified / Untracked Files</h3>
                    <div className="bg-[var(--bg-base)] rounded-md border border-[var(--border-color)] p-2 min-h-[120px] max-h-[180px] overflow-y-auto transition-colors duration-300">
                      {files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] space-y-2 py-6">
                          <CheckCircle2 className="w-8 h-8 opacity-50" />
                          <span className="text-sm font-medium">Working tree is clean</span>
                          <span className="text-xs opacity-75">No modified files to commit</span>
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {files.map((f, i) => (
                            <li key={i} className="flex items-center space-x-2 text-sm">
                              <span className="text-emerald-400 font-mono w-4">{f.status}</span>
                              <span className="text-[var(--text-primary)] truncate">{f.file}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="space-y-3 bg-[var(--bg-overlay)] p-4 rounded-lg border border-[var(--border-color)] transition-colors duration-300">
                      <h3 className="text-sm font-medium text-[var(--accent-color)]">Submit for Review</h3>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] p-2.5 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                        placeholder="Pull Request title..."
                      />
                      <button
                        onClick={handleCreatePR}
                        disabled={actionLoading || !title.trim() || files.length === 0}
                        className="w-full py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md flex items-center justify-center space-x-2 transition-all"
                      >
                        {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitPullRequest className="w-4 h-4" />}
                        <span>{actionLoading ? 'Submitting...' : 'Pull Request for Review'}</span>
                      </button>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Active Pull Requests</h3>
                    <div className="space-y-3">
                      {prs.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">No active pull requests.</p>
                      ) : (
                        prs.map(pr => (
                          <div key={pr.id} className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg p-3 transition-colors duration-300">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate" title={pr.title}>{pr.title}</h4>
                                <p className="text-xs text-[var(--text-secondary)] truncate">by {pr.author?.name} • {new Date(pr.createdAt).toLocaleDateString()}</p>
                              </div>
                              {pr.status === 'PENDING' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">PENDING</span>
                              )}
                              {pr.status === 'MERGED' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">MERGED</span>
                              )}
                              {pr.status === 'REJECTED' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">REJECTED</span>
                              )}
                            </div>
                            
                            {isAdmin && pr.status === 'PENDING' && (
                              <div className="flex space-x-2 mt-3 pt-3 border-t border-[#2d2d2d]">
                                <button
                                  onClick={() => handleUpdatePR(pr.id, 'MERGED')}
                                  disabled={actionLoading}
                                  className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  <GitMerge className="w-3.5 h-3.5" />
                                  <span>Approve & Merge</span>
                                </button>
                                <button
                                  onClick={() => handleUpdatePR(pr.id, 'REJECTED')}
                                  disabled={actionLoading}
                                  className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-[var(--text-secondary)] mb-4">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Commit History</span>
                  </div>
                  {logs.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-4">No commits yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log, idx) => (
                        <div key={idx} className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-color)] shadow transition-colors duration-300">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-[var(--accent-color)] truncate">{log.hash}</span>
                            <time className="text-[10px] text-[var(--text-secondary)] font-medium shrink-0 ml-2">{log.time}</time>
                          </div>
                          <div className="text-sm text-[var(--text-primary)] font-medium mb-1 truncate" title={log.message}>{log.message}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">by {log.author}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {statusMessage && (
            <div className={`mt-4 flex items-center space-x-2 text-sm p-3 rounded-md border ${isError ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50'}`}>
              {isError ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
