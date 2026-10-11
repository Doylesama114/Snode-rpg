/**
 * Implementation 0 candidate contracts. Not exported from @snode/contracts.
 * ManagementView is a projection of the shared character document, not CharacterData.
 */
export type ProfileField = "displayName" | "story";
export type Lifecycle = "active" | "archived";

export interface NumericFieldView {
  readonly fieldRef: string;
  readonly label: string;
  readonly value: number | null;
  readonly editable: boolean;
}

export interface ManagementView {
  readonly viewSchemaVersion: 1;
  readonly characterId: string;
  readonly characterRevision: number;
  readonly lifecycle: Lifecycle;
  readonly profile: Readonly<{ displayName: string; story: string }>;
  readonly editableProfileFields: readonly ProfileField[];
  readonly numericFields: readonly NumericFieldView[];
}

export type ManagementEdit =
  | { readonly kind: "set-profile"; readonly field: ProfileField; readonly value: string }
  | { readonly kind: "set-number"; readonly fieldRef: string; readonly value: number }
  | { readonly kind: "clear-number"; readonly fieldRef: string };

export interface UpdateManagementCommand {
  readonly commandId: string;
  readonly characterId: string;
  readonly expectedRevision: number;
  readonly submittedDraftVersion: number;
  readonly edits: readonly ManagementEdit[];
}

export interface CommitReceipt {
  readonly commandId: string;
  readonly submittedDraftVersion: number;
  readonly view: ManagementView;
}

export interface ValidationIssue {
  readonly path: string;
  readonly code: "type" | "missing" | "unknown-field" | "invalid" | "duplicate";
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface RawInputs {
  readonly displayName: string;
  readonly story: string;
  readonly numbers: Readonly<Record<string, string>>;
}

export type NumberIntent =
  | { readonly kind: "set"; readonly raw: string; readonly value: number }
  | { readonly kind: "clear"; readonly raw: string }
  | { readonly kind: "invalid"; readonly raw: string };

export interface EditorIdentity {
  /** Local account/session scope. This is not server authentication. */
  readonly contextKey: string;
  readonly characterId: string;
  readonly draftId: string;
  readonly editorSessionId: string;
}

export interface OperationIdentity extends EditorIdentity {
  readonly epoch: number;
}

export interface LoadTicket extends OperationIdentity {
  readonly generation: number;
  readonly startedDraftVersion: number;
  readonly startedRevision: number | null;
}

export interface SaveTicket extends OperationIdentity {
  readonly submittedDraftVersion: number;
  readonly recoveryCheckpointVersion: number;
  readonly submittedInputs: RawInputs;
  readonly command: UpdateManagementCommand;
}

export interface RetentionTicket extends OperationIdentity {
  readonly draftVersion: number;
  readonly baseRevision: number;
  readonly baseView: ManagementView;
  readonly inputs: RawInputs;
  readonly commitState: CommitState;
  readonly inFlight: SaveTicket | null;
  readonly latestConflict: ManagementView | null;
}

export type CommitState = "idle" | "saving" | "failed" | "unknown" | "conflict";
export type RetentionState = "idle" | "pending" | "writing" | "retained" | "failed";

export interface EditorState {
  readonly identity: EditorIdentity;
  readonly epoch: number;
  readonly loadGeneration: number;
  readonly base: ManagementView | null;
  readonly inputs: RawInputs | null;
  readonly draftVersion: number;
  readonly retainedDraftVersion: number | null;
  readonly retentionState: RetentionState;
  readonly commitState: CommitState;
  readonly inFlight: SaveTicket | null;
  readonly latestConflict: ManagementView | null;
  readonly loadError: string | null;
  readonly commitError: string | null;
  readonly retentionError: string | null;
}

export type CompletionDisposition = "applied" | "stale-session" | "not-current-operation" | "invalid-receipt";
export type BeginSaveResult =
  | { readonly kind: "ready"; readonly ticket: SaveTicket }
  | { readonly kind: "unchanged" }
  | { readonly kind: "blocked"; readonly issues: readonly ValidationIssue[] };
