"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";
import { canAccessPath, type AppRole } from "@/lib/auth/permissions";

const navigation = [
  { label: "Overview", href: "/", icon: Icons.dashboard },
  { label: "Leads", href: "/leads", icon: Icons.leads },
  { label: "Companies", href: "/companies", icon: Icons.companies },
  { label: "Contacts", href: "/contacts", icon: Icons.contacts },
  { label: "Tasks", href: "/tasks", icon: Icons.tasks },
  { label: "Campaigns", href: "/campaigns", icon: Icons.campaigns },
  { label: "Settings", href: "/settings", icon: Icons.settings },
];

export function DashboardNav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4 lg:pb-0"
    >
      {navigation
        .filter(({ href }) => canAccessPath(role, href))
        .map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
              href={href}
              key={href}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}

