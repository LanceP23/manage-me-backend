export const API_CONFIG = {
  VERSION: '1',
  PREFIX: 'api',
  VERSION_PREFIX: 'v',
} as const;

export const API_ROUTES = {
  BASE: `/${API_CONFIG.PREFIX}`,
  VERSIONED: `/${API_CONFIG.PREFIX}/${API_CONFIG.VERSION_PREFIX}${API_CONFIG.VERSION}`,
} as const;

