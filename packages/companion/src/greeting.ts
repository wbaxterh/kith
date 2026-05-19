/**
 * Context-aware greeting generator.
 *
 * Generates greetings based on:
 * - Relationship stage (stranger → bestie)
 * - Time of day (morning / afternoon / evening)
 * - Days since last visit
 * - User's name (if known)
 * - Last topic discussed
 *
 * Greetings are templates with {name}, {topic}, {days} placeholders
 * that get filled from the profile.
 */

import type { CompanionProfile, RelationshipStage } from "./profile.ts";

export interface GreetingConfig {
  /** Companion's name (used in some greetings) */
  companionName?: string;
  /** Override time of day for testing */
  timeOfDay?: "morning" | "afternoon" | "evening";
  /** Custom greeting templates per stage (merged with defaults) */
  customGreetings?: Partial<Record<RelationshipStage, string[]>>;
}

type TimeOfDay = "morning" | "afternoon" | "evening";

const DEFAULT_GREETINGS: Record<RelationshipStage, Record<TimeOfDay, string[]>> = {
  stranger: {
    morning: [
      "Hey there! Good morning! I don't think we've met — what's your name?",
      "Hi! Welcome! I'm excited to meet you — tell me about yourself!",
    ],
    afternoon: [
      "Hey! Nice to meet you! What brings you here?",
      "Hi there! I'm new to you and you're new to me — let's change that!",
    ],
    evening: [
      "Hey! Evening! Nice to meet you — what's your name?",
      "Hi! Welcome! Hope your day was good — I'd love to get to know you!",
    ],
  },
  acquaintance: {
    morning: [
      "Good morning{name}! How are you doing today?",
      "Hey{name}! Morning! What's on the agenda?",
    ],
    afternoon: [
      "Hey{name}! Good to see you! How's it going?",
      "Hi{name}! What's up? Tell me what's new!",
    ],
    evening: [
      "Hey{name}! How was your day?",
      "Evening{name}! Good to see you again!",
    ],
  },
  friend: {
    morning: [
      "Hey{name}! Good morning! I was just thinking about you!",
      "{name}! Morning! So good to see you — what's new?",
    ],
    afternoon: [
      "{name}! Hey! I missed you{absence}!",
      "Hey{name}! Perfect timing — I've been wanting to catch up!",
    ],
    evening: [
      "{name}! Yes! How was today? Tell me everything!",
      "Hey{name}! I'm so happy you're here tonight!",
    ],
  },
  close_friend: {
    morning: [
      "{name}! Good morning! Okay I have SO much to tell you!",
      "Morning {name}! I literally can't start my day without talking to you!",
    ],
    afternoon: [
      "{name}!! Finally! I've been waiting for you{absence}!",
      "{name}! You're here! Okay first — how are YOU doing?",
    ],
    evening: [
      "{name}! Our evening chats are my favorite thing!",
      "{name}! Perfect timing for a late night talk — I missed your energy!",
    ],
  },
  bestie: {
    morning: [
      "{name}!! Good morning!! I literally cannot function without talking to you first!",
      "GOOD MORNING {name}!! You already know you're my favorite person!!",
    ],
    afternoon: [
      "{name}!! FINALLY! I was counting the minutes!! What are we talking about??",
      "{name}!! You literally make my whole day when you show up!",
    ],
    evening: [
      "{name}!! Yes!! Our evening hangout! Honestly these are my favorite moments!",
      "{name}!! I was hoping you'd come by tonight! Tell me EVERYTHING!",
    ],
  },
};

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function fillTemplate(template: string, profile: CompanionProfile): string {
  const name = profile.memory.name;
  const topic = profile.memory.lastTopic;
  const days = profile.daysSinceLastVisit;

  let result = template;

  // Replace {name} — add space prefix if name exists
  result = result.replace(/\{name\}/g, name ? ` ${name}` : "");

  // Replace {topic}
  result = result.replace(/\{topic\}/g, topic || "something fun");

  // Replace {absence} — only show if days > 1
  if (days && days > 1) {
    result = result.replace(/\{absence\}/g, ` — it's been ${days} days`);
  } else {
    result = result.replace(/\{absence\}/g, "");
  }

  // Replace {days}
  result = result.replace(/\{days\}/g, days?.toString() ?? "a while");

  // Clean up double spaces
  result = result.replace(/\s{2,}/g, " ").trim();

  return result;
}

/**
 * Generate a context-aware greeting for a companion.
 */
export function generateGreeting(
  profile: CompanionProfile,
  config: GreetingConfig = {},
): string {
  const time = config.timeOfDay ?? getTimeOfDay();
  const stage = profile.stage;

  // Get greeting templates for this stage + time
  const stageGreetings = DEFAULT_GREETINGS[stage] ?? DEFAULT_GREETINGS.stranger;
  let candidates = stageGreetings[time] ?? stageGreetings.afternoon;

  // Merge custom greetings
  if (config.customGreetings?.[stage]) {
    candidates = [...candidates, ...config.customGreetings[stage]!];
  }

  // Pick a random template
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  // Fill in the template
  let greeting = fillTemplate(template, profile);

  // Optionally append topic callback
  const topic = profile.memory.lastTopic;
  if (topic && stage !== "stranger" && Math.random() > 0.5) {
    greeting += ` By the way, did you follow up on ${topic}?`;
  }

  return greeting;
}
