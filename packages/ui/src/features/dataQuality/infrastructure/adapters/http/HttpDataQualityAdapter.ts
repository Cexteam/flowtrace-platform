/**
 * HttpDataQualityAdapter - HTTP implementation of DataQualityApiPort
 *
 * Implements DataQualityApiPort for Cloud deployment using REST API calls.
 *
 */

import { injectable, inject } from 'inversify';
import { UI_CORE_TYPES } from '../../../../../shared/lib/di/core/types';
import type { DataQualityApiPort } from '../../../application/ports/out/DataQualityApiPort';
import type {
  CheckTradeGapsRequest,
  CheckTradeGapsResponse,
  TradeGap,
} from '../../../domain/types';

/**
 * HTTP adapter for data quality API operations
 *
 * Makes REST API calls to the backend server for data quality checks.
 */
@injectable()
export class HttpDataQualityAdapter implements DataQualityApiPort {
  private readonly baseUrl: string;

  constructor(@inject(UI_CORE_TYPES.ApiBaseUrl) apiBaseUrl: string) {
    this.baseUrl = apiBaseUrl;
  }

  /**
   * Check for trade data gaps via REST API
   */
  async checkTradeGaps(
    request: CheckTradeGapsRequest
  ): Promise<CheckTradeGapsResponse> {
    const params = new URLSearchParams();
    params.append('symbol', request.symbol);
    params.append('exchange', request.exchange);
    params.append('from', request.fromTime.toString());
    params.append('to', request.toTime.toString());

    const url = `${this.baseUrl}/data-quality/gaps?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to check trade gaps: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapResponseFromApi(data, request);
  }

  /**
   * Map API response to CheckTradeGapsResponse domain type
   */
  private mapResponseFromApi(
    data: Record<string, unknown>,
    request: CheckTradeGapsRequest
  ): CheckTradeGapsResponse {
    const gaps = ((data.gaps as Array<Record<string, unknown>>) || []).map(
      (gap): TradeGap => ({
        from: gap.from as number,
        to: gap.to as number,
        duration: gap.duration as number,
      })
    );

    const totalMissingDuration = gaps.reduce(
      (sum, gap) => sum + gap.duration,
      0
    );
    const totalTimeRange = request.toTime - request.fromTime;
    const dataCompleteness =
      totalTimeRange > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((totalTimeRange - totalMissingDuration) / totalTimeRange) * 100
            )
          )
        : 100;

    return {
      gaps,
      totalGaps: (data.totalGaps as number) ?? gaps.length,
      totalMissingDuration:
        (data.totalMissingDuration as number) ?? totalMissingDuration,
      dataCompleteness: (data.dataCompleteness as number) ?? dataCompleteness,
      symbol: request.symbol,
      exchange: request.exchange,
      fromTime: request.fromTime,
      toTime: request.toTime,
      checkedAt: new Date(),
    };
  }
}
