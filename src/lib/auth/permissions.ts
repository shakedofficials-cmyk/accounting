export const permissionKeys = [
  "dashboard:view",
  "orders:view",
  "orders:manage",
  "inventory:view",
  "inventory:manage",
  "production:view",
  "production:manage",
  "expenses:view",
  "expenses:manage",
  "accounting:view",
  "accounting:manage",
  "settlements:view",
  "settlements:manage",
  "reports:view",
  "settings:manage",
  "audit:view",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  roleName: string;
  permissions: PermissionKey[];
};

export const hasPermission = (user: Pick<AuthUser, "permissions"> | null, permission: PermissionKey) =>
  Boolean(user?.permissions.includes(permission));
