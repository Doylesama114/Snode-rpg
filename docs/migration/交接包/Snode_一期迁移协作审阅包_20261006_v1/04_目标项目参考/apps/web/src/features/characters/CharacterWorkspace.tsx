import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { planEdits } from "../../../../../docs/proposals/character-management/editor.ts";
import { parseNumberInput } from "../../../../../docs/proposals/character-management/validation.ts";
import type { ManagementView } from "../../../../../docs/proposals/character-management/contracts.ts";
import { createEditorRuntime } from "./editor-runtime.ts";
import type { EditorRuntime } from "./editor-runtime.ts";
import { createLocalCharacterService } from "./local-service.ts";
import type { CharacterRow, CharacterService } from "./local-service.ts";
import "./characters.css";

export type LeaveGuard = (leave: () => void) => void;
type Props = { onExit: () => void; registerGuard: (guard: LeaveGuard | null) => void };

function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="cm-dialog" aria-labelledby="cm-dialog-title"
    onCancel={e => { e.preventDefault(); closeRef.current(); }}>
    <h2 id="cm-dialog-title">{title}</h2>{children}
  </dialog>;
}

function Section({ id, number, title, children }: {
  id: string; number: string; title: string; children: ReactNode;
}) {
  return <section id={id} className="cm-section" aria-labelledby={id + "-title"}>
    <div className="cm-section-heading"><span>{number}</span><h2 id={id + "-title"}>{title}</h2></div>
    {children}
  </section>;
}

function CharacterEditor({ runtime, service, navigate, registerGuard, refreshList }: {
  runtime: EditorRuntime; service: CharacterService; navigate: () => void;
  registerGuard: Props["registerGuard"]; refreshList: () => void;
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [reviewConflict, setReviewConflict] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "local" | "remote">>({});
  const [history, setHistory] = useState<ManagementView[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historical, setHistorical] = useState<ManagementView | null>(null);
  const editor = state.editor, v = editor.base, inputs = editor.inputs;
  const dirty = runtime.editor.hasUncommittedChanges();
  const pending = !!editor.inFlight;
  const blocked = state.loading || state.busy || editor.commitState === "conflict" || pending;
  useEffect(() => {
    void runtime.start();
    const guard: LeaveGuard = next => {
      if (runtime.editor.hasUncommittedChanges() || runtime.editor.getState().inFlight) setLeave(() => next);
      else { runtime.suspend(); next(); }
    };
    registerGuard(guard);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (runtime.editor.hasUncommittedChanges() || runtime.editor.getState().inFlight) {
        e.preventDefault(); e.returnValue = "";
      }
    };
    const flush = () => runtime.suspend();
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      registerGuard(null); runtime.suspend();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [runtime, registerGuard]);
  useEffect(() => {
    if (!v) return;
    let active = true;
    void service.history(v.characterId).then(list => {
      if (active) { setHistory(list); setHistoryError(""); }
    }).catch(() => { if (active) setHistoryError("历史快照读取失败，当前输入保留。"); });
    refreshList();
    return () => { active = false; };
  }, [service, v, refreshList]);
  const issues = v && inputs ? planEdits(v, inputs).issues : [];
  function requestBack() {
    if (dirty || pending) setLeave(() => navigate);
    else { runtime.suspend(); navigate(); }
  }
  async function saveAndLeave() {
    const destination = leave;
    if (await runtime.save()) {
      if (!runtime.editor.hasUncommittedChanges() && !runtime.editor.getState().inFlight && destination) {
        setLeave(null); runtime.suspend(); destination();
      }
    }
  }
  function conflictValue(target: string, remote: boolean): string {
    if (!inputs || !v || !editor.latestConflict) return "";
    if (target.startsWith("profile:")) {
      const field = target.slice(8) as "displayName" | "story";
      return remote ? editor.latestConflict.profile[field] : inputs[field];
    }
    const ref = target.slice(7);
    const field = editor.latestConflict.numericFields.find(f => f.fieldRef === ref);
    return remote ? (!field ? "字段已移除" : field.value === null ? "未记录" : String(field.value)) :
      (inputs.numbers[ref] || "未记录");
  }
  const conflictIssues = editor.commitState === "conflict" ? runtime.editor.resolveConflict({}, true) : [];
  const errorText = state.error || editor.loadError || editor.commitError;
  return <>
    <div className="cm-breadcrumb"><button type="button" className="cm-link" onClick={requestBack}>← 角色列表</button>
      <span>本机档案 / 编辑</span></div>
    {state.loading && <p role="status">正在读取角色与本机草稿…</p>}
    {errorText && <div className="cm-error" role="alert">{errorText}</div>}
    {v && inputs && <>
      <div className="cm-editor-heading"><div><p className="cm-kicker">CHARACTER ARCHIVE</p>
        <h1>{inputs.displayName || "未命名草稿"}</h1>
        <p className="cm-muted">正式记录 · 修订 {v.characterRevision} <span> / </span>
          {dirty ? "有待保存的修改" : "与正式记录一致"}</p>
      </div><span className="cm-badge">本机预览</span></div>
      <div className="cm-editor-grid">
        <aside className="cm-sidebar" aria-label="角色面板分区">
          <p>档案目录</p>{[
            ["cm-profile", "01", "资料与经历"], ["cm-numbers", "02", "当前数值"],
            ["cm-abilities", "03", "成长与能力"], ["cm-assets", "04", "装备与物品"],
            ["cm-status", "05", "手工状态"], ["cm-history", "06", "历史快照"],
          ].map(([id, number, label]) => <button type="button" key={id}
            onClick={() => document.getElementById(id!)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span>{number}</span>{label}</button>)}
          <div className="cm-sidebar-note">记录在本机浏览器中。<br />换设备暂时无法读取。</div>
        </aside>
        <div className="cm-editor-body">
          <form onSubmit={e => { e.preventDefault(); void runtime.save(); }}>
            <Section id="cm-profile" number="01" title="资料与经历">
              <label className="cm-field" htmlFor="cm-name">角色名称
                <input id="cm-name" value={inputs.displayName}
                  readOnly={!v.editableProfileFields.includes("displayName") || v.lifecycle !== "active"}
                  aria-invalid={issues.some(i => i.path === "profile.displayName")}
                  aria-describedby="cm-name-help"
                  onChange={e => runtime.editProfile("displayName", e.target.value)} />
              </label>
              <p id="cm-name-help" className="cm-hint">名称用于展示，改名不会改变角色身份。</p>
              {issues.some(i => i.path === "profile.displayName") &&
                <p className="cm-inline-error">请输入名称；当前预览最多接受 256 个字符单位。</p>}
              <div className="cm-field"><label htmlFor="cm-story">角色经历</label>
                <textarea id="cm-story" rows={7} value={inputs.story}
                  readOnly={!v.editableProfileFields.includes("story") || v.lifecycle !== "active"}
                  aria-invalid={issues.some(i => i.path === "profile.story")}
                  aria-describedby="cm-story-help"
                  onChange={e => runtime.editProfile("story", e.target.value)} />
              </div>
              <p id="cm-story-help" className="cm-hint">保留原文和换行，内容按文本显示。</p>
              {issues.some(i => i.path === "profile.story") &&
                <p className="cm-inline-error">经历超过当前预览预算，原输入仍然保留。</p>}
            </Section>
            <Section id="cm-numbers" number="02" title="当前数值">
              <p className="cm-muted">手工记录当前值。留空表示未记录；此处暂不进行规则计算。</p>
              <div className="cm-numeric-grid">{v.numericFields.map((f, index) => {
                const raw = inputs.numbers[f.fieldRef] ?? "";
                const invalid = parseNumberInput(raw).kind === "invalid";
                return <div key={f.fieldRef}><label className="cm-field" htmlFor={"cm-number-" + index}>{f.label}
                  <input id={"cm-number-" + index} inputMode="decimal" type="text" value={raw}
                    placeholder="未记录" readOnly={!f.editable || v.lifecycle !== "active"}
                    aria-invalid={invalid} aria-describedby={invalid ? "cm-number-error-" + index : "cm-numeric-help"}
                    onChange={e => runtime.editNumber(f.fieldRef, e.target.value)} /></label>
                  {invalid && <p id={"cm-number-error-" + index} className="cm-inline-error">请输入有效数字，原文已保留。</p>}
                </div>;
              })}</div>
              <p id="cm-numeric-help" className="cm-hint">0 会保存为 0；清空会保存为未记录。数值范围待规则接入后确认。</p>
            </Section>
            <Section id="cm-abilities" number="03" title="成长与能力">
              <div className="cm-pending"><span>待接入</span><p>职业、阶位、风格与能力资料将在共同规则数据接入后展示。</p></div>
            </Section>
            <Section id="cm-assets" number="04" title="装备与物品">
              <div className="cm-pending"><span>待接入</span><p>装备与物品记录，以及货币和物品操作将在对应服务接入后开放。</p></div>
            </Section>
            <Section id="cm-status" number="05" title="手工状态">
              <div className="cm-pending"><span>待接入</span><p>状态名称、来源、持续说明和清除操作将在状态数据边界确认后接入。</p></div>
            </Section>
            <Section id="cm-history" number="06" title="历史快照">
              <p className="cm-muted">每次正式保存会增加快照。查看历史不会修改当前记录。</p>
              {historyError && <p role="alert" className="cm-inline-error">{historyError}</p>}
              <div className="cm-history-list">{history.map(h => <button type="button" key={h.characterRevision}
                onClick={() => setHistorical(h)}>
                <span>修订 {h.characterRevision}</span><strong>{h.profile.displayName}</strong><span>查看 →</span>
              </button>)}</div>
            </Section>
            <div className="cm-savebar">
              <div aria-live="polite" role="status">
                <strong>{state.busy ? "正在保存…" : dirty ? "修改尚未正式保存" : "当前内容已核对"}</strong>
                <p>{editor.retentionState === "retained" ? "已保留本机草稿" :
                  editor.retentionState === "failed" ? "草稿保留失败，输入仍在页面中" :
                  editor.retentionState === "writing" || editor.retentionState === "pending" ? "正在保留本机草稿…" : "输入后自动保留草稿"}</p>
              </div>
              <div className="cm-actions">
                {editor.retentionState === "failed" && <button type="button" onClick={() => void runtime.flush()}>重试草稿保留</button>}
                {editor.commitState === "unknown" && <button type="button" disabled={state.busy}
                  onClick={() => void runtime.verify()}>核实保存结果</button>}
                {editor.commitState === "conflict" && <button type="button" onClick={() => {
                  setDecisions({}); setReviewConflict(true);
                }}>核对版本冲突</button>}
                <button className="cm-primary" type="submit" disabled={blocked || !!issues.length || !dirty}>
                  保存正式记录</button>
              </div>
            </div>
            {state.notice && <p className="cm-notice" role="status">{state.notice}</p>}
          </form>
        </div>
      </div>
    </>}
    {leave && <Modal title={pending ? "先核实正在保存的修改" : "还有修改尚未正式保存"}
      close={() => setLeave(null)}>
      <p>{pending ? "当前命令还未确认。输入会保留，核实完成后再离开。" :
        "选择保存后离开，或放弃本页草稿。取消会继续编辑，其他页面的草稿会保留。"}</p>
      {errorText && <p className="cm-inline-error" role="alert">{errorText}</p>}
      <div className="cm-dialog-actions">
        <button type="button" autoFocus onClick={() => setLeave(null)}>继续编辑</button>
        {editor.commitState === "unknown" && <button type="button" disabled={state.busy}
          onClick={() => void runtime.verify()}>核实保存结果</button>}
        <button type="button" disabled={pending || state.busy} onClick={() => {
          void runtime.discard().then(ok => { if (ok) { const next = leave; setLeave(null); next(); } });
        }}>放弃本页草稿并离开</button>
        <button className="cm-primary" type="button" disabled={blocked || !!issues.length}
          onClick={() => void saveAndLeave()}>保存后离开</button>
      </div>
    </Modal>}
    {!leave && state.recovery.length > 0 && <Modal title="找到本机草稿"
      close={() => runtime.ignoreRecovery()}>
      <p>可以恢复一份草稿副本，或先查看正式记录。恢复后仍需确认保存；原检查点会保留。</p>
      <div className="cm-recovery-list">{state.recovery.map(r => <button type="button" key={r.draftId}
        disabled={state.busy} onClick={() => void runtime.recover(r)}>
        <strong>{r.checkpoint?.inputs.displayName || "未命名草稿"}</strong>
        <span>{new Date(r.updatedAt).toLocaleString("zh-CN")} · 基于修订 {r.checkpoint?.baseRevision}</span>
        {r.checkpoint?.inFlight && <span>含待核实的保存命令</span>}
      </button>)}</div>
      <div className="cm-dialog-actions"><button type="button" autoFocus disabled={state.busy}
        onClick={() => runtime.ignoreRecovery()}>先查看正式记录</button></div>
    </Modal>}
    {!leave && reviewConflict && editor.latestConflict && <Modal title="核对角色版本冲突"
      close={() => setReviewConflict(false)}>
      <p>正式记录已更新到修订 {editor.latestConflict.characterRevision}。下面只列出需要你决定的字段；
        其他字段保留各自的修改。</p>
      {conflictIssues.map(i => {
        const ref = i.path;
        const label = ref === "profile:displayName" ? "角色名称" : ref === "profile:story" ? "角色经历" :
          v?.numericFields.find(f => "number:" + f.fieldRef === ref)?.label ?? ref;
        const field = editor.latestConflict?.numericFields.find(f => "number:" + f.fieldRef === ref);
        const localAllowed = ref.startsWith("profile:") ?
          editor.latestConflict?.editableProfileFields.includes(ref.slice(8) as "displayName" | "story") : field?.editable;
        return <fieldset key={ref} className="cm-conflict"><legend>{label}</legend>
          {(["local", "remote"] as const).map(choice => <label key={choice}>
            <input type="radio" name={ref} checked={decisions[ref] === choice}
              disabled={choice === "local" && (!localAllowed || editor.latestConflict?.lifecycle !== "active")}
              onChange={() => setDecisions({ ...decisions, [ref]: choice })} />
            <span>{choice === "local" ? "保留本页输入" : "采用正式记录"}</span>
            <pre>{conflictValue(ref, choice === "remote")}</pre>
          </label>)}</fieldset>;
      })}
      {state.error && <p role="alert" className="cm-inline-error">{state.error}</p>}
      <div className="cm-dialog-actions"><button type="button" autoFocus onClick={() => setReviewConflict(false)}>继续核对</button>
        <button type="button" className="cm-primary" onClick={() => {
          if (runtime.resolve(decisions)) setReviewConflict(false);
        }}>确认合并到草稿</button></div>
    </Modal>}
    {!leave && historical && <Modal title={"历史快照 · 修订 " + historical.characterRevision}
      close={() => setHistorical(null)}>
      <p className="cm-muted">只读查看，不会恢复或覆盖当前记录。</p>
      <h3>{historical.profile.displayName}</h3><p className="cm-story-text">{historical.profile.story || "未填写经历"}</p>
      <dl className="cm-history-values">{historical.numericFields.map(f =>
        <div key={f.fieldRef}><dt>{f.label}</dt><dd>{f.value === null ? "未记录" : f.value}</dd></div>)}</dl>
      <div className="cm-dialog-actions"><button type="button" autoFocus onClick={() => setHistorical(null)}>关闭历史快照</button></div>
    </Modal>}
  </>;
}

export default function CharacterWorkspace({ onExit, registerGuard }: Props) {
  const [service] = useState(() => createLocalCharacterService());
  const [rows, setRows] = useState<CharacterRow[]>([]), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [runtime, setRuntime] = useState<EditorRuntime | null>(null), [creating, setCreating] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  const [refreshList] = useState(() => () => refreshRef.current());
  refreshRef.current = () => {
    void service.list().then(r => { setRows(r); setError(""); }).catch(e => {
      setError(e instanceof Error ? e.message : "角色列表读取失败。");
    }).finally(() => setLoading(false));
  };
  useEffect(() => { refreshList(); }, [refreshList]);
  const filtered = rows.filter(r => r.view.profile.displayName.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="cm-app">
    <a className="skip-link" href="#cm-main" onClick={e => {
      e.preventDefault(); document.getElementById("cm-main")?.focus();
    }}>跳转到角色管理</a>
    <header className="cm-header"><button type="button" className="cm-brand" onClick={onExit}>Snode<span>.</span></button>
      <span>角色档案</span><button type="button" className="cm-link" onClick={onExit}>返回首页 ↗</button></header>
    <div className="cm-preview-note">本机开发预览 · 记录只保存在当前浏览器，尚未连接登录与云端。</div>
    <main id="cm-main" tabIndex={-1}>
      {runtime ? <CharacterEditor key={runtime.editor.getState().identity.editorSessionId}
        runtime={runtime} service={service} navigate={() => { setRuntime(null); refreshList(); }}
        registerGuard={registerGuard} refreshList={refreshList} /> : <>
        <div className="cm-list-heading"><div><p className="cm-kicker">YOUR STORIES, KEPT HERE</p>
          <h1>角色档案</h1><p className="cm-muted">从一份记录开始，留下角色的选择与经历。</p></div>
          <button type="button" className="cm-primary" disabled={creating} onClick={() => {
            setCreating(true); void service.create().then(v => {
              refreshList(); setRuntime(createEditorRuntime(service, v.characterId));
            }).catch(e => setError(e instanceof Error ? e.message : "新增失败，原记录保留。"))
              .finally(() => setCreating(false));
          }}>{creating ? "正在创建…" : "＋ 新增本机档案"}</button></div>
        <div className="cm-list-tools"><label htmlFor="cm-search">查找角色
          <input id="cm-search" type="search" placeholder="输入角色名称" value={search}
            onChange={e => setSearch(e.target.value)} /></label><span>{filtered.length} 份档案</span></div>
        {loading && <p role="status">正在读取本机角色…</p>}
        {error && <div role="alert" className="cm-error">{error}<button type="button" onClick={refreshList}>重试读取</button></div>}
        <div className="cm-card-grid">{filtered.map(r => <button type="button" className="cm-card"
          key={r.view.characterId} onClick={() => setRuntime(createEditorRuntime(service, r.view.characterId))}>
          <div className="cm-card-top"><span>CHARACTER</span><span>修订 {r.view.characterRevision}</span></div>
          <span className="cm-card-title">{r.view.profile.displayName}</span>
          <span className="cm-card-story">{r.view.profile.story || "还没有写下经历"}</span>
          <span className="cm-card-values">{r.view.numericFields.slice(0, 2).map(f =>
            <span key={f.fieldRef}>{f.label}<strong>{f.value === null ? "未记录" : f.value}</strong></span>)}</span>
          <span className="cm-card-bottom">打开角色档案 <span aria-hidden="true">↗</span></span>
        </button>)}</div>
        {!loading && !error && !filtered.length && <div className="cm-empty">{rows.length ? "没有匹配的角色名称。" : "尚无角色档案，可以新增一份本机档案。"}</div>}
        <p className="cm-list-footnote">示例为匿名档案；新增档案暂不执行规则建卡。正式接入后会由共同角色模型提供数据。</p>
      </>}
    </main>
    <footer className="cm-footer"><span>SNODE / CHARACTER ARCHIVES</span><span>让记录有归处，让故事继续。</span></footer>
  </div>;
}
