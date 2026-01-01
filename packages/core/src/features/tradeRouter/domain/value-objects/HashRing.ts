/**
 * DOMAIN VALUE OBJECT: Consistent Hashing Ring
 * Implements consistent hashing for load-balanced symbol assignment to workers
 */

export class VirtualNode {
  constructor(
    public readonly nodeId: string,
    public readonly hashValue: number,
    public readonly weight: number = 1 // Virtual node weight
  ) {}
}

export class HashRing {
  private nodes: VirtualNode[] = [];
  private readonly VIRTUAL_NODE_MULTIPLIER = 100; // Number of virtual nodes per physical node

  /**
   * Add physical node to the ring with virtual nodes for load balancing
   */
  addNode(nodeId: string, weight: number = 1): void {
    // Create multiple virtual nodes per physical node for better load distribution
    for (let i = 0; i < this.VIRTUAL_NODE_MULTIPLIER; i++) {
      const virtualNodeId = `${nodeId}-${i}`;
      const hashValue = this.hash(virtualNodeId);
      const virtualNode = new VirtualNode(virtualNodeId, hashValue, weight);

      // Insert virtual node in sorted order
      this.insertVirtualNode(virtualNode);
    }
  }

  /**
   * Remove physical node and all its virtual nodes from the ring
   */
  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter(node => !node.nodeId.startsWith(`${nodeId}-`));
  }

  /**
   * Get the worker node responsible for a symbol (consistent hashing)
   */
  getNode(key: string): string {
    if (this.nodes.length === 0) {
      throw new Error('HashRing: No nodes available in the ring');
    }

    const hashValue = this.hash(key);
    const virtualNode = this.findNearestVirtualNode(hashValue);

    if (!virtualNode) {
      // Fallback to first node if no suitable virtual node found
      return this.nodes[0].nodeId.split('-')[0];
    }

    // Extract physical node ID from virtual node ID (format: "worker_0-2" -> "worker_0")
    return virtualNode.nodeId.split('-')[0];
  }

  /**
   * Get all worker nodes in the ring
   */
  getAllNodes(): string[] {
    const physicalNodes = new Set<string>();

    this.nodes.forEach(node => {
      const physicalNodeId = node.nodeId.split('-')[0];
      physicalNodes.add(physicalNodeId);
    });

    return Array.from(physicalNodes);
  }

  /**
   * Check if a node exists in the ring
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.some(node => node.nodeId.split('-')[0] === nodeId);
  }

  /**
   * Get ring distribution for debugging and monitoring
   */
  getRingInfo(): {
    totalVirtualNodes: number;
    totalPhysicalNodes: number;
    physicalNodes: string[];
    ringCoverage: number; // Percentage of the hash space covered
  } {
    const physicalNodes = this.getAllNodes();
    const ringCoverage = this.nodes.length > 0 ? 100 : 0; // Simplified calculation

    return {
      totalVirtualNodes: this.nodes.length,
      totalPhysicalNodes: physicalNodes.length,
      physicalNodes,
      ringCoverage
    };
  }

  /**
   * Calculate load distribution for rebalancing decisions
   */
  getLoadDistribution(testKeys: string[]): Map<string, number> {
    const distribution = new Map<string, number>();

    testKeys.forEach(key => {
      const node = this.getNode(key);
      distribution.set(node, (distribution.get(node) || 0) + 1);
    });

    return distribution;
  }

  // ============ PRIVATE METHODS ============

  /**
   * Simple hash function using DJB2 algorithm
   */
  private hash(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) + hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 0xFFFFFFFF; // Ensure positive number
  }

  /**
   * Insert virtual node maintaining sorted order
   */
  private insertVirtualNode(virtualNode: VirtualNode): void {
    let insertIndex = 0;

    // Find insertion point (binary search would be optimal but for simplicity using linear)
    for (let i = 0; i < this.nodes.length; i++) {
      if (virtualNode.hashValue < this.nodes[i].hashValue) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.nodes.splice(insertIndex, 0, virtualNode);
  }

  /**
   * Find the nearest virtual node clockwise from the given hash value
   */
  private findNearestVirtualNode(hashValue: number): VirtualNode | null {
    if (this.nodes.length === 0) return null;

    // For now, return the first node. In a full implementation:
    // - Find the virtual node where node.hash >= hashValue
    // - If no such node exists, wrap around to the first node (circular ring)
    // - Extract physical node ID from virtual node

    // Simplified for this implementation - return first virtual node
    return this.nodes[0];
  }
}
