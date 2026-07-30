"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// The AG shell: top bar with logo, scope chip and "Ask AI" pill; left
// sidebar with ALL-CAPS group labels, icons, active item as a solid primary
// rounded rectangle (anatomy verified against the live portal, spec S3).

type NavItem = { label: string; href: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

// Minimal inline icon set keyed by name.
const ICONS: Record<string, React.ReactNode> = {
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  watch: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  finance: <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" />,
  intel: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  reputation: <path d="m12 3 2.9 5.9 6.1.9-4.5 4.4 1.1 6.3L12 17.8 6.4 20.5l1.1-6.3L3 9.8l6.1-.9L12 3Z" />,
  vendor: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></>,
  alliance: <><circle cx="7" cy="12" r="3.5" /><circle cx="17" cy="12" r="3.5" /><path d="M10.5 12h3" /></>,
  market: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.7 5.6 3.7 9S14.5 18.5 12 21c-2.5-2.5-3.7-5.6-3.7-9S9.5 5.5 12 3Z" /></>,
  company: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 9h5a1 1 0 0 1 1 1v11" /><path d="M4 21h16" /><path d="M7.5 8h2M7.5 12h2M7.5 16h2M17 13h1M17 17h1" /></>,
  navigator: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  price: <><path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" /></>,
  security: <path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" />,
  trust: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  news: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 9h7M7 13h10M7 17h10" /></>,
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Market Intelligence",
    items: [
      { label: "The Pulse", href: "/pulse", icon: "pulse" },
      { label: "Market Watch", href: "/market-watch", icon: "watch" },
      { label: "Financial Snapshot", href: "/financial-snapshot", icon: "finance" },
      { label: "Competitive Intel", href: "/competitive-intel", icon: "intel" },
      { label: "Reputation Tracker", href: "/reputation-tracker", icon: "reputation" },
      { label: "Vendor View", href: "/vendor-view", icon: "vendor" },
      { label: "Alliances", href: "/alliances", icon: "alliance" },
    ],
  },
  {
    label: "AI and Your Company",
    items: [
      { label: "Market View", href: "/market-view", icon: "market" },
      { label: "Company View: Shell", href: "/company-view", icon: "company" },
    ],
  },
  {
    label: "Vendor Assessment",
    items: [
      { label: "AI Ecosystem Navigator", href: "/ecosystem-navigator", icon: "navigator" },
      { label: "Price / Performance", href: "/price-performance", icon: "price" },
      { label: "The Security Desk", href: "/security-desk", icon: "security" },
      { label: "Trust Rank", href: "/trust-rank", icon: "trust" },
      { label: "News", href: "/news-feed", icon: "news" },
    ],
  },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("ag_theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("ag_theme", "light");
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded-md border border-base-300 p-1.5 text-muted hover:text-primary"
    >
      {dark ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      )}
    </button>
  );
}

export function Shell({
  children,
  scopeLabel,
}: {
  children: React.ReactNode;
  scopeLabel: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-base-300 bg-base-100/95 px-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md p-1.5 text-muted hover:bg-base-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/pulse" className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary font-display text-[13px] font-extrabold text-white">
              A
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-tight">
              AnalystGenius
            </span>
            <span className="ml-1 rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-secondary dark:bg-secondary/40 dark:text-secondary-content">
              New AI.Ent
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-base-300 px-2.5 py-1 font-mono text-[10px] text-muted sm:inline-flex">
            {scopeLabel}
          </span>
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-md border border-base-300 p-1.5 text-muted hover:text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          </button>
          <Link
            href="/company-view/analyst"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3Z" /></svg>
            Ask AI
          </Link>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`sticky top-12 h-[calc(100vh-3rem)] shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/60 pb-16 transition-all ${collapsed ? "w-12" : "w-56"}`}
        >
          <nav className="flex h-full flex-col px-2 py-3">
            <div className="flex-1 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  {!collapsed ? (
                    <div className="micro-label mb-1.5 px-2">{group.label}</div>
                  ) : (
                    <div className="mb-1.5 border-t border-base-300" />
                  )}
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            title={item.label}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition ${
                              active
                                ? "bg-primary text-white shadow-sm"
                                : "text-base-content/75 hover:bg-base-300/50 hover:text-base-content"
                            }`}
                          >
                            <Icon name={item.icon} />
                            {!collapsed ? <span className="truncate">{item.label}</span> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-base-300 pt-3">
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted hover:bg-base-300/50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} /></svg>
                {!collapsed ? "Sidebar mode" : null}
              </button>
              {!collapsed ? (
                <div className="flex items-center gap-2 rounded-md px-2 py-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white">
                    E
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold">EAI Demo</p>
                    <p className="truncate font-mono text-[9px] text-muted">signed in</p>
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-5 py-4 pb-12">{children}</main>
      </div>
    </div>
  );
}
