# LoveLock After Dark Room Persistence and Pro Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist encrypted Gallery Room state across role links and add Pro/payment foundation UI without real accounts, charges, or video.

**Architecture:** Keep the static Vite app and existing Supabase `locks.payload` JSON storage. Add pure room mutation helpers, then use them from the Gallery Room viewer to re-encrypt and update `payload.encData` after chat, request, reveal, relock, and burn actions. Add Pro plan metadata/UI and legal page copy while keeping payment controls disabled.

**Tech Stack:** Vite 5, vanilla HTML/CSS/JavaScript, Web Crypto API, Supabase JS v2, Node built-in test runner.

---

## File Map

- Modify `tests/lovelock-core.test.mjs`: add tests for allowed room mutations, burn behavior, persisted public payload metadata, and Pro plans.
- Modify `app.js`: add pure mutation helpers, encrypted room persistence, polling refresh, sync status, burn/revoke behavior, and Pro plan rendering data.
- Modify `index.html`: add room sync/burn UI and Pro foundation plan cards.
- Modify `style.css`: style sync status, burned state, burn controls, and Pro plan cards.
- Modify `terms.html`: add adult content and no-live-payment policy terms.
- Modify `privacy.html`: add encrypted room state, adult media, and mock payment privacy notes.

---

### Task 1: Pure Helper Tests and Helpers

**Files:**
- Modify: `tests/lovelock-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write failing tests**

Add imports:

```js
  appendGalleryRoomMessage,
  buildPersistedRoomPayload,
  burnGalleryRoomPayload,
  getProPlanCatalog,
  mutateGalleryImageState,
  requestGalleryImageUnlock,
```

Add tests for:

```js
test('appendGalleryRoomMessage blocks partner from private third chat', () => {
  const room = { roomChat: [], privateThirdChat: [] };
  const result = appendGalleryRoomMessage(room, {
    lane: 'private',
    role: 'partner',
    text: 'nope',
    ts: 1000,
    roomStatus: 'active',
  });
  assert.equal(result.changed, false);
  assert.equal(result.message, 'This role cannot write to that chat.');
});

test('appendGalleryRoomMessage appends allowed room chat', () => {
  const room = { roomChat: [], privateThirdChat: [] };
  const result = appendGalleryRoomMessage(room, {
    lane: 'room',
    role: 'third',
    text: '  hello room  ',
    ts: 1000,
    roomStatus: 'active',
  });
  assert.equal(result.changed, true);
  assert.equal(result.payload.roomChat[0].text, 'hello room');
});

test('requestGalleryImageUnlock marks eligible image requested', () => {
  const room = { media: [{ id: 'one', state: 'hidden', visibleTo: ['creator'] }], unlockRequests: [] };
  const result = requestGalleryImageUnlock(room, {
    index: 0,
    role: 'third',
    coinMode: 'request',
    ts: 2000,
    roomStatus: 'active',
  });
  assert.equal(result.changed, true);
  assert.equal(result.payload.media[0].state, 'requested');
  assert.equal(result.payload.unlockRequests[0].coins, 25);
});

test('mutateGalleryImageState lets creator approve reveal and relock', () => {
  const room = { media: [{ id: 'one', state: 'requested', visibleTo: ['creator'] }] };
  const approved = mutateGalleryImageState(room, { index: 0, role: 'creator', action: 'approve', roomStatus: 'active' });
  assert.equal(approved.payload.media[0].state, 'unlocked');
  assert.deepEqual(approved.payload.media[0].visibleTo, ['creator', 'partner', 'third']);
  const relocked = mutateGalleryImageState(approved.payload, { index: 0, role: 'creator', action: 'relock', roomStatus: 'active' });
  assert.equal(relocked.payload.media[0].state, 'hidden');
  assert.deepEqual(relocked.payload.media[0].visibleTo, ['creator']);
});

test('burnGalleryRoomPayload replaces room state with burned payload for creator only', () => {
  const room = { media: [{ id: 'one' }], roomChat: [{ text: 'x' }], privateThirdChat: [{ text: 'y' }] };
  const burned = burnGalleryRoomPayload(room, { role: 'creator', ts: 3000 });
  assert.equal(burned.changed, true);
  assert.equal(burned.payload.burnedAt, 3000);
  assert.deepEqual(burned.payload.media, []);
  assert.equal(burnGalleryRoomPayload(room, { role: 'third', ts: 3000 }).changed, false);
});

test('buildPersistedRoomPayload increments revision and strips local key fields', () => {
  const result = buildPersistedRoomPayload({
    publicPayload: { title: 'Room', revision: 2, salt: 'local', iv: 'local', roomId: 'abc' },
    encryptedBase64: 'cipher',
    roomStatus: 'active',
    updatedAt: 4000,
  });
  assert.equal(result.revision, 3);
  assert.equal(result.encData, 'cipher');
  assert.equal(result.salt, undefined);
  assert.equal(result.iv, undefined);
  assert.equal(result.roomId, undefined);
});

test('getProPlanCatalog exposes recurring plans without lifetime option', () => {
  const plans = getProPlanCatalog();
  assert.equal(plans.some(plan => plan.interval === 'lifetime'), false);
  assert.deepEqual(plans.map(plan => plan.interval), ['monthly', 'annual']);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm test
```

Expected: FAIL because helper exports are missing.

- [ ] **Step 3: Implement helpers**

Add pure exports in `app.js`. Helpers must return cloned payloads and must not mutate input objects.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test
```

Expected: PASS.

---

### Task 2: Persist Encrypted Room Writes

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add room sync markup**

Add `gallery-room-sync-status`, `gallery-room-admin-panel`, `btn-burn-gallery-room`, and `burned-room-card`.

- [ ] **Step 2: Track room row identity**

When parsing `#room=...`, store `roomId`, `salt`, and `iv` only in local `currentGalleryRoom.publicPayload`; never save them back to Supabase.

- [ ] **Step 3: Add persistence function**

Add `persistCurrentGalleryRoom({ statusMessage })` that:

1. Re-encrypts `currentGalleryRoom.privatePayload` with `roomKey`.
2. Builds updated public payload with `buildPersistedRoomPayload`.
3. Calls `supabase.from('locks').update({ payload }).eq('id', roomId)`.
4. Updates local revision and sync status.

- [ ] **Step 4: Persist existing interactions**

Update room chat, private chat, third request, creator approve, creator reveal, creator relock, and creator burn to use the pure helpers and call `persistCurrentGalleryRoom`.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 3: Polling Refresh and Burned State

**Files:**
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add polling**

Add `startGalleryRoomPolling()`, `stopGalleryRoomPolling()`, and `refreshGalleryRoomState()`.

- [ ] **Step 2: Render burned room**

If `roomStatus === 'burned'`, hide gallery/chat controls and show `burned-room-card`.

- [ ] **Step 3: Stop invalid polling**

Stop polling for expired, burned, or non-room views.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 4: Pro Foundation UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add Pro plan cards**

Add monthly and annual recurring plan cards with disabled checkout buttons.

- [ ] **Step 2: Render plans from helper**

Use `getProPlanCatalog()` to render recurring plan metadata.

- [ ] **Step 3: Clarify mock coins**

Update coin copy to say mock coins/payment-ready only.

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 5: Legal Page Updates

**Files:**
- Modify: `terms.html`
- Modify: `privacy.html`

- [ ] **Step 1: Update Terms**

Add adult-only, consent, prohibited content, and no-live-payments language.

- [ ] **Step 2: Update Privacy**

Add encrypted room state, role-link secrets, mock coins, and payment-readiness language.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 6: Browser QA and Final Verification

**Files:**
- No code changes unless QA reveals a defect.

- [ ] **Step 1: Start server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 2: Browser QA**

Verify:

- After Dark Gallery Room creator still renders.
- Pro plan cards render.
- Partner does not see private third chat.
- Third can request unlock.
- Creator can burn/revoke.
- Burned room hides gallery/chat controls.
- Mobile has no horizontal overflow.
- Console has no relevant errors.

- [ ] **Step 3: Final commands**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.
