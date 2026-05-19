/**
 * Companion relationship profile.
 *
 * Tracks how a companion relates to a specific user. Evolves over time
 * based on interactions — from stranger to bestie.
 *
 * This is a generalization of the Kaori relationship system from TrickBook,
 * made available to any project.
 */

export type RelationshipStage =
  | "stranger"
  | "acquaintance"
  | "friend"
  | "close_friend"
  | "bestie";

export const STAGES: RelationshipStage[] = [
  "stranger",
  "acquaintance",
  "friend",
  "close_friend",
  "bestie",
];

export interface UserMemory {
  /** User's name (learned through conversation) */
  name: string;
  /** Facts the companion remembers about the user */
  facts: string[];
  /** Topics the user frequently discusses */
  preferredTopics: string[];
  /** Last topic discussed */
  lastTopic: string;
  /** User's mood from last session */
  lastMood: string;
  /** Custom key-value memory */
  custom: Record<string, unknown>;
}

export interface UserTraits {
  /** How the user prefers to communicate */
  communicationStyle: "formal" | "casual" | "hype" | "chill";
  /** How much humor the user enjoys */
  humorLevel: "low" | "medium" | "high";
  /** How emotionally open the user is */
  emotionalOpenness: "reserved" | "medium" | "open";
  /** User's interests/hobbies */
  interests: string[];
}

export interface CompanionProfile {
  /** Unique user identifier */
  userId: string;
  /** Unique companion identifier */
  companionId: string;
  /** Current relationship stage */
  stage: RelationshipStage;
  /** Total messages exchanged */
  interactionCount: number;
  /** What the companion remembers about the user */
  memory: UserMemory;
  /** Learned user traits */
  traits: UserTraits;
  /** When they first interacted */
  firstInteraction: string | null;
  /** Last interaction timestamp */
  lastInteraction: string | null;
  /** Days since last interaction */
  daysSinceLastVisit: number | null;
}

/** Default empty profile for a new user. */
export function createProfile(userId: string, companionId: string): CompanionProfile {
  return {
    userId,
    companionId,
    stage: "stranger",
    interactionCount: 0,
    memory: {
      name: "",
      facts: [],
      preferredTopics: [],
      lastTopic: "",
      lastMood: "neutral",
      custom: {},
    },
    traits: {
      communicationStyle: "casual",
      humorLevel: "medium",
      emotionalOpenness: "medium",
      interests: [],
    },
    firstInteraction: null,
    lastInteraction: null,
    daysSinceLastVisit: null,
  };
}

/** Compute relationship stage from interaction count. */
export function computeStage(interactionCount: number): RelationshipStage {
  if (interactionCount < 5) return "stranger";
  if (interactionCount < 20) return "acquaintance";
  if (interactionCount < 60) return "friend";
  if (interactionCount < 150) return "close_friend";
  return "bestie";
}

/** Get the index of a stage (0-4). Higher = closer relationship. */
export function stageIndex(stage: RelationshipStage): number {
  return STAGES.indexOf(stage);
}

/** Increment interaction count and evolve the relationship. */
export function recordInteraction(profile: CompanionProfile): CompanionProfile {
  const now = new Date().toISOString();
  const count = profile.interactionCount + 1;
  return {
    ...profile,
    interactionCount: count,
    stage: computeStage(count),
    firstInteraction: profile.firstInteraction ?? now,
    lastInteraction: now,
    daysSinceLastVisit: 0,
  };
}

/** Update days since last visit (call on session start). */
export function updateRecency(profile: CompanionProfile): CompanionProfile {
  if (!profile.lastInteraction) return profile;
  const last = new Date(profile.lastInteraction).getTime();
  const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  return { ...profile, daysSinceLastVisit: days };
}
