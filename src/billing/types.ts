export interface PlanLimits {
  maxAgents: number;
  monthlyAiCredits: number;
  maxCallDurationMinutes: number;
  allowedTtsProviders: string[];
  allowedAiModels: string[];
  allowedChannels: string[];
  maxTeamMembers: number;
  maxTrainingDocs: number;
}

export const DEFAULT_TRIAL_LIMITS: PlanLimits = {
  maxAgents: 1,
  monthlyAiCredits: 100,
  maxCallDurationMinutes: 60,
  allowedTtsProviders: ['edge-tts', 'piper'],
  allowedAiModels: [],
  allowedChannels: ['voice', 'web'],
  maxTeamMembers: 1,
  maxTrainingDocs: 5,
};

export const TRIAL_CREDITS = 100;
export const TRIAL_DAYS = 14;
