/**
 * Assign Symbol To Worker Use Case
 * Application layer - contains business logic for worker assignment
 */

import { injectable, inject } from 'inversify';
import { createHash } from 'crypto';
import { WorkerAssignmentRepository } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import type { WorkerAssignment } from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { SYMBOL_MANAGEMENT_TYPES } from '../../../../../shared/lib/di/bindings/features/symbolManagement/types.js';

export interface AssignSymbolRequest {
  symbol: string;
  exchange: string;
  totalWorkers: number;
}

export interface AssignSymbolResponse {
  workerId: number;
  assignment: WorkerAssignment;
}

@injectable()
export class AssignSymbolToWorkerUseCase {
  constructor(
    @inject(SYMBOL_MANAGEMENT_TYPES.WorkerAssignmentRepository)
    private repository: WorkerAssignmentRepository
  ) {}

  async execute(request: AssignSymbolRequest): Promise<AssignSymbolResponse> {
    const { symbol, exchange, totalWorkers } = request;

    // Business logic: Calculate worker ID using consistent hashing
    const workerId = this.calculateWorkerAssignment(symbol, totalWorkers);

    // Create assignment domain model
    const assignment: WorkerAssignment = {
      symbolKey: `${exchange}:${symbol}`,
      symbol,
      exchange,
      workerId,
      assignedAt: new Date(),
    };

    // Persist via repository
    await this.repository.save(assignment);

    return { workerId, assignment };
  }

  /**
   * Calculate worker assignment using consistent hashing
   * Hashes the symbol name only (not exchange) for distribution
   */
  private calculateWorkerAssignment(
    symbol: string,
    totalWorkers: number
  ): number {
    // Hash the symbol name only for consistent distribution
    const hash = createHash('sha256').update(symbol).digest();

    // Convert first 4 bytes to unsigned integer
    const hashValue =
      (hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];

    // Use modulo to map to worker ID
    return Math.abs(hashValue) % totalWorkers;
  }
}
