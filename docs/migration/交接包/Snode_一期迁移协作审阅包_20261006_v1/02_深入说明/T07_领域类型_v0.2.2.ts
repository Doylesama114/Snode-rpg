// T06 model shape candidate. Type-only; no catalog, HTTP, UI, or persistence implementation.
export type DefinitionId = string;

export type InstanceId = string;

export type DefinitionKind =
  | "class" | "race" | "background" | "ability" | "ability-entry" | "ability-list"
  | "style" | "tier" | "feature" | "choice" | "advancement" | "deity" | "domain"
  | "item" | "recipe" | "entity-template" | "status" | "attribute" | "proficiency"
  | "resource" | "rule" | "content" | "mechanism" | "tag" | "damage-type"
  | "domain-aspect" | "mode" | "equipment-slot" | "language";

export interface DefinitionRef { readonly id: DefinitionId; readonly revision: number }

export interface RuleReleaseRef { readonly id: string; readonly manifestHash: string }

export interface SourceEvidence {
  readonly id: string; readonly sourceId: string; readonly locator: string;
  readonly sourceHash: string; readonly review: "unreviewed" | "verified" | "conflict";
  readonly confirmationRefs: readonly string[]; readonly issueRefs: readonly string[];
}

export interface DefinitionRecord<T> {
  readonly id: DefinitionId; readonly revision: number; readonly schemaVersion: number;
  readonly kind: DefinitionKind; readonly name: string; readonly aliases: readonly string[];
  readonly contentRefs: readonly DefinitionRef[]; readonly evidenceRefs: readonly string[];
  readonly tagRefs: readonly DefinitionRef[]; readonly relatedRefs: readonly DefinitionRef[];
  readonly payload: T;
}

export interface RuleRelease {
  readonly ref: RuleReleaseRef; readonly schemaVersion: number;
  readonly definitions: readonly DefinitionRef[];
  readonly assets: readonly { readonly contentHash: string; readonly mediaType: string }[];
  readonly sourceManifestHash: string; readonly acceptedDecisionRefs: readonly DefinitionRef[];
}

export type Recorded<T> =
  | { readonly state: "known"; readonly value: T; readonly evidenceRefs: readonly string[] }
  | { readonly state: "unrecorded" }
  | { readonly state: "unresolved"; readonly inputFactId: string; readonly issueRefs: readonly string[] };

export type SemanticFragment<T> =
  | { readonly state: "confirmed"; readonly value: T; readonly evidenceRefs: readonly string[] }
  | { readonly state: "pending"; readonly rawContentRef: DefinitionRef; readonly issueRefs: readonly string[] };

export interface ContentDocument {
  readonly blocks: readonly ContentBlock[]; readonly evidenceRefs: readonly string[];
}

export interface InlineRun {
  readonly text: string; readonly semanticColor: DefinitionRef | null;
  readonly foregroundHex: string | null; readonly emphasis: "normal" | "bold" | "italic";
}
export interface TableCell {
  readonly runs: readonly InlineRun[]; readonly rowSpan: number; readonly colSpan: number;
  readonly backgroundHex: string | null;
}
export type ContentBlock =
  | { readonly kind: "paragraph"; readonly runs: readonly InlineRun[] }
  | { readonly kind: "table"; readonly rows: readonly (readonly TableCell[])[] }
  | { readonly kind: "asset"; readonly contentHash: string; readonly alt: string }
  | { readonly kind: "definition-link"; readonly target: DefinitionRef };

export interface TierDefinition {
  readonly label: string; readonly order: number;
}

export interface ClassDefinition {
  readonly keyAttributeChoices: readonly DefinitionRef[];
  readonly progressionRule: DefinitionRef; readonly abilityLists: readonly DefinitionRef[];
  readonly initialGrants: readonly DefinitionRef[]; readonly choices: readonly DefinitionRef[];
  readonly advancementCandidates: readonly DefinitionRef[];
  readonly compatibleMainClasses: SemanticFragment<readonly DefinitionRef[]>;
}

export interface AbilityEntry {
  readonly ability: DefinitionRef; readonly sourceList: DefinitionRef;
  readonly sourceClass: DefinitionRef | null; readonly tier: Recorded<DefinitionRef>;
  readonly styles: readonly DefinitionRef[]; readonly acquisitionRule: DefinitionRef;
  readonly sameNameGroup: string;
}

export interface AbilityDefinition {
  readonly detailContent: readonly DefinitionRef[]; readonly relatedTemplates: readonly DefinitionRef[];
  readonly useRuleFragments: readonly DefinitionRef[]; readonly growthRule: DefinitionRef | null;
}

export interface DomainDefinition {
  readonly deity: DefinitionRef; readonly compatibleClasses: readonly DefinitionRef[];
  readonly abilityLists: readonly DefinitionRef[]; readonly initialGrants: readonly DefinitionRef[];
  readonly modeRef: DefinitionRef | null;
}

export type ChoiceValue =
  | { readonly kind: "definitions"; readonly refs: readonly DefinitionRef[] }
  | { readonly kind: "allocation"; readonly amounts: readonly { readonly subject: DefinitionRef; readonly amount: number }[] }
  | { readonly kind: "text"; readonly value: string };

export interface ChoiceRecord {
  readonly uid: InstanceId; readonly choiceDefinition: DefinitionRef;
  readonly value: ChoiceValue; readonly operationId: string; readonly evidenceRefs: readonly string[];
}

export interface DefinitionSelection {
  readonly definition: DefinitionRef; readonly choiceRecordIds: readonly InstanceId[];
}

export interface ClassProgression {
  readonly uid: InstanceId; readonly role: "main" | "sub" | "gift";
  readonly baseClass: Recorded<DefinitionRef>; readonly level: Recorded<number>;
  readonly keyAttribute: Recorded<DefinitionRef>;
  readonly advancement: Recorded<DefinitionRef> | null;
  readonly chosenPathwayRefs: readonly DefinitionRef[];
  readonly sourceFactIds: readonly string[];
}

export interface DomainSelection {
  readonly uid: InstanceId; readonly ownerProgressionId: InstanceId;
  readonly deity: DefinitionRef; readonly domain: DefinitionRef;
  readonly choiceRecordIds: readonly InstanceId[];
}

export interface MainTierUnlock {
  readonly tier: DefinitionRef; readonly operationId: string;
  readonly paymentIds: readonly string[]; readonly evidenceRefs: readonly string[];
}

export type ResolutionBinding =
  | { readonly kind: "class-progress"; readonly progressionId: InstanceId; readonly policy: DefinitionRef }
  | { readonly kind: "pending"; readonly issueRefs: readonly string[] };

export type SlotBinding =
  | { readonly kind: "exempt"; readonly policy: DefinitionRef }
  | { readonly kind: "occupied"; readonly poolId: InstanceId; readonly policy: DefinitionRef }
  | { readonly kind: "pending"; readonly issueRefs: readonly string[] };

export interface AcquisitionRecord {
  readonly uid: InstanceId;
  readonly route: "initial-feature" | "initial-choice" | "learn" | "feat-grant" | "background-grant" | "battle-experience" | "mirror" | "progression-grant" | "manual";
  readonly rule: DefinitionRef; readonly acquiredDefinition: Recorded<DefinitionRef>;
  readonly selectedEntry: DefinitionRef | null;
  readonly grantorRecordId: InstanceId | null; readonly paymentIds: readonly string[];
  readonly choiceRecordIds: readonly InstanceId[]; readonly operationId: string;
  readonly acquisitionOrder: Recorded<number>; readonly evidenceRefs: readonly string[];
}

export interface LearnedAbility {
  readonly uid: InstanceId; readonly entry: Recorded<DefinitionRef>; readonly acquisitionId: InstanceId;
  readonly placement: { readonly kind: "class-list"; readonly progressionId: InstanceId } | { readonly kind: "character" };
  readonly growth: ResolutionBinding; readonly keyAttribute: ResolutionBinding;
  readonly slot: SlotBinding;
  readonly styleParticipation: { readonly kind: "participates"; readonly progressionId: InstanceId } | { readonly kind: "excluded"; readonly policy: DefinitionRef } | { readonly kind: "pending"; readonly issueRefs: readonly string[] };
  readonly useStatus: "active" | "condition-locked" | "pending";
  readonly issueRefs: readonly string[];
}

export type LearningRestriction = {
  readonly uid: InstanceId; readonly sameNameGroup: string;
  readonly operationId: string; readonly evidenceRefs: readonly string[];
} & (
  | { readonly kind: "permanently-forgotten"; readonly formerAbilityId: InstanceId; readonly formerEntry: DefinitionRef }
  | { readonly kind: "permanently-declined-grant"; readonly declinedEntry: DefinitionRef; readonly grantRule: DefinitionRef }
);

export interface GrowthAward {
  readonly uid: InstanceId; readonly progressionId: InstanceId; readonly gainedLevel: number;
  readonly hpGain: Recorded<number>; readonly fpGain: Recorded<number>;
  readonly evaluatedAttributeFacts: readonly string[]; readonly rule: DefinitionRef;
  readonly operationId: string;
}

export type StatOwnership =
  | { readonly mode: "derived" }
  | { readonly mode: "recorded"; readonly recordedValue: Recorded<number>; readonly evidenceRefs: readonly string[] };

export interface AttributeFact {
  readonly uid: InstanceId; readonly attribute: DefinitionRef; readonly amount: Recorded<number>;
  readonly permanence: "base" | "permanent" | "temporary"; readonly originRecordId: InstanceId;
  readonly expiresWithScope: string | null;
}

export interface ProficiencyGrant {
  readonly uid: InstanceId; readonly proficiency: DefinitionRef; readonly amount: Recorded<number>;
  readonly category: "general" | "weapon-qualification" | "extra-weapon" | "save";
  readonly permitsCapBreak: boolean; readonly originRecordId: InstanceId;
  readonly permanence: "permanent" | "temporary"; readonly expiresWithScope: string | null;
}

export interface NumericRecord {
  readonly value: Recorded<number>; readonly updatedByOperationId: string | null;
}

export interface ManualPoolRecord {
  readonly uid: InstanceId; readonly resource: DefinitionRef; readonly value: Recorded<number>;
  readonly sourceRecordId: InstanceId | null; readonly expiresWithScope: string | null;
}

export interface ManualStatusRecord {
  readonly uid: InstanceId; readonly definition: DefinitionRef | null;
  readonly label: string; readonly stacks: Recorded<number>; readonly notes: string;
  readonly sourceRecordId: InstanceId | null; readonly expiresWithScope: string | null;
}

export interface LearningSession {
  readonly playSessionId: Recorded<string>;
  readonly colorMarkRefs: readonly DefinitionRef[]; readonly evidenceRefs: readonly string[];
}

export interface AssetLink {
  readonly assetInstanceId: string; readonly equipmentSlotRef: DefinitionRef;
  readonly expectedAssetRevision: number | null;
}

export interface LegacyInputFact {
  readonly uid: InstanceId; readonly sourceId: string; readonly locator: string;
  readonly raw: string; readonly issueRefs: readonly string[];
}

export interface FeatureHolding {
  readonly uid: InstanceId; readonly definition: Recorded<DefinitionRef>; readonly acquisitionId: InstanceId;
  readonly choiceRecordIds: readonly InstanceId[];
}
export interface RecipeHolding {
  readonly uid: InstanceId; readonly recipe: Recorded<DefinitionRef>; readonly acquisitionId: InstanceId;
  readonly slot: SlotBinding; readonly choiceRecordIds: readonly InstanceId[];
}
export interface KnowledgeGrant {
  readonly uid: InstanceId; readonly definition: DefinitionRef; readonly acquisitionId: InstanceId;
}
export interface MechanismAccessGrant {
  readonly uid: InstanceId; readonly mechanism: DefinitionRef; readonly acquisitionId: InstanceId;
  readonly parameterChoiceIds: readonly InstanceId[];
}
export interface SlotBonusGrant {
  readonly uid: InstanceId; readonly resource: DefinitionRef; readonly tier: DefinitionRef | null;
  readonly ownerProgressionId: InstanceId | null; readonly amount: Recorded<number>;
  readonly acceptedTagRefs: readonly DefinitionRef[]; readonly acquisitionId: InstanceId;
}

export interface RequirementFactRecord {
  readonly uid: InstanceId; readonly predicate: DefinitionRef;
  readonly value: Recorded<number | boolean | string>;
  readonly scopeId: string | null; readonly approval: "reported" | "confirmed" | "disputed";
  readonly evidenceRefs: readonly string[]; readonly decisionRef: DefinitionRef | null;
}

export interface CharacterDocument {
  readonly schemaVersion: 1; readonly characterId: string; readonly ruleset: RuleReleaseRef;
  readonly profile: { readonly displayName: string; readonly story: string };
  readonly race: DefinitionSelection | null; readonly background: DefinitionSelection | null;
  readonly progressions: readonly ClassProgression[]; readonly domains: readonly DomainSelection[];
  readonly choices: readonly ChoiceRecord[]; readonly acquired: readonly AcquisitionRecord[];
  readonly abilities: readonly LearnedAbility[]; readonly learningRestrictions: readonly LearningRestriction[];
  readonly features: readonly FeatureHolding[]; readonly recipes: readonly RecipeHolding[];
  readonly knowledge: readonly KnowledgeGrant[]; readonly mechanisms: readonly MechanismAccessGrant[];
  readonly slotBonusGrants: readonly SlotBonusGrant[];
  readonly mainUnlockedTiers: readonly MainTierUnlock[];
  readonly attributeFacts: readonly AttributeFact[]; readonly proficiencyGrants: readonly ProficiencyGrant[];
  readonly hpGrowth: { readonly historyStatus: "complete" | "incomplete"; readonly awards: readonly GrowthAward[] };
  readonly statOwnership: Readonly<{ maxHp: StatOwnership; maxFp: StatOwnership }>;
  readonly resources: Readonly<{ hpCurrent: NumericRecord; fpCurrent: NumericRecord; xpAvailable: NumericRecord; skillPointsAvailable: NumericRecord }>;
  readonly learningSession: LearningSession;
  readonly manualPools: readonly ManualPoolRecord[]; readonly manualStatuses: readonly ManualStatusRecord[];
  readonly companionIds: readonly InstanceId[]; readonly equippedAssetLinks: readonly AssetLink[];
  readonly requirementFacts: readonly RequirementFactRecord[];
  readonly legacyInputFacts: readonly LegacyInputFact[]; readonly issueRefs: readonly string[];
}

export interface CharacterRecord {
  readonly revision: number; readonly lifecycle: "active" | "archived";
  readonly document: CharacterDocument; readonly updatedAt: string;
  readonly timelineId: string | null; readonly campaignAssignmentId: string | null;
}

export interface CampaignCharacterAssignment {
  readonly assignmentId: string; readonly characterId: string;
  readonly timelineId: string; readonly campaignId: string; readonly revision: number;
}
// First phase: no cross-timeline character reuse; one campaign per character in its timeline.
// Timeline and assignment are server-owned metadata; transfers are not implicit.

export type DerivedNumber =
  | { readonly status: "ready"; readonly value: number; readonly basisRefs: readonly string[] }
  | { readonly status: "needs-decision"; readonly issueRefs: readonly string[] }
  | { readonly status: "unsupported"; readonly reasonCode: string };

export interface RuleView {
  readonly characterId: string; readonly characterRevision: number; readonly ruleset: RuleReleaseRef;
  readonly values: readonly { readonly fieldRef: string; readonly subjectId: string | null; readonly result: DerivedNumber }[];
}

export type RuleOperation =
  | { readonly kind: "add-subclass"; readonly classRef: DefinitionRef; readonly keyAttribute: DefinitionRef; readonly choiceRecordIds: readonly InstanceId[] }
  | { readonly kind: "level-up"; readonly progressionId: InstanceId; readonly choiceRecordIds: readonly InstanceId[] }
  | { readonly kind: "unlock-tier"; readonly tier: DefinitionRef }
  | { readonly kind: "learn"; readonly entry: DefinitionRef; readonly ownerProgressionId: InstanceId; readonly choiceRecordIds: readonly InstanceId[] }
  | { readonly kind: "forget"; readonly abilityId: InstanceId }
  | { readonly kind: "select-advancement"; readonly progressionId: InstanceId; readonly advancement: DefinitionRef; readonly evidenceRefs: readonly string[] };

export interface OperationPreview {
  readonly characterId: string; readonly baseRevision: number; readonly ruleset: RuleReleaseRef;
  readonly actionability: "ready" | "needs-selection" | "needs-decision" | "unsupported";
  readonly issueRefs: readonly string[]; readonly changedRecordIds: readonly InstanceId[];
  readonly costSummary: readonly { readonly resource: DefinitionRef; readonly amount: number }[];
}

export interface EntityTemplate {
  readonly detailContent: readonly DefinitionRef[];
  readonly nativeAbilityRefs: readonly DefinitionRef[];
  readonly challengeLevel: Recorded<{ readonly numerator: number; readonly denominator: number }>;
  readonly baseValues: readonly { readonly fieldRef: string; readonly value: Recorded<number> }[];
  readonly variationRefs: readonly DefinitionRef[];
}

export interface PersistentUnitRecord {
  readonly unitId: InstanceId; readonly revision: number; readonly template: DefinitionRef;
  readonly ownerCharacterId: string | null; readonly growthAwardIds: readonly InstanceId[];
}

export interface ResolvedAbilityContext {
  readonly instanceId: InstanceId; readonly ability: DefinitionRef; readonly entry: DefinitionRef | null;
  readonly sourceTier: Recorded<DefinitionRef>; readonly growthLevel: Recorded<number>;
  readonly keyAttribute: Recorded<DefinitionRef>; readonly issueRefs: readonly string[];
}

export interface DerivedActorSnapshot {
  readonly snapshotId: InstanceId; readonly actorId: InstanceId; readonly ruleset: RuleReleaseRef;
  readonly source:
    | { readonly kind: "character"; readonly characterId: string; readonly revision: number }
    | { readonly kind: "unit"; readonly unitId: InstanceId; readonly revision: number; readonly template: DefinitionRef };
  readonly resolvedValues: RuleView["values"]; readonly abilities: readonly ResolvedAbilityContext[];
  readonly assetRevisionRefs: readonly { readonly assetId: string; readonly revision: number }[];
}

