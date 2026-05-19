import { describe, expect, test } from "bun:test";
import {
  applyExtractedFacts,
  buildRelationshipPrompt,
  computeStage,
  createProfile,
  extractFacts,
  generateGreeting,
  recordInteraction,
  stageIndex,
  updateRecency,
} from "../index.ts";

describe("profile", () => {
  test("createProfile returns stranger with empty memory", () => {
    const p = createProfile("user-1", "companion-1");
    expect(p.stage).toBe("stranger");
    expect(p.interactionCount).toBe(0);
    expect(p.memory.name).toBe("");
    expect(p.memory.facts).toEqual([]);
  });

  test("computeStage evolves correctly", () => {
    expect(computeStage(0)).toBe("stranger");
    expect(computeStage(4)).toBe("stranger");
    expect(computeStage(5)).toBe("acquaintance");
    expect(computeStage(19)).toBe("acquaintance");
    expect(computeStage(20)).toBe("friend");
    expect(computeStage(59)).toBe("friend");
    expect(computeStage(60)).toBe("close_friend");
    expect(computeStage(149)).toBe("close_friend");
    expect(computeStage(150)).toBe("bestie");
    expect(computeStage(1000)).toBe("bestie");
  });

  test("recordInteraction increments count and evolves stage", () => {
    let p = createProfile("u", "c");
    for (let i = 0; i < 5; i++) p = recordInteraction(p);
    expect(p.interactionCount).toBe(5);
    expect(p.stage).toBe("acquaintance");
    expect(p.firstInteraction).not.toBeNull();
    expect(p.lastInteraction).not.toBeNull();
  });

  test("stageIndex returns correct ordering", () => {
    expect(stageIndex("stranger")).toBe(0);
    expect(stageIndex("acquaintance")).toBe(1);
    expect(stageIndex("friend")).toBe(2);
    expect(stageIndex("close_friend")).toBe(3);
    expect(stageIndex("bestie")).toBe(4);
  });

  test("updateRecency computes days since last visit", () => {
    const p = createProfile("u", "c");
    const yesterday = new Date(Date.now() - 86400000 * 3).toISOString();
    const updated = updateRecency({ ...p, lastInteraction: yesterday });
    expect(updated.daysSinceLastVisit).toBe(3);
  });
});

describe("greeting", () => {
  test("stranger greeting does not include name", () => {
    const p = createProfile("u", "c");
    const greeting = generateGreeting(p, { timeOfDay: "morning" });
    expect(greeting.length).toBeGreaterThan(10);
    // Should not contain template markers
    expect(greeting).not.toContain("{name}");
    expect(greeting).not.toContain("{absence}");
  });

  test("friend greeting includes name when known", () => {
    let p = createProfile("u", "c");
    p.memory.name = "Alex";
    p.stage = "friend";
    p.interactionCount = 30;
    const greeting = generateGreeting(p, { timeOfDay: "afternoon" });
    expect(greeting).toContain("Alex");
  });

  test("bestie greeting is enthusiastic", () => {
    let p = createProfile("u", "c");
    p.memory.name = "Wes";
    p.stage = "bestie";
    p.interactionCount = 200;
    const greeting = generateGreeting(p, { timeOfDay: "afternoon" });
    expect(greeting).toContain("Wes");
    // Should have exclamation marks (bestie = high energy)
    expect(greeting).toContain("!");
  });
});

describe("extractFacts", () => {
  test("extracts name from 'my name is X'", () => {
    const facts = extractFacts("My name is Alex");
    expect(facts).toContain("name:Alex");
  });

  test("extracts name from 'call me X'", () => {
    const facts = extractFacts("Just call me Luna");
    expect(facts).toContain("name:Luna");
  });

  test("extracts interests", () => {
    const facts = extractFacts("I love snowboarding and hiking");
    expect(facts.some((f) => f.startsWith("interest:"))).toBe(true);
  });

  test("extracts location", () => {
    const facts = extractFacts("I'm from Portland");
    expect(facts).toContain("location:Portland");
  });

  test("returns empty for messages without facts", () => {
    const facts = extractFacts("What's the weather like?");
    expect(facts.length).toBe(0);
  });
});

describe("applyExtractedFacts", () => {
  test("sets name from extracted fact", () => {
    const p = createProfile("u", "c");
    const updated = applyExtractedFacts(p, ["name:Alex"]);
    expect(updated.memory.name).toBe("Alex");
  });

  test("adds interests without duplicates", () => {
    let p = createProfile("u", "c");
    p = applyExtractedFacts(p, ["interest:snowboarding"]);
    p = applyExtractedFacts(p, ["interest:snowboarding"]);
    p = applyExtractedFacts(p, ["interest:hiking"]);
    expect(p.traits.interests).toEqual(["snowboarding", "hiking"]);
  });
});

describe("buildRelationshipPrompt", () => {
  test("appends relationship context to base prompt", () => {
    const p = createProfile("u", "c");
    p.stage = "friend";
    p.interactionCount = 30;
    p.memory.name = "Alex";
    p.memory.facts = ["lives in Portland"];
    p.traits.communicationStyle = "casual";

    const result = buildRelationshipPrompt("You are a helpful assistant.", p);

    expect(result).toContain("You are a helpful assistant.");
    expect(result).toContain("RELATIONSHIP CONTEXT");
    expect(result).toContain("friend");
    expect(result).toContain("Alex");
    expect(result).toContain("lives in Portland");
    expect(result).toContain("casual");
  });

  test("stranger prompt suggests learning the name", () => {
    const p = createProfile("u", "c");
    const result = buildRelationshipPrompt("Base prompt.", p);
    expect(result).toContain("learn their name");
  });
});
