/**
 * Role from env: viewer (read-only), auditor, or admin.
 * Used to hide Validate/Delete in Compliance for viewer.
 */
export const USER_ROLE = (import.meta.env.VITE_USER_ROLE || 'viewer').toLowerCase();
export const isViewer = () => USER_ROLE === 'viewer';
export const canValidate = () => USER_ROLE === 'admin' || USER_ROLE === 'auditor';
export const canDelete = () => USER_ROLE === 'admin';
