export type Role = 'investigator' | 'analyst';
export type GamePhase = 'investigate' | 'deduce' | 'repair' | 'accuse' | 'solved';
export type ClueKind = 'document' | 'witness' | 'record' | 'map' | 'photo' | 'note';

export interface CaseMeta {
  id: string;
  title: string;
  subtitle: string;
  subject: string;
  duration: string;
  cover: string;
  brief: string;
}

export interface Clue {
  id: string;
  role: Role;
  title: string;
  text: string;
  kind: ClueKind;
}

export interface RemedyTask {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  concept: string;
}

export interface DeductionStep {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  concept: string;
  remedy: RemedyTask;
}

export interface FinalAccusation {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  requiredEvidence: [string, string];
  concept: string;
  remedy: RemedyTask;
}

export interface CaseDefinition extends CaseMeta {
  concepts: string[];
  roles: Record<Role, { name: string; description: string }>;
  clues: Clue[];
  steps: DeductionStep[];
  final: FinalAccusation;
}

export interface ClueView {
  id: string;
  title: string;
  kind: ClueKind;
  revealed: boolean;
  text?: string;
}

export interface EvidenceView {
  id: string;
  title: string;
  kind: ClueKind;
  text: string;
  sharedBy: Role;
}

export interface RepairView {
  prompt: string;
  options: string[];
  source: 'step' | 'final';
}

export interface GameView {
  caseId: string;
  title: string;
  phase: GamePhase;
  activeRole: Role;
  clues: ClueView[];
  sharedEvidence: EvidenceView[];
  stepIndex: number;
  totalSteps: number;
  prompt?: string;
  options?: string[];
  repair?: RepairView;
  finalPrompt?: string;
  finalOptions?: string[];
  feedback?: string;
  finalExplanation?: string;
  masteredConcepts: string[];
}

export type RoomMode = 'solo' | 'duo';
export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface RoomPlayer {
  seat: 0 | 1;
  name: string;
  role: Role;
  ready: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  mode: RoomMode;
  caseId: string;
  phase: RoomPhase;
  hostSeat: 0 | 1;
  revision: number;
  players: [RoomPlayer | null, RoomPlayer | null];
  game: GameView | null;
}

export type RoomAction =
  | { type: 'reveal'; clueId: string }
  | { type: 'share'; clueId: string }
  | { type: 'answer'; option: number }
  | { type: 'repair'; option: number }
  | { type: 'accuse'; option: number; evidenceIds: string[] }
  | { type: 'switch-role'; role: Role };

