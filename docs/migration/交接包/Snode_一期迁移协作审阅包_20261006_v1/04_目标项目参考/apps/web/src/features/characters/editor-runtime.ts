import { createCharacterEditor } from "../../../../../docs/proposals/character-management/editor.ts";
import type { ProfileField } from "../../../../../docs/proposals/character-management/contracts.ts";
import type { CharacterService, DraftRow } from "./local-service.ts";
import { previewScope } from "./local-service.ts";

export function createEditorRuntime(service: CharacterService, characterId: string) {
  const editor = createCharacterEditor({ contextKey: previewScope, characterId,
    draftId: crypto.randomUUID(), editorSessionId: crypto.randomUUID() }, () => crypto.randomUUID());
  const listeners = new Set<() => void>();
  let recovery: DraftRow[] = [], notice = "", error = "", loading = true, busy = false;
  let snapshot = { editor: editor.getState(), recovery, notice, error, loading, busy };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve(true), started: Promise<void> | null = null, discarded = false;
  function emit() {
    snapshot = { editor: editor.getState(), recovery, notice, error, loading, busy };
    listeners.forEach(l => l());
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 600); }
  function flush(): Promise<boolean> {
    clearTimeout(timer);
    queue = queue.catch(() => false).then(async () => {
      if (discarded || !editor.getState().base || editor.getState().draftVersion === 0) return true;
      const checkpoint = editor.beginRetention(); emit();
      try {
        await service.retain(checkpoint); editor.completeRetention(checkpoint, true); emit(); return true;
      } catch {
        editor.completeRetention(checkpoint, false); emit(); return false;
      }
    });
    return queue;
  }
  async function dispatch(): Promise<boolean> {
    const ticket = editor.getState().inFlight;
    if (!ticket) return false;
    if (!(await flush()) || !editor.canDispatchSave(ticket)) {
      editor.rejectCommit(ticket, "保存前未能保留本机草稿，正式请求尚未发送。"); emit();
      await flush(); return false;
    }
    try {
      const result = await service.commit(ticket.command);
      if (result.kind === "committed") {
        const disposition = editor.acceptCommit(ticket, result.receipt);
        notice = disposition === "applied" ? "已保存本机正式记录，并新增历史快照。" : "";
      } else {
        editor.acceptConflict(ticket, result.view); notice = "";
      }
    } catch {
      editor.markCommitUnknown(ticket, "保存结果暂时无法核实。输入已保留，请核实同一命令后继续。");
    }
    emit(); await flush();
    return !editor.getState().inFlight && editor.getState().commitState !== "conflict";
  }
  const runtime = {
    editor,
    subscribe(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; },
    getSnapshot: () => snapshot,
    start() {
      if (started) return started;
      const ticket = editor.beginLoad();
      started = (async () => {
        try {
          const [v, ds] = await Promise.all([service.read(characterId), service.drafts(characterId)]);
          editor.acceptLoad(ticket, v);
          recovery = ds.filter(r => {
            const c = r.checkpoint;
            if (!c) return false;
            // Formatting-only clean checkpoints need no user recovery prompt.
            const probe = createCharacterEditor({ ...editor.getState().identity }, () => "probe");
            if (probe.restoreDraft(c) !== "applied") throw new Error("草稿恢复校验失败，原数据保留。");
            return probe.hasUncommittedChanges() || !!c.inFlight || c.commitState === "conflict";
          });
        } catch (e) {
          error = e instanceof Error ? e.message : "读取失败，请重试。";
          editor.rejectLoad(ticket, error);
        } finally { loading = false; emit(); }
      })();
      return started;
    },
    editProfile(field: ProfileField, input: string) {
      editor.editProfile(field, input); notice = ""; error = ""; emit(); schedule();
    },
    editNumber(ref: string, input: string) {
      editor.editNumber(ref, input); notice = ""; error = ""; emit(); schedule();
    },
    flush,
    async save() {
      if (busy) return false;
      error = ""; notice = "";
      const result = editor.planSave();
      if (result.kind === "blocked") { error = "请先处理无效输入、版本冲突或待核实的保存。"; emit(); return false; }
      if (result.kind === "unchanged") { notice = "当前内容与正式记录相同。"; emit(); return true; }
      busy = true; emit();
      try { return await dispatch(); } finally { busy = false; emit(); }
    },
    async verify() {
      if (busy || editor.getState().commitState !== "unknown") return false;
      const ticket = editor.getState().inFlight;
      if (!ticket || editor.resumeCommit(ticket) !== "applied") return false;
      busy = true; emit();
      try { return await dispatch(); } finally { busy = false; emit(); }
    },
    ignoreRecovery() { recovery = []; emit(); },
    async recover(row: DraftRow) {
      if (busy || !row.checkpoint) return;
      busy = true; error = ""; emit();
      try {
        // The source stays intact until its copy is durable; CAS marks only this copied version; source input remains intact.
        editor.resetSession(editor.getState().identity);
        if (editor.restoreDraft(row.checkpoint) !== "applied") throw new Error("草稿校验失败，原数据保留。");
        recovery = []; emit();
        if (!(await flush())) throw new Error("草稿副本尚未保留，原草稿仍保留。");
        if (editor.getState().inFlight) await dispatch();
        if (!editor.getState().inFlight) editor.compareLatestView(await service.read(characterId));
        await flush();
        try { await service.acknowledgeCopy(row.draftId, row.version); } catch {
          notice = "已恢复草稿副本；来源草稿已变化，继续保留。";
        }
        if (!notice) notice = "已恢复本机草稿，请确认内容后正式保存。";
      } catch (e) { error = e instanceof Error ? e.message : "草稿恢复失败，原数据保留。"; }
      finally { busy = false; emit(); }
    },
    resolve(decisions: Record<string, "local" | "remote">) {
      const issues = editor.resolveConflict(decisions);
      error = issues.length ? "请为每个冲突字段选择要保留的内容。" : "";
      if (!issues.length) { notice = "已核对新版本，当前修改仍需正式保存。"; schedule(); }
      emit(); return issues.length === 0;
    },
    async discard() {
      if (busy || editor.getState().inFlight) return false;
      if (!(await flush())) { error = "无法安全处理草稿，输入继续保留，请重试。"; emit(); return false; }
      const state = editor.getState();
      try {
        await service.discard(state.identity.draftId, state.retainedDraftVersion ?? state.draftVersion);
        discarded = true; clearTimeout(timer); return true;
      } catch (e) { error = e instanceof Error ? e.message : "放弃失败，输入继续保留。"; emit(); return false; }
    },
    suspend() { clearTimeout(timer); if (!discarded) void flush(); },
  };
  return runtime;
}
export type EditorRuntime = ReturnType<typeof createEditorRuntime>;
