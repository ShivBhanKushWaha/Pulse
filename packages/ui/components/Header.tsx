"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearToken } from "../lib/api";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#what-we-collect", label: "What we collect" },
  { href: "/#setup", label: "Setup" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-panel/80 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold text-muted">
          {pathname.startsWith("/project") ? "Project" : "Documentation"}
        </span>
        <nav className="flex items-center gap-4 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted transition-colors hover:text-text">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-good live-dot" />
          self-hosted
        </span>
        <button
          type="button"
          onClick={() => {
            clearToken();
            window.location.reload();
          }}
          className="transition-colors hover:text-text"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
