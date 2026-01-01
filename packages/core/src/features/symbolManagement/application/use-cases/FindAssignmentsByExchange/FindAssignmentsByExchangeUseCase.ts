/**
 * Find Assignments By Exchange Use Case
 * Application layer - query worker assignments by exchange
 */

import { injectable, inject } from 'inversify';
import { WorkerAssignmentRepository } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import type { WorkerAssignment } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

@injectable()
export class FindAssignmentsByExchangeUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository)
    private repository: WorkerAssignmentRepository
  ) {}

  async execute(exchange: string): Promise<WorkerAssignment[]> {
    return this.repository.findByExchange(exchange);
  }
}
