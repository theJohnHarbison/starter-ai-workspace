/**
 * Shared types for the self-improvement system.
 */

export interface Rule {
  id: string;
  text: string;
  source: 'insight-extraction' | 'reflection' | 'manual';
  status: 'active' | 'proposed' | 'stale' | 'retired';
  reinforcementCount: number;
  createdAt: string;
  lastReinforced: string;
  sourceSessionIds: string[];
  categories?: string[];
}

export interface Reflection {
  session_id: string;
  date: string;
  failure_description: string;
  root_cause: string;
  reflection: string;
  prevention_rule: string;
  quality_score: number;
}

export interface SkillCandidate {
  name: string;
  description: string;
  status: 'proposed' | 'approved' | 'rejected';
  skillMd: string;
  autoActivation: string[];
  createdAt: string;
  sourceSessionId: string;
  noveltyScore: number;
  qualityScore: number;
}

export interface StagedChange {
  id: string;
  type: 'rule' | 'skill';
  description: string;
  content: string;
  status: 'proposed' | 'applied' | 'rejected';
  createdAt: string;
  appliedAt?: string;
}

export interface Config {
  approvalMode: 'autonomous' | 'propose-and-confirm' | 'review-only';
  maxActiveRules: number;
  stalenessThresholdDays: number;
  minReinforcementsToKeep: number;
  noveltyThreshold: number;
  qualityThresholdSuccess: number;
  qualityThresholdFailure: number;
  deduplicationSimilarity: number;
  reinforcementWindowDays?: number;
  reinforcementScoreThreshold?: number;
  reinforcementQualityMin?: number;
  reinforcementSearchLimit?: number;
}
