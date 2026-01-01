/**
 * Get Assignment Use Case
 * Application layer - get specific worker assignment
 */

import { injectable, inject } from 'inversify';
import { WorkerAssignmentRepository } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import type { WorkerAssignment } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

export interface GetAssignmentRequest {
  symbol: string;
  exchange: string;
}

@injectable()
export class GetAssignmentUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository)
    private repository: WorkerAssignmentRepository
  ) {}

  async execute(
    request: GetAssignmentRequest
  ): Promise<WorkerAssignment | null> {
    return this.repository.getAssignment(request.symbol, request.exchange);
  }
}
