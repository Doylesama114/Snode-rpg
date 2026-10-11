import test from "node:test";
import assert from "node:assert/strict";
import { parseNumberInput, validateManagementView, validateUpdateCommand, validateCommitReceipt } from "./validation.ts";
import { makeView, registeredNumericRefs } from "./fixtures.mjs";
const command = edits => ({ commandId: "cmd-a", characterId: "role-a", expectedRevision: 7, submittedDraftVersion: 1, edits });

test("projection distinguishes explicit zero and unrecorded null", () => {
  const view = makeView(); view.numericFields[0].value = null;
  const r = validateManagementView(view); assert.equal(r.ok, true);
  assert.equal(r.value.numericFields[0].value, null); assert.equal(r.value.numericFields[1].value, 0);
});
test("missing numeric value is rejected rather than defaulted", () => {
  const view = makeView(); delete view.numericFields[0].value;
  const r = validateManagementView(view); assert.equal(r.ok, false);
  assert.ok(r.issues.some(x => x.code === "missing"));
});
test("numeric input retains zero, decimals, exponent and negative without gameplay policy", () => {
  for (const [raw, value] of [["0",0],["0.0",0],["1.2e3",1200],["-2",-2],[".5",.5]]) {
    assert.deepEqual(parseNumberInput(raw), { kind: "set", raw, value });
  }
});
test("blank is an explicit clear intent and malformed text stays invalid", () => {
  assert.deepEqual(parseNumberInput(" "), { kind:"clear", raw:" " });
  for (const raw of ["1foo","7米/9米","Infinity","1e999","=1+1"]) assert.equal(parseNumberInput(raw).kind,"invalid");
});
test("owner, wallet and authority declarations are rejected without mutating input", () => {
  const input = { ...command([{kind:"set-profile",field:"story",value:"new"}]), ownerUserId:"someone", wallet:{gold:99}, isDM:true };
  const before = JSON.stringify(input), result=validateUpdateCommand(input,registeredNumericRefs);
  assert.equal(result.ok,false); assert.equal(JSON.stringify(input),before);
  assert.equal(result.issues.filter(i=>i.code==="unknown-field").length,3);
});
test("duplicate edits are rejected, including set versus clear of same numeric target", () => {
  const r=validateUpdateCommand(command([{kind:"set-number",fieldRef:"hp.current",value:0},
    {kind:"clear-number",fieldRef:"hp.current"}]),registeredNumericRefs);
  assert.equal(r.ok,false); assert.ok(r.issues.some(i=>i.code==="duplicate"));
});
test("unregistered max and asset fields cannot be arbitrary patch targets", () => {
  for(const ref of ["hp.maximum","wallet.gold","ownerUserId","classes.0.level"]) {
    assert.equal(validateUpdateCommand(command([{kind:"set-number",fieldRef:ref,value:99}]),registeredNumericRefs).ok,false);
  }
});
test("clear has no value payload and setting null is not a numeric set", () => {
  assert.equal(validateUpdateCommand(command([{kind:"clear-number",fieldRef:"fp.current"}]),registeredNumericRefs).ok,true);
  assert.equal(validateUpdateCommand(command([{kind:"clear-number",fieldRef:"fp.current",value:0}]),registeredNumericRefs).ok,false);
  assert.equal(validateUpdateCommand(command([{kind:"set-number",fieldRef:"fp.current",value:null}]),registeredNumericRefs).ok,false);
});
test("blank name and candidate transport overflow are errors, not truncation", () => {
  for(const edit of [{kind:"set-profile",field:"displayName",value:" "},
    {kind:"set-profile",field:"story",value:"x".repeat(65537)}]) {
    const input=command([edit]),before=JSON.stringify(input);
    assert.equal(validateUpdateCommand(input,registeredNumericRefs).ok,false);assert.equal(JSON.stringify(input),before);
  }
});
test("literal markup remains exact plain data", () => {
  const value='原文</textarea><b>文字</b>';
  const r=validateUpdateCommand(command([{kind:"set-profile",field:"story",value}]),registeredNumericRefs);
  assert.equal(r.ok,true);assert.equal(r.value.edits[0].value,value);
});
test("projection rejects duplicate references and unexpected root fields", () => {
  const v=makeView();v.numericFields.push({...v.numericFields[0]});assert.equal(validateManagementView(v).ok,false);
  assert.equal(validateManagementView({...makeView(),currency:99}).ok,false);
});
test("revision is an exact positive number and unknown view schema is not adopted", () => {
  for(const revision of ["7",0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(validateUpdateCommand({...command([{kind:"set-profile",field:"story",value:"new"}]),expectedRevision:revision},registeredNumericRefs).ok,false);
  }
  assert.equal(validateManagementView({...makeView(),viewSchemaVersion:2}).ok,false);
});
test("inherited objects are not treated as validated JSON DTOs", () => {
  assert.equal(validateUpdateCommand(Object.create(command([])),registeredNumericRefs).ok,false);
});
test("receipt requires explicit submitted checkpoint and the validated view", () => {
  assert.equal(validateCommitReceipt({commandId:"cmd-a",submittedDraftVersion:1,view:makeView()}).ok,true);
  assert.equal(validateCommitReceipt({commandId:"cmd-a",view:makeView()}).ok,false);
  assert.equal(validateCommitReceipt({commandId:"cmd-a",submittedDraftVersion:1,view:{...makeView(),characterId:""}}).ok,false);
});
