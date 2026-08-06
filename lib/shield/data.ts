// The Privacy & IP Shield ledger.
//
// ORIGIN. Ported 5 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/shield-data.ts, at commit b9bb51c),
// which is read-only from here and was not modified. The marks, the quoted
// wording, the source URLs and the verification date are carried across
// unchanged. Two things were adapted for this repository: the editorial
// sentences around each quotation were repunctuated to hold the house
// no-em-dash rule, and the vendor slugs are mapped to AI Enterprise vendor ids
// in ./vendor-map.ts so a reader's shortlist can be marked. Every span inside
// curly quotes is the vendor's own wording and is byte-identical to the
// source; tests/shield-quotes.test.ts asserts that and will fail if a quote is
// ever edited.
//
// WHAT THIS IS. Curated, cited reference data. Every mark below was verified
// against the vendor's own published document on the date stamped:
//   protective  a protective fact, verified in the vendor's own words
//   conditional protection exists but is gated (approval, mitigations, tier)
//   adverse     a verified fact that works against the customer
//   unverified  we could not verify a receipt yet, shown "not established",
//               and scoring zero
//
// The enterprise or paid tier is the one graded, because that is the buyer's
// real context, and free-tier caveats are noted in the mark. Nothing is
// inferred beyond the quoted document. A deep-fill pass on 14 July 2026 closed
// most gaps. A handful of enterprise trust centres (Anthropic zero-retention
// and residency, OpenAI Copyright Shield, Google Vertex residency) are
// JavaScript-gated to automated fetch and stay unverified until a human checks
// them in a browser. That is an honest gap in our receipts, not a verdict on
// the vendor.

export const SHIELD_VERSION = "2026-07-14b";

/** The commit in the source repository this ledger was read from. */
export const SHIELD_ORIGIN = {
  repo: "the-desk",
  path: "lib/shield-data.ts",
  commit: "b9bb51c",
  portedOn: "2026-08-05",
} as const;

export type MarkState =
  | "protective"
  | "conditional"
  | "adverse"
  | "unverified";

export interface Mark {
  state: MarkState;
  note: string;
  source?: { name: string; url: string };
}

export interface VendorShield {
  vendor: string;
  slug: string;
  kind: "hosted-api" | "open-weights";
  marks: {
    training: Mark;
    retention: Mark;
    indemnity: Mark;
    residency: Mark;
  };
}

const V = "verified 2026-07-14";

// SCOPE: model providers only, the labs whose own terms govern your IP. Cloud
// hosts that merely resell these models (Azure OpenAI, AWS Bedrock) are a
// dependency question and belong on the Ecosystem Navigator, not here.
export const SHIELD: VendorShield[] = [
  {
    vendor: "OpenAI (API)",
    slug: "openai-api",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in).”",
        source: {
          name: `OpenAI · API data controls (${V})`,
          url: "https://developers.openai.com/api/docs/guides/your-data",
        },
      },
      retention: {
        state: "protective",
        note: "Abuse logs retained ≤30 days “unless longer retention is required by law”; Zero Data Retention offered for eligible customers.",
        source: {
          name: `OpenAI · API data controls (${V})`,
          url: "https://developers.openai.com/api/docs/guides/your-data",
        },
      },
      indemnity: {
        state: "conditional",
        note: "Copyright Shield: OpenAI “can defend our customers and pay the costs … around copyright infringement … both to ChatGPT Enterprise and the API”, on paid tiers only, with carve-outs and a cap of roughly the prior 12 months' fees. OpenAI's own business-terms page returns 403 to us, so this rests on Proskauer's legal analysis.",
        source: {
          name: `Proskauer · analysis of OpenAI Copyright Shield (${V})`,
          url: "https://www.proskauer.com/blog/openais-copyright-shield-broadens-user-ip-indemnities-for-ai-created-content",
        },
      },
      residency: {
        state: "protective",
        note: "Regional storage incl. Europe/EEA, UK, Japan, Australia, Canada, India, Singapore, South Korea, UAE (some options approval-gated).",
        source: {
          name: `OpenAI · API data controls (${V})`,
          url: "https://developers.openai.com/api/docs/guides/your-data",
        },
      },
    },
  },
  {
    vendor: "Anthropic (API)",
    slug: "anthropic-api",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Anthropic may not train models on Customer Content from Services.” (Commercial Terms §B)",
        source: {
          name: `Anthropic · Commercial Terms (${V})`,
          url: "https://www.anthropic.com/legal/commercial-terms",
        },
      },
      retention: {
        state: "protective",
        note: "“Conversation content (your prompts and Claude's outputs) is not retained by default”; Zero Data Retention (on request) stores nothing at rest after the response. Flagged or legal-hold content may be kept up to 2 years.",
        source: {
          name: `Anthropic · API & data retention (${V})`,
          url: "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention",
        },
      },
      indemnity: {
        state: "protective",
        note: "“Anthropic will defend Customer … alleging that Customer's paid use of the Services … or Outputs … violates any third-party intellectual property right.” (carve-outs in §K.3).",
        source: {
          name: `Anthropic · Commercial Terms (${V})`,
          url: "https://www.anthropic.com/legal/commercial-terms",
        },
      },
      residency: {
        state: "protective",
        note: "The Claude API offers a data-residency control (the `inference_geo` parameter on /v1/messages), so you pin where inference runs. Zero-retention and HIPAA eligible.",
        source: {
          name: `Anthropic · API data residency (${V})`,
          url: "https://platform.claude.com/docs/en/manage-claude/data-residency",
        },
      },
    },
  },
  {
    vendor: "Google (Gemini)",
    slug: "google-gemini",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "Paid Gemini for Google Cloud / Vertex: “Gemini doesn't use your prompts or its responses as data to train its models.” The free consumer tier does train.",
        source: {
          name: `Google · Gemini data governance (${V})`,
          url: "https://docs.cloud.google.com/gemini/docs/discover/data-governance",
        },
      },
      retention: {
        state: "conditional",
        note: "Paid logs “retained for limited periods” for security and policy enforcement; a default caching window can be disabled. No customer-set zero-retention verified this pass.",
        source: {
          name: `Google · Gemini API terms (${V})`,
          url: "https://ai.google.dev/gemini-api/terms",
        },
      },
      indemnity: {
        state: "protective",
        note: "“Our indemnity obligations now also apply to allegations that generated output infringes a third party's intellectual property rights … including copyright”, conditioned on responsible-AI practices, on GA models.",
        source: {
          name: `Google Cloud · GenAI indemnification (${V})`,
          url: "https://cloud.google.com/blog/products/ai-machine-learning/protecting-customers-with-generative-ai-indemnification",
        },
      },
      residency: {
        state: "protective",
        note: "“We commit to storing customer data in customer-selected locations …”; “Customers control where and how data and models are stored … preventing deployments outside specified geographic boundaries.” Regions incl. US, Canada, NL, FR, UK, DE, BE, Japan, Singapore, Korea.",
        source: {
          name: `Google Cloud · GenAI data-residency guarantees (${V})`,
          url: "https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-generative-ai-data-residency-guarantees-for-data-stored-at-rest",
        },
      },
    },
  },
  {
    vendor: "Mistral (La Plateforme)",
    slug: "mistral-la-plateforme",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "Paid: “Mistral AI will not use Customer Data or Outputs to train its … models”, except free and Vibe tiers where you have not opted out (Commercial Terms §4.2). The free tier trains by default.",
        source: {
          name: `Mistral · Commercial Terms (${V})`,
          url: "https://legal.mistral.ai/terms/commercial-terms-of-service",
        },
      },
      retention: {
        state: "conditional",
        note: "Default 30-day retention, deleted after; Zero Data Retention exists but only on the Scale plan and stateless endpoints, not Vibe, Chat or agents.",
        source: {
          name: `Mistral · DPA (${V})`,
          url: "https://legal.mistral.ai/terms/data-processing-addendum",
        },
      },
      indemnity: {
        state: "conditional",
        note: "Indemnity covers the Products' IP (§8.1). Model Outputs are not expressly indemnified, and a carve-out excludes modified Outputs (§8.2b).",
        source: {
          name: `Mistral · Commercial Terms (${V})`,
          url: "https://legal.mistral.ai/terms/commercial-terms-of-service",
        },
      },
      residency: {
        state: "protective",
        note: "“By default, your data is hosted in the European Union.” A US endpoint is available by explicit opt-in.",
        source: {
          name: `Mistral · Help Center · data storage (${V})`,
          url: "https://help.mistral.ai/en/articles/347629",
        },
      },
    },
  },
  {
    vendor: "Meta (Llama, self-hosted)",
    slug: "meta-llama",
    kind: "open-weights",
    marks: {
      training: {
        state: "protective",
        note: "Structural: the open-weight license grants use, reproduce and modify, and self-hosted prompts never transit Meta at all, so provider-side training is impossible by construction.",
        source: {
          name: `Llama 4 Community License (${V})`,
          url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE",
        },
      },
      retention: {
        state: "protective",
        note: "Structural: you host it, so there is nothing for Meta to retain. Zero-retention by construction.",
        source: {
          name: `Llama 4 Community License (${V})`,
          url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE",
        },
      },
      indemnity: {
        state: "adverse",
        note: "“AS IS … WITHOUT WARRANTIES OF ANY KIND” incl. non-infringement, and the licensee indemnifies META, which is the reverse of a vendor IP shield.",
        source: {
          name: `Llama 4 Community License (${V})`,
          url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE",
        },
      },
      residency: {
        state: "protective",
        note: "Structural: runs wherever you run it, so you alone choose the region. License gate: products over 700M monthly active users need a separate Meta licence.",
        source: {
          name: `Llama 4 Community License (${V})`,
          url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE",
        },
      },
    },
  },
  {
    vendor: "DeepSeek",
    slug: "deepseek",
    kind: "hosted-api",
    marks: {
      training: {
        state: "adverse",
        note: "Trains by default: input used “to train and improve our technology, such as our machine learning models.” An opt-out exists, but training is the default.",
        source: {
          name: `DeepSeek · Privacy Policy (${V})`,
          url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html",
        },
      },
      retention: {
        state: "adverse",
        note: "“We retain Personal Data for as long as necessary…”, so no fixed window and no zero-retention control.",
        source: {
          name: `DeepSeek · Privacy Policy (${V})`,
          url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html",
        },
      },
      indemnity: {
        state: "adverse",
        note: "Verified absence: no output IP indemnity, warranty, or ownership language anywhere in the published policy. None offered, rather than a gap in our receipts.",
        source: {
          name: `DeepSeek · Privacy Policy (${V})`,
          url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html",
        },
      },
      residency: {
        state: "adverse",
        note: "“We directly collect, process and store your Personal Data in People's Republic of China”, regardless of where you are, with no choice offered. A hard stop for many regulated enterprises.",
        source: {
          name: `DeepSeek · Privacy Policy (${V})`,
          url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html",
        },
      },
    },
  },
  {
    vendor: "Cohere",
    slug: "cohere",
    kind: "hosted-api",
    marks: {
      training: {
        state: "conditional",
        note: "“You can opt out from your prompts and generations being used to train Cohere models … at any time.” Opt-out available, but not off by default.",
        source: {
          name: `Cohere · Enterprise Data Commitments (${V})`,
          url: "https://cohere.com/enterprise-data-commitments",
        },
      },
      retention: {
        state: "protective",
        note: "“We automatically delete logged prompts and generations after 30 days …”; Zero Data Retention (“we do not log any prompts or generations”) available on request.",
        source: {
          name: `Cohere · Enterprise Data Commitments (${V})`,
          url: "https://cohere.com/enterprise-data-commitments",
        },
      },
      indemnity: {
        state: "protective",
        note: "SaaS §11(e) Copyright Assurance: “Cohere will defend, indemnify and hold harmless the Customer … against … Claims by a third party alleging that any Output infringes … any copyright rights.”",
        source: {
          name: `Cohere · SaaS Agreement (${V})`,
          url: "https://cohere.com/saas-agreement",
        },
      },
      residency: {
        state: "protective",
        note: "“Deploy through your virtual private cloud (VPC), on-premises setup, or dedicated, Cohere-managed Model Vault”, so it runs on any cloud (OCI, Azure, AWS, Google) and data stays in your region. SOC 2 Type II.",
        source: {
          name: `Cohere · Security (${V})`,
          url: "https://cohere.com/security",
        },
      },
    },
  },
  {
    vendor: "xAI (Grok)",
    slug: "xai-grok",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“xAI never trains on your API inputs or outputs without your explicit permission.”",
        source: {
          name: `xAI · API Security FAQ (${V})`,
          url: "https://docs.x.ai/docs/resources/faq-api/security",
        },
      },
      retention: {
        state: "protective",
        note: "“API requests and responses are temporarily stored on our servers for 30 days …”; Zero Data Retention available for enterprise accounts.",
        source: {
          name: `xAI · API Security FAQ (${V})`,
          url: "https://docs.x.ai/docs/resources/faq-api/security",
        },
      },
      indemnity: {
        state: "unverified",
        note: "Enterprise terms and DPA (x.ai/legal/*) return 403 to our verifier, and the only reachable consumer ToS runs indemnity from user to xAI. No customer output indemnity fetched.",
      },
      residency: {
        state: "unverified",
        note: "x.ai/legal enterprise terms and DPA blocked (403). No verbatim API residency statement fetched this pass.",
      },
    },
  },
  {
    vendor: "AI21 (Jamba)",
    slug: "ai21-jamba",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“AI21 will not train AI21 Models on Customer Content.” (Terms §7.8, with an “unless agreed otherwise in writing” carve-out.)",
        source: {
          name: `AI21 · Terms of Use (${V})`,
          url: "https://www.ai21.com/terms-policies/terms-of-use/",
        },
      },
      retention: {
        state: "conditional",
        note: "Deletion is post-termination, after the retrieval-right period (§13.5). No fixed short window and no zero-retention option documented.",
        source: {
          name: `AI21 · Terms of Use (${V})`,
          url: "https://www.ai21.com/terms-policies/terms-of-use/",
        },
      },
      indemnity: {
        state: "conditional",
        note: "You own the Output (§7.2), and AI21 indemnifies claims that authorised use of the System or Model infringes copyright or patent (§12.1). That is not an explicit output-IP indemnity.",
        source: {
          name: `AI21 · Terms of Use (${V})`,
          url: "https://www.ai21.com/terms-policies/terms-of-use/",
        },
      },
      residency: {
        state: "conditional",
        note: "Content “may be hosted and processed … in Israel, the United States, the EEA, the United Kingdom, and other locations” (§7.3), with a specific region available only via Order.",
        source: {
          name: `AI21 · Terms of Use (${V})`,
          url: "https://www.ai21.com/terms-policies/terms-of-use/",
        },
      },
    },
  },
  {
    vendor: "IBM (Granite)",
    slug: "ibm-granite",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "IBM does not use client content or model outputs to train its foundation models; “Clients can develop AI applications using their own data along with the client protections.”",
        source: {
          name: `IBM · watsonx client protections (${V})`,
          url: "https://newsroom.ibm.com/2023-09-28-IBM-Announces-Availability-of-watsonx-Granite-Model-Series,-Client-Protections-for-IBM-watsonx-Models",
        },
      },
      retention: {
        state: "unverified",
        note: "watsonx trust and FAQ docs render as JavaScript shells or return 403. No verbatim retention window fetched.",
      },
      indemnity: {
        state: "protective",
        note: "“IBM provides an IP indemnity (contractual protection) for its foundation models”, uncapped for IBM-developed models, and IBM does not require customers to indemnify IBM.",
        source: {
          name: `IBM · watsonx client protections (${V})`,
          url: "https://newsroom.ibm.com/2023-09-28-IBM-Announces-Availability-of-watsonx-Granite-Model-Series,-Client-Protections-for-IBM-watsonx-Models",
        },
      },
      residency: {
        state: "unverified",
        note: "watsonx runs on selectable IBM Cloud regions, but the product and region pages returned 403 or JavaScript only. No verbatim residency quote fetched.",
      },
    },
  },
  {
    vendor: "Alibaba (Qwen)",
    slug: "alibaba-qwen",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Alibaba Cloud strictly protects data privacy and never uses your data for model training.”",
        source: {
          name: `Alibaba Cloud · Model Studio FAQ (${V})`,
          url: "https://www.alibabacloud.com/help/en/model-studio/faq-about-alibaba-cloud-model-studio",
        },
      },
      retention: {
        state: "protective",
        note: "Inference is transient: “transient data is not persisted … Your static data always remains in the selected region.”",
        source: {
          name: `Alibaba Cloud · Model Studio regions (${V})`,
          url: "https://www.alibabacloud.com/help/en/model-studio/regions/",
        },
      },
      indemnity: {
        state: "unverified",
        note: "The Model Studio master Terms of Service was not retrievable in quotable form, and output indemnity is not addressed on the FAQ. No receipt, so no mark.",
      },
      residency: {
        state: "protective",
        note: "International region hosts in Singapore: “Data must not pass through the Chinese mainland” and “static data always remains in the selected region.” ⚠ Chinese-parented (Alibaba), which is a sovereignty consideration despite the documented Singapore hosting.",
        source: {
          name: `Alibaba Cloud · Model Studio regions (${V})`,
          url: "https://www.alibabacloud.com/help/en/model-studio/regions/",
        },
      },
    },
  },
  {
    vendor: "Z.ai (GLM)",
    slug: "zai-glm",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "DPA: “The Company do not store any of the content the Customer or its End Users provide or generate while using our Services”, and API content is not used to train.",
        source: {
          name: `Z.ai · Privacy / DPA (${V})`,
          url: "https://docs.z.ai/legal-agreement/privacy-policy",
        },
      },
      retention: {
        state: "protective",
        note: "“This information is processed in real-time … and is not saved on our servers.” Real-time only for API content.",
        source: {
          name: `Z.ai · Privacy / DPA (${V})`,
          url: "https://docs.z.ai/legal-agreement/privacy-policy",
        },
      },
      indemnity: {
        state: "adverse",
        note: "Verified absence: the privacy policy and DPA contain no output IP indemnity, warranty, or ownership language. None offered, rather than a gap in our receipts.",
        source: {
          name: `Z.ai · Privacy / DPA (${V})`,
          url: "https://docs.z.ai/legal-agreement/privacy-policy",
        },
      },
      residency: {
        state: "conditional",
        note: "“We generally provide the Services from Singapore” (entity registered in Singapore). ⚠ Chinese-parented (Zhipu), which is a PRC-sovereignty consideration despite the documented Singapore hosting.",
        source: {
          name: `Z.ai · Privacy / DPA (${V})`,
          url: "https://docs.z.ai/legal-agreement/privacy-policy",
        },
      },
    },
  },
  {
    vendor: "Moonshot (Kimi)",
    slug: "moonshot-kimi",
    kind: "hosted-api",
    marks: {
      training: {
        state: "adverse",
        note: "Uses inputs to improve and train: “This includes training and refining our underlying technology.” No opt-out documented, so training is the default.",
        source: {
          name: `Moonshot · Kimi privacy (${V})`,
          url: "https://platform.kimi.ai/docs/agreement/userprivacy",
        },
      },
      retention: {
        state: "adverse",
        note: "“Account, input, and payment information are retained while your account is active”, so no fixed window and no zero-retention option.",
        source: {
          name: `Moonshot · Kimi privacy (${V})`,
          url: "https://platform.kimi.ai/docs/agreement/userprivacy",
        },
      },
      indemnity: {
        state: "adverse",
        note: "Verified absence: no output IP indemnity, warranty, or ownership language in the published policy. None offered, rather than a gap in our receipts.",
        source: {
          name: `Moonshot · Kimi privacy (${V})`,
          url: "https://platform.kimi.ai/docs/agreement/userprivacy",
        },
      },
      residency: {
        state: "conditional",
        note: "“We store the information we collect in secure servers located in Singapore.” ⚠ Chinese-parented (Moonshot AI, Beijing), which is a sovereignty consideration despite the documented Singapore servers.",
        source: {
          name: `Moonshot · Kimi privacy (${V})`,
          url: "https://platform.kimi.ai/docs/agreement/userprivacy",
        },
      },
    },
  },
  {
    vendor: "Reka",
    slug: "reka",
    kind: "hosted-api",
    marks: {
      training: {
        state: "conditional",
        note: "Paid requests are not used for training unless you opt in. The free tier trains by default: “Reka may use Your Content to train … its machine learning models.”",
        source: {
          name: `Reka · Terms of Use (${V})`,
          url: "https://reka.ai/legal/terms-of-use",
        },
      },
      retention: {
        state: "unverified",
        note: "“Reka has no obligation to store any of Your Content” is a convenience disclaimer, not a documented zero-retention commitment. No receipt for a retention control.",
      },
      indemnity: {
        state: "adverse",
        note: "“Reka does not represent or warrant that you are the legal owner of the Output … You shall be solely responsible.” No output indemnity, so the risk sits with you.",
        source: {
          name: `Reka · Terms of Use (${V})`,
          url: "https://reka.ai/legal/terms-of-use",
        },
      },
      residency: {
        state: "conditional",
        note: "“The Services are controlled and offered by Reka from its facilities in the United States”, so it is US-hosted, with a single region disclosed and no explicit residency commitment.",
        source: {
          name: `Reka · Terms of Use (${V})`,
          url: "https://reka.ai/legal/terms-of-use",
        },
      },
    },
  },
];

/** Transparent scoring: protective 1, conditional 0.5, adverse and unverified 0.
 *  Unverified deliberately scores zero, because under-claiming beats
 *  over-claiming when the receipt is missing. */
export function shieldScore(v: VendorShield): number {
  const w: Record<MarkState, number> = {
    protective: 1,
    conditional: 0.5,
    adverse: 0,
    unverified: 0,
  };
  const m = v.marks;
  return (
    w[m.training.state] +
    w[m.retention.state] +
    w[m.indemnity.state] +
    w[m.residency.state]
  );
}

/** How many of the four marks carry a determination, as against a blank gap.
 *  A 2.0 built from two adverse marks (4 of 4 verified) is a different fact
 *  from a 2.0 with two blanks (2 of 4), and this lets the screen say which. */
export function shieldCoverage(v: VendorShield): number {
  const m = v.marks;
  return [m.training, m.retention, m.indemnity, m.residency].filter(
    (x) => x.state !== "unverified"
  ).length;
}

/** Ranked view: score descending, ties alphabetical. Stated, boring, and
 *  un-gameable. */
export function rankedShield(): (VendorShield & { score: number })[] {
  return SHIELD.map((v) => ({ ...v, score: shieldScore(v) })).sort(
    (a, b) => b.score - a.score || a.vendor.localeCompare(b.vendor)
  );
}

// Buyer-weighted Trust Rank.
//
// The fixed ranking above treats every mark equally. A real buyer does not: a
// healthcare CIO may not care about output indemnity at all while treating
// residency as a hard requirement. This re-weights the SAME verified marks,
// never a different fact, only a different priority.
export type ShieldDim = "training" | "retention" | "indemnity" | "residency";
export type ShieldWeights = Record<ShieldDim, number>;

/** Equal weights, reproducing the fixed rankedShield() order exactly. */
export const DEFAULT_SHIELD_WEIGHTS: ShieldWeights = {
  training: 1,
  retention: 1,
  indemnity: 1,
  residency: 1,
};

export const SHIELD_DIM_INFO: {
  key: ShieldDim;
  label: string;
  blurb: string;
}[] = [
  {
    key: "training",
    label: "Will not train on our data",
    blurb: "Keeps your prompts and outputs out of the model.",
  },
  {
    key: "retention",
    label: "Retention / zero-retention",
    blurb: "How long, and whether, your data is stored.",
  },
  {
    key: "indemnity",
    label: "Output IP indemnity",
    blurb: "Vendor defends you on third-party IP claims.",
  },
  {
    key: "residency",
    label: "Data residency",
    blurb: "Where your data is processed and stored.",
  },
];

const MARK_WEIGHT: Record<MarkState, number> = {
  protective: 1,
  conditional: 0.5,
  adverse: 0,
  unverified: 0,
};

/** Score a vendor under buyer-supplied dimension weights. Same marks, same
 *  0 / 0.5 / 1 per-mark scale. Only the dimension weights change. */
export function shieldScoreWeighted(
  v: VendorShield,
  weights: ShieldWeights
): number {
  const m = v.marks;
  return (
    weights.training * MARK_WEIGHT[m.training.state] +
    weights.retention * MARK_WEIGHT[m.retention.state] +
    weights.indemnity * MARK_WEIGHT[m.indemnity.state] +
    weights.residency * MARK_WEIGHT[m.residency.state]
  );
}

/** Ranked under buyer weights. `max` is the total achievable score for THIS
 *  weight set, so a bar always reads relative to what is possible. */
export function rankedShieldWeighted(
  weights: ShieldWeights
): (VendorShield & { score: number; max: number })[] {
  const max =
    weights.training + weights.retention + weights.indemnity + weights.residency;
  return SHIELD.map((v) => ({
    ...v,
    score: Math.round(shieldScoreWeighted(v, weights) * 100) / 100,
    max,
  })).sort((a, b) => b.score - a.score || a.vendor.localeCompare(b.vendor));
}
