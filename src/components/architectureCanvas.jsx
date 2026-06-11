import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import * as Y from 'yjs';
import { useEffect, useState, useRef } from 'react';

import { Maximize2, Minimize2, X } from 'lucide-react';

export default function ArchitectureCanvas({ workspaceId, socket, isFloating, onPopOut, onClose, onDragStart, theme }) {
  const ydocRef = useRef(new Y.Doc());
  const ymapRef = useRef(ydocRef.current.getMap('excalidraw'));
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const ydoc = ydocRef.current;
    
    const handleLocalUpdate = (update) => {
      if (socket) {
        socket.emit('canvas-update', { workspaceId, update: Array.from(update) });
      }
    };
    ydoc.on('update', handleLocalUpdate);

    const handleRemoteUpdate = (update) => {
      if (update) {
        Y.applyUpdate(ydoc, new Uint8Array(update));
      }
    };
    if (socket) {
      socket.on('canvas-update', handleRemoteUpdate);
    }

    const observeHandler = () => {
      if (!excalidrawAPI || isUpdatingRef.current) return;
      const elementsStr = ymapRef.current.get('elements');
      if (elementsStr) {
        isUpdatingRef.current = true;
        try {
          excalidrawAPI.updateScene({ elements: JSON.parse(elementsStr) });
        } catch (e) {
        }
        isUpdatingRef.current = false;
      }
    };
    ymapRef.current.observe(observeHandler);

    return () => {
      ydoc.off('update', handleLocalUpdate);
      if (socket) {
        socket.off('canvas-update', handleRemoteUpdate);
      }
      ymapRef.current.unobserve(observeHandler);
    };
  }, [socket, workspaceId, excalidrawAPI]);

  const handleChange = (elements) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    ydocRef.current.transact(() => {
      ymapRef.current.set('elements', JSON.stringify(elements));
    });
    isUpdatingRef.current = false;
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', overflow: 'hidden', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={onDragStart} className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] transition-colors duration-300" style={{ cursor: isFloating ? 'move' : 'default' }}>
        <span className="text-xs font-semibold text-[var(--text-primary)]">Architecture Canvas</span>
        <div className="flex space-x-2" onMouseDown={e => e.stopPropagation()}>
          <button onClick={onPopOut} className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors" title={isFloating ? "Dock" : "Pop Out"}>
            {isFloating ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-red-400 transition-colors" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 relative">
        <Excalidraw
          theme={theme || "dark"}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
        />
      </div>
      <style>{`
        .excalidraw {
          --color-bg-1: var(--bg-base) !important;
          --color-surface-lowest: var(--bg-base) !important;
          --color-surface-low: var(--bg-elevated) !important;
          border-left: none;
        }
      `}</style>
    </div>
  );
}
