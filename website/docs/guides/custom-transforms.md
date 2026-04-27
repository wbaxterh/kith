---
sidebar_position: 2
---

# Custom Text Transforms

Text transforms let you preprocess text before it reaches the TTS engine. They run after slang expansion and pronunciation overrides — giving you the last say on what gets spoken.

## Adding a Transform

```ts
const voice = new VoiceRouter({
  runtime,
  transforms: [myTransform],
});
```

A transform is a function: `(text: string, ctx: TextTransformContext) => string`

The context includes `personaMode`, so you can vary behavior by character mood.

## Examples

### Strip Markdown

```ts
const stripMarkdown = (text: string) => {
  let t = text;
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1'); // bold/italic
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');  // links
  t = t.replace(/^#{1,6}\s+/gm, '');               // headers
  t = t.replace(/`([^`]+)`/g, '$1');               // inline code
  return t;
};
```

### Collapse Excited Punctuation

```ts
const calmPunctuation = (text: string) => {
  return text.replace(/([!?.]){2,}/g, '$1');
  // "That's amazing!!!" -> "That's amazing!"
};
```

### Persona-Aware Pacing

```ts
const addPacing = (text: string, ctx: { personaMode: string }) => {
  if (ctx.personaMode === "calm") {
    // Add breath pauses for a calm character
    return text.replace(/\. /g, ". ... ");
  }
  return text;
};
```

### Add to Router at Runtime

```ts
const unsub = voice.addTransform(myTransform);
// Later: unsub() to remove it
```

## Transform Order

1. Emoji stripping (built-in, emits `emotion_state`)
2. Sentence chunking (built-in)
3. Slang expansion
4. Pronunciation overrides
5. **Your custom transforms** (in array order)
6. Deduplication check
7. Sent to runtime
