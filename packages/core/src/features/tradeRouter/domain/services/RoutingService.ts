import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../shared/lib/di/core/types.js';
import { HashRing } from '../value-objects/HashRing.js';
import { createLogger } from '../../../../shared/lib/logger/logger.js';

const logger = createLogger('RoutingService');

/**
 * DOMAIN SERVICE: Intelligent Trade Routing
 * Implements sophisticated load balancing and worker selection algorithms
 * Uses consistent hashing + load balancing + health-aware routing
 */

export interface WorkerCapacityInfo {
  workerId: string;
  currentLoad: number; // Number of symbols handled
  processingPower: number; // CPU/memory capacity indicator (0-100)
  healthScore: number; // Health score from monitoring (0-100)
  assignedSymbols: string[];
}

export interface RoutingDecision {
  workerId: string;
  reason: string;
  loadDistribution: Map<string, number>;
  confidence: number; // 0-100 confidence in this decision
}

/**
 * DOMAIN SERVICE: Advanced Worker Selection Algorithms
 * Manages consistent hashing, load balancing, and intelligent routing
 */
@injectable()
export class RoutingService {
  private hashRing = new HashRing();
  private registeredWorkers = new Map<string, WorkerCapacityInfo>();

  constructor() {
    // Domain service - no external dependencies
  }

  /**
   * Register worker with the routing system
   */
  registerWorker(
    workerId: string,
    capacity: Partial<WorkerCapacityInfo> = {}
  ): void {
    if (!this.registeredWorkers.has(workerId)) {
      this.registeredWorkers.set(workerId, {
        workerId,
        currentLoad: capacity.currentLoad || 0,
        processingPower: capacity.processingPower || 50,
        healthScore: capacity.healthScore || 100,
        assignedSymbols: capacity.assignedSymbols || [],
      });

      // Add worker to hash ring for consistent hashing
      this.hashRing.addNode(workerId);

      logger.info(`✅ Worker ${workerId} registered with routing service`);
    }
  }

  /**
   * Unregister worker and rebalance symbols
   */
  unregisterWorker(workerId: string): void {
    if (!this.registeredWorkers.has(workerId)) return;

    // Remove from hash ring
    this.hashRing.removeNode(workerId);

    // redistribution will happen naturally as RebalanceWorkerSymbols event
    this.registeredWorkers.delete(workerId);

    logger.info(`🗑️ Worker ${workerId} unregistered from routing service`);
  }

  /**
   * INTELLIGENT LOAD BALANCING: Route symbol to optimal worker
   * Uses multiple algorithms: consistent hashing + load balancing + health checks
   */
  routeSymbolToWorker(
    symbol: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): RoutingDecision {
    if (this.registeredWorkers.size === 0) {
      throw new Error('RoutingService: No workers registered');
    }

    // 🎯 ALGORITHM 1: Consistent Hashing (Deterministic distribution)
    const hashOptimalWorker = this.hashRing.getNode(symbol);

    // 🎯 ALGORITHM 2: Load-Aware Balancing
    const hashOptimalWorkerInfo = this.registeredWorkers.get(hashOptimalWorker);
    if (!hashOptimalWorkerInfo) {
      throw new Error(
        `RoutingService: Worker ${hashOptimalWorker} not registered`
      );
    }
    const loadBalancedWorker = this.findBestWorkerForLoad(
      symbol,
      hashOptimalWorker
    );

    // 🎯 ALGORITHM 3: Health & Priority Aware Selection
    const selectedWorker = this.applyHealthAndPriorityChecks(
      symbol,
      hashOptimalWorkerInfo,
      loadBalancedWorker,
      priority
    );

    // Calculate load distribution for transparency
    const loadDistribution = this.getCurrentLoadDistribution();

    logger.info(
      `📊 Symbol ${symbol} routed to ${selectedWorker.worker.workerId}`,
      {
        reason: selectedWorker.reason,
        confidence: selectedWorker.confidence,
        loadDistribution: Object.fromEntries(loadDistribution),
      }
    );

    return {
      workerId: selectedWorker.worker.workerId,
      reason: selectedWorker.reason,
      loadDistribution,
      confidence: selectedWorker.confidence,
    };
  }

  /**
   * Update worker load when routes are assigned/removed
   */
  updateWorkerLoad(
    workerId: string,
    symbolAction: 'add' | 'remove',
    symbol: string
  ): void {
    const worker = this.registeredWorkers.get(workerId);
    if (!worker) return;

    if (symbolAction === 'add') {
      worker.currentLoad++;
      worker.assignedSymbols.push(symbol);
    } else {
      worker.currentLoad = Math.max(0, worker.currentLoad - 1);
      worker.assignedSymbols = worker.assignedSymbols.filter(
        (s) => s !== symbol
      );
    }

    logger.debug(
      `⚖️ Worker ${workerId} load updated: ${worker.currentLoad} symbols`
    );
  }

  /**
   * Rebalance symbols when workers are added/removed
   */
  rebalanceSymbols(): {
    rebalancedSymbols: string[];
    originalAssignments: Map<string, string>;
  } {
    const rebalancedSymbols: string[] = [];
    const originalAssignments = new Map<string, string>();

    // For each symbol currently assigned, check if it's still optimally assigned
    this.registeredWorkers.forEach((worker, workerId) => {
      worker.assignedSymbols.forEach((symbol) => {
        const optimalWorker = this.routeSymbolToWorker(symbol).workerId;

        if (optimalWorker !== workerId) {
          originalAssignments.set(symbol, workerId);
          rebalancedSymbols.push(symbol);

          // Move symbol to optimal worker
          this.updateWorkerLoad(workerId, 'remove', symbol);
          this.updateWorkerLoad(optimalWorker, 'add', symbol);
        }
      });
    });

    if (rebalancedSymbols.length > 0) {
      logger.info(
        `🔄 Rebalanced ${rebalancedSymbols.length} symbols for optimal distribution`
      );
    }

    return { rebalancedSymbols, originalAssignments };
  }

  /**
   * Update worker health scores for intelligent routing
   */
  updateWorkerHealth(workerId: string, healthScore: number): void {
    const worker = this.registeredWorkers.get(workerId);
    if (worker) {
      worker.healthScore = Math.max(0, Math.min(100, healthScore)); // Clamp to 0-100
    }
  }

  /**
   * Get routing statistics for monitoring
   */
  getRoutingStats(): {
    totalWorkers: number;
    totalSymbols: number;
    loadDistribution: Map<string, number>;
    averageLoad: number;
    maxLoad: number;
    hashRingInfo: any;
  } {
    const totalWorkers = this.registeredWorkers.size;
    const totalSymbols = Array.from(this.registeredWorkers.values()).reduce(
      (sum, worker) => sum + worker.assignedSymbols.length,
      0
    );

    const loadDistribution = this.getCurrentLoadDistribution();
    const loads = Array.from(loadDistribution.values());
    const averageLoad =
      loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
    const maxLoad = loads.length > 0 ? Math.max(...loads) : 0;

    return {
      totalWorkers,
      totalSymbols,
      loadDistribution,
      averageLoad: Math.round(averageLoad),
      maxLoad,
      hashRingInfo: this.hashRing.getRingInfo(),
    };
  }

  // ============ PRIVATE METHODS ============

  /**
   * ALGORITHM: Find best worker considering load balancing
   */
  private findBestWorkerForLoad(
    symbol: string,
    hashPreferred: string
  ): WorkerCapacityInfo {
    const candidates = Array.from(this.registeredWorkers.values());
    if (candidates.length === 0) return candidates[0];

    // Score each worker for this symbol
    const scoredWorkers = candidates.map((worker) => ({
      worker,
      score: this.calculateWorkerScore(worker, hashPreferred),
    }));

    // Sort by score (higher is better)
    scoredWorkers.sort((a, b) => b.score - a.score);

    return scoredWorkers[0].worker;
  }

  /**
   * SCORING ALGORITHM: Calculate worker fitness score
   */
  private calculateWorkerScore(
    worker: WorkerCapacityInfo,
    hashPreferred: string
  ): number {
    let score = 0;

    // Base score: Hash consistency (high preference for hash-optima)
    if (worker.workerId === hashPreferred) {
      score += 50;
    } else {
      score += 20; // Still applicable but not optimal
    }

    // Load balancing score (prefer less loaded workers)
    const normalizedLoad = this.normalizeLoad(worker.currentLoad);
    score += (1 - normalizedLoad) * 25; // 25% preference for load balancing

    // Health score (0-25 points)
    score += (worker.healthScore / 100) * 25;

    return score;
  }

  /**
   * HEALTH & PRIORITY FILTER: Apply final health and priority checks
   */
  private applyHealthAndPriorityChecks(
    symbol: string,
    hashPreferred: WorkerCapacityInfo,
    loadPreferred: WorkerCapacityInfo,
    priority: 'low' | 'normal' | 'high'
  ): { worker: WorkerCapacityInfo; reason: string; confidence: number } {
    // For high priority: try to use hash-consistent assignment even if load differs
    if (priority === 'high' && hashPreferred.healthScore > 80) {
      return {
        worker: hashPreferred,
        reason: 'High priority: Using consistent hash assignment',
        confidence: 95,
      };
    }

    // Standard routing: use load-balanced choice if healthy
    if (loadPreferred.healthScore > 70) {
      const isHashConsistent =
        loadPreferred.workerId === hashPreferred.workerId;
      return {
        worker: loadPreferred,
        reason: isHashConsistent
          ? 'Consistent hash + load balanced'
          : 'Load balanced',
        confidence: isHashConsistent ? 100 : 85,
      };
    }

    // Fallback: Use hash preferred if load preferred is unhealthy
    if (hashPreferred.healthScore > 50) {
      return {
        worker: hashPreferred,
        reason: 'Fallback: Using hash assignment (load preferred unhealthy)',
        confidence: 60,
      };
    }

    // Last resort: Find any healthy worker
    const bestHealthy = Array.from(this.registeredWorkers.values())
      .filter((w) => w.healthScore > 30)
      .sort((a, b) => b.healthScore - a.healthScore)[0];

    return {
      worker: bestHealthy || hashPreferred,
      reason: 'Emergency: Using least unhealthy worker',
      confidence: 20,
    };
  }

  /**
   * Normalize load values for scoring (0-1 scale)
   */
  private normalizeLoad(load: number): number {
    if (load === 0) return 0;

    // Simple normalization: assume max reasonable load is 50 symbols
    const maxLoad = Math.max(50, this.registeredWorkers.size * 10);
    return Math.min(load / maxLoad, 1);
  }

  /**
   * Get current load distribution map
   */
  private getCurrentLoadDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();
    this.registeredWorkers.forEach((worker) => {
      distribution.set(worker.workerId, worker.currentLoad);
    });
    return distribution;
  }
}
