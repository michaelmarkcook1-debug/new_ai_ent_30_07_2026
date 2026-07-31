import { aieServerFetch, type AieLane } from "@/lib/aie-server";
import { MARKET_CATEGORY_LIST, vendorIdsInCategory } from "@/lib/comparability";

// Which vendors to shortlist for a given workflow.
//
// The datasets do not join these directly: vendors carry 36 coarse
// supportedUseCases ("CRM/customer AI"), the workflow library carries 146
// granular entries ("Customer Service Agent"), and the overlap between them is
// exactly zero. So picking a workflow produced a risk profile and no vendors,
// which is a dead end for the one question this product exists to answer.
//
// The bridge is the workflow's own category. That is an editorial mapping, not
// a dataset join, so it is declared here in full and shown on screen rather
// than buried: a reader can disagree with a row and see exactly what it did.
//
// Two tiers, because they are different purchases:
//   BUY   application and platform vendors that ship this workflow
//   BUILD frontier model providers you would build it on yourself
// Both are legitimate answers to "who should we shortlist", and collapsing
// them into one ranked list would compare a finished product with a raw model.

export interface WorkflowVendor {
  vendorId: string;
  name: string;
  category: string;
  marketCategoryId: string;
  marketCategoryName: string;
  score: number | null;
  marketPosition: string | null;
}

export interface WorkflowShortlist {
  /** Application and platform vendors that ship this kind of workflow. */
  buy: WorkflowVendor[];
  /** Model providers you would build it on. */
  build: WorkflowVendor[];
  /** The market categories the workflow category mapped to. */
  mappedCategories: { id: string; name: string }[];
  /** The workflow category the mapping keyed off. */
  workflowCategory: string | null;
  lane: AieLane;
}

// Workflow category to vendor market categories. Ordered most specific first,
// so the shortlist leads with vendors built for that job rather than with
// general-purpose platforms that could technically do it.
const CATEGORY_MAP: Record<string, string[]> = {
  Customer: ["crm_customer_ai", "agent_platform", "enterprise_assistant"],
  Revenue: ["crm_customer_ai", "enterprise_assistant", "agent_platform"],
  Engineering: ["developer_coding_agent", "agent_platform"],
  IT: ["itsm_hr_service_ai", "workflow_automation_ai", "agent_platform"],
  HR: ["itsm_hr_service_ai", "enterprise_assistant"],
  Legal: ["regulated_industry_ai", "rag_enterprise_search", "enterprise_assistant"],
  "Financial Services": ["regulated_industry_ai", "rag_enterprise_search"],
  Health: ["regulated_industry_ai", "rag_enterprise_search"],
  "Public Sector": [
    "regulated_industry_ai",
    "enterprise_assistant",
    "workflow_automation_ai",
  ],
  "Critical Infrastructure": ["regulated_industry_ai", "workflow_automation_ai"],
  Education: ["enterprise_assistant", "rag_enterprise_search"],
  Finance: ["workflow_automation_ai", "enterprise_assistant", "agent_platform"],
  Productivity: ["enterprise_assistant", "rag_enterprise_search"],
  Data: ["cloud_ai_platform", "agent_platform"],
  Operations: ["workflow_automation_ai", "agent_platform"],
  Manufacturing: ["workflow_automation_ai", "agent_platform"],
  "Enterprise Software": [
    "agent_platform",
    "workflow_automation_ai",
    "cloud_ai_platform",
  ],
  "AI Platform & Governance": [
    "cloud_ai_platform",
    "agent_platform",
    "frontier_model_api",
  ],
};

// The build tier is the same for every workflow: a frontier model can serve
// any of them, which is exactly why it is kept separate from the buy tier.
const BUILD_CATEGORY = "frontier_model_api";

const CATEGORY_NAME = new Map(
  MARKET_CATEGORY_LIST.map((c) => [c.id, c.name])
);

interface RawVendor {
  id: string;
  name: string;
  category: string;
  overallScore: number | null;
  marketPosition: string | null;
}

/** Every workflow category this mapping covers, for disclosure in the UI. */
export const WORKFLOW_CATEGORY_MAP = CATEGORY_MAP;

export async function loadWorkflowVendorIndex(): Promise<{
  byCategory: Record<string, WorkflowShortlist>;
  lane: AieLane;
}> {
  const res = await aieServerFetch<{ vendors: RawVendor[] }>("vendors");
  const vendors = new Map(
    (res.data?.vendors ?? []).map((v) => [v.id, v])
  );

  const resolve = (categoryIds: string[]): WorkflowVendor[] => {
    const seen = new Set<string>();
    const out: WorkflowVendor[] = [];
    for (const cid of categoryIds) {
      for (const vid of vendorIdsInCategory(cid)) {
        if (seen.has(vid)) continue;
        const v = vendors.get(vid);
        if (!v) continue;
        seen.add(vid);
        out.push({
          vendorId: vid,
          name: v.name,
          category: v.category,
          marketCategoryId: cid,
          marketCategoryName: CATEGORY_NAME.get(cid) ?? cid,
          score: v.overallScore ?? null,
          marketPosition: v.marketPosition ?? null,
        });
      }
    }
    // Strongest first, unscored last rather than treated as zero.
    return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  };

  const build = resolve([BUILD_CATEGORY]);
  const byCategory: Record<string, WorkflowShortlist> = {};

  for (const [workflowCategory, categoryIds] of Object.entries(CATEGORY_MAP)) {
    // The build tier is listed separately, so drop those vendors from buy to
    // avoid the same name appearing twice under two different arguments.
    const buildIds = new Set(build.map((v) => v.vendorId));
    byCategory[workflowCategory] = {
      buy: resolve(categoryIds).filter((v) => !buildIds.has(v.vendorId)),
      build,
      mappedCategories: categoryIds.map((id) => ({
        id,
        name: CATEGORY_NAME.get(id) ?? id,
      })),
      workflowCategory,
      lane: res.lane,
    };
  }

  return { byCategory, lane: res.lane };
}
