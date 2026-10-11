export function makeView(options = {}) {
  const view = {
    viewSchemaVersion: 1, characterId: "role-a", characterRevision: 7, lifecycle: "active",
    profile: { displayName: "匿名角色", story: "原故事" },
    editableProfileFields: ["displayName", "story"],
    numericFields: [
      { fieldRef: "hp.current", label: "当前 HP", value: 13, editable: true },
      { fieldRef: "fp.current", label: "当前 FP", value: 0, editable: true },
      { fieldRef: "temporaryHp", label: "临时生命", value: 7, editable: true },
      { fieldRef: "shield", label: "护盾", value: 4, editable: true },
      { fieldRef: "exhaustion", label: "力竭记录", value: 2, editable: true },
    ],
  };
  return { ...view, ...options, profile: { ...view.profile, ...(options.profile ?? {}) } };
}
export function identity(overrides = {}) {
  return { contextKey: "account-a/session-a", characterId: "role-a",
    draftId: "draft-a", editorSessionId: "editor-a", ...overrides };
}
export function receipt(ticket, options = {}) {
  const profile = { ...ticket.submittedInputs };
  const view = makeView({ characterId: ticket.characterId,
    characterRevision: ticket.command.expectedRevision + 1,
    profile: { displayName: profile.displayName, story: profile.story }, ...options });
  for (const edit of ticket.command.edits) {
    if (edit.kind === "set-profile") view.profile[edit.field] = edit.value;
    else {
      const field = view.numericFields.find(f => f.fieldRef === edit.fieldRef);
      if (field) field.value = edit.kind === "clear-number" ? null : edit.value;
    }
  }
  return { commandId: ticket.command.commandId, submittedDraftVersion: ticket.submittedDraftVersion, view };
}
export const registeredNumericRefs = new Set(["hp.current", "fp.current", "temporaryHp", "shield", "exhaustion"]);
