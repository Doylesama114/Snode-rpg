import type {
  BeginSaveResult, CommitReceipt, CompletionDisposition, EditorIdentity, EditorState, LoadTicket,
  ManagementEdit, ManagementView, OperationIdentity, ProfileField, RawInputs, RetentionTicket,
  SaveTicket, ValidationIssue,
} from "./contracts.ts";
import { editTarget, parseNumberInput, validateCommitReceipt, validateManagementView,
  validateProfileValue, validateUpdateCommand } from "./validation.ts";

import { validateDraftCheckpoint } from "./draft.ts";

function frozenView(view: ManagementView): ManagementView {
  return Object.freeze({
    ...view, profile: Object.freeze({ ...view.profile }),
    editableProfileFields: Object.freeze([...view.editableProfileFields]),
    numericFields: Object.freeze(view.numericFields.map(f => Object.freeze({ ...f }))),
  });
}
function frozenInputs(input: RawInputs): RawInputs {
  return Object.freeze({ displayName: input.displayName, story: input.story,
    numbers: Object.freeze({ ...input.numbers }) });
}
function rawFrom(view: ManagementView): RawInputs {
  return frozenInputs({ ...view.profile, numbers: Object.fromEntries(view.numericFields.map(f =>
    [f.fieldRef, f.value === null ? "" : String(f.value)])) });
}
function sameIdentity(a: EditorIdentity, b: EditorIdentity): boolean {
  return a.contextKey === b.contextKey && a.characterId === b.characterId &&
    a.draftId === b.draftId && a.editorSessionId === b.editorSessionId;
}
function problem(path: string, message: string): ValidationIssue {
  return { path, code: "invalid", message };
}
function numericEqual(raw: string, value: number | null): boolean {
  const n = parseNumberInput(raw);
  return n.kind === "clear" ? value === null : n.kind === "set" && n.value === value;
}

/** Pure field planning. Capabilities guide UI; they do not authenticate a server request. */
export function planEdits(view: ManagementView, inputs: RawInputs): {
  readonly edits: readonly ManagementEdit[]; readonly issues: readonly ValidationIssue[];
} {
  const edits: ManagementEdit[] = [], issues: ValidationIssue[] = [];
  for (const field of ["displayName", "story"] as const) {
    if (inputs[field] === view.profile[field]) continue;
    if (view.lifecycle !== "active" || !view.editableProfileFields.includes(field)) {
      issues.push(problem("profile." + field, "Field is not currently editable")); continue;
    }
    const checks = validateProfileValue(field, inputs[field], "profile." + field);
    issues.push(...checks);
    if (!checks.length) edits.push({ kind: "set-profile", field, value: inputs[field] });
  }
  const registered = new Map(view.numericFields.map(f => [f.fieldRef, f]));
  for (const [ref, raw] of Object.entries(inputs.numbers)) {
    const field = registered.get(ref);
    if (!field) { issues.push(problem("numbers." + ref, "Field is unavailable; retain and review this input")); continue; }
    if (numericEqual(raw, field.value)) continue;
    if (view.lifecycle !== "active" || !field.editable) {
      issues.push(problem("numbers." + ref, "Field is not currently editable")); continue;
    }
    const intent = parseNumberInput(raw);
    if (intent.kind === "invalid") issues.push(problem("numbers." + ref, "Invalid numeric input"));
    else if (intent.kind === "clear") edits.push({ kind: "clear-number", fieldRef: ref });
    else edits.push({ kind: "set-number", fieldRef: ref, value: intent.value });
  }
  return { edits: Object.freeze(edits.map(e => Object.freeze(e))), issues: Object.freeze(issues) };
}

/**
 * Session controller candidate. It performs no HTTP, persistence, rules or asset operations.
 * Every async caller carries a ticket. The storage adapter must serialize/version draft writes.
 */
export function createCharacterEditor(initialIdentity: EditorIdentity, makeCommandId: () => string) {
  let state: EditorState = Object.freeze({
    identity: Object.freeze({ ...initialIdentity }), epoch: 0, loadGeneration: 0,
    base: null, inputs: null, draftVersion: 0, retainedDraftVersion: null,
    retentionState: "idle", commitState: "idle", inFlight: null,
    latestConflict: null, loadError: null, commitError: null, retentionError: null,
  });

  function set(patch: Partial<EditorState>) { state = Object.freeze({ ...state, ...patch }); }
  function sessionMatches(ticket: OperationIdentity): boolean {
    return ticket.epoch === state.epoch && sameIdentity(ticket, state.identity);
  }
  function currentSave(ticket: SaveTicket): CompletionDisposition {
    if (!sessionMatches(ticket)) return "stale-session";
    return state.inFlight?.command.commandId === ticket.command.commandId &&
      state.inFlight.submittedDraftVersion === ticket.submittedDraftVersion
      ? "applied" : "not-current-operation";
  }
  function requireLoaded(): { view: ManagementView; inputs: RawInputs } {
    if (!state.base || !state.inputs) throw new Error("Character is not loaded");
    return { view: state.base, inputs: state.inputs };
  }
  function changed(input: RawInputs) {
    set({ inputs: frozenInputs(input), draftVersion: state.draftVersion + 1,
      retentionState: "pending" });
  }

  return {
    getState: (): EditorState => state,

    /** Start a new session; a router resolves dirty/in-flight leave intent before calling this. */
    resetSession(identity: EditorIdentity): void {
      state = Object.freeze({ ...state, identity: Object.freeze({ ...identity }), epoch: state.epoch + 1,
        loadGeneration: state.loadGeneration + 1, base: null, inputs: null, draftVersion: 0,
        retainedDraftVersion: null, retentionState: "idle", commitState: "idle",
        inFlight: null, latestConflict: null, loadError: null, commitError: null, retentionError: null });
    },

    beginLoad(): LoadTicket {
      // Refreshing over edits or an uncertain commit needs explicit coordination.
      if (state.base && state.inputs) {
        const plan = planEdits(state.base, state.inputs);
        if (plan.edits.length || plan.issues.length || state.inFlight) {
          throw new Error("Resolve pending edits or commit before refreshing");
        }
      }
      set({ loadGeneration: state.loadGeneration + 1, loadError: null });
      return Object.freeze({ ...state.identity, epoch: state.epoch, generation: state.loadGeneration,
        startedDraftVersion: state.draftVersion, startedRevision: state.base?.characterRevision ?? null });
    },

    acceptLoad(ticket: LoadTicket, input: unknown): CompletionDisposition {
      if (!sessionMatches(ticket)) return "stale-session";
      if (ticket.generation !== state.loadGeneration || ticket.startedDraftVersion !== state.draftVersion ||
        ticket.startedRevision !== (state.base?.characterRevision ?? null) || state.inFlight) return "not-current-operation";
      const checked = validateManagementView(input);
      if (!checked.ok || checked.value.characterId !== state.identity.characterId ||
        (state.base !== null && checked.value.characterRevision < state.base.characterRevision)) {
        set({ loadError: "Invalid or mismatched management view" });
        return "invalid-receipt";
      }
      const view = frozenView(checked.value);
      set({ base: view, inputs: rawFrom(view), draftVersion: 0, retainedDraftVersion: null,
        retentionState: "idle", commitState: "idle", latestConflict: null, loadError: null, commitError: null, retentionError: null });
      return "applied";
    },

    rejectLoad(ticket: LoadTicket, message: string): CompletionDisposition {
      if (!sessionMatches(ticket)) return "stale-session";
      if (ticket.generation !== state.loadGeneration || ticket.startedDraftVersion !== state.draftVersion ||
        ticket.startedRevision !== (state.base?.characterRevision ?? null) || state.inFlight) return "not-current-operation";
      set({ loadError: message }); // Failed refresh leaves the prior complete base intact.
      return "applied";
    },


    /** Explicit recovery into a fresh session. The coordinator verifies latest service state next. */
    restoreDraft(input: unknown): CompletionDisposition {
      if (state.base || state.inputs || state.inFlight) return "not-current-operation";
      const checked = validateDraftCheckpoint(input);
      if (!checked.ok || checked.value.contextKey !== state.identity.contextKey ||
          checked.value.characterId !== state.identity.characterId) return "invalid-receipt";
      const draft = checked.value, original = draft.inFlight;
      if (original) {
        const submitted = planEdits(draft.baseView, original.submittedInputs);
        if (submitted.issues.length || JSON.stringify(submitted.edits) !==
            JSON.stringify(original.command.edits)) return "invalid-receipt";
      }
      const flight: SaveTicket | null = original ? Object.freeze({ ...original, ...state.identity,
        epoch: state.epoch, submittedInputs: frozenInputs(original.submittedInputs),
        command: Object.freeze({ ...original.command,
          edits: Object.freeze(original.command.edits.map(e => Object.freeze({ ...e }))) }) }) : null;
      set({ base: frozenView(draft.baseView), inputs: frozenInputs(draft.inputs),
        draftVersion: draft.draftVersion + 1, retainedDraftVersion: null, retentionState: "pending",
        commitState: flight ? "saving" : draft.commitState === "conflict" ? "conflict" : "idle",
        inFlight: flight, latestConflict: draft.latestConflict ? frozenView(draft.latestConflict) : null,
        loadError: null, commitError: null, retentionError: null });
      return "applied";
    },

    /** Recovery cannot assume that a retained baseline is still the formal record. */
    compareLatestView(input: unknown): CompletionDisposition {
      const checked = validateManagementView(input);
      if (!state.base || state.inFlight) return "not-current-operation";
      if (!checked.ok || checked.value.characterId !== state.identity.characterId ||
          checked.value.characterRevision < state.base.characterRevision) return "invalid-receipt";
      if (checked.value.characterRevision > state.base.characterRevision) {
        set({ commitState: "conflict", latestConflict: frozenView(checked.value),
          commitError: "Recovered draft needs review against the current record",
          draftVersion: state.draftVersion + 1, retentionState: "pending" });
      }
      return "applied";
    },
    editProfile(field: ProfileField, raw: string): void {
      if (typeof raw !== "string") throw new Error("Raw input must be text");
      const { view, inputs } = requireLoaded();
      if (view.lifecycle !== "active" || !view.editableProfileFields.includes(field)) {
        throw new Error("Profile field is not editable");
      }
      if (inputs[field] !== raw) changed({ ...inputs, [field]: raw });
    },

    editNumber(fieldRef: string, raw: string): void {
      if (typeof raw !== "string") throw new Error("Raw input must be text");
      const { view, inputs } = requireLoaded();
      if (view.lifecycle !== "active" || !view.numericFields.some(f => f.fieldRef === fieldRef && f.editable)) {
        throw new Error("Numeric field is not editable");
      }
      if (inputs.numbers[fieldRef] !== raw) changed({ ...inputs, numbers: { ...inputs.numbers, [fieldRef]: raw } });
    },

    hasUncommittedChanges(): boolean {
      if (!state.base || !state.inputs) return false;
      const planned = planEdits(state.base, state.inputs);
      return planned.edits.length > 0 || planned.issues.length > 0;
    },

    planSave(): BeginSaveResult {
      const { view, inputs } = requireLoaded();
      if (state.inFlight || state.commitState === "conflict") {
        return { kind: "blocked", issues: [problem("$", "Resolve current commit or conflict before another save")] };
      }
      const planned = planEdits(view, inputs);
      if (planned.issues.length) return { kind: "blocked", issues: planned.issues };
      if (!planned.edits.length) return { kind: "unchanged" };
      const command = { commandId: makeCommandId(), characterId: view.characterId,
        expectedRevision: view.characterRevision, submittedDraftVersion: state.draftVersion, edits: planned.edits };
      const checked = validateUpdateCommand(command, new Set(view.numericFields.filter(f => f.editable).map(f => f.fieldRef)));
      if (!checked.ok) return { kind: "blocked", issues: checked.issues };
      const ticket: SaveTicket = Object.freeze({ ...state.identity, epoch: state.epoch,
        submittedDraftVersion: state.draftVersion, recoveryCheckpointVersion: state.draftVersion + 1,
        submittedInputs: frozenInputs(inputs),
        command: Object.freeze({ ...command }) });
      set({ commitState: "saving", inFlight: ticket, commitError: null,
        draftVersion: ticket.recoveryCheckpointVersion, retentionState: "pending" });
      return { kind: "ready", ticket };
    },

    /** Adapter persists the pending command before first dispatch; retries retain this ticket. */
    canDispatchSave(ticket: SaveTicket): boolean {
      return currentSave(ticket) === "applied" && state.commitState === "saving" &&
        (state.retainedDraftVersion ?? -1) >= ticket.recoveryCheckpointVersion;
    },


    /** Coordinator retries the retained command id, never creates a replacement command. */
    resumeCommit(ticket: SaveTicket): CompletionDisposition {
      const result = currentSave(ticket);
      if (result !== "applied") return result;
      if (state.commitState !== "unknown") return "not-current-operation";
      set({ commitState: "saving", commitError: null, draftVersion: state.draftVersion + 1,
        retentionState: "pending" });
      return "applied";
    },

    acceptCommit(ticket: SaveTicket, input: unknown): CompletionDisposition {
      const disposition = currentSave(ticket);
      if (disposition !== "applied") return disposition;
      const checked = validateCommitReceipt(input);
      if (!checked.ok || checked.value.commandId !== ticket.command.commandId ||
        checked.value.submittedDraftVersion !== ticket.submittedDraftVersion ||
        checked.value.view.characterId !== ticket.characterId ||
        checked.value.view.characterRevision <= ticket.command.expectedRevision) {
        set({ commitState: "unknown", commitError: "Commit result could not be verified; coordinate the same command",
          draftVersion: state.draftVersion + 1, retentionState: "pending" });
        return "invalid-receipt";
      }
      const { inputs } = requireLoaded(), receipt: CommitReceipt = checked.value;
      const nextView = frozenView(receipt.view), fresh = rawFrom(nextView);
      // Compare to submitted raw input, not old base or current dirty flag: post-click reversions matter.
      const numbers = { ...fresh.numbers };
      for (const [ref, raw] of Object.entries(inputs.numbers)) {
        if (raw !== ticket.submittedInputs.numbers[ref]) numbers[ref] = raw;
      }
      const next = frozenInputs({
        displayName: inputs.displayName !== ticket.submittedInputs.displayName ? inputs.displayName : fresh.displayName,
        story: inputs.story !== ticket.submittedInputs.story ? inputs.story : fresh.story,
        numbers,
      });
      const pending = planEdits(nextView, next);
      set({ base: nextView, inputs: next, inFlight: null, draftVersion: state.draftVersion + 1,
        commitState: pending.issues.length ? "conflict" : "idle",
        latestConflict: pending.issues.length ? nextView : null,
        // Submitted draft cleanup must be conditional; never erase a newer persisted version.
        retentionState: "pending",
        commitError: pending.issues.length ? "Post-submit input needs review against the new view" : null });
      return "applied";
    },

    rejectCommit(ticket: SaveTicket, message: string): CompletionDisposition {
      const disposition = currentSave(ticket);
      if (disposition !== "applied") return disposition;
      set({ commitState: "failed", inFlight: null, commitError: message,
        draftVersion: state.draftVersion + 1, retentionState: "pending" });
      return "applied";
    },

    markCommitUnknown(ticket: SaveTicket, message: string): CompletionDisposition {
      const disposition = currentSave(ticket);
      if (disposition !== "applied") return disposition;
      set({ commitState: "unknown", commitError: message, draftVersion: state.draftVersion + 1,
        retentionState: "pending" }); // Keep exact original command for coordination.
      return "applied";
    },

    acceptConflict(ticket: SaveTicket, input: unknown): CompletionDisposition {
      const disposition = currentSave(ticket);
      if (disposition !== "applied") return disposition;
      const checked = validateManagementView(input);
      if (!checked.ok || checked.value.characterId !== ticket.characterId ||
        checked.value.characterRevision <= ticket.command.expectedRevision) {
        set({ commitState: "unknown", commitError: "Conflict view could not be verified",
          draftVersion: state.draftVersion + 1, retentionState: "pending" });
        return "invalid-receipt";
      }
      set({ commitState: "conflict", latestConflict: frozenView(checked.value),
        inFlight: null, commitError: "Character revision changed; preserve and compare draft",
        draftVersion: state.draftVersion + 1, retentionState: "pending" });
      return "applied";
    },

    /** Explicit review action. Independent changes rebase; competing/unavailable fields need a decision. */
    resolveConflict(decisions: Readonly<Record<string, "local" | "remote">>, previewOnly = false): readonly ValidationIssue[] {
      const { view: old, inputs: local } = requireLoaded(), latest = state.latestConflict;
      if (state.commitState !== "conflict" || !latest) return [problem("$", "No conflict to resolve")];
      const remote = rawFrom(latest), nextNumbers = { ...remote.numbers };
      let name = remote.displayName, story = remote.story;
      const issues: ValidationIssue[] = [], competing = new Set<string>();
      function resolve(target: string, localChanged: boolean, remoteChanged: boolean,
        equalsRemote: boolean, editable: boolean): "local" | "remote" {
        if (!localChanged || equalsRemote) return "remote";
        if (!remoteChanged && editable) return "local";
        competing.add(target);
        const choice = decisions[target];
        if (!choice) { issues.push(problem(target, "Choose local or remote")); return "remote"; }
        if (choice === "local" && !editable) { issues.push(problem(target, "Field is no longer editable")); return "remote"; }
        return choice;
      }
      for (const field of ["displayName", "story"] as const) {
        const target = "profile:" + field;
        const pick = resolve(target, local[field] !== old.profile[field],
          latest.profile[field] !== old.profile[field], local[field] === latest.profile[field],
          latest.lifecycle === "active" && latest.editableProfileFields.includes(field));
        if (pick === "local") { if (field === "displayName") name = local.displayName; else story = local.story; }
      }
      const oldFields = new Map(old.numericFields.map(f => [f.fieldRef, f]));
      const newFields = new Map(latest.numericFields.map(f => [f.fieldRef, f]));
      for (const [ref, raw] of Object.entries(local.numbers)) {
        const before = oldFields.get(ref), after = newFields.get(ref);
        const pick = resolve("number:" + ref, !before || !numericEqual(raw, before.value),
          !after || !before || after.value !== before.value, !!after && numericEqual(raw, after.value),
          !!after && after.editable && latest.lifecycle === "active");
        if (pick === "local") nextNumbers[ref] = raw;
      }
      for (const target of Object.keys(decisions)) {
        if (!competing.has(target)) issues.push(problem(target, "Decision is not for a current competing field"));
      }
      if (issues.length || previewOnly) return Object.freeze(issues);
      set({ base: latest, inputs: frozenInputs({ displayName: name, story, numbers: nextNumbers }),
        draftVersion: state.draftVersion + 1, retentionState: "pending",
        commitState: "idle", latestConflict: null, loadError: null, commitError: null, retentionError: null });
      return [];
    },

    /** Scheduling is separate from editing; the caller persists this exact version and baseline. */
    beginRetention(): RetentionTicket {
      const { view, inputs } = requireLoaded();
      set({ retentionState: "writing", retentionError: null });
      return Object.freeze({ ...state.identity, epoch: state.epoch,
        draftVersion: state.draftVersion, baseRevision: view.characterRevision,
        baseView: view, inputs: frozenInputs(inputs), commitState: state.commitState, inFlight: state.inFlight, latestConflict: state.latestConflict });
    },

    completeRetention(ticket: RetentionTicket, success: boolean): CompletionDisposition {
      if (!sessionMatches(ticket)) return "stale-session";
      if (ticket.draftVersion > state.draftVersion || ticket.baseRevision !== state.base?.characterRevision) return "not-current-operation";
      if (success) {
        const retained = Math.max(state.retainedDraftVersion ?? -1, ticket.draftVersion);
        set({ retainedDraftVersion: retained,
          retentionState: retained === state.draftVersion ? "retained" : "pending",
          retentionError: retained === state.draftVersion ? null : state.retentionError });
      } else if (ticket.draftVersion >= (state.retainedDraftVersion ?? -1) && ticket.draftVersion === state.draftVersion) {
        set({ retentionState: "failed", retentionError: "Draft was not retained; input is still in memory" });
      }
      return "applied";
    },
  };
}
