const STORAGE_KEY = "respire.v1";
const SETTINGS_KEY = "respire.settings.v1";

const moods = [
  { id: "stress", label: "Stressé", hint: "Tension mentale ou urgence" },
  { id: "fatigue", label: "Fatigué", hint: "Besoin de récupérer" },
  { id: "disperse", label: "Dispersé", hint: "Difficulté à se concentrer" },
  { id: "tension", label: "Tendu", hint: "Corps crispé" },
  { id: "triste", label: "Chargé émotionnellement", hint: "Besoin d'espace" },
  { id: "energie", label: "Besoin d'énergie", hint: "Relancer sans s'agiter" },
  { id: "bien", label: "Plutôt bien", hint: "Entretenir la pratique" }
];

const quotes = {
  neutral: [
    "Une seule séance suffit pour garder le fil.",
    "Reprendre compte plus que réussir.",
    "Deux minutes pratiquées valent mieux que vingt minutes prévues.",
    "La régularité se construit sans dramatiser les pauses."
  ],
  warm: [
    "Commence petit. Le corps comprend vite.",
    "Tu peux revenir maintenant, sans compenser.",
    "Une respiration claire peut changer la suite de la journée."
  ],
  spiritual: [
    "Reviens à ton axe. L'énergie suit l'attention.",
    "Respire, clarifie, élève doucement ton état.",
    "Ton rythme intérieur peut redevenir stable."
  ]
};

let sessions = [];
let selectedSession = null;
let selectedMood = null;
let timer = null;
let remaining = 0;
let phaseIndex = 0;
let phaseRemaining = 0;
let isPaused = false;
let startedAt = null;

const $ = (id) => document.getElementById(id);
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
const makeId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const state = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const saveState = (records) => localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
const settings = () => ({ weeklyGoal: 5, tone: "neutral", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") });
const saveSettings = (value) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));

const fallbackSessions = [
  {
    id: "two-minute-restart",
    title: "Reprise 2 minutes",
    category: "Reprise",
    type: "Méditation",
    duration: 120,
    intensity: "Minimum viable",
    moods: ["fatigue", "stress", "triste", "disperse", "bien"],
    description: "La séance à faire quand tu n'as pas envie. Elle compte entièrement.",
    pattern: [{ label: "Respire", seconds: 8 }],
    guidance: ["Assieds-toi simplement.", "Observe une inspiration.", "Observe une expiration.", "Tu n'as rien à compenser."]
  }
];

init();

async function init() {
  try {
    sessions = await fetch("data/sessions.json").then((r) => {
      if (!r.ok) throw new Error("Impossible de charger les séances");
      return r.json();
    });
  } catch (error) {
    sessions = fallbackSessions;
    console.warn("Sessions chargées depuis le fallback local", error);
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

function renderToday() {
  const formatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("todayLabel").textContent = formatter.format(new Date());
}

function renderQuote() {
  const pref = settings().tone;
  const list = quotes[pref] || quotes.neutral;
  const day = new Date().getDate();
  $("dailyQuote").textContent = list[day % list.length];
}

function renderMoods() {
  $("moodGrid").innerHTML = moods.map((m) => `
    <button class="mood-button" data-mood="${escapeHTML(m.id)}">
      <strong>${escapeHTML(m.label)}</strong>
      <span>${escapeHTML(m.hint)}</span>
    </button>
  `).join("");
}

function renderCategories() {
  const categories = ["Toutes", ...new Set(sessions.map((s) => s.category))];
  $("categoryFilter").innerHTML = categories.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
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

function bindEvents() {
  document.addEventListener("click", (event) => {
    const moodButton = event.target.closest("[data-mood]");
    const sessionButton = event.target.closest("[data-session]");
    if (moodButton) recommendForMood(moodButton.dataset.mood);
    if (sessionButton) openSession(sessionButton.dataset.session, Boolean(sessionButton.closest("#recommendedSession")));
  });

  $("categoryFilter").addEventListener("change", (e) => renderSessions(e.target.value));
  $("startSessionButton").addEventListener("click", startSession);
  $("pauseButton").addEventListener("click", togglePause);
  $("finishButton").addEventListener("click", completeSession);
  $("saveSessionButton").addEventListener("click", saveSessionRecord);
  $("settingsButton").addEventListener("click", openSettings);
  $("weeklyGoal").addEventListener("change", updateSettings);
  $("tonePreference").addEventListener("change", updateSettings);
  $("exportButton").addEventListener("click", exportData);
  $("resetButton").addEventListener("click", resetData);
  $("sessionDialog").addEventListener("cancel", stopActiveTimer);
  $("sessionDialog").addEventListener("close", stopActiveTimer);
}

function stopActiveTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isPaused = false;
}

function recommendForMood(moodId) {
  selectedMood = moodId;
  const candidates = sessions.filter((s) => s.moods.includes(moodId));
  const history = state();
  const lastIds = history.slice(-3).map((h) => h.sessionId);
  const fresh = candidates.find((s) => !lastIds.includes(s.id)) || candidates[0] || sessions[0];
  $("recommendationReason").textContent = reasonForMood(moodId, fresh);
  $("recommendedSession").innerHTML = sessionCard(fresh);
  $("recommendationSection").classList.remove("hidden");
  $("recommendationSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function reasonForMood(moodId, session) {
  const labels = {
    stress: "Priorité : baisser l'activation physiologique sans effort.",
    fatigue: "Priorité : récupérer, pas se forcer.",
    disperse: "Priorité : réduire le bruit mental et retrouver un point d'appui.",
    tension: "Priorité : relâcher le corps pour calmer le système.",
    triste: "Priorité : créer un espace sûr autour de l'émotion.",
    energie: "Priorité : relancer l'énergie sans agitation.",
    bien: "Priorité : entretenir la continuité."
  };
  return `${labels[moodId] || "Séance adaptée."} Proposition : ${session.title}.`;
}

function openSession(id, fromRecommendation = false) {
  selectedSession = sessions.find((s) => s.id === id);
  if (!selectedSession) return;
  if (!fromRecommendation) selectedMood = null;
  $("dialogCategory").textContent = `${selectedSession.category} · ${selectedSession.type} · ${Math.round(selectedSession.duration / 60)} min`;
  $("dialogTitle").textContent = selectedSession.title;
  $("dialogDescription").textContent = selectedSession.description;
  $("preSession").classList.remove("hidden");
  $("activeSession").classList.add("hidden");
  $("postSession").classList.add("hidden");
  $("sessionDialog").showModal();
}

function startSession() {
  if (!selectedSession || !selectedSession.pattern?.length) return;
  stopActiveTimer();
  remaining = selectedSession.duration;
  phaseIndex = 0;
  phaseRemaining = selectedSession.pattern[0].seconds;
  isPaused = false;
  startedAt = new Date().toISOString();
  $("preSession").classList.add("hidden");
  $("activeSession").classList.remove("hidden");
  $("pauseButton").textContent = "Pause";
  tick();
  timer = setInterval(tick, 1000);
}

function tick() {
  if (isPaused) return;
  updateActiveUI();
  if (remaining <= 0) {
    completeSession();
    return;
  }
  remaining -= 1;
  phaseRemaining -= 1;
  if (phaseRemaining <= 0) {
    phaseIndex = (phaseIndex + 1) % selectedSession.pattern.length;
    phaseRemaining = selectedSession.pattern[phaseIndex].seconds;
  }
}

function updateActiveUI() {
  const phase = selectedSession.pattern[phaseIndex];
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  $("timerDisplay").textContent = `${mm}:${ss}`;
  $("activePhaseLabel").textContent = `${phase.label} · ${phaseRemaining}s`;
  const guidanceIndex = Math.floor((selectedSession.duration - remaining) / 35) % selectedSession.guidance.length;
  $("guidanceText").textContent = selectedSession.guidance[guidanceIndex];
  const visual = $("breathVisual");
  visual.classList.remove("expand", "contract");
  if (/inspire|présence|respire/i.test(phase.label)) visual.classList.add("expand");
  if (/expire|observe/i.test(phase.label)) visual.classList.add("contract");
}

function togglePause() {
  isPaused = !isPaused;
  $("pauseButton").textContent = isPaused ? "Reprendre" : "Pause";
}

function completeSession() {
  clearInterval(timer);
  timer = null;
  $("activeSession").classList.add("hidden");
  $("postSession").classList.remove("hidden");
}

function saveSessionRecord() {
  const durationDone = selectedSession.duration - Math.max(remaining, 0);
  const record = {
    id: makeId(),
    sessionId: selectedSession.id,
    title: selectedSession.title,
    type: selectedSession.type,
    category: selectedSession.category,
    mood: selectedMood,
    startedAt,
    savedAt: new Date().toISOString(),
    durationSeconds: Math.max(durationDone, 30),
    before: {
      stress: Number($("beforeStress").value),
      energy: Number($("beforeEnergy").value),
      clarity: Number($("beforeClarity").value)
    },
    after: {
      stress: Number($("afterStress").value),
      energy: Number($("afterEnergy").value),
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

function renderStats() {
  const records = state();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0,0,0,0);
  const week = records.filter((r) => new Date(r.savedAt) >= sevenDaysAgo);
  const totalSeconds = records.reduce((sum, r) => sum + r.durationSeconds, 0);
  const weeklySeconds = week.reduce((sum, r) => sum + r.durationSeconds, 0);
  $("weeklySessions").textContent = week.length;
  $("weeklyMinutes").textContent = Math.round(weeklySeconds / 60);
  $("currentStreak").textContent = calculateStreak(records);
  $("totalSessions").textContent = records.length;
  $("totalMinutes").textContent = Math.round(totalSeconds / 60);
  $("avgShift").textContent = averageShift(records);
  $("favoriteType").textContent = favoriteType(records);
  renderHistory(records);
}

function calculateStreak(records) {
  const days = [...new Set(records.map((r) => r.savedAt.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 90; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) streak += 1;
    else if (i > 0) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function averageShift(records) {
  if (!records.length) return "—";
  const shifts = records.map((r) => (r.before.stress - r.after.stress) + (r.after.clarity - r.before.clarity));
  const avg = shifts.reduce((a,b) => a + b, 0) / shifts.length;
  return avg > 0 ? `+${avg.toFixed(1)}` : avg.toFixed(1);
}

function favoriteType(records) {
  if (!records.length) return "—";
  const counts = records.reduce((acc, r) => ({ ...acc, [r.type]: (acc[r.type] || 0) + 1 }), {});
  return Object.entries(counts).sort((a,b) => b[1] - a[1])[0][0];
}

function renderHistory(records) {
  const recent = records.slice(-6).reverse();
  $("historyList").innerHTML = recent.length ? recent.map((r) => `
    <article class="history-item">
      <strong>${escapeHTML(r.title)}</strong>
      <p>${new Date(r.savedAt).toLocaleDateString("fr-FR")} · ${Math.round(r.durationSeconds / 60)} min · stress ${r.before.stress}→${r.after.stress} · clarté ${r.before.clarity}→${r.after.clarity}</p>
    </article>
  `).join("") : `<p class="small-note">Aucune séance enregistrée pour le moment.</p>`;
}

function openSettings() {
  const s = settings();
  $("weeklyGoal").value = String(s.weeklyGoal);
  $("tonePreference").value = s.tone;
  $("settingsDialog").showModal();
}

function updateSettings() {
  saveSettings({ weeklyGoal: Number($("weeklyGoal").value), tone: $("tonePreference").value });
  renderQuote();
}

function exportData() {
  const payload = { exportedAt: new Date().toISOString(), settings: settings(), records: state() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "respire-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  const ok = confirm("Supprimer toutes les données locales ?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  renderStats();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
