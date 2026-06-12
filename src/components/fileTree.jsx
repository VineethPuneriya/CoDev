import { useState, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, FolderPlus, Trash2,
  FileCode2, FileJson, FileText, FileImage, Database,
  FileType2, Globe, Braces, Terminal, Coffee,
  Hash, Settings, Package, BookOpen, Layers,
  FileVideo, FileAudio, FileArchive, Cpu, GitBranch
} from 'lucide-react';

/**
 * Maps file extensions to programming languages, specific Lucide icons,
 * and Tailwind text colors for visual differentiation in the file tree.
 */
const fileContextMap = {
  js:     { language: 'javascript',  Icon: FileCode2,   color: 'text-yellow-400' },
  jsx:    { language: 'javascript',  Icon: FileCode2,   color: 'text-cyan-400'   },
  ts:     { language: 'typescript',  Icon: FileCode2,   color: 'text-blue-400'   },
  tsx:    { language: 'typescript',  Icon: FileCode2,   color: 'text-blue-300'   },
  py:     { language: 'python',      Icon: Braces,      color: 'text-green-400'  },
  html:   { language: 'html',        Icon: Globe,       color: 'text-orange-400' },
  css:    { language: 'css',         Icon: Hash,        color: 'text-pink-400'   },
  scss:   { language: 'scss',        Icon: Hash,        color: 'text-pink-300'   },
  json:   { language: 'json',        Icon: FileJson,    color: 'text-yellow-300' },
  md:     { language: 'markdown',    Icon: BookOpen,    color: 'text-slate-300'  },
  mdx:    { language: 'markdown',    Icon: BookOpen,    color: 'text-slate-300'  },
  rs:     { language: 'rust',        Icon: Cpu,         color: 'text-orange-500' },
  go:     { language: 'go',          Icon: Terminal,    color: 'text-cyan-500'   },
  cpp:    { language: 'cpp',         Icon: FileType2,   color: 'text-blue-500'   },
  c:      { language: 'c',           Icon: FileType2,   color: 'text-blue-400'   },
  java:   { language: 'java',        Icon: Coffee,      color: 'text-red-400'    },
  rb:     { language: 'ruby',        Icon: Terminal,    color: 'text-red-500'    },
  php:    { language: 'php',         Icon: FileCode2,   color: 'text-violet-400' },
  sh:     { language: 'shell',       Icon: Terminal,    color: 'text-emerald-400'},
  bash:   { language: 'shell',       Icon: Terminal,    color: 'text-emerald-400'},
  sql:    { language: 'sql',         Icon: Database,    color: 'text-amber-400'  },
  yaml:   { language: 'yaml',        Icon: Settings,    color: 'text-slate-400'  },
  yml:    { language: 'yaml',        Icon: Settings,    color: 'text-slate-400'  },
  toml:   { language: 'ini',         Icon: Settings,    color: 'text-slate-400'  },
  xml:    { language: 'xml',         Icon: Layers,      color: 'text-green-300'  },
  svg:    { language: 'xml',         Icon: FileImage,   color: 'text-purple-400' },
  png:    { language: 'plaintext',   Icon: FileImage,   color: 'text-purple-300' },
  jpg:    { language: 'plaintext',   Icon: FileImage,   color: 'text-purple-300' },
  jpeg:   { language: 'plaintext',   Icon: FileImage,   color: 'text-purple-300' },
  gif:    { language: 'plaintext',   Icon: FileImage,   color: 'text-purple-300' },
  webp:   { language: 'plaintext',   Icon: FileImage,   color: 'text-purple-300' },
  mp4:    { language: 'plaintext',   Icon: FileVideo,   color: 'text-pink-500'   },
  mp3:    { language: 'plaintext',   Icon: FileAudio,   color: 'text-pink-400'   },
  zip:    { language: 'plaintext',   Icon: FileArchive, color: 'text-slate-500'  },
  tar:    { language: 'plaintext',   Icon: FileArchive, color: 'text-slate-500'  },
  gz:     { language: 'plaintext',   Icon: FileArchive, color: 'text-slate-500'  },
  lock:   { language: 'plaintext',   Icon: Package,     color: 'text-slate-500'  },
  gitignore: { language: 'plaintext', Icon: GitBranch,  color: 'text-orange-300' },
  env:    { language: 'plaintext',   Icon: Settings,    color: 'text-yellow-500' },
  txt:    { language: 'plaintext',   Icon: FileText,    color: 'text-slate-400'  },
};

const defaultContext = { language: 'plaintext', Icon: FileText, color: 'text-slate-400' };

export const getFileContext = (fileName) => {
  if (!fileName) return defaultContext;
  const parts = fileName.split('.');
  if (parts.length < 2) return defaultContext;
  const ext = parts[parts.length - 1].toLowerCase();
  const dotName = fileName.startsWith('.') ? fileName.slice(1).toLowerCase() : null;
  if (dotName && fileContextMap[dotName]) return fileContextMap[dotName];
  return fileContextMap[ext] || defaultContext;
};

/**
 * FileNode Component.
 * A recursive component representing a single file or directory in the tree.
 * Handles renaming, deleting, and triggering creation of nested children.
 */
function FileNode({ node, workspaceId, token, activeFileId, onFileClick, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showInput, setShowInput] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const isCommittingRef = useRef(false);

  const isFolder = node.type === 'folder';
  const { Icon, color } = getFileContext(node.name);

  /**
   * Submits a request to the backend to create a new file or folder within this directory.
   */
  const handleCreate = async (type) => {
    const name = inputValue.trim();
    if (!name) return;
    isCommittingRef.current = true;
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/projects/${workspaceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, parentId: node.id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}`);
        isCommittingRef.current = false;
        return;
      }
      setInputValue('');
      setShowInput(null);
      setIsOpen(true);
      onRefresh();
    } catch (e) {
      setError('Network error');
    }
    isCommittingRef.current = false;
  };

  const handleBlur = () => {
    if (isCommittingRef.current) return;
    setShowInput(null);
    setInputValue('');
    setError('');
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await fetch(`http://localhost:5000/projects/${workspaceId}/files/${node.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    onRefresh();
  };

  return (
    <div>
      <div
        className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer text-sm transition-colors ${activeFileId === node.id ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-300 hover:bg-slate-800'}`}
        onClick={() => {
          if (isFolder) setIsOpen(o => !o);
          else onFileClick(node.id);
        }}
      >
        <div className="flex items-center space-x-1.5 min-w-0">
          {isFolder ? (
            isOpen ? <ChevronDown className="w-3 h-3 shrink-0 text-slate-500" /> : <ChevronRight className="w-3 h-3 shrink-0 text-slate-500" />
          ) : (
            <span className="w-3" />
          )}
          {isFolder
            ? isOpen
              ? <FolderOpen className="w-4 h-4 shrink-0 text-amber-400" />
              : <Folder className="w-4 h-4 shrink-0 text-amber-400" />
            : <Icon className={`w-4 h-4 shrink-0 ${color}`} />
          }
          <span className="truncate">{node.name}</span>
        </div>
        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isFolder && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setShowInput('file'); setIsOpen(true); }} className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="New File">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowInput('folder'); setIsOpen(true); }} className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="New Folder">
                <FolderPlus className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={handleDelete} className="p-0.5 rounded hover:bg-red-900/40 text-slate-400 hover:text-red-400" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showInput && (
        <div className="pl-6 pr-2 py-1">
          <input
            autoFocus
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreate(showInput); }
              if (e.key === 'Escape') { setShowInput(null); setInputValue(''); setError(''); }
            }}
            onBlur={handleBlur}
            placeholder={showInput === 'file' ? 'filename.js' : 'folder-name'}
            className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
          />
          {error && <p className="text-red-400 text-xs mt-0.5">{error}</p>}
        </div>
      )}

      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <div className="pl-3">
          {node.children.map(child => (
            <FileNode
              key={child.id}
              node={child}
              workspaceId={workspaceId}
              token={token}
              activeFileId={activeFileId}
              onFileClick={onFileClick}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * FileTree Component.
 * The main container for the workspace's file explorer. Displays the root-level
 * files and directories, and provides UI for creating new root items.
 */
export default function FileTree({ files, workspaceId, token, activeFileId, onFileClick, onRefresh }) {
  const [showRootInput, setShowRootInput] = useState(null);
  const [rootInputValue, setRootInputValue] = useState('');
  const [rootError, setRootError] = useState('');
  const isCommittingRootRef = useRef(false);

  const handleCreateRoot = async (type) => {
    const name = rootInputValue.trim();
    if (!name) return;
    isCommittingRootRef.current = true;
    setRootError('');
    try {
      const res = await fetch(`http://localhost:5000/projects/${workspaceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, parentId: null })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRootError(data.error || `Error ${res.status}`);
        isCommittingRootRef.current = false;
        return;
      }
      setRootInputValue('');
      setShowRootInput(null);
      onRefresh();
    } catch (e) {
      setRootError('Network error');
    }
    isCommittingRootRef.current = false;
  };

  const handleRootBlur = () => {
    if (isCommittingRootRef.current) return;
    setShowRootInput(null);
    setRootInputValue('');
    setRootError('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center space-x-1">
          <button onClick={() => setShowRootInput('file')} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowRootInput('folder')} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title="New Folder">
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {showRootInput && (
          <div className="px-1 py-1">
            <input
              autoFocus
              value={rootInputValue}
              onChange={e => setRootInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreateRoot(showRootInput); }
                if (e.key === 'Escape') { setShowRootInput(null); setRootInputValue(''); setRootError(''); }
              }}
              onBlur={handleRootBlur}
              placeholder={showRootInput === 'file' ? 'filename.js' : 'folder-name'}
              className="w-full bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
            />
            {rootError && <p className="text-red-400 text-xs mt-0.5">{rootError}</p>}
          </div>
        )}
        {files.length === 0 && !showRootInput && (
          <p className="text-xs text-slate-600 text-center py-4">No files yet. Create one above.</p>
        )}
        {files.map(node => (
          <FileNode
            key={node.id}
            node={node}
            workspaceId={workspaceId}
            token={token}
            activeFileId={activeFileId}
            onFileClick={onFileClick}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}
