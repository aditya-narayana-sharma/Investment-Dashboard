import type { AxisResearchCategoryId } from "../content-types";

export {
  AXIS_RESEARCH_CATEGORIES,
  AXIS_RESEARCH_CATEGORY_IDS,
  DEFAULT_RETRIEVE_AXIS_CATEGORIES,
  DEFAULT_RETRIEVE_AXIS_CATEGORY_IDS,
  RESULT_UPDATE_INTENT_CATEGORY_IDS,
  allowlistedAxisCategories,
  axisCategoryById,
  axisCategoryColorToken,
  axisCategoryLabel,
  classifyAxisCategory,
  isAxisResearchCategoryId,
  isAxisResultUpdatesIntent,
  isDefaultRetrieveAxisCategory,
  normalizeAxisSubject,
  parseAxisCategories,
  resolveAxisCategoryFilter,
  resolveResultUpdateRetrieval,
} from "./axis-categories.mjs";

export type { AxisResearchCategoryId };

export type AxisResearchCategory = {
  id: AxisResearchCategoryId;
  label: string;
  matchers: RegExp[];
  colorToken: string;
  defaultRetrieve: boolean;
};
