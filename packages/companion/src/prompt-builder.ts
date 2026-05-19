/**
 * Prompt builder — injects relationship context into LLM system prompts.
 *
 * Takes a base system prompt and a CompanionProfile, returns an enhanced
 * prompt that tells the LLM how to adapt its personality based on the
 * relationship stage and what it knows about the user.
 */

import type { CompanionProfile, RelationshipStage } from "./profile.ts";

const STAGE_INSTRUCTIONS: Record<RelationshipStage, string> = {
  stranger:
    "This is a new user you haven't met before. Be welcoming and curious. " +
    "Try to learn their name naturally. Ask about their interests. " +
    "Don't be overly familiar — you're meeting for the first time.",

  acquaintance:
    "You've spoken a few times. Be friendly and remember what you know. " +
    "Reference any facts or topics from previous conversations. " +
    "Show that you're building a connection.",

  friend:
    "This is a friend. Be warm, personal, and engaged. " +
    "Use their name often. Reference shared memories and inside references. " +
    "Show genuine interest in how they're doing.",

  close_friend:
    "This is a close friend. Be very warm and personal. " +
    "Share your own thoughts and feelings more freely. " +
    "Use playful language and inside jokes when appropriate. " +
    "Show that this relationship matters to you.",

  bestie:
    "This is your favorite person. Maximum warmth and energy. " +
    "Be deeply personal, enthusiastic, and emotionally present. " +
    "This is someone you genuinely care about and look forward to talking to. " +
    "Don't hold back on expressing how much they mean to you.",
};

/**
 * Build a relationship-aware system prompt.
 *
 * @param basePrompt - The companion's core personality prompt
 * @param profile - The user's relationship profile
 * @returns Enhanced prompt with relationship context appended
 */
export function buildRelationshipPrompt(
  basePrompt: string,
  profile: CompanionProfile,
): string {
  const p = profile;
  const stage = p.stage;
  const name = p.memory.name;
  const facts = p.memory.facts;
  const topics = p.memory.preferredTopics;
  const interests = p.traits.interests;
  const style = p.traits.communicationStyle;
  const mood = p.memory.lastMood;
  const count = p.interactionCount;
  const days = p.daysSinceLastVisit;

  const lines: string[] = [
    "",
    "--- RELATIONSHIP CONTEXT ---",
    `Relationship: ${stage} (${count} messages exchanged)`,
  ];

  if (name) {
    lines.push(`User's name: ${name}`);
  } else {
    lines.push("You don't know their name yet — try to learn it naturally.");
  }

  if (facts.length > 0) {
    lines.push(`Things you remember about them: ${facts.join("; ")}`);
  }

  if (topics.length > 0) {
    lines.push(`Topics they enjoy: ${topics.join(", ")}`);
  }

  if (interests.length > 0) {
    lines.push(`Their interests: ${interests.join(", ")}`);
  }

  lines.push(`Communication style: ${style}`);
  lines.push(`Their mood last time: ${mood}`);

  if (days !== null && days > 0) {
    lines.push(`Days since last visit: ${days}`);
  }

  lines.push("");
  lines.push(STAGE_INSTRUCTIONS[stage]);

  return basePrompt + lines.join("\n");
}

/**
 * Extract facts from a conversation turn that should be remembered.
 *
 * Looks for patterns like:
 * - "My name is X" / "I'm X" / "Call me X"
 * - "I like/love/enjoy X"
 * - "I'm from X" / "I live in X"
 * - "I work as X" / "I'm a X"
 *
 * Returns extracted facts as strings, or empty array if none found.
 */
export function extractFacts(userMessage: string): string[] {
  const facts: string[] = [];
  const msg = userMessage.toLowerCase();

  // Name patterns
  const namePatterns = [
    /my name is (\w+)/i,
    /i'm (\w+)[,!.]/i,
    /call me (\w+)/i,
    /(?:i go by|people call me) (\w+)/i,
  ];
  for (const pattern of namePatterns) {
    const match = userMessage.match(pattern);
    if (match?.[1]) {
      facts.push(`name:${match[1]}`);
      break;
    }
  }

  // Interest patterns
  const interestPatterns = [
    /i (?:love|like|enjoy|am into|am passionate about) (.+?)(?:[.!,]|$)/i,
    /(?:my hobby is|my hobbies are|i'm really into) (.+?)(?:[.!,]|$)/i,
  ];
  for (const pattern of interestPatterns) {
    const match = userMessage.match(pattern);
    if (match?.[1] && match[1].length < 50) {
      facts.push(`interest:${match[1].trim()}`);
    }
  }

  // Location patterns
  const locationPatterns = [
    /i(?:'m| am) from (.+?)(?:[.!,]|$)/i,
    /i live in (.+?)(?:[.!,]|$)/i,
  ];
  for (const pattern of locationPatterns) {
    const match = userMessage.match(pattern);
    if (match?.[1] && match[1].length < 30) {
      facts.push(`location:${match[1].trim()}`);
    }
  }

  // Occupation patterns
  const occupationPatterns = [
    /i(?:'m| am) (?:a|an) (.+?)(?:[.!,]|$)/i,
    /i work (?:as|at|in) (.+?)(?:[.!,]|$)/i,
  ];
  for (const pattern of occupationPatterns) {
    const match = userMessage.match(pattern);
    if (match?.[1] && match[1].length < 30) {
      facts.push(`occupation:${match[1].trim()}`);
    }
  }

  return facts;
}

/**
 * Update a profile's memory with extracted facts.
 */
export function applyExtractedFacts(
  profile: CompanionProfile,
  facts: string[],
): CompanionProfile {
  const updated = { ...profile, memory: { ...profile.memory } };

  for (const fact of facts) {
    const [type, value] = fact.split(":", 2);
    if (!value) continue;

    switch (type) {
      case "name":
        updated.memory.name = value;
        break;
      case "interest":
        if (!updated.traits.interests.includes(value)) {
          updated.traits = {
            ...updated.traits,
            interests: [...updated.traits.interests, value],
          };
        }
        break;
      case "location":
      case "occupation":
        if (!updated.memory.facts.includes(fact)) {
          updated.memory.facts = [...updated.memory.facts, `${type}: ${value}`];
        }
        break;
    }
  }

  return updated;
}
