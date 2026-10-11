import type {
  CommitReceipt, ManagementEdit, ManagementView, NumberIntent, ProfileField,
  UpdateManagementCommand, ValidationIssue, ValidationResult,
} from "./contracts.ts";

/** Candidate transport budgets, not game limits. Ratify before promotion. */
export const candidateLimits = Object.freeze({ id: 128, displayName: 256, story: 65536 });
const has = (v: object, k: string): boolean => Object.prototype.hasOwnProperty.call(v, k);
const plain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const id = (v: unknown): v is string => typeof v === "string" &&
  v.length > 0 && v.length <= candidateLimits.id && v.trim() === v;
const positiveRevision = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const profileField = (v: unknown): v is ProfileField => v === "displayName" || v === "story";

function issue(path: string, code: ValidationIssue["code"], message: string): ValidationIssue {
  return { path, code, message };
}
function keys(v: Record<string, unknown>, expected: readonly string[], path: string): ValidationIssue[] {
  return Object.keys(v).filter(k => !expected.includes(k))
    .map(k => issue(path + "." + k, "unknown-field", "Unexpected field"));
}
function fail<T>(issues: readonly ValidationIssue[]): ValidationResult<T> { return { ok: false, issues }; }

export function validateProfileValue(field: ProfileField, value: unknown, path: string): ValidationIssue[] {
  if (typeof value !== "string") return [issue(path, "type", "Expected text")];
  if (field === "displayName" && (!value.trim() || value.length > candidateLimits.displayName)) {
    return [issue(path, "invalid", "Display name is empty or exceeds the candidate budget")];
  }
  if (field === "story" && value.length > candidateLimits.story) {
    return [issue(path, "invalid", "Story exceeds the candidate budget")];
  }
  return [];
}

/** Clear is an explicit intent. Zero and scientific notation remain numbers. No clamping. */
export function parseNumberInput(raw: string): NumberIntent {
  const text = raw.trim();
  if (!text) return { kind: "clear", raw };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return { kind: "invalid", raw };
  const value = Number(text);
  return Number.isFinite(value) ? { kind: "set", raw, value } : { kind: "invalid", raw };
}

export function validateManagementView(input: unknown): ValidationResult<ManagementView> {
  if (!plain(input)) return fail([issue("$", "type", "Expected a plain object")]);
  const errors = keys(input, ["viewSchemaVersion", "characterId", "characterRevision", "lifecycle",
    "profile", "editableProfileFields", "numericFields"], "$");
  if (input.viewSchemaVersion !== 1) errors.push(issue("$.viewSchemaVersion", "invalid", "Unsupported view schema"));
  if (!id(input.characterId)) errors.push(issue("$.characterId", "invalid", "Invalid character id"));
  if (!positiveRevision(input.characterRevision)) errors.push(issue("$.characterRevision", "invalid", "Invalid revision"));
  if (input.lifecycle !== "active" && input.lifecycle !== "archived") errors.push(issue("$.lifecycle", "invalid", "Invalid lifecycle"));
  if (!plain(input.profile)) errors.push(issue("$.profile", "type", "Expected profile"));
  else {
    errors.push(...keys(input.profile, ["displayName", "story"], "$.profile"));
    errors.push(...validateProfileValue("displayName", input.profile.displayName, "$.profile.displayName"));
    errors.push(...validateProfileValue("story", input.profile.story, "$.profile.story"));
  }
  if (!Array.isArray(input.editableProfileFields) || input.editableProfileFields.some(v => !profileField(v))) {
    errors.push(issue("$.editableProfileFields", "invalid", "Invalid profile capabilities"));
  } else if (new Set(input.editableProfileFields).size !== input.editableProfileFields.length) {
    errors.push(issue("$.editableProfileFields", "duplicate", "Duplicate capability"));
  }
  if (!Array.isArray(input.numericFields)) errors.push(issue("$.numericFields", "type", "Expected field array"));
  else {
    const seen = new Set<string>();
    input.numericFields.forEach((entry: unknown, i: number) => {
      const path = "$.numericFields[" + i + "]";
      if (!plain(entry)) { errors.push(issue(path, "type", "Expected field")); return; }
      errors.push(...keys(entry, ["fieldRef", "label", "value", "editable"], path));
      if (!id(entry.fieldRef)) errors.push(issue(path + ".fieldRef", "invalid", "Invalid field reference"));
      else if (seen.has(entry.fieldRef)) errors.push(issue(path + ".fieldRef", "duplicate", "Duplicate field reference"));
      else seen.add(entry.fieldRef);
      if (typeof entry.label !== "string" || !entry.label.trim()) errors.push(issue(path + ".label", "invalid", "Invalid label"));
      if (!has(entry, "value")) errors.push(issue(path + ".value", "missing", "Value must be explicit, including null"));
      else if (entry.value !== null && (typeof entry.value !== "number" || !Number.isFinite(entry.value))) {
        errors.push(issue(path + ".value", "invalid", "Expected finite number or unrecorded null"));
      }
      if (typeof entry.editable !== "boolean") errors.push(issue(path + ".editable", "type", "Expected capability"));
    });
  }
  if (errors.length) return fail(errors);
  return { ok: true, value: input as unknown as ManagementView };
}

/**
 * registeredNumericRefs comes from a trusted application registry.
 * This is structure/field-set validation; actor and domain authorization remain server duties.
 */
export function validateUpdateCommand(input: unknown, registeredNumericRefs: ReadonlySet<string>): ValidationResult<UpdateManagementCommand> {
  if (!plain(input)) return fail([issue("$", "type", "Expected command")]);
  const errors = keys(input, ["commandId", "characterId", "expectedRevision", "submittedDraftVersion", "edits"], "$");
  if (!id(input.commandId)) errors.push(issue("$.commandId", "invalid", "Invalid command id"));
  if (!id(input.characterId)) errors.push(issue("$.characterId", "invalid", "Invalid character id"));
  if (!positiveRevision(input.expectedRevision)) errors.push(issue("$.expectedRevision", "invalid", "Invalid revision"));
  if (typeof input.submittedDraftVersion !== "number" || !Number.isSafeInteger(input.submittedDraftVersion) || input.submittedDraftVersion < 0) {
    errors.push(issue("$.submittedDraftVersion", "invalid", "Invalid submitted draft version"));
  }
  if (!Array.isArray(input.edits) || !input.edits.length) errors.push(issue("$.edits", "invalid", "Expected nonempty edits"));
  else {
    const targets = new Set<string>();
    input.edits.forEach((entry: unknown, i: number) => {
      const path = "$.edits[" + i + "]";
      if (!plain(entry)) { errors.push(issue(path, "type", "Expected edit")); return; }
      let target: string | undefined;
      if (entry.kind === "set-profile") {
        errors.push(...keys(entry, ["kind", "field", "value"], path));
        if (!profileField(entry.field)) errors.push(issue(path + ".field", "invalid", "Unregistered profile field"));
        else { target = "profile:" + entry.field; errors.push(...validateProfileValue(entry.field, entry.value, path + ".value")); }
      } else if (entry.kind === "set-number" || entry.kind === "clear-number") {
        errors.push(...keys(entry, entry.kind === "set-number" ? ["kind", "fieldRef", "value"] : ["kind", "fieldRef"], path));
        if (!id(entry.fieldRef) || !registeredNumericRefs.has(entry.fieldRef)) errors.push(issue(path + ".fieldRef", "invalid", "Unregistered numeric field"));
        else target = "number:" + entry.fieldRef;
        if (entry.kind === "set-number" && (typeof entry.value !== "number" || !Number.isFinite(entry.value))) {
          errors.push(issue(path + ".value", "invalid", "Expected finite number"));
        }
      } else errors.push(issue(path + ".kind", "invalid", "Unregistered edit kind"));
      if (target) {
        if (targets.has(target)) errors.push(issue(path, "duplicate", "Duplicate edit target"));
        targets.add(target);
      }
    });
  }
  return errors.length ? fail(errors) : { ok: true, value: input as unknown as UpdateManagementCommand };
}

export function validateCommitReceipt(input: unknown): ValidationResult<CommitReceipt> {
  if (!plain(input)) return fail([issue("$", "type", "Expected receipt")]);
  const errors = keys(input, ["commandId", "submittedDraftVersion", "view"], "$");
  if (!id(input.commandId)) errors.push(issue("$.commandId", "invalid", "Invalid command id"));
  if (typeof input.submittedDraftVersion !== "number" || !Number.isSafeInteger(input.submittedDraftVersion) || input.submittedDraftVersion < 0) {
    errors.push(issue("$.submittedDraftVersion", "invalid", "Invalid submitted draft version"));
  }
  const view = validateManagementView(input.view);
  if (!view.ok) errors.push(...view.issues.map(e => ({ ...e, path: "$.view" + e.path.slice(1) })));
  return errors.length ? fail(errors) : { ok: true, value: input as unknown as CommitReceipt };
}

export function editTarget(edit: ManagementEdit): string {
  return edit.kind === "set-profile" ? "profile:" + edit.field : "number:" + edit.fieldRef;
}
