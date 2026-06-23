export * from './okf/types.js';
export { parseOKF, serializeOKF } from './okf/document.js';
export { validateForRead, validateForWrite } from './okf/validator.js';
export {
  conceptIdToPath,
  isReservedFilename,
  parseConceptId,
  pathToConceptId,
  resolveLink,
  RESERVED_FILENAMES,
} from './okf/paths.js';
export { regenerateIndexes } from './okf/index-builder.js';
export { FsKnowledgeStore } from './adapters/fs-store.js';
export {
  createDraftBranchName,
  SimpleGitAdapter,
} from './adapters/simple-git.js';
export { fetchUrl, type FetchResult } from './adapters/fetch.js';
export { createSourceAdapter } from './adapters/source-registry.js';
export type {
  CreateSourceAdapterInput,
  GitAdapter,
  GitCommit,
  KnowledgeStore,
  SourceAdapter,
  SourceContent,
  SourceItem,
  SourceKind,
} from './adapters/types.js';
export {
  MemossError,
  OKFDocumentError,
  OKFValidationError,
  type ErrorCode,
} from './errors.js';

export const CORE_VERSION = '0.0.1';
