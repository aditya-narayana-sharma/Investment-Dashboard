/**
 * Client StrategyGraphV2 schema helpers + validator re-exports.
 * Canonical types live in `packages/contracts/src/strategy.ts` (schemaVersion "2").
 */
import type { StrategyGraphV2 } from "../../packages/contracts/src/strategy.ts";

export {
  ASSET_CLASSES,
  DEFAULT_ASSET_CLASSES,
  DEFAULT_INTERVAL,
  DEFAULT_KPI_WEIGHTAGE_PCT,
  STRATEGY_SCHEMA_VERSION,
  VALIDATION_ERR_TITLE,
  VALIDATION_OK_DETAIL,
  VALIDATION_OK_TITLE,
  VALIDATION_WARN_TITLE,
  clampWeightagePct,
  defaultNodeParams,
  filterInstrumentsByAssetClasses,
  filterSymbolsByAssetClasses,
  graphUniverseAssetClasses,
  inferAssetClassForSymbol,
  instrumentFilterFromAssetClasses,
  instrumentMatchesAssetClasses,
  instrumentMatchesFilter,
  instrumentTypeForAssetClass,
  isAssetClass,
  isAssetClassFilterEmpty,
  isComparatorOp,
  isEdgeKind,
  isLogicalOp,
  isNodeKind,
  kiteSeriesToAssetClass,
  normalizeAssetClasses,
  readWeightagePct,
  selectedInstrumentTypes,
  universeAssetClasses,
  type AlgorithmReferenceNodeParams,
  type AllocationNodeParams,
  type AssetClass,
  type CandleInterval,
  type ComparatorNodeParams,
  type ComparatorOp,
  type EdgeKind,
  type EmptyNodeParams,
  type ExchangeInstrumentType,
  type GraphValidation,
  type InstrumentFilter,
  type InstrumentType,
  type KpiNodeParams,
  type LogicalGroupNodeParams,
  type LogicalOp,
  type NodeKind,
  type NodeParamsByKind,
  type RebalanceNodeParams,
  type RiskLimitNodeParams,
  type StrategyEdge,
  type StrategyGraphV2,
  type StrategyNode,
  type UniverseNodeParams,
  type ValidationCode,
  type ValidationIssue,
  type ValidationSeverity,
} from "../../packages/contracts/src/strategy.ts";

export {
  STRATEGY_TREE_VERSION,
  TREE_BLOCK_KINDS,
  childNodesOf,
  cloneTree,
  collectTreeNodeIds,
  findTreeNode,
  isTreeBlockKind,
  isTreeOperand,
  isWeightMethod,
  parseStrategyTree,
  walkTreeNodes,
  type AnyAllNode,
  type AssetNode,
  type FilterNode,
  type GroupNode,
  type IfElseNode,
  type StrategyTreeV1,
  type TreeBlockKind,
  type TreeNode,
  type TreeOperand,
  type TreeValidation,
  type TreeValidationIssue,
  type WeightChild,
  type WeightMethod,
  type WeightNode,
} from "../../packages/contracts/src/strategy-tree.ts";

export { validateStrategyGraph } from "./validate";

export const SNAP_PX = 20;
export const UNDO_DEPTH = 50;

export function cloneGraph(graph: StrategyGraphV2): StrategyGraphV2 {
  return structuredClone(graph);
}
