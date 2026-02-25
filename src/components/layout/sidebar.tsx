"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", icon: "H" },
  { href: "/agents/", label: "Agents", icon: "A" },
  { href: "/pipeline/", label: "Pipeline", icon: "P" },
  { href: "/tasks/", label: "Tasks", icon: "T" },
  { href: "/gateway/", label: "Gateway", icon: "G" },
  { href: "/memories/", label: "Memories", icon: "M" },
  { href: "/events/", label: "Events", icon: "E" },
  { href: "/debug/", label: "Debug", icon: "D" },
  { href: "/settings/", label: "Settings", icon: "S" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col min-h-screen">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold text-zinc-100 tracking-tight">
          evo<span className="text-emerald-400">dashboard</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">multi-agent system</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <span
                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                  active
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600">
        evo-king :3000
      </div>
    </aside>
  );
}
