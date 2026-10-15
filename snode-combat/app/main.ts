import './style.css';
import tutorialData from '../data/encounters/tutorial-01.json';
import { BoardRenderer } from '../render/board-renderer';
import { CardCatalog, buildCatalog } from '../core/catalog';
import { PveGame } from '../core/pve-game';
import { buildPveEncounter, createPlayerUnit } from '../core/combatant-factory';
import { SeededRng } from '../core/rng';
import { normalizeAttrs } from '../core/unit';
import { extractDiceSequence } from '../core/dice-interaction';
import type { PoisonCardData } from '../core/poisons';
import type { AbilityCardData, EncounterCardData, MonsterCardData, StatusCardData } from '../core/cards';
import type { UnitInstance } from '../core/unit';
import type { RollEvent } from '../core/resolver';
import { previewAbility, previewAttackRoll, type AbilityPreview } from '../core/resolver';
import { directionFromTo, line8Cells } from '../core/geometry';
import { createBasicAttackAbility } from '../core/basic-actions';

const abilityModules = import.meta.glob('../data/cards/abilities/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const statusModules = import.meta.glob('../data/cards/statuses/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const monsterModules = import.meta.glob('../data/cards/monsters/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const poisonModules = import.meta.glob('../data/cards/poisons/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const allAbilities = Object.values(abilityModules) as unknown as AbilityCardData[];
const abilities = allAbilities.filter((a) => a.active !== false && a.category === 'skill' && a.id !== 'rogue-shadow-blade');
const statuses = Object.values(statusModules) as unknown as StatusCardData[];
const monsters = Object.values(monsterModules) as unknown as MonsterCardData[];
const poisonCatalog = new Map<string, PoisonCardData>(
  Object.values(poisonModules).map((p) => { const poison = p as PoisonCardData; return [poison.id, poison]; }),
);
const encounterData = tutorialData as unknown as EncounterCardData;

const { catalog, errors } = buildCatalog({ abilities: allAbilities, statuses, monsters, encounters: [encounterData] });
if (errors.length > 0) throw new Error(errors.map((e) => e.message).join('\n'));

const player = createPlayerUnit({
  id: 'pc-demo',
  name: '游荡者·演示',
  class: '游荡者',
  level: 3,
  attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
  hpMax: 20,
  fpMax: 10,
  ac: 14,
  speed: 6,
  keyAttr: '敏捷',
  proficiency: 2,
  weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1, 手弩: 1, 火枪: 1 },
  weapon: {
    id: 'demo-rapier', name: '刺剑', category: '剑类', tags: ['剑', '单手'], hands: 1,
    dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent',
  },
  inventoryTags: ['沙袋', '基础毒药'],
});
player.ammo.set('箭矢', { type: '箭矢', reserve: 20, loaded: true });
player.ammo.set('弹药', { type: '弹药', reserve: 20, loaded: true });

const rng = new SeededRng(20260816);
const encounter = buildPveEncounter(encounterData, catalog.monsters, player, rng);
const enemyOrder = encounter.units.filter((u) => u.team === 'enemy');
encounter.initiative = [
  { unitId: player.id, total: 99, mode: 'fixed' },
  ...enemyOrder.map((u, i) => ({ unitId: u.id, total: 20 - i, mode: 'fixed' as const })),
];

const game = new PveGame(encounter, {
  rng, catalog, playerAbilities: allAbilities, poisonCatalog,
  pauseEnemyTurns: true,
});

const boardHost = document.querySelector<HTMLElement>('#board-root');
const logEl = document.querySelector<HTMLDivElement>('#log');
const statusEl = document.querySelector<HTMLDivElement>('#status');
const abilityListEl = document.querySelector<HTMLDivElement>('#ability-list');
const poisonListEl = document.querySelector<HTMLDivElement>('#poison-list');
const diceOverlay = document.querySelector<HTMLDivElement>('#dice-overlay');
const diceLabel = document.querySelector<HTMLDivElement>('#dice-label');
const diceFace = document.querySelector<HTMLDivElement>('#dice-face');
const diceValues = document.querySelector<HTMLDivElement>('#dice-values');
const diceButton = document.querySelector<HTMLButtonElement>('#dice-roll');
if (!boardHost || !logEl || !statusEl || !abilityListEl || !poisonListEl || !diceOverlay || !diceLabel || !diceFace || !diceValues || !diceButton) throw new Error('缺少 DOM 节点');

const renderer = new BoardRenderer({ cellSize: 56 });
await renderer.init(boardHost, encounter.board, encounter.units);

let selectedMover: UnitInstance | null = null;
let selectedTarget: UnitInstance | null = null;
let pendingAbility: AbilityCardData | null = null;
let pendingPreview: AbilityPreview | null = null;
let pendingPhantomFlightMode: 0 | 1 | null = null;
let pendingElusiveMark: 'moving' | 'selecting' | null = null;

function log(text: string): void {
  logEl!.textContent = `${new Date().toLocaleTimeString()}  ${text}\n${logEl!.textContent ?? ''}`.slice(0, 6000);
}

function syncStatus(): void {
  syncBottomBar();
  statusEl!.textContent = game.phase === 'ended'
    ? `战斗结束：${encounter.outcome === 'victory' ? '胜利' : encounter.outcome === 'defeat' ? '失败' : encounter.outcome}`
    : `阶段：${game.phase}｜轮次：${encounter.round}｜当前：${encounter.currentUnit?.name ?? '-'}｜玩家 FP ${player.fp}/${player.fpMax}｜连击点 ${player.comboPoints}`;
}

function describeDice(events: RollEvent[]): string {
  const seq = extractDiceSequence(events);
  const playerText = seq.player.map((s) => `${s.label} ${s.count}D${s.sides}=[${s.values.join(',')}]`).join('；');
  const autoText = seq.auto.map((s) => `${s.label} ${s.count}D${s.sides}=[${s.values.join(',')}]`).join('；');
  return `玩家掷骰 ${seq.player.length} 步：${playerText || '无'}｜自动 ${seq.auto.length} 步：${autoText || '无'}`;
}

let busy = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForDiceClick(): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      diceButton!.removeEventListener('click', handler);
      resolve();
    };
    diceButton!.addEventListener('click', handler);
  });
}

async function animateDice(step: { sides: number; values: number[]; mappedValues?: number[] }): Promise<void> {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  diceFace!.classList.add('rolling');
  const started = performance.now();
  while (performance.now() - started < 520) {
    const raw = 1 + Math.floor(Math.random() * Math.min(step.sides, 6));
    diceFace!.textContent = faces[raw - 1] ?? String(raw);
    await sleep(60);
  }
  diceFace!.classList.remove('rolling');
  const mapped = step.mappedValues?.[0];
  diceFace!.textContent = faces[(mapped ?? step.values[0] ?? 1) - 1] ?? String(mapped ?? step.values[0]);
  diceValues!.textContent = step.mappedValues
    ? `结果 ${mapped}（原始 D6=${step.values.join(',')}）`
    : `结果 ${step.values.join(',')}`;
  await sleep(420);
}

async function playDiceSequence(events: RollEvent[]): Promise<void> {
  const seq = extractDiceSequence(events);
  if (seq.player.length === 0 && seq.auto.length === 0) return;
  busy = true;
  diceOverlay!.classList.remove('hidden');
  try {
    for (const step of seq.player) {
      diceLabel!.textContent = `你的回合：${step.label}`;
      diceFace!.textContent = '?';
      diceValues!.textContent = '';
      diceButton!.style.display = '';
      await waitForDiceClick();
      diceButton!.style.display = 'none';
      await animateDice(step);
    }
    for (const step of seq.auto) {
      diceLabel!.textContent = `自动结算：${step.label}`;
      diceFace!.textContent = '?';
      diceValues!.textContent = '';
      diceButton!.style.display = 'none';
      await sleep(350);
      await animateDice(step);
    }
  } finally {
    diceOverlay!.classList.add('hidden');
    busy = false;
  }
}

function showResultEffects(result: { damageByTarget: Map<string, number>; appliedStatuses?: Array<{ targetId: string; status: string; layers: number }> }): void {
  for (const [id, amount] of result.damageByTarget) {
    const unit = encounter.unitById(id);
    if (unit && amount > 0) renderer.showFloatingText(unit.x, unit.y, `-${amount}`, 0xff5f56);
  }
  for (const applied of result.appliedStatuses ?? []) {
    const unit = encounter.unitById(applied.targetId);
    if (unit) renderer.showFloatingText(unit.x, unit.y, `${applied.status}${applied.layers > 1 ? `×${applied.layers}` : ''}`, 0xd4a54a);
  }
}

function syncBottomBar(): void {
  const mainSlot = document.querySelector<HTMLDivElement>('#slot-main');
  const bonusSlot = document.querySelector<HTMLDivElement>('#slot-bonus');
  const reactCount = document.querySelector<HTMLSpanElement>('#react-count');
  const moveCount = document.querySelector<HTMLSpanElement>('#move-count');
  const weaponSlot = document.querySelector<HTMLDivElement>('#weapon-slot');
  mainSlot?.classList.toggle('on', player.actions.main);
  mainSlot?.classList.toggle('off', !player.actions.main);
  bonusSlot?.classList.toggle('on', player.actions.bonus);
  bonusSlot?.classList.toggle('off', !player.actions.bonus);
  if (reactCount) reactCount.textContent = `${Math.max(0, player.actions.reactionMax - player.actions.reactionUsed)}/${player.actions.reactionMax}`;
  if (moveCount) moveCount.textContent = `${player.moveBudget}${player.moveMode === 'dash' ? ' 冲刺' : ''}`;
  if (weaponSlot) weaponSlot.textContent = `武器：${player.weapon?.name ?? '徒手'}${player.offhand ? ` + ${player.offhand.name}` : ''}`;
}

function clearSelection(): void {
  selectedMover = null;
  selectedTarget = null;
  pendingAbility = null;
  pendingPreview = null;
  pendingPhantomFlightMode = null;
  renderer.clearHighlights();
  document.querySelectorAll<HTMLButtonElement>('#ability-list button').forEach((b) => b.classList.remove('active'));
}

function syncBoard(): void {
  renderer.setObjects({ silhouettes: game.silhouettes, zones: game.zones });
  renderer.sync();
  renderer.clearHighlights();
  if (selectedMover === player && game.phase === 'playerTurn') {
    const cells = encounter.board.reachableCells(player, encounter.units, player.moveBudget);
    renderer.highlightCells([...cells.keys()].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x as number, y: y as number };
    }));
  }
  if (selectedTarget) renderer.highlightSelectedUnit(selectedTarget);
  if (pendingElusiveMark === 'moving') {
    const cells = encounter.board.reachableCells(player, encounter.units, player.effectiveSpeed());
    renderer.highlightCells([...cells.keys()].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x as number, y: y as number };
    }), 0x9bd46b, 0.25);
  }
  if (pendingElusiveMark === 'selecting') {
    renderer.highlightCells(game.elusivePathCandidates, 0x9bd46b, 0.55);
  }
  if (pendingPhantomFlightMode !== null) {
    const cells: { x: number; y: number }[] = [];
    for (const dir of ['N','NE','E','SE','S','SW','W','NW'] as const) {
      cells.push(...line8Cells({ x: player.x, y: player.y }, dir, 6));
    }
    renderer.highlightCells(cells, 0xd46bd4, 0.22);
  }
  if (pendingAbility && pendingPreview) {
    if (pendingPreview.areaCells.length > 0) renderer.highlightAreaCells(pendingPreview.areaCells);
    renderer.highlightTargetUnits(pendingPreview.targets);
    if (pendingAbility.id === 'rogue-spin-blade-song') {
      const cells: { x: number; y: number }[] = [];
      for (let dx = -12; dx <= 12; dx += 1) {
        for (let dy = -12; dy <= 12; dy += 1) {
          const x = player.x + dx; const y = player.y + dy;
          if (Math.abs(dx) + Math.abs(dy) <= 12 && encounter.board.isPassable(x, y)) cells.push({ x, y });
        }
      }
      renderer.highlightCells(cells, 0xd46bd4, 0.18);
    }
  }
  syncStatus();
}

function showAbilityPreview(ability: AbilityCardData): void {
  pendingPreview = previewAbility(ability, player, encounter, {
    rng,
    statusCatalog: catalog.statuses,
    level: player.card.level,
  });
  renderer.clearHighlights();
  if (pendingPreview.areaCells.length > 0) renderer.highlightAreaCells(pendingPreview.areaCells);
  renderer.highlightTargetUnits(pendingPreview.targets);
  if (pendingPreview.targets.length === 0) log(`  ${ability.name}：当前没有合法目标`);
  if (pendingPreview.conditionErrors.length > 0) log(`  ${ability.name} 条件：${pendingPreview.conditionErrors.join('；')}`);
  if (pendingPreview.costError) log(`  ${ability.name} 费用：${pendingPreview.costError}`);
  for (const target of pendingPreview.targets) {
    const preview = previewAttackRoll(ability, player, target, encounter, {
      rng, statusCatalog: catalog.statuses, level: player.card.level,
    });
    if (preview) {
      log(`  ${ability.name} → ${target.name}：d20${preview.bonus >= 0 ? '+' : ''}${preview.bonus} vs AC${preview.vsAc}，预计命中 ${(preview.hitChance * 100).toFixed(0)}%${preview.mode === 'disadvantage' ? '（劣势）' : ''}`);
    }
  }
}

renderer.setCallbacks({
  onUnitClick(unit) {
    if (pendingAbility) {
      const ability = pendingAbility;
      const selfTarget = pendingPreview?.targets.some((u) => u.id === player.id && unit.id === player.id) ?? false;
      if (selfTarget) {
        if (ability.id === 'rogue-spin-blade-song') {
          log('旋刃魂曲：请点击12米内一个格子作为3×3区域中心');
          return;
        }
        void (async () => {
          if (busy) return;
          const result = game.playerUseAbility(ability.id, [player.id]);
          log(`${ability.name} → ${result.ok ? '执行成功' : `失败：${result.reason}`}`);
          if (result.ok) {
            await playDiceSequence(result.events);
            log(describeDice(result.events));
            showResultEffects(result);
          }
          clearSelection();
          syncBoard();
        })();
        return;
      }
      const isArea = pendingPreview?.ability.targeting.kind === 'area';
      const isLegal = pendingPreview?.targets.some((u) => u.id === unit.id) ?? false;
      if (!isLegal) {
        log(`${ability.name}：${unit.name} 不是合法目标`);
        return;
      }
      const targets = isArea
        ? pendingPreview?.targets.map((u) => u.id) ?? [unit.id]
        : [unit.id];
      void (async () => {
        if (busy) return;
        const result = game.pendingFeint
          ? game.playerFeintReplace(ability.id, unit.id)
          : game.pendingChainAssault
            ? game.playerChainAssaultSkill(ability.id, unit.id)
            : game.playerUseAbility(ability.id, targets);
        log(`${ability.name} → ${result.ok ? '执行成功' : `失败：${result.reason}`}`);
        if (result.ok) {
          await playDiceSequence(result.events);
          log(describeDice(result.events));
          result.appliedStatuses.forEach((s) => log(`  ${s.targetId} 获得 ${s.status} ${s.layers} 层`));
          showResultEffects(result);
        }
        clearSelection();
        syncBoard();
      })();
      return;
    }
    selectedTarget = unit;
    renderer.clearHighlights();
    renderer.highlightSelectedUnit(unit);
    log(`选中目标 ${unit.name}（HP ${unit.hp}/${unit.hpMax}）`);
    const basic = createBasicAttackAbility(player);
    if (basic) {
      const preview = previewAttackRoll(basic, player, unit, encounter, {
        rng, statusCatalog: catalog.statuses, level: player.card.level,
      });
      if (preview) log(`  基础攻击命中预览：d20${preview.bonus >= 0 ? '+' : ''}${preview.bonus} vs AC${preview.vsAc}，预计 ${(preview.hitChance * 100).toFixed(0)}%${preview.mode === 'disadvantage' ? '（劣势）' : ''}`);
    }
  },
  onObjectClick(id) {
    if (busy) return;
    const result = game.playerAttackSilhouette(id);
    log(result.ok ? `剪影攻击造成 ${[...result.damageByTarget.values()][0] ?? 0} 生命流失` : `剪影攻击失败：${result.reason}`);
    if (result.ok) {
      void playDiceSequence(result.events);
      showResultEffects(result);
    }
    clearSelection();
    syncBoard();
  },
  onCellClick(x, y) {
    if (pendingElusiveMark === 'selecting') {
      const r = game.playerMarkElusiveTeleportOnPath(x, y);
      log(r.ok ? `已标记位移路径格 (${x},${y})，飘忽不定结束时跃迁` : `标记失败：${r.reason}`);
      if (r.ok) pendingElusiveMark = null;
      syncBoard();
      return;
    }
  if (pendingPhantomFlightMode !== null) {
      const dir = directionFromTo({ x: player.x, y: player.y }, { x, y });
      if (!dir) { log('请选择幻影匕首飞行方向上的格子'); return; }
      const r = game.playerPhantomDaggerFlight(dir, pendingPhantomFlightMode);
      log(r.ok ? `幻影匕首飞行：${r.events.at(-1)?.detail}` : `飞行失败：${r.reason}`);
      if (r.ok) void playDiceSequence(r.events);
      clearSelection(); syncBoard();
      return;
    }
    if (pendingAbility?.id === 'rogue-spin-blade-song') {
      const result = game.playerCastSpinBladeSong(x, y);
      log(result.ok ? `旋刃魂曲：中心(${x},${y})，命中${result.damageByTarget.size}名角色` : `旋刃魂曲失败：${result.reason}`);
      if (result.ok) {
        void playDiceSequence(result.events);
        showResultEffects(result);
      }
      clearSelection();
      syncBoard();
      return;
    }
    if (!selectedMover || selectedMover.id !== player.id || game.phase !== 'playerTurn') return;
    const result = game.playerMoveTo(x, y);
    log(result.ok ? `移动至 (${x},${y})，消耗 ${result.cost} 步（${result.activated}）` : `移动失败：${result.reason}`);
    if (result.ok && game.pendingSprintBurst) {
      const burst = game.playerFinishSprintBurst();
      log(burst.ok ? `冲刺爆发：强制攻击 ${burst.targetId ?? ''} 造成 ${burst.damage} 伤害` : `冲刺爆发：${burst.reason}`);
      if (burst.ok) log(describeDice(burst.events));
    }
    if ((pendingElusiveMark as string) === 'selecting') {
      syncBoard();
    } else {
      clearSelection();
      syncBoard();
    }
  },
});

interface ReactionChoice {
  id: string;
  label: string;
  enabled: boolean;
}

function showReactionPopup(title: string, description: string, choices: ReactionChoice[]): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'reaction-overlay';
    const box = document.createElement('div');
    box.className = 'reaction-box';
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('div');
    p.className = 'muted';
    p.textContent = description;
    box.appendChild(h);
    box.appendChild(p);
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.textContent = choice.label;
      btn.disabled = !choice.enabled;
      btn.addEventListener('click', () => {
        overlay.classList.add('reaction-overlay-leave');
        setTimeout(() => {
          overlay.remove();
          resolve(choice.id);
        }, 180);
      });
      box.appendChild(btn);
    }
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('reaction-overlay-in'));
  });
}

async function endPlayerTurn(): Promise<void> {
  if (game.phase !== 'playerTurn' || busy) return;
  busy = true;
  game.playerEndTurn();
  log('玩家结束回合');
  while ((game.phase as string) === 'enemyTurn') {
    const enemy = game.currentUnit;
    const enemyCanAct = enemy && enemy.hp > 0
      && !enemy.hasCondition('unconscious')
      && !enemy.hasCondition('paralyzed')
      && !enemy.hasCondition('charmed');
    if (enemy && enemyCanAct) {
      const canAnticipate = game.player.canUseUsage('rogue-anticipate:shortRest', 1);
      const canLock = game.player.canUseAction('reaction') && game.player.canUseUsage('rogue-throat-lock:offturn-perBattle', 1);
      const choice = await showReactionPopup(
        `${enemy.name} 即将行动`,
        '选择是否使用回合外反应能力，然后继续。',
        [
          { id: 'anticipate', label: '克敌先机：敌方攻击劣势', enabled: canAnticipate },
          { id: 'lock', label: '锁喉：消耗1次反应沉默目标', enabled: canLock },
          { id: 'continue', label: '继续', enabled: true },
        ],
      );
      if (choice === 'anticipate') {
        game.declareAnticipateAgainst(enemy.id);
        log(`克敌先机：${enemy.name} 的下次攻击获得劣势`);
      } else if (choice === 'lock') {
        const lock = game.playerUseLockThroatOffTurn(enemy.id);
        log(lock.ok ? `锁喉：${enemy.name} 被沉默` : `锁喉失败：${lock.reason}`);
        if (lock.ok) {
          await playDiceSequence(lock.events);
          log(describeDice(lock.events));
        }
      }
    }
    game.stepEnemyTurn();
    if (game.pendingFeignRequest) {
      const request = game.pendingFeignRequest;
      const accepted = await showReactionPopup(
        '示敌以弱',
        `本次攻击命中并会造成 ${request.damage} 点伤害。花费1次反应动作进入击倒，完全忽视本次伤害及后续效果？`,
        [
          { id: 'yes', label: '进入击倒，忽视伤害', enabled: true },
          { id: 'no', label: '承受伤害', enabled: true },
        ],
      );
      const used = game.resolveFeignWeakness(accepted === 'yes');
      if (used) log('示敌以弱：已进入击倒并忽视本次伤害');
    }
    const events = [...game.consumeEnemyStepEvents(), ...game.lastPlayerExtraEvents];
    game.lastPlayerExtraEvents = [];
    const damage = game.takeEnemyStepDamage();
    if (events.length > 0) {
      await playDiceSequence(events);
      log(describeDice(events));
    }
    showResultEffects({ damageByTarget: damage });
    clearSelection();
    syncBoard();
  }
  busy = false;
  clearSelection();
  syncBoard();
}

document.querySelector<HTMLButtonElement>('#btn-end')?.addEventListener('click', () => void endPlayerTurn());
document.querySelector<HTMLButtonElement>('#btn-bottom-end')?.addEventListener('click', () => void endPlayerTurn());

document.querySelector<HTMLButtonElement>('#btn-reload')?.addEventListener('click', () => {
  const result = game.playerReload();
  log(result.ok ? '装填完成' : `装填失败：${result.reason}`);
  syncStatus();
});

function renderPoisonSelection(): void {
  poisonListEl!.innerHTML = '';
  const hands: Array<{ label: string; weapon: typeof player.weapon }> = [
    { label: '主手', weapon: player.weapon },
  ];
  if (player.offhand) hands.push({ label: '副手', weapon: player.offhand });
  for (const hand of hands) {
    const title = document.createElement('div');
    title.textContent = `${hand.label}毒药`;
    title.style.cssText = 'font-size:12px;color:#d4a54a;margin-top:4px';
    poisonListEl!.appendChild(title);
    for (const poison of poisonCatalog.values()) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = hand.weapon?.appliedPoisons?.includes(poison.id) ?? false;
      box.addEventListener('change', () => {
        const arr = hand.weapon?.appliedPoisons ?? [];
        if (box.checked && !arr.includes(poison.id)) arr.push(poison.id);
        if (!box.checked) {
          const idx = arr.indexOf(poison.id);
          if (idx >= 0) arr.splice(idx, 1);
        }
        if (hand.weapon) hand.weapon.appliedPoisons = arr;
        log(`${hand.label}毒药：${arr.length ? arr.join('、') : '无'}`);
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(poison.name));
      poisonListEl!.appendChild(label);
    }
  }
}

function renderP2Buttons(): void {
  const bar = document.querySelector<HTMLDivElement>('#action-bar');
  if (!bar) return;
  const make = (text: string, onClick: () => void) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    bar.appendChild(btn);
  };
  make('挑衅对决', () => {
    if (!selectedTarget) { log('请先选择敌方目标'); return; }
    const r = game.playerProvokeDuel(selectedTarget.id);
    log(r.ok ? '挑衅对决：双方各移除1次反应使用次数' : `挑衅对决失败：${r.reason}`);
    clearSelection(); syncBoard();
  });
  make('毒性蔓延·单体中毒', () => {
    if (!selectedTarget) { log('请先选择6米内目标'); return; }
    const r = game.playerUseToxinSpread(0, selectedTarget.id);
    log(r.ok ? '毒性蔓延：目标进入中毒' : `毒性蔓延失败：${r.reason}`);
    if (r.ok) void playDiceSequence(r.events);
    clearSelection(); syncBoard();
  });
  make('毒性蔓延·邻接传播', () => {
    if (!selectedTarget) { log('请先选择已中毒目标'); return; }
    const r = game.playerUseToxinSpread(1, selectedTarget.id);
    log(r.ok ? '毒性蔓延：相邻角色进行体质豁免' : `毒性蔓延失败：${r.reason}`);
    if (r.ok) void playDiceSequence(r.events);
    clearSelection(); syncBoard();
  });
  make('毒性蔓延·毒刃翻倍', () => {
    const r = game.playerUseToxinSpread(2, player.id);
    log(r.ok ? '下一次毒刃中毒层数翻倍' : `毒性蔓延失败：${r.reason}`);
    clearSelection(); syncBoard();
  });
  make('毒性蔓延·毒刃附赠', () => {
    const r = game.playerUseToxinSpread(3, player.id);
    log(r.ok ? '下一次毒刃仅需附赠动作' : `毒性蔓延失败：${r.reason}`);
    clearSelection(); syncBoard();
  });
  make('毒性蔓延·L15双效果', () => {
    if (!selectedTarget) { log('请先选择一名目标（用于0/1类效果）'); return; }
    const ea = Number(window.prompt('第一个效果：0中毒/1传播/2毒刃翻倍/3毒刃附赠', '0'));
    const eb = Number(window.prompt('第二个不同效果：0中毒/1传播/2毒刃翻倍/3毒刃附赠', '2'));
    const ta = ea === 2 || ea === 3 ? player.id : selectedTarget.id;
    const tb = eb === 2 || eb === 3 ? player.id : selectedTarget.id;
    const r = game.playerUseToxinSpreadPair(ea, ta, eb, tb);
    log(r.ok ? `毒性蔓延双效果成功` : `毒性蔓延双效果失败：${r.reason}`);
    if (r.ok) void playDiceSequence(r.events);
    clearSelection(); syncBoard();
  });
  make('完成蝶舞引导', () => {
    const points = Number(window.prompt('额外消耗多少连击点？（0-5）', '0') ?? 0);
    const r = game.playerCompleteButterflyDance(points);
    log(r.ok ? `蝶舞第2轮引导完成（额外消耗${game.butterflyExtraCombo}连击点），结束回合后结算终幕` : `蝶舞失败：${r.reason}`);
    clearSelection(); syncBoard();
  });
  make('暗影之刃(主手战前)', () => {
    const r = game.playerPrepareShadowBlade('main');
    log(r.ok ? '主手武器已附魔暗影之刃' : `暗影之刃失败：${r.reason}`);
    syncBoard();
  });
  make('暗影之刃(副手战前)', () => {
    const r = game.playerPrepareShadowBlade('off');
    log(r.ok ? '副手武器已附魔暗影之刃' : `暗影之刃失败：${r.reason}`);
    syncBoard();
  });
  make('幻影匕首飞行', () => {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'] as const;
    const dir = window.prompt('方向：N/NE/E/SE/S/SW/W/NW', 'N') as typeof dirs[number] | null;
    if (!dir || !dirs.includes(dir)) { log('方向无效'); return; }
    const mode = window.prompt('指令：0=沿途攻击；1=落点相邻攻击（L10）', '0') === '1' ? 1 : 0;
    const r = game.playerPhantomDaggerFlight(dir, mode);
    log(r.ok ? `幻影匕首飞行：${r.events.at(-1)?.detail}` : `飞行失败：${r.reason}`);
    if (r.ok) void playDiceSequence(r.events);
    clearSelection(); syncBoard();
  });
  make('飘忽不定标记', () => {
    clearSelection();
    pendingElusiveMark = 'moving';
    log('飘忽不定标记：请点击本次移动范围内的一个可停留格');
    syncBoard();
  });
  make('开始战斗', () => {
    if (game.phase !== 'setup') { log('战斗已经开始'); return; }
    game.start();
    log('P2 教学遭遇已开始。点击己方棋子移动，点击敌方棋子后使用基础攻击或技能。');
    clearSelection(); syncBoard();
  });
}

function renderQuickHandsButton(): void {
  const bar = document.querySelector<HTMLDivElement>('#action-bar');
  if (!bar) return;
  const btn = document.createElement('button');
  btn.textContent = '快攻手(副手)';
  btn.addEventListener('click', () => {
    if (!selectedTarget) { log('请先选择敌方目标'); return; }
    const result = game.playerQuickHands(selectedTarget.id);
    log(result.ok ? `快攻手命中造成 ${result.damage} 伤害` : `快攻手失败：${result.reason}`);
    if (result.ok) log(describeDice(result.events));
    clearSelection(); syncBoard();
  });
  bar.appendChild(btn);
}

function renderAbilities(): void {
  abilityListEl!.innerHTML = '';
  for (const ability of abilities) {
    const btn = document.createElement('button');
    btn.textContent = `${ability.name}（${ability.cast?.action === 'main' ? '1动作' : ability.cast?.action === 'bonus' ? '0动作' : ability.cast?.action ?? '-'}）`;
    btn.addEventListener('click', () => {
      if (game.phase !== 'playerTurn') return;
      clearSelection();
      pendingAbility = ability;
      btn.classList.add('active');
      if (game.pendingFeint) log(`佯攻替换：${ability.name}（用被取消动作施展）`);
      else if (game.pendingChainAssault) log(`连环奇袭：${ability.name}（免费动作，仍付FP）`);
      else log(`已选择技能 ${ability.name}，点击高亮目标释放`);
      showAbilityPreview(ability);
    });
    abilityListEl!.appendChild(btn);
  }
}

function renderAttackButton(): void {
  const bar = document.querySelector<HTMLDivElement>('#action-bar');
  if (!bar) return;
  const btn = document.createElement('button');
  btn.textContent = '基础攻击';
  btn.addEventListener('click', () => {
    if (game.phase !== 'playerTurn') return;
    if (!selectedTarget) {
      log('请先点击一个敌方棋子作为攻击目标');
      return;
    }
    void (async () => {
      if (busy) return;
      const target = selectedTarget;
      const result = game.playerBasicAttack(target.id);
      log(result.ok ? `基础攻击 ${target.name} 造成 ${result.damage} 点伤害` : `攻击失败：${result.reason}`);
    if (game.pendingFeint) log('佯攻：基础攻击未命中，动作已返还，选择一个战技替换');
    if (game.pendingChainAssault) log('连环奇袭：击杀目标，可免费施展一个奇袭战技');
      if (result.ok) {
        await playDiceSequence([...result.events, ...game.lastPlayerExtraEvents]);
        log(describeDice([...result.events, ...game.lastPlayerExtraEvents]));
        showResultEffects({ damageByTarget: new Map([[target.id, result.damage]]) });
        game.lastPlayerExtraEvents.forEach((e) => log(`  ${e.detail}`));
        game.lastPlayerExtraEvents = [];
      }
      clearSelection();
      syncBoard();
    })();
  });
  bar.prepend(btn);
}

renderPoisonSelection();
renderAbilities();
renderAttackButton();
renderQuickHandsButton();
renderP2Buttons();
syncBoard();
syncBottomBar();
log('P2 遭遇就绪：可先涂毒/暗影之刃（战前准备），然后点击“开始战斗”。');
