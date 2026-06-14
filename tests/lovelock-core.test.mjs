import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  afterDarkConsentComplete,
  buildGalleryRoleLinks,
  buildGalleryRoomMetadata,
  buildAfterDarkScenario,
  buildPublicPayload,
  buildPublicQuestion,
  buildShareMessage,
  canAccessPrivateThirdChat,
  canRequestGalleryUnlock,
  combineNormalizedAnswers,
  getDisplayTitle,
  getVaultExpiryMs,
  normalizeAnswer,
  validateGalleryImageCount,
  validateImageFile,
} from '../app.js';

test('normalizeAnswer trims lowercases and collapses whitespace', () => {
  assert.equal(normalizeAnswer('  New   York  '), 'new york');
});

test('combineNormalizedAnswers normalizes and concatenates answer order', () => {
  assert.equal(combineNormalizedAnswers(['  New   York  ', 'Sushi']), 'new yorksushi');
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

test('buildAfterDarkScenario normalizes scenario metadata for payloads', () => {
  assert.deepEqual(buildAfterDarkScenario({
    type: 'hotwife',
    intensity: 'spicy',
    role: 'Watcher',
    customRole: '',
    discreet: true,
    expiresInHours: '12',
  }), {
    type: 'hotwife',
    intensity: 'spicy',
    role: 'Watcher',
    discreet: true,
    expiresInHours: 12,
  });
});

test('buildAfterDarkScenario uses trimmed custom role labels', () => {
  assert.equal(buildAfterDarkScenario({
    type: 'custom',
    intensity: 'intense',
    role: 'custom',
    customRole: '  My invited viewer  ',
    discreet: false,
    expiresInHours: '1',
  }).role, 'My invited viewer');
});

test('afterDarkConsentComplete requires every consent checkbox', () => {
  const allTrue = {
    adult: true,
    depictedConsent: true,
    noHiddenCapture: true,
    recipientConsent: true,
  };

  assert.equal(afterDarkConsentComplete(allTrue), true);
  assert.equal(afterDarkConsentComplete({ ...allTrue, recipientConsent: false }), false);
});

test('getVaultExpiryMs uses selected expiration hours', () => {
  assert.equal(getVaultExpiryMs(1000, 12), 43201000);
});

test('getDisplayTitle supports discreet After Dark titles', () => {
  assert.equal(getDisplayTitle({ afterDark: true, discreet: true }), 'Private Vault');
  assert.equal(getDisplayTitle({ afterDark: true, discreet: false }), 'LoveLock After Dark');
  assert.equal(getDisplayTitle({ afterDark: false, discreet: false }), 'LoveLock — Prove Your Love to Unlock the Vault');
});

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
