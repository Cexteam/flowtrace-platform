/**
 * Remove Assignment Use Case
 * Application layer - remove worker assignment
 */

import { injectable, inject } from 'inversify';
import { WorkerAssignmentRepository } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

export interface RemoveAssignmentRequest {
  symbol: string;
  exchange: string;
}

@injectable()
export class RemoveAssignmentUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository)
    private repository: WorkerAssignmentRepository
  ) {}

  async execute(request: RemoveAssignmentRequest): Promise<void> {
    await this.repository.removeAssignment(request.symbol, request.exchange);
  }
}
