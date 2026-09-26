export function getLoginDestination(user, fallback = '/') {
  if (!user) return fallback;
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'store_admin') {
    return user.storeStatus === 'approved' ? '/admin' : '/estado-tienda';
  }
  return fallback;
}
