/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectListView } from './components/projects/ProjectListView';
import { ProjectModal } from './components/projects/ProjectModal';
import { ProjectDetailModal } from './components/projects/ProjectDetailModal';
import { DeleteConfirmModal } from './components/projects/DeleteConfirmModal';
import { AuthModal } from './components/auth/AuthModal';
import { ToastContainer, ToastMessage } from './components/common/NotificationToast';
import { Project, ProjectSettings } from './types/database';
import {
  fetchProjects,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord,
} from './lib/supabase';
import { INITIAL_DEMO_ACTIVITIES, INITIAL_DEMO_JOBS } from './lib/demoData';

// Code-Split Studio & Enterprise Views (Phase 12 Dynamic Imports)
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const WorldBuilderView = lazy(() =>
  import('./components/studio/WorldBuilderView').then((m) => ({ default: m.WorldBuilderView }))
);
const CharacterStudioView = lazy(() =>
  import('./components/studio/CharacterStudioView').then((m) => ({
    default: m.CharacterStudioView,
  }))
);
const StoryScriptView = lazy(() =>
  import('./components/studio/StoryScriptView').then((m) => ({ default: m.StoryScriptView }))
);
const StoryboardView = lazy(() =>
  import('./components/studio/StoryboardView').then((m) => ({ default: m.StoryboardView }))
);
const AgentManagerView = lazy(() =>
  import('./components/studio/AgentManagerView').then((m) => ({ default: m.AgentManagerView }))
);
const MediaStudioView = lazy(() =>
  import('./components/studio/MediaStudioView').then((m) => ({ default: m.MediaStudioView }))
);
const ProductionPipelineView = lazy(() =>
  import('./components/studio/ProductionPipelineView').then((m) => ({
    default: m.ProductionPipelineView,
  }))
);
const QualityControlView = lazy(() =>
  import('./components/studio/QualityControlView').then((m) => ({
    default: m.QualityControlView,
  }))
);
const EditingPostView = lazy(() =>
  import('./components/studio/EditingPostView').then((m) => ({ default: m.EditingPostView }))
);
const SubscriptionView = lazy(() =>
  import('./components/billing/SubscriptionView').then((m) => ({ default: m.SubscriptionView }))
);
const CreditsUsageView = lazy(() =>
  import('./components/billing/CreditsUsageView').then((m) => ({ default: m.CreditsUsageView }))
);
const AdminDashboardView = lazy(() =>
  import('./components/admin/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const WorkspaceView = lazy(() =>
  import('./components/collaboration/WorkspaceView').then((m) => ({ default: m.WorkspaceView }))
);
const MarketplaceView = lazy(() =>
  import('./components/marketplace/MarketplaceView').then((m) => ({ default: m.MarketplaceView }))
);
const LandingPageView = lazy(() =>
  import('./components/landing/LandingPageView').then((m) => ({ default: m.LandingPageView }))
);
const ModulePlaceholderView = lazy(() =>
  import('./components/studio/ModulePlaceholderView').then((m) => ({
    default: m.ModulePlaceholderView,
  }))
);

function StudioApp() {
  const { user, profile, isConfigured, language, t } = useAuth();

  // Navigation tab state: unauthenticated visitors default to landing page
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (['landing', 'dashboard', 'projects', 'subscription'].includes(hash)) {
        return hash;
      }
    }
    try {
      const hasSession = localStorage.getItem('sb-jixfakvbhugpypjtyshq-auth-token');
      if (hasSession) return 'dashboard';
    } catch {
      // fallback to landing
    }
    return 'landing';
  });

  // Projects data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [inspectProject, setInspectProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load projects on startup or user change
  const loadProjects = async () => {
    setIsLoadingProjects(true);
    const userId = user?.id || profile.id;
    const res = await fetchProjects(userId);
    setProjects(res.data);
    setIsDemoData(res.isDemo);
    setIsLoadingProjects(false);
  };

  useEffect(() => {
    loadProjects();
  }, [user?.id, profile.id]);

  // Project Actions
  const handleOpenCreateModal = () => {
    if (isConfigured && !user) {
      addToast('Silakan Masuk atau Daftar Akun untuk membuat dan menyimpan proyek di Cloud Studio.', 'info');
      setIsAuthModalOpen(true);
      return;
    }
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenEditModal = (proj: Project) => {
    setEditingProject(proj);
    setIsProjectModalOpen(true);
  };

  const handleSubmitProject = async (data: {
    name: string;
    description: string;
    genre: string;
    custom_genre?: string;
    production_format: string;
    settings: ProjectSettings;
  }) => {
    const userId = user?.id || profile.id;

    if (editingProject) {
      const res = await updateProjectRecord(editingProject.id, {
        name: data.name,
        description: data.description,
        genre: data.genre,
        custom_genre: data.custom_genre,
        production_format: data.production_format,
        settings: data.settings,
      });

      if (res.error) {
        addToast(res.error, 'error');
        throw new Error(res.error);
      } else {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingProject.id
              ? {
                  ...p,
                  name: data.name,
                  description: data.description,
                  genre: data.genre,
                  custom_genre: data.custom_genre || null,
                  production_format: data.production_format,
                  settings: data.settings,
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
        addToast(`Proyek "${data.name}" berhasil diperbarui.`, 'success');
        await loadProjects();
      }
    } else {
      const res = await createProjectRecord(userId, data);
      if (res.error) {
        addToast(res.error, 'error');
        throw new Error(res.error);
      } else {
        if (res.project) {
          // Immediately update state so project appears with zero delay in UI
          setProjects((prev) => [res.project!, ...prev.filter((p) => p.id !== res.project!.id)]);
          setIsDemoData(false);
        }
        addToast(`Proyek baru "${data.name}" berhasil dibuat.`, 'success');
        await loadProjects();
      }
    }
  };

  const handleDuplicateProject = async (proj: Project) => {
    const userId = user?.id || profile.id;
    const res = await createProjectRecord(userId, {
      name: `${proj.name} (Salinan)`,
      description: proj.description,
      genre: proj.genre,
      custom_genre: proj.custom_genre || undefined,
      production_format: proj.production_format,
      settings: proj.settings || {
        seasons_count: 1,
        episodes_count: 1,
        episode_duration_minutes: 15,
        scene_count_target: 10,
        aspect_ratio: '16:9',
        output_resolution: '1080p',
        frame_rate: '24fps',
        visual_style: 'Cinematic',
        output_language: 'id',
        subtitle_language: 'en',
        voice_language: 'id',
        production_quality: 'high',
        production_mode: 'ai_assisted',
        enabled_modules: ['world_builder', 'character_studio', 'story_script'],
        enabled_agents: ['master_director', 'script_writer'],
        human_approval_required: true,
        credit_budget: 5000,
      },
    });

    if (res.error) {
      addToast(res.error, 'error');
    } else {
      addToast(`Proyek "${proj.name}" berhasil diduplikasi.`, 'success');
      await loadProjects();
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    const res = await deleteProjectRecord(projectToDelete.id);
    setIsDeleting(false);

    if (res.error) {
      addToast(res.error, 'error');
    } else {
      addToast(`Proyek "${projectToDelete.name}" telah dihapus.`, 'info');
      setProjectToDelete(null);
      await loadProjects();
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col text-slate-100 font-sans">
      {/* Top Navbar */}
      <Navbar
        onOpenAuth={() => setIsAuthModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewProject={handleOpenCreateModal}
      />

      {/* Main Studio Body with Sidebar & Content Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar: displayed on studio modules, hidden on full-width landing page */}
        {activeTab !== 'landing' && (
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        {/* Dynamic Studio Canvas or Full-Width Landing Page */}
        <main className="flex-1 overflow-y-auto bg-[#0B0F17] relative">
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium tracking-wide">
                  Memuat Modul Studio...
                </span>
              </div>
            }
          >
          {activeTab === 'landing' && (
            <LandingPageView
              onEnterStudio={() => setActiveTab('dashboard')}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenSubscriptionModal={(packageId) => {
                setActiveTab('subscription');
              }}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              projects={projects}
              activities={INITIAL_DEMO_ACTIVITIES}
              jobs={INITIAL_DEMO_JOBS}
              isDemoData={isDemoData}
              onOpenCreateProject={handleOpenCreateModal}
              onSelectProject={(p) => setInspectProject(p)}
              onViewAllProjects={() => setActiveTab('projects')}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectListView
              projects={projects}
              onOpenCreateModal={handleOpenCreateModal}
              onOpenEditModal={handleOpenEditModal}
              onSelectProject={(p) => setInspectProject(p)}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={(p) => setProjectToDelete(p)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'world_builder' && (
            <WorldBuilderView
              projects={projects}
              onShowToast={addToast}
              onOpenCreateProject={handleOpenCreateModal}
            />
          )}

          {activeTab === 'character_studio' && (
            <CharacterStudioView
              projects={projects}
              selectedProjectId={inspectProject?.id || projects[0]?.id}
              onSelectProject={(id) => {
                const target = projects.find((p) => p.id === id);
                if (target) setInspectProject(target);
              }}
              onNavigateToMarketplace={() => setActiveTab('marketplace')}
              onShowToast={addToast}
              onOpenCreateProject={handleOpenCreateModal}
            />
          )}

          {activeTab === 'story_script' && (
            <StoryScriptView
              projects={projects}
              onShowToast={addToast}
              onOpenCreateProject={handleOpenCreateModal}
            />
          )}

          {activeTab === 'storyboard' && (
            <StoryboardView
              projects={projects}
              selectedProjectId={inspectProject?.id || projects[0]?.id}
              onSelectProject={(id) => {
                const target = projects.find((p) => p.id === id);
                if (target) setInspectProject(target);
              }}
              onNavigateToMediaStudio={(pId) => {
                const target = projects.find((p) => p.id === pId);
                if (target) setInspectProject(target);
                setActiveTab('media_studio');
              }}
              onNavigateToPipeline={(pId) => {
                const target = projects.find((p) => p.id === pId);
                if (target) setInspectProject(target);
                setActiveTab('production_pipeline');
              }}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'agent_manager' && (
            <div className="p-6">
              <AgentManagerView
                projects={projects}
                selectedProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                currentLang={profile.preferred_language === 'id' ? 'id' : 'en'}
              />
            </div>
          )}

          {activeTab === 'media_studio' && (
            <div className="p-6">
              <MediaStudioView
                projects={projects}
                selectedProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                onNavigateToEditing={(pId) => {
                  const target = projects.find((p) => p.id === pId);
                  if (target) setInspectProject(target);
                  setActiveTab('editing_post');
                }}
                currentLang={profile.preferred_language === 'id' ? 'id' : 'en'}
              />
            </div>
          )}

          {activeTab === 'production_pipeline' && (
            <div className="p-6">
              <ProductionPipelineView
                projects={projects}
                currentProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                language={language === 'id' ? 'id' : 'en'}
                t={t}
              />
            </div>
          )}

          {activeTab === 'quality_control' && (
            <div className="p-6">
              <QualityControlView
                projects={projects}
                selectedProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                onShowToast={addToast}
                onNavigateToModule={(tab, projectId) => {
                  const target = projects.find((p) => p.id === projectId);
                  if (target) setInspectProject(target);
                  setActiveTab(tab);
                }}
              />
            </div>
          )}

          {activeTab === 'editing_post' && (
            <div className="p-6">
              <EditingPostView
                projects={projects}
                selectedProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                onShowToast={addToast}
                onNavigateToPipeline={(projectId) => {
                  const target = projects.find((p) => p.id === projectId);
                  if (target) setInspectProject(target);
                  setActiveTab('production_pipeline');
                }}
              />
            </div>
          )}

          {activeTab === 'workspaces' && (
            <div className="p-6">
              <WorkspaceView />
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="p-6">
              <MarketplaceView
                projects={projects}
                selectedProjectId={inspectProject?.id || projects[0]?.id}
                onSelectProject={(id) => {
                  const target = projects.find((p) => p.id === id);
                  if (target) setInspectProject(target);
                }}
                onNavigateToCharacterStudio={(projectId) => {
                  const target = projects.find((p) => p.id === projectId);
                  if (target) setInspectProject(target);
                  setActiveTab('character_studio');
                }}
                onShowToast={addToast}
                onProjectCloned={(newProjectId) => {
                  loadProjects();
                  addToast('Proyek baru dari template berhasil dibuat!', 'success');
                }}
              />
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="p-6">
              <SubscriptionView
                userId={profile?.id || 'demo_user'}
                onShowToast={addToast}
                language={language === 'id' ? 'id' : 'en'}
                t={t}
              />
            </div>
          )}

          {activeTab === 'credits_usage' && (
            <div className="p-6">
              <CreditsUsageView
                userId={profile?.id || 'demo_user'}
                onShowToast={addToast}
                language={language === 'id' ? 'id' : 'en'}
                t={t}
              />
            </div>
          )}

          {activeTab === 'admin_panel' && (
            <div className="p-6">
              <AdminDashboardView
                currentUserId={user?.id || profile?.id || 'demo_user'}
                onShowToast={addToast}
                language={language === 'id' ? 'id' : 'en'}
                t={t}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsView onShowToast={addToast} />
          )}

          {activeTab !== 'dashboard' &&
            activeTab !== 'projects' &&
            activeTab !== 'world_builder' &&
            activeTab !== 'character_studio' &&
            activeTab !== 'story_script' &&
            activeTab !== 'storyboard' &&
            activeTab !== 'agent_manager' &&
            activeTab !== 'media_studio' &&
            activeTab !== 'production_pipeline' &&
            activeTab !== 'quality_control' &&
            activeTab !== 'editing_post' &&
            activeTab !== 'workspaces' &&
            activeTab !== 'marketplace' &&
            activeTab !== 'subscription' &&
            activeTab !== 'credits_usage' &&
            activeTab !== 'admin_panel' &&
            activeTab !== 'settings' &&
            activeTab !== 'landing' && (
              <ModulePlaceholderView
                moduleId={activeTab}
                projects={projects}
                onOpenCreateProject={handleOpenCreateModal}
                onSelectProject={(p) => setInspectProject(p)}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Modals & Dialogs */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSubmit={handleSubmitProject}
        editingProject={editingProject}
      />

      <ProjectDetailModal
        project={inspectProject}
        onClose={() => setInspectProject(null)}
        onEdit={(p) => handleOpenEditModal(p)}
        onDuplicate={(p) => handleDuplicateProject(p)}
        onDelete={(p) => setProjectToDelete(p)}
      />

      <DeleteConfirmModal
        isOpen={Boolean(projectToDelete)}
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(msg) => {
          addToast(msg, 'success');
          setActiveTab('dashboard');
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StudioApp />
    </AuthProvider>
  );
}
