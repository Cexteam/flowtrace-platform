// Domain Layer - Core Business Types for MarketData Feature
// These types are the foundation of domain logic and should be independent
// of application and infrastructure concerns

// ✅ WEB SOCKET CONNECTION STATUS (For Port Interface)
export interface WebSocketConnectionStatus {
  isConnected: boolean;
  connectionUrl?: string;
  lastHeartbeat?: number;
  reconnectCount?: number;
  errorMessage?: string;
}
