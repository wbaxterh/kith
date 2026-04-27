import type { SlangDict } from "@kithjs/core";

/**
 * Universal English text-speak — abbreviations that cross every demographic.
 *
 * Deliberately excludes Gen Z-specific shorthand (see `DEFAULT_GENZ_SLANG`).
 * Consumers opt in by spreading:
 *
 *   const slang = { ...DEFAULT_ENGLISH_SLANG, ...yourCustoms };
 */
export const DEFAULT_ENGLISH_SLANG: SlangDict = {
  afk: "away from keyboard",
  aka: "also known as",
  asap: "as soon as possible",
  brb: "be right back",
  btw: "by the way",
  diy: "do it yourself",
  eta: "estimated time of arrival",
  faq: "frequently asked questions",
  fyi: "for your information",
  gg: "good game",
  gtg: "got to go",
  idk: "I don't know",
  idc: "I don't care",
  imho: "in my humble opinion",
  imo: "in my opinion",
  irl: "in real life",
  jk: "just kidding",
  lmk: "let me know",
  lol: "laughing out loud",
  nvm: "never mind",
  omg: "oh my god",
  omw: "on my way",
  rn: "right now",
  rofl: "rolling on the floor laughing",
  tbh: "to be honest",
  tba: "to be announced",
  tbd: "to be determined",
  tldr: "too long didn't read",
  ttyl: "talk to you later",
  wbu: "what about you",
  wth: "what the heck",
  wtf: "what the freak",
  yolo: "you only live once",
};

/**
 * Gen Z-specific shorthand + internet slang that's hit common vocabulary.
 *
 * Skewed toward terms that TTS mispronounces or reads letter-by-letter
 * when the intent is the full word ("fr" → "eff are" instead of "for real").
 * Leaves out terms that TTS already handles fine as written ("vibe", "slay"
 * when pronounced literally works).
 */
export const DEFAULT_GENZ_SLANG: SlangDict = {
  bestie: "bestie",
  bet: "bet",
  cap: "cap",
  fr: "for real",
  frfr: "for real for real",
  gyatt: "gyatt",
  icl: "I can't lie",
  iykyk: "if you know you know",
  mid: "mid",
  ngl: "not gonna lie",
  ong: "on god",
  periodt: "period",
  rizz: "rizz",
  sheesh: "sheesh",
  sksksk: "sksksk",
  sus: "suspicious",
  tbf: "to be fair",
  tfw: "that feeling when",
  tldr: "too long didn't read",
  // Profanity-adjacent — consumers who want clean output should build their
  // slang dict without DEFAULT_GENZ_SLANG or override "af" to something else.
  af: "as fuck",
  // "no cap" is a phrase — for now, `cap` passes through; consumers add
  // multi-word keys if they want "no cap" → "for real" specifically.
};

/**
 * Laugh text → v3 audio tag. Turns "haha" / "lol" / "hehe" etc. into
 * `[laughs]` / `[giggles]` tags that `eleven_v3` renders as real laughter.
 *
 * **Requires `ELEVENLABS_MODEL_ID=eleven_v3`.** Audio tags are ONLY honored
 * by Eleven v3. On older models (`eleven_multilingual_v2`, `eleven_turbo_v2_5`,
 * `eleven_flash_v2_5`) the TTS will speak the literal text "brackets laughs"
 * — strictly worse than leaving the original "haha" intact. Don't spread
 * this dict into your slang unless you're on v3.
 *
 * Variant handling is intentionally generous: "haha", "hahaha",
 * "hahahaha" all map to the same tag. Consumers who want "short haha =
 * chuckle, long haha = laugh" override specific keys.
 */
export const DEFAULT_LAUGH_TAGS: SlangDict = {
  // belly laughs — the common "lol-family"
  haha: "[laughs]",
  hahaha: "[laughs]",
  hahahaha: "[laughs]",
  ahaha: "[laughs]",
  ahahaha: "[laughs]",
  bahaha: "[laughs]",
  bahahaha: "[laughs]",
  lol: "[laughs]",
  lmao: "[laughs]",
  lmfao: "[laughs]",
  rofl: "[laughs]",

  // lighter, higher-pitched laughter
  hehe: "[giggles]",
  hehehe: "[giggles]",
  heheh: "[giggles]",
  tehee: "[giggles]",

  // sinister / character-y
  mwahaha: "[laughs]",
  mwahahaha: "[laughs]",
};

/**
 * Skate / snowboard / surf trick vocabulary. One dialect — these terms mean
 * the same thing across the three board sports.
 *
 * Covers directional stance prefixes (fs/bs/sw/nollie/fakie), common tricks
 * TTS fumbles as abbreviations, and a few multi-character compounds. Number
 * codes for rotations (180, 360, 540, 720, 900) are intentionally NOT here
 * — TTS already reads "a 360" as "a three sixty" correctly in context, and
 * spelling them out ("three hundred sixty degrees") would sound stilted.
 */
export const DEFAULT_BOARD_SPORTS_SLANG: SlangDict = {
  // stance / direction
  fs: "frontside",
  bs: "backside",
  sw: "switch",
  reg: "regular",
  nollie: "nollie",
  fakie: "fakie",
  goofy: "goofy",

  // common trick abbreviations
  ollie: "ollie",
  pop: "pop",
  kf: "kickflip",
  hf: "heelflip",
  shuv: "shove it",
  shuvit: "shove it",
  popshuv: "pop shove it",
  fsflip: "frontside flip",
  bsflip: "backside flip",

  // grabs (commonly shortened in text)
  mute: "mute grab",
  indy: "indy grab",
  stale: "stale fish",
  method: "method grab",
  mctwist: "mctwist",

  // common rail/box tricks
  bsboard: "backside boardslide",
  fsboard: "frontside boardslide",
  bslip: "backside lipslide",
  fslip: "frontside lipslide",
  halfcab: "half cab",
  fullcab: "full cab",
};
