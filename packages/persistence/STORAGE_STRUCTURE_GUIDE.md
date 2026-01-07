# Hướng dẫn Cấu trúc Lưu trữ Candlestick Footprint

## Tổng quan

API đã được cập nhật để lưu trữ dữ liệu candlestick footprint theo cấu trúc phân cấp dựa trên timeframe. Mỗi timeframe sẽ có chiến lược lưu trữ riêng để tối ưu hóa hiệu suất và quản lý dữ liệu.

## Cấu trúc Thư mục

```
data/
      
     └── BINANCE  # EXCHANGE
          └── BTCUSDT/  # SYMBOL
              └── candles/
                  ├──1m_temporary/
                  │   ├── 1764979200000.bin
                      ├── ...
                  ├── 1m/                     # NGÀY (Daily)
                  │   ├── 2025-12-08.bin
                  │   ├── 2025-12-08.idx
                  │   ├── 2025-12-09.bin
                  │   ├── 2025-12-09.idx
                  │   └── metadata.json
                  │
                  ├──3m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 3m/                     # NGÀY (Daily)
                  │   ├── 2025-12-08.bin
                  │   ├── 2025-12-08.idx
                  │   └── metadata.json
                  │
                  ├── 5m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 5m/                     # TUẦN (Weekly)
                  │   ├── 2025-W49.bin
                  │   ├── 2025-W49.idx
                  │   ├── 2025-W50.bin
                  │   ├── 2025-W50.idx
                  │   └── metadata.json
                  │
                  ├── 15m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 15m/                    # TUẦN (Weekly)
                  │   ├── 2025-W49.bin
                  │   ├── 2025-W49.idx
                  │   └── metadata.json
                  │
                  ├── 30m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 30m/                    # THÁNG (Monthly)
                  │   ├── 2025-11.bin
                  │   ├── 2025-11.idx
                  │   ├── 2025-12.bin
                  │   ├── 2025-12.idx
                  │   └── metadata.json
                  │
                  ├── 1h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 1h/                     # THÁNG (Monthly)
                  │   ├── 2025-11.bin
                  │   ├── 2025-11.idx
                  │   └── metadata.json
                  │
                  ├── 2h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 2h/                     # QUÝ (Quarterly)
                  │   ├── 2025-Q3.bin
                  │   ├── 2025-Q3.idx
                  │   ├── 2025-Q4.bin
                  │   ├── 2025-Q4.idx
                  │   └── metadata.json
                  │
                  ├── 4h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 4h/                     # QUÝ (Quarterly)
                  │   ├── 2025-Q3.bin
                  │   ├── 2025-Q3.idx
                  │   └── metadata.json
                  │
                  ├── 8h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 8h/                     # NĂM (Yearly)
                  │   ├── 2024.bin
                  │   ├── 2024.idx
                  │   ├── 2025.bin
                  │   ├── 2025.idx
                  │   └── metadata.json
                  │
                  ├── 12h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 12h/                    # NĂM (Yearly)
                  │   ├── 2024.bin
                  │   ├── 2024.idx
                  │   └── metadata.json
                  │
                  ├── 1d_temporary/
                  │   ├── 1764979200000.bin
                  └── 1d/                     # NĂM (Yearly)
                      ├── 2024.bin
                      ├── 2024.idx
                      ├── 2025.bin
                      ├── 2025.idx
                      └── metadata.json
              └── footprints/
                  ├──1m_temporary/
                  │   ├── 1764979200000.bin
                      ├── ...
                  ├── 1m/                     # NGÀY (Daily)
                  │   ├── 2025-12-08.bin
                  │   ├── 2025-12-08.idx
                  │   ├── 2025-12-09.bin
                  │   ├── 2025-12-09.idx
                  │   └── metadata.json
                  │
                  ├── 3m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 3m/                     # NGÀY (Daily)
                  │   ├── 2025-12-08.bin
                  │   ├── 2025-12-08.idx
                  │   └── metadata.json
                  │
                  ├── 5m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 5m/                     # TUẦN (Weekly)
                  │   ├── 2025-W49.bin
                  │   ├── 2025-W49.idx
                  │   ├── 2025-W50.bin
                  │   ├── 2025-W50.idx
                  │   └── metadata.json
                  │
                  ├── 15m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 15m/                    # TUẦN (Weekly)
                  │   ├── 2025-W49.bin
                  │   ├── 2025-W49.idx
                  │   └── metadata.json
                  │
                  ├── 30m_temporary/
                  │   ├── 1764979200000.bin
                  ├── 30m/                    # THÁNG (Monthly)
                  │   ├── 2025-11.bin
                  │   ├── 2025-11.idx
                  │   ├── 2025-12.bin
                  │   ├── 2025-12.idx
                  │   └── metadata.json
                  │
                  ├── 1h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 1h/                     # THÁNG (Monthly)
                  │   ├── 2025-11.bin
                  │   ├── 2025-11.idx
                  │   └── metadata.json
                  │
                  ├── 2h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 2h/                     # QUÝ (Quarterly)
                  │   ├── 2025-Q3.bin
                  │   ├── 2025-Q3.idx
                  │   ├── 2025-Q4.bin
                  │   ├── 2025-Q4.idx
                  │   └── metadata.json
                  │
                  ├── 4h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 4h/                     # QUÝ (Quarterly)
                  │   ├── 2025-Q3.bin
                  │   ├── 2025-Q3.idx
                  │   └── metadata.json
                  │
                  ├── 8h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 8h/                     # NĂM (Yearly)
                  │   ├── 2024.bin
                  │   ├── 2024.idx
                  │   ├── 2025.bin
                  │   ├── 2025.idx
                  │   └── metadata.json
                  │
                  ├── 12h_temporary/
                  │   ├── 1764979200000.bin
                  ├── 12h/                    # NĂM (Yearly)
                  │   ├── 2024.bin
                  │   ├── 2024.idx
                  │   └── metadata.json
                  │
                  ├── 1d_temporary/
                  │   ├── 1764979200000.bin
                  └── 1d/                     # NĂM (Yearly)
                      ├── 2024.bin
                      ├── 2024.idx
                      ├── 2025.bin
                      ├── 2025.idx
                      └── metadata.json
          └── ETHUSDT/
```

## Chiến lược Lưu trữ theo Timeframe

| Timeframe | Pattern | Format File | Ví dụ |
|-----------|---------|-------------|-------|
| 1m, 3m | Daily | YYYY-MM-DD | 2025-12-08.bin |
| 5m, 15m | Weekly | YYYY-Www | 2025-W49.bin |
| 30m, 1h | Monthly | YYYY-MM | 2025-12.bin |
| 2h, 4h | Quarterly | YYYY-Qq | 2025-Q4.bin |
| 8h, 12h, 1d | Yearly | YYYY | 2025.bin |

## Cấu trúc File

### 1. Binary File (.bin)
- Chứa dữ liệu candlestick được serialize bằng FlatBuffers
- Bao gồm OHLCV data và footprint aggregations
- Tối ưu cho việc đọc/ghi nhanh

### 2. Index File (.idx)
Chứa metadata về file binary:
```json
{
  "period": "2025-12-08",
  "pattern": "day",
  "count": 1440,
  "firstTimestamp": 1733616000000,
  "lastTimestamp": 1733702340000,
  "symbol": "BTCUSDT",
  "interval": "1m"
}
```

### 3. Metadata File (metadata.json)
Chứa thông tin tổng quan về thư mục:
```json
{
  "version": "1.0",
  "schema": "candlestick_footprint",
  "symbol": "BTCUSDT",
  "interval": "1m",
  "pattern": "day",
  "exchange": "binance",
  "lastUpdated": "2025-12-09T10:30:00.000Z",
  "totalPeriods": 30,
  "periodRange": {
    "from": "2025-11-09",
    "to": "2025-12-08"
  }
}
```

## API Endpoints

### 1. Insert History Candle Footprint
**Endpoint:** `GET /flatbuffer/inserthistorycandlefootprint-batch-day`

**Parameters:**
- `exchange`: Exchange name (e.g., "binance")
- `asset`: Asset type (e.g., "crypto")
- `type`: Type (e.g., "spot")
- `symbol`: Trading pair (e.g., "BTCUSDT")
- `resolution`: Timeframe (e.g., "1m", "5m", "1h")
- `from`: Start timestamp (milliseconds)
- `to`: End timestamp (milliseconds)
- `countback`: Number of iterations (default: 1)

**Response:**
```json
{
  "s": "ok",
  "symbol": "BTCUSDT",
  "resolution": "1m",
  "pattern": "day",
  "totalCandles": 1440,
  "periodsCount": 1,
  "savedFiles": ["data/BTCUSDT/candlestick_footprint/1m/2025-12-08.bin"],
  "basePath": "data/BTCUSDT/candlestick_footprint/1m",
  "success": true,
  "message": "Saved 1440 candles across 1 day periods"
}
```

### 2. Get Batch Day Candles
**Endpoint:** `GET /flatbuffer/batch-day/candles`

**Parameters:**
- `symbol`: Trading pair (e.g., "BTCUSDT")
- `interval`: Timeframe (e.g., "1m", "5m", "1h")
- `from`: Start timestamp (milliseconds)
- `to`: End timestamp (milliseconds)
- `limit`: Maximum number of candles (default: 10000)

**Response:**
```json
{
  "s": "ok",
  "symbol": "BTCUSDT",
  "interval": "1m",
  "pattern": "day",
  "from": 1733616000000,
  "to": 1733702340000,
  "filesRead": 1,
  "count": 1440,
  "data": [...],
  "timing": {
    "serverStartTimestamp": 1733816000000,
    "serverEndTimestamp": 1733816123000,
    "serverProcessingTimeMs": 123
  },
  "performance": {
    "totalTimeMs": 123,
    "checkDirMs": 2,
    "readDirMs": 5,
    "filterFilesMs": 1,
    "loadFilesMs": 100,
    "filterCandlesMs": 10,
    "pushCandlesMs": 3,
    "sortMs": 2
  }
}
```

### 3. Get Candlesticks with Footprint
**Endpoint:** `GET /flatbuffer/candlesticks-footprint`

Trả về dữ liệu đầy đủ bao gồm OHLCV và footprint aggregations.

### 4. Get Candles OHLCV Only
**Endpoint:** `GET /flatbuffer/candles-ohlcv`

Trả về chỉ dữ liệu OHLCV (không bao gồm footprint aggs) để giảm kích thước response.

**Response fields:**
- `t`: timestamp
- `ct`: close time
- `s`: symbol
- `s1`: symbol 1
- `i`: interval
- `o`: open
- `h`: high
- `l`: low
- `c`: close
- `v`: volume
- `bq`: buy quote volume
- `q`: quote volume
- `sv`: sell volume
- `bv`: buy volume
- `dMax`: delta max
- `dMin`: delta min
- `d`: delta
- `n`: number of trades

### 5. Get Footprint Only
**Endpoint:** `GET /flatbuffer/footprint-only`

Trả về chỉ footprint aggregations (không bao gồm OHLCV) để giảm kích thước response.

**Response fields:**
- `t`: timestamp
- `ct`: close time
- `s`: symbol
- `s1`: symbol 1
- `i`: interval
- `n`: number of trades
- `tv`: total volume
- `aggs`: footprint aggregations array

### 6. Get Batch Day Candles from GCS
**Endpoint:** `GET /flatbuffer/gcs/batch-day/candles`

Giống như `/flatbuffer/batch-day/candles` nhưng đọc dữ liệu từ Google Cloud Storage thay vì local filesystem.

**Parameters:**
- `symbol`: Trading pair (e.g., "BTCUSDT")
- `interval`: Timeframe (e.g., "1m", "5m", "1h")
- `from`: Start timestamp (milliseconds)
- `to`: End timestamp (milliseconds)
- `limit`: Maximum number of candles (default: 10000)

**Response:** Tương tự như `/flatbuffer/batch-day/candles` nhưng có thêm metrics về download time từ GCS.

**GCS Structure:**
```
BTCUSDT/
└── candlestick_footprint/
    ├── 1m/
    │   ├── 2025-12-08.bin
    │   ├── 2025-12-08.idx
    │   └── metadata.json
    ├── 5m/
    │   ├── 2025-W49.bin
    │   └── ...
    └── 1h/
        ├── 2025-12.bin
        └── ...
```

## Lợi ích của Cấu trúc Mới

### 1. Tối ưu Hiệu suất
- **Timeframe nhỏ (1m, 3m)**: Lưu theo ngày → Dễ quản lý, file size vừa phải
- **Timeframe trung bình (5m, 15m)**: Lưu theo tuần → Giảm số lượng file
- **Timeframe lớn (30m, 1h)**: Lưu theo tháng → Tối ưu cho dữ liệu lịch sử
- **Timeframe rất lớn (2h, 4h)**: Lưu theo quý → Quản lý dài hạn
- **Timeframe cực lớn (8h, 12h, 1d)**: Lưu theo năm → Lưu trữ lâu dài

### 2. Quản lý Dữ liệu
- Dễ dàng xóa dữ liệu cũ theo period
- Backup và restore theo period
- Giảm số lượng file cần quản lý

### 3. Hiệu suất Truy vấn
- Đọc chỉ những file cần thiết trong khoảng thời gian
- Index file giúp kiểm tra nhanh timestamp range
- Metadata giúp validate và debug

### 4. Khả năng Mở rộng
- Dễ dàng thêm timeframe mới
- Hỗ trợ nhiều symbol
- Có thể mở rộng sang GCS hoặc cloud storage khác