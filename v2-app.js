// ─── Respire PWA — app.js V2 ──────────────────────────────────────────────────
// Nouveautés : navigation 3 vues réelles, parcours débutant 7 jours,
//              recommandation apprenante (pondérée par effet mesuré personnel).

const STORAGE_KEY       = "respire.v1";
const SETTINGS_KEY      = "respire.settings.v1";
const QUOTE_KEY         = "respire.quotes.v1";
const ONBOARDING_KEY    = "respire.onboarded.v2"; // v2 = reset onboarding si V1.1
const REMINDER_KEY      = "respire.reminder.v1";
const REMINDER_DATE_KEY = "respire.reminder.lastDate";
const PROGRAM_KEY       = "respire.program.v2";

// ─── Parcours 7 jours ─────────────────────────────────────────────────────────
const PROGRAM_DAYS = [
  {
    day: 1, theme: "Découverte",
    title: "Ta première respiration",
    description: "30 secondes. Un seul cycle. C'est tout ce qu'il faut pour commencer à changer d'état.",
    sessionId: "physiological-sigh", durationMin: 1
  },
  {
    day: 2, theme: "Stress",
    title: "Ralentir le rythme",
    description: "L'expiration longue active le nerf vague et calme le système nerveux en moins de 3 minutes.",
    sessionId: "breath-46-reset", durationMin: 3
  },
  {
    day: 3, theme: "Matin",
    title: "Choisir son intention",
    description: "5 minutes avant que la journée commence. Pas de to-do list — juste un mot, une direction.",
    sessionId: "morning-anchor", durationMin: 5
  },
  {
    day: 4, theme: "Clarté",
    title: "Le carré",
    description: "Utilisé par les forces spéciales pour rester calme sous pression. Un rythme simple et puissant.",
    sessionId: "box-breathing-focus", durationMin: 4
  },
  {
    day: 5, theme: "Régulation",
    title: "Cohérence cardiaque",
    description: "6 respirations par minute pendant 5 minutes. Le format clinique le plus documenté.",
    sessionId: "cardiac-coherence", durationMin: 5
  },
  {
    day: 6, theme: "Récupération",
    title: "Parcourir le corps",
    description: "Un scan complet du corps pour déposer la journée avant de dormir.",
    sessionId: "body-scan-evening", durationMin: 10
  },
  {
    day: 7, theme: "Autonomie",
    title: "Ta séance",
    description: "Tu connais 6 pratiques différentes. Aujourd'hui, choisis ce dont tu as besoin.",
    sessionId: null, durationMin: null // jour libre
  }
];

// ─── Contenu statique ─────────────────────────────────────────────────────────
const moods = [
  { id: "stress",   label: "Stressé",               hint: "Tension mentale ou urgence" },
  { id: "fatigue",  label: "Fatigué",                hint: "Besoin de récupérer" },
  { id: "disperse", label: "Dispersé",               hint: "Difficulté à se concentrer" },
  { id: "tension",  label: "Tendu",                  hint: "Corps crispé" },
  { id: "triste",   label: "Chargé émotionnellement", hint: "Besoin d'espace" },
  { id: "energie",  label: "Besoin d'énergie",       hint: "Relancer sans s'agiter" },
  { id: "bien",     label: "Plutôt bien",            hint: "Entretenir la pratique" }
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

const reminderMessages = [
  "2 minutes suffisent. Tu peux respirer maintenant.",
  "Ton moment du jour. L'app est prête.",
  "Une séance, même courte. Le corps comprend.",
  "Reviens à toi. Respire quelques minutes.",
  "C'est l'heure. Une pratique simple t'attend.",
  "La régularité se construit maintenant."
];

// ─── État global ──────────────────────────────────────────────────────────────
let sessions         = [];
let selectedSession  = null;
let selectedMood     = null;
let timer            = null;
let remaining        = 0;
let phaseIndex       = 0;
let phaseRemaining   = 0;
let isPaused         = false;
let startedAt        = null;
let prevPhaseIndex   = -1;
let programDayCtx    = null; // jour du parcours en cours (null si hors programme)

// Onboarding
let obGoal          = 5;
let obCurrentSlide  = 0;

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const $          = (id) => document.getElementById(id);
const escapeHTML = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
const makeId     = () => crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const state      = ()  => JSON.parse(localStorage.getItem(STORAGE_KEY)  || "[]");
const saveState  = (r) => localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
const settings   = ()  => ({ weeklyGoal: 5, tone: "neutral", ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") });
const saveSettings = (v) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(v));
const getReminder  = ()  => JSON.parse(localStorage.getItem(REMINDER_KEY)  || "{}");
const saveReminder = (v) => localStorage.setItem(REMINDER_KEY, JSON.stringify(v));
const getProgram   = ()  => JSON.parse(localStorage.getItem(PROGRAM_KEY)  || "{}");
const saveProgram  = (v) => localStorage.setItem(PROGRAM_KEY, JSON.stringify(v));

// ─── Quote shuffle Fisher-Yates ───────────────────────────────────────────────
function nextQuote(tone) {
  const list   = quotes[tone] || quotes.neutral;
  const stored = JSON.parse(localStorage.getItem(QUOTE_KEY) || "{}");
  let indices  = stored[tone] || [];
  if (!indices.length) {
    indices = [...Array(list.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const last = stored[`${tone}_last`];
    if (last !== undefined && indices[0] === last && indices.length > 1)
      indices.push(indices.shift());
  }
  const idx = indices.shift();
  localStorage.setItem(QUOTE_KEY, JSON.stringify({ ...stored, [tone]: indices, [`${tone}_last`]: idx }));
  return list[idx];
}

const fallbackSessions = [{
  id: "two-minute-restart", title: "Reprise 2 minutes", category: "Reprise",
  type: "Méditation", duration: 120, intensity: "Minimum viable",
  moods: ["fatigue","stress","triste","disperse","bien"],
  description: "La séance à faire quand tu n'as pas envie. Elle compte entièrement.",
  pattern: [{ label: "Respire", seconds: 8 }],
  guidance: ["Assieds-toi simplement.", "Observe une inspiration.", "Observe une expiration.", "Tu n'as rien à compenser."]
}];

// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════
init();

async function init() {
  try {
    sessions = await fetch("data/sessions.json").then((r) => {
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    });
  } catch (e) {
    sessions = fallbackSessions;
    console.warn("Fallback sessions", e);
  }
  renderToday();
  renderQuote();
  renderMoods();
  renderCategories();
  renderSessions();
  renderStats();
  renderProgram();
  renderEffectChart();
  bindEvents();
  registerServiceWorker();
  initReminder();
  checkOnboarding();
}

// ════════════════════════════════════════════════════════════════════════════
// NAVIGATION VUES
// ════════════════════════════════════════════════════════════════════════════
let currentView = "viewToday";

function switchView(viewId) {
  if (viewId === currentView) return;
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewId);
  });
  const el = $(viewId);
  el.classList.remove("hidden");
  el.classList.add("view-entering");
  requestAnimationFrame(() => el.classList.remove("view-entering"));
  window.scrollTo({ top: 0, behavior: "instant" });
  currentView = viewId;

  // Fermer la recommandation si on revient sur Aujourd'hui depuis ailleurs
  if (viewId === "viewToday") {
    $("recommendationSection").classList.add("hidden");
    document.querySelectorAll("[data-mood]").forEach((b) => {
      b.setAttribute("aria-pressed", "false");
      b.classList.remove("mood-selected");
    });
    selectedMood = null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PARCOURS 7 JOURS
// ════════════════════════════════════════════════════════════════════════════
function getCompletedDays() {
  return getProgram().completedDays || [];
}

function isProgramActive() {
  return !!getProgram().active;
}

function isProgramComplete() {
  return getCompletedDays().length >= 7;
}

function getCurrentProgramDay() {
  if (!isProgramActive()) return null;
  for (let d = 1; d <= 7; d++) {
    if (!getCompletedDays().includes(d)) return d;
  }
  return null; // tous terminés
}

function startProgram() {
  saveProgram({ active: true, startDate: new Date().toISOString().slice(0, 10), completedDays: [] });
  renderProgram();
}

function markProgramDayDone(day) {
  const p = getProgram();
  const completed = [...new Set([...(p.completedDays || []), day])];
  saveProgram({ ...p, completedDays: completed });
}

function renderProgram() {
  const container = $("programSection");
  if (!container) return;

  if (!isProgramActive()) {
    // Bannière de démarrage
    container.innerHTML = `
      <div class="program-banner card">
        <div class="program-banner-text">
          <p class="eyebrow">Nouveau</p>
          <h3>Parcours 7 jours</h3>
          <p>Une pratique guidée par jour, du plus simple au plus profond. Idéal pour construire une base solide.</p>
        </div>
        <button type="button" class="primary-button" id="startProgramBtn">Commencer le parcours</button>
      </div>
    `;
    $("startProgramBtn")?.addEventListener("click", startProgram);
    return;
  }

  if (isProgramComplete()) {
    // Complétion
    const days = getCompletedDays().length;
    container.innerHTML = `
      <div class="program-complete card">
        <p class="program-complete-icon" aria-hidden="true">✦</p>
        <h3>Parcours terminé</h3>
        <p>Tu as complété les 7 jours. Tu as maintenant une base solide pour explorer selon tes besoins.</p>
        <div class="program-dots">
          ${PROGRAM_DAYS.map((d) => `<span class="prog-dot prog-dot-done" title="Jour ${d.day}"></span>`).join("")}
        </div>
      </div>
    `;
    return;
  }

  // Jour en cours
  const dayNum     = getCurrentProgramDay();
  const dayData    = PROGRAM_DAYS.find((d) => d.day === dayNum);
  const completed  = getCompletedDays();
  const sessionObj = dayData.sessionId ? sessions.find((s) => s.id === dayData.sessionId) : null;

  container.innerHTML = `
    <div class="program-card card">
      <div class="program-card-header">
        <p class="eyebrow">Parcours 7 jours</p>
        <div class="program-dots">
          ${PROGRAM_DAYS.map((d) => `
            <span class="prog-dot ${completed.includes(d.day) ? "prog-dot-done" : d.day === dayNum ? "prog-dot-current" : ""}"
                  title="Jour ${d.day}${completed.includes(d.day) ? " ✓" : ""}"></span>
          `).join("")}
        </div>
      </div>
      <p class="program-theme">${escapeHTML(dayData.theme)}</p>
      <h3 class="program-day-title">Jour ${dayNum} — ${escapeHTML(dayData.title)}</h3>
      <p class="program-day-desc">${escapeHTML(dayData.description)}</p>
      ${dayData.sessionId && sessionObj ? `
        <div class="program-meta">
          <em class="pill">${dayData.durationMin} min</em>
          <em class="pill">${escapeHTML(sessionObj.type)}</em>
          <em class="pill">${escapeHTML(sessionObj.intensity)}</em>
        </div>
        <button type="button" class="primary-button program-launch-btn" data-program-day="${dayNum}" data-session="${escapeHTML(dayData.sessionId)}">
          Lancer cette séance →
        </button>
      ` : `
        <p class="program-free-note">Aujourd'hui, choisis dans la bibliothèque ce dont tu as besoin.</p>
        <button type="button" class="primary-button" id="goToLibraryBtn">Voir la bibliothèque →</button>
      `}
    </div>
  `;

  $("goToLibraryBtn")?.addEventListener("click", () => switchView("viewSessions"));
}

// ════════════════════════════════════════════════════════════════════════════
// RECOMMANDATION APPRENANTE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'effet moyen personnel pour une séance donnée.
 * Retourne null si aucune donnée, sinon un float.
 */
function personalScore(sessionId, records) {
  const relevant = records.filter((r) => r.sessionId === sessionId);
  if (!relevant.length) return null;
  const effects = relevant.map((r) =>
    (r.before.stress - r.after.stress) + (r.after.clarity - r.before.clarity)
  );
  return effects.reduce((a, b) => a + b, 0) / effects.length;
}

/**
 * Choisit la meilleure séance pour un mood donné en apprenant des données.
 * Tri : non-récente > score personnel élevé > non essayée (découverte).
 */
function recommendForMoodLearning(moodId) {
  const records    = state();
  const candidates = sessions.filter((s) => s.moods.includes(moodId));
  const lastIds    = records.slice(-3).map((h) => h.sessionId);

  const scored = candidates.map((s) => {
    const score  = personalScore(s.id, records);
    const tried  = records.some((r) => r.sessionId === s.id);
    const recent = lastIds.includes(s.id);
    return { session: s, score, tried, recent };
  });

  // Tri : écarter les récentes, puis maximiser l'effet personnel, puis explorer l'inédit
  scored.sort((a, b) => {
    if (a.recent !== b.recent) return a.recent ? 1 : -1;
    // Si les deux ont des données → score desc
    if (a.score !== null && b.score !== null) return b.score - a.score;
    // Données personnelles > pas de données
    if (a.score !== null) return -1;
    if (b.score !== null) return 1;
    return 0;
  });

  const best     = scored[0];
  const session  = best?.session || candidates[0] || sessions[0];
  const score    = best?.score ?? null;
  const tried    = best?.tried ?? false;
  const count    = records.filter((r) => r.sessionId === session.id).length;

  return { session, score, tried, count };
}

function buildRecommendationReason(moodId, session, score, tried, count) {
  const intents = {
    stress:   "Priorité : baisser l'activation physiologique sans effort.",
    fatigue:  "Priorité : récupérer, pas se forcer.",
    disperse: "Priorité : réduire le bruit mental.",
    tension:  "Priorité : relâcher le corps.",
    triste:   "Priorité : créer de l'espace autour de l'émotion.",
    energie:  "Priorité : relancer sans agitation.",
    bien:     "Priorité : entretenir la continuité."
  };
  const base = intents[moodId] || "Séance adaptée.";

  if (tried && score !== null && score > 0.5) {
    return `${base} Cette séance t'a apporté en moyenne +${score.toFixed(1)} pts — ta meilleure option mesurée.`;
  }
  if (tried && score !== null && score <= 0) {
    return `${base} Essaie ${session.title} — une autre pratique pourrait mieux fonctionner pour toi.`;
  }
  if (tried && score !== null) {
    return `${base} Pratiquée ${count}× par toi. Résultat moyen : ${score > 0 ? "+" : ""}${score.toFixed(1)} pts.`;
  }
  return `${base} Proposition : ${session.title}. Tu mesureras l'effet après.`;
}

function recommendForMood(moodId) {
  selectedMood = moodId;

  // Marquer le bouton
  document.querySelectorAll("[data-mood]").forEach((b) => {
    const active = b.dataset.mood === moodId;
    b.setAttribute("aria-pressed", active ? "true" : "false");
    b.classList.toggle("mood-selected", active);
  });

  const { session, score, tried, count } = recommendForMoodLearning(moodId);

  $("recommendationReason").textContent = buildRecommendationReason(moodId, session, score, tried, count);
  $("recommendedSession").innerHTML     = sessionCard(session);
  $("recommendationSection").classList.remove("hidden");
  $("recommendationSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ════════════════════════════════════════════════════════════════════════════
// GRAPHIQUE D'EFFET PAR TYPE (vue Suivi)
// ════════════════════════════════════════════════════════════════════════════
function renderEffectChart() {
  const container = $("effectChart");
  if (!container) return;
  const records = state();
  if (!records.length) { container.innerHTML = ""; return; }

  // Grouper par type de séance
  const byType = {};
  for (const r of records) {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push((r.before.stress - r.after.stress) + (r.after.clarity - r.before.clarity));
  }

  const entries = Object.entries(byType).map(([type, effects]) => ({
    type,
    avg: effects.reduce((a, b) => a + b, 0) / effects.length,
    count: effects.length
  })).sort((a, b) => b.avg - a.avg);

  const max = Math.max(...entries.map((e) => Math.abs(e.avg)), 1);

  container.innerHTML = `
    <h3 class="chart-title">Effet moyen par pratique</h3>
    <div class="chart-bars">
      ${entries.map((e) => {
        const pct    = Math.round((e.avg / max) * 100);
        const isPos  = e.avg >= 0;
        const label  = e.avg > 0 ? `+${e.avg.toFixed(1)}` : e.avg.toFixed(1);
        return `
          <div class="chart-row">
            <span class="chart-label">${escapeHTML(e.type)}</span>
            <div class="chart-bar-track">
              <div class="chart-bar-fill ${isPos ? "" : "chart-bar-neg"}" style="width:${Math.abs(pct)}%"></div>
            </div>
            <span class="chart-value">${label} <small>(${e.count}×)</small></span>
          </div>
        `;
      }).join("")}
    </div>
    <p class="chart-note">Effet = réduction du stress + gain de clarté, de 0 à 20 pts.</p>
  `;
}

// ════════════════════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════════════════════
function renderToday() {
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("todayLabel").textContent = fmt.format(new Date());
}

function renderQuote() {
  $("dailyQuote").textContent = nextQuote(settings().tone);
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
  $("categoryFilter").innerHTML = cats.map((c) =>
    `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`
  ).join("");
}

function renderSessions(category = "Toutes") {
  const filtered = category === "Toutes" ? sessions : sessions.filter((s) => s.category === category);
  $("sessionList").innerHTML = filtered.map(sessionCard).join("");
}

function sessionCard(s) {
  const records = state();
  const score   = personalScore(s.id, records);
  const scoreBadge = score !== null
    ? `<em class="pill pill-personal">${score > 0 ? "+" : ""}${score.toFixed(1)} pts toi</em>`
    : "";
  return `
    <button class="session-card" data-session="${escapeHTML(s.id)}">
      <strong>${escapeHTML(s.title)}</strong>
      <span>${escapeHTML(s.description)}</span>
      <div class="meta">
        <em class="pill">${Math.round(s.duration / 60)} min</em>
        <em class="pill">${escapeHTML(s.type)}</em>
        <em class="pill">${escapeHTML(s.intensity)}</em>
        ${scoreBadge}
      </div>
    </button>
  `;
}

// ─── Stats + hero ─────────────────────────────────────────────────────────────
function renderStats() {
  const records = state();
  const s       = settings();
  const now     = new Date();
  const cutoff  = new Date(now);
  cutoff.setDate(now.getDate() - 6);
  cutoff.setHours(0, 0, 0, 0);

  const week          = records.filter((r) => new Date(r.savedAt) >= cutoff);
  const weeklySeconds = week.reduce((a, r) => a + r.durationSeconds, 0);
  const totalSeconds  = records.reduce((a, r) => a + r.durationSeconds, 0);

  $("weeklySessions").textContent = week.length;
  $("weeklyMinutes").textContent  = Math.round(weeklySeconds / 60);
  $("currentStreak").textContent  = calculateStreak(records);
  $("totalSessions").textContent  = records.length;
  $("totalMinutes").textContent   = Math.round(totalSeconds / 60);
  $("avgShift").textContent       = averageShift(records);
  $("favoriteType").textContent   = favoriteType(records);

  const goal = s.weeklyGoal;
  const done = week.length;
  const pct  = Math.min(100, Math.round((done / goal) * 100));
  $("goalCount").textContent         = `${done} / ${goal}`;
  $("goalBarFill").style.width       = `${pct}%`;
  $("goalBarFill").className         = "goal-bar-fill" + (pct >= 100 ? " goal-complete" : "");

  const lastHintEl = $("lastHint");
  if (!records.length) {
    lastHintEl.textContent = "Première séance ? Lance-toi — 2 minutes comptent.";
  } else {
    const daysAgo = daysBetween(new Date(records[records.length - 1].savedAt), now);
    if (daysAgo === 0)      lastHintEl.textContent = "Séance aujourd'hui — continue comme ça.";
    else if (daysAgo === 1) lastHintEl.textContent = "Dernière séance hier. Aujourd'hui ?";
    else                    lastHintEl.textContent = `Dernière séance il y a ${daysAgo} jours. Pas de pression.`;
  }

  renderHistory(records);
  renderEffectChart();
}

function daysBetween(d1, d2) {
  const a = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const b = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((b - a) / 86400000);
}

// Streak avec grace period d'un jour
function calculateStreak(records) {
  const days   = [...new Set(records.map((r) => r.savedAt.slice(0, 10)))].sort().reverse();
  let streak   = 0;
  let missed   = 0;
  const cursor = new Date();
  for (let i = 0; i < 180; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.includes(key)) {
      streak += 1;
    } else if (i > 0) {
      missed += 1;
      if (missed > 1) break;
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
  const recent = records.slice(-8).reverse();
  $("historyList").innerHTML = recent.length
    ? recent.map((r) => {
        const effect = (r.before.stress - r.after.stress) + (r.after.clarity - r.before.clarity);
        const effectStr = effect > 0 ? `+${effect}` : String(effect);
        return `
          <article class="history-item">
            <div class="history-row">
              <strong>${escapeHTML(r.title)}</strong>
              <span class="history-effect ${effect > 0 ? "effect-pos" : effect < 0 ? "effect-neg" : ""}">${effectStr} pts</span>
            </div>
            <p>${new Date(r.savedAt).toLocaleDateString("fr-FR")} · ${Math.round(r.durationSeconds / 60)} min · stress ${r.before.stress}→${r.after.stress} · clarté ${r.before.clarity}→${r.after.clarity}</p>
          </article>
        `;
      }).join("")
    : `<p class="small-note">Aucune séance enregistrée pour le moment.</p>`;
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION DIALOG
// ════════════════════════════════════════════════════════════════════════════
function openSession(id, fromRecommendation = false, programDay = null) {
  selectedSession = sessions.find((s) => s.id === id);
  if (!selectedSession) return;
  if (!fromRecommendation) selectedMood = null;
  programDayCtx = programDay;

  $("dialogCategory").textContent   = `${selectedSession.category} · ${selectedSession.type} · ${Math.round(selectedSession.duration / 60)} min`;
  $("dialogTitle").textContent       = selectedSession.title;
  $("dialogDescription").textContent = selectedSession.description;
  $("beforeStress").value  = 5;
  $("beforeEnergy").value  = 5;
  $("beforeClarity").value = 5;

  // Badge perso si données disponibles
  const records = state();
  const score   = personalScore(id, records);
  const count   = records.filter((r) => r.sessionId === id).length;
  const badge   = $("personalBadge");
  if (score !== null && count >= 2) {
    badge.textContent = `Ton effet mesuré : ${score > 0 ? "+" : ""}${score.toFixed(1)} pts sur ${count} séance${count > 1 ? "s" : ""}`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

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
  prevPhaseIndex = -1;
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

  const elapsed       = selectedSession.duration - remaining;
  const guidanceIndex = Math.min(
    Math.floor((elapsed / selectedSession.duration) * selectedSession.guidance.length),
    selectedSession.guidance.length - 1
  );
  $("guidanceText").textContent = selectedSession.guidance[guidanceIndex];
  updateBreathVisual(phase);
}

function updateBreathVisual(phase) {
  if (phaseIndex === prevPhaseIndex) return;
  prevPhaseIndex = phaseIndex;
  const visual = $("breathVisual");
  visual.classList.remove("expand", "contract");
  void visual.offsetWidth;
  if (/inspire|présence|respire/i.test(phase.label))       visual.classList.add("expand");
  else if (/expire|observe|relâche/i.test(phase.label))    visual.classList.add("contract");
}

function togglePause() {
  isPaused = !isPaused;
  $("pauseButton").textContent = isPaused ? "Reprendre" : "Pause";
}

function completeSession() {
  clearInterval(timer);
  timer = null;

  $("afterStress").value  = $("beforeStress").value;
  $("afterEnergy").value  = $("beforeEnergy").value;
  $("afterClarity").value = $("beforeClarity").value;

  const records     = state();
  const total       = records.length + 1;
  const streak      = calculateStreak(records);
  const durationMin = Math.round((selectedSession.duration - Math.max(remaining, 0)) / 60);
  const timeLabel   = durationMin > 0 ? `${durationMin} min` : "quelques instants";

  let msg = `Séance terminée — ${timeLabel}.`;
  if (total === 1)           msg = "Première séance. C'est le plus important.";
  else if (total % 10 === 0) msg = `${total} séances au total. Belle régularité.`;
  else if (streak >= 7)      msg = `${streak} jours actifs d'affilée. Tu tiens le fil.`;
  else if (programDayCtx !== null) {
    const next = programDayCtx < 7 ? `Jour ${programDayCtx + 1} demain.` : "Parcours terminé après ça.";
    msg = `Jour ${programDayCtx} validé. ${next}`;
  }

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
    programDay:      programDayCtx,
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

  // Marquer le jour du parcours si applicable
  if (programDayCtx !== null) {
    markProgramDayDone(programDayCtx);
    programDayCtx = null;
  }

  const records = state();
  records.push(record);
  saveState(records);
  $("sessionDialog").close();
  $("sessionNote").value = "";
  renderStats();
  renderProgram(); // Rafraîchit le parcours pour afficher le jour suivant
  renderSessions(); // Rafraîchit les badges perso
}

function stopActiveTimer() {
  if (timer) { clearInterval(timer); timer = null; }
  isPaused = false;
}

// ════════════════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS
// ════════════════════════════════════════════════════════════════════════════
function bindEvents() {
  // Navigation vues
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // Délégation globale
  document.addEventListener("click", (e) => {
    // Humeur (vue aujourd'hui)
    const moodBtn = e.target.closest("[data-mood]");
    if (moodBtn) { recommendForMood(moodBtn.dataset.mood); return; }

    // Session depuis la bibliothèque ou recommandation
    const sessionBtn = e.target.closest("[data-session]:not([data-program-day])");
    if (sessionBtn) {
      openSession(sessionBtn.dataset.session, Boolean(sessionBtn.closest("#recommendedSession")));
      return;
    }

    // Session depuis le parcours
    const programBtn = e.target.closest("[data-program-day]");
    if (programBtn) {
      const day = Number(programBtn.dataset.programDay);
      openSession(programBtn.dataset.session, false, day);
    }
  });

  $("categoryFilter").addEventListener("change",   (e) => renderSessions(e.target.value));
  $("startSessionButton").addEventListener("click", startSession);
  $("pauseButton").addEventListener("click",        togglePause);
  $("finishButton").addEventListener("click",       completeSession);
  $("saveSessionButton").addEventListener("click",  saveSessionRecord);
  $("settingsButton").addEventListener("click",     openSettings);
  $("weeklyGoal").addEventListener("change",        updateSettingsFromUI);
  $("tonePreference").addEventListener("change",    updateSettingsFromUI);
  $("exportButton").addEventListener("click",       exportData);
  $("resetButton").addEventListener("click",        resetData);
  $("sessionDialog").addEventListener("cancel",     stopActiveTimer);
  $("sessionDialog").addEventListener("close",      stopActiveTimer);
  $("reminderEnabled").addEventListener("change",   handleReminderToggle);
  $("reminderTime").addEventListener("change",      handleReminderTimeChange);
  bindOnboardingEvents();
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════════
function checkOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return;
  $("onboarding").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function bindOnboardingEvents() {
  $("obNext0").addEventListener("click", () => obGoToSlide(1));

  $("obGoalGrid").addEventListener("click", (e) => {
    const pill = e.target.closest("[data-goal]");
    if (!pill) return;
    obGoal = Number(pill.dataset.goal);
    document.querySelectorAll("[data-goal]").forEach((b) => b.classList.remove("ob-goal-active"));
    pill.classList.add("ob-goal-active");
  });

  $("obEnableNotif").addEventListener("click", async () => {
    const granted = await requestNotificationPermission();
    const statusEl = $("obNotifStatus");
    if (granted) {
      const time = $("obReminderTime").value;
      saveReminder({ enabled: true, time });
      scheduleReminder(time);
      statusEl.textContent = `Rappel activé à ${time} ✓`;
      statusEl.className   = "ob-notif-status ob-notif-ok";
      $("obEnableNotif").textContent = "Activé ✓";
      $("obEnableNotif").disabled    = true;
    } else {
      $("obNotifStatus").textContent = notifDeniedMessage();
      $("obNotifStatus").className   = "ob-notif-status ob-notif-err";
    }
  });

  $("obNext1").addEventListener("click", () => {
    saveSettings({ ...settings(), weeklyGoal: obGoal });
    obGoToSlide(2);
  });

  $("obStartProgram").addEventListener("click", () => {
    completeOnboarding();
    startProgram();
  });

  $("obStartFree").addEventListener("click", completeOnboarding);
}

function obGoToSlide(n) {
  $(`obSlide${obCurrentSlide}`).classList.add("hidden");
  $(`obSlide${n}`).classList.remove("hidden");
  document.querySelectorAll(".ob-dot").forEach((d, i) => {
    d.classList.toggle("ob-dot-active", i === n);
    d.classList.toggle("ob-dot-done",   i < n);
  });
  obCurrentSlide = n;
}

function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, "1");
  document.body.style.overflow = "";
  const el = $("onboarding");
  el.classList.add("ob-exit");
  setTimeout(() => el.classList.add("hidden"), 400);
  renderStats();
}

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
function initReminder() {
  const r = getReminder();
  if (r.enabled && Notification.permission === "granted") scheduleReminder(r.time);
}

function scheduleReminder(timeStr) {
  if (!timeStr || !("Notification" in window) || Notification.permission !== "granted") return;
  const today    = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(REMINDER_DATE_KEY) === today) return;
  const [h, m]  = timeStr.split(":").map(Number);
  const now     = new Date();
  const target  = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) return;
  setTimeout(() => showLocalNotification(), target - now);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted")  return true;
  if (Notification.permission === "denied")   return false;
  return (await Notification.requestPermission()) === "granted";
}

function showLocalNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body  = reminderMessages[Math.floor(Math.random() * reminderMessages.length)];
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SHOW_NOTIFICATION", title: "Respire", body });
  } else {
    new Notification("Respire", { body, icon: "assets/icons/apple-touch-icon.png", tag: "daily-reminder" });
  }
  localStorage.setItem(REMINDER_DATE_KEY, new Date().toISOString().slice(0, 10));
}

function notifDeniedMessage() {
  return Notification.permission === "denied"
    ? "Notifications bloquées. Active-les dans Safari → Réglages → Respire."
    : "Notifications non supportées sur ce navigateur.";
}

// ─── Paramètres ───────────────────────────────────────────────────────────────
function openSettings() {
  const s = settings();
  const r = getReminder();
  $("weeklyGoal").value      = String(s.weeklyGoal);
  $("tonePreference").value  = s.tone;
  const enabled = r.enabled && Notification.permission === "granted";
  $("reminderEnabled").checked = enabled;
  $("reminderTime").value      = r.time || "08:00";
  $("reminderTime").disabled   = !enabled;
  updateReminderStatus();
  $("settingsDialog").showModal();
}

function updateSettingsFromUI() {
  saveSettings({ weeklyGoal: Number($("weeklyGoal").value), tone: $("tonePreference").value });
  renderQuote();
  renderStats();
}

async function handleReminderToggle() {
  const checked = $("reminderEnabled").checked;
  if (checked) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      $("reminderEnabled").checked = false;
      $("reminderStatus").textContent = notifDeniedMessage();
      return;
    }
    const time = $("reminderTime").value;
    saveReminder({ enabled: true, time });
    scheduleReminder(time);
    $("reminderTime").disabled = false;
  } else {
    saveReminder({ enabled: false, time: $("reminderTime").value });
    $("reminderTime").disabled = true;
  }
  updateReminderStatus();
}

function handleReminderTimeChange() {
  const r = getReminder();
  if (!r.enabled) return;
  const time = $("reminderTime").value;
  saveReminder({ ...r, time });
  scheduleReminder(time);
  updateReminderStatus();
}

function updateReminderStatus() {
  const r = getReminder();
  const s = $("reminderStatus");
  if (!r.enabled) { s.textContent = ""; return; }
  if (Notification.permission !== "granted") { s.textContent = notifDeniedMessage(); return; }
  s.textContent = `Rappel configuré à ${r.time}. Fonctionne quand l'app est en arrière-plan.`;
}

// ─── Export / reset ───────────────────────────────────────────────────────────
function exportData() {
  const payload = { exportedAt: new Date().toISOString(), settings: settings(), records: state(), program: getProgram() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: "respire-export.json" }).click();
  URL.revokeObjectURL(url);
}

function resetData() {
  if (!confirm("Supprimer toutes les données locales ?")) return;
  [STORAGE_KEY, QUOTE_KEY, ONBOARDING_KEY, PROGRAM_KEY].forEach((k) => localStorage.removeItem(k));
  renderStats();
  renderProgram();
  renderSessions();
  checkOnboarding();
}

// ─── Service Worker ───────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
