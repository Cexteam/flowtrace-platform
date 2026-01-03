/**
 * ConsistentHashRouter - Domain service for routing symbols to workers
 *
 * Implements consistent hashing (Ketama-style) for deterministic symbol-to-worker assignment.
 * This ensures that the same symbol always routes to the same worker,
 * providing cache locality and predictable behavior.
 *
 * Uses improved hash distribution with:
 * - MurmurHash3-style mixing for better distribution
 * - Multiple points per virtual node (Ketama-style) for even load balancing
 *
 */

/** Number of hash points per virtual node (Ketama-style) */
const POINTS_PER_VNODE = 4;

/**
 * Virtual node in the hash ring
 */
interface VirtualNode {
  /** Physical worker ID */
  workerId: string;
  /** Hash value on the ring */
  hashValue: number;
  /** Virtual node index */
  virtualIndex: number;
}

/**
 * Routing result with metadata
 */
export interface RoutingResult {
  /** Target worker ID */
  workerId: string;
  /** Hash value of the symbol */
  symbolHash: number;
  /** Whether this is a new assignment or existing */
  isNewAssignment: boolean;
}

/**
 * ConsistentHashRouter - Domain service for consistent hash-based routing
 */
export class ConsistentHashRouter {
  /** Sorted array of virtual nodes */
  private ring: VirtualNode[] = [];

  /** Number of virtual nodes per physical worker */
  private readonly virtualNodeCount: number;

  /** Cache of symbol -> worker assignments */
  private assignmentCache: Map<string, string> = new Map();

  /**
   * Create a new ConsistentHashRouter
   *
   * @param virtualNodeCount - Number of virtual nodes per worker (default: 80)
   *                          Each vnode creates 4 points on ring (Ketama-style)
   *                          Total points = virtualNodeCount * 4
   */
  constructor(virtualNodeCount: number = 80) {
    this.virtualNodeCount = virtualNodeCount;
  }

  /**
   * Add a worker to the hash ring (Ketama-style)
   *
   * Creates multiple points per virtual node for better distribution.
   * Total points per worker = virtualNodeCount * POINTS_PER_VNODE
   *
   * @param workerId - Unique worker identifier
   */
  addWorker(workerId: string): void {
    // Create virtual nodes with multiple points each (Ketama-style)
    for (let i = 0; i < this.virtualNodeCount; i++) {
      // Each virtual node creates multiple points on the ring
      for (let j = 0; j < POINTS_PER_VNODE; j++) {
        const virtualKey = `${workerId}-${i}-${j}`;
        const hashValue = this.hash(virtualKey);

        const virtualNode: VirtualNode = {
          workerId,
          hashValue,
          virtualIndex: i * POINTS_PER_VNODE + j,
        };

        // Insert in sorted order
        this.insertSorted(virtualNode);
      }
    }

    // Clear cache as assignments may have changed
    this.assignmentCache.clear();
  }

  /**
   * Remove a worker from the hash ring
   *
   * @param workerId - Worker to remove
   */
  removeWorker(workerId: string): void {
    this.ring = this.ring.filter((node) => node.workerId !== workerId);

    // Clear cache as assignments may have changed
    this.assignmentCache.clear();
  }

  /**
   * Get the worker responsible for a symbol
   *
   * @param symbol - Trading symbol to route
   * @returns Routing result with worker ID
   * @throws Error if no workers are available
   */
  getWorkerForSymbol(symbol: string): RoutingResult {
    if (this.ring.length === 0) {
      throw new Error('ConsistentHashRouter: No workers available in the ring');
    }

    // Check cache first
    const cachedWorker = this.assignmentCache.get(symbol);
    if (cachedWorker && this.hasWorker(cachedWorker)) {
      return {
        workerId: cachedWorker,
        symbolHash: this.hash(symbol),
        isNewAssignment: false,
      };
    }

    // Calculate hash and find worker
    const symbolHash = this.hash(symbol);
    const workerId = this.findWorkerForHash(symbolHash);

    // Cache the assignment
    this.assignmentCache.set(symbol, workerId);

    return {
      workerId,
      symbolHash,
      isNewAssignment: true,
    };
  }

  /**
   * Check if a worker exists in the ring
   *
   * @param workerId - Worker to check
   * @returns true if worker exists
   */
  hasWorker(workerId: string): boolean {
    return this.ring.some((node) => node.workerId === workerId);
  }

  /**
   * Get all unique worker IDs in the ring
   *
   * @returns Array of worker IDs
   */
  getAllWorkers(): string[] {
    const workers = new Set<string>();
    for (const node of this.ring) {
      workers.add(node.workerId);
    }
    return Array.from(workers);
  }

  /**
   * Get the number of workers in the ring
   *
   * @returns Worker count
   */
  getWorkerCount(): number {
    return this.getAllWorkers().length;
  }

  /**
   * Get load distribution for a set of symbols
   *
   * @param symbols - Symbols to analyze
   * @returns Map of worker ID to symbol count
   */
  getLoadDistribution(symbols: string[]): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const symbol of symbols) {
      try {
        const result = this.getWorkerForSymbol(symbol);
        const count = distribution.get(result.workerId) || 0;
        distribution.set(result.workerId, count + 1);
      } catch {
        // Skip if no workers available
      }
    }

    return distribution;
  }

  /**
   * Clear the assignment cache
   * Useful when workers are added/removed
   */
  clearCache(): void {
    this.assignmentCache.clear();
  }

  /**
   * Get ring statistics for monitoring
   */
  getRingStats(): {
    workerCount: number;
    virtualNodeCount: number;
    cacheSize: number;
  } {
    return {
      workerCount: this.getWorkerCount(),
      virtualNodeCount: this.ring.length,
      cacheSize: this.assignmentCache.size,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Hash function with MurmurHash3-style mixing
   * Provides excellent distribution for consistent hashing
   */
  private hash(key: string): number {
    // Initial hash using simple multiplication
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
    }

    // MurmurHash3 finalizer - provides excellent avalanche effect
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;

    return Math.abs(h) >>> 0; // Ensure positive 32-bit integer
  }

  /**
   * Insert a virtual node in sorted order by hash value
   */
  private insertSorted(node: VirtualNode): void {
    // Binary search for insertion point
    let low = 0;
    let high = this.ring.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.ring[mid].hashValue < node.hashValue) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.ring.splice(low, 0, node);
  }

  /**
   * Find the worker responsible for a hash value
   * Uses binary search to find the first node with hash >= symbolHash
   */
  private findWorkerForHash(symbolHash: number): string {
    // Binary search for the first node with hash >= symbolHash
    let low = 0;
    let high = this.ring.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.ring[mid].hashValue < symbolHash) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // If we've gone past the end, wrap around to the first node
    if (low >= this.ring.length) {
      low = 0;
    }

    return this.ring[low].workerId;
  }
}
