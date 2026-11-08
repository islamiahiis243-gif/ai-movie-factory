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
    total_runs: 0,
    total_credits_used: 0,
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Generates initial production tasks for Cockpit & Agent Manager (0 dummy tasks in production)
 */
export function generateInitialDemoTasks(_projectId: string): AgentTask[] {
  return [];
}

/**
 * Generates initial execution logs (0 dummy logs in production)
 */
export function generateInitialDemoLogs(_projectId: string): AgentExecutionLog[] {
  return [];
}
