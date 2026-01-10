/**
 * BinSizeCalculator Service
 *
 * Calculates optimal bin sizes for footprint charts using "nice" numbers.
 * Nice bin sizes follow the pattern [1, 2, 2.5, 4, 5] × 10^n
 * Examples: 0.001, 0.002, 0.0025, 0.004, 0.005, 0.01, 0.02, 0.025, 0.04, 0.05, 0.1, 0.2, 0.25...
 *
 * This ensures footprint charts display clean, readable price levels.
 *
 * Price-based tier classification:
 * - Major (price >= $1000): BTC, ETH - stable, high liquidity
 * - Liquid Alt (price >= $1): SOL, BNB - moderate volatility
 * - Meme Coin (price < $1): meme coins, micro-cap - high volatility
 */

/**
 * Maximum number of bins per candle before warning is logged
 * Beyond this threshold, performance may degrade
 */
export const MAX_BINS_PER_CANDLE = 200;

/**
 * Symbol tier classification based on price
 * Used to determine appropriate targetBinPercentage
 */
export type SymbolTier = 'ultra' | 'major' | 'liquidAlt' | 'memeCoin';

/**
 * Price thresholds for tier classification
 * Based on observation: high-price symbols tend to be more stable
 */
export const TIER_PRICE_THRESHOLDS = {
  ultra: 50000, // Price >= $50,000 (BTC only)
  major: 1000, // Price >= $1,000 (ETH, BNB, etc.)
  liquidAlt: 1, // Price >= $1 (SOL, LINK, etc.)
  // memeCoin: < $1 (meme coins, micro-cap)
} as const;

/**
 * Configuration for each symbol tier
 */
export interface TierConfig {
  /** Target bin size as percentage of price */
  targetBinPercentage: number;
  /** Description of the tier */
  description: string;
}

/**
 * Tier-specific configurations
 * Higher volatility symbols get larger targetBinPercentage
 */
export const TIER_CONFIGS: Record<SymbolTier, TierConfig> = {
  ultra: {
    targetBinPercentage: 0.0001, // 0.01% = 1 basis point → BTC $100k = EBS $10
    description: 'BTC - ultra high price, needs detailed chart',
  },
  major: {
    targetBinPercentage: 0.0003, // 0.03% = 3 basis points → ETH $3k = EBS $1
    description: 'ETH/BNB - high price, stable',
  },
  liquidAlt: {
    targetBinPercentage: 0.001, // 0.1% = 10 basis points → SOL $150 = EBS $0.15
    description: 'Liquid alts - moderate volatility',
  },
  memeCoin: {
    targetBinPercentage: 0.005, // 0.5% = 50 basis points → DOGE $0.15 = EBS $0.00075
    description: 'Meme coins - high volatility',
  },
};

/**
 * Constraints for bin size calculation
 */
export const BIN_CONSTRAINTS = {
  /** Hard safety limit for number of bins */
  maxBins: 200,
  /** Worst case price move percentage for MAX_BINS calculation */
  worstCaseMovePercent: 0.02, // 2% - allows BTC to have EBS = $10
} as const;

/**
 * Classify symbol tier based on current price
 *
 * Logic:
 * - Price >= $50,000: ultra (BTC ~$100k)
 * - Price >= $1,000: major (ETH ~$3k, BNB ~$600)
 * - Price >= $1: liquidAlt (SOL ~$150, LINK ~$15)
 * - Price < $1: memeCoin (DOGE ~$0.15, meme coins)
 *
 * This heuristic works because:
 * - Ultra-high price symbols (BTC) need smallest EBS for detailed charts
 * - High-price symbols are typically established, less volatile
 * - Low-price symbols are typically newer, more volatile
 * - No need to maintain symbol lists for 500+ symbols
 *
 * @param price - Current market price
 * @returns Symbol tier classification
 */
export function getSymbolTier(price: number): SymbolTier {
  if (price >= TIER_PRICE_THRESHOLDS.ultra) return 'ultra';
  if (price >= TIER_PRICE_THRESHOLDS.major) return 'major';
  if (price >= TIER_PRICE_THRESHOLDS.liquidAlt) return 'liquidAlt';
  return 'memeCoin';
}

/**
 * Get configuration for a symbol tier
 *
 * @param tier - Symbol tier
 * @returns Tier configuration with targetBinPercentage
 */
export function getTierConfig(tier: SymbolTier): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Calculate minimum bin size to stay within MAX_BINS for worst-case move
 *
 * Formula: (price × worstCaseMovePercent) / maxBins
 * Example: (60000 × 0.05) / 200 = 15
 *
 * @param price - Current market price
 * @returns Minimum bin size to guarantee MAX_BINS constraint
 */
export function calculateMinBinSizeForMaxBins(price: number): number {
  const worstCaseRange = price * BIN_CONSTRAINTS.worstCaseMovePercent;
  return worstCaseRange / BIN_CONSTRAINTS.maxBins;
}

/**
 * Base factors for nice bin sizes: [1, 2, 2.5, 4, 5]
 * Combined with powers of 10 to generate all nice bin sizes
 */
export const NICE_BASE_FACTORS = [1, 2, 2.5, 4, 5] as const;

/**
 * Nice multipliers for fallback when nice bin size is not divisible by tickValue
 */
export const NICE_MULTIPLIERS = [1, 2, 4, 5, 10, 20, 25, 40, 50, 100] as const;

/**
 * Configuration for dynamic bin size calculation
 */
export interface BinSizeConfig {
  /** Target bin size as percentage of price (default: 0.00005 = 0.005% = 5 basis points) */
  targetBinPercentage: number;
  /** Minimum bin size (default: 0.00001) */
  minBinSize: number;
  /** Maximum bin size (default: 1000) */
  maxBinSize: number;
}

export const DEFAULT_BIN_SIZE_CONFIG: BinSizeConfig = {
  targetBinPercentage: 0.00005, // 0.005% = 5 basis points
  minBinSize: 0.00001,
  maxBinSize: 1000,
};

/**
 * Result of optimal bin size calculation
 */
export interface OptimalBinSizeResult {
  /** The nice bin size (e.g., 5.0, 2.5, 0.25) */
  niceBinSize: number;
  /** The multiplier to apply to tickValue (niceBinSize / tickValue) */
  binMultiplier: number;
  /** Symbol tier used for calculation */
  tier: SymbolTier;
  /** Whether MAX_BINS constraint forced larger bin size */
  maxBinsEnforced: boolean;
}

// Pre-generated nice bin sizes for efficient lookup
let cachedNiceBinSizes: number[] | null = null;

/**
 * Generate all nice bin sizes within a practical range
 * Pattern: [1, 2, 2.5, 4, 5] × 10^n for n from -8 to 4
 *
 * @returns Sorted array of nice bin sizes
 */
export function generateNiceBinSizes(): number[] {
  if (cachedNiceBinSizes) {
    return cachedNiceBinSizes;
  }

  const niceBinSizes: number[] = [];

  // Generate for powers from 10^-8 to 10^4
  for (let power = -8; power <= 4; power++) {
    const multiplier = Math.pow(10, power);
    for (const factor of NICE_BASE_FACTORS) {
      const value = factor * multiplier;
      // Round to avoid floating point errors
      const rounded = Number(value.toPrecision(10));
      niceBinSizes.push(rounded);
    }
  }

  // Sort ascending
  niceBinSizes.sort((a, b) => a - b);

  cachedNiceBinSizes = niceBinSizes;
  return niceBinSizes;
}

/**
 * Snap a target value to the nearest nice bin size
 * Uses logarithmic distance for better distribution across scales
 *
 * @param targetBinSize - Raw calculated bin size
 * @returns Nearest nice bin size from the pattern [1, 2, 2.5, 4, 5] × 10^n
 *
 * @example
 * snapToNiceBinSize(0.00175) // returns 0.002
 * snapToNiceBinSize(0.175)   // returns 0.2
 * snapToNiceBinSize(2.4)     // returns 2.5
 * snapToNiceBinSize(3.0)     // returns 2.5 (nearest)
 */
export function snapToNiceBinSize(targetBinSize: number): number {
  if (targetBinSize <= 0) {
    return generateNiceBinSizes()[0]; // Return smallest nice bin size
  }

  const niceBinSizes = generateNiceBinSizes();

  // Use logarithmic distance for better distribution
  const logTarget = Math.log10(targetBinSize);

  let nearestBinSize = niceBinSizes[0];
  let minDistance = Math.abs(Math.log10(nearestBinSize) - logTarget);

  for (const binSize of niceBinSizes) {
    const distance = Math.abs(Math.log10(binSize) - logTarget);
    if (distance < minDistance) {
      minDistance = distance;
      nearestBinSize = binSize;
    }
  }

  return nearestBinSize;
}

/**
 * Check if a value is divisible by another within floating point tolerance
 *
 * @param dividend - The number to be divided
 * @param divisor - The number to divide by
 * @returns true if dividend is divisible by divisor
 */
function isDivisibleBy(dividend: number, divisor: number): boolean {
  if (divisor === 0) return false;
  const quotient = dividend / divisor;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

/**
 * Find the smallest nice bin size that is >= target AND divisible by tickValue
 *
 * @param targetBinSize - Minimum desired bin size
 * @param tickValue - Exchange tick size (must divide evenly into result)
 * @returns Nice bin size that satisfies both constraints
 *
 * @example
 * // tickValue = 0.001, target = 0.00175
 * // 0.002 is nice AND 0.002 / 0.001 = 2 (integer) ✅
 * findNiceBinSizeDivisibleBy(0.00175, 0.001) // returns 0.002
 */
export function findNiceBinSizeDivisibleBy(
  targetBinSize: number,
  tickValue: number
): number | null {
  const niceBinSizes = generateNiceBinSizes();

  // First, try to find a nice bin size >= target that is divisible by tickValue
  for (const binSize of niceBinSizes) {
    if (binSize >= targetBinSize && isDivisibleBy(binSize, tickValue)) {
      return binSize;
    }
  }

  // If no nice bin size found, return null (caller should use fallback)
  return null;
}

/**
 * Find the nearest nice multiplier to a raw value
 *
 * @param rawMultiplier - Raw calculated multiplier
 * @returns Nearest value from NICE_MULTIPLIERS
 */
function findNearestNiceMultiplier(rawMultiplier: number): number {
  let nearest: number = NICE_MULTIPLIERS[0];
  let minDistance = Math.abs(rawMultiplier - nearest);

  for (const multiplier of NICE_MULTIPLIERS) {
    const distance = Math.abs(rawMultiplier - multiplier);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = multiplier;
    }
  }

  return nearest;
}

/**
 * Calculate optimal bin size based on current price and price-based tier
 * Returns a nice bin size that is divisible by tickValue
 *
 * Algorithm:
 * 1. Get symbol tier based on price (major/liquidAlt/memeCoin)
 * 2. Get targetBinPercentage from tier config
 * 3. Calculate target bin size: price × targetBinPercentage
 * 4. Apply MAX_BINS constraint: ensure binSize >= minBinSizeForMaxBins
 * 5. Snap to nice number divisible by tickValue
 * 6. bin_multiplier = nice_bin_size / tickValue
 *
 * @param currentPrice - Current market price (also used for tier classification)
 * @param tickValue - Exchange tick size (minimum price increment)
 * @param config - Configuration for calculation (optional, uses tier-based defaults)
 * @returns { niceBinSize, binMultiplier, tier, maxBinsEnforced }
 */
export function calculateOptimalBinSize(
  currentPrice: number,
  tickValue: number,
  config?: BinSizeConfig
): OptimalBinSizeResult {
  // Handle edge cases
  if (!currentPrice || currentPrice <= 0 || !tickValue || tickValue <= 0) {
    return {
      niceBinSize: tickValue || 0.00001,
      binMultiplier: 1,
      tier: 'memeCoin',
      maxBinsEnforced: false,
    };
  }

  // Step 1: Get tier based on price (no symbol list needed)
  const tier = getSymbolTier(currentPrice);
  const tierConfig = getTierConfig(tier);

  // Step 2: Calculate target bin size from tier (or use provided config)
  const targetBinPercentage =
    config?.targetBinPercentage ?? tierConfig.targetBinPercentage;
  const targetBinSize = currentPrice * targetBinPercentage;

  // Step 3: Apply MAX_BINS constraint
  const minBinSizeForMaxBins = calculateMinBinSizeForMaxBins(currentPrice);
  const maxBinsEnforced = targetBinSize < minBinSizeForMaxBins;
  const constrainedBinSize = Math.max(targetBinSize, minBinSizeForMaxBins);

  // Step 4: Try to find a nice bin size that is divisible by tickValue
  const niceBinSize = findNiceBinSizeDivisibleBy(constrainedBinSize, tickValue);

  if (niceBinSize !== null) {
    // Found a nice bin size that is divisible by tickValue
    const binMultiplier = Math.round(niceBinSize / tickValue);
    return {
      niceBinSize,
      binMultiplier,
      tier,
      maxBinsEnforced,
    };
  }

  // Step 5: Fallback - use multiplier approach
  // This handles edge cases where tickValue doesn't align with nice bin sizes
  // (e.g., tickValue = 0.003)
  const rawMultiplier = constrainedBinSize / tickValue;
  const niceMultiplier = findNearestNiceMultiplier(rawMultiplier);

  // Clamp multiplier to reasonable range
  const clampedMultiplier = Math.max(1, Math.min(100, niceMultiplier));

  return {
    niceBinSize: tickValue * clampedMultiplier,
    binMultiplier: clampedMultiplier,
    tier,
    maxBinsEnforced,
  };
}

/**
 * Calculate effective bin size from stored multiplier
 * Returns tickValue × binMultiplier, or auto-calculated if binMultiplier is null/0
 *
 * @param tickValue - Exchange tick size
 * @param binMultiplier - User-configured multiplier (null/0 = auto)
 * @param currentPrice - Current price (required if binMultiplier is null/0)
 * @returns Effective bin size for footprint calculation
 */
export function calculateEffectiveBinSize(
  tickValue: number,
  binMultiplier: number | null | undefined,
  currentPrice?: number
): number {
  // If binMultiplier is explicitly set and valid, use it
  if (binMultiplier && binMultiplier > 0) {
    return tickValue * binMultiplier;
  }

  // Auto-calculate if binMultiplier is null, undefined, or 0
  if (currentPrice && currentPrice > 0) {
    const result = calculateOptimalBinSize(currentPrice, tickValue);
    return result.niceBinSize;
  }

  // Fallback: use tickValue directly (binMultiplier = 1)
  return tickValue;
}

/**
 * Determine if bin size should be recalculated based on price change
 * Returns true if price change would result in different nice bin size
 *
 * @param oldPrice - Previous price
 * @param newPrice - Current price
 * @param tickValue - Exchange tick size
 * @param config - Configuration for calculation
 * @returns true if recalculation is needed
 */
export function shouldRecalculateBinSize(
  oldPrice: number,
  newPrice: number,
  tickValue: number,
  config: BinSizeConfig = DEFAULT_BIN_SIZE_CONFIG
): boolean {
  if (!oldPrice || oldPrice <= 0 || !newPrice || newPrice <= 0) {
    return true;
  }

  const oldResult = calculateOptimalBinSize(oldPrice, tickValue, config);
  const newResult = calculateOptimalBinSize(newPrice, tickValue, config);

  return oldResult.binMultiplier !== newResult.binMultiplier;
}

/**
 * Validate that a bin size is "nice" (matches pattern [1, 2, 2.5, 4, 5] × 10^n)
 *
 * @param binSize - Bin size to validate
 * @returns true if binSize is a nice number
 */
export function isNiceBinSize(binSize: number): boolean {
  if (binSize <= 0) return false;

  const niceBinSizes = generateNiceBinSizes();

  // Check if binSize matches any nice bin size (with floating point tolerance)
  for (const nice of niceBinSizes) {
    if (Math.abs(binSize - nice) / nice < 1e-9) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that effective bin size (tickValue × binMultiplier) is a nice number
 *
 * @param tickValue - Exchange tick size
 * @param binMultiplier - Multiplier to validate
 * @returns true if the resulting effective bin size is nice
 */
export function isValidBinMultiplier(
  tickValue: number,
  binMultiplier: number
): boolean {
  if (!binMultiplier || binMultiplier <= 0) return false;
  if (!Number.isInteger(binMultiplier)) return false;

  const effectiveBinSize = tickValue * binMultiplier;
  return isNiceBinSize(effectiveBinSize);
}

/**
 * Check if the number of bins exceeds MAX_BINS_PER_CANDLE threshold
 * Returns a warning message if exceeded, null otherwise
 *
 * @param binsCount - Current number of bins in the candle
 * @param symbol - Symbol name for logging context
 * @returns Warning message if threshold exceeded, null otherwise
 */
export function checkMaxBinsWarning(
  binsCount: number,
  symbol?: string
): string | null {
  if (binsCount > MAX_BINS_PER_CANDLE) {
    const symbolInfo = symbol ? ` for ${symbol}` : '';
    return `Bins count (${binsCount}) exceeds MAX_BINS_PER_CANDLE (${MAX_BINS_PER_CANDLE})${symbolInfo}. Consider increasing bin size.`;
  }
  return null;
}

/**
 * Rate limit for MAX_BINS warnings (1 minute)
 */
const LOG_RATE_LIMIT_MS = 60000;

/**
 * Track last log time per symbol for rate limiting
 */
const lastLogTimePerSymbol = new Map<string, number>();

/**
 * Check if the number of bins exceeds MAX_BINS_PER_CANDLE threshold (rate-limited)
 * Returns a warning message if exceeded and not rate-limited, null otherwise
 *
 * Rate limiting: Only logs once per minute per symbol to prevent log spam
 * for symbols with persistent bin overflow issues.
 *
 * @param binsCount - Current number of bins in the candle
 * @param symbol - Symbol name for rate limiting and logging context
 * @returns Warning message if exceeded and not rate-limited, null otherwise
 */
export function checkMaxBinsWarningRateLimited(
  binsCount: number,
  symbol: string
): string | null {
  if (binsCount <= MAX_BINS_PER_CANDLE) {
    return null;
  }

  const now = Date.now();
  const lastLogTime = lastLogTimePerSymbol.get(symbol) || 0;

  if (now - lastLogTime < LOG_RATE_LIMIT_MS) {
    return null; // Rate limited - skip logging
  }

  lastLogTimePerSymbol.set(symbol, now);
  return `Bins count (${binsCount}) exceeds MAX_BINS_PER_CANDLE (${MAX_BINS_PER_CANDLE}) for ${symbol}. Consider increasing bin size.`;
}
