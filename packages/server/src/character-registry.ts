/**
 * Character registry — loads VoiceCharacter profiles from a directory.
 *
 * Characters are JSON files in a configurable directory. The filename
 * (without .json) becomes the character ID.
 *
 *   characters/
 *     kaori.json     → characterId: "kaori"
 *     apollo.json    → characterId: "apollo"
 */

import path from "node:path";
import type { VoiceCharacter } from "@kithjs/voice-router";

export class CharacterRegistry {
  private characters = new Map<string, VoiceCharacter>();
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async load(): Promise<void> {
    const fs = await import("node:fs/promises");
    try {
      const files = await fs.readdir(this.dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const id = file.replace(/\.json$/, "");
        try {
          const raw = await fs.readFile(path.join(this.dir, file), "utf-8");
          this.characters.set(id, JSON.parse(raw) as VoiceCharacter);
        } catch (err) {
          console.warn(`[kith] failed to load character ${file}:`, err);
        }
      }
      console.log(`[kith] loaded ${this.characters.size} character(s): ${[...this.characters.keys()].join(", ")}`);
    } catch {
      console.log(`[kith] no characters directory at ${this.dir}`);
    }
  }

  get(id: string): VoiceCharacter | undefined {
    return this.characters.get(id);
  }

  list(): { id: string; personaMode?: string }[] {
    return [...this.characters.entries()].map(([id, c]) => ({
      id,
      personaMode: c.personaMode,
    }));
  }

  has(id: string): boolean {
    return this.characters.has(id);
  }
}
