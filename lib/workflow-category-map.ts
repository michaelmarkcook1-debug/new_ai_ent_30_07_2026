// Workflow category to vendor market categories.
//
// Split out of lib/workflow-vendors.ts on 18 August 2026 so it can be read
// without dragging a server module along. That file also exports
// loadWorkflowVendorIndex(), which reaches lib/aie-server.ts and therefore
// `node:fs`; importing the map alone still pulled the whole graph in, and the
// production build failed with "Can't resolve 'fs'" the moment a client
// component wanted it. Typecheck and the test suite both passed: only
// `next build` sees this.
//
// Pure data, no imports, safe from either side of the boundary.

export const CATEGORY_MAP: Record<string, string[]> = {
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
}
