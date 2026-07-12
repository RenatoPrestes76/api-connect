export type AiOperation =
  | 'copilot_chat'
  | 'copilot_diagnose'
  | 'copilot_generate'
  | 'copilot_explain'
  | 'copilot_search'
  | 'workflow_plan'
  | 'workflow_optimize'
  | 'semantic_mapping'
  | 'auto_documentation'
  | 'marketplace_ai'
  | 'observatory_analysis';

export const AI_CREDIT_COSTS: Record<AiOperation, number> = {
  copilot_chat: 1,
  copilot_diagnose: 2,
  copilot_generate: 3,
  copilot_explain: 1,
  copilot_search: 1,
  workflow_plan: 5,
  workflow_optimize: 4,
  semantic_mapping: 3,
  auto_documentation: 2,
  marketplace_ai: 1,
  observatory_analysis: 2,
};

export function creditCost(operation: AiOperation): number {
  return AI_CREDIT_COSTS[operation];
}
