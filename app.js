/**
 * LoveLock - Relationship Quiz & Photo Unlocker
 * Hybrid Zero-Knowledge Storage (Supabase) version.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Global State
let db = {
  photoBase64: null,
  photoThumbBase64: null,
  questions: [], // { type: 'text'|'choice', question: '', answerHash: '', options: [], hint: '' }
  message: '',
  theme: 'pink'
};

let currentSolverQuiz = null; // Decoded state for solver
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

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  initBackgroundHearts();
  initCreatorView();
  checkUrlPayload();
  
  // Play subtle feedback click sound on buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, .btn, .btn-option, .btn-theme-select, .btn-remove-photo-badge, .btn-hint-trigger");
    if (btn) {
      playClickSound();
    }
  });
});

// BACKGROUND HEARTS ANIMATION
function initBackgroundHearts() {
  const bg = document.getElementById("hearts-bg");
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
  const normalized = str.trim().toLowerCase().replace(/\s+/g, ' ');
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
    document.querySelector('.app-header').classList.remove('hidden');
    // Preview theme in creator view too
    document.body.className = `theme-${db.theme}`;
  } else if (viewId === 'solver-view') {
    document.querySelector('.app-header').classList.add('hidden');
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
  
  // Theme selection click handlers
  themePicker.querySelectorAll(".btn-theme-select").forEach(btn => {
    btn.addEventListener("click", () => {
      themePicker.querySelectorAll(".btn-theme-select").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      db.theme = btn.dataset.theme;
      document.body.className = `theme-${db.theme}`;
    });
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
  document.getElementById("btn-test-lock").addEventListener("click", () => {
    window.location.hash = document.getElementById("share-url-input").value.split("#")[1];
    checkUrlPayload();
  });
  document.getElementById("btn-reset-creator").addEventListener("click", () => {
    window.location.hash = "";
    resetCreatorState();
    switchView("creator-view");
  });
  
  // Load a single empty question by default
  addQuestionToCreatorForm();
}

function handlePhotoSelected(file) {
  const uploadPrompt = document.getElementById("upload-prompt");
  const previewContainer = document.getElementById("upload-preview-container");
  const imgPreview = document.getElementById("image-preview");
  
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
    alert("Could not load image. Please try a different format.");
  });
}

function resetPhotoInput() {
  db.photoBase64 = null;
  db.photoThumbBase64 = null;
  document.getElementById("photo-input").value = "";
  document.getElementById("upload-prompt").classList.remove("hidden");
  document.getElementById("upload-preview-container").classList.add("hidden");
  document.getElementById("drop-zone").classList.remove("has-photo");
  validateCreatorForm();
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
  const questions = document.querySelectorAll(".question-item");
  
  let isValid = true;
  
  if (!db.photoBase64) {
    isValid = false;
  }
  
  if (questions.length === 0) {
    isValid = false;
  }
  
  questions.forEach(qItem => {
    const qText = qItem.querySelector(".q-text-input").value.trim();
    if (!qText) isValid = false;
    
    const type = qItem.dataset.type;
    if (type === 'text') {
      const ans = qItem.querySelector(".q-answer-input").value.trim();
      if (!ans) isValid = false;
    } else {
      const optionValInputs = qItem.querySelectorAll(".q-option-val");
      let filledOptions = 0;
      optionValInputs.forEach(optInp => {
        if (optInp.value.trim()) filledOptions++;
      });
      if (filledOptions < 2) isValid = false;
    }
  });
  
  generateBtn.disabled = !isValid;
}

// GENERATE LOVE LOCK PAYLOAD (Hybrid Zero-Knowledge)
async function handleGenerateLock() {
  const generateBtn = document.getElementById("btn-generate-lock");
  generateBtn.innerText = "Encrypting Lock...";
  generateBtn.disabled = true;
  
  try {
    if (!supabase) throw new Error("Supabase client is not configured. Please add .env variables.");

    const qItems = document.querySelectorAll(".question-item");
    const parsedQuestions = [];
    let combinedAnswersNormalized = ""; // Used to derive the AES key
    
    for (let qItem of qItems) {
      const qText = qItem.querySelector(".q-text-input").value.trim();
      const type = qItem.dataset.type;
      const hint = qItem.querySelector(".q-hint-input").value.trim();
      
      let correctTextForEncryption = '';

      if (type === 'text') {
        const correctText = qItem.querySelector(".q-answer-input").value.trim();
        const hash = await hashString(correctText);
        correctTextForEncryption = correctText;
        parsedQuestions.push({
          type: 'text',
          question: qText,
          answerHash: hash,
          hint: hint
        });
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
        
        parsedQuestions.push({
          type: 'choice',
          question: qText,
          options: options,
          answerHash: hash,
          hint: hint
        });
      }

      combinedAnswersNormalized += correctTextForEncryption.trim().toLowerCase().replace(/\s+/g, ' ');
    }
    
    // Setup for AES-GCM
    const salt = generateRandomString(16);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from the concatenated exact answers
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
    const publicPayload = {
      q: parsedQuestions,
      t: db.theme,
      title: document.getElementById("vault-title-input").value.trim() || "Love Lock Vault",
      encData: encryptedBase64,
      thumbBase64: db.photoThumbBase64,
      createdAt: Date.now()
    };

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
    
    const sizeWarning = document.getElementById("payload-size-warning");
    sizeWarning.innerText = `Data Envelope: Secured in Database (Zero-Knowledge). Link length is optimized!`;
    sizeWarning.classList.remove("warning");
    
    switchView("share-view");
  } catch (error) {
    console.error("Lock creation failed", error);
    alert(error.message || "An error occurred during encryption. Please try again.");
  } finally {
    generateBtn.innerText = "Generate My Love Lock";
    generateBtn.disabled = false;
  }
}

function copyShareUrl() {
  const urlInp = document.getElementById("share-url-input");
  urlInp.select();
  urlInp.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(urlInp.value).then(() => {
    const copyBtn = document.getElementById("btn-copy-url");
    const origText = copyBtn.innerText;
    copyBtn.innerText = "Copied! ❤️";
    copyBtn.style.background = "#00f2fe";
    copyBtn.style.color = "#0a050c";
    setTimeout(() => {
      copyBtn.innerText = origText;
      copyBtn.style.background = "";
      copyBtn.style.color = "";
    }, 2000);
  });
}

function resetCreatorState() {
  db.photoBase64 = null;
  db.photoThumbBase64 = null;
  db.theme = 'pink';
  resetPhotoInput();
  document.getElementById("questions-list").innerHTML = "";
  document.getElementById("custom-message").value = "";
  document.getElementById("vault-title-input").value = "";
  
  // Reset theme selector active class
  const themePicker = document.getElementById("theme-picker");
  themePicker.querySelectorAll(".btn-theme-select").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.theme === 'pink') btn.classList.add("active");
  });
  document.body.className = "theme-pink";
  
  addQuestionToCreatorForm();
}

// SOLVER VAULT DECODING & PLAYBACK
async function checkUrlPayload() {
  const hash = window.location.hash;
  if (hash.startsWith("#lock=")) {
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

function setupSolverQuiz(quiz) {
  // Apply creator's chosen theme
  document.body.className = `theme-${quiz.t || 'pink'}`;
  
  // Set custom vault title
  document.getElementById("solver-vault-title").innerText = quiz.title || "Love Lock Vault";
  
  // Prep vault photo using the highly blurred thumbnail from the public payload
  const lockedImg = document.getElementById("locked-image");
  if (quiz.thumbBase64) {
    lockedImg.src = quiz.thumbBase64;
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
  document.getElementById("key-drag-zone").classList.add("hidden");
  
  // Show quiz controls, hide success
  document.getElementById("quiz-card").classList.remove("hidden");
  document.getElementById("unlocked-card").classList.add("hidden");
  
  // Reset states
  currentQuestionIndex = 0;
  // We will build this string up as they answer correctly
  currentSolverQuiz.solverAccumulatedAnswers = ""; 

  loadSolverQuestion();
  adjustProgressiveBlur();
  startCountdownTimer(currentSolverQuiz.createdAt);
  
  // Add listeners
  document.getElementById("btn-submit-answer").onclick = handleSolverSubmit;
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
    currentSolverQuiz.solverAccumulatedAnswers += answerText.trim().toLowerCase().replace(/\s+/g, ' ');

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

async function triggerUnlockReveal() {
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
    statusText.innerText = "Decryption Failed! Invalid Key.";
    statusText.style.color = "#ff4b72";
    alert("Cryptography Error: Decryption failed. Did you modify the URL?");
  }
}

// BURST CELEBRATION HEART CONFETTI
function launchHeartConfetti() {
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

function startCountdownTimer(createdAtTimestamp) {
  const timerSpan = document.getElementById("countdown-timer");
  if (!timerSpan) return;
  
  if (timerInterval) clearInterval(timerInterval);
  
  const updateTimer = () => {
    const now = Date.now();
    const expiresAt = createdAtTimestamp + (24 * 60 * 60 * 1000); // 24 hours later
    const diff = expiresAt - now;
    
    if (diff <= 0) {
      timerSpan.innerText = "Expired";
      timerSpan.style.color = "#ff4b72";
      clearInterval(timerInterval);
      return;
    }
    
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
    
    timerSpan.innerText = `${h}h ${m}m ${s}s`;
  };
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}
