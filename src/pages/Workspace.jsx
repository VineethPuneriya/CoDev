import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Editor, { useMonaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import supabase from '../lib/supabaseClient';
import FileTree, { getFileContext } from '../components/fileTree';
import ConsolePanel from '../components/consolePanel';
import InviteModal from '../components/inviteModal';
import VideoRoom from '../components/videoRoom';
import AlgorithmicArena from '../components/algorithmicArena';
import ArchitectureCanvas from '../components/architectureCanvas';
import GitPanel from '../components/gitPanel';
import AiCopilotPanel from '../components/aiCopilotPanel';
import {
  Users, Circle, ArrowLeft, GitCommit, Plus,
  MessageSquare, AlertCircle, Play, Code2, CheckCircle2,
  TrendingUp, Crown, Shield, Loader2, CheckCircle, XCircle, Phone, PenTool, Sparkles, Palette
} from 'lucide-react';

const TOKEN_KEY = 'codev_token';
const USER_KEY = 'codev_user';

// Use environment variable for backend URL to support production deployments (Render) 
// while falling back to local dev server
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const findInTree = (nodes, id) => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const roleColors = {
  Admin: 'text-amber-400',
  Maintainer: 'text-emerald-400',
  Manager: 'text-violet-400',
  Collaborator: 'text-blue-400'
};

const roleBadgeColors = {
  Admin: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Maintainer: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Manager: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Collaborator: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

/**
 * Main Workspace Component.
 * Acts as the primary IDE environment. Orchestrates multiple sub-systems:
 * - Monaco Editor with Yjs for real-time collaborative editing.
 * - Socket.IO for chat, live cursors, and general events.
 * - Project management (files, issues, git, AI copilot, WebRTC video).
 */
export default function Workspace() {
  const navigate = useNavigate();
  const { id: workspaceId } = useParams();
  const monacoInstance = useMonaco();

  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const updateHandlerRef = useRef(null);
  const modelCacheRef = useRef({});

  const [currentFileId, setCurrentFileId] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const [files, setFiles] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleOutput, setConsoleOutput] = useState(null);
  const [consoleIsError, setConsoleIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issues, setIssues] = useState([]);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [showIssueInput, setShowIssueInput] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [myRoleRequest, setMyRoleRequest] = useState(null);
  const [pendingRoleRequests, setPendingRoleRequests] = useState([]);
  const [showRoleRequestPanel, setShowRoleRequestPanel] = useState(false);
  const [showRoleUpgradeModal, setShowRoleUpgradeModal] = useState(false);
  const [selectedUpgradeRole, setSelectedUpgradeRole] = useState('Maintainer');
  const [roleRequestLoading, setRoleRequestLoading] = useState(false);
  const [roleRequestError, setRoleRequestError] = useState('');
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [videoRoomActive, setVideoRoomActive] = useState(false);

  const [editorHeightPercent, setEditorHeightPercent] = useState(60);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const mainRef = useRef(null);

  const [showCanvas, setShowCanvas] = useState(false);
  const [isCanvasFloating, setIsCanvasFloating] = useState(false);
  const [canvasPos, setCanvasPos] = useState({ x: 100, y: 100 });
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });
  const [isDraggingCanvasWindow, setIsDraggingCanvasWindow] = useState(false);
  const [isResizingCanvasWindow, setIsResizingCanvasWindow] = useState(false);
  const canvasDragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

  const [editorWidthPercent, setEditorWidthPercent] = useState(50);
  const [isDraggingCanvasDivider, setIsDraggingCanvasDivider] = useState(false);
  const topPaneRef = useRef(null);

  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [activeTheme, setActiveTheme] = useState('dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    if (monacoInstance) {
      monacoInstance.editor.setTheme(activeTheme === 'light' ? 'vs-light' : 'vs-dark');
    }
    if (window.terminal) {
      window.terminal.options.theme = activeTheme === 'light'
        ? { background: '#ffffff', foreground: '#1e1e1e', cursor: '#1e1e1e', selectionBackground: '#add6ff' }
        : { background: '#1e1e1e', foreground: '#ffffff', cursor: '#ffffff', selectionBackground: '#334155' };
    }
  }, [activeTheme, monacoInstance]);

  const handleCanvasDragStart = (e) => {
    if (!isCanvasFloating) return;
    e.preventDefault();
    setIsDraggingCanvasWindow(true);
    canvasDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: canvasPos.x,
      startY: canvasPos.y
    };
  };

  const handleCanvasResizeStart = (e) => {
    if (!isCanvasFloating) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizingCanvasWindow(true);
    canvasDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startWidth: canvasSize.width,
      startHeight: canvasSize.height
    };
  };

  const handleOpenGitPanel = async () => {
    if (currentFileId && editorRef.current) {
      const content = editorRef.current.getValue();
      try {
        await fetch(`${backendUrl}/projects/${workspaceId}/files/${currentFileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content })
        });
      } catch (err) {
        console.error('Failed to save file before git status:', err);
      }
    }
    setGitPanelOpen(true);
  };

  const handleCanvasDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingCanvasDivider(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingCanvasDivider && topPaneRef.current) {
        const topPaneRect = topPaneRef.current.getBoundingClientRect();
        const newWidthPercent = ((e.clientX - topPaneRect.left) / topPaneRect.width) * 100;
        if (newWidthPercent > 10 && newWidthPercent < 90) {
          setEditorWidthPercent(newWidthPercent);
        }
      } else if (isDraggingCanvasWindow) {
        const dx = e.clientX - canvasDragStartRef.current.x;
        const dy = e.clientY - canvasDragStartRef.current.y;
        setCanvasPos({
          x: canvasDragStartRef.current.startX + dx,
          y: Math.max(0, canvasDragStartRef.current.startY + dy)
        });
      } else if (isResizingCanvasWindow) {
        const dx = e.clientX - canvasDragStartRef.current.x;
        const dy = e.clientY - canvasDragStartRef.current.y;
        setCanvasSize({
          width: Math.max(300, canvasDragStartRef.current.startWidth + dx),
          height: Math.max(200, canvasDragStartRef.current.startHeight + dy)
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingCanvasDivider(false);
      setIsDraggingCanvasWindow(false);
      setIsResizingCanvasWindow(false);
    };

    if (isDraggingCanvasDivider || isDraggingCanvasWindow || isResizingCanvasWindow) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingCanvasDivider, isDraggingCanvasWindow, isResizingCanvasWindow]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingDivider || !mainRef.current) return;
      const mainRect = mainRef.current.getBoundingClientRect();
      const newHeightPercent = ((e.clientY - mainRect.top) / mainRect.height) * 100;
      if (newHeightPercent > 10 && newHeightPercent < 90) {
        setEditorHeightPercent(newHeightPercent);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    if (isDraggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const token = localStorage.getItem(TOKEN_KEY) || '';
  const storedUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  const currentUser = storedUser || {};

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  const fetchFiles = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (_) {}
  }, [workspaceId, token]);

  const fetchIssues = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/issues`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (_) {}
  }, [workspaceId, token]);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const memberList = data.members || [];
      setMembers(memberList);
      const me = memberList.find(m => m.userId === currentUser.id);
      setMyRole(me?.role || null);
    } catch (_) {}
  }, [workspaceId, token, currentUser.id]);

  const fetchMyRoleRequest = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/my-role-request`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMyRoleRequest(data.roleRequest || null);
    } catch (_) {}
  }, [workspaceId, token]);

  const fetchPendingRoleRequests = useCallback(async () => {
    if (!workspaceId || myRole !== 'Admin') return;
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/role-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPendingRoleRequests(data.roleRequests || []);
    } catch (_) {}
  }, [workspaceId, token, myRole]);

  useEffect(() => {
    fetchFiles();
    fetchIssues();
    fetchMembers();
    fetchMyRoleRequest();
  }, [fetchFiles, fetchIssues, fetchMembers, fetchMyRoleRequest]);

  useEffect(() => {
    if (myRole === 'Admin') {
      fetchPendingRoleRequests();
    }
  }, [myRole, fetchPendingRoleRequests]);

  /**
   * Initializes the Socket.IO connection for real-time updates.
   * Listens for Yjs editor updates and workspace chat messages.
   */
  useEffect(() => {
    // Inject backendUrl dynamically for WebSocket connection and maintain withCredentials config
    const socket = io(backendUrl, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-workspace', workspaceId);
    });

    socket.on('editor-update', (update) => {
      if (ydocRef.current) {
        Y.applyUpdate(ydocRef.current, new Uint8Array(update));
      }
    });

    socket.on('chat_message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [workspaceId]);

  const teardownBinding = useCallback(() => {
    if (bindingRef.current) {
      try { bindingRef.current.destroy(); } catch (_) {}
      bindingRef.current = null;
    }
    if (ydocRef.current) {
      try {
        if (updateHandlerRef.current) {
          ydocRef.current.off('update', updateHandlerRef.current);
          updateHandlerRef.current = null;
        }
        ydocRef.current.destroy();
      } catch (_) {}
      ydocRef.current = null;
    }
  }, []);

  /**
   * Binds the Monaco Editor model to a Yjs document for real-time collaboration.
   * This allows multiple users to edit the same file simultaneously and see each other's changes.
   */
  const setupBinding = useCallback((fileId, fileName) => {
    if (!fileId || !editorRef.current || !monacoInstance) return;

    teardownBinding();

    const { language } = getFileContext(fileName);
    const modelUri = monacoInstance.Uri.parse(`file:///${fileId}/${fileName}`);

    let model = modelCacheRef.current[fileId];
    if (!model || model.isDisposed()) {
      model = monacoInstance.editor.createModel('', language, modelUri);
      modelCacheRef.current[fileId] = model;
    } else {
      monacoInstance.editor.setModelLanguage(model, language);
    }

    editorRef.current.setModel(model);

    const ydoc = new Y.Doc();
    const updateHandler = (update) => {
      if (socketRef.current) {
        socketRef.current.emit('editor-update', { workspaceId, update });
      }
    };
    updateHandlerRef.current = updateHandler;
    ydoc.on('update', updateHandler);
    ydocRef.current = ydoc;

    const yText = ydoc.getText(fileId);
    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editorRef.current]),
      null
    );
    bindingRef.current = binding;
  }, [workspaceId, monacoInstance, teardownBinding]);

  useEffect(() => {
    if (currentFileId && editorRef.current && monacoInstance) {
      setupBinding(currentFileId, currentFileName);
    } else if (!currentFileId) {
      teardownBinding();
    }
  }, [currentFileId, currentFileName, setupBinding, teardownBinding, monacoInstance]);

  useEffect(() => {
    return () => {
      teardownBinding();
    };
  }, [teardownBinding]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    if (currentFileId && monacoInstance) {
      setupBinding(currentFileId, currentFileName);
    }
  };

  const handleFileClick = (fileId) => {
    const node = findInTree(files, fileId);
    const name = node?.name ?? '';
    setCurrentFileId(fileId);
    setCurrentFileName(name);
  };

  const handleRun = async () => {
    if (!editorRef.current || !currentFileId) return;
    const code = editorRef.current.getValue();
    setIsRunning(true);
    setConsoleOpen(true);
    setConsoleOutput(null);
    setConsoleIsError(false);
    try {
      const res = await fetch(`${backendUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: detectedLanguage, code }),
      });
      const data = await res.json();
      setConsoleOutput(data.output ?? '');
      setConsoleIsError(data.isError ?? false);
    } catch (err) {
      setConsoleOutput(`Network error: ${err.message}`);
      setConsoleIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCreateIssue = async () => {
    const title = newIssueTitle.trim();
    if (!title) return;
    setIsCreatingIssue(true);
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title })
      });
      const data = await res.json();
      if (res.ok) {
        setIssues(prev => [data.issue, ...prev]);
        setNewIssueTitle('');
        setShowIssueInput(false);
      }
    } catch (_) {}
    setIsCreatingIssue(false);
  };

  const handleToggleIssueStatus = async (issue) => {
    const newStatus = issue.status === 'open' ? 'closed' : 'open';
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setIssues(prev => prev.map(i => i.id === issue.id ? data.issue : i));
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;
    const msg = {
      id: Date.now().toString(),
      text,
      senderName: currentUser.name || 'You',
      senderId: currentUser.id || 'local',
      isSelf: true,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, msg]);
    socketRef.current.emit('chat_message', { workspaceId, message: { ...msg, isSelf: false } });
    setChatInput('');
  };

  const handleSubmitRoleRequest = async () => {
    setRoleRequestLoading(true);
    setRoleRequestError('');
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/role-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestedRole: selectedUpgradeRole })
      });
      const data = await res.json();
      if (res.ok) {
        setMyRoleRequest(data.roleRequest);
        setShowRoleUpgradeModal(false);
      } else {
        setRoleRequestError(data.error || 'Failed to submit request.');
      }
    } catch (_) {
      setRoleRequestError('Network error.');
    }
    setRoleRequestLoading(false);
  };

  const handleRespondToRoleRequest = async (requestId, status) => {
    setRespondingRequestId(requestId);
    try {
      const res = await fetch(`${backendUrl}/projects/${workspaceId}/role-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setPendingRoleRequests(prev => prev.filter(r => r.id !== requestId));
        if (status === 'APPROVED') {
          await fetchMembers();
        }
      }
    } catch (_) {}
    setRespondingRequestId(null);
  };

  const activeNode = currentFileId ? findInTree(files, currentFileId) : null;
  const activeFileName = activeNode?.name ?? currentFileName;
  const { language: detectedLanguage, Icon: FileIcon, color: iconColor } = getFileContext(activeFileName);

  const isAdmin = myRole === 'Admin';
  const isCollaborator = myRole === 'Collaborator';
  const hasPendingRequest = myRoleRequest?.status === 'PENDING';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspaceId={workspaceId}
        token={token}
      />

      {isCanvasFloating && showCanvas && (
        <div style={{ 
          position: 'fixed', zIndex: 40, 
          left: canvasPos.x, top: canvasPos.y, 
          width: canvasSize.width, height: canvasSize.height, 
          border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          willChange: (isDraggingCanvasWindow || isResizingCanvasWindow) ? 'transform, opacity' : 'auto',
          userSelect: (isDraggingCanvasWindow || isResizingCanvasWindow) ? 'none' : 'auto'
        }}>
          <ArchitectureCanvas 
            workspaceId={workspaceId} 
            socket={socketRef.current} 
            isFloating={true} 
            onPopOut={() => setIsCanvasFloating(false)} 
            onClose={() => setShowCanvas(false)} 
            onDragStart={handleCanvasDragStart} 
            theme={activeTheme}
          />
          <div onMouseDown={handleCanvasResizeStart} style={{ position: 'absolute', bottom: 0, right: 0, width: '15px', height: '15px', cursor: 'se-resize', zIndex: 50 }} />
        </div>
      )}
      
      <GitPanel
        isOpen={gitPanelOpen}
        onClose={() => setGitPanelOpen(false)}
        projectId={workspaceId}
        token={token}
        isAdmin={isAdmin}
      />

      {showRoleUpgradeModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRoleUpgradeModal(false); }}
        >
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid #334155', borderRadius: '16px', width: '100%', maxWidth: '380px', margin: '0 16px', padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp style={{ width: '16px', height: '16px', color: '#a78bfa' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Request Role Upgrade</h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Submit a request to the project Admin</p>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Requested Role
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Maintainer', 'Manager'].map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedUpgradeRole(role)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: selectedUpgradeRole === role ? '1px solid #6366f1' : '1px solid #334155',
                      background: selectedUpgradeRole === role ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: selectedUpgradeRole === role ? '#818cf8' : '#64748b',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit'
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            {roleRequestError && (
              <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>{roleRequestError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRoleUpgradeModal(false)}
                style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRoleRequest}
                disabled={roleRequestLoading}
                style={{ background: roleRequestLoading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: roleRequestLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                {roleRequestLoading ? <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} /> : <TrendingUp style={{ width: '13px', height: '13px' }} />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="h-14 border-b border-[var(--border-color)] bg-[var(--bg-elevated)] flex items-center justify-between px-4 shrink-0 transition-colors duration-300">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-slate-300">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">
              {activeFileName || 'workspace'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowThemeMenu(prev => !prev)}
              className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 bg-[var(--bg-dropdown)] text-[var(--text-primary)] border border-[var(--border-color)] transition-colors hover:border-[var(--accent-color)]"
            >
              <Palette className="w-4 h-4" />
              <span className="capitalize">{activeTheme}</span>
            </button>
            {showThemeMenu && (
              <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '4px', zIndex: 50 }} className="w-32 bg-[var(--bg-dropdown)] border border-[var(--border-color)] rounded-md shadow-xl overflow-hidden">
                {['dark', 'light'].map(t => (
                  <button
                    key={t}
                    onClick={() => { setActiveTheme(t); setShowThemeMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent-color)] hover:text-white transition-colors capitalize"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            id="btn-toggle-canvas"
            onClick={() => setShowCanvas(prev => !prev)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${showCanvas ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'}`}
          >
            <PenTool className="w-4 h-4" />
            <span>Canvas</span>
          </button>
          <button
            onClick={() => setShowAiPanel(prev => !prev)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${showAiPanel ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700'}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Copilot</span>
          </button>
          <button onClick={handleRun} disabled={!currentFileId || isRunning} className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Play className="w-4 h-4" />
            <span>Run</span>
          </button>
          <button
            id="btn-join-call"
            onClick={() => setVideoRoomActive(true)}
            disabled={videoRoomActive}
            className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Phone className="w-4 h-4" />
            <span>{videoRoomActive ? 'In Call' : 'Join Call'}</span>
          </button>
          <button onClick={handleOpenGitPanel} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors">
            <GitCommit className="w-4 h-4" />
            <span>Commit to Review</span>
          </button>
          <button onClick={handleLogout} id="btn-logout" className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors border border-red-500/50">
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        <aside className="w-1/5 min-w-[240px] border-r border-[var(--border-color)] bg-[var(--bg-overlay)] flex flex-col overflow-hidden transition-colors duration-300">
          <FileTree
            files={files}
            workspaceId={workspaceId}
            token={token}
            activeFileId={currentFileId}
            onFileClick={handleFileClick}
            onRefresh={fetchFiles}
          />
        </aside>

        <main ref={mainRef} className="flex-1 flex flex-col bg-[var(--bg-base)] min-h-0 transition-colors duration-300" style={{ cursor: isDraggingDivider ? 'row-resize' : isDraggingCanvasDivider ? 'col-resize' : 'default', userSelect: (isDraggingDivider || isDraggingCanvasDivider) ? 'none' : 'auto' }}>
          <div className="flex items-center px-4 h-10 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] shrink-0 transition-colors duration-300">
            {currentFileId ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-[#1e1e1e] text-indigo-300 text-sm border-t-2 border-indigo-500">
                <FileIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                <span>{activeFileName || 'untitled'}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1 text-slate-600 text-sm">
                <span>Select a file</span>
              </div>
            )}
          </div>
          <div ref={topPaneRef} style={{ flexBasis: `${editorHeightPercent}%`, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'row' }}>
            <div style={{ flexBasis: (!isCanvasFloating && showCanvas) ? `${editorWidthPercent}%` : '100%', position: 'relative', minWidth: 0, height: '100%' }}>
              <div className={`absolute inset-0 transition-opacity duration-100 ${currentFileId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <Editor
                  height="100%"
                  theme={activeTheme === 'light' ? 'vs-light' : 'vs-dark'}
                  language={detectedLanguage}
                  defaultValue=""
                  onMount={handleEditorMount}
                  options={{ automaticLayout: true }}
                />
              </div>
              {!currentFileId && (
                <div className="absolute inset-0 h-full flex flex-col items-center justify-center text-slate-600 space-y-3">
                  <Code2 className="w-12 h-12 opacity-30" />
                  <p className="text-sm">Select a file from the explorer to start editing</p>
                </div>
              )}
            </div>
            {!isCanvasFloating && showCanvas && (
              <>
                <div
                  onMouseDown={handleCanvasDividerMouseDown}
                  style={{ width: '10px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 20 }}
                >
                  <div 
                    style={{ height: '100%', width: isDraggingCanvasDivider ? '4px' : '3px', background: isDraggingCanvasDivider ? '#818cf8' : 'rgba(255,255,255,0.1)', transition: 'all 0.15s ease', borderRadius: '2px' }} 
                    onMouseEnter={(e) => { e.currentTarget.style.width = '4px'; e.currentTarget.style.background = '#818cf8'; }}
                    onMouseLeave={(e) => { if (!isDraggingCanvasDivider) { e.currentTarget.style.width = '3px'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; } }}
                  />
                </div>
                <div style={{ flexBasis: `calc(${100 - editorWidthPercent}% - 10px)`, position: 'relative', minWidth: 0, height: '100%' }}>
                  <ArchitectureCanvas 
                    workspaceId={workspaceId} 
                    socket={socketRef.current}
                    isFloating={false}
                    onPopOut={() => setIsCanvasFloating(true)}
                    onClose={() => setShowCanvas(false)}
                    onDragStart={() => {}}
                    theme={activeTheme}
                  />
                </div>
              </>
            )}
          </div>
          <div
            onMouseDown={handleMouseDown}
            style={{ height: '8px', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 20 }}
          >
            <div 
              style={{ width: '100%', height: isDraggingDivider ? '4px' : '2px', background: isDraggingDivider ? '#818cf8' : '#1e293b', transition: 'all 0.15s ease' }} 
              onMouseEnter={(e) => { e.currentTarget.style.height = '4px'; e.currentTarget.style.background = '#6366f1'; }}
              onMouseLeave={(e) => { if (!isDraggingDivider) { e.currentTarget.style.height = '2px'; e.currentTarget.style.background = '#1e293b'; } }}
            />
          </div>
          <div style={{ flexBasis: `calc(${100 - editorHeightPercent}% - 8px)`, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <ConsolePanel
              isOpen={consoleOpen}
              onToggle={() => setConsoleOpen(o => !o)}
              output={consoleOutput}
              isError={consoleIsError}
              isRunning={isRunning}
              onClear={() => setConsoleOutput(null)}
              theme={activeTheme}
            />
            <AlgorithmicArena
              getCode={() => editorRef.current ? editorRef.current.getValue() : ''}
              language={detectedLanguage}
              workspaceId={workspaceId}
              token={token}
              theme={activeTheme}
            />
          </div>
        </main>

        {showAiPanel && (
          <div className="w-80 shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-overlay)] flex flex-col z-10 h-full transition-colors duration-300 overflow-hidden">
            <AiCopilotPanel workspaceId={workspaceId} token={token} getEditorContent={() => editorRef.current ? editorRef.current.getValue() : ''} />
          </div>
        )}

        <aside className="w-1/5 min-w-[280px] border-l border-[var(--border-color)] bg-[var(--bg-overlay)] flex flex-col overflow-y-auto transition-colors duration-300">
          <div className="p-4 border-b border-[var(--border-color)] shrink-0 transition-colors duration-300">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center uppercase tracking-wider">
                <Users className="w-4 h-4 mr-2" />
                Team Members
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-1 rounded-md transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              )}
            </div>
            <div className="space-y-1">
              {members.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">Loading members…</p>
              ) : (
                members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-dropdown)] transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-[var(--bg-dropdown)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)] border border-[var(--border-color)]">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        {member.userId === currentUser.id && (
                          <Circle className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 fill-current text-emerald-500" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {member.name}{member.userId === currentUser.id ? ' (you)' : ''}
                        </span>
                        <span className={`text-[10px] font-semibold ${roleColors[member.role] || 'text-[var(--text-muted)]'}`}>
                          {member.role}
                        </span>
                      </div>
                    </div>
                    {member.role === 'Admin' && (
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>

            {isCollaborator && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                {hasPendingRequest ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-500/5 border border-violet-500/15 rounded-lg">
                    <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                    <span className="text-[11px] text-violet-400 font-medium">Upgrade request pending…</span>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRoleRequestError(''); setShowRoleUpgradeModal(true); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 px-2 py-2 rounded-lg transition-colors"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Request Access Upgrade
                  </button>
                )}
              </div>
            )}
          </div>

          {isAdmin && pendingRoleRequests.length > 0 && (
            <div className="border-b border-[var(--border-color)] shrink-0">
              <button
                onClick={() => setShowRoleRequestPanel(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-dropdown)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Role Requests</span>
                  <span className="bg-violet-500/20 text-violet-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-violet-500/30">
                    {pendingRoleRequests.length}
                  </span>
                </div>
                <span className="text-[var(--text-muted)] text-xs">{showRoleRequestPanel ? '▲' : '▼'}</span>
              </button>
              {showRoleRequestPanel && (
                <div className="px-3 pb-3 space-y-2">
                  {pendingRoleRequests.map(req => (
                    <div key={req.id} className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-dropdown)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)] border border-[var(--border-color)]">
                          {req.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{req.user.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{req.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeColors[req.requestedRole] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                          → {req.requestedRole}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRespondToRoleRequest(req.id, 'APPROVED')}
                            disabled={respondingRequestId === req.id}
                            className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            {respondingRequestId === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleRespondToRoleRequest(req.id, 'REJECTED')}
                            disabled={respondingRequestId === req.id}
                            className="flex items-center gap-1 bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-4 border-b border-[var(--border-color)] shrink-0">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 mr-2" />
              Issue Tracker
            </h2>
          </div>
          <div className="flex-none overflow-y-auto p-3 space-y-2 border-b border-[var(--border-color)]" style={{ maxHeight: '240px' }}>
            {issues.length === 0 && !showIssueInput && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No issues yet.</p>
            )}
            {issues.map(issue => (
              <div key={issue.id} className="bg-[var(--bg-base)] p-2.5 rounded-lg border border-[var(--border-color)] space-y-1.5 group">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-[var(--text-primary)] font-medium leading-tight flex-1">{issue.title}</span>
                  <button
                    onClick={() => handleToggleIssueStatus(issue)}
                    className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={issue.status === 'open' ? 'Close issue' : 'Reopen issue'}
                  >
                    {issue.status === 'open' ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${issue.status === 'open' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {issue.status}
                  </span>
                  <span>by {issue.authorName}</span>
                </div>
              </div>
            ))}
            {showIssueInput && (
              <div className="space-y-1.5">
                <input
                  autoFocus
                  value={newIssueTitle}
                  onChange={e => setNewIssueTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateIssue();
                    if (e.key === 'Escape') { setShowIssueInput(false); setNewIssueTitle(''); }
                  }}
                  placeholder="Issue title…"
                  disabled={isCreatingIssue}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--accent-color)] rounded-md px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateIssue}
                    disabled={isCreatingIssue || !newIssueTitle.trim()}
                    className="flex-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs py-1 rounded-md transition-colors disabled:opacity-40"
                  >
                    {isCreatingIssue ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowIssueInput(false); setNewIssueTitle(''); }}
                    className="px-2 text-slate-400 hover:text-slate-200 text-xs py-1 rounded-md border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!showIssueInput && (
              <button
                onClick={() => setShowIssueInput(true)}
                className="w-full py-1.5 border border-dashed border-[var(--border-color)] text-[var(--text-secondary)] text-xs rounded-lg hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Issue
              </button>
            )}
          </div>

          <div className="flex flex-col bg-[var(--bg-elevated)] min-h-0 border-t border-[var(--border-color)]" style={{ minHeight: '160px', maxHeight: '240px' }}>
            <div className="p-3 border-b border-[var(--border-color)] shrink-0">
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center uppercase tracking-wider">
                <MessageSquare className="w-3 h-3 mr-2" />
                Team Chat
              </h2>
              <div className="mt-1 text-sm font-bold text-[var(--accent-color)] uppercase">
                ACTIVE USER: {currentUser?.email}
              </div>
            </div>
            <div className="flex-1 p-3 flex flex-col space-y-2 overflow-y-auto">
              {chatMessages.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center mt-2">No messages yet. Say hi!</p>
              )}
              {chatMessages.map(msg => {
                const isYou = msg.senderId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-sm ${isYou ? 'self-end bg-[var(--accent-color)] text-white border border-[var(--accent-color)]' : 'self-start bg-[var(--bg-dropdown)] border border-[var(--border-color)]'}`}
                  >
                    {!isYou && (
                      <span className="text-xs text-emerald-500 font-medium block mb-0.5">{msg.senderName}</span>
                    )}
                    {isYou && (
                      <span className="text-xs text-indigo-200 font-medium block mb-0.5">You</span>
                    )}
                    <span className={isYou ? "text-white" : "text-[var(--text-primary)]"}>{msg.text}</span>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
            <div className="p-2.5 border-t border-[var(--border-color)] bg-[var(--bg-elevated)] shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleChatSend(); }}
                placeholder="Type a message…"
                className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
        </aside>

      </div>

      {videoRoomActive && (
        <VideoRoom
          socket={socketRef.current}
          workspaceId={workspaceId}
          currentUser={currentUser}
          onLeave={() => setVideoRoomActive(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
