/**
 * BinSizeCalculatorAdapter - Infrastructure adapter for bin size calculation
 *
 * Implements BinSizeCalculatorPort by wrapping domain service functions.
 * This adapter allows Use Cases to calculate bin sizes without importing
 * domain functions directly.
 *
 * Hexagonal Architecture:
 * - Implements Port Out (BinSizeCalculatorPort)
 * - Wraps domain service (BinSizeCalculator)
 */

import { injectable } from 'inversify';
import type {
  BinSizeCalculatorPort,
  OptimalBinSizeResult,
} from '../../application/ports/out/BinSizeCalculatorPort.js';
import {
  calculateOptimalBinSize as domainCalculateOptimalBinSize,
  shouldRecalculateBinSize as domainShouldRecalculateBinSize,
  calculateEffectiveBinSize as domainCalculateEffectiveBinSize,
} from '../../domain/services/BinSizeCalculator.js';

/**
 * BinSizeCalculatorAdapter
 *
 * Infrastructure adapter that implements BinSizeCalculatorPort.
 * Delegates to domain service functions for actual calculation.
 */
@injectable()
export class BinSizeCalculatorAdapter implements BinSizeCalculatorPort {
  /**
   * Calculate optimal bin size for a symbol based on current price
   *
   * @param currentPrice - Current market price of the symbol
   * @param tickValue - Exchange tick size (minimum price increment)
   * @returns { niceBinSize, binMultiplier }
   */
  calculateOptimalBinSize(
    currentPrice: number,
    tickValue: number
  ): OptimalBinSizeResult {
    return domainCalculateOptimalBinSize(currentPrice, tickValue);
  }

  /**
   * Determine if bin size should be recalculated based on price change
   *
   * @param oldPrice - Previous price
   * @param newPrice - Current price
   * @param tickValue - Exchange tick size
   * @returns true if recalculation is needed
   */
  shouldRecalculateBinSize(
    oldPrice: number,
    newPrice: number,
    tickValue: number
  ): boolean {
    return domainShouldRecalculateBinSize(oldPrice, newPrice, tickValue);
  }

  /**
   * Calculate effective bin size from stored multiplier
   *
   * @param tickValue - Exchange tick size
   * @param binMultiplier - User-configured multiplier (null/0 = auto)
   * @param currentPrice - Current price (required if binMultiplier is null/0)
   * @returns Effective bin size for footprint calculation
   */
  calculateEffectiveBinSize(
    tickValue: number,
    binMultiplier: number | null | undefined,
    currentPrice?: number
  ): number {
    return domainCalculateEffectiveBinSize(
      tickValue,
      binMultiplier,
      currentPrice
    );
  }
}
