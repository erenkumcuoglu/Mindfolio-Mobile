export interface PersonaProfile {
  purpose: string;
  topics: string[];
  professional_background: string;
  linkedin_url: string;
  demographics: {
    industry: string;
    role: string;
    experience: string;
  };
  tone: {
    style: string;
    formality: string;
    humor: string;
    voice: string;
  };
  writing_samples: string[];
  values: string[];
  audience: string;
  positioning_statement?: string;
  pillars?: { title: string; description: string }[];
  voice_profile?: string[];
  differentiation?: { do: string[]; dont: string[] };
  sample_post?: string;
  suggested_platforms?: string[];
  cadence?: string;
  subscription?: { active: boolean; plan?: string; mock?: boolean };
  setup?: { reminder?: string };
  pillarTopics?: { pillarTitle: string; topics: string[] }[];
}

export interface Answers {
  goal: string;
  field: string;
  hasContent: string;
  voiceTraits: string[];
  audience: string[];
  positioning: string;
  hotTakes: string[];
  hotTakesDetail: string;
  format: string[];
  cadence: string;
  antiposition: string[];
  inspiration: string[];
  importedContent: string;
  differentiator: string;
  goals: string[];
  "voice-calibrate": string;
  "first-content": string;
  "reminder-setup": string;
}

export type StepType =
  | "message" | "motivation" | "warmup" | "reveal"
  | "single" | "multi" | "input" | "tag-input"
  | "loader" | "paywall" | "done";

export interface Option {
  id: string;
  label: string;
  emoji?: string;
}

export interface Step {
  id: string;
  type: StepType;
  part: 1 | 2;
  title: string;
  description?: string;
  options?: Option[];
  placeholder?: string;
  validate?: (answers: Record<string, unknown>) => boolean;
  multiMax?: number;
}
