import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterEditor } from "./editor.ts";
import { validateDraftCheckpoint } from "./draft.ts";
import { makeView, identity, receipt } from "./fixtures.mjs";

function loaded() { const e = createCharacterEditor(identity(), () => "cmd-recovery");
  e.acceptLoad(e.beginLoad(), makeView()); return e; }
function fresh() { return createCharacterEditor(identity({draftId:"copy-draft",editorSessionId:"copy-session"}), () => "another-command"); }

test("explicit recovery retains invalid raw input and isolates the new session", () => {
  const a = loaded(); a.editNumber("hp.current", "bad--number"); const checkpoint = a.beginRetention();
  const e = fresh(); assert.equal(e.restoreDraft(checkpoint), "applied");
  assert.equal(e.getState().inputs.numbers["hp.current"], "bad--number");
  assert.equal(e.getState().identity.editorSessionId, "copy-session");
  assert.equal(e.planSave().kind, "blocked"); assert.equal(e.getState().retainedDraftVersion, null);
});
test("recovered in-flight command keeps its id and must retain its new checkpoint before replay", () => {
  const a = loaded(); a.editProfile("story","submitted"); const result = a.planSave();
  a.editProfile("story","newer input"); const checkpoint = a.beginRetention();
  const e = fresh(); assert.equal(e.restoreDraft(checkpoint), "applied");
  const ticket = e.getState().inFlight;
  assert.equal(ticket.command.commandId, result.ticket.command.commandId);
  assert.equal(e.canDispatchSave(ticket), false);
  e.completeRetention(e.beginRetention(), true); assert.equal(e.canDispatchSave(ticket), true);
  assert.equal(e.acceptCommit(ticket, receipt(ticket)), "applied");
  assert.equal(e.getState().inputs.story, "newer input"); assert.equal(e.hasUncommittedChanges(), true);
});
test("recovery cannot overwrite a loaded editor or a different account/character", () => {
  const a=loaded(); a.editProfile("story","draft"); const d=a.beginRetention();
  assert.equal(a.restoreDraft(d),"not-current-operation");
  const e=createCharacterEditor(identity({contextKey:"other-account"}),()=>"cmd");
  assert.equal(e.restoreDraft(d),"invalid-receipt"); assert.equal(e.getState().base,null);
});
test("malformed, extra and inconsistent checkpoints remain rejected", () => {
  const a=loaded(); a.editProfile("story","draft"); a.planSave(); const d=a.beginRetention();
  for (const altered of [null, {...d,ownerId:"forged"},
    {...d,baseRevision:999}, {...d,commitState:"idle"},
    {...d,inFlight:{...d.inFlight,characterId:"other"}},
    {...d,inFlight:{...d.inFlight,submittedDraftVersion:900}}]) {
    assert.equal(validateDraftCheckpoint(altered).ok,false);
  }
  const mismatch=structuredClone(d); mismatch.inFlight.submittedInputs.story="different";
  assert.equal(fresh().restoreDraft(mismatch),"invalid-receipt");
});
test("recovered baseline is reviewed against the latest formal revision", () => {
  const a=loaded(); a.editProfile("story","local"); const e=fresh();
  e.restoreDraft(a.beginRetention());
  assert.equal(e.compareLatestView(makeView({characterRevision:8,profile:{story:"remote"}})),"applied");
  assert.equal(e.getState().commitState,"conflict"); assert.equal(e.getState().inputs.story,"local");
  assert.equal(e.resolveConflict({},true).length,1);
  assert.equal(e.getState().base.characterRevision,7);
  assert.equal(e.resolveConflict({"profile:story":"local"}).length,0);
  assert.equal(e.getState().base.characterRevision,8);
});
test("conflict preview with independent changes does not mutate the draft", () => {
  const a=loaded(); a.editNumber("hp.current","4"); const t=a.planSave().ticket;
  a.acceptConflict(t,makeView({characterRevision:8,profile:{story:"remote"}}));
  const previous=a.getState(); assert.deepEqual(a.resolveConflict({},true),[]);
  assert.equal(a.getState(),previous); assert.deepEqual(a.resolveConflict({}),[]);
  assert.equal(a.getState().inputs.story,"remote"); assert.equal(a.getState().inputs.numbers["hp.current"],"4");
});
test("unknown result resumes the exact same retained command", () => {
  const e=loaded(); e.editProfile("story","draft"); const t=e.planSave().ticket;
  e.markCommitUnknown(t,"uncertain"); assert.equal(e.planSave().kind,"blocked");
  assert.equal(e.resumeCommit(t),"applied"); assert.equal(e.getState().inFlight.command,t.command);
  assert.equal(e.canDispatchSave(t),false); e.completeRetention(e.beginRetention(),true);
  assert.equal(e.canDispatchSave(t),true);
});
test("recovery refuses a backwards or mismatched latest view", () => {
  const a=loaded(); a.editProfile("story","draft"); const e=fresh();e.restoreDraft(a.beginRetention());
  assert.equal(e.compareLatestView(makeView({characterRevision:6})),"invalid-receipt");
  assert.equal(e.compareLatestView(makeView({characterId:"different"})),"invalid-receipt");
  assert.equal(e.getState().inputs.story,"draft");
});

test("post-submit permission loss survives retention and explicit recovery", () => {
  const a=loaded(); a.editNumber("hp.current","3");const t=a.planSave().ticket;
  a.editNumber("hp.current","2");
  const result=receipt(t); result.view.numericFields[0].editable=false;
  a.acceptCommit(t,result);
  assert.equal(a.getState().commitState,"conflict");
  const checkpoint=a.beginRetention(); assert.equal(validateDraftCheckpoint(checkpoint).ok,true);
  const e=fresh(); assert.equal(e.restoreDraft(checkpoint),"applied");
  e.compareLatestView(result.view);
  assert.equal(e.getState().commitState,"conflict");
  assert.equal(e.getState().inputs.numbers["hp.current"],"2");
  assert.equal(e.resolveConflict({"number:hp.current":"local"}).length,1);
  assert.equal(e.resolveConflict({"number:hp.current":"remote"}).length,0);
});
