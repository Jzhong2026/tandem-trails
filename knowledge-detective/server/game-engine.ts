import type {
  CaseDefinition,
  Clue,
  EvidenceView,
  GamePhase,
  GameView,
  Role,
} from '../shared/types.js';

type RepairSource = 'step' | 'final';

interface SharedClue {
  clueId: string;
  sharedBy: Role;
}

export class DetectiveGame {
  private phase: GamePhase = 'investigate';
  private readonly revealed = new Map<Role, Set<string>>([
    ['investigator', new Set()],
    ['analyst', new Set()],
  ]);
  private readonly shared: SharedClue[] = [];
  private readonly mastered = new Set<string>();
  private stepIndex = 0;
  private repairSource: RepairSource | null = null;
  private feedback = '';

  private readonly definition: CaseDefinition;

  constructor(definition: CaseDefinition) {
    this.definition = definition;
  }

  revealClue(role: Role, clueId: string) {
    const clue = this.clue(clueId);
    if (!clue || clue.role !== role || this.revealed.get(role)?.has(clueId)) return false;
    this.revealed.get(role)?.add(clueId);
    return true;
  }

  shareClue(role: Role, clueId: string) {
    const clue = this.clue(clueId);
    if (
      !clue ||
      clue.role !== role ||
      !this.revealed.get(role)?.has(clueId) ||
      this.shared.some((item) => item.clueId === clueId)
    )
      return false;
    this.shared.push({ clueId, sharedBy: role });
    if (this.shared.length === this.definition.clues.length) this.phase = 'deduce';
    return true;
  }

  answerStep(role: Role, option: number) {
    if (this.phase !== 'deduce' || !this.validOption(this.currentStep().options, option)) return false;
    const step = this.currentStep();
    if (option === step.answer) {
      this.master(step.concept);
      this.feedback = step.explanation;
      this.stepIndex++;
      this.phase = this.stepIndex >= this.definition.steps.length ? 'accuse' : 'deduce';
    } else {
      this.feedback = '先别急，读一读证据板再试。';
      this.repairSource = 'step';
      this.phase = 'repair';
    }
    void role;
    return true;
  }

  answerRepair(role: Role, option: number) {
    if (this.phase !== 'repair' || !this.repairSource) return false;
    const remedy = this.repairSource === 'step' ? this.currentStep().remedy : this.definition.final.remedy;
    if (!this.validOption(remedy.options, option)) return false;
    if (option === remedy.answer) {
      this.master(remedy.concept);
      this.feedback = remedy.explanation;
      this.phase = this.repairSource === 'step' ? 'deduce' : 'accuse';
      this.repairSource = null;
    } else {
      this.feedback = '还差一点，比较两个选项再试。';
    }
    void role;
    return true;
  }

  accuse(role: Role, option: number, evidenceIds: string[]) {
    if (this.phase !== 'accuse' || !this.validOption(this.definition.final.options, option)) return false;
    if (option !== this.definition.final.answer || !this.hasRequiredEvidence(evidenceIds)) {
      this.feedback = '结论还需要证据支持，先完成一个小任务。';
      this.repairSource = 'final';
      this.phase = 'repair';
      void role;
      return true;
    }
    this.master(this.definition.final.concept);
    this.feedback = this.definition.final.explanation;
    this.phase = 'solved';
    void role;
    return true;
  }

  view(role: Role): GameView {
    const clues = this.definition.clues
      .filter((clue) => clue.role === role)
      .map((clue) => ({
        id: clue.id,
        title: clue.title,
        kind: clue.kind,
        revealed: this.revealed.get(role)?.has(clue.id) ?? false,
        ...(this.revealed.get(role)?.has(clue.id) ? { text: clue.text } : {}),
      }));
    const sharedEvidence = this.shared.map((item): EvidenceView => {
      const clue = this.clue(item.clueId)!;
      return {
        id: clue.id,
        title: clue.title,
        kind: clue.kind,
        text: clue.text,
        sharedBy: item.sharedBy,
      };
    });
    const step = this.currentStep();
    return {
      caseId: this.definition.id,
      title: this.definition.title,
      phase: this.phase,
      activeRole: role,
      clues,
      sharedEvidence,
      stepIndex: this.stepIndex,
      totalSteps: this.definition.steps.length,
      ...(this.phase === 'deduce' || this.phase === 'repair'
        ? { prompt: step.prompt, options: [...step.options] }
        : {}),
      ...(this.phase === 'repair' && this.repairSource
        ? {
            repair: {
              prompt: (this.repairSource === 'step' ? step.remedy : this.definition.final.remedy).prompt,
              options: [...(this.repairSource === 'step' ? step.remedy : this.definition.final.remedy).options],
              source: this.repairSource,
            },
          }
        : {}),
      ...(this.phase === 'accuse'
        ? { finalPrompt: this.definition.final.prompt, finalOptions: [...this.definition.final.options] }
        : {}),
      ...(this.feedback ? { feedback: this.feedback } : {}),
      ...(this.phase === 'solved' ? { finalExplanation: this.definition.final.explanation } : {}),
      masteredConcepts: [...this.mastered],
    };
  }

  private currentStep() {
    return this.definition.steps[Math.min(this.stepIndex, this.definition.steps.length - 1)]!;
  }

  private clue(id: string): Clue | undefined {
    return this.definition.clues.find((item) => item.id === id);
  }

  private validOption(options: string[], option: number) {
    return Number.isInteger(option) && option >= 0 && option < options.length;
  }

  private hasRequiredEvidence(evidenceIds: string[]) {
    const selected = new Set(evidenceIds);
    return (
      evidenceIds.length === this.definition.final.requiredEvidence.length &&
      this.definition.final.requiredEvidence.every((id) => selected.has(id))
    );
  }

  private master(concept: string) {
    this.mastered.add(concept);
  }
}
