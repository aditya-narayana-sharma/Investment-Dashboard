/** Compatibility barrel. Chat/retrieve must import `app/satya/search.mjs`, not this file. */
export {
  clearSatyaIngestError,
  countSatyaDocuments,
  countSatyaDocumentsByFamily,
  getSatyaMeta,
  openSatyaCorpus,
  recordSatyaIngestError,
  resolveSatyaRepoRoot,
  satyaCatalogPath,
  satyaCorpusPath,
  setSatyaMeta,
  upsertSatyaDocument,
} from "./satya-store.mjs";
export {
  axisCategoryCountsFromCorpus,
  buildSatyaFtsQuery,
  catalogSeedsFromCorpus,
  listSatyaDocuments,
  satyaFtsContentTokens,
  searchSatyaCorpus,
} from "../app/satya/search.mjs";
export {
  ingestSatyaDigestRefresh,
  runSatyaBackfill,
  satyaBackfillWindow,
  writeSatyaCatalogSnapshot,
} from "./satya-ingest.mjs";
