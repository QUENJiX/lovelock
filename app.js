/**
 * LoveLock - Relationship Quiz & Photo Unlocker
 * Hybrid Zero-Knowledge Storage (Supabase) version.
 */

import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Global State
let db = {
  photoBase64: null,
  photoThumbBase64: null,
  questions: [], // { type: 'text'|'choice', question: '', answerHash: '', options: [], hint: '' }
  message: '',
  theme: 'pink',
  mode: 'playful',
  teaserEnabled: false,
  lastShareMessage: '',
  afterDark: false,
  adultGateAccepted: false,
  galleryRoomImages: [],
  galleryRoleLinks: null
};

let currentSolverQuiz = null; // Decoded state for solver
let currentGalleryRoom = null;
let galleryRoomSyncInterval = null;
let galleryRoomSyncInFlight = false;
let currentQuestionIndex = 0;
let solverSelectedOption = null;

// Playful wrong answer hints
const COUCH_MESSAGES = [
  "Not quite! Try again! ❤️",
  "Incorrect! Think hard, you've got this! ✨",
  "Oops! Give it another guess! 🤔",
  "Almost there! Try once more! 🥰",
  "Not quite! Let's try that again! 💪"
];

export function normalizeAnswer(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function combineNormalizedAnswers(answers) {
  return answers.map(normalizeAnswer).join('');
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

export function buildPublicPayload({
  mode,
  questions,
  theme,
  title,
  encryptedBase64,
  thumbBase64,
  teaserEnabled,
}) {
  const payload = {
    mode,
    q: questions,
    t: theme,
    title,
    encData: encryptedBase64,
    teaserEnabled: Boolean(teaserEnabled),
  };
  if (teaserEnabled && thumbBase64) {
    payload.thumbBase64 = thumbBase64;
  }
  return payload;
}

export function buildAfterDarkScenario({
  type,
  intensity,
  role,
  customRole,
  discreet,
  expiresInHours,
}) {
  return {
    type,
    intensity,
    role: role === 'custom' ? customRole.trim() : role,
    discreet: Boolean(discreet),
    expiresInHours: Number(expiresInHours) || 24,
  };
}

export function afterDarkConsentComplete(consent) {
  return Boolean(
    consent.adult &&
    consent.depictedConsent &&
    consent.noHiddenCapture &&
    consent.recipientConsent
  );
}

export function getVaultExpiryMs(createdAtTimestamp, expiresInHours = 24) {
  return createdAtTimestamp + (Number(expiresInHours) || 24) * 60 * 60 * 1000;
}

export function getDisplayTitle({ afterDark, discreet }) {
  if (afterDark && discreet) return 'Private Vault';
  if (afterDark) return 'LoveLock After Dark';
  return 'LoveLock — Prove Your Love to Unlock the Vault';
}

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

function cloneRoomPayload(payload) {
  return JSON.parse(JSON.stringify(payload || {}));
}

function blockedRoomMutation(roomStatus) {
  return roomStatus === 'burned' || roomStatus === 'expired';
}

export function appendGalleryRoomMessage(payload, { lane, role, text, ts, roomStatus = 'active' }) {
  const next = cloneRoomPayload(payload);
  const cleanText = String(text || '').trim();

  if (blockedRoomMutation(roomStatus)) {
    return { changed: false, payload: next, message: 'This room is no longer accepting updates.' };
  }
  if (!cleanText) {
    return { changed: false, payload: next, message: 'Message cannot be empty.' };
  }
  if (lane === 'private' && !canAccessPrivateThirdChat(role)) {
    return { changed: false, payload: next, message: 'This role cannot write to that chat.' };
  }

  const targetKey = lane === 'private' ? 'privateThirdChat' : 'roomChat';
  next[targetKey] = next[targetKey] || [];
  next[targetKey].push({
    id: `msg_${ts}_${next[targetKey].length}`,
    role,
    text: cleanText,
    ts,
  });

  return { changed: true, payload: next };
}

export function requestGalleryImageUnlock(payload, { index, role, coinMode, ts, roomStatus = 'active' }) {
  const next = cloneRoomPayload(payload);
  const media = next.media?.[index];

  if (blockedRoomMutation(roomStatus)) {
    return { changed: false, payload: next, message: 'This room is no longer accepting updates.' };
  }
  if (!media || !canRequestGalleryUnlock({ role, coinMode, imageState: media.state || 'hidden' })) {
    return { changed: false, payload: next, message: 'This image cannot be requested.' };
  }

  if (coinMode === 'auto') {
    media.state = 'unlocked';
    media.visibleTo = ['creator', 'partner', 'third'];
    return { changed: true, payload: next };
  }

  media.state = 'requested';
  media.visibleTo = ['creator'];
  next.unlockRequests = next.unlockRequests || [];
  next.unlockRequests.push({
    imageId: media.id,
    role,
    coins: 25,
    ts,
  });

  return { changed: true, payload: next };
}

export function mutateGalleryImageState(payload, { index, role, action, roomStatus = 'active' }) {
  const next = cloneRoomPayload(payload);
  const media = next.media?.[index];

  if (blockedRoomMutation(roomStatus)) {
    return { changed: false, payload: next, message: 'This room is no longer accepting updates.' };
  }
  if (role !== 'creator') {
    return { changed: false, payload: next, message: 'Only the creator can control gallery state.' };
  }
  if (!media) {
    return { changed: false, payload: next, message: 'Image not found.' };
  }

  if (action === 'relock') {
    media.state = 'hidden';
    media.visibleTo = ['creator'];
    return { changed: true, payload: next };
  }

  if (action === 'approve' || action === 'reveal') {
    media.state = 'unlocked';
    media.visibleTo = ['creator', 'partner', 'third'];
    return { changed: true, payload: next };
  }

  return { changed: false, payload: next, message: 'Unsupported gallery action.' };
}

export function burnGalleryRoomPayload(payload, { role, ts }) {
  if (role !== 'creator') {
    return { changed: false, payload: cloneRoomPayload(payload), message: 'Only the creator can burn this room.' };
  }

  return {
    changed: true,
    payload: {
      media: [],
      roomChat: [],
      privateThirdChat: [],
      unlockRequests: [],
      creatorSettings: {},
      burnedAt: ts,
    },
  };
}

export function buildPersistedRoomPayload({ publicPayload, encryptedBase64, roomStatus = 'active', updatedAt = Date.now() }) {
  const {
    salt,
    iv,
    roomId,
    ...persistable
  } = publicPayload || {};

  return {
    ...persistable,
    encData: encryptedBase64,
    roomStatus,
    revision: Number(publicPayload?.revision || 0) + 1,
    updatedAt,
  };
}

export function getProPlanCatalog() {
  return [
    {
      id: 'after-dark-monthly',
      name: 'After Dark Pro Monthly',
      interval: 'monthly',
      priceLabel: '$19/mo',
      cta: 'Checkout not live yet',
      features: ['Longer room expiry', 'More active rooms', 'Saved role labels', 'Burn/revoke history'],
    },
    {
      id: 'after-dark-annual',
      name: 'After Dark Pro Annual',
      interval: 'annual',
      priceLabel: '$149/yr',
      cta: 'Checkout not live yet',
      features: ['Discounted recurring plan', 'Premium scenario drops', 'Larger media limits', 'Future video vaults'],
    },
  ];
}

export function buildShareMessage(title) {
  return `I made you a LoveLock: ${title}. Unlock it within 24 hours.`;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyBodyClasses(theme = db.theme, afterDark = db.afterDark) {
  const classes = [`theme-${theme || 'pink'}`];
  if (afterDark) classes.push('after-dark-mode');
  document.body.className = classes.join(' ');
}

function updateDocumentTitle({ afterDark = db.afterDark, discreet = false } = {}) {
  document.title = getDisplayTitle({ afterDark, discreet });
}

function formatScenarioLabel(value) {
  const labels = {
    ntr: 'NTR fantasy',
    hotwife: 'Hotwife',
    cuckold: 'Cuckold',
    voyeur: 'Consensual voyeur',
    custom: 'Custom',
    soft: 'Soft',
    spicy: 'Spicy',
    intense: 'Intense',
  };
  return labels[value] || value || 'Private';
}

// INITIALIZATION
function handleGlobalButtonClick(e) {
  const btn = e.target.closest("button, .btn, .btn-option, .btn-theme-select, .btn-remove-photo-badge, .btn-hint-trigger");
  if (btn) {
    playClickSound();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener("DOMContentLoaded", () => {
  initBackgroundHearts();
  initCreatorView();
  checkUrlPayload();
  
  // Play subtle feedback click sound on buttons
    document.addEventListener("click", handleGlobalButtonClick);
  });
}

// BACKGROUND HEARTS ANIMATION
function initBackgroundHearts() {
  if (prefersReducedMotion()) return;
  const bg = document.getElementById("hearts-bg");
  if (!bg) return;
  const heartCount = 15;
  for (let i = 0; i < heartCount; i++) {
    createHeart(bg);
  }
}

function createHeart(container) {
  const heart = document.createElement("div");
  heart.classList.add("bg-heart-particle");
  
  // Random sizing and positions
  const size = Math.random() * 30 + 15;
  heart.style.width = `${size}px`;
  heart.style.height = `${size}px`;
  heart.style.left = `${Math.random() * 100}%`;
  
  // Random delays and durations
  const duration = Math.random() * 10 + 10;
  const delay = Math.random() * -15; // start immediately at random timeline offset
  heart.style.animationDuration = `${duration}s`;
  heart.style.animationDelay = `${delay}s`;
  
  container.appendChild(heart);
}

// SOUND ENGINE (Web Audio API Synthesizer)
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playCorrectSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Note 1: E5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: A5
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.08);
    gain2.gain.setValueAtTime(0.08, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

function playIncorrectSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    
    osc.frequency.setValueAtTime(220.00, now); // A3
    osc.frequency.linearRampToValueAtTime(146.83, now + 0.25); // D3
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

function playUnlockSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Sweep: C4, E4, G4, B4, C5, E5, G5, C6
    const freqs = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99, 1046.50];
    
    freqs.forEach((freq, idx) => {
      const delay = idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gain.gain.setValueAtTime(0.06, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.5);
    });
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

function playClickSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520.00, now);
    
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    // Ignore context warnings
  }
}

// CRYPTOGRAPHIC SHA-256 HASHING & AES-GCM ENCRYPTION
async function hashString(str) {
  const normalized = normalizeAnswer(str);
  const msgUint8 = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Derive AES key from a passphrase (quiz answers) and salt using PBKDF2
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt data with AES-GCM
async function encryptData(data, key, iv) {
  const enc = new TextEncoder();
  const encodedData = typeof data === 'string' ? enc.encode(data) : data;
  return crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedData
  );
}

// Decrypt data with AES-GCM
async function decryptData(encryptedData, key, iv) {
  const dec = new TextDecoder();
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );
  return dec.decode(decryptedBuffer);
}

// Convert CryptoBuffer to Base64 String
function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Convert Base64 String to Uint8Array
function base64ToBuffer(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Generate secure random string for salts/identifications
function generateRandomString(len = 16) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}


// CANVAS COMPRESSION
function compressAndResizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Define maximum dimensions to keep URL short but high quality
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to highly compressed JPEG but with quality sufficient for rewards
        const fullBase64 = canvas.toDataURL('image/jpeg', 0.72);
        
        // --- Thumbnail image (Severely degraded for Zero-knowledge progressive unblur) ---
        const thumbCanvas = document.createElement('canvas');
        const thumbCtx = thumbCanvas.getContext('2d');
        
        const THUMB_MAX = 40;
        let tWidth = img.width;
        let tHeight = img.height;
        
        if (tWidth > tHeight) {
          if (tWidth > THUMB_MAX) {
            tHeight *= THUMB_MAX / tWidth;
            tWidth = THUMB_MAX;
          }
        } else {
          if (tHeight > THUMB_MAX) {
            tWidth *= THUMB_MAX / tHeight;
            tHeight = THUMB_MAX;
          }
        }
        
        thumbCanvas.width = tWidth;
        thumbCanvas.height = tHeight;
        
        // Apply slight blur during draw for extra safety, though scaling down to 40px is already lossy
        thumbCtx.filter = 'blur(2px)';
        thumbCtx.drawImage(img, 0, 0, tWidth, tHeight);
        
        const thumbBase64 = thumbCanvas.toDataURL('image/jpeg', 0.5);

        resolve({ fullBase64, thumbBase64 });
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

// STATE MACHINE: VIEW PANELS
function switchView(viewId) {
  document.querySelectorAll(".view-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.add("active");
  
  // Custom headers/actions on view change
  if (viewId === 'creator-view') {
    stopGalleryRoomPolling();
    document.querySelector('.app-header').classList.remove('hidden');
    // Preview theme in creator view too
    applyBodyClasses(db.theme, db.afterDark);
    updateDocumentTitle();
  } else if (viewId === 'solver-view') {
    document.querySelector('.app-header').classList.add('hidden');
  } else {
    stopGalleryRoomPolling();
  }
}

// CREATOR VIEW LOGIC
function initCreatorView() {
  const dropZone = document.getElementById("drop-zone");
  const photoInput = document.getElementById("photo-input");
  const removePhotoBtn = document.getElementById("btn-remove-photo");
  const addQBtn = document.getElementById("btn-add-question");
  const generateBtn = document.getElementById("btn-generate-lock");
  const themePicker = document.getElementById("theme-picker");
  const modePicker = document.getElementById("unlock-mode-picker");
  const teaserToggle = document.getElementById("teaser-toggle");
  const enterAfterDarkBtn = document.getElementById("btn-enter-after-dark");
  const exitAfterDarkBtn = document.getElementById("btn-exit-after-dark");
  const confirmAfterDarkBtn = document.getElementById("btn-confirm-after-dark");
  const cancelAfterDarkBtn = document.getElementById("btn-cancel-after-dark");
  const discreetToggle = document.getElementById("discreet-toggle");
  const galleryRoomInput = document.getElementById("gallery-room-input");
  const galleryRoomDropzone = document.getElementById("gallery-room-dropzone");
  
  enterAfterDarkBtn.addEventListener("click", () => {
    switchView("after-dark-gate");
  });

  cancelAfterDarkBtn.addEventListener("click", () => {
    switchView("creator-view");
  });

  confirmAfterDarkBtn.addEventListener("click", () => {
    db.afterDark = true;
    db.adultGateAccepted = true;
    updateCreatorMode();
    switchView("creator-view");
  });

  exitAfterDarkBtn.addEventListener("click", () => {
    db.afterDark = false;
    updateCreatorMode();
    switchView("creator-view");
  });

  // Unlock mode selection
  modePicker.querySelectorAll(".btn-mode-select").forEach(btn => {
    btn.addEventListener("click", () => {
      modePicker.querySelectorAll(".btn-mode-select").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      db.mode = btn.dataset.mode;
      validateCreatorForm();
    });
  });

  teaserToggle.addEventListener("change", () => {
    db.teaserEnabled = teaserToggle.checked;
    validateCreatorForm();
  });
  
  // Theme selection click handlers
  themePicker.querySelectorAll(".btn-theme-select").forEach(btn => {
    btn.addEventListener("click", () => {
      themePicker.querySelectorAll(".btn-theme-select").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      db.theme = btn.dataset.theme;
      applyBodyClasses(db.theme, db.afterDark);
    });
  });

  document.querySelectorAll(".after-dark-consent, #scenario-type-select, #scenario-intensity-select, #after-dark-expiry-select, #gallery-creator-label, #gallery-partner-label, #gallery-third-label, #gallery-coin-mode").forEach(control => {
    control.addEventListener("input", validateCreatorForm);
    control.addEventListener("change", validateCreatorForm);
  });

  discreetToggle.addEventListener("change", () => {
    updateDocumentTitle({ afterDark: db.afterDark, discreet: discreetToggle.checked });
    validateCreatorForm();
  });
  
  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('hover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('hover');
    }, false);
  });
  
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      handlePhotoSelected(files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    galleryRoomDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      galleryRoomDropzone.classList.add('hover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    galleryRoomDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      galleryRoomDropzone.classList.remove('hover');
    }, false);
  });

  galleryRoomDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length) {
      handleGalleryRoomFiles(dt.files);
    }
  });

  galleryRoomInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
      handleGalleryRoomFiles(e.target.files);
    }
  });
  
  photoInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
      handlePhotoSelected(e.target.files[0]);
    }
  });
  
  removePhotoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetPhotoInput();
  });
  
  addQBtn.addEventListener("click", () => {
    addQuestionToCreatorForm();
  });
  
  generateBtn.addEventListener("click", handleGenerateLock);
  
  // Setup sharing page buttons
  document.getElementById("btn-copy-url").addEventListener("click", copyShareUrl);
  document.querySelectorAll("[data-copy-room-link]").forEach(btn => {
    btn.addEventListener("click", () => copyRoomLink(btn.dataset.copyRoomLink));
  });
  document.getElementById("btn-native-share").addEventListener("click", shareLockLink);
  document.getElementById("btn-test-lock").addEventListener("click", () => {
    window.location.hash = document.getElementById("share-url-input").value.split("#")[1];
    checkUrlPayload();
  });
  document.getElementById("btn-send-room-chat").addEventListener("click", () => appendGalleryChatMessage('room'));
  document.getElementById("btn-send-private-chat").addEventListener("click", () => appendGalleryChatMessage('private'));
  document.getElementById("gallery-room-chat-input").addEventListener("keydown", (event) => {
    if (event.key === 'Enter') appendGalleryChatMessage('room');
  });
  document.getElementById("private-third-chat-input").addEventListener("keydown", (event) => {
    if (event.key === 'Enter') appendGalleryChatMessage('private');
  });
  document.getElementById("btn-burn-gallery-room").addEventListener("click", burnCurrentGalleryRoom);
  document.getElementById("btn-reset-creator").addEventListener("click", () => {
    window.location.hash = "";
    resetCreatorState();
    switchView("creator-view");
  });
  
  // Load a single empty question by default
  addQuestionToCreatorForm();
  renderGalleryRoomSlots();
  updateCreatorMode();
}

function readAfterDarkConsent() {
  const consent = {
    adult: false,
    depictedConsent: false,
    noHiddenCapture: false,
    recipientConsent: false,
  };

  document.querySelectorAll(".after-dark-consent").forEach(input => {
    consent[input.dataset.consent] = input.checked;
  });
  return consent;
}

function readAfterDarkScenario() {
  return buildAfterDarkScenario({
    type: document.getElementById("scenario-type-select").value,
    intensity: document.getElementById("scenario-intensity-select").value,
    role: document.getElementById("gallery-partner-label").value.trim() || 'Partner',
    customRole: '',
    discreet: document.getElementById("discreet-toggle").checked,
    expiresInHours: document.getElementById("after-dark-expiry-select").value,
  });
}

function updateCreatorMode() {
  document.querySelectorAll(".after-dark-only").forEach(el => {
    el.classList.toggle("hidden", !db.afterDark);
  });
  document.querySelectorAll(".classic-only").forEach(el => {
    el.classList.toggle("hidden", db.afterDark);
  });
  document.getElementById("btn-enter-after-dark").classList.toggle("hidden", db.afterDark);
  document.getElementById("btn-exit-after-dark").classList.toggle("hidden", !db.afterDark);
  document.getElementById("creator-title").innerText = db.afterDark ? "Create an After Dark Gallery Room" : "Create a Love Lock";
  document.getElementById("creator-description").innerText = db.afterDark
    ? "Upload a private gallery, invite the partner and third seats, and control the reveal."
    : "Upload a photo and set questions your partner must answer to unlock it.";
  document.getElementById("btn-generate-lock").innerText = db.afterDark ? "Seal Gallery Room" : "Generate My Love Lock";
  document.getElementById("theme-section-title").innerText = db.afterDark ? "6. Choose App Theme" : "6. Choose App Theme";
  applyBodyClasses(db.theme, db.afterDark);
  updateDocumentTitle({ afterDark: db.afterDark, discreet: db.afterDark && document.getElementById("discreet-toggle").checked });
  renderProPlanCards();
  validateCreatorForm();
}

function renderProPlanCards() {
  const grid = document.getElementById("pro-plan-cards");
  if (!grid) return;

  grid.innerHTML = getProPlanCatalog().map(plan => `
    <article class="pro-plan-card">
      <div>
        <span class="summary-label">${plan.interval}</span>
        <h4>${plan.name}</h4>
        <strong class="pro-plan-price">${plan.priceLabel}</strong>
      </div>
      <ul class="pro-plan-features">
        ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
      <button type="button" class="btn btn-secondary btn-sm" disabled>${plan.cta}</button>
    </article>
  `).join('');
}

function handlePhotoSelected(file) {
  const uploadPrompt = document.getElementById("upload-prompt");
  const previewContainer = document.getElementById("upload-preview-container");
  const imgPreview = document.getElementById("image-preview");
  const photoError = document.getElementById("photo-error");

  const validation = validateImageFile(file);
  if (!validation.valid) {
    resetPhotoInput();
    photoError.innerText = validation.message;
    photoError.classList.remove("hidden");
    return;
  }

  photoError.innerText = "";
  photoError.classList.add("hidden");
  
  compressAndResizeImage(file).then(({ fullBase64, thumbBase64 }) => {
    db.photoBase64 = fullBase64;
    db.photoThumbBase64 = thumbBase64;
    imgPreview.src = fullBase64;
    uploadPrompt.classList.add("hidden");
    previewContainer.classList.remove("hidden");
    document.getElementById("drop-zone").classList.add("has-photo");
    validateCreatorForm();
  }).catch(err => {
    console.error("Image loading/compression failed", err);
    photoError.innerText = "Could not load image. Please try a different format.";
    photoError.classList.remove("hidden");
  });
}

function resetPhotoInput() {
  db.photoBase64 = null;
  db.photoThumbBase64 = null;
  document.getElementById("photo-input").value = "";
  document.getElementById("upload-prompt").classList.remove("hidden");
  document.getElementById("upload-preview-container").classList.add("hidden");
  document.getElementById("drop-zone").classList.remove("has-photo");
  const photoError = document.getElementById("photo-error");
  if (photoError) {
    photoError.innerText = "";
    photoError.classList.add("hidden");
  }
  validateCreatorForm();
}

function renderGalleryRoomSlots() {
  const slots = document.getElementById("gallery-room-slots");
  if (!slots) return;

  slots.innerHTML = Array.from({ length: 6 }).map((_, index) => {
    const image = db.galleryRoomImages[index];
    if (!image) {
      return `
        <button type="button" class="gallery-room-slot empty" data-gallery-slot="${index}" aria-label="Add gallery image ${index + 1}">
          <span>${index + 1}</span>
        </button>
      `;
    }

    return `
      <div class="gallery-room-slot filled">
        <img src="${image.thumbBase64 || image.fullBase64}" alt="Gallery image ${index + 1}">
        <button type="button" class="gallery-remove-btn" data-gallery-remove="${index}" aria-label="Remove gallery image ${index + 1}">
          Remove
        </button>
      </div>
    `;
  }).join('');

  slots.querySelectorAll("[data-gallery-slot]").forEach(slot => {
    slot.addEventListener("click", () => {
      document.getElementById("gallery-room-input").click();
    });
  });

  slots.querySelectorAll("[data-gallery-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.galleryRemove);
      db.galleryRoomImages.splice(index, 1);
      renderGalleryRoomSlots();
      validateCreatorForm();
    });
  });
}

async function handleGalleryRoomFiles(fileList) {
  const files = Array.from(fileList);
  const status = document.getElementById("gallery-room-status");
  const galleryInput = document.getElementById("gallery-room-input");
  const nextCount = db.galleryRoomImages.length + files.length;
  const countValidation = validateGalleryImageCount(nextCount);

  if (!countValidation.valid) {
    status.innerText = countValidation.message;
    status.classList.remove("hidden");
    galleryInput.value = "";
    validateCreatorForm();
    return;
  }

  for (const file of files) {
    const fileValidation = validateImageFile(file);
    if (!fileValidation.valid) {
      status.innerText = fileValidation.message;
      status.classList.remove("hidden");
      galleryInput.value = "";
      validateCreatorForm();
      return;
    }
  }

  status.innerText = "Preparing encrypted gallery previews...";
  status.classList.remove("hidden");

  try {
    const compressed = await Promise.all(files.map(file => compressAndResizeImage(file)));
    compressed.forEach((image, index) => {
      db.galleryRoomImages.push({
        id: `img_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
        fullBase64: image.fullBase64,
        thumbBase64: image.thumbBase64,
        state: index === 0 && db.galleryRoomImages.length === 0 ? 'teased' : 'hidden',
        visibleTo: ['creator'],
      });
    });
    status.innerText = `${db.galleryRoomImages.length} image${db.galleryRoomImages.length === 1 ? '' : 's'} ready.`;
    status.classList.add("hidden");
    renderGalleryRoomSlots();
  } catch (error) {
    console.error("Gallery image loading/compression failed", error);
    status.innerText = "Could not load one of those images. Please try a different format.";
    status.classList.remove("hidden");
  } finally {
    galleryInput.value = "";
    validateCreatorForm();
  }
}

function addQuestionToCreatorForm(qText = '', qType = 'text', options = ['', ''], correctVal = '', hintText = '') {
  const qList = document.getElementById("questions-list");
  const qId = 'q-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  
  const qItem = document.createElement("div");
  qItem.className = "question-item";
  qItem.id = qId;
  qItem.dataset.type = qType;
  
  qItem.innerHTML = `
    <div class="question-item-header">
      <span class="question-num">Question</span>
      <button class="btn-remove-q" title="Delete Question">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
    
    <div class="form-row">
      <input type="text" class="q-text-input" placeholder="e.g. What is my favorite food?" value="${qText}">
    </div>
    
    <div class="form-row">
      <label class="section-subtitle">Answer Type</label>
      <select class="q-type-select">
        <option value="text" ${qType === 'text' ? 'selected' : ''}>Text Input (Any text matches)</option>
        <option value="choice" ${qType === 'choice' ? 'selected' : ''}>Multiple Choice</option>
      </select>
    </div>
    
    <div class="q-details-area">
      <!-- Dynamic inputs based on type -->
    </div>

    <div class="form-row" style="margin-top: 0.5rem;">
      <input type="text" class="q-hint-input" placeholder="Hint / Clue (Optional)" value="${hintText}">
    </div>
  `;
  
  // Attach remove action
  qItem.querySelector(".btn-remove-q").addEventListener("click", () => {
    qItem.remove();
    validateCreatorForm();
  });
  
  const typeSelect = qItem.querySelector(".q-type-select");
  const detailsArea = qItem.querySelector(".q-details-area");
  
  const renderDetails = (type) => {
    qItem.dataset.type = type;
    if (type === 'text') {
      detailsArea.innerHTML = `
        <input type="text" class="q-answer-input" placeholder="Correct Answer (e.g. Sushi)" value="${correctVal}">
      `;
    } else {
      detailsArea.innerHTML = `
        <div class="q-options-container">
          <p class="section-subtitle">Define options & check the correct one</p>
          ${[0, 1, 2, 3].map(i => {
            const val = options[i] || '';
            const checked = correctVal === val && val !== '' ? 'checked' : (i === 0 && !correctVal ? 'checked' : '');
            return `
              <div class="q-option-row">
                <input type="radio" name="${qId}-correct" value="${i}" ${checked} class="option-correct-radio">
                <input type="text" class="q-option-val" placeholder="Option ${i+1}" value="${val}">
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    
    // Add validation triggers
    qItem.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", validateCreatorForm);
    });
    qItem.querySelectorAll("input[type='radio']").forEach(radio => {
      radio.addEventListener("change", validateCreatorForm);
    });
  };
  
  typeSelect.addEventListener("change", (e) => {
    renderDetails(e.target.value);
    validateCreatorForm();
  });
  
  // Init detail renderer
  renderDetails(qType);
  qList.appendChild(qItem);
  
  // Attach keyup listeners for general validation
  qItem.querySelector(".q-text-input").addEventListener("input", validateCreatorForm);
  qItem.querySelector(".q-hint-input").addEventListener("input", validateCreatorForm);
  
  validateCreatorForm();
}

function validateCreatorForm() {
  const generateBtn = document.getElementById("btn-generate-lock");
  const formStatus = document.getElementById("creator-form-status");
  const questions = document.querySelectorAll(".question-item");
  
  let isValid = true;
  let message = "Ready to seal your lock.";
  
  if (db.afterDark) {
    const countValidation = validateGalleryImageCount(db.galleryRoomImages.length);
    const partnerLabel = document.getElementById("gallery-partner-label").value.trim();
    const thirdLabel = document.getElementById("gallery-third-label").value.trim();

    if (!countValidation.valid) {
      isValid = false;
      message = countValidation.message;
    }
    if (!partnerLabel || !thirdLabel) {
      isValid = false;
      message = "Add a partner label and a third label for this room.";
    }
    if (!afterDarkConsentComplete(readAfterDarkConsent())) {
      isValid = false;
      message = "Confirm every After Dark consent item before sealing this room.";
    }
  } else {
    if (!db.photoBase64) {
      isValid = false;
      message = "Add a photo to continue.";
    }
    
    if (questions.length === 0) {
      isValid = false;
      message = "Add at least one question.";
    }
    
    questions.forEach(qItem => {
      const qText = qItem.querySelector(".q-text-input").value.trim();
      if (!qText) {
        isValid = false;
        message = "Every question needs a prompt.";
      }
      
      const type = qItem.dataset.type;
      if (type === 'text') {
        const ans = qItem.querySelector(".q-answer-input").value.trim();
        if (!ans) {
          isValid = false;
          message = "Every text question needs a correct answer.";
        }
      } else {
        const optionValInputs = qItem.querySelectorAll(".q-option-val");
        const checkedRadio = qItem.querySelector(".option-correct-radio:checked");
        let filledOptions = 0;
        let selectedOptionHasValue = false;
        optionValInputs.forEach(optInp => {
          if (optInp.value.trim()) filledOptions++;
        });
        if (checkedRadio) {
          const selectedInput = optionValInputs[parseInt(checkedRadio.value, 10)];
          selectedOptionHasValue = Boolean(selectedInput && selectedInput.value.trim());
        }
        if (filledOptions < 2) {
          isValid = false;
          message = "Multiple choice questions need at least two options.";
        } else if (!selectedOptionHasValue) {
          isValid = false;
          message = "Choose a filled option as the correct answer.";
        }
      }
    });
  }
  
  generateBtn.disabled = !isValid;
  if (formStatus) {
    formStatus.innerText = message;
    formStatus.classList.toggle("ready", isValid);
  }
}

// GENERATE LOVE LOCK PAYLOAD (Hybrid Zero-Knowledge)
async function handleGenerateLock() {
  const generateBtn = document.getElementById("btn-generate-lock");
  if (db.afterDark) {
    await handleGenerateGalleryRoom(generateBtn);
    return;
  }

  generateBtn.innerText = "Encrypting Lock...";
  generateBtn.disabled = true;
  
  try {
    if (!supabase) throw new Error("Supabase client is not configured. Please add .env variables.");

    const qItems = document.querySelectorAll(".question-item");
    const parsedQuestions = [];
    const correctAnswers = []; // Used to derive the AES key
    const vaultTitle = document.getElementById("vault-title-input").value.trim() || (db.afterDark ? "After Dark Scenario Vault" : "Love Lock Vault");
    const afterDarkScenario = db.afterDark ? readAfterDarkScenario() : null;
    
    for (let qItem of qItems) {
      const qText = qItem.querySelector(".q-text-input").value.trim();
      const type = qItem.dataset.type;
      const hint = qItem.querySelector(".q-hint-input").value.trim();
      
      let correctTextForEncryption = '';

      if (type === 'text') {
        const correctText = qItem.querySelector(".q-answer-input").value.trim();
        const hash = await hashString(correctText);
        correctTextForEncryption = correctText;
        parsedQuestions.push(buildPublicQuestion({
          mode: db.mode,
          type: 'text',
          question: qText,
          answerHash: hash,
          hint: hint
        }));
      } else {
        const optionInps = qItem.querySelectorAll(".q-option-val");
        const options = [];
        let correctIndex = 0;
        
        const checkedRadio = qItem.querySelector(".option-correct-radio:checked");
        if (checkedRadio) {
          correctIndex = parseInt(checkedRadio.value, 10);
        }
        
        optionInps.forEach((optInp, idx) => {
          const val = optInp.value.trim();
          if (val) {
            options.push(val);
          } else if (idx <= correctIndex) {
            correctIndex = Math.max(0, correctIndex - 1);
          }
        });
        
        const correctText = options[correctIndex] || options[0] || '';
        const hash = await hashString(correctText);
        correctTextForEncryption = correctText;
        
        parsedQuestions.push(buildPublicQuestion({
          mode: db.mode,
          type: 'choice',
          question: qText,
          options: options,
          answerHash: hash,
          hint: hint
        }));
      }

      correctAnswers.push(correctTextForEncryption);
    }
    
    // Setup for AES-GCM
    const salt = generateRandomString(16);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from the concatenated exact answers
    const combinedAnswersNormalized = combineNormalizedAnswers(correctAnswers);
    const derivedAesKey = await deriveKey(combinedAnswersNormalized, salt);

    // Build the private payload we want to encrypt
    const privatePayload = {
      p: db.photoBase64,
      m: document.getElementById("custom-message").value.trim()
    };
    
    const jsonStrForEncryption = JSON.stringify(privatePayload);
    const encryptedBuffer = await encryptData(jsonStrForEncryption, derivedAesKey, iv);
    const encryptedBase64 = bufferToBase64(encryptedBuffer);
    
    // Build the public payload to upload to the server
    const publicPayload = buildPublicPayload({
      mode: db.mode,
      questions: parsedQuestions,
      theme: db.theme,
      title: vaultTitle,
      encryptedBase64,
      thumbBase64: db.photoThumbBase64,
      teaserEnabled: db.teaserEnabled,
    });
    publicPayload.createdAt = Date.now();
    if (db.afterDark) {
      publicPayload.surface = 'after-dark';
      publicPayload.scenario = afterDarkScenario;
      publicPayload.expiresInHours = afterDarkScenario.expiresInHours;
    }

    // Upload to Supabase 
    // We assume a table named 'locks' with columns: id (text/uuid), payload (jsonb), created_at
    const lockIdBase = generateRandomString(8); // e.g. "f3x9d2a1"

    const { data: uploadData, error: uploadError } = await supabase
      .from('locks')
      .insert([
        { id: lockIdBase, payload: publicPayload }
      ])
      .select();

    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error("Could not save to database. Check network or setup.");
    }

    const lockId = uploadData[0].id;
    
    // Form the URL: lovelock.app/#lock=<id>_<salt>_<iv_base64>
    const ivBase64 = bufferToBase64(iv);
    // Use URL-safe characters for the fragment
    const fragmentStr = `${lockId}.${salt}.${encodeURIComponent(ivBase64)}`;
    
    const shareUrl = `${window.location.origin}${window.location.pathname}#lock=${fragmentStr}`;
    
    document.getElementById("share-url-input").value = shareUrl;
    db.lastShareMessage = db.afterDark
      ? `I made you a private After Dark vault: ${vaultTitle}. Unlock it before it expires.`
      : buildShareMessage(vaultTitle);
    updateShareSummary(publicPayload);
    
    const sizeWarning = document.getElementById("payload-size-warning");
    sizeWarning.innerText = `Data Envelope: Secured in Database (Zero-Knowledge). Link length is optimized!`;
    sizeWarning.classList.remove("warning");
    
    switchView("share-view");
  } catch (error) {
    console.error("Lock creation failed", error);
    alert(error.message || "An error occurred during encryption. Please try again.");
  } finally {
    generateBtn.innerText = db.afterDark ? "Seal After Dark Vault" : "Generate My Love Lock";
    generateBtn.disabled = false;
  }
}

async function handleGenerateGalleryRoom(generateBtn) {
  generateBtn.innerText = "Encrypting Room...";
  generateBtn.disabled = true;

  try {
    if (!supabase) throw new Error("Supabase client is not configured. Please add .env variables.");

    const mediaCountValidation = validateGalleryImageCount(db.galleryRoomImages.length);
    if (!mediaCountValidation.valid) throw new Error(mediaCountValidation.message);

    const createdAt = Date.now();
    const roomKey = generateRandomString(24);
    const creatorKey = generateRandomString(18);
    const partnerKey = generateRandomString(18);
    const thirdKey = generateRandomString(18);
    const privateThirdKey = generateRandomString(24);
    const salt = generateRandomString(16);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const derivedAesKey = await deriveKey(roomKey, salt);
    const vaultTitle = document.getElementById("vault-title-input").value.trim() || "After Dark Gallery Room";

    const publicPayload = buildGalleryRoomMetadata({
      title: vaultTitle,
      type: document.getElementById("scenario-type-select").value,
      intensity: document.getElementById("scenario-intensity-select").value,
      creatorLabel: document.getElementById("gallery-creator-label").value,
      partnerLabel: document.getElementById("gallery-partner-label").value,
      thirdLabel: document.getElementById("gallery-third-label").value,
      coinMode: document.getElementById("gallery-coin-mode").value,
      expiresInHours: document.getElementById("after-dark-expiry-select").value,
      mediaCount: db.galleryRoomImages.length,
      discreet: document.getElementById("discreet-toggle").checked,
      createdAt,
    });
    publicPayload.t = db.theme;

    const privatePayload = {
      media: db.galleryRoomImages.map((image, index) => ({
        id: image.id,
        p: image.fullBase64,
        thumb: image.thumbBase64,
        state: image.state || (index === 0 ? 'teased' : 'hidden'),
        visibleTo: image.visibleTo || ['creator'],
      })),
      roomChat: [{
        id: `chat_${createdAt}`,
        role: 'creator',
        text: 'Room sealed. Partner and third seats are ready.',
        ts: createdAt,
      }],
      privateThirdChat: [{
        id: `private_${createdAt}`,
        role: 'creator',
        text: 'Private third lane is ready when they join.',
        ts: createdAt,
      }],
      unlockRequests: [],
      creatorSettings: {
        note: document.getElementById("custom-message").value.trim(),
        coinMode: publicPayload.coinMode,
      },
    };

    const encryptedBuffer = await encryptData(JSON.stringify(privatePayload), derivedAesKey, iv);
    publicPayload.encData = bufferToBase64(encryptedBuffer);

    const lockIdBase = generateRandomString(8);
    const { data: uploadData, error: uploadError } = await supabase
      .from('locks')
      .insert([{ id: lockIdBase, payload: publicPayload }])
      .select();

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw new Error("Could not save to database. Check network or setup.");
    }

    const lockId = uploadData[0].id;
    const ivBase64 = bufferToBase64(iv);
    const roomFragment = `${lockId}.${salt}.${encodeURIComponent(ivBase64)}`;
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const roleLinks = buildGalleryRoleLinks({
      baseUrl,
      roomId: roomFragment,
      roomKey,
      creatorKey,
      partnerKey,
      thirdKey,
      privateThirdKey,
    });

    db.galleryRoleLinks = roleLinks;
    db.lastShareMessage = `I made a private After Dark Gallery Room: ${publicPayload.title}. Join before it expires.`;

    document.getElementById("share-url-input").value = roleLinks.partner;
    document.getElementById("gallery-creator-link").value = roleLinks.creator;
    document.getElementById("gallery-partner-link").value = roleLinks.partner;
    document.getElementById("gallery-third-link").value = roleLinks.third;
    updateShareSummary(publicPayload);

    const sizeWarning = document.getElementById("payload-size-warning");
    sizeWarning.innerText = "Room Envelope: encrypted media, role links, and mock coins ready.";
    sizeWarning.classList.remove("warning");

    switchView("share-view");
  } catch (error) {
    console.error("Gallery room creation failed", error);
    alert(error.message || "An error occurred while sealing the room. Please try again.");
  } finally {
    generateBtn.innerText = "Seal Gallery Room";
    generateBtn.disabled = false;
  }
}

function setShareStatus(message) {
  const status = document.getElementById("share-status");
  if (status) status.innerText = message;
}

function updateShareSummary(payload) {
  const modeEl = document.getElementById("share-summary-mode");
  const teaserEl = document.getElementById("share-summary-teaser");
  const expiryEl = document.getElementById("share-summary-expiry");
  const scenarioEl = document.getElementById("share-summary-scenario");
  const intensityEl = document.getElementById("share-summary-intensity");
  const isAfterDark = payload.surface === 'after-dark' || payload.surface === 'after-dark-room';
  const isGalleryRoom = payload.surface === 'after-dark-room';
  if (modeEl) modeEl.innerText = isGalleryRoom ? "Gallery Room" : (payload.mode === 'strict' ? "Strict Private" : "Playful");
  if (teaserEl) teaserEl.innerText = isGalleryRoom ? `${payload.mediaCount} image${payload.mediaCount === 1 ? '' : 's'}` : (payload.teaserEnabled ? "Blurred teaser" : "Hidden");
  if (expiryEl) expiryEl.innerText = `${payload.expiresInHours || 24} hours`;
  document.querySelectorAll(".after-dark-summary").forEach(el => {
    el.classList.toggle("hidden", !isAfterDark);
  });
  const roomSharePanel = document.getElementById("gallery-room-share-panel");
  if (roomSharePanel) roomSharePanel.classList.toggle("hidden", !isGalleryRoom);
  if (scenarioEl) scenarioEl.innerText = formatScenarioLabel(payload.scenario?.type);
  if (intensityEl) intensityEl.innerText = formatScenarioLabel(payload.scenario?.intensity);
}

async function copyShareUrl() {
  const urlInp = document.getElementById("share-url-input");
  const url = urlInp.value;
  try {
    await navigator.clipboard.writeText(url);
    const copyBtn = document.getElementById("btn-copy-url");
    const origText = copyBtn.innerText;
    copyBtn.innerText = "Copied";
    setShareStatus("Link copied.");
    setTimeout(() => {
      copyBtn.innerText = origText;
    }, 2000);
  } catch (error) {
    urlInp.select();
    urlInp.setSelectionRange(0, 99999);
    setShareStatus("Copy failed. Select the link and copy it manually.");
  }
}

async function copyRoomLink(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    setShareStatus("Role link copied.");
  } catch (error) {
    input.select();
    input.setSelectionRange(0, 99999);
    setShareStatus("Copy failed. Select the role link and copy it manually.");
  }
}

async function shareLockLink() {
  const url = document.getElementById("share-url-input").value;
  const shareData = {
    title: "LoveLock",
    text: db.lastShareMessage || buildShareMessage("Love Lock Vault"),
    url,
  };

  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      setShareStatus("Share sheet opened.");
      return;
    }
    await copyShareUrl();
    setShareStatus("Native sharing is unavailable here, so the link was copied.");
  } catch (error) {
    if (error.name === 'AbortError') {
      setShareStatus("Share cancelled.");
      return;
    }
    await copyShareUrl();
    setShareStatus("Sharing failed, so the link was copied instead.");
  }
}

function resetCreatorState() {
  db.photoBase64 = null;
  db.photoThumbBase64 = null;
  db.theme = 'pink';
  db.mode = 'playful';
  db.teaserEnabled = false;
  db.lastShareMessage = '';
  db.afterDark = false;
  db.adultGateAccepted = false;
  db.galleryRoomImages = [];
  db.galleryRoleLinks = null;
  resetPhotoInput();
  document.getElementById("questions-list").innerHTML = "";
  document.getElementById("custom-message").value = "";
  document.getElementById("vault-title-input").value = "";
  document.getElementById("teaser-toggle").checked = false;
  document.getElementById("discreet-toggle").checked = false;
  document.getElementById("after-dark-expiry-select").value = "24";
  document.getElementById("scenario-type-select").value = "ntr";
  document.getElementById("scenario-intensity-select").value = "spicy";
  document.getElementById("gallery-creator-label").value = "Her";
  document.getElementById("gallery-partner-label").value = "Partner";
  document.getElementById("gallery-third-label").value = "Third";
  document.getElementById("gallery-coin-mode").value = "request";
  renderGalleryRoomSlots();
  const galleryStatus = document.getElementById("gallery-room-status");
  if (galleryStatus) {
    galleryStatus.innerText = "";
    galleryStatus.classList.add("hidden");
  }
  document.querySelectorAll(".after-dark-consent").forEach(input => {
    input.checked = false;
  });
  document.getElementById("photo-error").classList.add("hidden");
  document.getElementById("photo-error").innerText = "";
  
  // Reset theme selector active class
  const themePicker = document.getElementById("theme-picker");
  themePicker.querySelectorAll(".btn-theme-select").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.theme === 'pink') btn.classList.add("active");
  });
  applyBodyClasses("pink", false);

  const modePicker = document.getElementById("unlock-mode-picker");
  modePicker.querySelectorAll(".btn-mode-select").forEach(btn => {
    const isPlayful = btn.dataset.mode === 'playful';
    btn.classList.toggle("active", isPlayful);
    btn.setAttribute("aria-pressed", isPlayful ? "true" : "false");
  });
  
  addQuestionToCreatorForm();
  updateCreatorMode();
}

// SOLVER VAULT DECODING & PLAYBACK
async function checkUrlPayload() {
  const hash = window.location.hash;
  if (hash.startsWith("#room=")) {
    switchView("solver-view");
    document.getElementById("vault-status-text").innerText = "Fetching room...";

    try {
      if (!supabase) throw new Error("Supabase client is not configured");

      const params = new URLSearchParams(hash.slice(1));
      const roomFragment = params.get("room");
      const role = params.get("role");
      const roomKey = params.get("roomKey");
      const roleKey = params.get("roleKey");
      const privateThirdKey = params.get("privateThirdKey");

      if (!roomFragment || !role || !roomKey || !roleKey) {
        throw new Error("Invalid room link format");
      }

      const parts = roomFragment.split(".");
      if (parts.length !== 3) throw new Error("Invalid room payload format");

      const { data, error } = await supabase
        .from('locks')
        .select('payload, created_at')
        .eq('id', parts[0])
        .single();

      if (error || !data) {
        throw new Error("Room not found. It may have expired or the link is incorrect.");
      }

      const publicPayload = data.payload;
      if (publicPayload.surface !== 'after-dark-room' || !publicPayload.encData) {
        throw new Error("This link does not point to a Gallery Room.");
      }

      const createdAt = data.created_at ? new Date(data.created_at).getTime() : (publicPayload.createdAt || Date.now());
      if (Date.now() > getVaultExpiryMs(createdAt, publicPayload.expiresInHours || 24)) {
        throw new Error("Room expired.");
      }

      const derivedAesKey = await deriveKey(roomKey, parts[1]);
      const ivBytes = base64ToBuffer(publicPayload.roomIv || decodeURIComponent(parts[2]));
      const encryptedBytes = base64ToBuffer(publicPayload.encData);
      const decryptedJson = await decryptData(encryptedBytes, derivedAesKey, ivBytes);
      const privatePayload = JSON.parse(decryptedJson);

      currentGalleryRoom = {
        publicPayload: {
          ...publicPayload,
          createdAt,
          roomId: parts[0],
          salt: parts[1],
          iv: publicPayload.roomIv || parts[2],
          roomStatus: publicPayload.roomStatus || 'active',
          revision: Number(publicPayload.revision || 0),
        },
        privatePayload,
        roleContext: {
          role,
          roomKey,
          roleKey,
          privateThirdKey,
        },
      };

      setupGalleryRoomViewer();
    } catch (e) {
      console.error("Failed to decode room link", e);
      window.location.href = "404.html";
    }
  } else if (hash.startsWith("#lock=")) {
    // Show a loading state if desired, replacing creator view while fetching
    switchView("solver-view"); // Just show the raw view for a moment
    document.getElementById("vault-status-text").innerText = "Fetching vault...";

    try {
      if (!supabase) throw new Error("Supabase client is not configured");

      const fragmentStr = hash.replace("#lock=", "");
      
      // format: id.salt.ivBase64
      const parts = fragmentStr.split(".");
      if (parts.length !== 3) throw new Error("Invalid lock link format");

      const lockId = parts[0];
      
      const { data, error } = await supabase
        .from('locks')
        .select('payload, created_at')
        .eq('id', lockId)
        .single();

      if (error || !data) {
        throw new Error("Vault not found. It may have expired or the link is incorrect.");
      }
      
      // Structure expected: { q, t, title, encData }
      const publicPayload = data.payload;
      
      // Keep fragments attached to currentSolverQuiz for later decryption step
      currentSolverQuiz = {
        ...publicPayload,
        salt: parts[1],
        iv: parts[2],
        createdAt: data.created_at ? new Date(data.created_at).getTime() : (publicPayload.createdAt || Date.now())
      };

      if (Date.now() > getVaultExpiryMs(currentSolverQuiz.createdAt, currentSolverQuiz.expiresInHours || 24)) {
        throw new Error("Vault expired.");
      }
      
      if (currentSolverQuiz && currentSolverQuiz.q && currentSolverQuiz.encData) {
        setupSolverQuiz(currentSolverQuiz);
      } else {
        throw new Error("Invalid payload data on server.");
      }
    } catch (e) {
      console.error("Failed to decode lock link", e);
      window.location.href = "404.html";
    }
  } else {
    switchView("creator-view");
  }
}

function getGalleryRoleLabel(role, scenario = {}) {
  if (role === 'creator') return scenario.creatorLabel || 'Creator';
  if (role === 'partner') return scenario.partnerLabel || 'Partner';
  if (role === 'third') return scenario.thirdLabel || 'Third';
  return 'Guest';
}

function setupGalleryRoomViewer() {
  if (!currentGalleryRoom) return;

  const { publicPayload, privatePayload, roleContext } = currentGalleryRoom;
  const role = roleContext.role;
  const scenario = publicPayload.scenario || {};
  const roleLabel = getGalleryRoleLabel(role, scenario);

  updateDocumentTitle({ afterDark: true, discreet: Boolean(publicPayload.discreet) });
  applyBodyClasses(publicPayload.t || 'pink', true);
  document.getElementById("solver-vault-title").innerText = publicPayload.discreet ? "Private Room" : publicPayload.title;
  startGalleryRoomCountdown(publicPayload.createdAt, publicPayload.expiresInHours || 24);
  document.getElementById("vault-wrapper").classList.add("hidden");
  document.querySelector(".quiz-wrapper").classList.add("hidden");
  document.getElementById("gallery-room-viewer").classList.remove("hidden");
  document.getElementById("gallery-room-role-badge").innerText = roleLabel;
  document.getElementById("gallery-room-viewer-title").innerText = publicPayload.discreet ? "Private Gallery Room" : publicPayload.title;
  document.getElementById("gallery-room-viewer-summary").innerText =
    `${formatScenarioLabel(scenario.type)} · ${formatScenarioLabel(scenario.intensity)} · ${publicPayload.mediaCount} image${publicPayload.mediaCount === 1 ? '' : 's'} · ${roleLabel} seat`;

  document.getElementById("gallery-room-wallet").classList.toggle("hidden", role !== 'third');
  document.getElementById("private-third-panel").classList.toggle("hidden", !canAccessPrivateThirdChat(role));
  document.getElementById("gallery-room-admin-panel").classList.toggle("hidden", role !== 'creator');

  setGallerySyncStatus(`Encrypted sync ready · revision ${Number(publicPayload.revision || 0)}`);
  renderGalleryRoomBurnState();
  renderGalleryRoomImages();
  renderGalleryRoomChats();
  startGalleryRoomPolling();
}

function setGallerySyncStatus(message, variant = '') {
  const status = document.getElementById("gallery-room-sync-status");
  if (!status) return;
  status.innerText = message;
  status.dataset.variant = variant;
}

function renderGalleryRoomBurnState() {
  if (!currentGalleryRoom) return;
  const isBurned = currentGalleryRoom.publicPayload.roomStatus === 'burned';
  document.getElementById("burned-room-card").classList.toggle("hidden", !isBurned);
  document.getElementById("gallery-room-grid-panel").classList.toggle("hidden", isBurned);
  document.getElementById("gallery-chat-layout").classList.toggle("hidden", isBurned);
  document.getElementById("gallery-room-admin-panel").classList.toggle("hidden", isBurned || currentGalleryRoom.roleContext.role !== 'creator');
  if (isBurned) {
    setGallerySyncStatus("Room burned. Sync stopped.", "danger");
    stopGalleryRoomPolling();
  }
}

async function persistCurrentGalleryRoom(statusMessage = "Encrypted room state saved.") {
  if (!currentGalleryRoom || !supabase) return false;
  const { publicPayload, privatePayload, roleContext } = currentGalleryRoom;
  const roomId = publicPayload.roomId;
  if (!roomId) return false;

  galleryRoomSyncInFlight = true;
  setGallerySyncStatus("Encrypting and saving room state...");
  try {
    const ivBytes = crypto.getRandomValues(new Uint8Array(12));
    const derivedAesKey = await deriveKey(roleContext.roomKey, publicPayload.salt);
    const encryptedBuffer = await encryptData(JSON.stringify(privatePayload), derivedAesKey, ivBytes);
    const encryptedBase64 = bufferToBase64(encryptedBuffer);
    const nextIv = bufferToBase64(ivBytes);
    const updatedPublicPayload = buildPersistedRoomPayload({
      publicPayload: {
        ...publicPayload,
        roomIv: nextIv,
      },
      encryptedBase64,
      roomStatus: publicPayload.roomStatus || 'active',
      updatedAt: Date.now(),
    });

    const { error } = await supabase
      .from('locks')
      .update({ payload: updatedPublicPayload })
      .eq('id', roomId);

    if (error) {
      console.error("Gallery room sync failed", error);
      setGallerySyncStatus("Sync failed. Your local change is visible here only.", "danger");
      return false;
    }

    currentGalleryRoom.publicPayload = {
      ...updatedPublicPayload,
      roomId,
      salt: publicPayload.salt,
      iv: nextIv,
      createdAt: publicPayload.createdAt,
    };
    setGallerySyncStatus(`${statusMessage} · revision ${currentGalleryRoom.publicPayload.revision}`, "ready");
    return true;
  } finally {
    galleryRoomSyncInFlight = false;
  }
}

function startGalleryRoomPolling() {
  stopGalleryRoomPolling();
  if (!currentGalleryRoom || currentGalleryRoom.publicPayload.roomStatus === 'burned') return;
  galleryRoomSyncInterval = setInterval(refreshGalleryRoomState, 7000);
}

function stopGalleryRoomPolling() {
  if (galleryRoomSyncInterval) {
    clearInterval(galleryRoomSyncInterval);
    galleryRoomSyncInterval = null;
  }
}

async function refreshGalleryRoomState() {
  if (!currentGalleryRoom || galleryRoomSyncInFlight) return;
  const { publicPayload, roleContext } = currentGalleryRoom;
  if (!publicPayload.roomId || publicPayload.roomStatus === 'burned') return;
  if (Date.now() > getVaultExpiryMs(publicPayload.createdAt, publicPayload.expiresInHours || 24)) {
    stopGalleryRoomPolling();
    setGallerySyncStatus("Room expired. Sync stopped.", "danger");
    return;
  }

  galleryRoomSyncInFlight = true;
  try {
    const { data, error } = await supabase
      .from('locks')
      .select('payload')
      .eq('id', publicPayload.roomId)
      .single();

    if (error || !data?.payload) throw error || new Error("Room payload missing.");
    const remotePayload = data.payload;
    if (Number(remotePayload.revision || 0) <= Number(publicPayload.revision || 0)) return;

    const derivedAesKey = await deriveKey(roleContext.roomKey, publicPayload.salt);
    const ivBytes = base64ToBuffer(remotePayload.roomIv || decodeURIComponent(publicPayload.iv));
    const encryptedBytes = base64ToBuffer(remotePayload.encData);
    const decryptedJson = await decryptData(encryptedBytes, derivedAesKey, ivBytes);

    currentGalleryRoom.privatePayload = JSON.parse(decryptedJson);
    currentGalleryRoom.publicPayload = {
      ...remotePayload,
      roomId: publicPayload.roomId,
      salt: publicPayload.salt,
      iv: remotePayload.roomIv || publicPayload.iv,
      createdAt: publicPayload.createdAt,
      roomStatus: remotePayload.roomStatus || 'active',
      revision: Number(remotePayload.revision || 0),
    };
    setGallerySyncStatus(`Synced latest encrypted room state · revision ${currentGalleryRoom.publicPayload.revision}`, "ready");
    renderGalleryRoomBurnState();
    renderGalleryRoomImages();
    renderGalleryRoomChats();
  } catch (error) {
    console.error("Gallery room refresh failed", error);
    setGallerySyncStatus("Could not refresh room state. Keeping current local view.", "danger");
  } finally {
    galleryRoomSyncInFlight = false;
  }
}

function startGalleryRoomCountdown(createdAtTimestamp, expiresInHours) {
  const timerSpan = document.getElementById("countdown-timer");
  if (!timerSpan) return;
  if (timerInterval) clearInterval(timerInterval);

  const updateTimer = () => {
    const diff = getVaultExpiryMs(createdAtTimestamp, expiresInHours) - Date.now();
    timerSpan.innerText = formatTimeRemaining(diff);
    timerSpan.style.color = diff <= 0 ? "#ff4b72" : "";
    if (diff <= 0) clearInterval(timerInterval);
  };

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function renderGalleryRoomImages() {
  if (!currentGalleryRoom) return;

  const { publicPayload, privatePayload, roleContext } = currentGalleryRoom;
  if (publicPayload.roomStatus === 'burned') return;
  const role = roleContext.role;
  const grid = document.getElementById("gallery-room-grid");
  const coinMode = publicPayload.coinMode || 'request';

  grid.innerHTML = (privatePayload.media || []).map((media, index) => {
    const isCreator = role === 'creator';
    const visibleTo = media.visibleTo || ['creator'];
    const canViewFull = isCreator || visibleTo.includes(role) || visibleTo.includes('all') || media.state === 'unlocked';
    const state = canViewFull ? 'unlocked' : (media.state || 'hidden');
    const imageSrc = canViewFull ? media.p : (media.thumb || '');
    const stateLabel = state === 'requested' ? 'Unlock requested' : state === 'teased' ? 'Teased preview' : state === 'unlocked' ? 'Unlocked' : 'Locked';
    const thirdCanRequest = canRequestGalleryUnlock({ role, coinMode, imageState: media.state || 'hidden' });

    let actionMarkup = '';
    if (isCreator) {
      if (media.state === 'requested') {
        actionMarkup = `<button type="button" class="btn btn-primary btn-sm" data-gallery-approve="${index}">Approve Unlock</button>`;
      } else if (media.state === 'unlocked') {
        actionMarkup = `<button type="button" class="btn btn-secondary btn-sm" data-gallery-relock="${index}">Relock</button>`;
      } else {
        actionMarkup = `<button type="button" class="btn btn-secondary btn-sm" data-gallery-reveal="${index}">Reveal to Room</button>`;
      }
    } else if (role === 'third') {
      if (media.state === 'requested') {
        actionMarkup = `<button type="button" class="btn btn-secondary btn-sm" disabled>Requested</button>`;
      } else if (thirdCanRequest) {
        actionMarkup = `<button type="button" class="btn btn-primary btn-sm" data-gallery-request="${index}">${coinMode === 'auto' ? 'Spend 25 Coins' : 'Request for 25 Coins'}</button>`;
      }
    } else {
      actionMarkup = `<span class="section-subtitle">Waiting on creator control.</span>`;
    }

    return `
      <div class="viewer-gallery-item">
        <div class="viewer-gallery-image ${state}">
          ${imageSrc ? `<img src="${imageSrc}" alt="Gallery room image ${index + 1}">` : ''}
          <span class="viewer-gallery-state">${stateLabel}</span>
        </div>
        <div class="viewer-gallery-actions">
          ${actionMarkup}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll("[data-gallery-request]").forEach(btn => {
    btn.addEventListener("click", () => requestGalleryUnlock(Number(btn.dataset.galleryRequest)));
  });
  grid.querySelectorAll("[data-gallery-approve]").forEach(btn => {
    btn.addEventListener("click", () => approveGalleryUnlock(Number(btn.dataset.galleryApprove)));
  });
  grid.querySelectorAll("[data-gallery-reveal]").forEach(btn => {
    btn.addEventListener("click", () => revealGalleryImage(Number(btn.dataset.galleryReveal)));
  });
  grid.querySelectorAll("[data-gallery-relock]").forEach(btn => {
    btn.addEventListener("click", () => relockGalleryImage(Number(btn.dataset.galleryRelock)));
  });
}

function renderGalleryRoomChats() {
  if (!currentGalleryRoom) return;
  renderGalleryChatLane("gallery-room-chat-list", currentGalleryRoom.privatePayload.roomChat || []);
  renderGalleryChatLane("private-third-chat-list", currentGalleryRoom.privatePayload.privateThirdChat || []);
}

function renderGalleryChatLane(containerId, messages) {
  const container = document.getElementById(containerId);
  const scenario = currentGalleryRoom?.publicPayload?.scenario || {};
  container.innerHTML = messages.map(message => `
    <div class="gallery-chat-message">
      <strong>${getGalleryRoleLabel(message.role, scenario)}</strong>
      <span>${escapeHtml(message.text)}</span>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

async function appendGalleryChatMessage(kind) {
  if (!currentGalleryRoom) return;
  const { publicPayload, roleContext, privatePayload } = currentGalleryRoom;
  const isPrivate = kind === 'private';

  const input = document.getElementById(isPrivate ? "private-third-chat-input" : "gallery-room-chat-input");
  const text = input.value.trim();
  if (!text) return;

  const result = appendGalleryRoomMessage(privatePayload, {
    lane: isPrivate ? 'private' : 'room',
    role: roleContext.role,
    text,
    ts: Date.now(),
    roomStatus: publicPayload.roomStatus || 'active',
  });
  if (!result.changed) {
    setGallerySyncStatus(result.message || "Message was not sent.", "danger");
    return;
  }

  currentGalleryRoom.privatePayload = result.payload;
  input.value = "";
  renderGalleryRoomChats();
  await persistCurrentGalleryRoom("Message synced");
}

async function requestGalleryUnlock(index) {
  const { publicPayload, privatePayload, roleContext } = currentGalleryRoom;
  const result = requestGalleryImageUnlock(privatePayload, {
    index,
    role: roleContext.role,
    coinMode: publicPayload.coinMode || 'request',
    ts: Date.now(),
    roomStatus: publicPayload.roomStatus || 'active',
  });
  if (!result.changed) {
    setGallerySyncStatus(result.message || "Unlock request was not saved.", "danger");
    return;
  }

  currentGalleryRoom.privatePayload = result.payload;
  renderGalleryRoomImages();
  await persistCurrentGalleryRoom(publicPayload.coinMode === 'auto' ? "Image unlocked with mock coins" : "Unlock request synced");
}

async function approveGalleryUnlock(index) {
  if (!currentGalleryRoom) return;
  const result = mutateGalleryImageState(currentGalleryRoom.privatePayload, {
    index,
    role: currentGalleryRoom.roleContext.role,
    action: 'approve',
    roomStatus: currentGalleryRoom.publicPayload.roomStatus || 'active',
  });
  if (!result.changed) {
    setGallerySyncStatus(result.message || "Image state was not changed.", "danger");
    return;
  }

  currentGalleryRoom.privatePayload = result.payload;
  renderGalleryRoomImages();
  await persistCurrentGalleryRoom("Image reveal synced");
}

function revealGalleryImage(index) {
  approveGalleryUnlock(index);
}

async function relockGalleryImage(index) {
  if (!currentGalleryRoom) return;
  const result = mutateGalleryImageState(currentGalleryRoom.privatePayload, {
    index,
    role: currentGalleryRoom.roleContext.role,
    action: 'relock',
    roomStatus: currentGalleryRoom.publicPayload.roomStatus || 'active',
  });
  if (!result.changed) {
    setGallerySyncStatus(result.message || "Image state was not changed.", "danger");
    return;
  }

  currentGalleryRoom.privatePayload = result.payload;
  renderGalleryRoomImages();
  await persistCurrentGalleryRoom("Image relocked");
}

async function burnCurrentGalleryRoom() {
  if (!currentGalleryRoom) return;
  const result = burnGalleryRoomPayload(currentGalleryRoom.privatePayload, {
    role: currentGalleryRoom.roleContext.role,
    ts: Date.now(),
  });
  if (!result.changed) {
    setGallerySyncStatus(result.message || "Room was not burned.", "danger");
    return;
  }

  currentGalleryRoom.privatePayload = result.payload;
  currentGalleryRoom.publicPayload.roomStatus = 'burned';
  renderGalleryRoomBurnState();
  await persistCurrentGalleryRoom("Room burned and revoked");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setupSolverQuiz(quiz) {
  quiz.mode = quiz.mode || 'playful';
  const isAfterDark = quiz.surface === 'after-dark';
  updateDocumentTitle({ afterDark: isAfterDark, discreet: Boolean(quiz.scenario?.discreet) });
  // Apply creator's chosen theme
  applyBodyClasses(quiz.t || 'pink', isAfterDark);
  document.getElementById("gallery-room-viewer").classList.add("hidden");
  document.getElementById("vault-wrapper").classList.remove("hidden");
  document.querySelector(".quiz-wrapper").classList.remove("hidden");
  
  // Set custom vault title
  document.getElementById("solver-vault-title").innerText = quiz.scenario?.discreet ? "Private Vault" : (quiz.title || "Love Lock Vault");
  
  // Prep vault photo using the highly blurred thumbnail from the public payload
  const lockedImg = document.getElementById("locked-image");
  if (quiz.thumbBase64) {
    lockedImg.src = quiz.thumbBase64;
    lockedImg.style.background = "";
  } else {
    lockedImg.src = "";
    lockedImg.style.background = "linear-gradient(45deg, #11050e 0%, #2a0b1f 100%)";
  }
  lockedImg.style.width = "100%";
  lockedImg.style.height = "100%";
  lockedImg.style.objectFit = "cover";

  // Reset overlay
  const overlay = document.getElementById("vault-overlay");
  overlay.classList.remove("unlocked");
  document.getElementById("heart-padlock").classList.remove("unlocked");
  document.getElementById("vault-status-text").innerText = "Locked Vault";
  document.getElementById("vault-status-text").style.color = "";
  document.getElementById("key-drag-zone").classList.add("hidden");
  
  // Show quiz controls, hide success
  document.getElementById("recipient-consent-card").classList.toggle("hidden", !isAfterDark);
  document.getElementById("quiz-card").classList.toggle("hidden", isAfterDark);
  document.getElementById("unlocked-card").classList.add("hidden");
  document.getElementById("question-container").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-action-bar").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-progress-container").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-step-info").classList.toggle("hidden", quiz.mode === 'strict');
  document.getElementById("strict-question-container").classList.toggle("hidden", quiz.mode !== 'strict');
  
  // Reset states
  currentQuestionIndex = 0;
  // We will build this string up as they answer correctly
  currentSolverQuiz.solverAccumulatedAnswers = ""; 

  if (isAfterDark) {
    renderRecipientConsentGate(quiz);
  } else {
    beginSolverChallenge();
  }
  adjustProgressiveBlur();
  startCountdownTimer(currentSolverQuiz.createdAt);
  
  // Add listeners
  document.getElementById("btn-submit-answer").onclick = handleSolverSubmit;
  document.getElementById("btn-tap-unlock").onclick = () => triggerUnlockReveal();
  document.getElementById("btn-accept-recipient-consent").onclick = handleRecipientConsentAccept;
  document.getElementById("btn-create-own").onclick = () => {
    window.location.hash = "";
    resetCreatorState();
    switchView("creator-view");
  };
}

function adjustProgressiveBlur() {
  const total = currentSolverQuiz.q.length;
  // Starting image blur is 38px, reducing proportionally
  const imgBlur = Math.max(0, 38 * (1 - (currentQuestionIndex / total)));
  const lockedImg = document.getElementById("locked-image");
  lockedImg.style.filter = `blur(${imgBlur}px)`;
  
  // Progressively lift the dark veil and glass filter on the overlay too
  const overlay = document.getElementById("vault-overlay");
  if (overlay) {
    const fractionRemaining = 1 - (currentQuestionIndex / total);
    const overlayOpacity = Math.max(0.15, 0.85 * fractionRemaining);
    const overlayBlur = Math.max(0, 25 * fractionRemaining);
    
    overlay.style.backgroundColor = `rgba(25, 12, 31, ${overlayOpacity})`;
    overlay.style.backdropFilter = `blur(${overlayBlur}px)`;
    overlay.style.webkitBackdropFilter = `blur(${overlayBlur}px)`;
  }
}

function beginSolverChallenge() {
  const quiz = currentSolverQuiz;
  document.getElementById("recipient-consent-card").classList.add("hidden");
  document.getElementById("quiz-card").classList.remove("hidden");
  document.getElementById("question-container").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-action-bar").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-progress-container").classList.toggle("hidden", quiz.mode === 'strict');
  document.querySelector(".quiz-step-info").classList.toggle("hidden", quiz.mode === 'strict');
  document.getElementById("strict-question-container").classList.toggle("hidden", quiz.mode !== 'strict');

  if (quiz.mode === 'strict') {
    loadStrictSolverForm();
  } else {
    loadSolverQuestion();
  }
}

function renderRecipientConsentGate(quiz) {
  const scenario = quiz.scenario || {};
  document.getElementById("recipient-consent-ack").checked = false;
  document.getElementById("recipient-consent-error").classList.add("hidden");
  document.getElementById("recipient-scenario-title").innerText = quiz.scenario?.discreet ? "Private scenario" : (quiz.title || "After Dark scenario");
  document.getElementById("recipient-scenario-meta").innerHTML = `
    <span>${formatScenarioLabel(scenario.type)}</span>
    <span>${formatScenarioLabel(scenario.intensity)}</span>
    <span>${scenario.role || 'Partner'}</span>
    <span>${scenario.expiresInHours || 24}h expiry</span>
  `;
}

function handleRecipientConsentAccept() {
  const ack = document.getElementById("recipient-consent-ack");
  const error = document.getElementById("recipient-consent-error");
  if (!ack.checked) {
    error.innerText = "Confirm you are 18+ and allowed to view this private vault.";
    error.classList.remove("hidden");
    return;
  }
  error.innerText = "";
  error.classList.add("hidden");
  beginSolverChallenge();
}

function loadStrictSolverForm() {
  const quiz = currentSolverQuiz;
  const strictContainer = document.getElementById("strict-question-container");
  strictContainer.innerHTML = "";

  const heading = document.createElement("h3");
  heading.innerText = "Strict Private Unlock";
  strictContainer.appendChild(heading);

  const intro = document.createElement("p");
  intro.className = "strict-intro";
  intro.innerText = "Answer every question, then unlock once. Individual answers are not checked publicly.";
  strictContainer.appendChild(intro);

  quiz.q.forEach((qData, index) => {
    const group = document.createElement("div");
    group.className = "strict-question-item";

    const label = document.createElement("label");
    label.className = "strict-question-label";
    label.setAttribute("for", `strict-answer-${index}`);
    label.innerText = `${index + 1}. ${qData.question}`;
    group.appendChild(label);

    if (qData.type === 'choice') {
      const select = document.createElement("select");
      select.id = `strict-answer-${index}`;
      select.className = "strict-answer-input";
      select.dataset.index = String(index);

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.innerText = "Choose an answer";
      select.appendChild(emptyOption);

      (qData.options || []).forEach(optionText => {
        const option = document.createElement("option");
        option.value = optionText;
        option.innerText = optionText;
        select.appendChild(option);
      });

      group.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `strict-answer-${index}`;
      input.className = "strict-answer-input";
      input.dataset.index = String(index);
      input.placeholder = "Type your answer";
      input.autocomplete = "off";
      group.appendChild(input);
    }

    if (qData.hint) {
      const hint = document.createElement("p");
      hint.className = "strict-hint";
      hint.innerText = `Hint: ${qData.hint}`;
      group.appendChild(hint);
    }

    strictContainer.appendChild(group);
  });

  const error = document.createElement("p");
  error.id = "strict-unlock-error";
  error.className = "field-error hidden";
  error.setAttribute("aria-live", "polite");
  strictContainer.appendChild(error);

  const unlockButton = document.createElement("button");
  unlockButton.type = "button";
  unlockButton.className = "btn btn-primary btn-block btn-lg";
  unlockButton.id = "btn-strict-unlock";
  unlockButton.innerText = "Unlock Vault";
  unlockButton.onclick = handleStrictUnlock;
  strictContainer.appendChild(unlockButton);
}

async function handleStrictUnlock() {
  const strictError = document.getElementById("strict-unlock-error");
  const answers = Array.from(document.querySelectorAll(".strict-answer-input"))
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map(input => input.value.trim());

  if (answers.some(answer => !answer)) {
    strictError.innerText = "Answer every question before unlocking.";
    strictError.classList.remove("hidden");
    return;
  }

  strictError.classList.add("hidden");
  strictError.innerText = "";
  currentSolverQuiz.solverAccumulatedAnswers = combineNormalizedAnswers(answers);
  await triggerUnlockReveal({ strictAttempt: true });
}

function loadSolverQuestion() {
  const quiz = currentSolverQuiz;
  const progressPercent = (currentQuestionIndex / quiz.q.length) * 100;
  
  document.getElementById("quiz-progress").style.width = `${progressPercent}%`;
  document.getElementById("current-question-num").innerText = currentQuestionIndex + 1;
  document.getElementById("total-questions-num").innerText = quiz.q.length;
  
  const qData = quiz.q[currentQuestionIndex];
  document.getElementById("solver-question-text").innerText = qData.question;
  
  // Adjust progressive unblur
  adjustProgressiveBlur();
  
  // Clear any existing couch warning
  const warning = document.getElementById("couch-warning");
  warning.classList.add("hidden");
  
  // Clear selected states
  solverSelectedOption = null;
  
  // Load & render hints
  let hintWrap = document.getElementById("solver-hint-wrapper");
  if (!hintWrap) {
    hintWrap = document.createElement("div");
    hintWrap.id = "solver-hint-wrapper";
    hintWrap.className = "hint-container";
    document.getElementById("question-container").appendChild(hintWrap);
  }
  hintWrap.innerHTML = "";
  if (qData.hint) {
    hintWrap.innerHTML = `
      <button type="button" class="btn-hint-trigger" id="btn-show-hint">
        💡 Show Hint
      </button>
      <div class="hint-bubble hidden" id="hint-text-bubble">
        ${qData.hint}
      </div>
    `;
    document.getElementById("btn-show-hint").onclick = () => {
      const bubble = document.getElementById("hint-text-bubble");
      bubble.classList.toggle("hidden");
    };
  }
  
  if (qData.type === 'text') {
    document.getElementById("solver-text-input-container").classList.remove("hidden");
    document.getElementById("solver-options-container").classList.add("hidden");
    
    const txtInp = document.getElementById("solver-text-answer");
    txtInp.value = "";
    txtInp.focus();
    
    txtInp.onkeyup = (e) => {
      if (e.key === 'Enter') handleSolverSubmit();
    };
  } else {
    document.getElementById("solver-text-input-container").classList.add("hidden");
    const optionsGrid = document.getElementById("solver-options-container");
    optionsGrid.classList.remove("hidden");
    optionsGrid.innerHTML = "";
    
    qData.options.forEach((optText) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = optText;
      btn.onclick = () => {
        optionsGrid.querySelectorAll(".btn-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        solverSelectedOption = optText;
      };
      optionsGrid.appendChild(btn);
    });
  }
}

async function handleSolverSubmit() {
  const quiz = currentSolverQuiz;
  const qData = quiz.q[currentQuestionIndex];
  
  let answerText = "";
  if (qData.type === 'text') {
    answerText = document.getElementById("solver-text-answer").value.trim();
  } else {
    answerText = solverSelectedOption || "";
  }
  
  if (!answerText) {
    alert("Please enter or select an answer!");
    return;
  }
  
  const submittedHash = await hashString(answerText);
  
  if (submittedHash === qData.answerHash) {
    // Collect the exact answer string for AES key derivation later
    currentSolverQuiz.solverAccumulatedAnswers += normalizeAnswer(answerText);

    currentQuestionIndex++;
    playCorrectSound(); // Play dynamic chime
    const qContainer = document.getElementById("question-container");
    
    if (currentQuestionIndex >= quiz.q.length) {
      document.getElementById("quiz-progress").style.width = `100%`;
      
      // All questions solved! Transition to Drag key to unlock
      qContainer.classList.add("slide-out-left");
      setTimeout(() => {
        document.getElementById("quiz-card").classList.add("hidden");
        qContainer.classList.remove("slide-out-left");
        
        // Show Drag Key UI
        document.getElementById("vault-status-text").innerText = "Quiz Solved! Unlock the Vault.";
        document.getElementById("key-drag-zone").classList.remove("hidden");
        
        // Image unblurs a bit more to invite drag
        const lockedImg = document.getElementById("locked-image");
        lockedImg.style.filter = "blur(3px)";
        const overlay = document.getElementById("vault-overlay");
        overlay.style.backgroundColor = "rgba(25, 12, 31, 0.35)";
        overlay.style.backdropFilter = "blur(2px)";
        overlay.style.webkitBackdropFilter = "blur(2px)";
        
        initGoldenKeyDrag();
      }, 250);
    } else {
      // Question transition slide out
      qContainer.classList.add("slide-out-left");
      setTimeout(() => {
        loadSolverQuestion();
        qContainer.classList.remove("slide-out-left");
        qContainer.classList.add("slide-in-right");
        setTimeout(() => {
          qContainer.classList.remove("slide-in-right");
        }, 250);
      }, 250);
    }
  } else {
    playIncorrectSound(); // Play soft low tone
    const quizCard = document.getElementById("quiz-card");
    quizCard.classList.remove("shake");
    void quizCard.offsetWidth;
    quizCard.classList.add("shake");
    
    const warning = document.getElementById("couch-warning");
    const warningText = document.getElementById("warning-text");
    
    const msg = COUCH_MESSAGES[Math.floor(Math.random() * COUCH_MESSAGES.length)];
    warningText.innerText = msg;
    warning.classList.remove("hidden");
  }
}

// GOLDEN KEY TACTILE DRAGGING ENGINE
function initGoldenKeyDrag() {
  const key = document.getElementById("golden-key");
  const padlock = document.getElementById("heart-padlock");
  const dragZone = document.getElementById("key-drag-zone");
  if (!key || !padlock) return;

  // Reset coordinates, opacity, and transitions
  key.style.transform = "translate(0, 0)";
  key.style.transition = "none";
  key.style.opacity = "1";
  key.style.animation = "floatKey 3s infinite ease-in-out";
  key.style.pointerEvents = "auto";

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let clientX = 0;
  let clientY = 0;
  let rafId = null;

  let padlockRect = padlock.getBoundingClientRect();

  const updatePosition = () => {
    if (!isDragging) return;
    currentX = clientX - startX;
    currentY = clientY - startY;
    key.style.transform = `translate(${currentX}px, ${currentY}px)`;
    
    // Center collision detection
    const keyRect = key.getBoundingClientRect();
    const px = padlockRect.left + padlockRect.width / 2;
    const py = padlockRect.top + padlockRect.height / 2;
    const kx = keyRect.left + keyRect.width / 2;
    const ky = keyRect.top + keyRect.height / 2;

    const dist = Math.hypot(px - kx, py - ky);
    if (dist < 60) {
      isDragging = false;
      cancelAnimationFrame(rafId);
      key.style.pointerEvents = "none";
      
      // Smoothly fade and scale out the key right where it is dropped on the lock
      key.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      key.style.transform = `translate(${currentX}px, ${currentY}px) scale(0.1)`;
      key.style.opacity = "0";
      
      setTimeout(() => {
        dragZone.classList.add("hidden");
        triggerUnlockReveal();
      }, 300);
      return;
    }
    
    rafId = requestAnimationFrame(updatePosition);
  };

  const dragStart = (e) => {
    isDragging = true;
    key.style.animation = "none";
    key.style.transition = "none";
    
    const eventClientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    const eventClientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
    
    startX = eventClientX - currentX;
    startY = eventClientY - currentY;
    
    padlockRect = padlock.getBoundingClientRect();
    rafId = requestAnimationFrame(updatePosition);
  };

  const dragMove = (e) => {
    if (!isDragging) return;
    
    // Only call preventDefault if the touch event is cancelable to avoid errors
    if (e.cancelable) {
      e.preventDefault();
    }
    
    clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
  };

  const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    cancelAnimationFrame(rafId);
    
    // Return key to home with bounce animation
    key.style.transition = "transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    currentX = 0;
    currentY = 0;
    key.style.transform = "translate(0, 0)";
    
    setTimeout(() => {
      if (!isDragging) {
        key.style.transition = "transform 0.1s ease, filter 0.3s ease";
        key.style.animation = "floatKey 3s infinite ease-in-out";
      }
    }, 450);
  };

  // Clean listener bindings (ensuring non-passive touchmove listeners are used for 60fps dragging on mobile)
  key.addEventListener("mousedown", dragStart);
  window.addEventListener("mousemove", dragMove);
  window.addEventListener("mouseup", dragEnd);

  key.addEventListener("touchstart", dragStart, { passive: false });
  window.addEventListener("touchmove", dragMove, { passive: false });
  window.addEventListener("touchend", dragEnd, { passive: false });
}

async function triggerUnlockReveal({ strictAttempt = false } = {}) {
  document.getElementById("quiz-card").classList.add("hidden");
  const statusText = document.getElementById("vault-status-text");

  try {
    statusText.innerText = "Decrypting Image... 🔐";
    
    // Attempt Decryption
    const key = await deriveKey(currentSolverQuiz.solverAccumulatedAnswers, currentSolverQuiz.salt);
    const ivBytes = base64ToBuffer(decodeURIComponent(currentSolverQuiz.iv));
    const encryptedBytes = base64ToBuffer(currentSolverQuiz.encData);
    
    const decryptedJsonStr = await decryptData(encryptedBytes, key, ivBytes);
    const privatePayload = JSON.parse(decryptedJsonStr);

    playUnlockSound(); // Synthesize cascading sweep sound
    
    // Instantly remove blur and set the real image
    const lockedImg = document.getElementById("locked-image");
    lockedImg.src = privatePayload.p;
    lockedImg.style.filter = "blur(0px)";
    
    // Setup message
    if (privatePayload.m) {
      document.getElementById("partner-note-text").innerText = `"${privatePayload.m}"`;
    } else {
      document.getElementById("partner-note-text").innerText = `"You proved your love! Perfect score! 🎉"`;
    }

    // Unlocked padlock animation
    const padlock = document.getElementById("heart-padlock");
    padlock.classList.add("unlocked");
    
    statusText.innerText = "Access Granted! ❤️";
    statusText.style.color = "#00f2fe";
    
    setTimeout(() => {
      const overlay = document.getElementById("vault-overlay");
      overlay.classList.add("unlocked");
      
      const unlockedCard = document.getElementById("unlocked-card");
      unlockedCard.classList.remove("hidden");
      
      launchHeartConfetti();
    }, 1200);
  } catch (error) {
    console.error("Decryption failed:", error);
    statusText.innerText = strictAttempt ? "Still Locked" : "Decryption Failed! Invalid Key.";
    statusText.style.color = "#ff4b72";
    if (strictAttempt) {
      document.getElementById("quiz-card").classList.remove("hidden");
      const strictError = document.getElementById("strict-unlock-error");
      if (strictError) {
        strictError.innerText = "One or more answers are incorrect. Check them and try again.";
        strictError.classList.remove("hidden");
      }
      return;
    }
    alert("Cryptography Error: Decryption failed. Did you modify the URL?");
  }
}

// BURST CELEBRATION HEART CONFETTI
function launchHeartConfetti() {
  if (prefersReducedMotion()) return;
  const container = document.body;
  const count = 40;
  
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.innerHTML = "❤️";
    p.style.position = "fixed";
    p.style.fontSize = `${Math.random() * 24 + 12}px`;
    p.style.left = "50%";
    p.style.top = "50%";
    p.style.zIndex = "1000";
    p.style.pointerEvents = "none";
    p.style.userSelect = "none";
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 15 + 5;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 10;
    
    p.dataset.vx = vx;
    p.dataset.vy = vy;
    p.dataset.alpha = 1;
    
    container.appendChild(p);
    animateConfetti(p);
  }
}

function animateConfetti(el) {
  let vx = parseFloat(el.dataset.vx);
  let vy = parseFloat(el.dataset.vy);
  let alpha = parseFloat(el.dataset.alpha);
  let x = 0;
  let y = 0;
  
  function update() {
    vy += 0.3;
    vx *= 0.98;
    x += vx;
    y += vy;
    alpha -= 0.015;
    
    el.style.transform = `translate(${x}px, ${y}px) rotate(${x * 2}deg)`;
    el.style.opacity = alpha;
    
    if (alpha <= 0) {
      el.remove();
    } else {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

let timerInterval = null;

function formatTimeRemaining(diff) {
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
  const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
  return `${h}h ${m}m ${s}s`;
}

function startCountdownTimer(createdAtTimestamp) {
  const timerSpan = document.getElementById("countdown-timer");
  if (!timerSpan) return;
  
  if (timerInterval) clearInterval(timerInterval);
  
  const updateTimer = () => {
    const now = Date.now();
    const expiresAt = getVaultExpiryMs(createdAtTimestamp, currentSolverQuiz?.expiresInHours || 24);
    const diff = expiresAt - now;
    
    if (diff <= 0) {
      timerSpan.innerText = "Expired";
      timerSpan.style.color = "#ff4b72";
      clearInterval(timerInterval);
      return;
    }
    
    timerSpan.innerText = formatTimeRemaining(diff);
  };
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}
