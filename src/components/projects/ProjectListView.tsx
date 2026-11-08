import React, { useState, useMemo } from 'react';
import { Project } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { GENRE_OPTIONS, FORMAT_OPTIONS } from '../../lib/translations';
import {
  Search,
  Plus,
  Filter,
  Film,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ProjectListViewProps {
  projects: Project[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onDuplicateProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onOpenAuthModal?: () => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  onOpenCreateModal,
  onOpenEditModal,
  onSelectProject,
  onDuplicateProject,
  onDeleteProject,
  onOpenAuthModal,
}) => {
  const { t, user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'name_asc' | 'name_desc'>('latest');

  // Filter & sort logic
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.genre.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesGenre = selectedGenre === 'all' || p.genre === selectedGenre;
        const matchesFormat = selectedFormat === 'all' || p.production_format === selectedFormat;
        const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;

        return matchesSearch && matchesGenre && matchesFormat && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'latest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        return 0;
      });
  }, [projects, searchQuery, selectedGenre, selectedFormat, selectedStatus, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedGenre('all');
    setSelectedFormat('all');
    setSelectedStatus('all');
    setSortBy('latest');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{t.projects.title}</h2>
          <p className="text-xs text-slate-400 mt-1">{t.projects.subtitle}</p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-amber-400/20 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.projects.createNew}</span>
        </button>
      </div>
 
      {/* Guest Mode Indicator Banner */}
      {!user && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Mode Tamu (Penyimpanan Browser Lokal):</strong> Proyek disimpan di browser ini. Masuk atau Daftar akun untuk menyimpan dan menyinkronkan proyek ke Supabase Cloud PostgreSQL secara otomatis.
            </span>
          </div>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded-lg shrink-0 cursor-pointer transition-colors shadow-sm"
            >
              Masuk / Daftar Akun
            </button>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.projects.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">{t.projects.allGenres}</option>
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">{t.projects.allFormats}</option>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">{t.projects.allStatuses}</option>
              <option value="draft">{t.statuses.draft}</option>
              <option value="in_development">{t.statuses.in_development}</option>
              <option value="in_production">{t.statuses.in_production}</option>
              <option value="post_production">{t.statuses.post_production}</option>
              <option value="completed">{t.statuses.completed}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer font-mono"
            >
              <option value="latest">{t.projects.sortLatest}</option>
              <option value="oldest">{t.projects.sortOldest}</option>
              <option value="name_asc">{t.projects.sortNameAsc}</option>
              <option value="name_desc">{t.projects.sortNameDesc}</option>
            </select>
          </div>
        </div>

        {/* Results count & Clear */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
          <span>
            Menampilkan <strong className="text-slate-300 tabular-nums">{filteredProjects.length}</strong> dari{' '}
            <span className="tabular-nums">{projects.length}</span> proyek
          </span>
          {(searchQuery || selectedGenre !== 'all' || selectedFormat !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={resetFilters}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
            >
              {t.projects.emptyStateAction}
            </button>
          )}
        </div>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#101726] border border-slate-800/80 space-y-3">
          <Film className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-slate-300">{t.projects.emptyState}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau ubah filter untuk menemukan proyek yang dicari.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs text-amber-400 font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            {t.projects.emptyStateAction}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={() => onSelectProject(project)}
              onEdit={() => onOpenEditModal(project)}
              onDuplicate={() => onDuplicateProject(project)}
              onDelete={() => onDeleteProject(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const s = project.settings;

  return (
    <div className="group rounded-xl bg-[#101726] border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between overflow-hidden shadow-lg shadow-black/20">
      {/* Top Section */}
      <div className="p-5 space-y-3">
        {/* Unboxed clean metadata kicker (Anti-slop zero pill rule) */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="text-amber-400 font-medium">{project.genre}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="truncate">{project.production_format}</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Project actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-7 z-40 w-40 bg-[#162036] border border-slate-700 rounded-lg shadow-2xl py-1 text-xs text-slate-200">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSelect();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.projects.viewDetails}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.projects.edit}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.projects.duplicate}</span>
                  </button>
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-rose-500/10 text-rose-300 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.projects.delete}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Project Title */}
        <button
          onClick={onSelect}
          className="text-left w-full cursor-pointer group-hover:text-amber-400 transition-colors"
        >
          <h3 className="text-base font-bold text-white tracking-tight line-clamp-1">
            {project.name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            {project.description || 'Tidak ada deskripsi yang disediakan.'}
          </p>
        </button>

        {/* Production Specs Strip (Single-line unboxed text) */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3 text-[11px] text-slate-400 font-mono tabular-nums">
          <span>{s?.seasons_count || 1} Musim</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{s?.episodes_count || 1} Episode</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{s?.aspect_ratio || '16:9'}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>{s?.output_resolution || '4K'}</span>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[11px] text-slate-500 font-mono">Status:</span>
          <span className="text-amber-400 font-medium">
            {t.statuses[project.status] || project.status}
          </span>
        </div>

        <button
          onClick={onSelect}
          className="text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Buka Studio</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
};
