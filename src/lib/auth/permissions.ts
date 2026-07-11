import { z } from "zod";

export const appRoleSchema = z.enum([
  "ceo_admin",
  "sales_manager",
  "sales_representative",
]);

export type AppRole = z.infer<typeof appRoleSchema>;

export const roleLabels: Record<AppRole, string> = {
  ceo_admin: "CEO / Admin",
  sales_manager: "Sales Manager",
  sales_representative: "Sales Representative",
};

const routeRoles: ReadonlyArray<{
  prefix: string;
  roles: readonly AppRole[];
}> = [
  { prefix: "/settings", roles: ["ceo_admin"] },
  { prefix: "/campaigns", roles: ["ceo_admin", "sales_manager"] },
];

export function canAccessPath(role: AppRole, pathname: string): boolean {
  const rule = routeRoles.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return rule ? rule.roles.includes(role) : true;
}

