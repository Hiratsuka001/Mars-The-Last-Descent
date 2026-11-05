/**
 * Debug Mode Configuration
 * Enabled in Vite DEV mode or via ?debug=1 URL parameter.
 * Centralized here to avoid circular imports between scenes and mini-games.
 */

export const isDebugMode = Boolean(
  (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1')
);
