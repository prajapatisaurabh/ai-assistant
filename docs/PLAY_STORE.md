# Play Store Submission Kit

Everything needed to publish **AI Assistant** (`com.thitainfo.aiassistant`) to Google Play.
Upload file: `AI-Assistant.aab` (or `android/app/build/outputs/bundle/release/app-release.aab`).

---

## 0. Before you start
- Google Play Developer account ($25 one-time): https://play.google.com/console
- Decide a **public app name** (the listing title, max 30 chars). Suggestions:
  - `AI Assistant Bubble`
  - `Sparkle AI: Write & Rewrite`
  - `AI Writing Assistant`
- You'll need a **privacy policy URL** (text provided below — host it anywhere public:
  GitHub Pages, Google Sites, Notion public page, etc.).

---

## 1. Store listing copy (paste-ready)

**App name (≤30 chars):**
```
AI Assistant Bubble
```

**Short description (≤80 chars):**
```
Floating AI to fix, rewrite & summarize text and create social posts—anywhere.
```

**Full description (≤4000 chars):**
```
AI Assistant is a floating writing helper that works over any app. Tap the bubble
to instantly fix, rewrite, summarize, or repurpose text—without switching apps.

✨ IMPROVE ANY TEXT
• Fix grammar & spelling
• Improve clarity
• Rewrite professionally or casually
• Make it concise or expand with detail
Optimized for X, LinkedIn, WhatsApp, Facebook, Instagram and email.

📣 CREATE SOCIAL POSTS
Turn an article, link, or note into ready-to-post content for X, LinkedIn,
Facebook and Instagram—with multiple variations and relevant hashtags.

💬 CHAT ASSISTANT
A clean chat with tone control (Professional, Casual, Friendly, Marketing,
Technical), streaming replies, copy and regenerate.

🫧 FLOATING BUBBLE
A draggable bubble floats over other apps. Copy text anywhere and get instant
quick actions: Improve, Summarize, or Create Social Post. Close it anytime.

🔐 BRING YOUR OWN KEY — PRIVATE BY DESIGN
You use your own OpenAI API key, stored encrypted on your device. Your text is
sent directly to OpenAI to generate results and is never collected by us. No
account, no server, no tracking.

Note: Requires your own OpenAI API key (platform.openai.com). Standard OpenAI
usage charges apply to your account.
```

---

## 2. Graphics you need
| Asset | Spec | Notes |
|---|---|---|
| App icon | 512×512 PNG | Export the sparkle icon (the launcher icon). |
| Feature graphic | 1024×500 PNG | Required. A simple gradient banner with the icon + name works. |
| Phone screenshots | 2–8, min 320px side | Reuse the emulator screenshots (Chat, Improve, Social, the bubble panel). |

> Tip: capture fresh screenshots from the running app for the cleanest look.

---

## 3. Privacy policy (host this text, then paste the URL in the Console)
```
Privacy Policy — AI Assistant Bubble

Last updated: [DATE]

AI Assistant Bubble ("the app") is a tool that helps you improve and generate text.

WHAT WE COLLECT
We (the developer) do not collect, store, or transmit any of your personal data
to our own servers. The app has no backend and no analytics.

YOUR OPENAI API KEY
You provide your own OpenAI API key. It is stored only on your device in encrypted
storage and is sent only to OpenAI (https://api.openai.com) to authenticate your
requests. It is never sent to us or any third party.

YOUR TEXT
Text you choose to improve, summarize, or turn into posts is sent directly from
your device to OpenAI to generate a result. This is governed by OpenAI's privacy
policy (https://openai.com/policies/privacy-policy). We never receive or store it.

CLIPBOARD
If you enable clipboard detection, the app reads clipboard text only to offer
quick actions when you copy something. Clipboard content is used transiently and
is never stored or transmitted by the app except as part of an action you choose.

OVERLAY & FOREGROUND SERVICE
The optional floating bubble uses the "display over other apps" permission and a
foreground service so it stays available across apps. It does not read screen
content or other apps' data.

CHILDREN
The app is not directed at children under 13.

CONTACT
[your email]
```

---

## 4. Data safety form (Console answers)
- **Does your app collect or share user data?** → **No** (the developer collects nothing).
- If asked about data sent off-device: the app sends user-entered text **to OpenAI**,
  processed to provide the feature, **not** collected by the developer. Declare it as
  "Data is processed but not collected" where applicable; reference OpenAI as the
  third party. Keep this consistent with the privacy policy above.
- Encryption in transit: **Yes** (HTTPS to OpenAI).

---

## 5. Sensitive permission declarations (the part Google scrutinizes)

**SYSTEM_ALERT_WINDOW (Display over other apps)**
Justification to enter:
```
The core feature of the app is a floating assistant bubble that lets users
improve and summarize text while using other apps. The overlay is user-enabled
in Settings, can be closed at any time, and does not capture screen content.
```

**FOREGROUND_SERVICE_SPECIAL_USE**
Play requires a declaration explaining why no standard FGS type fits:
```
The foreground service keeps the user-invoked floating assistant bubble available
across apps. No existing foreground service type (location, media, dataSync, etc.)
describes a user-controlled floating productivity overlay. The service runs only
while the user has enabled the bubble and stops when they close it.
```
> ⚠️ Heads-up: special-use FGS + overlay get extra review and may need a short demo
> video. This is the most likely cause of back-and-forth. Using **Internal testing**
> first avoids blocking while you sort any questions.

---

## 6. Content rating
Fill the questionnaire honestly. This app is a utility with no objectionable
content → typically rated **Everyone**. (It generates text from user input, so
note it has user-generated/AI content if asked.)

---

## 7. Upload steps
1. Play Console → **Create app** (name, language, app/ game = App, free).
2. **App content**: privacy policy URL, ads (No, unless you add them), target
   audience, data safety, permissions declarations (Section 5).
3. **Store listing**: paste Section 1 + upload Section 2 graphics.
4. **Testing → Internal testing → Create release** → upload `AI-Assistant.aab`.
   (Play Console asks to enroll in **Play App Signing** — accept it; your upload
   key signs uploads, Google manages the final app-signing key.)
5. Add yourself as a tester, install via the opt-in link, verify on a real device.
6. When happy: **Production → Create release** → roll out. First review for a new
   account can take a few days.

---

## 8. Every future update
- Bump **`versionCode`** (and usually `versionName`) in `android/app/build.gradle`.
- `cd android && ./gradlew bundleRelease` → upload the new `.aab`.
- Same keystore every time (never lose `upload-keystore.jks`).
