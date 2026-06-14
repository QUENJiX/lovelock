# LoveLock After Dark Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the After Dark Guest MVP on top of the existing LoveLock creator/solver flow.

**Architecture:** Keep the app as a static Vite single-page app with Supabase encrypted payload storage. Add an adult-only mode that reveals scenario, consent, discreet mode, expiry, and Pro upsell UI; store non-sensitive scenario metadata in the public payload and keep media/aftercare encrypted in the existing private payload.

**Tech Stack:** Vite 5, vanilla HTML/CSS/JavaScript, Web Crypto API, Supabase JS v2, Node built-in test runner.

---

## File Map

- Modify `tests/lovelock-core.test.mjs`: add pure helper tests for After Dark consent, scenario metadata, expiry, and discreet title behavior.
- Modify `app.js`: add After Dark state, helper exports, adult gate mode switching, creator validation, payload metadata, solver recipient consent gate, expiry enforcement, discreet title handling, and Pro upsell state.
- Modify `index.html`: add After Dark entry, adult gate, scenario fields, consent checklist, expiry selector, discreet mode toggle, Pro upsell, share summary fields, and recipient consent gate.
- Modify `style.css`: add After Dark visual theme, gate/scenario/consent/upsell/recipient-gate styling, and mobile wrapping.

---

### Task 1: Helper Tests and Helpers

**Files:**
- Modify: `tests/lovelock-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write failing tests**

Add tests that import these helpers from `app.js`:

```js
buildAfterDarkScenario({
  type: 'hotwife',
  intensity: 'spicy',
  role: 'Watcher',
  customRole: '',
  discreet: true,
  expiresInHours: '12'
});

afterDarkConsentComplete({
  adult: true,
  depictedConsent: true,
  noHiddenCapture: true,
  recipientConsent: true
});

getVaultExpiryMs(1000, 12);
getDisplayTitle({ afterDark: true, discreet: true });
```

Expected assertions:

```js
assert.deepEqual(buildAfterDarkScenario(...), {
  type: 'hotwife',
  intensity: 'spicy',
  role: 'Watcher',
  discreet: true,
  expiresInHours: 12
});
assert.equal(afterDarkConsentComplete(allTrue), true);
assert.equal(afterDarkConsentComplete({ ...allTrue, recipientConsent: false }), false);
assert.equal(getVaultExpiryMs(1000, 12), 43201000);
assert.equal(getDisplayTitle({ afterDark: true, discreet: true }), 'Private Vault');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because the helper exports do not exist.

- [ ] **Step 3: Implement helpers**

Add pure exports in `app.js`:

```js
export function buildAfterDarkScenario({ type, intensity, role, customRole, discreet, expiresInHours }) {
  return {
    type,
    intensity,
    role: role === 'custom' ? customRole.trim() : role,
    discreet: Boolean(discreet),
    expiresInHours: Number(expiresInHours) || 24,
  };
}

export function afterDarkConsentComplete(consent) {
  return Boolean(consent.adult && consent.depictedConsent && consent.noHiddenCapture && consent.recipientConsent);
}

export function getVaultExpiryMs(createdAtTimestamp, expiresInHours = 24) {
  return createdAtTimestamp + (Number(expiresInHours) || 24) * 60 * 60 * 1000;
}

export function getDisplayTitle({ afterDark, discreet }) {
  if (afterDark && discreet) return 'Private Vault';
  if (afterDark) return 'LoveLock After Dark';
  return 'LoveLock — Prove Your Love to Unlock the Vault';
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test`

Expected: PASS.

---

### Task 2: Creator After Dark UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add UI surfaces**

Add:

- Header After Dark button.
- Adult gate section.
- Scenario settings group.
- Consent checklist.
- Expiry selector.
- Discreet mode toggle.
- Pro upsell card.

- [ ] **Step 2: Wire mode switching**

Update `app.js` so the After Dark button opens the adult gate, adult confirmation enables After Dark creator state, and "Back to LoveLock" returns to default mode.

- [ ] **Step 3: Add validation**

Update `validateCreatorForm()` so After Dark mode requires every consent checkbox before enabling Generate.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: PASS.

---

### Task 3: Payload, Expiry, and Discreet Mode

**Files:**
- Modify: `app.js`
- Test: `tests/lovelock-core.test.mjs`

- [ ] **Step 1: Add scenario payload**

When After Dark is active, add `surface: 'after-dark'`, `scenario`, and `expiresInHours` to the public payload.

- [ ] **Step 2: Enforce expiry**

Update `checkUrlPayload()` and `startCountdownTimer()` to use `getVaultExpiryMs(createdAt, expiresInHours)`.

- [ ] **Step 3: Apply discreet title**

Set `document.title` using `getDisplayTitle()` whenever entering creator or solver mode.

- [ ] **Step 4: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 4: Recipient Consent Gate and Scenario Display

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add recipient gate markup**

Add a hidden recipient consent card before the quiz controls.

- [ ] **Step 2: Render After Dark scenario details**

When a solver opens an After Dark vault, show scenario type, intensity, recipient role, expiry, and a consent acknowledgement before displaying the quiz or strict unlock form.

- [ ] **Step 3: Preserve classic flow**

Ensure standard LoveLock links bypass the recipient adult gate.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

---

### Task 5: Browser QA

**Files:**
- No code changes unless QA reveals a defect.

- [ ] **Step 1: Start local server**

Run: `npm run dev -- --host 127.0.0.1`

- [ ] **Step 2: Verify rendered states**

Use Browser or Playwright to check:

- Default LoveLock creator still renders.
- After Dark gate opens.
- After Dark creator reveals scenario/consent/Pro sections.
- Generate remains disabled until required fields and consent are complete.
- Mobile viewport has no horizontal overflow.
- Console has no app errors.

- [ ] **Step 3: Final verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

