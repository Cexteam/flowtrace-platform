/**
 * PriceBin Entity
 *
 * Represents a price level bin for footprint analysis.
 * Contains aggregated volume data at a specific price level.
 *
 */

/**
 * Aggs interface - matches existing production format
 * Ported from tradingAlgorithms/types.ts
 */
export interface Aggs {
  tp: number; // Tick price (binned price level)
  bv: number; // Buy volume
  sv: number; // Sell volume
  v: number; // Total volume
  bq?: number; // Buy quote volume
  sq?: number; // Sell quote volume
  q?: number; // Total quote volume
}

/**
 * PriceBin entity
 * Represents aggregated volume at a price level
 */
export class PriceBin {
  constructor(
    public readonly tickPrice: number,
    public buyVolume: number = 0,
    public sellVolume: number = 0,
    public buyQuoteVolume: number = 0,
    public sellQuoteVolume: number = 0
  ) {}

  /**
   * Get total volume at this price level
   */
  get totalVolume(): number {
    return this.buyVolume + this.sellVolume;
  }

  /**
   * Get total quote volume at this price level
   */
  get totalQuoteVolume(): number {
    return this.buyQuoteVolume + this.sellQuoteVolume;
  }

  /**
   * Get delta (buy - sell volume)
   */
  get delta(): number {
    return this.buyVolume - this.sellVolume;
  }

  /**
   * Add buy volume to this bin
   */
  addBuyVolume(quantity: number, quoteVolume: number): void {
    this.buyVolume += quantity;
    this.buyQuoteVolume += quoteVolume;
  }

  /**
   * Add sell volume to this bin
   */
  addSellVolume(quantity: number, quoteVolume: number): void {
    this.sellVolume += quantity;
    this.sellQuoteVolume += quoteVolume;
  }

  /**
   * Merge another PriceBin into this one
   */
  merge(other: PriceBin): void {
    if (this.tickPrice !== other.tickPrice) {
      throw new Error(
        `Cannot merge bins with different tick prices: ${this.tickPrice} vs ${other.tickPrice}`
      );
    }
    this.buyVolume += other.buyVolume;
    this.sellVolume += other.sellVolume;
    this.buyQuoteVolume += other.buyQuoteVolume;
    this.sellQuoteVolume += other.sellQuoteVolume;
  }

  /**
   * Clone this PriceBin
   */
  clone(): PriceBin {
    return new PriceBin(
      this.tickPrice,
      this.buyVolume,
      this.sellVolume,
      this.buyQuoteVolume,
      this.sellQuoteVolume
    );
  }

  /**
   * Convert to Aggs format (production format)
   */
  toAggs(): Aggs {
    return {
      tp: this.tickPrice,
      bv: this.buyVolume,
      sv: this.sellVolume,
      v: this.totalVolume,
      bq: this.buyQuoteVolume,
      sq: this.sellQuoteVolume,
      q: this.totalQuoteVolume,
    };
  }

  /**
   * Create PriceBin from Aggs format
   */
  static fromAggs(aggs: Aggs): PriceBin {
    return new PriceBin(aggs.tp, aggs.bv, aggs.sv, aggs.bq || 0, aggs.sq || 0);
  }

  /**
   * Create empty PriceBin at a price level
   */
  static empty(tickPrice: number): PriceBin {
    return new PriceBin(tickPrice, 0, 0, 0, 0);
  }
}

/**
 * Merge two arrays of Aggs (production format)
 * Used for timeframe rollup
 */
export function mergeAggsArrays(existing: Aggs[], incoming: Aggs[]): Aggs[] {
  const merged = [...existing];

  for (const newAgg of incoming) {
    const existingIndex = merged.findIndex((agg) => agg.tp === newAgg.tp);

    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      existing.v += newAgg.v;
      existing.bv += newAgg.bv;
      existing.sv += newAgg.sv;
      existing.bq = (existing.bq || 0) + (newAgg.bq || 0);
      existing.sq = (existing.sq || 0) + (newAgg.sq || 0);
      existing.q = (existing.bq || 0) + (existing.sq || 0);
    } else {
      merged.push({ ...newAgg });
    }
  }

  // Sort by price (production requirement)
  return merged.sort((a, b) => a.tp - b.tp);
}
