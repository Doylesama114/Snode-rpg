import type { RawInputs, RetentionTicket, ValidationResult } from "./contracts.ts";
import { validateManagementView, validateUpdateCommand } from "./validation.ts";

const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
const version = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const id = (v: unknown): v is string => typeof v === "string" && !!v && v.length <= 128 && v.trim() === v;
function exact(v: Record<string, unknown>, keys: string[]) {
  return Object.keys(v).every(k => keys.includes(k)) && keys.every(k => Object.hasOwn(v, k));
}
function raw(v: unknown): v is RawInputs {
  return object(v) && exact(v, ["displayName", "story", "numbers"]) &&
    typeof v.displayName === "string" && typeof v.story === "string" &&
    object(v.numbers) && Object.entries(v.numbers).every(([k, s]) => id(k) && typeof s === "string");
}
/** Persisted raw input may be invalid/oversized; retain it without coercion or truncation. */
export function validateDraftCheckpoint(value: unknown): ValidationResult<RetentionTicket> {
  const fail = (): ValidationResult<RetentionTicket> => ({ ok: false,
    issues: [{ path: "$", code: "invalid", message: "Invalid draft checkpoint; original data was retained" }] });
  if (!object(value) || !exact(value, ["contextKey", "characterId", "draftId", "editorSessionId",
    "epoch", "draftVersion", "baseRevision", "baseView", "inputs", "commitState", "inFlight", "latestConflict"])) return fail();
  for (const key of ["contextKey", "characterId", "draftId", "editorSessionId"]) if (!id(value[key])) return fail();
  if (!version(value.epoch) || !version(value.draftVersion) || !raw(value.inputs)) return fail();
  const base = validateManagementView(value.baseView);
  if (!base.ok || base.value.characterId !== value.characterId ||
      base.value.characterRevision !== value.baseRevision) return fail();
  if (typeof value.commitState !== "string" || !["idle", "saving", "failed", "unknown", "conflict"].includes(value.commitState)) return fail();
  if (value.latestConflict !== null) {
    const latest = validateManagementView(value.latestConflict);
    if (!latest.ok || latest.value.characterId !== value.characterId ||
        latest.value.characterRevision < base.value.characterRevision || value.commitState !== "conflict") return fail();
  } else if (value.commitState === "conflict") return fail();
  const flight = value.inFlight;
  if (flight !== null) {
    if (!object(flight) || !exact(flight, ["contextKey", "characterId", "draftId", "editorSessionId",
      "epoch", "submittedDraftVersion", "recoveryCheckpointVersion", "submittedInputs", "command"])) return fail();
    for (const key of ["contextKey", "characterId", "draftId", "editorSessionId", "epoch"]) {
      if (flight[key] !== value[key]) return fail();
    }
    if (!raw(flight.submittedInputs) || !version(flight.submittedDraftVersion) ||
        flight.recoveryCheckpointVersion !== flight.submittedDraftVersion + 1 ||
        value.draftVersion < (flight.recoveryCheckpointVersion as number)) return fail();
    const command = validateUpdateCommand(flight.command,
      new Set(base.value.numericFields.filter(f => f.editable).map(f => f.fieldRef)));
    if (!command.ok || command.value.characterId !== value.characterId ||
        command.value.expectedRevision !== value.baseRevision ||
        command.value.submittedDraftVersion !== flight.submittedDraftVersion ||
        (value.commitState !== "saving" && value.commitState !== "unknown")) return fail();
  } else if (value.commitState === "saving" || value.commitState === "unknown") return fail();
  return { ok: true, value: value as unknown as RetentionTicket };
}
