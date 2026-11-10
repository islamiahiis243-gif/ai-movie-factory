/**
 * AI Movie Factory - Pipeline Server Types
 * SSOT: docs/02_app_upgrade_II/01_master_requirements_and_upgrade_blueprint.md (Sections 9 & 10)
 */

import { PipelineJob, PipelineJobLog, PipelineStage, PipelineJobStatus } from '../../src/types/database';

export interface PipelineWorkerResult {
  processedCount: number;
  completedCount: number;
  failedCount: number;
  reconciledCount: number;
  details: Array<{
    jobId: string;
    stage: PipelineStage;
    status: PipelineJobStatus;
    message: string;
  }>;
}

export interface PipelineRetryPayload {
  jobId: string;
  idempotencyKey?: string;
}

export interface PipelineStatusResponse {
  job: PipelineJob | null;
  logs: PipelineJobLog[];
  isRecovered: boolean;
}
