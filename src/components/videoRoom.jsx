import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Video Room (War Room) Component.
 * Provides real-time video, audio, and screen sharing using WebRTC.
 * It manages a mesh network where each participant connects to every other participant via RTCPeerConnections.
 */
export default function VideoRoom({ socket, workspaceId, currentUser, onLeave }) {
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, initLeft: 0, initTop: 0 });

  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [position, setPosition] = useState({ top: 80, left: window.innerWidth - 420 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /**
   * Initializes a new RTCPeerConnection for a remote peer.
   * Attaches local media tracks to the connection, and sets up ICE candidate gathering and remote track handling.
   */
  const createPeerConnection = useCallback((peerId) => {
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          workspaceId,
          target: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      const isLocalStream = localStreamRef.current && stream.id === localStreamRef.current.id;
      if (!isLocalStream) {
        setRemoteStreams(prev => ({ ...prev, [peerId]: stream }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
        delete peerConnectionsRef.current[peerId];
      }
    };

    peerConnectionsRef.current[peerId] = pc;
    return pc;
  }, [socket, workspaceId]);

  useEffect(() => {
    let mounted = true;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (socket) {
          socket.emit('webrtc_join', {
            workspaceId,
            userId: currentUser.id,
            userName: currentUser.name,
          });
        }
      })
      .catch(err => {
        console.error('getUserMedia error:', err);
        if (socket) {
          socket.emit('webrtc_join', {
            workspaceId,
            userId: currentUser.id,
            userName: currentUser.name,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [socket, workspaceId, currentUser]);

  useEffect(() => {
    if (!socket) return;

    // When a new peer joins, the initiator creates a WebRTC offer and sends it.
    const handlePeerJoined = async ({ socketId, userName }) => {
      const pc = createPeerConnection(socketId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', {
          workspaceId,
          target: socketId,
          sdp: offer,
        });
      } catch (err) {
        console.error('offer error:', err);
      }
    };

    // When receiving an offer, set it as remote description and create an answer.
    const handleOffer = async ({ sender, sdp }) => {
      const pc = createPeerConnection(sender);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
          workspaceId,
          target: sender,
          sdp: answer,
        });
      } catch (err) {
        console.error('answer error:', err);
      }
    };

    // When receiving an answer, finish the handshake by setting the remote description.
    const handleAnswer = async ({ sender, sdp }) => {
      const pc = peerConnectionsRef.current[sender];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('setRemoteDescription error:', err);
        }
      }
    };

    const handleIceCandidate = async ({ sender, candidate }) => {
      const pc = peerConnectionsRef.current[sender];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('addIceCandidate error:', err);
        }
      }
    };

    const handlePeerLeft = ({ socketId }) => {
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('webrtc_peer_joined', handlePeerJoined);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('webrtc_peer_left', handlePeerLeft);
    socket.on('peer-joined', (socketId) => handlePeerJoined({ socketId, userName: 'Peer' }));
    socket.on('peer-left', (socketId) => handlePeerLeft({ socketId }));

    return () => {
      socket.off('webrtc_peer_joined', handlePeerJoined);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('webrtc_peer_left', handlePeerLeft);
      socket.off('peer-joined');
      socket.off('peer-left');
    };
  }, [socket, workspaceId, createPeerConnection]);

  const handleLeave = useCallback(() => {
    if (socket) {
      socket.emit('webrtc_leave', { workspaceId });
    }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStreams({});
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
    if (onLeave) onLeave();
  }, [socket, workspaceId, onLeave]);

  const toggleFullscreen = useCallback(() => {
    const el = document.getElementById('video-room-overlay');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff(prev => !prev);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null);
      if (cameraStream) {
        const videoTrack = cameraStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
        if (localStreamRef.current) {
          const oldVideoTracks = localStreamRef.current.getVideoTracks();
          oldVideoTracks.forEach(t => {
            localStreamRef.current.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(videoTrack);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        if (localStreamRef.current) {
          const oldVideoTracks = localStreamRef.current.getVideoTracks();
          oldVideoTracks.forEach(t => {
            localStreamRef.current.removeTrack(t);
            t.stop();
          });
          localStreamRef.current.addTrack(screenTrack);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        screenTrack.onended = () => setIsScreenSharing(false);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('getDisplayMedia error:', err);
      }
    }
  }, [isScreenSharing]);

  const onMouseDownDrag = useCallback((e) => {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initLeft: position.left,
      initTop: position.top,
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        left: Math.max(0, dragRef.current.initLeft + dx),
        top: Math.max(0, dragRef.current.initTop + dy),
      });
    };
    const onMouseUp = () => {
      dragRef.current.dragging = false;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const remotePeerIds = Object.keys(remoteStreams);

  return (
    <div
      id="video-room-overlay"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        width: '380px',
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <div
        onMouseDown={onMouseDownDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            War Room
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            {remotePeerIds.length + 1} participant{remotePeerIds.length !== 0 ? 's' : ''}
          </span>
        </div>
        <GripHorizontal style={{ width: '16px', height: '16px', color: '#475569' }} />
      </div>

      <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: remotePeerIds.length > 0 ? '1fr 1fr' : '1fr', gap: '8px' }}>
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-base)', aspectRatio: '16/9' }}>
          <video
            id="local-video"
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isCameraOff ? 'none' : 'block',
              transform: 'scaleX(-1)',
            }}
          />
          {isCameraOff && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-base)',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 700, color: '#818cf8',
              }}>
                {(currentUser.name || 'Y')[0].toUpperCase()}
              </div>
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: '6px', left: '6px',
            background: 'var(--bg-dropdown)',
            borderRadius: '4px', padding: '2px 6px',
            fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)',
          }}>
            You {isMuted ? '🔇' : ''}
          </div>
        </div>

        {remotePeerIds.map(peerId => (
          <RemoteVideo key={peerId} stream={remoteStreams[peerId]} peerId={peerId} />
        ))}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderTop: '1px solid var(--border-color)',
      }}>
        <ControlButton
          id="btn-toggle-mute"
          active={isMuted}
          activeColor="#ef4444"
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff style={{ width: '16px', height: '16px' }} /> : <Mic style={{ width: '16px', height: '16px' }} />}
        </ControlButton>

        <ControlButton
          id="btn-toggle-camera"
          active={isCameraOff}
          activeColor="#ef4444"
          onClick={toggleCamera}
          title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
        >
          {isCameraOff ? <VideoOff style={{ width: '16px', height: '16px' }} /> : <Video style={{ width: '16px', height: '16px' }} />}
        </ControlButton>

        <ControlButton
          id="btn-screen-share"
          active={isScreenSharing}
          activeColor="#6366f1"
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Monitor style={{ width: '16px', height: '16px' }} />
        </ControlButton>

        <ControlButton
          id="btn-fullscreen"
          active={isFullscreen}
          activeColor="#6366f1"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 style={{ width: '16px', height: '16px' }} /> : <Maximize2 style={{ width: '16px', height: '16px' }} />}
        </ControlButton>

        <ControlButton
          id="btn-leave-call"
          active
          activeColor="#ef4444"
          onClick={handleLeave}
          title="Leave Call"
        >
          <PhoneOff style={{ width: '16px', height: '16px' }} />
        </ControlButton>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function RemoteVideo({ stream, peerId }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-base)', aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute', bottom: '6px', left: '6px',
        background: 'var(--bg-dropdown)',
        borderRadius: '4px', padding: '2px 6px',
        fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)',
      }}>
        Peer
      </div>
    </div>
  );
}

function ControlButton({ id, active, activeColor, onClick, title, children }) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.1)',
        background: active ? `${activeColor}20` : 'rgba(255,255,255,0.05)',
        color: active ? activeColor : '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = active ? `${activeColor}35` : 'rgba(255,255,255,0.1)';
        e.currentTarget.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = active ? `${activeColor}20` : 'rgba(255,255,255,0.05)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}
