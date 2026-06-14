# LoveLock After Dark Gallery Room Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the accountless After Dark Gallery Room prototype with 1-6 images, creator/partner/third links, role-specific viewer states, two chat lanes, and mock coin requests.

**Architecture:** Keep the app as a static Vite single-page app and add Gallery Room as the primary After Dark mode. Use pure helpers for room validation, role permissions, link metadata, and coin request rules; store the prototype room payload in the existing URL fragment format so Phase 2A works without accounts or new backend tables. Keep classic LoveLock and Phase 1 Scenario Vault behavior intact.

**Tech Stack:** Vite 5, vanilla HTML/CSS/JavaScript, Web Crypto API, Supabase JS v2, Node built-in test runner.

---

## File Map

- Modify `tests/lovelock-core.test.mjs`: add pure helper tests for gallery image limits, role link generation, private chat visibility, and coin request behavior.
- Modify `app.js`: add Gallery Room helper exports, creator state, image upload handling, role-specific link generation, room viewer rendering, chat lane simulation, and mock coin request actions.
- Modify `index.html`: add Gallery Room creator controls, 6-slot gallery upload, role labels, coin mode selector, multi-link share view, and room viewer panels.
- Modify `style.css`: add Gallery Room layout, media grid, role link cards, chat lane panels, coin/request states, and mobile wrapping.

---

### Task 1: Gallery Room Helper Tests and Pure Helpers

**Files:**
- Modify: `tests/lovelock-core.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write failing tests**

Add these imports to `tests/lovelock-core.test.mjs`:

```js
  buildGalleryRoomMetadata,
  buildGalleryRoleLinks,
  canAccessPrivateThirdChat,
  canRequestGalleryUnlock,
  validateGalleryImageCount,
```

Add tests:

```js
test('validateGalleryImageCount accepts 1 to 6 images only', () => {
  assert.deepEqual(validateGalleryImageCount(1), { valid: true });
  assert.deepEqual(validateGalleryImageCount(6), { valid: true });
  assert.deepEqual(validateGalleryImageCount(0), {
    valid: false,
    message: 'Upload at least one image for a Gallery Room.',
  });
  assert.deepEqual(validateGalleryImageCount(7), {
    valid: false,
    message: 'Gallery Rooms can include up to 6 images.',
  });
});

test('buildGalleryRoomMetadata normalizes accountless room settings', () => {
  assert.deepEqual(buildGalleryRoomMetadata({
    title: '  Weekend room  ',
    type: 'hotwife',
    intensity: 'intense',
    creatorLabel: '  Her  ',
    partnerLabel: '  Husband  ',
    thirdLabel: '  Third  ',
    coinMode: 'request',
    expiresInHours: '12',
    mediaCount: 4,
    discreet: true,
    createdAt: 1000,
  }), {
    surface: 'after-dark-room',
    title: 'Weekend room',
    createdAt: 1000,
    expiresInHours: 12,
    mediaCount: 4,
    coinMode: 'request',
    discreet: true,
    scenario: {
      type: 'hotwife',
      intensity: 'intense',
      creatorLabel: 'Her',
      partnerLabel: 'Husband',
      thirdLabel: 'Third',
    },
    roles: {
      partnerSeat: 'invited',
      thirdSeat: 'open',
    },
  });
});

test('buildGalleryRoleLinks creates separate creator partner and third links', () => {
  const links = buildGalleryRoleLinks({
    baseUrl: 'https://example.com/',
    roomId: 'room_abc',
    roomKey: 'room-key',
    creatorKey: 'creator-key',
    partnerKey: 'partner-key',
    thirdKey: 'third-key',
    privateThirdKey: 'private-key',
  });

  assert.match(links.creator, /role=creator/);
  assert.match(links.partner, /role=partner/);
  assert.match(links.third, /role=third/);
  assert.match(links.creator, /privateThirdKey=private-key/);
  assert.doesNotMatch(links.partner, /privateThirdKey=/);
  assert.match(links.third, /privateThirdKey=private-key/);
});

test('canAccessPrivateThirdChat blocks partner role', () => {
  assert.equal(canAccessPrivateThirdChat('creator'), true);
  assert.equal(canAccessPrivateThirdChat('third'), true);
  assert.equal(canAccessPrivateThirdChat('partner'), false);
});

test('canRequestGalleryUnlock only allows third in coin request modes', () => {
  assert.equal(canRequestGalleryUnlock({ role: 'third', coinMode: 'request', imageState: 'hidden' }), true);
  assert.equal(canRequestGalleryUnlock({ role: 'third', coinMode: 'auto', imageState: 'teased' }), true);
  assert.equal(canRequestGalleryUnlock({ role: 'third', coinMode: 'off', imageState: 'hidden' }), false);
  assert.equal(canRequestGalleryUnlock({ role: 'partner', coinMode: 'request', imageState: 'hidden' }), false);
  assert.equal(canRequestGalleryUnlock({ role: 'third', coinMode: 'request', imageState: 'unlocked' }), false);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test
```

Expected: FAIL because the new helper exports do not exist.

- [ ] **Step 3: Implement helpers**

Add pure exports near the existing helper exports in `app.js`:

```js
export function validateGalleryImageCount(count) {
  if (count < 1) {
    return { valid: false, message: 'Upload at least one image for a Gallery Room.' };
  }
  if (count > 6) {
    return { valid: false, message: 'Gallery Rooms can include up to 6 images.' };
  }
  return { valid: true };
}

export function buildGalleryRoomMetadata({
  title,
  type,
  intensity,
  creatorLabel,
  partnerLabel,
  thirdLabel,
  coinMode,
  expiresInHours,
  mediaCount,
  discreet,
  createdAt,
}) {
  return {
    surface: 'after-dark-room',
    title: title.trim() || 'After Dark Gallery Room',
    createdAt,
    expiresInHours: Number(expiresInHours) || 24,
    mediaCount,
    coinMode,
    discreet: Boolean(discreet),
    scenario: {
      type,
      intensity,
      creatorLabel: creatorLabel.trim() || 'Creator',
      partnerLabel: partnerLabel.trim() || 'Partner',
      thirdLabel: thirdLabel.trim() || 'Third',
    },
    roles: {
      partnerSeat: 'invited',
      thirdSeat: 'open',
    },
  };
}

export function buildGalleryRoleLinks({
  baseUrl,
  roomId,
  roomKey,
  creatorKey,
  partnerKey,
  thirdKey,
  privateThirdKey,
}) {
  const make = (role, roleKey, extra = {}) => {
    const params = new URLSearchParams({
      room: roomId,
      role,
      roomKey,
      roleKey,
      ...extra,
    });
    return `${baseUrl}#${params.toString()}`;
  };

  return {
    creator: make('creator', creatorKey, { privateThirdKey }),
    partner: make('partner', partnerKey),
    third: make('third', thirdKey, { privateThirdKey }),
  };
}

export function canAccessPrivateThirdChat(role) {
  return role === 'creator' || role === 'third';
}

export function canRequestGalleryUnlock({ role, coinMode, imageState }) {
  return role === 'third' && ['request', 'auto'].includes(coinMode) && imageState !== 'unlocked';
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test
```

Expected: PASS.

---

### Task 2: Creator Gallery Room UI and Validation

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add Gallery Room creator markup**

In `index.html`, add an After Dark-only Gallery Room panel before the existing image upload section. Include:

- Mode note: Gallery Room is primary After Dark.
- Six media slots.
- Hidden `<input type="file" id="gallery-room-input" accept="image/*" multiple>`.
- Role label inputs: `gallery-creator-label`, `gallery-partner-label`, `gallery-third-label`.
- Coin mode select: `gallery-coin-mode`.
- Status text: `gallery-room-status`.

- [ ] **Step 2: Wire Gallery Room upload state**

In `app.js`, add `db.galleryRoomImages = []`, render six slots, and handle uploads through `validateImageFile(file)` plus `validateGalleryImageCount(files.length)`.

- [ ] **Step 3: Update After Dark validation**

Update `validateCreatorForm()` so After Dark requires:

- Adult consent checklist.
- 1-6 gallery images.
- Valid role labels.

Expected status messages:

```js
'Upload at least one image for a Gallery Room.'
'Gallery Rooms can include up to 6 images.'
'Add a partner label and a third label for this room.'
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 3: Accountless Role Links and Share View

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add share markup**

In `index.html`, add After Dark room link cards to `share-view`:

- `gallery-room-share-panel`
- `gallery-creator-link`
- `gallery-partner-link`
- `gallery-third-link`
- copy buttons with `data-copy-room-link`

- [ ] **Step 2: Generate Gallery Room payload**

In `handleGenerateLock()`, when `db.afterDark` is true, create a `surface: 'after-dark-room'` public payload using `buildGalleryRoomMetadata()`. Keep the existing encrypted payload save path, but encrypt a gallery payload that includes media data, demo chat messages, unlock requests, and creator settings.

- [ ] **Step 3: Generate links**

Use `buildGalleryRoleLinks()` to create creator, partner, and third fragment links. Use the current fragment payload as the accountless `room` value for Phase 2A, and use generated random strings for role keys.

- [ ] **Step 4: Update share summary**

Show the room link cards only for `surface: 'after-dark-room'`. Keep the classic single-link share UI for normal LoveLock.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 4: Role-Specific Gallery Room Viewer

**Files:**
- Modify: `app.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add viewer markup**

In `index.html`, add a hidden `gallery-room-viewer` inside `solver-view` with:

- Role badge.
- Scenario summary.
- Gallery grid.
- Room chat panel.
- Private third chat panel.
- Coin wallet/request panel.

- [ ] **Step 2: Parse room links**

Update `checkUrlPayload()` to detect `#room=...&role=...` fragments. Convert the embedded room value back to the existing saved payload flow for Phase 2A and pass role data into the viewer.

- [ ] **Step 3: Render role-specific states**

Add `setupGalleryRoomViewer(room, roleContext)`:

- Creator sees all images and approval controls.
- Partner sees visible shared images and no private third chat.
- Third sees visible images, mock coin wallet, request buttons, and private third chat.

- [ ] **Step 4: Preserve Scenario Vault and classic solver**

Only call the room viewer when `surface === 'after-dark-room'`. Existing Scenario Vault and LoveLock links keep their current paths.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

---

### Task 5: Mock Chat and Coin Interaction Polish

**Files:**
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Add local chat submission**

Wire room chat and private chat forms so messages append locally in the current browser session. Label messages by role.

- [ ] **Step 2: Add mock coin requests**

Wire third-role request buttons so spending mock coins moves an image to `requested` and updates the gallery state. Wire creator approval buttons so requested images move to `unlocked`.

- [ ] **Step 3: Add mobile polish**

Make gallery, chat panels, and share link cards stack cleanly below 720px. Ensure buttons and long URLs wrap without horizontal overflow.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

### Task 6: Browser QA and Final Verification

**Files:**
- No code changes unless QA reveals defects.

- [ ] **Step 1: Start local server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 2: Browser QA**

Verify:

- Default LoveLock creator still renders.
- After Dark gate opens.
- Gallery Room creator appears after adult confirmation.
- Generate remains disabled until consent and at least one gallery image are present.
- Share view shows creator, partner, and third links.
- Partner viewer hides private third chat.
- Third viewer shows private third chat and mock coin request buttons.
- Mobile viewport has no horizontal overflow.
- Console has no app errors.

- [ ] **Step 3: Final verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.
