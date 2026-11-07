/**
 * Feature flags: switch a feature on or off, and choose which user roles get
 * it. To roll a feature out to everyone, add "user" to its roles (or remove
 * `roles`); to turn it off, set `enabled: false`.
 *
 * Flags only hide UI. Anything a feature saves still goes through the
 * backend's normal permission checks.
 */

const FEATURE_FLAGS = {
  // Create Contract → "Extend Tenancy": moves Tenant B's move-out date and
  // exports the extended contract PDF.
  contractExtension: { enabled: true, roles: ["admin"] },
};

/** Whether `user` (default: the signed-in user) can use feature `name`. */
export function isFeatureEnabled(name, user = window.getCurrentUser?.()) {
  const flag = FEATURE_FLAGS[name];
  if (!flag?.enabled) return false;
  if (!flag.roles) return true;
  return !!user && flag.roles.includes(user.role);
}
