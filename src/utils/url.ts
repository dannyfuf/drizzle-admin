/**
 * Joins a basePath and a route path, ensuring correct concatenation.
 * basePath should NOT have a trailing slash.
 * path should start with '/'.
 *
 * adminUrl('', '/login')        => '/login'
 * adminUrl('/admin', '/login')  => '/admin/login'
 * adminUrl('/admin', '/')       => '/admin/'
 */
export function adminUrl(basePath: string, path: string): string {
  if (!basePath) return path
  return `${basePath}${path}`
}

/**
 * Validates and normalizes the base URL path used by the admin panel.
 *
 * @param raw - The configured base path. An empty string mounts at the root.
 * @returns The base path without a trailing slash.
 */
export function normalizeBasePath(raw: string): string {
  if (raw) {
    if (!raw.startsWith('/')) {
      throw new Error(`basePath must start with "/". Got: "${raw}"`)
    }
    if (raw.includes('//')) {
      throw new Error(`basePath must not contain "//". Got: "${raw}"`)
    }
  }

  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}
