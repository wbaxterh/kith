/**
 * @kithjs/companion — AI companion personality system.
 *
 * Relationship progression, memory, personality adaptation, greeting engine,
 * and fact extraction. Works with any LLM and any voice pipeline.
 *
 * Usage:
 *   import {
 *     createProfile,
 *     recordInteraction,
 *     generateGreeting,
 *     buildRelationshipPrompt,
 *     extractFacts,
 *     applyExtractedFacts,
 *   } from "@kithjs/companion";
 *
 *   // Create a profile for a new user
 *   let profile = createProfile("user-123", "companion-luna");
 *
 *   // Generate a greeting
 *   const greeting = generateGreeting(profile);
 *   // → "Hey there! Nice to meet you! What's your name?"
 *
 *   // Record each interaction → relationship evolves
 *   profile = recordInteraction(profile);
 *   // After 5 messages: "acquaintance"
 *   // After 20: "friend"
 *   // After 60: "close_friend"
 *   // After 150: "bestie"
 *
 *   // Extract facts from user messages
 *   const facts = extractFacts("My name is Alex and I love snowboarding");
 *   profile = applyExtractedFacts(profile, facts);
 *   // profile.memory.name === "Alex"
 *
 *   // Build relationship-aware prompts
 *   const prompt = buildRelationshipPrompt(basePrompt, profile);
 *   // → Appends relationship context to LLM system prompt
 */

export {
  type CompanionProfile,
  type RelationshipStage,
  type UserMemory,
  type UserTraits,
  STAGES,
  computeStage,
  createProfile,
  recordInteraction,
  stageIndex,
  updateRecency,
} from "./profile.ts";

export {
  type GreetingConfig,
  generateGreeting,
} from "./greeting.ts";

export {
  applyExtractedFacts,
  buildRelationshipPrompt,
  extractFacts,
} from "./prompt-builder.ts";
