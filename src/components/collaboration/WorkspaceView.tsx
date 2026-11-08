import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Plus, 
  UserCircle,
  Crown,
  Video,
  PenTool,
  Eye,
  Settings,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../types/database';
import { 
  fetchWorkspaces, 
  createWorkspaceRecord, 
  fetchWorkspaceMembers, 
  inviteWorkspaceMember, 
  removeWorkspaceMember 
} from '../../lib/supabase';

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; color: string; bg: string; icon: any; desc: string }> = {
  owner: {
    label: 'Studio Owner',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: Crown,
    desc: 'Full billing, administrative, project creation, and team management control.'
  },
  director: {
    label: 'Director',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    icon: Video,
    desc: 'Creative direction, visual styling, prompt approvals, and pipeline execution.'
  },
  writer: {
    label: 'Writer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: PenTool,
    desc: 'Screenplay drafting, dialogue refinement, and scene hierarchy editing.'
  },
  reviewer: {
    label: 'Reviewer / QC',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: Eye,
    desc: 'Quality control evaluation, continuity review, and output playback only.'
  }
};

export const WorkspaceView: React.FC = () => {
  const { user, profile, t } = useAuth();
  const userId = user?.id || profile.id;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('writer');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const { data: wsList } = await fetchWorkspaces(userId);
    setWorkspaces(wsList);
    if (wsList.length > 0) {
      const active = selectedWorkspace ? wsList.find(w => w.id === selectedWorkspace.id) || wsList[0] : wsList[0];
      setSelectedWorkspace(active);
      const { data: mList } = await fetchWorkspaceMembers(active.id, userId);
      setMembers(mList);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleSelectWorkspace = async (ws: Workspace) => {
    setSelectedWorkspace(ws);
    setIsLoading(true);
    const { data: mList } = await fetchWorkspaceMembers(ws.id, userId);
    setMembers(mList);
    setIsLoading(false);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsSubmittingCreate(true);
    const res = await createWorkspaceRecord(userId, newWorkspaceName.trim());
    setIsSubmittingCreate(false);
    if (res.error || !res.data) {
      setActionMsg({ type: 'error', text: res.error || 'Gagal membuat workspace' });
    } else {
      setActionMsg({ type: 'success', text: `Workspace "${res.data.name}" berhasil dibuat!` });
      setShowCreateModal(false);
      setNewWorkspaceName('');
      loadData();
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setActionMsg({ type: 'error', text: 'Masukkan alamat email yang valid.' });
      return;
    }
    if (members.length >= selectedWorkspace.seat_limit) {
      setActionMsg({ 
        type: 'error', 
        text: 'Batas kursi workspace ini telah tercapai. Tingkatkan paket subscription untuk menambah kuota kursi.' 
      });
      return;
    }

    setIsSubmittingInvite(true);
    const res = await inviteWorkspaceMember(selectedWorkspace.id, userId, inviteEmail.trim(), inviteRole);
    setIsSubmittingInvite(false);

    if (res.error || !res.member) {
      setActionMsg({ type: 'error', text: res.error || 'Gagal mengundang anggota' });
    } else {
      setActionMsg({ type: 'success', text: `Undangan berhasil dikirim ke ${inviteEmail} sebagai ${ROLE_CONFIG[inviteRole].label}!` });
      setShowInviteModal(false);
      setInviteEmail('');
      const { data: mList } = await fetchWorkspaceMembers(selectedWorkspace.id, userId);
      setMembers(mList);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!selectedWorkspace) return;
    if (!confirm(`Keluarkan ${memberEmail} dari workspace?`)) return;

    const res = await removeWorkspaceMember(selectedWorkspace.id, userId, memberId);
    if (res.error) {
      setActionMsg({ type: 'error', text: res.error });
    } else {
      setActionMsg({ type: 'success', text: `Anggota berhasil dikeluarkan dari workspace.` });
      const { data: mList } = await fetchWorkspaceMembers(selectedWorkspace.id, userId);
      setMembers(mList);
    }
  };

  const seatsPercentage = selectedWorkspace 
    ? Math.min(100, Math.round((members.length / selectedWorkspace.seat_limit) * 100))
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Multi-Seat Studio Collaboration (Phase 7)</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            {t.workspaces?.title || 'Team Collaboration Workspaces'}
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            {t.workspaces?.subtitle || 'Kelola alokasi multi-seat dan peran produksi (Owner, Director, Writer, Reviewer).'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>{t.workspaces?.createWorkspace || 'Buat Workspace'}</span>
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            disabled={!selectedWorkspace || members.length >= (selectedWorkspace?.seat_limit || 1)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.workspaces?.inviteMember || 'Undang Anggota'}</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm ${
          actionMsg.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{actionMsg.text}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-xs opacity-75 hover:opacity-100 underline">Tutup</button>
        </div>
      )}

      {/* Workspace Switcher & Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace Selector Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Workspace Aktif</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              {workspaces.length} Unit
            </span>
          </div>

          <div className="space-y-2">
            {workspaces.map((ws) => {
              const isSelected = selectedWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-950/50'
                      : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-sm truncate">{ws.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Dibuat {new Date(ws.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300 border border-indigo-900/50">
                      {ws.active_seats_count || 1}/{ws.seat_limit} Kursi
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seat Allocation & Quota Meter */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Kapasitas Kursi Tim</span>
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Multi-Seat Access
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-300">Penggunaan Kursi</span>
                <span className="font-bold text-white font-mono">
                  {members.length} / {selectedWorkspace?.seat_limit || 5} Kursi ({seatsPercentage}%)
                </span>
              </div>
              <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className={`h-full transition-all duration-500 ${
                    seatsPercentage >= 100 
                      ? 'bg-rose-500' 
                      : seatsPercentage >= 80 
                        ? 'bg-amber-500' 
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{ width: `${seatsPercentage}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Kursi Tersedia:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {Math.max(0, (selectedWorkspace?.seat_limit || 5) - members.length)} Kursi
                </span>
              </div>
              <div className="flex justify-between">
                <span>Kebijakan Persetujuan:</span>
                <span className="text-zinc-300">Director QC Required</span>
              </div>
              <div className="flex justify-between">
                <span>Format Default:</span>
                <span className="text-zinc-300">16:9 Cinema 4K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Roles Breakdown Legend */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Hierarki Hak Akses (RBAC)</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(ROLE_CONFIG).map(([roleKey, conf]) => {
              const Icon = conf.icon;
              return (
                <div key={roleKey} className={`p-2.5 rounded-xl border ${conf.bg} flex flex-col justify-between`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                    <span className={conf.color}>{conf.label}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {conf.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team Members Roster */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-indigo-400" />
              <span>Daftar Anggota Tim & Kolaborator</span>
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Setiap anggota memiliki hak akses sesuai perannya dalam siklus pra-produksi hingga pascaproduksi film.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full font-mono border border-zinc-700">
              {members.length} Member Aktif
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 font-mono text-sm">
            Memuat daftar anggota tim workspace...
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            Belum ada anggota tim terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-950/40">
                  <th className="py-3.5 px-6">Anggota</th>
                  <th className="py-3.5 px-6">Peran Produksi</th>
                  <th className="py-3.5 px-6">Status Akun</th>
                  <th className="py-3.5 px-6">Bergabung</th>
                  <th className="py-3.5 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {members.map((member) => {
                  const conf = ROLE_CONFIG[member.role] || ROLE_CONFIG.writer;
                  const Icon = conf.icon;
                  const isOwner = member.role === 'owner';

                  return (
                    <tr key={member.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                            isOwner ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}>
                            {member.invited_email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{member.invited_email}</span>
                              {isOwner && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 font-mono">
                              ID: {member.id.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${conf.bg} ${conf.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{conf.label}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{member.status === 'active' ? 'Aktif' : 'Menunggu Konfirmasi'}</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-xs text-zinc-400">
                        {new Date(member.joined_at || member.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-6 text-right">
                        {isOwner ? (
                          <span className="text-xs text-zinc-500 italic">Primary Creator</span>
                        ) : (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.invited_email)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Keluarkan anggota"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && selectedWorkspace && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Undang Anggota Tim Baru</span>
              </h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Alamat Email Kolaborator
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@production.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Peran & Hak Akses Produksi
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(['director', 'writer', 'reviewer'] as WorkspaceRole[]).map((r) => {
                    const conf = ROLE_CONFIG[r];
                    const Icon = conf.icon;
                    const isSelected = inviteRole === r;

                    return (
                      <div
                        key={r}
                        onClick={() => setInviteRole(r)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected 
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-sm shadow-indigo-900/30' 
                            : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${conf.bg} mt-0.5`}>
                          <Icon className={`w-4 h-4 ${conf.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-white flex items-center justify-between">
                            <span>{conf.label}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                            {conf.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                Kursi terpakai saat ini: <strong className="text-white">{members.length}</strong> / {selectedWorkspace.seat_limit}.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-indigo-950/50"
                >
                  {isSubmittingInvite ? 'Mengirim Undangan...' : 'Kirim Undangan Akses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span>Buat Workspace Studio Baru</span>
              </h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Nama Workspace / Studio Unit
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nusantara Sci-Fi Studio, Xianxia Unit B"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all"
                />
              </div>

              <p className="text-xs text-zinc-400">
                Workspace baru akan secara otomatis menetapkan akun Anda sebagai <strong>Studio Owner</strong> dengan kuota kursi standar.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all"
                >
                  {isSubmittingCreate ? 'Membuat...' : 'Buat Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
