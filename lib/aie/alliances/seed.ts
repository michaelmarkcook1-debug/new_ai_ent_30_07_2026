// AI x GSI alliance channel map.
//
// Ported from the deployed AI Enterprise app's /alliances page
// (ranking-engine-red.vercel.app), read 4 August 2026. That page renders the
// dataset into its own React payload and publishes no API for it, so the rows
// were extracted from the payload rather than fetched; re-read the page to
// refresh them.
//
// Two of the fourteen cited alliances are hard-coded markup in the source
// rather than rows in its dataset, so EY appears in its dossier list while
// being absent from its own map, and Capgemini x Mistral is written up but not
// drawn. Both are ported here as ordinary rows, with the publisher and date the
// source states, so the map and the dossier list agree. They are marked
// portedFromMarkup so the difference stays visible.
//
// The tiers are the source's own and are not a ranking: direct_named is a
// named alliance, cloud_certified and observed_implementer are breadth signals
// the source itself calls directional and confidence-tiered, never audited fact.

export type PartnerKind =
  | "global_si"
  | "strategy_consultancy"
  | "platform_hybrid"
  | "regional_si";

export type ChannelTier = "direct_named" | "cloud_certified" | "observed_implementer";

export type AllianceEvidence =
  | "verified"
  | "strong"
  | "moderate"
  | "partial"
  | "plausible_unverified";

export interface ProofPoint {
  label: string;
  value: string;
}

export interface AllianceSpotlight {
  relationship: string;
  summary: string;
  proofPoints: ProofPoint[];
  publisher: string;
  url: string;
  asOf: string;
  evidence: AllianceEvidence;
}

export interface ChannelLink {
  key: string;
  partnerId: string;
  partnerName: string;
  partnerKind: PartnerKind;
  platformHybrid: boolean;
  vendorId: string;
  vendorName: string;
  tier: ChannelTier;
  evidence: AllianceEvidence;
  encroachment: boolean;
  industries: string[];
  regions: string[];
  areas: string[];
  spotlight: AllianceSpotlight | null;
  /** True for the two the source renders as markup rather than data. */
  portedFromMarkup?: boolean;
}

/** A capital vehicle standing up a vendor's delivery arm, not a channel link. */
export interface AllianceVenture {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  summary: string;
  proofPoints: ProofPoint[];
  publisher: string;
  url: string;
  asOf: string;
  evidence: AllianceEvidence;
}

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  global_si: "Global systems integrator",
  strategy_consultancy: "Strategy consultancy",
  platform_hybrid: "Platform hybrid (owns a rival platform)",
  regional_si: "Regional systems integrator",
};

export const CHANNEL_TIER_LABEL: Record<ChannelTier, string> = {
  direct_named: "Direct named alliance",
  cloud_certified: "Cloud-certified link",
  observed_implementer: "Observed implementer",
};

export const CHANNEL_LINKS: ChannelLink[] = [
  {
    "key": "accenture|anthropic",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services",
      "Healthcare & life sciences",
      "Public sector",
      "Cybersecurity",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": {
      "relationship": "Accenture Anthropic Business Group",
      "summary": "A dedicated business group pairing Claude with Accenture delivery, weighted toward COBOL and legacy modernization.",
      "proofPoints": [
        {
          "label": "Trained",
          "value": "~30,000 people trained on Claude (incl. forward-deployed engineers)"
        },
        {
          "label": "Focus",
          "value": "COBOL / legacy modernization"
        }
      ],
      "publisher": "Anthropic",
      "url": "https://www.anthropic.com/news",
      "asOf": "Dec 2025",
      "evidence": "verified"
    }
  },
  {
    "key": "accenture|cohere",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "cohere",
    "vendorName": "Cohere",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "Japan",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Secure enterprise AI",
      "Knowledge work",
      "Financial services",
      "Telecoms",
      "Private AI"
    ],
    "spotlight": null
  },
  {
    "key": "accenture|google",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services",
      "Healthcare & life sciences",
      "Manufacturing & industrial",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "France / Western Europe",
      "UK / Europe",
      "Japan",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": {
      "relationship": "Agents on Gemini Enterprise",
      "summary": "450+ Accenture-engineered agents published to Google Cloud Marketplace and accessible inside Gemini Enterprise.",
      "proofPoints": [
        {
          "label": "Agents",
          "value": "450+ engineered agents on Google Cloud Marketplace"
        },
        {
          "label": "Surface",
          "value": "Accessible in Gemini Enterprise"
        }
      ],
      "publisher": "Accenture Newsroom",
      "url": "https://newsroom.accenture.com/news/2025/accenture-helps-organizations-advance-agentic-ai-with-gemini-enterprise",
      "asOf": "Oct 2025",
      "evidence": "verified"
    }
  },
  {
    "key": "accenture|meta",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "meta",
    "vendorName": "Meta",
    "tier": "observed_implementer",
    "evidence": "moderate",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Public sector"
    ],
    "regions": [
      "Japan"
    ],
    "areas": [
      "Custom enterprise models",
      "Private/sovereign AI",
      "Open-weight deployment",
      "Hybrid cloud / on-prem"
    ],
    "spotlight": null
  },
  {
    "key": "accenture|microsoft",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services",
      "Healthcare & life sciences",
      "Manufacturing & industrial",
      "Cybersecurity",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "France / Western Europe",
      "UK / Europe",
      "Japan",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "accenture|mistral",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "mistral",
    "vendorName": "Mistral",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Public sector"
    ],
    "regions": [
      "France / Western Europe"
    ],
    "areas": [
      "European sovereign AI",
      "Industrial AI",
      "Regulated enterprise AI",
      "Secure large-scale deployment"
    ],
    "spotlight": null
  },
  {
    "key": "accenture|openai",
    "partnerId": "accenture",
    "partnerName": "Accenture",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Public sector",
      "Cybersecurity",
      "Retail & consumer"
    ],
    "regions": [
      "United States",
      "France / Western Europe",
      "UK / Europe",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": {
      "relationship": "Enterprise + federal alliance",
      "summary": "ChatGPT Enterprise rolled out to tens of thousands of Accenture staff, plus a federal agentic lab (“The Forge”) and FedRAMP-authorized delivery through Accenture Federal Services.",
      "proofPoints": [
        {
          "label": "Enterprise seats",
          "value": "ChatGPT Enterprise to tens of thousands of staff"
        },
        {
          "label": "Federal",
          "value": "“The Forge” agentic lab + FedRAMP path (Accenture Federal Services)"
        }
      ],
      "publisher": "Accenture Newsroom",
      "url": "https://newsroom.accenture.com/news",
      "asOf": "Dec 2025 – May 2026",
      "evidence": "partial"
    }
  },
  {
    "key": "avanade|microsoft",
    "partnerId": "avanade",
    "partnerName": "Avanade",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "bcg|openai",
    "partnerId": "bcg",
    "partnerName": "BCG",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "capgemini|google",
    "partnerId": "capgemini",
    "partnerName": "Capgemini",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Retail & consumer"
    ],
    "regions": [
      "France / Western Europe",
      "UK / Europe"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "capgemini|microsoft",
    "partnerId": "capgemini",
    "partnerName": "Capgemini",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Retail & consumer"
    ],
    "regions": [
      "France / Western Europe",
      "UK / Europe"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "capgemini|openai",
    "partnerId": "capgemini",
    "partnerName": "Capgemini",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Retail & consumer"
    ],
    "regions": [
      "France / Western Europe",
      "UK / Europe"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "cgi|openai",
    "partnerId": "cgi",
    "partnerName": "CGI",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Public sector"
    ],
    "regions": [],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "cognizant|anthropic",
    "partnerId": "cognizant",
    "partnerName": "Cognizant",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Healthcare & life sciences",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "India"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": null
  },
  {
    "key": "cognizant|google",
    "partnerId": "cognizant",
    "partnerName": "Cognizant",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Healthcare & life sciences",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "India"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "cognizant|microsoft",
    "partnerId": "cognizant",
    "partnerName": "Cognizant",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Healthcare & life sciences",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "United States",
      "India"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "cognizant|openai",
    "partnerId": "cognizant",
    "partnerName": "Cognizant",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Retail & consumer"
    ],
    "regions": [
      "United States",
      "India"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "deloitte|anthropic",
    "partnerId": "deloitte",
    "partnerName": "Deloitte",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Healthcare & life sciences",
      "Cybersecurity"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": {
      "relationship": "Firm-wide Claude rollout",
      "summary": "Anthropic’s largest deployment: Claude across Deloitte’s ~470,000 people, with 15,000 to be certified.",
      "proofPoints": [
        {
          "label": "Scale",
          "value": "~470,000-employee Claude rollout (Anthropic’s largest)"
        },
        {
          "label": "Certification",
          "value": "15,000 to be Claude-certified"
        }
      ],
      "publisher": "CNBC",
      "url": "https://www.cnbc.com/2025/10/06/anthropic-deloitte-enterprise-ai.html",
      "asOf": "Oct 2025",
      "evidence": "verified"
    }
  },
  {
    "key": "deloitte|google",
    "partnerId": "deloitte",
    "partnerName": "Deloitte",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Healthcare & life sciences"
    ],
    "regions": [
      "United States",
      "UK / Europe",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": {
      "relationship": "Gemini / Vertex practice",
      "summary": "Deloitte’s Agentic Transformation Practice built on Gemini Enterprise, with a cited client proof point at insurer Definity.",
      "proofPoints": [
        {
          "label": "Practice",
          "value": "Agentic Transformation Practice on Gemini Enterprise"
        },
        {
          "label": "Client proof",
          "value": "Definity: ~3.5 min/call saved (~20% reduction) on Vertex AI"
        }
      ],
      "publisher": "Google Cloud",
      "url": "https://cloud.google.com/customers/definity",
      "asOf": "Apr 2026",
      "evidence": "partial"
    }
  },
  {
    "key": "dxc|anthropic",
    "partnerId": "dxc",
    "partnerName": "DXC Technology",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Public sector"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": null
  },
  {
    "key": "dxc|meta",
    "partnerId": "dxc",
    "partnerName": "DXC Technology",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "meta",
    "vendorName": "Meta",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": false,
    "industries": [
      "Public sector"
    ],
    "regions": [],
    "areas": [
      "Custom enterprise models",
      "Private/sovereign AI",
      "Open-weight deployment",
      "Hybrid cloud / on-prem"
    ],
    "spotlight": null
  },
  {
    "key": "fujitsu|cohere",
    "partnerId": "fujitsu",
    "partnerName": "Fujitsu",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "cohere",
    "vendorName": "Cohere",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": false,
    "industries": [],
    "regions": [
      "Japan"
    ],
    "areas": [
      "Secure enterprise AI",
      "Knowledge work",
      "Financial services",
      "Telecoms",
      "Private AI"
    ],
    "spotlight": null
  },
  {
    "key": "hcltech|google",
    "partnerId": "hcltech",
    "partnerName": "HCLTech",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [
      "India"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "ibm-consulting|ibm",
    "partnerId": "ibm-consulting",
    "partnerName": "IBM Consulting",
    "partnerKind": "platform_hybrid",
    "platformHybrid": true,
    "vendorId": "ibm",
    "vendorName": "IBM",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Public sector",
      "Cybersecurity"
    ],
    "regions": [
      "United States",
      "Middle East"
    ],
    "areas": [
      "Hybrid cloud",
      "AI governance",
      "Regulated industries",
      "Mainframe modernization",
      "Cybersecurity",
      "AIOps",
      "Enterprise automation"
    ],
    "spotlight": null
  },
  {
    "key": "ibm-consulting|meta",
    "partnerId": "ibm-consulting",
    "partnerName": "IBM Consulting",
    "partnerKind": "platform_hybrid",
    "platformHybrid": true,
    "vendorId": "meta",
    "vendorName": "Meta",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": true,
    "industries": [
      "Public sector"
    ],
    "regions": [
      "Japan"
    ],
    "areas": [
      "Custom enterprise models",
      "Private/sovereign AI",
      "Open-weight deployment",
      "Hybrid cloud / on-prem"
    ],
    "spotlight": null
  },
  {
    "key": "ibm-consulting|openai",
    "partnerId": "ibm-consulting",
    "partnerName": "IBM Consulting",
    "partnerKind": "platform_hybrid",
    "platformHybrid": true,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "observed_implementer",
    "evidence": "moderate",
    "encroachment": true,
    "industries": [
      "Public sector",
      "Cybersecurity"
    ],
    "regions": [
      "United States",
      "UK / Europe",
      "Canada",
      "Middle East"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "infosys|anthropic",
    "partnerId": "infosys",
    "partnerName": "Infosys",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Telecoms"
    ],
    "regions": [
      "India"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": null
  },
  {
    "key": "infosys|google",
    "partnerId": "infosys",
    "partnerName": "Infosys",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "infosys|microsoft",
    "partnerId": "infosys",
    "partnerName": "Infosys",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Retail & consumer",
      "Telecoms"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": {
      "relationship": "Copilot at scale + Topaz",
      "summary": "100k+ Copilot seats plus Infosys Topaz, with the bulk of the workforce made “AI aware.”",
      "proofPoints": [
        {
          "label": "Seats",
          "value": "Copilot 100,000+ seats"
        },
        {
          "label": "Workforce",
          "value": "~270,000 (84%) made “AI aware”; Infosys Topaz"
        }
      ],
      "publisher": "Microsoft Source Asia",
      "url": "https://news.microsoft.com/source/asia/2026/06/03",
      "asOf": "Jun 2026",
      "evidence": "verified"
    }
  },
  {
    "key": "infosys|openai",
    "partnerId": "infosys",
    "partnerName": "Infosys",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Retail & consumer"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "kpmg|anthropic",
    "partnerId": "kpmg",
    "partnerName": "KPMG",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Healthcare & life sciences"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": null
  },
  {
    "key": "kpmg|google",
    "partnerId": "kpmg",
    "partnerName": "KPMG",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Healthcare & life sciences"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "kyndryl|google",
    "partnerId": "kyndryl",
    "partnerName": "Kyndryl",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "lg-cns|cohere",
    "partnerId": "lg-cns",
    "partnerName": "LG CNS",
    "partnerKind": "regional_si",
    "platformHybrid": false,
    "vendorId": "cohere",
    "vendorName": "Cohere",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": false,
    "industries": [],
    "regions": [],
    "areas": [
      "Secure enterprise AI",
      "Knowledge work",
      "Financial services",
      "Telecoms",
      "Private AI"
    ],
    "spotlight": null
  },
  {
    "key": "mckinsey|cohere",
    "partnerId": "mckinsey",
    "partnerName": "McKinsey",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "cohere",
    "vendorName": "Cohere",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [
      "Canada"
    ],
    "areas": [
      "Secure enterprise AI",
      "Knowledge work",
      "Financial services",
      "Telecoms",
      "Private AI"
    ],
    "spotlight": {
      "relationship": "First LLM-provider partnership",
      "summary": "McKinsey’s first LLM-provider partnership, run through QuantumBlack: a defensible “first management-consulting LLM partnership.”",
      "proofPoints": [
        {
          "label": "Firsts",
          "value": "McKinsey’s first LLM-provider partnership (via QuantumBlack)"
        }
      ],
      "publisher": "McKinsey",
      "url": "https://www.mckinsey.com/about-us/new-at-mckinsey-blog",
      "asOf": "2023",
      "evidence": "verified"
    }
  },
  {
    "key": "mckinsey|google",
    "partnerId": "mckinsey",
    "partnerName": "McKinsey",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [
      "Canada"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "mckinsey|openai",
    "partnerId": "mckinsey",
    "partnerName": "McKinsey",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [],
    "regions": [
      "Canada"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "ntt-data|meta",
    "partnerId": "ntt-data",
    "partnerName": "NTT DATA",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "meta",
    "vendorName": "Meta",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial"
    ],
    "regions": [
      "Japan"
    ],
    "areas": [
      "Custom enterprise models",
      "Private/sovereign AI",
      "Open-weight deployment",
      "Hybrid cloud / on-prem"
    ],
    "spotlight": null
  },
  {
    "key": "ntt-data|microsoft",
    "partnerId": "ntt-data",
    "partnerName": "NTT DATA",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Manufacturing & industrial",
      "Telecoms"
    ],
    "regions": [
      "Japan"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "pwc|anthropic",
    "partnerId": "pwc",
    "partnerName": "PwC",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Cybersecurity"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": {
      "relationship": "Claude enterprise alliance",
      "summary": "Claude adopted firm-wide with a joint Center of Excellence, MCP integration and Claude Code + Cowork in the delivery stack.",
      "proofPoints": [
        {
          "label": "Certified",
          "value": "30,000 Claude-certified professionals"
        },
        {
          "label": "Build",
          "value": "MCP integration, Claude Code + Cowork, joint Center of Excellence"
        }
      ],
      "publisher": "Anthropic",
      "url": "https://www.anthropic.com/news/pwc-expanded-partnership",
      "asOf": "May 2026",
      "evidence": "verified"
    }
  },
  {
    "key": "pwc|google",
    "partnerId": "pwc",
    "partnerName": "PwC",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services"
    ],
    "regions": [
      "United States",
      "UK / Europe",
      "Middle East"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "pwc|openai",
    "partnerId": "pwc",
    "partnerName": "PwC",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Cybersecurity"
    ],
    "regions": [
      "United States",
      "UK / Europe",
      "Middle East"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": {
      "relationship": "First ChatGPT Enterprise reseller",
      "summary": "ChatPwC deployed to staff worldwide, and PwC is OpenAI’s first ChatGPT Enterprise reseller: one of the largest single ChatGPT Enterprise footprints.",
      "proofPoints": [
        {
          "label": "Users",
          "value": "~200,000 ChatPwC users worldwide"
        },
        {
          "label": "Channel",
          "value": "First ChatGPT Enterprise reseller"
        }
      ],
      "publisher": "CIO Dive",
      "url": "https://www.ciodive.com/news/pwc-chatgpt-enterprise-openai-partnership/717432/",
      "asOf": "2024 – 2025",
      "evidence": "verified"
    }
  },
  {
    "key": "sopra-steria|mistral",
    "partnerId": "sopra-steria",
    "partnerName": "Sopra Steria",
    "partnerKind": "regional_si",
    "platformHybrid": false,
    "vendorId": "mistral",
    "vendorName": "Mistral",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Public sector"
    ],
    "regions": [
      "France / Western Europe"
    ],
    "areas": [
      "European sovereign AI",
      "Industrial AI",
      "Regulated enterprise AI",
      "Secure large-scale deployment"
    ],
    "spotlight": null
  },
  {
    "key": "tcs|anthropic",
    "partnerId": "tcs",
    "partnerName": "TCS",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "tier": "observed_implementer",
    "evidence": "moderate",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services"
    ],
    "regions": [
      "India"
    ],
    "areas": [
      "Regulated enterprise AI",
      "Financial services",
      "Tax/legal/advisory workflows",
      "Cybersecurity",
      "Mission-critical systems",
      "PE & knowledge work"
    ],
    "spotlight": null
  },
  {
    "key": "tcs|google",
    "partnerId": "tcs",
    "partnerName": "TCS",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "google",
    "vendorName": "Google",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services",
      "Manufacturing & industrial"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Gemini Enterprise",
      "Agentic enterprise workflows",
      "Sector-specific AI agents",
      "Finance close",
      "Life sciences",
      "Software engineering",
      "Sovereign/distributed cloud"
    ],
    "spotlight": null
  },
  {
    "key": "tcs|meta",
    "partnerId": "tcs",
    "partnerName": "TCS",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "meta",
    "vendorName": "Meta",
    "tier": "observed_implementer",
    "evidence": "plausible_unverified",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial"
    ],
    "regions": [],
    "areas": [
      "Custom enterprise models",
      "Private/sovereign AI",
      "Open-weight deployment",
      "Hybrid cloud / on-prem"
    ],
    "spotlight": null
  },
  {
    "key": "tcs|microsoft",
    "partnerId": "tcs",
    "partnerName": "TCS",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering",
      "Financial services",
      "Manufacturing & industrial"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": {
      "relationship": "Copilot rollout",
      "summary": "~50k Copilot seats (rising past 100k), part of a 300k+ upskilling wave across the Indian GSI cohort.",
      "proofPoints": [
        {
          "label": "Seats",
          "value": "~50,000 Copilot seats (→ 100,000+)"
        },
        {
          "label": "Cohort",
          "value": "300,000+ upskilled across Infosys + TCS + Wipro (collective)"
        }
      ],
      "publisher": "Microsoft Source Asia",
      "url": "https://news.microsoft.com/source/asia/2026/06/03",
      "asOf": "Jun 2026",
      "evidence": "partial"
    }
  },
  {
    "key": "tcs|openai",
    "partnerId": "tcs",
    "partnerName": "TCS",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Software engineering"
    ],
    "regions": [
      "India",
      "Middle East"
    ],
    "areas": [
      "Agentic enterprise workflows",
      "Software engineering (Codex)",
      "Public sector AI",
      "Cybersecurity",
      "Enterprise productivity"
    ],
    "spotlight": null
  },
  {
    "key": "wipro|microsoft",
    "partnerId": "wipro",
    "partnerName": "Wipro",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "cloud_certified",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial"
    ],
    "regions": [
      "India"
    ],
    "areas": [
      "Microsoft 365 Copilot",
      "Enterprise productivity",
      "Digital workplace",
      "Software engineering",
      "Manufacturing/factory intelligence",
      "Agentic workflows"
    ],
    "spotlight": null
  },
  {
    "key": "ey|microsoft",
    "partnerId": "ey",
    "partnerName": "EY",
    "partnerKind": "strategy_consultancy",
    "platformHybrid": false,
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Financial services",
      "Public sector",
      "Software engineering"
    ],
    "regions": [
      "United States",
      "UK / Europe"
    ],
    "areas": [
      "Copilot at scale",
      "Tax/legal/advisory workflows",
      "Knowledge work"
    ],
    "portedFromMarkup": true,
    "spotlight": {
      "relationship": "$1B Copilot alliance",
      "summary": "A $1B, five-year alliance extending Microsoft Copilot across EY's entire ~400,000 workforce; EY was named a Microsoft Partner of the Year (regional).",
      "proofPoints": [
        {
          "label": "Investment",
          "value": "$1B over 5 years"
        },
        {
          "label": "Reach",
          "value": "Copilot licensed to ~400,000 workforce (150k already live, ~15% productivity gain)"
        },
        {
          "label": "Recognition",
          "value": "Microsoft Partner of the Year (regional)"
        }
      ],
      "publisher": "Microsoft Source",
      "url": "https://news.microsoft.com/source/",
      "asOf": "May 2026",
      "evidence": "verified"
    }
  },
  {
    "key": "capgemini|mistral",
    "partnerId": "capgemini",
    "partnerName": "Capgemini",
    "partnerKind": "global_si",
    "platformHybrid": false,
    "vendorId": "mistral",
    "vendorName": "Mistral",
    "tier": "direct_named",
    "evidence": "strong",
    "encroachment": false,
    "industries": [
      "Manufacturing & industrial",
      "Public sector",
      "Financial services"
    ],
    "regions": [
      "France / Western Europe",
      "UK / Europe"
    ],
    "areas": [
      "Sovereign EU deployment",
      "Regulated enterprise AI",
      "Industrial AI"
    ],
    "portedFromMarkup": true,
    "spotlight": {
      "relationship": "Sovereign-EU delivery (RAISE)",
      "summary": "Capgemini's RAISE platform runs on Mistral for sovereign European deployment; the marquee industrial anchor in the ecosystem is Airbus × Mistral, with Capgemini as an ecosystem partner.",
      "proofPoints": [
        {
          "label": "Platform",
          "value": "RAISE: Mistral-powered, sovereign EU deployment"
        },
        {
          "label": "Industrial anchor",
          "value": "Airbus × Mistral (Capgemini as ecosystem partner)"
        }
      ],
      "publisher": "Capgemini",
      "url": "https://www.capgemini.com/news/press-releases/",
      "asOf": "2026",
      "evidence": "verified"
    }
  }
];

export const ALLIANCE_VENTURES: AllianceVenture[] = [
  {
    "id": "openai-deployment-company",
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "title": "The OpenAI Deployment Company",
    "summary": "A PE-backed venture that embeds forward-deployed engineers to stand OpenAI up inside enterprises: OpenAI building its own delivery arm rather than leaning only on the GSIs.",
    "proofPoints": [
      {
        "label": "Capital raised",
        "value": "$$4B+ from 19 investors (TPG, Brookfield, Advent, Bain, SoftBank, Dragoneer)"
      },
      {
        "label": "Valuation",
        "value": "~$10B"
      },
      {
        "label": "Model",
        "value": "Embedded forward-deployed engineers; acquired Tomoro (~150 FDEs)"
      }
    ],
    "publisher": "OpenAI",
    "url": "https://openai.com/index/openai-launches-the-deployment-company/",
    "asOf": "Oct 2026",
    "evidence": "verified"
  },
  {
    "id": "anthropic-enterprise-services-jv",
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "title": "Anthropic × Goldman Sachs, Blackstone & Hellman & Friedman JV",
    "summary": "A $1.5B enterprise-AI-services joint venture (each backer ~$300M) targeting mid-size and PE-owned firms: capital-backed Claude delivery aimed at the mid-market.",
    "proofPoints": [
      {
        "label": "Size",
        "value": "$$1.5B JV (~$300M each backer)"
      },
      {
        "label": "Backers",
        "value": "Goldman Sachs, Blackstone, Hellman & Friedman"
      },
      {
        "label": "Target",
        "value": "Mid-size / PE-owned enterprises"
      }
    ],
    "publisher": "CNBC",
    "url": "https://www.cnbc.com/2026/05/04/anthropic-goldman-blackstone-ai-venture.html",
    "asOf": "May 2026",
    "evidence": "verified"
  }
];

export const VENDOR_COVERAGE: { vendorId: string; vendorName: string; count: number }[] = [
  {
    "vendorId": "google",
    "vendorName": "Google",
    "count": 11
  },
  {
    "vendorId": "openai",
    "vendorName": "OpenAI",
    "count": 10
  },
  {
    "vendorId": "anthropic",
    "vendorName": "Anthropic",
    "count": 8
  },
  {
    "vendorId": "microsoft",
    "vendorName": "Microsoft",
    "count": 9
  },
  {
    "vendorId": "meta",
    "vendorName": "Meta",
    "count": 5
  },
  {
    "vendorId": "cohere",
    "vendorName": "Cohere",
    "count": 4
  },
  {
    "vendorId": "mistral",
    "vendorName": "Mistral",
    "count": 3
  },
  {
    "vendorId": "ibm",
    "vendorName": "IBM",
    "count": 1
  }
];
