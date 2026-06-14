# LoveLock Trust-First Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playful and Strict Private unlock modes, creator-controlled teaser sharing, native sharing, mobile polish, and baseline accessibility improvements.

**Architecture:** Keep LoveLock as a static Vite app with Supabase-backed encrypted payloads. Extend the existing single-file UI logic instead of introducing a new framework, while extracting small pure helpers inside `app.js` for validation, normalization, payload shaping, and share metadata.

**Tech Stack:** Vite 5, browser Web Crypto API, Supabase JS v2, vanilla HTML/CSS/JavaScript.

---

## File Map

- Modify `package.json`: add a lightweight test script using Node's built-in test runner.
- Create `tests/lovelock-core.test.mjs`: test pure helper behavior for answer normalization, payload shaping, file validation, and share text.
- Modify `app.js`: export pure helpers for tests, add mode/teaser state, generate mode-specific payloads, render strict solver form, add native sharing, improve errors, and reduced-motion guards.
- Modify `index.html`: add unlock mode controls, teaser toggle, validation/error regions, share button, share summary, strict solver container, and tap unlock button.
- Modify `style.css`: add controls, validation, error, strict form, share summary, mobile wrapping, focus states, and `prefers-reduced-motion` rules.

---

### Task 1: Core Helper Tests

**Files:**
- Modify: `package.json`
- Create: `tests/lovelock-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Add a failing test script**

Add this script to `package.json`:

```json
"test": "node --test"
```

- [ ] **Step 2: Create failing helper tests**

Create `tests/lovelock-core.test.mjs` with tests that import helpers from `app.js`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPublicQuestion,
  buildShareMessage,
  normalizeAnswer,
  validateImageFile,
} from '../app.js';

test('normalizeAnswer trims lowercases and collapses whitespace', () => {
  assert.equal(normalizeAnswer('  New   York  '), 'new york');
});

test('buildPublicQuestion keeps answerHash in playful mode', () => {
  const question = buildPublicQuestion({
    mode: 'playful',
    type: 'text',
    question: 'Where was our first date?',
    answerHash: 'abc123',
    hint: 'The tiny place',
  });

  assert.deepEqual(question, {
    type: 'text',
    question: 'Where was our first date?',
    answerHash: 'abc123',
    hint: 'The tiny place',
  });
});

test('buildPublicQuestion removes answerHash in strict mode', () => {
  const question = buildPublicQuestion({
    mode: 'strict',
    type: 'choice',
    question: 'Pick the song',
    answerHash: 'abc123',
    options: ['One', 'Two'],
    hint: '',
  });

  assert.deepEqual(question, {
    type: 'choice',
    question: 'Pick the song',
    options: ['One', 'Two'],
  });
});

test('validateImageFile rejects non-images and images over 10 MB', () => {
  assert.equal(validateImageFile({ type: 'text/plain', size: 10 }).valid, false);
  assert.equal(validateImageFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }).valid, false);
  assert.deepEqual(validateImageFile({ type: 'image/jpeg', size: 1024 }), { valid: true });
});

test('buildShareMessage includes title and 24 hour expiration', () => {
  assert.equal(
    buildShareMessage('Anniversary Vault'),
    'I made you a LoveLock: Anniversary Vault. Unlock it within 24 hours.'
  );
});
```

- [ ] **Step 3: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because the named helpers are not exported from `app.js`.

- [ ] **Step 4: Add pure helper exports**

Add exported helper functions to `app.js`:

```js
export function normalizeAnswer(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateImageFile(file) {
  const maxBytes = 10 * 1024 * 1024;
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return { valid: false, message: 'Please choose an image file.' };
  }
  if (file.size > maxBytes) {
    return { valid: false, message: 'Please choose an image under 10 MB.' };
  }
  return { valid: true };
}

export function buildPublicQuestion({ mode, type, question, answerHash, options, hint }) {
  const publicQuestion = { type, question };
  if (mode === 'playful') publicQuestion.answerHash = answerHash;
  if (type === 'choice') publicQuestion.options = options;
  if (hint) publicQuestion.hint = hint;
  return publicQuestion;
}

export function buildShareMessage(title) {
  return `I made you a LoveLock: ${title}. Unlock it within 24 hours.`;
}
```

Also make the module safe to import in Node tests:

```js
const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

if (typeof document !== 'undefined') {
  document.addEventListener("DOMContentLoaded", () => {
    initBackgroundHearts();
    initCreatorView();
    checkUrlPayload();
    document.addEventListener("click", handleGlobalButtonClick);
  });
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm test`

Expected: PASS.

---

### Task 2: Creator Controls and Payload Modes

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`
- Test: `tests/lovelock-core.test.mjs`

- [ ] **Step 1: Add failing payload helper tests**

Extend `tests/lovelock-core.test.mjs` with tests for teaser payload behavior:

```js
import { buildPublicPayload } from '../app.js';

test('buildPublicPayload omits teaser thumbnail when disabled', () => {
  const payload = buildPublicPayload({
    mode: 'strict',
    questions: [],
    theme: 'pink',
    title: 'Secret',
    encryptedBase64: 'ciphertext',
    thumbBase64: 'data:image/jpeg;base64,abc',
    teaserEnabled: false,
  });

  assert.equal(payload.thumbBase64, undefined);
  assert.equal(payload.teaserEnabled, false);
});

test('buildPublicPayload includes teaser thumbnail when enabled', () => {
  const payload = buildPublicPayload({
    mode: 'playful',
    questions: [],
    theme: 'gold',
    title: 'Secret',
    encryptedBase64: 'ciphertext',
    thumbBase64: 'data:image/jpeg;base64,abc',
    teaserEnabled: true,
  });

  assert.equal(payload.thumbBase64, 'data:image/jpeg;base64,abc');
  assert.equal(payload.teaserEnabled, true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because `buildPublicPayload` is missing.

- [ ] **Step 3: Add creator HTML controls**

Add an Unlock Mode section and teaser toggle to `index.html` before theme selection. Add form feedback and upload error containers where the JS can write status.

- [ ] **Step 4: Implement creator state and payload shaping**

Update `db` with `mode: 'playful'` and `teaserEnabled: false`. Wire mode buttons and teaser checkbox in `initCreatorView`. Update `handleGenerateLock` to use `buildPublicQuestion` and `buildPublicPayload`.

- [ ] **Step 5: Validate upload files**

Call `validateImageFile(file)` before compression in `handlePhotoSelected` and render the returned message in the upload error region.

- [ ] **Step 6: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 3: Solver Strict Mode, Tap Unlock, and Share Flow

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add strict solver containers**

Add a hidden strict form container and a hidden tap unlock button in `index.html`.

- [ ] **Step 2: Implement strict solver render path**

Update `setupSolverQuiz` so `mode === 'strict'` renders all questions in a single form with one text field per question and one final Unlock button. For multiple-choice strict questions, render option buttons or a select that stores the selected text.

- [ ] **Step 3: Implement strict decryption attempt**

Collect strict answers in question order, normalize them, concatenate them, derive the key, and call the existing decrypt path. On failure, show a generic in-app message without saying which answer is wrong.

- [ ] **Step 4: Add tap unlock fallback**

After Playful Mode questions are solved, show both the drag key and a tap-friendly unlock button that calls `triggerUnlockReveal`.

- [ ] **Step 5: Implement native sharing**

Add a Share button using `navigator.share` when available. Fallback to copying the link and showing in-app feedback when unavailable.

- [ ] **Step 6: Add share summary**

After lock generation, fill summary fields for mode, teaser, and expiration using the generated payload.

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: PASS.

---

### Task 4: Mobile, Accessibility, and Motion Polish

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `app.js`

- [ ] **Step 1: Add focus and status semantics**

Add `aria-live` to status/error containers and labels to new controls.

- [ ] **Step 2: Add responsive styles**

Add CSS for segmented controls, toggles, share actions, strict form fields, long text wrapping, stable mobile grids, and compact card spacing.

- [ ] **Step 3: Add reduced-motion CSS and JS guards**

Use `@media (prefers-reduced-motion: reduce)` to disable major animations. In JS, skip confetti and background heart generation for reduced-motion users.

- [ ] **Step 4: Run tests and production build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 5: Browser Verification

**Files:**
- No code changes unless verification reveals a defect.

- [ ] **Step 1: Start Vite dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: local server starts.

- [ ] **Step 2: Verify desktop and mobile render**

Open the local URL in the in-app browser or Playwright. Check creator controls, share controls, strict form affordances, and mobile layout at desktop and phone widths.

- [ ] **Step 3: Fix any visual defects**

If text overlaps, controls overflow, or a state is hidden incorrectly, patch the relevant file and rerun `npm run build`.
