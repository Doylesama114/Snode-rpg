import type { CommitReceipt, ManagementView, RetentionTicket, UpdateManagementCommand } from
  "../../../../../docs/proposals/character-management/contracts.ts";
import { validateCommitReceipt, validateManagementView, validateUpdateCommand } from
  "../../../../../docs/proposals/character-management/validation.ts";
import { validateDraftCheckpoint } from "../../../../../docs/proposals/character-management/draft.ts";

export const previewScope = "snode-local-preview";
export interface CharacterRow { view: ManagementView; updatedAt: number }
export interface DraftRow {
  draftId: string; characterId: string; version: number; updatedAt: number;
  deleted: boolean; copiedVersion?: number; checkpoint: RetentionTicket | null;
}
export type CommitOutcome = { kind: "committed"; receipt: CommitReceipt } |
  { kind: "conflict"; view: ManagementView };
/** Replace this port with the authenticated service after the common model is reviewed. */
export interface CharacterService {
  list(): Promise<CharacterRow[]>;
  read(id: string): Promise<ManagementView>;
  create(): Promise<ManagementView>;
  commit(command: UpdateManagementCommand): Promise<CommitOutcome>;
  history(id: string): Promise<ManagementView[]>;
  drafts(id: string): Promise<DraftRow[]>;
  retain(checkpoint: RetentionTicket): Promise<void>;
  acknowledgeCopy(draftId: string, expectedVersion: number): Promise<void>;
  discard(draftId: string, expectedVersion: number): Promise<void>;
}

const stores = ["characters", "snapshots", "commands", "drafts"] as const;
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("本机存储读取失败")); });
}
function view(input: unknown): ManagementView {
  const checked = validateManagementView(input);
  if (!checked.ok) throw new Error("本机角色数据校验失败，原记录保留，请勿重置浏览器存储。");
  return checked.value;
}
function draft(input: unknown): DraftRow {
  const r = input as Partial<DraftRow> | null;
  if (!r || typeof r.draftId !== "string" || typeof r.characterId !== "string" ||
      !Number.isSafeInteger(r.version) || (r.version ?? -1) < 0 ||
      typeof r.updatedAt !== "number" || typeof r.deleted !== "boolean") {
    throw new Error("草稿记录校验失败，原数据保留。");
  }
  if (!r.deleted) {
    const checked = validateDraftCheckpoint(r.checkpoint);
    if (!checked.ok || checked.value.contextKey !== previewScope ||
        checked.value.draftId !== r.draftId || checked.value.characterId !== r.characterId ||
        checked.value.draftVersion !== r.version) throw new Error("草稿检查点校验失败，原数据保留。");
  }
  return r as DraftRow;
}
const initial = (id: string, name: string, story: string, hp: number | null): ManagementView => ({
  viewSchemaVersion: 1, characterId: id, characterRevision: 1, lifecycle: "active",
  profile: { displayName: name, story }, editableProfileFields: ["displayName", "story"],
  numericFields: [
    { fieldRef: "hp.current", label: "当前 HP", value: hp, editable: true },
    { fieldRef: "fp.current", label: "当前 FP", value: 0, editable: true },
    { fieldRef: "hp.temporary", label: "临时生命", value: null, editable: true },
    { fieldRef: "shield.manual", label: "手工护盾", value: null, editable: true },
    { fieldRef: "exhaustion.manual", label: "手工力竭", value: null, editable: true },
  ],
});

/**
 * LOCAL DEVELOPMENT ONLY. Stored views are anonymous preview fixtures, never production CharacterData.
 * One IndexedDB transaction commits current view, immutable snapshot and idempotency receipt.
 * No login/DM authorization, cloud synchronization, asset ledger or rule calculations.
 */
export function createLocalCharacterService(factory: IDBFactory = indexedDB): CharacterService {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      let rejected = false;
      const r = factory.open("snode-character-preview-v1", 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore("characters", { keyPath: "view.characterId" });
        db.createObjectStore("snapshots", { keyPath: ["characterId", "characterRevision"] });
        db.createObjectStore("commands", { keyPath: "commandId" });
        const d = db.createObjectStore("drafts", { keyPath: "draftId" });
        d.createIndex("characterId", "characterId");
        for (const v of [
          initial("preview-journey", "行旅者", "在旧城的灯火熄灭之前，记下这段旅程。\n这是一份匿名示例，可以自由修改。", 12),
          initial("preview-star", "观星者", "角色名、经历和数值分别编辑，保存后形成新的历史快照。", 0),
        ]) {
          r.transaction!.objectStore("characters").put({ view: v, updatedAt: Date.now() });
          r.transaction!.objectStore("snapshots").put({ ...v });
        }
      };
      r.onblocked = () => { rejected = true; reject(new Error("本机存储正在等待其他页面关闭，请关闭旧版本页面后重试。")); };
      r.onerror = () => reject(r.error ?? new Error("无法打开本机存储"));
      r.onsuccess = () => {
        const db = r.result; if (rejected) { db.close(); return; }
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
    return connection;
  }
  async function transaction<T>(names: string[], mode: IDBTransactionMode,
    work: (get: (name: string) => IDBObjectStore) => Promise<T>): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result: T, failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("本机存储事务中止，未写入记录。"));
      tx.onerror = () => { failure ??= tx.error; };
      work(name => tx.objectStore(name)).then(value => { result = value; })
        .catch(error => { failure = error; try { tx.abort(); } catch { reject(error); } });
    });
  }
  return {
    async list() {
      return transaction(["characters"], "readonly", async get =>
        (await request(get("characters").getAll()) as CharacterRow[])
          .map(r => ({ view: view(r.view), updatedAt: r.updatedAt }))
          .sort((a, b) => b.updatedAt - a.updatedAt));
    },
    async read(id) {
      return transaction(["characters"], "readonly", async get => {
        const row = await request(get("characters").get(id)) as CharacterRow | undefined;
        if (!row) throw new Error("找不到该角色，当前输入没有被覆盖。");
        return view(row.view);
      });
    },
    async create() {
      const v = initial(crypto.randomUUID(), "未命名档案", "", null);
      await transaction(["characters", "snapshots"], "readwrite", async get => {
        get("characters").add({ view: v, updatedAt: Date.now() }); get("snapshots").add(v);
      });
      return v;
    },
    async commit(command) {
      return transaction([...stores].filter(s => s !== "drafts"), "readwrite", async get => {
        const existing = await request(get("commands").get(command.commandId)) as
          { fingerprint: string; receipt: unknown } | undefined;
        if (existing) {
          if (existing.fingerprint !== JSON.stringify(command)) throw new Error("命令编号重复且内容不一致，记录未覆盖。");
          const checked = validateCommitReceipt(existing.receipt);
          if (!checked.ok) throw new Error("命令结果校验失败，请核实同一命令。");
          return { kind: "committed", receipt: checked.value } as const;
        }
        const row = await request(get("characters").get(command.characterId)) as CharacterRow | undefined;
        if (!row) throw new Error("角色不存在。");
        const old = view(row.view);
        const checked = validateUpdateCommand(command, new Set(old.numericFields.map(f => f.fieldRef)));
        if (!checked.ok || old.lifecycle !== "active") throw new Error("修改内容或角色状态不允许保存。");
        if (old.characterRevision !== command.expectedRevision) return { kind: "conflict", view: old } as const;
        const profile = { ...old.profile }, fields = old.numericFields.map(f => ({ ...f }));
        for (const e of command.edits) {
          if (e.kind === "set-profile") {
            if (!old.editableProfileFields.includes(e.field)) throw new Error("字段不可编辑。");
            profile[e.field] = e.value;
          } else {
            const f = fields.find(f => f.fieldRef === e.fieldRef);
            if (!f?.editable) throw new Error("数值不可编辑。");
            f.value = e.kind === "clear-number" ? null : e.value;
          }
        }
        const next = view({ ...old, characterRevision: old.characterRevision + 1, profile, numericFields: fields });
        const receipt: CommitReceipt = { commandId: command.commandId,
          submittedDraftVersion: command.submittedDraftVersion, view: next };
        get("characters").put({ view: next, updatedAt: Date.now() });
        get("snapshots").add(next);
        get("commands").add({ commandId: command.commandId, fingerprint: JSON.stringify(command), receipt });
        return { kind: "committed", receipt } as const;
      });
    },
    async history(id) {
      return transaction(["snapshots"], "readonly", async get =>
        (await request(get("snapshots").getAll()) as unknown[]).map(view)
          .filter(v => v.characterId === id).sort((a, b) => b.characterRevision - a.characterRevision));
    },
    async drafts(id) {
      return transaction(["drafts"], "readonly", async get =>
        (await request(get("drafts").index("characterId").getAll(id)) as unknown[])
          .map(draft).filter(r => !r.deleted && r.version !== r.copiedVersion).sort((a, b) => b.updatedAt - a.updatedAt));
    },
    async retain(checkpoint) {
      const checked = validateDraftCheckpoint(checkpoint);
      if (!checked.ok || checkpoint.contextKey !== previewScope) throw new Error("不能保留无效草稿。");
      await transaction(["drafts"], "readwrite", async get => {
        const previous = await request(get("drafts").get(checkpoint.draftId)) as unknown;
        if (previous !== undefined) {
          const old = draft(previous);
          if (old.deleted || old.characterId !== checkpoint.characterId ||
              old.checkpoint?.editorSessionId !== checkpoint.editorSessionId ||
              old.version > checkpoint.draftVersion) throw new Error("草稿已被放弃或存在更新版本。");
        }
        const copiedVersion = previous === undefined ? undefined : draft(previous).copiedVersion;
        get("drafts").put({ ...(copiedVersion === undefined ? {} : { copiedVersion }), draftId: checkpoint.draftId, characterId: checkpoint.characterId,
          version: checkpoint.draftVersion, updatedAt: Date.now(), deleted: false, checkpoint });
      });
    },
    async acknowledgeCopy(draftId, expectedVersion) {
      await transaction(["drafts"], "readwrite", async get => {
        const previous = await request(get("drafts").get(draftId)) as unknown;
        if (previous === undefined) return;
        const old = draft(previous);
        if (old.deleted || old.version !== expectedVersion) throw new Error("来源草稿已变化，继续保留。");
        // Retain original input; another live page may still append a newer version.
        get("drafts").put({ ...old, copiedVersion: expectedVersion });
      });
    },
    async discard(draftId, expectedVersion) {
      await transaction(["drafts"], "readwrite", async get => {
        const previous = await request(get("drafts").get(draftId)) as unknown;
        if (previous === undefined) return;
        const old = draft(previous);
        if (old.deleted) return;
        if (old.version !== expectedVersion) throw new Error("草稿已更新，未删除较新的输入。");
        get("drafts").put({ ...old, version: old.version + 1, deleted: true, checkpoint: null });
      });
    },
  };
}
