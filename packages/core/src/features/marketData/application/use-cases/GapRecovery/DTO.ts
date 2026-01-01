import { TradeRecord } from '../../ports/out/RestApiGapRecoveryPort.js';

/**
 * GAP RECOVERY USE CASE - Clean Architecture DTOs
 *
 * Handles automatic detection and recovery of missing trade data.
 * Integrates REST API recovery with state restoration for seamless data continuity.
 *
 * Clean Architecture: Application Layer Communication
 */

// ✅ REQUEST DTOs

export interface DetectGapsRequest {
  /** Symbol to check for gaps */
  symbol: string;
  /** Expected trade sequences from restored state */
  expectedTrades?: TradeRecord[][];
  /** Last successfully processed trade ID */
  lastProcessedId: number;
  /** Maximum number of gaps to consider for recovery */
  maxGapsToRecover?: number;
  /** Detection sensitivity settings */
  detectionConfig?: GapDetectionConfig;
}

export interface RecoverGapsRequest {
  /** Symbol to recover gaps for */
  symbol: string;
  /** Specific gaps to recover */
  gapsToRecover: GapInfo[];
  /** Recovery strategy to use */
  strategy?: RecoveryStrategy;
  /** Rate limiting configuration */
  rateLimitConfig?: RateLimitConfig;
  /** Recovery timeout (milliseconds) */
  timeoutMs?: number;
}

export interface GapDetectionConfig {
  /** Minimum gap size to consider */
  minGapSize: number;
  /** Maximum gap size to process (prevents excessive recovery) */
  maxGapSize: number;
  /** Minimum confidence required for gap detection */
  minConfidenceThreshold: number;
  /** Time window to look back for gap detection */
  lookbackHours: number;
}

export interface RateLimitConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  /** Pause between batches (milliseconds) */
  batchPauseMs: number;
  /** Circuit breaker error threshold */
  errorThreshold: number;
}

// ✅ RESPONSE DTOs

export interface DetectGapsResponse {
  success: boolean;
  /** Symbol analyzed */
  symbol: string;
  /** All gaps detected */
  detectedGaps: GapInfo[];
  /** Gaps prioritized for recovery */
  actionableGaps: GapInfo[];
  /** Whether recovery is recommended */
  recoveryRecommended: boolean;
  /** Any errors during detection */
  errors?: string[];
  /** Detection metadata */
  metadata: GapDetectionMetadata;
}

export interface RecoverGapsResponse {
  success: boolean;
  /** Symbol recovered */
  symbol: string;
  /** Total trades recovered */
  recoveredTrades: number;
  /** Gaps successfully filled */
  successGaps: GapInfo[];
  /** Gaps that failed recovery */
  failedGaps: GapInfo[];
  /** Recovery metadata */
  metadata: RecoveryMetadata;
  /** Any errors during recovery */
  errors?: string[];
}

// ✅ DATA STRUCTURES

/**
 * Information about a detected gap
 */
export interface GapInfo {
  /** Trading symbol */
  symbol: string;
  /** First missing trade ID */
  startId: number;
  /** Last missing trade ID */
  endId: number;
  /** Total number of missing trades */
  tradeCount: number;
  /** Reason gap was detected */
  detectionReason: GapDetectionReason;
  /** Confidence in gap accuracy (0-1) */
  confidence: number;
  /** Recovery priority (higher = more urgent) */
  priority: number;
  /** Estimated recovery time (milliseconds) */
  estimatedRecoveryTime: number;
  /** Additional gap details */
  metadata?: Record<string, any>;
}

/**
 * Gap detection reason classification
 */
export type GapDetectionReason =
  | 'sequence_gap'              // Gap in restored trade sequence
  | 'processed_vs_current_gap'  // Gap between restored state and current
  | 'live_gap_detection'        // Gap detected from live trading
  | 'manual_detection'          // Gap manually identified
  | 'periodic_check';           // Gap found during periodic validation

/**
 * Recovery strategy options
 */
export type RecoveryStrategy =
  | 'batch'        // Group gaps for efficient batch processing
  | 'individual'   // Process each gap separately
  | 'prioritized'  // Process highest priority gaps first
  | 'adaptive';    // Dynamically choose strategy based on conditions

/**
 * Gap detection metadata
 */
export interface GapDetectionMetadata {
  /** Total time for detection (milliseconds) */
  detectionDuration: number;
  /** When detection was performed */
  detectionTimestamp: number;
  /** Total number of gaps found */
  gapCount: number;
  /** Size of largest gap found */
  largestGap: number;
  /** Detection parameters used */
  configUsed: GapDetectionConfig;
  /** Performance metrics */
  performance: {
    sequencesAnalyzed: number;
    tradeComparisonsMade: number;
    averageDetectionSpeed: number;
  };
}

/**
 * Recovery execution metadata
 */
export interface RecoveryMetadata {
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Total time for recovery (milliseconds) */
  recoveryDuration: number;
  /** When recovery was performed */
  recoveryTimestamp: number;
  /** Rate of successful gap fill */
  successRate: number;
  /** Total gaps processed */
  totalGaps: number;
  /** Number of REST API calls made */
  apiCallsMade: number;
  /** Rate limit hits encountered */
  rateLimitHits: number;
  /** Performance metrics */
  performance: {
    tradesProcessedPerSecond: number;
    averageApiCallDuration: number;
    totalBytesTransferred: number;
    memoryPeakUsage: number;
  };
}

// ✅ EVENT DTOs

export interface GapDetectionEvent {
  /** Event type */
  type: 'gaps_detected';
  /** Detection details */
  payload: {
    symbol: string;
    gapsDetected: number;
    actionableGaps: number;
    recoveryRecommended: boolean;
    largestGap: number;
  };
  /** When event occurred */
  timestamp: number;
}

export interface GapRecoveryEvent {
  /** Event type */
  type: 'gaps_recovered';
  /** Recovery details */
  payload: {
    symbol: string;
    strategy: RecoveryStrategy;
    tradesRecovered: number;
    successRate: number;
    recoveryDuration: number;
  };
  /** When event occurred */
  timestamp: number;
}

export interface GapRecoveryFailedEvent {
  /** Event type */
  type: 'gap_recovery_failed';
  /** Failure details */
  payload: {
    symbol: string;
    strategy: RecoveryStrategy;
    failedGaps: number;
    errors: string[];
    lastAttemptTimestamp: number;
  };
  /** When event occurred */
  timestamp: number;
}

// ✅ UTILITY TYPES

/**
 * Gap recovery statistics
 */
export interface GapRecoveryStats {
  /** Total gap detection runs */
  totalDetections: number;
  /** Total gaps detected */
  totalGapsDetected: number;
  /** Total successful recoveries */
  totalSuccessfulRecoveries: number;
  /** Total trades recovered */
  totalTradesRecovered: number;
  /** Average recovery success rate */
  averageSuccessRate: number;
  /** Average gap size recovered */
  averageGapSize: number;
  /** Recovery performance over time */
  performanceOverTime: GapRecoveryPerformancePoint[];
}

/**
 * Historical performance point
 */
export interface GapRecoveryPerformancePoint {
  /** Timestamp of measurement */
  timestamp: number;
  /** Success rate at this point */
  successRate: number;
  /** Average recovery speed (trades/second) */
  recoverySpeed: number;
  /** Active recovery count */
  activeRecoveries: number;
}

/**
 * Recovery circuit breaker state
 */
export interface RecoveryCircuitBreaker {
  /** Whether recovery is blocked */
  isOpen: boolean;
  /** Consecutive failure count */
  failureCount: number;
  /** Failure threshold before opening */
  failureThreshold: number;
  /** Time until next retry (ms) */
  nextRetryTime: number;
  /** Last time circuit was opened */
  lastOpenedAt: number;
}

/**
 * Gap recovery configuration
 */
export interface GapRecoveryConfiguration {
  /** Detection settings */
  detection: {
    enabled: boolean;
    minGapSize: number;
    maxGapSize: number;
    maxConcurrentDetections: number;
    detectionIntervalMinutes: number;
  };
  /** Recovery settings */
  recovery: {
    enabled: boolean;
    defaultStrategy: RecoveryStrategy;
    maxConcurrentRecoveries: number;
    maxGapsPerBatch: number;
    timeoutPerGapMs: number;
  };
  /** Rate limiting */
  rateLimiting: {
    maxRequestsPerMinute: number;
    pauseBetweenBatchesMs: number;
    backoffMultiplier: number;
  };
  /** Monitoring */
  monitoring: {
    enableMetrics: boolean;
    enableEvents: boolean;
    alertThresholds: {
      minSuccessRate: number;
      maxRecoveryTimeMs: number;
      maxFailureRate: number;
    };
  };
}

/**
 * Default production configuration
 */
export const DEFAULT_GAP_RECOVERY_CONFIG: GapRecoveryConfiguration = {
  detection: {
    enabled: true,
    minGapSize: 5,
    maxGapSize: 10000,
    maxConcurrentDetections: 10,
    detectionIntervalMinutes: 15,
  },
  recovery: {
    enabled: true,
    defaultStrategy: 'batch',
    maxConcurrentRecoveries: 5,
    maxGapsPerBatch: 50,
    timeoutPerGapMs: 30000, // 30 seconds
  },
  rateLimiting: {
    maxRequestsPerMinute: 60,
    pauseBetweenBatchesMs: 1000,
    backoffMultiplier: 2.0,
  },
  monitoring: {
    enableMetrics: true,
    enableEvents: true,
    alertThresholds: {
      minSuccessRate: 0.8,
      maxRecoveryTimeMs: 300000, // 5 minutes
      maxFailureRate: 0.5,
    },
  },
};
