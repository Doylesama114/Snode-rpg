import test from "node:test";
import assert from "node:assert/strict";
import {createCharacterEditor} from "./editor.ts";
import {makeView,identity,receipt} from "./fixtures.mjs";
function loaded(view=makeView()) {
  let command=0;const e=createCharacterEditor(identity(),()=>"cmd-"+(++command));
  assert.equal(e.acceptLoad(e.beginLoad(),view),"applied");return e;
}
function start(e){const r=e.planSave();assert.equal(r.kind,"ready");return r.ticket;}
function retain(e){const t=e.beginRetention();assert.equal(e.completeRetention(t,true),"applied");return t;}

test("newer loading ticket wins and old loading cannot replace it",()=>{
  const e=createCharacterEditor(identity(),()=>"cmd");const a=e.beginLoad(),b=e.beginLoad();
  assert.equal(e.acceptLoad(b,makeView({profile:{story:"B"}})),"applied");
  assert.equal(e.acceptLoad(a,makeView({profile:{story:"A"}})),"not-current-operation");
  assert.equal(e.getState().base.profile.story,"B");
});
test("wrong character or failed refresh leaves complete existing base intact",()=>{
  const e=loaded(),old=e.getState().base,t=e.beginLoad();
  assert.equal(e.acceptLoad(t,makeView({characterId:"role-b"})),"invalid-receipt");
  assert.equal(e.getState().base,old);assert.equal(e.rejectLoad(t,"offline"),"applied");
  assert.equal(e.getState().base,old);
});
test("read result started before an edit cannot wipe that edit",()=>{
  const e=loaded(),t=e.beginLoad();e.editProfile("story","new");
  assert.equal(e.acceptLoad(t,makeView({characterRevision:8})),"not-current-operation");
  assert.equal(e.getState().inputs.story,"new");
});
test("read started before a save cannot roll back the committed revision",()=>{
  const e=loaded(),read=e.beginLoad();e.editProfile("story","new");const t=start(e);
  assert.equal(e.acceptCommit(t,receipt(t)),"applied");
  assert.equal(e.acceptLoad(read,makeView()),"not-current-operation");assert.equal(e.getState().base.characterRevision,8);
});
test("valid loaded view and raw input are copied, frozen and independent of caller",()=>{
  const view=makeView(),e=loaded(view);view.profile.story="outside";view.numericFields[0].value=99;
  assert.equal(e.getState().base.profile.story,"原故事");assert.equal(e.getState().base.numericFields[0].value,13);
  assert.throws(()=>{e.getState().base.profile.story="mutate";},TypeError);
});
test("unchanged input creates no formal command",()=>{
  const e=loaded();e.editNumber("fp.current","0.0");assert.equal(e.hasUncommittedChanges(),false);
  assert.equal(e.planSave().kind,"unchanged");
});
test("zero is submitted as set and blank is clear, preserving null semantics",()=>{
  const e=loaded();e.editNumber("hp.current","0");e.editNumber("fp.current","");
  const t=start(e);assert.deepEqual(t.command.edits,[{kind:"set-number",fieldRef:"hp.current",value:0},{kind:"clear-number",fieldRef:"fp.current"}]);
  e.acceptCommit(t,receipt(t));assert.equal(e.getState().base.numericFields[0].value,0);
  assert.equal(e.getState().base.numericFields[1].value,null);assert.equal(e.hasUncommittedChanges(),false);
});
test("invalid numeric and blank name remain editable raw data and block formal submit",()=>{
  const e=loaded();e.editNumber("hp.current","1foo");e.editProfile("displayName"," ");
  assert.equal(e.planSave().kind,"blocked");assert.equal(e.getState().inputs.numbers["hp.current"],"1foo");
  assert.equal(e.getState().inputs.displayName," ");assert.equal(e.hasUncommittedChanges(),true);
});
test("pending command has to be retained before first dispatch",()=>{
  const e=loaded();e.editProfile("story","new");const t=start(e);
  assert.equal(e.canDispatchSave(t),false);const checkpoint=retain(e);
  assert.equal(checkpoint.inFlight.command.commandId,t.command.commandId);assert.equal(checkpoint.commitState,"saving");
  assert.equal(e.canDispatchSave(t),true);
});
test("save ticket is frozen and further typing is not included in that command",()=>{
  const e=loaded();e.editProfile("story","submitted");const t=start(e);e.editProfile("story","later");
  assert.equal(t.command.edits[0].value,"submitted");assert.equal(t.submittedInputs.story,"submitted");
  assert.throws(()=>{t.command.edits[0].value="mutate";},TypeError);assert.equal(e.planSave().kind,"blocked");
});
test("success preserves post-submit input and does not clear its pending retention",()=>{
  const e=loaded();e.editProfile("story","submitted");const t=start(e);retain(e);e.editProfile("story","later");
  e.acceptCommit(t,receipt(t));assert.equal(e.getState().base.profile.story,"submitted");
  assert.equal(e.getState().inputs.story,"later");assert.equal(e.hasUncommittedChanges(),true);
  assert.equal(e.getState().retentionState,"pending");
});
test("reversion to old base while saving is still pending after that save succeeds",()=>{
  const e=loaded();e.editProfile("story","submitted");const t=start(e);e.editProfile("story","原故事");
  assert.equal(e.hasUncommittedChanges(),false);assert.throws(()=>e.beginLoad());
  e.acceptCommit(t,receipt(t));assert.equal(e.getState().inputs.story,"原故事");
  assert.equal(e.getState().base.profile.story,"submitted");assert.equal(e.hasUncommittedChanges(),true);
});
test("explicit failure preserves base and input, duplicate completion is ignored",()=>{
  const e=loaded();e.editProfile("story","new");const t=start(e);e.rejectCommit(t,"quota");
  assert.equal(e.getState().base.characterRevision,7);assert.equal(e.getState().inputs.story,"new");
  assert.equal(e.getState().commitState,"failed");assert.equal(e.acceptCommit(t,receipt(t)),"not-current-operation");
});
test("network uncertainty retains exact command and blocks a new command",()=>{
  const e=loaded();e.editProfile("story","new");const t=start(e);e.markCommitUnknown(t,"timeout");
  assert.equal(e.getState().inFlight,t);assert.equal(e.getState().commitState,"unknown");
  assert.equal(e.planSave().kind,"blocked");e.acceptCommit(t,receipt(t));assert.equal(e.getState().base.characterRevision,8);
});
test("unverifiable result is unknown instead of falsely failed or adopted",()=>{
  const e=loaded();e.editProfile("story","new");const t=start(e);
  assert.equal(e.acceptCommit(t,receipt(t,{characterId:"role-b"})),"invalid-receipt");
  assert.equal(e.getState().base.characterRevision,7);assert.equal(e.getState().inputs.story,"new");
  assert.equal(e.getState().commitState,"unknown");assert.equal(e.getState().inFlight,t);
});
test("same operation after account/session change cannot populate new session",()=>{
  const e=loaded();e.editProfile("story","private");const t=start(e);
  e.resetSession(identity({contextKey:"account-b/session-b",characterId:"role-b",draftId:"draft-b"}));
  assert.equal(e.acceptCommit(t,receipt(t)),"stale-session");assert.equal(e.getState().base,null);
});
test("older draft acknowledgement cannot mark newer input retained",()=>{
  const e=loaded();e.editProfile("story","one");const t=e.beginRetention();e.editProfile("story","two");
  e.completeRetention(t,true);assert.equal(e.getState().retainedDraftVersion,t.draftVersion);
  assert.equal(e.getState().retentionState,"pending");assert.equal(e.getState().inputs.story,"two");
});
test("out of order draft completion cannot regress newer retained checkpoint",()=>{
  const e=loaded();e.editProfile("story","one");const a=e.beginRetention();e.editProfile("story","two");
  const b=e.beginRetention();e.completeRetention(b,true);e.completeRetention(a,true);e.completeRetention(a,false);
  assert.equal(e.getState().retainedDraftVersion,b.draftVersion);assert.equal(e.getState().retentionState,"retained");
});
test("failed current draft write preserves raw input and makes failure visible",()=>{
  const e=loaded();e.editProfile("story","new");const t=e.beginRetention();e.completeRetention(t,false);
  assert.equal(e.getState().inputs.story,"new");assert.equal(e.getState().retentionState,"failed");
});
test("commit rebasing invalidates acknowledgement from the old baseline",()=>{
  const e=loaded();e.editProfile("story","new");const save=start(e),before=e.beginRetention();
  e.acceptCommit(save,receipt(save));assert.equal(e.completeRetention(before,true),"not-current-operation");
  assert.equal(e.getState().retentionState,"pending");
});
test("conflict keeps draft; independent fields rebase without overwriting remote story",()=>{
  const e=loaded();e.editProfile("displayName","local name");const t=start(e);
  e.acceptConflict(t,makeView({characterRevision:8,profile:{story:"remote story"}}));
  assert.equal(e.getState().base.characterRevision,7);assert.equal(e.getState().inputs.displayName,"local name");
  assert.equal(e.planSave().kind,"blocked");assert.deepEqual(e.resolveConflict({}),[]);
  assert.equal(e.getState().inputs.displayName,"local name");assert.equal(e.getState().inputs.story,"remote story");
  const next=start(e);assert.equal(next.command.expectedRevision,8);
  assert.deepEqual(next.command.edits,[{kind:"set-profile",field:"displayName",value:"local name"}]);
});
test("competing text requires explicit choice; no mutation on unresolved conflict",()=>{
  const e=loaded();e.editProfile("story","local");const t=start(e);
  e.acceptConflict(t,makeView({characterRevision:8,profile:{story:"remote"}}));
  assert.ok(e.resolveConflict({}).length);assert.equal(e.getState().base.characterRevision,7);
  assert.equal(e.getState().inputs.story,"local");assert.deepEqual(e.resolveConflict({"profile:story":"local"}),[]);
  assert.equal(e.getState().inputs.story,"local");assert.equal(e.getState().base.profile.story,"remote");
});
test("remote choice explicitly drops only the competing local field",()=>{
  const e=loaded();e.editProfile("story","local");e.editProfile("displayName","local name");const t=start(e);
  e.acceptConflict(t,makeView({characterRevision:8,profile:{story:"remote"}}));
  assert.deepEqual(e.resolveConflict({"profile:story":"remote"}),[]);
  assert.equal(e.getState().inputs.story,"remote");assert.equal(e.getState().inputs.displayName,"local name");
});
test("post-submit edit losing capability stays available for review, not silently dropped",()=>{
  const e=loaded();e.editProfile("story","submit");const t=start(e);e.editNumber("hp.current","1");
  const result=receipt(t);result.view.numericFields[0].editable=false;
  e.acceptCommit(t,result);assert.equal(e.getState().inputs.numbers["hp.current"],"1");
  assert.equal(e.getState().commitState,"conflict");assert.ok(e.resolveConflict({"number:hp.current":"local"}).length);
  assert.deepEqual(e.resolveConflict({"number:hp.current":"remote"}),[]);
  assert.equal(e.getState().inputs.numbers["hp.current"],"13");
});
test("archived view and unavailable fields cannot be edited through controller",()=>{
  const e=loaded(makeView({lifecycle:"archived"}));assert.throws(()=>e.editProfile("story","new"));
  assert.throws(()=>e.editNumber("hp.current","0"));
  const active=loaded();assert.throws(()=>active.editNumber("wallet.gold","100"));
});

test("retention acknowledgement never clears a formal commit failure",()=>{
  const e=loaded();e.editProfile("story","new");const save=start(e);e.rejectCommit(save,"server quota");
  const checkpoint=e.beginRetention();e.completeRetention(checkpoint,true);
  assert.equal(e.getState().commitState,"failed");assert.equal(e.getState().commitError,"server quota");
  assert.equal(e.getState().retentionState,"retained");assert.equal(e.getState().retentionError,null);
});

test("serialized request contains the checkpoint needed for the server receipt",()=>{
  const e=loaded();e.editProfile("story","new");const ticket=start(e),wire=JSON.parse(JSON.stringify(ticket.command));
  assert.equal(wire.submittedDraftVersion,ticket.submittedDraftVersion);
  const result={commandId:wire.commandId,submittedDraftVersion:wire.submittedDraftVersion,view:receipt(ticket).view};
  assert.equal(e.acceptCommit(ticket,result),"applied");
});
