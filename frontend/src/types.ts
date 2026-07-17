export type QuestionStatus = 'New' | 'Reviewed' | 'Selected' | 'Answered' | 'Duplicate' | 'Archived';

export interface TownHallQuestion {
  id: string;
  questionText: string;
  submittedUtc: string;
  status: QuestionStatus;
  category: string;
  internalNotes: string;
  isAnswered: boolean;
  townHallName: string;
  selectedForPresentation: boolean;
  archived: boolean;
  moderationFlag: boolean;
  duplicateCandidate?: boolean;
}

export interface TownHallSettings {
  submissionsOpen: boolean;
  townHallName: string;
  landingPrompt: string;
  successMessage: string;
}

export interface CountsByStatus {
  status: QuestionStatus;
  count: number;
}
