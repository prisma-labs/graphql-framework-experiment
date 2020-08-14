/**
 * Check if curerntly in production mode defined as
 * NODE_ENV environment variable equaling "production".
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if curerntly in development mode defined as
 * NODE_ENV environment variable not equaling "production".
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}
