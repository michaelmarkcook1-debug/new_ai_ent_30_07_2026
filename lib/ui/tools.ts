// The tools a piece of advice can point at.
//
// Every "what to do" in this product used to end at the advice. A CIO reading
// "match model tier to task" then had to work out, unaided, that the thing
// which does that is two nav groups away and used to be called FitEngine.
// Advice that names the tool is worth more than advice that does not, and it
// costs one line at the call site.
//
// Kept as a registry rather than inline hrefs so a route rename breaks one
// file instead of leaking dead links across every recommendation in the app.
// `does` completes the sentence "…which lets you ___".

export interface Tool {
  label: string;
  href: string;
  does: string;
}

export const TOOLS = {
  modelForRole: {
    label: "Model for Role",
    href: "/market-view",
    does: "pick a role and see the cheapest model that meets its requirements",
  },
  pricePerformance: {
    label: "Price / Performance",
    href: "/price-performance",
    does: "compare what capability costs across every priced model",
  },
  workflowShortlist: {
    label: "Workflow Shortlist",
    href: "/workflow-shortlist",
    does: "pick a workflow and get the vendors to buy it from",
  },
  competitiveIntel: {
    label: "Competitive Intel",
    href: "/competitive-intel",
    does: "compare providers across ten assessed capabilities",
  },
  trustRank: {
    label: "Trust Rank",
    href: "/trust-rank",
    does: "see what regulation binds you, by jurisdiction",
  },
  securityDesk: {
    label: "The Security Desk",
    href: "/security-desk",
    does: "review security posture and open risks per vendor",
  },
  vendorView: {
    label: "Vendor View",
    href: "/vendor-view",
    does: "read one vendor properly, with its three questions answered",
  },
  decisionDesk: {
    label: "Decision Desk",
    href: "/decision-desk",
    does: "get a cited finding for the call you have to defend",
  },
  financialSnapshot: {
    label: "Financial Snapshot",
    href: "/financial-snapshot",
    does: "see what each vendor discloses about its AI revenue",
  },
  marketWatch: {
    label: "Market Watch",
    href: "/market-watch",
    does: "see category shares and who is winning each one",
  },
  reputationTracker: {
    label: "Reputation Tracker",
    href: "/reputation-tracker",
    does: "see how buyers, developers and staff rate each vendor",
  },
} as const satisfies Record<string, Tool>;

export type ToolKey = keyof typeof TOOLS;

export const toolsFor = (keys: readonly ToolKey[]): Tool[] =>
  keys.map((k) => TOOLS[k]);
