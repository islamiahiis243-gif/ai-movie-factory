import {
  AgentRole,
  AgentTask,
  AgentExecutionLog,
  WorkflowExecutionPlan,
  Project,
  WorldBible,
  Character,
  SceneItem,
} from '../types/database';
import { MASTER_AGENT_ROSTER } from './agentsRegistry';

/**
 * AI Movie Factory - Master Director Orchestration Engine
 * Coordinates execution sequence, task dependencies, reasoning logs, and approval checkpoints.
 */

export interface WorkflowExecutionContext {
  projectId: string;
  project: Project;
  bible: WorldBible | null;
  characters: Character[];
  scenes: SceneItem[];
}

export function generateInitialAgentConfigs(projectId: string) {
  return MASTER_AGENT_ROSTER.map((agent, idx) => ({
    id: `cfg-${projectId}-${agent.role}`,
    project_id: projectId,
    agent_role: agent.role,
    agent_name: agent.name,
    enabled: true,
    selected_model: agent.default_model,
    custom_instructions: '',
    credit_limit_per_run: agent.suggested_credit_cost * 2,
    requires_approval: agent.role === 'master_director' || agent.role === 'qc_agent' || agent.role === 'script_writer',
    execution_priority: idx + 1,
    total_runs: Math.floor(Math.random() * 8) + 2,
    total_credits_used: (Math.floor(Math.random() * 8) + 2) * agent.suggested_credit_cost,
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Generates initial demo production tasks for Cockpit & Agent Manager
 */
export function generateInitialDemoTasks(projectId: string): AgentTask[] {
  return [
    {
      id: 'task-demo-01',
      project_id: projectId,
      workflow_type: 'script_generation',
      task_name: 'Penyusunan Naskah Episode #1: Jiwa Abadi yang Terbuang',
      agent_role: 'script_writer',
      agent_name: 'Script Writer',
      status: 'completed',
      progress: 100,
      input_params: { episode_number: 1, target_scenes: 6 },
      output_result: { scenes_generated: 3, word_count: 1250, dialouge_blocks: 12 },
      requires_human_approval: true,
      is_approved: true,
      approved_by: 'Kreator',
      approved_at: '2026-11-04T09:00:00Z',
      dependencies: [],
      execution_time_seconds: 42,
      credits_consumed: 30,
      started_at: '2026-11-04T08:55:00Z',
      completed_at: '2026-11-04T08:55:42Z',
    },
    {
      id: 'task-demo-02',
      project_id: projectId,
      workflow_type: 'character_audit',
      task_name: 'Audit Kontinuitas Visual Karakter Ye Chen & Gu Tianxiao',
      agent_role: 'qc_agent',
      agent_name: 'Quality Control Agent',
      status: 'awaiting_approval',
      progress: 85,
      input_params: { character_ids: ['char-001', 'char-004'], scenes_checked: [1, 2] },
      output_result: {
        score: '98/100',
        consistency_status: 'PASS',
        recommendation: 'Visual prompt seed stabil; warna jubah ungu Gu Tianxiao konsisten.',
      },
      requires_human_approval: true,
      is_approved: false,
      dependencies: ['task-demo-01'],
      execution_time_seconds: 22,
      credits_consumed: 25,
      started_at: '2026-11-04T10:15:00Z',
    },
    {
      id: 'task-demo-03',
      project_id: projectId,
      workflow_type: 'storyboard_construction',
      task_name: 'Penyusunan Shot List Adegan #2 (Duel Kebun Herba)',
      agent_role: 'storyboard_director',
      agent_name: 'Storyboard Director',
      status: 'running',
      progress: 60,
      input_params: { scene_number: 2, shot_count: 8 },
      requires_human_approval: false,
      is_approved: false,
      dependencies: ['task-demo-01'],
      execution_time_seconds: 18,
      credits_consumed: 30,
      started_at: '2026-11-04T11:00:00Z',
    },
  ];
}

/**
 * Generates initial demo execution logs
 */
export function generateInitialDemoLogs(projectId: string): AgentExecutionLog[] {
  return [
    {
      id: 'log-01',
      task_id: 'task-demo-01',
      project_id: projectId,
      agent_role: 'master_director',
      agent_name: 'Master Director',
      level: 'info',
      message: 'Menerima arahan produksi Episode #1. Mengurai dependensi karakter dan lokasi Story Bible.',
      timestamp: '2026-11-04T08:55:01Z',
    },
    {
      id: 'log-02',
      task_id: 'task-demo-01',
      project_id: projectId,
      agent_role: 'story_architect',
      agent_name: 'Story Architect',
      level: 'reasoning',
      message: 'Memetakan three-act arc: Beat pembuka (Gubuk Murid Luar), eskalasi (Hinaan Gu Tianxiao), resolusi aliansi (Paviliun Alkimia).',
      timestamp: '2026-11-04T08:55:12Z',
    },
    {
      id: 'log-03',
      task_id: 'task-demo-01',
      project_id: projectId,
      agent_role: 'script_writer',
      agent_name: 'Script Writer',
      level: 'action',
      message: 'Menulis blok dialog Ye Chen: "Tiga ribu tahun... Penguasa Sembilan Surga mengira telah mengubur jiwaku...".',
      timestamp: '2026-11-04T08:55:28Z',
    },
    {
      id: 'log-04',
      task_id: 'task-demo-01',
      project_id: projectId,
      agent_role: 'qc_agent',
      agent_name: 'Quality Control Agent',
      level: 'success',
      message: 'Audit naskah selesai. Format slugline INT/EXT valid, kepatuhan ranah kultivasi 100%, 0 plot hole terdeteksi.',
      timestamp: '2026-11-04T08:55:42Z',
    },
    {
      id: 'log-05',
      task_id: 'task-demo-02',
      project_id: projectId,
      agent_role: 'qc_agent',
      agent_name: 'Quality Control Agent',
      level: 'approval_required',
      message: 'Checkpoint Persetujuan Manusia: Audit Kontinuitas Visual memerlukan tinjauan kreator sebelum aset ditransfer ke pipeline rendering.',
      timestamp: '2026-11-04T10:15:22Z',
    },
  ];
}
