/**
 * Kensei runtime configuration.
 *
 * Ports follow the XWA suite convention (kensei: backend 8010, frontend 4210).
 * The host is resolved at runtime so the app works from localhost and from any
 * LAN address; set apiBaseUrl/wsBaseUrl to absolute values for a deployment.
 */
const host =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';

export const environment = {
  production: false,
  apiBaseUrl: `http://${host}:8010`,
  wsBaseUrl: `ws://${host}:8010`,
};
