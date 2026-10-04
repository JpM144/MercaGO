export const AUDIT_ACTIONS = [
  'approve_application',
  'reject_application',
  'pause_store',
  'reactivate_store',
  'cancel_store',
];

export const AUDIT_ACTION_LABELS = {
  approve_application: 'Aprobó la solicitud',
  reject_application: 'Rechazó la solicitud',
  pause_store: 'Pausó la tienda',
  reactivate_store: 'Reactivó la tienda',
  cancel_store: 'Canceló la tienda',
};

export const AUDIT_TARGET_TYPES = ['store_application', 'store'];

export function buildAuditSummary(action, details = {}) {
  const label = AUDIT_ACTION_LABELS[action] ?? action;
  return details.targetName ? `${label} «${details.targetName}»` : label;
}
