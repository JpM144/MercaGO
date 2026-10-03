export function getLoginDestination(user, fallback = '/') {
  if (!user) return fallback;
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'admin' || user.role === 'store_admin') return '/admin';
  return fallback;
}
