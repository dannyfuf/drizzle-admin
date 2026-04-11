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
