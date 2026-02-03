/**
 * API types for PolyScope
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    correlationId: string;
    requestId?: string;
  };
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ApiHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  checks: Record<string, 'ok' | 'degraded' | 'fail'>;
  uptime?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  window: string;
}

// Error codes
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'EXTERNAL_API_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';