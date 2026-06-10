// ─── Respire PWA — app.js V1 (corrigé) ───────────────────────────────────────
// Corrections : animation respiratoire, sliders post-séance, algorithme guidance,
// message de complétion contextuel, barre de progression objectif,
// dernière séance dans hero, quotes shuffle amélioré.

const STORAGE_KEY   = "respire.v1";
const SETTINGS_KEY  = "respire.settings.v1";
const QUOTE_KEY     = "respire.quotes.v1";

const moods = [
  { id: "stress",   label: "Stressé",              hint: "Tension mentale ou urgence" },
  { id: "fatigue",  label: "Fatigué",               hint: "Besoin de récupérer" },
  { id: "disperse", label: "Dispersé",              hint: "Difficulté à se concentrer" },
  { id: "tension",  label: "Tendu",                 hint: "Corps crispé" },
  { id: "triste",   label: "Chargé émotionnellement", hint: "Besoin d'espace" },
  { id: "energie",  label: "Besoin d'énergie",      hint: "Relancer sans s'agiter" },
  { id: "bien",     label: "Plutôt bien",           hint: "Entretenir la pratique" }
];

const quotes = {
  neutral: [
    "Une seule séance suffit pour garder le fil.",
    "Reprendre compte plus que réussir.",
    "Deux minutes pratiquées valent mieux que vingt minutes prévues.",
    "La régularité se construit sans dramatiser les pauses.",
    "Le corps comprend vite quand on lui laisse un peu de calme.",
    "Pas besoin d'être prêt. Juste présent.",
    "Une pratique modeste et régulière dépasse toujours l'intention ambitieuse."
  ],
  warm: [
    "Commence petit. Le corps comprend vite.",
    "Tu peux revenir maintenant, sans compenser.",
    "Une respiration claire peut changer la suite de la journée.",
    "Chaque séance s'additionne, même les petites.",
    "Tu n'as rien à prouver. Tu explores."
  ],
  spiritual: [
    "Reviens à ton axe. L'énergie suit l'attention.",
    "Respire, clarifie, élève doucement ton état.",
    "Ton rythme intérieur peut redevenir stable.",
    "Le calme est une compétence, pas un état d'âme.",
    "Inspire ce dont tu as besoin. Expire ce qui ne sert plus."
  ]
};

// ─── État global ──────────────────────────────────────────────────────────────
let sessions       = [];
let selectedSession = null;
let selectedMood    = null;
let timer           = null;
let remaining       = 0;
let phaseIndex      = 0;
let phaseRemaining  = 0;
let isPaused        = false;
let startedAt       = null;
let prevPhaseIndex  = -1; // FIX animation : mémorise la phase précédente

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const $          = (id) => document.getElementById(id);
const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
const makeId     = () => (globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const state      = ()  => JSON.parse(localStorage.getItem(STORAGE_KEY)  || "[]");
const saveState  = (r) => localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
const settings   = ()  => ({ weeklyGoal: 5, tone: "neutral", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") });
const saveSettings = (v) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));

// ─── Quote shuffle sans répétition ────────────────────────────────────────────
function nextQuote(tone) {
  const list = quotes[tone] || quotes.neutral;
  const stored = JSON.parse(localStorage.getItem(QUOTE_KEY) || "{}");
  let remaining_indices = stored[tone] || [];

  // Si la pile est vide ou trop courte, regénérer un ordre mélangé
  if (remaining_indices.length === 0) {
    remaining_indices = [...Array(list.length).keys()];
    // Fisher-Yates shuffle
    for (let i = remaining_indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining_indices[i], remaining_indices[j]] = [remaining_indices[j], remaining_indices[i]];
    }
    // Éviter de répéter la dernière quote vue
    const lastSeen = stored[`${tone}_last`];
    if (lastSeen !== undefined && remaining_indices[0] === lastSeen && remaining_indices.length > 1) {
      remaining_indices.push(remaining_indices.shift());
    }
  }

  const idx = remaining_indices.shift();
  localStorage.setItem(QUOTE_KEY, JSON.stringify({ ...stored, [tone]: remaining_indices, [`${tone}_last`]: idx }));
  return list[idx];
}

// ─── Fallback séance ──────────────────────────────────────────────────────────
const fallbackSessions = [{
  id: "two-minute-restart", title: "Reprise 2 minutes", category: "Reprise",
  type: "Méditation", duration: 120, intensity: "Minimum viable",
  moods: ["fatigue","stress","triste","disperse","bien"],
  description: "La séance à faire quand tu n'as pas envie. Elle compte entièrement.",
  pattern: [{ label: "Respire", seconds: 8 }],
  guidance: ["Assieds-toi simplement.", "Observe une inspiration.", "Observe une expiration.", "Tu n'as rien à compenser."]
}];

// ─── Init ─────────────────────────────────────────────────────────────────────
init();

async function init() {
  try {
    sessions = await fetch("data/sessions.json").then((r) => {
      if (!r.ok) throw new Error("Impossible de charger les séances");
      return r.json();
    });
  } catch (e) {
    sessions = fallbackSessions;
    console.warn("Sessions chargées depuis le fallback local", e);
  }
  renderToday();
  renderQuote();
  renderMoods();
  renderCategories();
  renderSessions();
  renderStats();
  bindEvents();
  registerServiceWorker();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderToday() {
  const formatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("todayLabel").textContent = formatter.format(new Date());
}

function renderQuote() {
  const tone = settings().tone;
  $("dailyQuote").textContent = nextQuote(tone);
}

function renderMoods() {
  $("moodGrid").innerHTML = moods.map((m) => `
    <button class="mood-button" data-mood="${escapeHTML(m.id)}" aria-pressed="false">
      <strong>${escapeHTML(m.label)}</strong>
      <span>${escapeHTML(m.hint)}</span>
    </button>
  `).join("");
}

function renderCategories() {
  const cats = ["Toutes", ...new Set(sessions.map((s) => s.category))];
  $("categoryFilter").innerHTML = cats.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
}

function renderSessions(category = "Toutes") {
  const filtered = category === "Toutes" ? sessions : sessions.filter((s) => s.category === category);
  $("sessionList").innerHTML = filtered.map(sessionCard).join("");
}

function sessionCard(s) {
  return `
    <button class="session-card" data-session="${escapeHTML(s.id)}">
      <strong>${escapeHTML(s.title)}</strong>
      <span>${escapeHTML(s.description)}</span>
      <div class="meta">
        <em class="pill">${Math.round(s.duration / 60)} min</em>
        <em class="pill">${escapeHTML(s.type)}</em>
        <em class="pill">${escapeHTML(s.intensity)}</em>
      </div>
    </button>
  `;
}

// ─── Statistiques + hero ──────────────────────────────────────────────────────
function renderStats() {
  const records = state();
  const s = settings();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const week = records.filter((r) => new Date(r.savedAt) >= sevenDaysAgo);
  const weeklySeconds = week.reduce((sum, r) => sum + r.durationSeconds, 0);
  const totalSeconds  = records.reduce((sum, r) => sum + r.durationSeconds, 0);

  $("weeklySessions").textContent = week.length;
  $("weeklyMinutes").textContent  = Math.round(weeklySeconds / 60);
  $("currentStreak").textContent  = calculateStreak(records);
  $("totalSessions").textContent  = records.length;
  $("totalMinutes").textContent   = Math.round(totalSeconds / 60);
  $("avgShift").textContent       = averageShift(records);
  $("favoriteType").textContent   = favoriteType(records);

  // Barre de progression objectif
  const goal = s.weeklyGoal;
  const done = week.length;
  const pct  = Math.min(100, Math.round((done / goal) * 100));
  $("goalCount").textContent  = `${done} / ${goal}`;
  $("goalBarFill").style.width = `${pct}%`;
  // Couleur selon avancement
  $("goalBarFill").className = "goal-bar-fill" + (pct >= 100 ? " goal-complete" : "");

  // Contexte dernière séance
  const lastHintEl = $("lastHint");
  if (records.length === 0) {
    lastHintEl.textContent = "Première séance ? Lance-toi — 2 minutes comptent.";
  } else {
    const last = records[records.length - 1];
    const daysAgo = daysBetween(new Date(last.savedAt), now);
    if (daysAgo === 0)      lastHintEl.textContent = `Séance aujourd'hui — continue comme ça.`;
    else if (daysAgo === 1) lastHintEl.textContent = `Dernière séance hier. Aujourd'hui ?`;
    else                    lastHintEl.textContent = `Dernière séance il y a ${daysAgo} jours. Pas de pression.`;
  }

  renderHistory(records);
}

function daysBetween(d1, d2) {
  const msPerDay = 86400000;
  const a = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const b = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((b - a) / msPerDay);
}

// Streak avec grace period d'un jour (un seul raté toléré)
function calculateStreak(records) {
  const days = [...new Set(records.map((r) => r.savedAt.slice(0, 10)))].sort().reverse();
  let streak   = 0;
  let missed   = 0; // un seul jour manqué toléré
  const cursor = new Date();

  for (let i = 0; i < 180; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) {
      streak += 1;
    } else {
      if (i === 0) { /* aujourd'hui pas encore de séance → pas de rupture */ }
      else {
        missed += 1;
        if (missed > 1) break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function averageShift(records) {
  if (!records.length) return "—";
  const shifts = records.map((r) =>
    (r.before.stress - r.after.stress) + (r.after.clarity - r.before.clarity)
  );
  const avg = shifts.reduce((a, b) => a + b, 0) / shifts.length;
  return avg > 0 ? `+${avg.toFixed(1)}` : avg.toFixed(1);
}

function favoriteType(records) {
  if (!records.length) return "—";
  const counts = records.reduce((acc, r) => ({ ...acc, [r.type]: (acc[r.type] || 0) + 1 }), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function renderHistory(records) {
  const recent = records.slice(-6).reverse();
  $("historyList").innerHTML = recent.length
    ? recent.map((r) => `
        <article class="history-item">
          <strong>${escapeHTML(r.title)}</strong>
          <p>${new Date(r.savedAt).toLocaleDateString("fr-FR")} · ${Math.round(r.durationSeconds / 60)} min · stress ${r.before.stress}→${r.after.stress} · clarté ${r.before.clarity}→${r.after.clarity}</p>
        </article>
      `).join("")
    : `<p class="small-note">Aucune séance enregistrée pour le moment.</p>`;
}

// ─── Humeur & recommandation ──────────────────────────────────────────────────
function recommendForMood(moodId) {
  selectedMood = moodId;

  // Marquer le bouton sélectionné
  document.querySelectorAll("[data-mood]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.mood === moodId ? "true" : "false");
    b.classList.toggle("mood-selected", b.dataset.mood === moodId);
  });

  const candidates = sessions.filter((s) => s.moods.includes(moodId));
  const history    = state();
  const lastIds    = history.slice(-3).map((h) => h.sessionId);
  const fresh      = candidates.find((s) => !lastIds.includes(s.id)) || candidates[0] || sessions[0];
  $("recommendationReason").textContent = reasonForMood(moodId, fresh);
  $("recommendedSession").innerHTML     = sessionCard(fresh);
  $("recommendationSection").classList.remove("hidden");
  $("recommendationSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function reasonForMood(moodId, session) {
  const labels = {
    stress:   "Priorité : baisser l'activation physiologique sans effort.",
    fatigue:  "Priorité : récupérer, pas se forcer.",
    disperse: "Priorité : réduire le bruit mental et retrouver un point d'appui.",
    tension:  "Priorité : relâcher le corps pour calmer le système.",
    triste:   "Priorité : créer un espace sûr autour de l'émotion.",
    energie:  "Priorité : relancer l'énergie sans agitation.",
    bien:     "Priorité : entretenir la continuité."
  };
  return `${labels[moodId] || "Séance adaptée."} Proposition : ${session.title}.`;
}

// ─── Session dialog ───────────────────────────────────────────────────────────
function openSession(id, fromRecommendation = false) {
  selectedSession = sessions.find((s) => s.id === id);
  if (!selectedSession) return;
  if (!fromRecommendation) selectedMood = null;

  $("dialogCategory").textContent   = `${selectedSession.category} · ${selectedSession.type} · ${Math.round(selectedSession.duration / 60)} min`;
  $("dialogTitle").textContent       = selectedSession.title;
  $("dialogDescription").textContent = selectedSession.description;

  // Réinitialiser les sliders avant
  $("beforeStress").value  = 5;
  $("beforeEnergy").value  = 5;
  $("beforeClarity").value = 5;

  $("preSession").classList.remove("hidden");
  $("activeSession").classList.add("hidden");
  $("postSession").classList.add("hidden");
  $("sessionDialog").showModal();
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function startSession() {
  if (!selectedSession?.pattern?.length) return;
  stopActiveTimer();
  remaining      = selectedSession.duration;
  phaseIndex     = 0;
  phaseRemaining = selectedSession.pattern[0].seconds;
  prevPhaseIndex = -1; // reset animation
  isPaused       = false;
  startedAt      = new Date().toISOString();

  $("preSession").classList.add("hidden");
  $("activeSession").classList.remove("hidden");
  $("pauseButton").textContent = "Pause";

  tick();
  timer = setInterval(tick, 1000);
}

function tick() {
  if (isPaused) return;
  updateActiveUI();
  if (remaining <= 0) { completeSession(); return; }
  remaining      -= 1;
  phaseRemaining -= 1;
  if (phaseRemaining <= 0) {
    phaseIndex     = (phaseIndex + 1) % selectedSession.pattern.length;
    phaseRemaining = selectedSession.pattern[phaseIndex].seconds;
  }
}

function updateActiveUI() {
  const phase = selectedSession.pattern[phaseIndex];
  const mm    = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss    = String(remaining % 60).padStart(2, "0");
  $("timerDisplay").textContent     = `${mm}:${ss}`;
  $("activePhaseLabel").textContent = `${phase.label} · ${phaseRemaining}s`;

  // FIX guidance : distribution proportionnelle sur toute la durée (plus de boucle)
  const elapsed       = selectedSession.duration - remaining;
  const guidanceIndex = Math.min(
    Math.floor((elapsed / selectedSession.duration) * selectedSession.guidance.length),
    selectedSession.guidance.length - 1
  );
  $("guidanceText").textContent = selectedSession.guidance[guidanceIndex];

  // FIX animation : ne changer les classes qu'au changement de phase
  updateBreathVisual(phase);
}

// FIX animation respiratoire : une seule transition par phase, pas par seconde
function updateBreathVisual(phase) {
  if (phaseIndex === prevPhaseIndex) return; // même phase → pas de changement
  prevPhaseIndex = phaseIndex;
  const visual = $("breathVisual");
  visual.classList.remove("expand", "contract");
  // Force reflow pour que la transition reparte de zéro
  void visual.offsetWidth;
  if (/inspire|présence|respire/i.test(phase.label))  visual.classList.add("expand");
  else if (/expire|observe/i.test(phase.label))        visual.classList.add("contract");
}

function togglePause() {
  isPaused = !isPaused;
  $("pauseButton").textContent = isPaused ? "Reprendre" : "Pause";
}

function completeSession() {
  clearInterval(timer);
  timer = null;

  // FIX sliders : initialiser "après" aux mêmes valeurs qu'"avant" (zéro biais)
  $("afterStress").value  = $("beforeStress").value;
  $("afterEnergy").value  = $("beforeEnergy").value;
  $("afterClarity").value = $("beforeClarity").value;

  // Message de complétion contextuel
  const records  = state();
  const total    = records.length + 1; // +1 pour la séance en cours
  const streak   = calculateStreak(records);
  const durationMin = Math.round((selectedSession.duration - Math.max(remaining, 0)) / 60);

  let msg = `Séance terminée — ${durationMin > 0 ? durationMin + " min" : "quelques instants"}.`;
  if (total === 1)         msg = "Première séance complète. C'est le plus important.";
  else if (total % 10 === 0) msg = `${total} séances au total. Belle régularité.`;
  else if (streak >= 7)    msg = `${streak} jours actifs d'affilée. Tu tiens le fil.`;
  $("completionMessage").textContent = msg;

  $("activeSession").classList.add("hidden");
  $("postSession").classList.remove("hidden");
}

function saveSessionRecord() {
  const durationDone = selectedSession.duration - Math.max(remaining, 0);
  const record = {
    id:              makeId(),
    sessionId:       selectedSession.id,
    title:           selectedSession.title,
    type:            selectedSession.type,
    category:        selectedSession.category,
    mood:            selectedMood,
    startedAt,
    savedAt:         new Date().toISOString(),
    durationSeconds: Math.max(durationDone, 30),
    before: {
      stress:  Number($("beforeStress").value),
      energy:  Number($("beforeEnergy").value),
      clarity: Number($("beforeClarity").value)
    },
    after: {
      stress:  Number($("afterStress").value),
      energy:  Number($("afterEnergy").value),
      clarity: Number($("afterClarity").value)
    },
    note: $("sessionNote").value.trim()
  };
  const records = state();
  records.push(record);
  saveState(records);
  $("sessionDialog").close();
  $("sessionNote").value = "";
  renderStats();
}

function stopActiveTimer() {
  if (timer) { clearInterval(timer); timer = null; }
  isPaused = false;
}

// ─── Événements ───────────────────────────────────────────────────────────────
function bindEvents() {
  document.addEventListener("click", (e) => {
    const moodBtn    = e.target.closest("[data-mood]");
    const sessionBtn = e.target.closest("[data-session]");
    if (moodBtn)    recommendForMood(moodBtn.dataset.mood);
    if (sessionBtn) openSession(sessionBtn.dataset.session, Boolean(sessionBtn.closest("#recommendedSession")));
  });

  $("categoryFilter").addEventListener("change", (e) => renderSessions(e.target.value));
  $("startSessionButton").addEventListener("click", startSession);
  $("pauseButton").addEventListener("click", togglePause);
  $("finishButton").addEventListener("click", completeSession);
  $("saveSessionButton").addEventListener("click", saveSessionRecord);
  $("settingsButton").addEventListener("click", openSettings);
  $("weeklyGoal").addEventListener("change", updateSettingsFromUI);
  $("tonePreference").addEventListener("change", updateSettingsFromUI);
  $("exportButton").addEventListener("click", exportData);
  $("resetButton").addEventListener("click", resetData);
  $("sessionDialog").addEventListener("cancel", stopActiveTimer);
  $("sessionDialog").addEventListener("close", stopActiveTimer);
}

// ─── Paramètres ───────────────────────────────────────────────────────────────
function openSettings() {
  const s = settings();
  $("weeklyGoal").value    = String(s.weeklyGoal);
  $("tonePreference").value = s.tone;
  $("settingsDialog").showModal();
}

function updateSettingsFromUI() {
  saveSettings({ weeklyGoal: Number($("weeklyGoal").value), tone: $("tonePreference").value });
  renderQuote();
  renderStats();
}

// ─── Export / reset ───────────────────────────────────────────────────────────
function exportData() {
  const payload = { exportedAt: new Date().toISOString(), settings: settings(), records: state() };
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement("a");
  link.href     = url;
  link.download = "respire-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  if (!confirm("Supprimer toutes les données locales ?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(QUOTE_KEY);
  renderStats();
}

// ─── Service Worker ───────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
