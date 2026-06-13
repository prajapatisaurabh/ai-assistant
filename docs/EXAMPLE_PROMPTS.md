# Example Prompts & Requests

These show the structured request the screens build and the prompt the app
assembles on-device (`src/prompts/prompts.ts`) before calling OpenAI directly.
The `SYSTEM_PROMPT` is always prepended.

---

## 1. Text Correction

### Fix grammar & spelling

**App call → `api.improve(...)`**
```json
{ "text": "hey i wnt to no if the meting is still on for tommorow at 3", "action": "fix" }
```
**Assembled prompt**
```
Fix all grammar, spelling, and punctuation errors. Preserve the original meaning,
voice, and length. Do not rephrase beyond what is needed to be correct.

Text:
"""
hey i wnt to no if the meting is still on for tommorow at 3
"""
```
**Expected output**
```
Hey, I want to know if the meeting is still on for tomorrow at 3.
```

### Rewrite professionally (for an email)
```json
{ "text": "cant make it today, something came up, will catch up later",
  "action": "professional", "platform": "email", "tone": "professional" }
```
**Expected output**
```
Unfortunately, something has come up and I won't be able to make it today.
I'll follow up with you as soon as I'm able. Apologies for the short notice.
```

### Make concise (for an X post)
```json
{ "text": "We are really excited to finally announce that after many months of hard work our brand new offline mode is now available to everyone.",
  "action": "concise", "platform": "x" }
```
**Expected output**
```
Offline mode is here — months of work, now live for everyone. 🚀
```

### Other actions
| Action | Use it for |
| --- | --- |
| `clarity` | Untangling a confusing paragraph |
| `casual` | Making a stiff message sound human |
| `expand` | Turning bullet notes into full prose |

Supported source/target platforms: `x`, `linkedin`, `whatsapp`, `facebook`, `email`, `instagram`, `generic`.

---

## 2. Social Media Post Generation

### From article text → X + LinkedIn, 2 variations each, with hashtags

**App call → `api.social(...)`**
```json
{
  "source": { "kind": "text", "text": "Our team reduced API latency by 40% by moving to streaming responses and edge caching. Users now see results almost instantly." },
  "platforms": ["x", "linkedin"],
  "tone": "marketing",
  "variations": 2,
  "includeHashtags": true
}
```
**Assembled prompt (per platform)** — e.g. LinkedIn
```
Generate 2 distinct LINKEDIN post variation(s) based on the source content below.
Optimize for LinkedIn: professional but human. Hook in the first line, short
paragraphs, a takeaway, and a soft call to engagement. 3-5 hashtags.
Tone: Persuasive and energetic. Lead with a hook, emphasize benefits, include a clear call to action.
Include relevant hashtags where appropriate for the platform.
Separate each variation with a line containing only "---".

Source content:
"""
Our team reduced API latency by 40% ...
"""
```
**Expected output (LinkedIn, variation 1)**
```
Speed is a feature. ⚡

We just cut API latency by 40% by switching to streaming responses and edge
caching — and our users feel it instantly.

The lesson: perceived performance is product. What's the highest-impact speed
win your team shipped this year?

#engineering #performance #productdevelopment #api
---
... (variation 2) ...
```

### From a URL
```json
{
  "source": { "kind": "url", "url": "https://example.com/blog/launch" },
  "platforms": ["instagram", "facebook"],
  "tone": "friendly",
  "variations": 1,
  "includeHashtags": true
}
```
The app fetches and strips the article on-device (`fetchArticleText` in `services/api.ts`) before prompting.

---

## 3. Summarize

**App call → `api.summarize(...)`**
```json
{ "text": "<long article or thread>", "length": "long" }
```
`length`: `short` (1–2 sentences) · `medium` (a paragraph) · `long` (4–6 bullets).

---

## 4. Chat (streaming, tone-aware)

**App call → `api.streamChat(...)`**
```json
{
  "conversationId": "abc",
  "tone": "technical",
  "messages": [
    { "role": "user", "content": "Improve this text:\n\nthe app crash when i tap save sometimes" }
  ]
}
```
OpenAI streams SSE (`data: {choices:[{delta:{content}}]}` … `data: [DONE]`);
`api.streamChat` surfaces each text delta via `onChunk`. Tone is injected as a
per-turn system note. `conversationId` is used by the app's local history only.
