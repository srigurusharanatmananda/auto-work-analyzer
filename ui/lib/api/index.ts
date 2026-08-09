/**
 * The front-end's HTTP layer.
 *
 * Components import from here and nowhere else:
 *
 *     import { api, ApiError, messageFor } from '@/lib/api';
 *
 * Direct `fetch` calls in components are what this replaced — if you find
 * yourself writing one, the reason is worth a comment.
 */

export { api, ApiClient } from './ApiClient';
export type { ApiClientOptions, ApiResponse, AuthBridge, FetchLike, RequestOptions } from './ApiClient';
export { ApiError, messageFor } from './ApiError';
export { API_BASE_URL, DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './config';
