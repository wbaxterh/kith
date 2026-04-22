# Kith examples

Drop-in configs and samples for the things Kith leaves to consumers.

## `companion-slang-skate.json`

Extra slang entries for a skate/snow/surf-focused voice companion — on top of the defaults shipped with `@kith/voice-router`.

```ts
import companionSlang from "./examples/companion-slang-skate.json" with { type: "json" };
import {
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_BOARD_SPORTS_SLANG,
  VoiceRouter,
} from "@kith/voice-router";

const voice = new VoiceRouter({
  runtime,
  slang: {
    ...DEFAULT_ENGLISH_SLANG,      // omg, lol, idk, tbh, ttyl, …
    ...DEFAULT_GENZ_SLANG,         // fr, ngl, iykyk, sus, cap, sheesh, …
    ...DEFAULT_BOARD_SPORTS_SLANG, // fs, bs, sw, ollie, kickflip, halfcab, …
    ...companionSlang,             // domain-specific additions
  },
});
```

Entries you add here are the ones the framework doesn't ship. Mappings are applied as whole-word, case-insensitive substitutions; the leading capital of the input is preserved (`"OMG"` → `"Oh my god"`).

Numbers like `450` / `270` / `back 5` are deliberately **not** in any slang dict — ElevenLabs reads them correctly in context ("four fifty", "two seventy", "back five"). Spelling them out would sound stilted.
