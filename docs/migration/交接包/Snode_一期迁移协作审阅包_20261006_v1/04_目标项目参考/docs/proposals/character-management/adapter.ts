import type { Lifecycle, ManagementEdit, ManagementView, ProfileField, ValidationResult } from "./contracts.ts";

/**
 * Shared CharacterData is supplied by the model workstream.
 * Implementations validate document id/versions/references and apply registered edits immutably.
 * This proposal intentionally defines no second full character model.
 */
export interface ProjectionMetadata {
  readonly characterId: string;
  readonly characterRevision: number;
  readonly lifecycle: Lifecycle;
}

/** Supplied by trusted service authorization, never by character JSON or a request. */
export interface ProjectionPolicy {
  readonly editableProfileFields: readonly ProfileField[];
  readonly editableNumericRefs: ReadonlySet<string>;
}

export interface CharacterDocumentAdapter<TSharedDocument> {
  validateDocument(input: unknown): ValidationResult<TSharedDocument>;
  toManagementView(document: TSharedDocument, metadata: ProjectionMetadata, policy: ProjectionPolicy): ManagementView;
  applyRegisteredEdits(document: TSharedDocument, edits: readonly ManagementEdit[]): TSharedDocument;
}

/**
 * HTTP/server implementation must add verified identity, object/field authorization,
 * expected revision, atomic current/snapshot/audit/receipt, and idempotency coordination.
 * An editor context key is only a frontend async guard; it is not authentication.
 */
export interface ServerCommitContext {
  readonly verifiedUserId: string;
  readonly characterId: string;
  readonly expectedRevision: number;
  readonly commandId: string;
}

/**
 * Draft storage must version-check writes and cleanup/tombstones on the same scope/draft.
 * The editor's acknowledgement state alone cannot prevent a stale disk/network write.
 * Restore/discard and retention budgets are not implemented in this phase.
 */
export interface DraftStorageBoundary {
  readonly accountScope: string;
  readonly characterId: string;
  readonly draftId: string;
  readonly editorSessionId: string;
}
