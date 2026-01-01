/**
 * Find Assignments By Worker Use Case
 * Application layer - query worker assignments
 */

import { injectable, inject } from 'inversify';
import { WorkerAssignmentRepository } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import type { WorkerAssignment } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

@injectable()
export class FindAssignmentsByWorkerUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository)
    private repository: WorkerAssignmentRepository
  ) {}

  async execute(workerId: number): Promise<WorkerAssignment[]> {
    return this.repository.findByWorker(workerId);
  }
}
