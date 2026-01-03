/**
 * FootprintCalculator Service
 *
 * Pure function service for footprint calculations.
 * Calculates price bins and volume aggregations.
 * Ported from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 */

import _ from 'lodash';
import { RawTrade } from '../value-objects/TradeData.js';
import { Aggs } from '../entities/PriceBin.js';

/**
 * CalAggsFootprint - Calculate footprint aggregations
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 * Uses lodash cloneDeep for input immutability
 * Uses lodash floor for tick price calculation
 * Uses lodash findIndex for finding existing bins
 * Uses parseFloat with toFixed for precision
 *
 * @param inputAggs - Existing price bins
 * @param inputTrades - Raw trade data (Binance format)
 * @param tickValue - Tick size for binning
 * @returns New array of price bins with trade applied
 *
 */
export function CalAggsFootprint(
  inputAggs: Aggs[],
  inputTrades: RawTrade,
  tickValue: number
): Aggs[] {
  const aggs = _.cloneDeep(inputAggs);
  const trades = _.cloneDeep(inputTrades);
  const aggsRR: Aggs[] = JSON.parse(JSON.stringify(aggs));
  const tv = tickValue * 10000000;
  const tp =
    _.floor(
      _.floor(Number(trades.p) * 10000000 - 1) -
        (_.floor(Number(trades.p) * 10000000 - 1) % tv),
      0
    ) / 10000000;
  const indexTp = _.findIndex(aggsRR, function (o) {
    return o.tp == tp;
  });
  if (indexTp >= 0) {
    aggsRR[indexTp].v = parseFloat(
      (aggsRR[indexTp].v + Number(trades.q)).toFixed(8)
    );
    aggsRR[indexTp].bv =
      trades.m == false
        ? parseFloat((aggsRR[indexTp].bv + Number(trades.q)).toFixed(8))
        : aggsRR[indexTp].bv;
    aggsRR[indexTp].sv =
      trades.m == true
        ? parseFloat((aggsRR[indexTp].sv + Number(trades.q)).toFixed(8))
        : aggsRR[indexTp].sv;
    if (aggsRR[indexTp].bq !== undefined) {
      aggsRR[indexTp].bq =
        trades.m == false
          ? parseFloat(
              (
                aggsRR[indexTp].bq! +
                Number(trades.q) * Number(trades.p)
              ).toFixed(5)
            )
          : aggsRR[indexTp].bq;
      aggsRR[indexTp].sq =
        trades.m == true
          ? parseFloat(
              (
                aggsRR[indexTp].sq! +
                Number(trades.q) * Number(trades.p)
              ).toFixed(5)
            )
          : aggsRR[indexTp].sq;
    }
  } else {
    const obj: Aggs = {
      tp: tp,
      v: Number(trades.q),
      bv: trades.m == false ? Number(trades.q) : 0,
      sv: trades.m == true ? Number(trades.q) : 0,
      bq: trades.m == false ? Number(trades.q) * Number(trades.p) : 0,
      sq: trades.m == true ? Number(trades.q) * Number(trades.p) : 0,
    };
    aggsRR.push(obj);
  }
  return aggsRR;
}

/**
 * Cal2AggsFootprint / mergeAggs - Merge two arrays of price bins
 * Ported exactly from cm_sync_candle/src/exchange_crypto/utils/conf_candle.ts
 *
 * Uses JSON.parse(JSON.stringify()) for initial copy
 * Uses lodash findIndex for finding matching tp values
 * Uses parseFloat with toFixed for precision
 *
 * @param aggSymbol - Source bins to merge (from 1s candle)
 * @param aggsSymbolOfAll - Target bins (from higher timeframe candle)
 * @returns New merged array
 *
 */
export function mergeAggs(aggSymbol: Aggs[], aggsSymbolOfAll: Aggs[]): Aggs[] {
  const aggsRR = JSON.parse(JSON.stringify(aggsSymbolOfAll));
  const aggR = JSON.parse(JSON.stringify(aggSymbol));
  for (let i = 0; i < aggSymbol.length; i++) {
    const indexTp = _.findIndex(aggsRR, function (o: Aggs) {
      return o.tp == aggR[i].tp;
    });
    if (indexTp == -1) {
      aggsRR.push(aggR[i]);
    } else if (indexTp >= 0) {
      aggsRR[indexTp].bv = parseFloat(
        (aggsRR[indexTp].bv + aggR[i].bv).toFixed(8)
      );
      aggsRR[indexTp].sv = parseFloat(
        (aggsRR[indexTp].sv + aggR[i].sv).toFixed(8)
      );
      if (aggsRR[indexTp].sq !== undefined && aggR[i].sq !== undefined) {
        aggsRR[indexTp].sq = parseFloat(
          (aggsRR[indexTp].sq + aggR[i].sq).toFixed(5)
        );
        aggsRR[indexTp].bq = parseFloat(
          (aggsRR[indexTp].bq + aggR[i].bq).toFixed(5)
        );
      }
      aggsRR[indexTp].v = parseFloat(
        (aggsRR[indexTp].v + aggR[i].v).toFixed(8)
      );
    }
  }
  return aggsRR;
}
