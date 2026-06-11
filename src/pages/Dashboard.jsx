import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2, Plus, Clock, ArrowRight, Loader2, LogOut,
  Mail, CheckCircle, XCircle, Inbox, ChevronDown, ChevronUp
} from 'lucide-react';

const TOKEN_KEY = 'codev_token';
const USER_KEY = 'codev_user';

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [error, setError] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [inboxOpen, setInboxOpen] = useState(true);

  const token = localStorage.getItem(TOKEN_KEY) || '';
  const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/projects/my-projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setProjects(data.projects || []);
      else setError(data.error || 'Failed to load projects');
    } catch {
      setError('Network error — is the server running?');
    }
    setLoading(false);
  }, [token]);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/projects/invitations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setInvitations(data.invitations || []);
    } catch {}
    setInvitationsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchProjects();
    fetchInvitations();
  }, [token, fetchProjects, fetchInvitations]);

  const handleRespond = async (invitationId, status) => {
    setRespondingId(invitationId);
    try {
      const res = await fetch(`http://localhost:5000/projects/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
        if (status === 'ACCEPTED') {
          await fetchProjects();
        }
      }
    } catch {}
    setRespondingId(null);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('http://localhost:5000/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (res.ok) {
        setNewProjectName('');
        setShowNewInput(false);
        await fetchProjects();
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch {
      setError('Network error');
    }
    setCreating(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate('/login');
  };

  const roleColor = (member) => {
    const role = member?.roleName;
    if (role === 'Admin') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (role === 'Maintainer') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (role === 'Manager') return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  const userMember = (project) =>
    project.projectMembers?.find(m => m.userId === user?.id);

  return (
    <div className="flex-1 flex flex-col p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Your Projects</h1>
          <p className="text-slate-400 mt-1">
            {user ? `Signed in as ${user.email}` : 'Select a workspace to resume coding'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowNewInput(v => !v)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>New Workspace</span>
          </button>
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {invitations.length > 0 || invitationsLoading ? (
        <div className="mb-8 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setInboxOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Inbox className="w-5 h-5 text-indigo-400" />
                {invitations.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {invitations.length}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Pending Invitations
              </span>
              {!invitationsLoading && invitations.length > 0 && (
                <span className="bg-indigo-500/15 text-indigo-400 text-xs font-medium px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {invitations.length} pending
                </span>
              )}
            </div>
            {inboxOpen
              ? <ChevronUp className="w-4 h-4 text-slate-500" />
              : <ChevronDown className="w-4 h-4 text-slate-500" />
            }
          </button>

          {inboxOpen && (
            <div className="border-t border-slate-700/60 divide-y divide-slate-800">
              {invitationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              ) : invitations.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No pending invitations.</p>
              ) : (
                invitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2 mt-0.5 shrink-0">
                        <Mail className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {inv.project?.name || 'Unknown Project'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Invited by <span className="text-slate-400">{inv.inviterEmail}</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => handleRespond(inv.id, 'ACCEPTED')}
                        disabled={respondingId === inv.id}
                        id={`accept-${inv.id}`}
                        className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {respondingId === inv.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle className="w-3.5 h-3.5" />
                        }
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(inv.id, 'REJECTED')}
                        disabled={respondingId === inv.id}
                        id={`reject-${inv.id}`}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}

      {showNewInput && (
        <div className="mb-8 flex items-center space-x-3">
          <input
            autoFocus
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') setShowNewInput(false); }}
            placeholder="Project name..."
            className="bg-slate-900 border border-indigo-500 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none w-72"
          />
          <button
            onClick={handleCreateProject}
            disabled={creating}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Create</span>
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-600">
              <FolderGit2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No projects yet. Create one above.</p>
            </div>
          )}
          {projects.map((project) => {
            const member = userMember(project);
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/workspace/${project.id}`)}
                className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col h-48"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-slate-800 p-3 rounded-lg text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                    <FolderGit2 className="w-6 h-6" />
                  </div>
                  {member && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleColor(member)}`}>
                      {member.roleName.charAt(0).toUpperCase() + member.roleName.slice(1)}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-slate-100 mb-1">{project.name}</h3>

                <div className="mt-auto flex items-center justify-between text-sm text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
