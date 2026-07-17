import type { HttpRequest } from '@azure/functions';
import { getConfig } from './config.js';

interface ClientPrincipal {
  userDetails?: string;
  userRoles?: string[];
  claims?: { typ: string; val: string }[];
}

export function getClientPrincipal(request: HttpRequest): ClientPrincipal | null {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;

  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as ClientPrincipal;
  } catch {
    return null;
  }
}

export function isAuthorizedAdmin(request: HttpRequest): boolean {
  const config = getConfig();
  const principal = getClientPrincipal(request);
  if (!principal) return false;

  const roles = principal.userRoles ?? [];
  if (!roles.includes('authenticated')) return false;

  const user = principal.userDetails?.toLowerCase() ?? '';
  if (config.adminAllowedUsers.includes(user)) return true;

  if (config.adminAllowedGroupId) {
    const groupClaims = principal.claims?.filter((claim) => claim.typ.includes('groups')).map((claim) => claim.val) ?? [];
    if (groupClaims.includes(config.adminAllowedGroupId)) return true;
  }

  return roles.includes('administrator');
}
