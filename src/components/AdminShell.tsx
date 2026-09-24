"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/issues", "Issues"],
  ["/admin/map", "Map"],
  ["/admin/team", "Team"],
  ["/admin/places", "Places"],
  ["/admin/categories", "Categories"],
  ["/admin/links", "Showcase"],
  ["/admin/audit", "Audit"],
];

export function AdminShell({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-pine text-paper lg:min-h-full lg:border-b-0 lg:border-r">
        <div className="px-4 py-5">
          <p className="font-display text-3xl">Better City</p>
          <p className="mt-1 text-sm text-paper/70">{name} · {role}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
          <Link href="/field" className="mb-2 block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium" style={{ color: "#f3eee4" }}>
            Main screen
          </Link>
          {LINKS.map(([href, label]) => {
            const active = path === href || (href !== "/admin" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium"
                style={
                  active
                    ? { backgroundColor: "#fffaf3", color: "#1c1915" }
                    : { backgroundColor: "transparent", color: "#f3eee4" }
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <button className="hidden px-6 py-4 text-sm text-paper/70 lg:block" type="button" onClick={logout}>
          Log out
        </button>
      </aside>
      <div className="px-4 py-6 lg:px-8">{children}</div>
    </div>
  );
}
