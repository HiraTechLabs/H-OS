import { apiRequest } from './client.js';
import type { ApplicationsResponse, ApplicationDefinition } from '@h-os/contracts';

/**
 * Fetches the registered applications visible to the current authenticated session.
 * The backend Application Registry is the single authority (REG-001).
 */
export async function getRegisteredApps(): Promise<readonly ApplicationDefinition[]> {
  const response = await apiRequest<ApplicationsResponse>('/apps');
  return response.apps;
}
