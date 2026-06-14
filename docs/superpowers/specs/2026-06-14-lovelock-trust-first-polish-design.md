# LoveLock Trust-First Polish Pass Design

Date: 2026-06-14

## Goal

Improve LoveLock in three connected areas:

- Security and privacy: give creators a stronger anti-cheat option without removing the current playful flow.
- Mobile polish: make creator, share, and solver experiences feel deliberate and reliable on small screens.
- Viral sharing: make locks easier and more appealing to send while keeping teaser privacy under creator control.

The product direction is a Trust-First Polish Pass. LoveLock should remain romantic, lightweight, and game-like, but it should be clearer about privacy trade-offs and smoother for recipients on phones.

## Current Context

LoveLock is a static Vite app backed by Supabase storage for encrypted payloads. The main user flows are:

- Creator uploads a photo, creates relationship trivia, chooses a theme, and generates a short lock link.
- Solver opens the lock link, answers questions, progressively reveals the blurred image, then unlocks the encrypted photo.
- Share screen lets the creator copy the generated link and test the lock.

The current security model encrypts the photo and victory message in the browser using AES-GCM. The decryption key is derived from the normalized correct quiz answers with PBKDF2. The app also stores per-question SHA-256 answer hashes in the public payload so it can provide instant feedback.

## Non-Goals

- Do not add accounts, authentication, or user profiles.
- Do not add a new backend beyond the existing Supabase storage model.
- Do not promise dynamic per-lock Open Graph previews from the static app.
- Do not redesign the brand from scratch.
- Do not remove the current playful quiz experience.

## Unlock Modes

Add a creator-facing Unlock Mode control with two modes.

### Playful Mode

Playful Mode preserves the current quiz behavior:

- Per-question feedback remains.
- The image progressively unblurs after each correct answer.
- Wrong answers show friendly retry feedback.
- Public payload includes per-question answer hashes.

The UI should describe this mode as best for fun, interactive quizzes. It should not imply that question answers are fully hidden from a determined recipient inspecting the public payload.

### Strict Private Mode

Strict Private Mode removes per-question answer hashes from the public payload:

- Solver enters all answers before the app attempts decryption.
- The app derives the AES key from the normalized submitted answers.
- If AES-GCM decryption succeeds, the vault unlocks.
- If decryption fails, the app displays a generic error such as "One or more answers are incorrect."
- No per-question correct or incorrect feedback is available.

This mode is less playful but more private because answer hashes are not available for inspection or offline matching.

## Payload Model

The public Supabase payload should include an explicit mode:

```json
{
  "mode": "playful",
  "q": [],
  "t": "pink",
  "title": "Love Lock Vault",
  "thumbBase64": "optional",
  "encData": "..."
}
```

For Playful Mode:

- Each public question must include `answerHash`.
- Multiple-choice options remain public.
- Hints remain public.

For Strict Private Mode:

- Public questions must not include `answerHash`.
- Multiple-choice options may remain public.
- Hints may remain public.
- Correct answers exist only as creator input used to derive the encryption key.

The encrypted private payload should continue to contain:

- Full compressed photo.
- Victory message.
- Any future private-only fields.

## Teaser Privacy

Add a creator-facing toggle:

- Label: "Allow blurred teaser preview"
- Default: off.
- Off means the public payload should not include the blurred thumbnail. Recipients see a branded locked-state visual.
- On means LoveLock may include the current ultra-low-resolution blurred thumbnail in the public payload and use it as the locked preview.

The UI should make clear that the teaser is public if enabled. It is a hint, not private data.

## Creator Flow Polish

Improve the creator flow for mobile and clarity:

- Add Unlock Mode selection near quiz setup, before generation.
- Add teaser toggle near photo upload or sharing settings.
- Validate that the upload is an image and reject files over 10 MB before compression.
- Keep disabled and loading states clear on the generate button.
- Give clearer validation feedback for missing photo, missing question text, missing answers, and incomplete multiple-choice options.
- Keep question cards stable on narrow screens.
- Avoid inline styles for new UI states.
- Keep copy concise and trust-building.

## Share Flow Polish

Improve the generated link screen:

- Keep Copy Link as the reliable default.
- Add Share using the native Web Share API when available.
- Use a fallback when Web Share is unavailable.
- Include a prewritten share message with vault title and expiration.
- Show a concise summary of what the partner will see:
  - unlock mode;
  - teaser enabled or disabled;
  - 24-hour expiration.
- Keep Test Lock and Create Another actions.

Dynamic per-lock social cards are out of scope for this static-app pass. That would require a server or edge redirect layer that can render lock-specific metadata.

## Solver Flow Polish

Improve the recipient experience, especially on phones:

- Stack vault and quiz cleanly on small screens.
- Keep countdown, progress, hints, and question text readable.
- Ensure long questions and answer options wrap without overflow.
- Add a tap-friendly unlock fallback after the quiz is solved so drag-to-unlock is not the only mobile path.
- Keep the current drag key mechanic for devices where it works well.
- For Strict Private Mode, render the questions as a single review-style form with one answer field per question and a final Unlock button.
- Use a generic final failure message in Strict Private Mode.
- Preserve the celebratory success moment and "Create Your Own Lock" loop.

## Accessibility and Motion

Improve baseline accessibility:

- Ensure controls have clear labels and focus states.
- Respect `prefers-reduced-motion` by reducing or disabling large animations, floating hearts, shake effects, and confetti.
- Keep buttons large enough for touch.
- Avoid text overlap at mobile widths.
- Keep color contrast acceptable across pink, gold, and midnight themes.

## Error Handling

The app should handle these states clearly:

- Supabase is not configured.
- Lock link format is invalid.
- Lock is missing or expired.
- File upload is unsupported or too large.
- Encryption or upload fails.
- Copy or native share fails.
- Strict Mode decryption fails.

Errors should use in-app messaging where practical instead of relying only on `alert`.

## Testing Strategy

Manual and automated checks should cover:

- Playful Mode can create, share, solve, progressively reveal, and decrypt a lock.
- Strict Private Mode public payload does not expose answer hashes.
- Strict Private Mode unlock succeeds with correct answers and fails generically with wrong answers.
- Teaser off excludes the thumbnail from the public payload and shows a branded locked state.
- Teaser on includes the blurred thumbnail and renders it in the solver view.
- Creator, share, and solver flows work on desktop and mobile viewport widths.
- Native share falls back cleanly when unavailable.
- Reduced motion preference reduces major animations.
- Existing 404, privacy, terms, and GitHub Pages behavior still work.

## Open Decisions Resolved

- Unlock modes: support both Playful and Strict Private.
- Teaser preview: creator chooses, default off.
- Mobile scope: whole-app pass.
- Product approach: Trust-First Polish Pass.
