// Deny by default for cashier accounts, including direct API requests.
export function canAccessAdminRoute(role: string, method: string, path: string): boolean {
  if (role === 'hq_admin' || role === 'branch_admin') return true;
  if (role !== 'cashier') return false;
  const normalized = path.replace(/\/+$/, '');
  if (method === 'POST') return normalized === '/api/admin/cashier/payments';
  if (method !== 'GET') return false;
  return [
    '/api/admin/me', '/api/admin/meta',
    '/api/admin/packages', '/api/admin/machines', '/api/admin/sessions',
  ].includes(normalized);
}
