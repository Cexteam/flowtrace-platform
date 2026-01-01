/**
 * In-Memory Worker Assignment Repository
 *
 * Simple in-memory implementation for worker assignments.
 * Used as a temporary solution until platform-specific implementations are created.
 */

import { injectable } from 'inversify';
import {
  WorkerAssignmentRepository,
  type WorkerAssignment,
} from '../../../domain/repositories/WorkerAssignmentRepository.js';
import { createLogger } from '../../../../../shared/lib/logger/logger.js';

const logger = createLogger('InMemoryWorkerAssignmentRepository');

@injectable()
export class InMemoryWorkerAssignmentRepository
  implements WorkerAssignmentRepository
{
  private assignments: Map<string, WorkerAssignment> = new Map();

  private getKey(symbol: string, exchange: string): string {
    return `${exchange}:${symbol}`;
  }

  async save(assignment: WorkerAssignment): Promise<void> {
    const key = this.getKey(assignment.symbol, assignment.exchange);
    this.assignments.set(key, assignment);
    logger.debug(`Saved assignment for ${key}`);
  }

  async findByWorker(workerId: number): Promise<WorkerAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      (a) => a.workerId === workerId
    );
  }

  async findByExchange(exchange: string): Promise<WorkerAssignment[]> {
    return Array.from(this.assignments.values()).filter(
      (a) => a.exchange === exchange
    );
  }

  async getAssignment(
    symbol: string,
    exchange: string
  ): Promise<WorkerAssignment | null> {
    const key = this.getKey(symbol, exchange);
    return this.assignments.get(key) || null;
  }

  async removeAssignment(symbol: string, exchange: string): Promise<void> {
    const key = this.getKey(symbol, exchange);
    this.assignments.delete(key);
    logger.debug(`Removed assignment for ${key}`);
  }
}
