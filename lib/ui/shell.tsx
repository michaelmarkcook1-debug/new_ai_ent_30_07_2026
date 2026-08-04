"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AgMark } from "@/lib/ui/logo";
import { AskAiButton } from "@/lib/ui/ask-ai";
import { ShortlistProvider } from "@/lib/shortlist";
import { ShortlistIndicator } from "@/lib/ui/shortlist-indicator";

// The AG shell: top bar with logo, scope chip and "Ask AI" pill; left
// sidebar with ALL-CAPS group labels, icons, active item as a solid primary
// rounded rectangle (anatomy verified against the live portal, spec S3).

// `also` is a second page that answers the same question from the other side.
// It shares its partner's row and only appears as its own link once that part
// of the site is open, so eighteen resting items became thirteen without a
// single route being dropped or a page being orphaned.
type NavPartner = { label: string; href: string; hint?: string };
type NavItem = {
  label: string;
  href: string;
  icon: string;
  hint?: string;
  also?: NavPartner;
};
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
  // A compass. Used by Explore: "Start here" and the Pulse row both drew the
  // same waveform, so the two rows at the top of the sidebar were
  // indistinguishable at a glance.
  navigator: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  price: <><path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" /></>,
  security: <path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" />,
  trust: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  news: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 9h7M7 13h10M7 17h10" /></>,
  interrogate: <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.2" /><path d="M12 17h.01" /></>,
  assess: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></>,
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
      { label: "Explore", href: "/start", icon: "navigator", hint: "Pick the question closest to yours" },
      { label: "Your Pulse", href: "/pulse", icon: "pulse", hint: "Today's market read: averages, risks and who is moving" },
      // Directly under The Pulse: the highest-intent question on the site,
      // which until now sat second in the second of three groups.
      {
        label: "Model for Role",
        href: "/market-view",
        icon: "market",
        hint: "Pick a role, get the cheapest model that meets its requirements and what it costs",
        also: { label: "Price / Performance", href: "/price-performance", hint: "What capability costs, and the efficiency frontier" },
      },
      {
        label: "Market Watch",
        href: "/market-watch",
        icon: "watch",
        hint: "Category shares, leaders and the winning/losing read",
        also: { label: "AI Adoption", href: "/ai-adoption", hint: "Who is actually paying for AI, measured and attributed, and how far each industry has got" },
      },
      { label: "Financial Snapshot", href: "/financial-snapshot", icon: "finance", hint: "Vendor financials, segment revenue and what AI they disclose" },
      { label: "Competitive Intel", href: "/competitive-intel", icon: "intel", hint: "Compare model providers across ten assessed capabilities" },
      {
        label: "Vendor View",
        href: "/vendor-view",
        icon: "vendor",
        hint: "Full profile and rankings for every tracked vendor",
        also: { label: "Reputation Tracker", href: "/reputation-tracker", hint: "How buyers, developers and staff rate each vendor" },
      },
      {
        label: "Alliances",
        href: "/alliances",
        icon: "alliance",
        hint: "Who partners with whom, and how deep the tie is",
        also: { label: "AI Ecosystem Navigator", href: "/ecosystem-navigator", hint: "Who depends on whom across the AI stack" },
      },
    ],
  },
  // Recomposed 3 August 2026 from four tabs into three, ordered as the
  // CIO's journey: where do we stand, what fits and what does it cost,
  // and what call do we make. Interrogate and Assess and Decide were two
  // halves of the third question, so they share the Decision Desk now;
  // "Company View: Shell" was named after its fixture, which is a build
  // detail no buyer should have to decode.
  {
    label: "AI and Your Company",
    items: [
      { label: "Your AI Position", href: "/company-view", icon: "company", hint: "Where AI helps or threatens you: exposure, readiness, obligations, and an analyst over your own documents" },
      { label: "Decision Desk", href: "/decision-desk", icon: "assess", hint: "A cited finding and a weighted score for the call you must defend" },
    ],
  },
  {
    label: "Vendor Assessment",
    items: [
      { label: "Workflow Shortlist", href: "/workflow-shortlist", icon: "intel", hint: "Pick a workflow, get the vendors to buy from and the models to build on" },
      {
        label: "Trust Rank",
        href: "/trust-rank",
        icon: "trust",
        hint: "What AI regulation binds you, by jurisdiction",
        also: { label: "The Security Desk", href: "/security-desk", hint: "Security posture and open risks per vendor" },
      },
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
    <ShortlistProvider>
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
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white">
              <AgMark className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-base font-extrabold tracking-tight">
              AI Enterprise
            </span>
            <span className="ml-1 hidden rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-secondary dark:bg-secondary/40 dark:text-secondary-content md:inline">
              Buyer intelligence
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden rounded-full border border-base-300 px-2.5 py-1.5 font-mono text-xs text-muted md:inline-flex">
            {scopeLabel}
          </span>
          <ShortlistIndicator />
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-md border border-base-300 p-1.5 text-muted hover:text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          </button>
          <AskAiButton />
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          // Below md the sidebar collapses to icons on its own, whatever the
          // manual toggle says. At 375px a 224px rail left 151px for content,
          // which pushed every page into horizontal scroll.
          className={`sticky top-12 h-[calc(100vh-3rem)] shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/60 pb-16 transition-all ${collapsed ? "w-12" : "w-12 md:w-56"}`}
        >
          <nav className="flex h-full flex-col px-2 py-3">
            <div className="flex-1 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  {!collapsed ? (
                    <>
                      <div className="micro-label mb-1.5 hidden px-2 md:block">
                        {group.label}
                      </div>
                      <div className="mb-1.5 border-t border-base-300 md:hidden" />
                    </>
                  ) : (
                    <div className="mb-1.5 border-t border-base-300" />
                  )}
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const on = (href: string) =>
                        pathname === href || pathname.startsWith(`${href}/`);
                      const alsoActive = item.also ? on(item.also.href) : false;
                      const active = on(item.href);
                      // The partner gets its own row only while this part of
                      // the site is open, so it is always one click from where
                      // it is relevant and never adds to the resting count.
                      const showAlso =
                        item.also && !collapsed && (active || alsoActive);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            title={item.hint ?? item.label}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition ${
                              active
                                ? "bg-primary text-white shadow-sm"
                                : alsoActive
                                  ? "bg-base-300/40 text-base-content"
                                  : "text-base-content/75 hover:bg-base-300/50 hover:text-base-content"
                            }`}
                          >
                            <Icon name={item.icon} />
                            {!collapsed ? (
                              <span className="hidden truncate md:inline">
                                {item.label}
                              </span>
                            ) : null}
                          </Link>
                          {showAlso && item.also ? (
                            <Link
                              href={item.also.href}
                              title={item.also.hint ?? item.also.label}
                              className={`mt-0.5 ml-[1.4rem] hidden items-center rounded-md border-l border-base-300 py-1 pl-3 text-xs transition md:flex ${
                                alsoActive
                                  ? "font-medium text-primary"
                                  : "text-base-content/70 hover:text-base-content"
                              }`}
                            >
                              <span className="truncate">{item.also.label}</span>
                            </Link>
                          ) : null}
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
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-muted hover:bg-base-300/50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={collapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} /></svg>
                {!collapsed ? (
                  <span className="hidden md:inline">Sidebar mode</span>
                ) : null}
              </button>
              {!collapsed ? (
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                    E
                  </span>
                  <div className="hidden min-w-0 md:block">
                    <p className="truncate text-xs font-semibold">AI Enterprise</p>
                    <p className="truncate font-mono text-xs text-muted">signed in</p>
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        {/* Main content.
            Two things happen here, and both are layout-wide.

            The column is capped and centred. Without a cap it ran the full
            window: 1696px of content on a 1920px monitor, which put some
            paragraphs at 300 characters a line while their capped siblings
            stopped at 768px, so cards read as content hugging the left with
            dead space to the right.

            The cap is also a container query root. Every grid inside it sizes
            against the space it actually has rather than against the window,
            which the window never described: the sidebar takes 224px, so a
            "lg" grid firing at a 1024px window was really laying out three
            columns into 760px. Querying the container also means collapsing
            the sidebar reflows the content, which viewport breakpoints could
            not see at all.

            Anything position-fixed must render outside this div. contain:
            layout comes with container-type and would make this element the
            containing block for it. The derivation drawers portal to the body
            for that reason, and the demo footer is a sibling of the Shell. */}
        <main className="min-w-0 flex-1 px-4 py-5 pb-12 sm:px-6 xl:px-8">
          <div className="@container mx-auto w-full max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </div>
    </ShortlistProvider>
  );
}
