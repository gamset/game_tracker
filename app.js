import { firebaseConfig } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const MONEY_DENOMS = [5000, 10000, 20000, 50000, 100000];
const TILE_DENOMS = [50000, 100000, 150000, 200000, 250000];
const DEFAULT_THEME = "classic";
const DEFAULT_MODE = "dark";
const MODE_DEFAULT_VERSION = "v22";

const $ = (id) => document.getElementById(id);
const on = (id, event, fn) => {
  const el = $(id);
  if (el) el.addEventListener(event, fn);
};

let state = {
  selectedGameType: localStorage.getItem("lifeTracker.selectedGameType") || "",
  gameCode: localStorage.getItem("lifeTracker.gameCode") || "",
  playerId: localStorage.getItem("lifeTracker.playerId") || "",
  role: localStorage.getItem("lifeTracker.role") || "player",
  moneyMode: "",
  pendingMoneyCounts: {},
  pendingChildDelta: 0,
  pendingLoanChange: 0,
  pendingTileChanges: {},
  visualTheme: localStorage.getItem("lifeTracker.visualTheme") || DEFAULT_THEME,
  colorMode: localStorage.getItem("lifeTracker.colorMode") || DEFAULT_MODE,
  currentPlayer: null,
  players: [],
  activities: [],
  unsubscribeGame: null,
  unsubscribePlayer: null,
  unsubscribePlayers: null,
  unsubscribeActivity: null
};

function formatK(value = 0) {
  const negative = Number(value) < 0;
  const abs = Math.abs(Number(value) || 0);
  const formatted = `${Math.round(abs / 1000).toLocaleString()}K`;
  return negative ? `-${formatted}` : formatted;
}

function showError(message) {
  const el = $("setupError");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearError() {
  const el = $("setupError");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeGameCode() {
  return `LIFE-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function gameRef(code = state.gameCode) {
  return doc(db, "games", code);
}

function playersRef(code = state.gameCode) {
  return collection(db, "games", code, "players");
}

function playerRef(playerId = state.playerId, code = state.gameCode) {
  return doc(db, "games", code, "players", playerId);
}

function activityRef(code = state.gameCode) {
  return collection(db, "games", code, "activity");
}

function applyVisualSettings() {
  document.body.dataset.theme = state.visualTheme || DEFAULT_THEME;
  document.body.classList.toggle("dark", state.colorMode === "dark");

  const themeSelect = $("themeSelect");
  const modeToggleBtn = $("modeToggleBtn");

  if (themeSelect) themeSelect.value = state.visualTheme || DEFAULT_THEME;
  if (modeToggleBtn) modeToggleBtn.textContent = state.colorMode === "dark" ? "Light Mode" : "Dark Mode";
}

function initializeColorMode() {
  const storedDefaultVersion = localStorage.getItem("lifeTracker.modeDefaultVersion");
  const storedMode = localStorage.getItem("lifeTracker.colorMode");

  if (!storedMode || storedDefaultVersion !== MODE_DEFAULT_VERSION) {
    state.colorMode = DEFAULT_MODE;
    localStorage.setItem("lifeTracker.colorMode", DEFAULT_MODE);
    localStorage.setItem("lifeTracker.modeDefaultVersion", MODE_DEFAULT_VERSION);
  }

  state.visualTheme = localStorage.getItem("lifeTracker.visualTheme") || DEFAULT_THEME;
  state.colorMode = localStorage.getItem("lifeTracker.colorMode") || DEFAULT_MODE;
  applyVisualSettings();
}

function setVisualTheme(theme) {
  state.visualTheme = theme || DEFAULT_THEME;
  localStorage.setItem("lifeTracker.visualTheme", state.visualTheme);
  applyVisualSettings();
}

function toggleColorMode() {
  state.colorMode = document.body.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem("lifeTracker.colorMode", state.colorMode);
  localStorage.setItem("lifeTracker.modeDefaultVersion", MODE_DEFAULT_VERSION);
  applyVisualSettings();
}

function saveLocalSession() {
  localStorage.setItem("lifeTracker.selectedGameType", state.selectedGameType || "life");
  localStorage.setItem("lifeTracker.gameCode", state.gameCode);
  localStorage.setItem("lifeTracker.playerId", state.playerId);
  localStorage.setItem("lifeTracker.role", state.role);
}

function clearLocalSession() {
  localStorage.removeItem("lifeTracker.gameCode");
  localStorage.removeItem("lifeTracker.playerId");
  localStorage.removeItem("lifeTracker.role");
}

function chooseGame(gameType) {
  state.selectedGameType = gameType;
  localStorage.setItem("lifeTracker.selectedGameType", gameType);

  $("gameChooserView")?.classList.add("hidden");
  $("setupView")?.classList.remove("hidden");
  $("gameView")?.classList.add("hidden");
}

async function logActivity(description, extra = {}) {
  const playerName = state.currentPlayer?.name || extra.playerName || "Unknown";
  await addDoc(activityRef(), {
    playerId: state.playerId,
    playerName,
    description,
    ...extra,
    createdAt: serverTimestamp()
  });
}

async function createGame() {
  clearError();
  state.selectedGameType = state.selectedGameType || "life";

  const hostName = $("hostName")?.value.trim();
  const startingMoney = Number($("startingMoney")?.value || 10000);

  if (!hostName) {
    showError("Please enter the host player name.");
    return;
  }

  let code = makeGameCode();
  let gameSnap = await getDoc(gameRef(code));
  while (gameSnap.exists()) {
    code = makeGameCode();
    gameSnap = await getDoc(gameRef(code));
  }

  const playerId = makeId("player");

  await setDoc(gameRef(code), {
    code,
    gameType: "life",
    gameName: "The Game of Life",
    status: "active",
    hostPlayerId: playerId,
    hostName,
    finalFourTilesAwarded: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, "games", code, "players", playerId), {
    name: hostName,
    role: "host",
    money: startingMoney,
    children: 0,
    loans: 0,
    loanOwed: 0,
    finalizedCash: null,
    finalizedAt: null,
    lifeTiles: {},
    lifeTileTotal: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  state.gameCode = code;
  state.playerId = playerId;
  state.role = "host";
  saveLocalSession();

  await addDoc(activityRef(code), {
    playerId,
    playerName: hostName,
    description: `${hostName} created the game as host.`,
    type: "system",
    createdAt: serverTimestamp()
  });

  startLiveGame();
}

async function joinGame() {
  clearError();
  state.selectedGameType = state.selectedGameType || "life";

  const code = $("joinCode")?.value.trim().toUpperCase();
  const name = $("joinName")?.value.trim();

  if (!code || !name) {
    showError("Please enter the game code and player name.");
    return;
  }

  const snap = await getDoc(gameRef(code));
  if (!snap.exists()) {
    showError("Game code was not found. Check the code and try again.");
    return;
  }

  const gameData = snap.data();
  if ((gameData.gameType || "life") !== "life") {
    showError("This game code belongs to a different game type.");
    return;
  }

  const playerId = makeId("player");

  await setDoc(doc(db, "games", code, "players", playerId), {
    name,
    role: "player",
    money: 0,
    children: 0,
    loans: 0,
    loanOwed: 0,
    finalizedCash: null,
    finalizedAt: null,
    lifeTiles: {},
    lifeTileTotal: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await addDoc(activityRef(code), {
    playerId,
    playerName: name,
    description: `${name} joined the game.`,
    type: "system",
    createdAt: serverTimestamp()
  });

  state.gameCode = code;
  state.playerId = playerId;
  state.role = "player";
  saveLocalSession();
  startLiveGame();
}

function cleanupListeners() {
  for (const key of ["unsubscribeGame", "unsubscribePlayer", "unsubscribePlayers", "unsubscribeActivity"]) {
    if (typeof state[key] === "function") state[key]();
    state[key] = null;
  }
}

function startLiveGame() {
  if (!state.gameCode || !state.playerId) return;

  $("gameChooserView")?.classList.add("hidden");
  $("setupView")?.classList.add("hidden");
  $("gameView")?.classList.remove("hidden");
  $("gameTitle").textContent = "The Game of Life";
  $("gameCodeLabel").textContent = state.gameCode;
  $("hostView")?.classList.toggle("hidden", state.role !== "host");

  cleanupListeners();

  state.unsubscribeGame = onSnapshot(gameRef(), (snap) => {
    if (!snap.exists()) leaveGame();
  });

  state.unsubscribePlayer = onSnapshot(playerRef(), (snap) => {
    if (!snap.exists()) {
      leaveGame();
      return;
    }
    state.currentPlayer = { id: snap.id, ...snap.data() };
    renderPlayer();
  });

  state.unsubscribePlayers = onSnapshot(query(playersRef(), orderBy("createdAt", "asc")), (snap) => {
    state.players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHost();
  });

  state.unsubscribeActivity = onSnapshot(query(activityRef(), orderBy("createdAt", "desc")), (snap) => {
    state.activities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHost();
  });
}

function leaveGame() {
  cleanupListeners();
  clearLocalSession();
  state.gameCode = "";
  state.playerId = "";
  state.role = "player";
  state.currentPlayer = null;
  $("gameChooserView")?.classList.add("hidden");
  $("gameView")?.classList.add("hidden");
  $("setupView")?.classList.remove("hidden");
}

function setControlsLocked(isLocked) {
  const idsToDisable = [
    "moneyAddBtn", "moneySubtractBtn", "applyMoneyBtn", "cancelMoneyBtn",
    "stageMinusChildBtn", "stagePlusChildBtn", "applyChildBtn", "cancelChildBtn",
    "stagePayLoanBtn", "stageTakeLoanBtn", "applyLoanBtn", "cancelLoanBtn", "settleAllLoansBtn"
  ];

  for (const id of idsToDisable) {
    const el = $(id);
    if (el) el.disabled = isLocked;
  }

  $("moneyModeGroup")?.classList.toggle("lockedControl", isLocked);

  let notice = $("cashFinalizedNotice");
  if (!notice && $("playerSummary")) {
    notice = document.createElement("div");
    notice.id = "cashFinalizedNotice";
    notice.className = "lockedNotice hidden";
    notice.textContent = "Cash has been finalized. Money, children, and loan paper changes are locked.";
    $("playerSummary").after(notice);
  }
  if (notice) notice.classList.toggle("hidden", !isLocked);
}

function renderPlayer() {
  const p = state.currentPlayer;
  if (!p) return;

  const cashIsFinalized = p.finalizedCash != null;
  const finalCash = cashIsFinalized ? p.finalizedCash : p.money || 0;
  const finalScore = finalCash + (p.lifeTileTotal || 0);

  $("playerSummary").innerHTML = `
    <div class="metric"><span>Money</span><strong>${formatK(p.money || 0)}</strong></div>
    <div class="metric"><span>Children</span><strong>${p.children || 0}</strong></div>
    <div class="metric"><span>Loan Papers</span><strong>${p.loans || 0}</strong></div>
    <div class="metric"><span>Payback Owed</span><strong>${formatK(p.loanOwed || 0)}</strong></div>
    <div class="metric"><span>Finalized Cash</span><strong>${cashIsFinalized ? formatK(p.finalizedCash) : "Not set"}</strong></div>
    <div class="metric"><span>Final Score</span><strong>${formatK(finalScore)}</strong></div>
  `;

  $("childCount").textContent = p.children || 0;
  $("loanCount").textContent = p.loans || 0;
  $("loanSummary").innerHTML = `
    <div class="metric"><span>Total Borrowed</span><strong>${formatK((p.loans || 0) * 20000)}</strong></div>
    <div class="metric"><span>Total Payback</span><strong>${formatK(p.loanOwed || 0)}</strong></div>
  `;

  $("finalizedCashText").innerHTML = !cashIsFinalized
    ? "Cash has not been finalized."
    : `Finalized cash balance: <strong>${formatK(p.finalizedCash)}</strong>`;

  $("lifeTileSection")?.classList.toggle("hidden", !cashIsFinalized);
  $("lifeTileLockedText")?.classList.toggle("hidden", cashIsFinalized);
  $("finalizeCashBtn").disabled = cashIsFinalized;

  setControlsLocked(cashIsFinalized);
  if (!cashIsFinalized) {
    $("stagePayLoanBtn").disabled = (p.loans || 0) <= 0;
    $("settleAllLoansBtn").disabled = (p.loans || 0) <= 0;
  }

  renderPendingLoanChange();
  renderTileCountersFromPlayer();
  renderTileSummary();
}

function renderHost() {
  if (state.role !== "host") return;

  $("playersTable").innerHTML = state.players.map((p) => {
    const cash = p.finalizedCash ?? p.money ?? 0;
    const finalScore = cash + (p.lifeTileTotal || 0);
    return `
      <tr>
        <td>${escapeHTML(p.name || "Unnamed")} ${p.role === "host" ? "<span class='badge ok'>Host</span>" : ""}</td>
        <td>${formatK(p.money || 0)}</td>
        <td>${p.children || 0}</td>
        <td>${p.loans || 0}</td>
        <td>${formatK((p.loans || 0) * 20000)}</td>
        <td>${formatK(p.loanOwed || 0)}</td>
        <td>${p.finalizedCash == null ? "<span class='badge warn'>Not finalized</span>" : formatK(p.finalizedCash)}</td>
        <td>${formatK(p.lifeTileTotal || 0)}</td>
        <td><strong>${formatK(finalScore)}</strong></td>
      </tr>`;
  }).join("");

  const finalized = state.players
    .filter((p) => p.finalizedCash != null)
    .sort((a, b) => (b.finalizedCash || 0) - (a.finalizedCash || 0));

  $("cashRanking").innerHTML = finalized.length
    ? finalized.map((p, i) => `<div>${i + 1}. <strong>${escapeHTML(p.name)}</strong> ${formatK(p.finalizedCash)}</div>`).join("")
    : "<p class='muted'>No finalized cash balances yet.</p>";

  $("activityLog").innerHTML = state.activities.map((a) => {
    const time = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : "Just now";
    return `<div class="activityItem"><strong>${escapeHTML(a.playerName || "System")}</strong><span>${escapeHTML(a.description || "")}</span><small>${time}</small></div>`;
  }).join("");
}

function getPendingMoneyTotal() {
  return MONEY_DENOMS.reduce((total, amount) => total + amount * (state.pendingMoneyCounts[String(amount)] || 0), 0);
}

function renderPendingMoneyCounters() {
  if (!$("moneyCounters")) return;

  for (const amount of MONEY_DENOMS) {
    const count = state.pendingMoneyCounts[String(amount)] || 0;
    const countEl = $(`moneyCount-${amount}`);
    const subtotalEl = $(`moneySubtotal-${amount}`);
    if (countEl) countEl.textContent = count;
    if (subtotalEl) subtotalEl.textContent = formatK(amount * count);
  }

  const total = getPendingMoneyTotal();
  const actionWord = state.moneyMode === "add" ? "Add" : "Subtract";
  const sign = state.moneyMode === "add" ? "+" : "−";
  $("pendingMoneyText").textContent = total > 0 ? `${actionWord} ${sign}${formatK(total)}. Tap Apply to save this change.` : "No amount selected.";
  $("applyMoneyBtn").disabled = total <= 0;
}

function changePendingMoneyDenomination(amount, delta) {
  if (state.currentPlayer?.finalizedCash != null) return;
  const key = String(amount);
  const next = Math.max(0, (state.pendingMoneyCounts[key] || 0) + delta);
  if (next === 0) delete state.pendingMoneyCounts[key];
  else state.pendingMoneyCounts[key] = next;
  renderPendingMoneyCounters();
}

function setMoneyMode(mode) {
  if (state.currentPlayer?.finalizedCash != null) return;
  state.moneyMode = mode;
  state.pendingMoneyCounts = {};
  $("moneyActionPanel").classList.remove("hidden");
  $("moneyModeGroup").classList.remove("moneyChoiceNeutral");
  $("moneyModeGroup").classList.add("moneyChoiceActive");
  $("moneyAddBtn").classList.toggle("selected", mode === "add");
  $("moneySubtractBtn").classList.toggle("selected", mode === "subtract");
  $("moneyActionLabel").textContent = `${mode === "add" ? "Add money" : "Subtract money"}: use + and − to build the total`;
  renderPendingMoneyCounters();
}

function resetMoneyAction() {
  state.moneyMode = "";
  state.pendingMoneyCounts = {};
  $("moneyActionPanel").classList.add("hidden");
  $("moneyActionLabel").textContent = "Select an amount";
  $("pendingMoneyText").textContent = "No amount selected.";
  $("applyMoneyBtn").disabled = true;
  $("moneyAddBtn").classList.remove("selected");
  $("moneySubtractBtn").classList.remove("selected");
  $("moneyModeGroup").classList.add("moneyChoiceNeutral");
  $("moneyModeGroup").classList.remove("moneyChoiceActive");
  renderPendingMoneyCounters();
}

async function applyMoneyChange() {
  if (!state.moneyMode || state.currentPlayer?.finalizedCash != null) return;
  const total = getPendingMoneyTotal();
  if (total <= 0) return;
  const change = state.moneyMode === "add" ? total : -total;
  await updateDoc(playerRef(), { money: increment(change), updatedAt: serverTimestamp() });
  await logActivity(`${state.moneyMode === "add" ? "Added" : "Subtracted"} ${formatK(total)}.`, {
    type: "money",
    action: state.moneyMode,
    amount: change,
    denominations: { ...state.pendingMoneyCounts }
  });
  resetMoneyAction();
}

function stageChildChange(delta) {
  if (state.currentPlayer?.finalizedCash != null) return;
  const currentChildren = state.currentPlayer?.children || 0;
  if (delta < 0 && currentChildren <= 0) return;
  state.pendingChildDelta = delta;
  $("childActionPanel").classList.remove("hidden");
  $("pendingChildText").textContent = `${delta > 0 ? "Add" : "Remove"} 1 child. Tap Apply to save this change.`;
}

function resetChildAction() {
  state.pendingChildDelta = 0;
  $("childActionPanel").classList.add("hidden");
  $("pendingChildText").textContent = "No child change selected.";
}

async function applyChildChange() {
  if (!state.pendingChildDelta || state.currentPlayer?.finalizedCash != null) return;
  const next = Math.max(0, (state.currentPlayer.children || 0) + state.pendingChildDelta);
  const actualDelta = next - (state.currentPlayer.children || 0);
  if (actualDelta === 0) return resetChildAction();
  await updateDoc(playerRef(), { children: next, updatedAt: serverTimestamp() });
  await logActivity(`${actualDelta > 0 ? "Added" : "Removed"} 1 child.`, { type: "child", action: actualDelta > 0 ? "add" : "subtract", amount: actualDelta });
  resetChildAction();
}

function getPendingLoanChange() {
  return state.pendingLoanChange || 0;
}

function renderPendingLoanChange() {
  const change = getPendingLoanChange();
  const currentLoans = state.currentPlayer?.loans || 0;
  const projectedLoans = currentLoans + change;
  const currentBorrowed = currentLoans * 20000;
  const projectedBorrowed = projectedLoans * 20000;
  const currentOwed = currentLoans * 25000;
  const projectedOwed = projectedLoans * 25000;
  const moneyChange = change > 0 ? change * 20000 : change * 25000;

  const loanRow = $("loanCount")?.closest(".counterRow");
  if (loanRow) loanRow.classList.toggle("pendingLoanRow", change !== 0);

  if (change === 0) {
    $("loanActionPanel").classList.add("hidden");
    $("pendingLoanText").textContent = "No loan paper change selected.";
    $("applyLoanBtn").disabled = true;
    return;
  }

  const absChange = Math.abs(change);
  const firstLine = change > 0
    ? `Add <strong>${absChange} loan paper${absChange === 1 ? "" : "s"}</strong>, borrow <strong>${formatK(change * 20000)}</strong>.`
    : `Remove/pay <strong>${absChange} loan paper${absChange === 1 ? "" : "s"}</strong>, pay back <strong>${formatK(Math.abs(change * 25000))}</strong>.`;

  $("loanActionPanel").classList.remove("hidden");
  $("applyLoanBtn").disabled = false;
  $("pendingLoanText").innerHTML = `
    ${firstLine}<br>
    Current loan papers: ${currentLoans}. After applying: ${projectedLoans}.<br>
    Borrowed total: ${formatK(currentBorrowed)} → ${formatK(projectedBorrowed)}.<br>
    Payback owed: ${formatK(currentOwed)} → ${formatK(projectedOwed)}.<br>
    Money change when applied: ${moneyChange >= 0 ? "+" : "−"}${formatK(Math.abs(moneyChange))}.
  `;
}

function stageLoanChange(delta) {
  if (state.currentPlayer?.finalizedCash != null) return;
  const next = getPendingLoanChange() + delta;
  if ((state.currentPlayer?.loans || 0) + next < 0) return;
  state.pendingLoanChange = next;
  renderPendingLoanChange();
}

function resetLoanAction() {
  state.pendingLoanChange = 0;
  renderPendingLoanChange();
}

async function applyLoanChange() {
  if (state.currentPlayer?.finalizedCash != null) return;
  const change = getPendingLoanChange();
  if (!change) return;
  if ((state.currentPlayer?.loans || 0) + change < 0) return resetLoanAction();
  const moneyChange = change > 0 ? change * 20000 : change * 25000;
  const owedChange = change * 25000;
  await updateDoc(playerRef(), { money: increment(moneyChange), loans: increment(change), loanOwed: increment(owedChange), updatedAt: serverTimestamp() });
  await logActivity(`${change > 0 ? "Added" : "Removed/paid"} ${Math.abs(change)} loan paper${Math.abs(change) === 1 ? "" : "s"}: ${moneyChange >= 0 ? "+" : "−"}${formatK(Math.abs(moneyChange))}.`, {
    type: "loan",
    action: change > 0 ? "take_multiple" : "pay_multiple",
    loanPaperChange: change,
    moneyChange,
    owedChange
  });
  resetLoanAction();
}

async function settleAllLoans() {
  if (state.currentPlayer?.finalizedCash != null) return;
  const p = state.currentPlayer;
  if (!p || (p.loans || 0) <= 0) return;
  const owed = p.loanOwed || 0;
  const loans = p.loans || 0;
  await updateDoc(playerRef(), { money: increment(-owed), loans: 0, loanOwed: 0, updatedAt: serverTimestamp() });
  await logActivity(`Paid all unpaid loans: ${loans} loan(s), −${formatK(owed)}.`, { type: "loan", action: "settle_all", moneyChange: -owed, owedChange: -owed });
}

async function finalizeCash() {
  const p = state.currentPlayer;
  if (!p || p.finalizedCash != null) return;
  if ((p.loans || 0) > 0 && !confirm("This player still has unpaid loans. Finalize cash anyway?")) return;
  await updateDoc(playerRef(), { finalizedCash: p.money || 0, finalizedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logActivity(`Finalized cash balance at ${formatK(p.money || 0)}.`, { type: "finalize_cash", finalizedCash: p.money || 0 });
}

function getPendingTileDelta(amount) {
  return state.pendingTileChanges?.[String(amount)] || 0;
}

function getPendingTileTotalChange() {
  return TILE_DENOMS.reduce((total, amount) => total + amount * getPendingTileDelta(amount), 0);
}

function renderTileCountersFromPlayer() {
  const tiles = state.currentPlayer?.lifeTiles || {};
  for (const amount of TILE_DENOMS) {
    const currentCount = tiles[String(amount)] || 0;
    const pendingDelta = getPendingTileDelta(amount);
    const projectedCount = currentCount + pendingDelta;
    const countEl = $(`tileCount-${amount}`);
    const totalEl = $(`tileTotal-${amount}`);
    const rowEl = document.querySelector(`[data-tile-row="${amount}"]`);
    if (countEl) countEl.textContent = projectedCount;
    if (totalEl) totalEl.textContent = formatK(amount * projectedCount);
    if (rowEl) rowEl.classList.toggle("pendingTileRow", pendingDelta !== 0);
  }
}

function renderPendingTileChanges() {
  renderTileCountersFromPlayer();
  const entries = TILE_DENOMS.map((amount) => ({ amount, delta: getPendingTileDelta(amount) })).filter((entry) => entry.delta !== 0);
  if (entries.length === 0) {
    $("tileActionPanel").classList.add("hidden");
    $("pendingTileText").textContent = "No LIFE tile change selected.";
    $("applyTileBtn").disabled = true;
    return;
  }
  $("tileActionPanel").classList.remove("hidden");
  $("applyTileBtn").disabled = false;
  const lines = entries.map(({ amount, delta }) => {
    const sign = delta > 0 ? "+" : "−";
    return `${formatK(amount)}: ${sign}${Math.abs(delta)} tile${Math.abs(delta) === 1 ? "" : "s"} (${sign}${formatK(Math.abs(delta * amount))})`;
  });
  const totalChange = getPendingTileTotalChange();
  const totalSign = totalChange >= 0 ? "+" : "−";
  $("pendingTileText").innerHTML = `<strong>Pending LIFE tile changes</strong><br>${lines.join("<br>")}<div class="pendingPreview">Total pending change: ${totalSign}${formatK(Math.abs(totalChange))}</div>`;
}

function stageTileChange(amount, delta) {
  if (!state.pendingTileChanges) state.pendingTileChanges = {};
  const key = String(amount);
  const currentCount = state.currentPlayer?.lifeTiles?.[key] || 0;
  const nextPending = getPendingTileDelta(amount) + delta;
  if (currentCount + nextPending < 0) return;
  if (nextPending === 0) delete state.pendingTileChanges[key];
  else state.pendingTileChanges[key] = nextPending;
  renderPendingTileChanges();
}

function resetTileAction() {
  state.pendingTileChanges = {};
  renderPendingTileChanges();
}

async function applyTileChange() {
  const entries = Object.entries({ ...(state.pendingTileChanges || {}) }).map(([amount, delta]) => ({ amount: Number(amount), delta })).filter((entry) => entry.delta !== 0);
  if (entries.length === 0) return;
  let totalChange = 0;
  const appliedEntries = [];
  await runTransaction(db, async (transaction) => {
    const ref = playerRef();
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Player not found.");
    const data = snap.data();
    const lifeTiles = data.lifeTiles || {};
    for (const { amount, delta } of entries) {
      const key = String(amount);
      const currentCount = lifeTiles[key] || 0;
      const nextCount = Math.max(0, currentCount + delta);
      const actualDelta = nextCount - currentCount;
      if (actualDelta === 0) continue;
      if (nextCount === 0) delete lifeTiles[key];
      else lifeTiles[key] = nextCount;
      totalChange += amount * actualDelta;
      appliedEntries.push({ amount, delta: actualDelta });
    }
    if (appliedEntries.length === 0) return;
    transaction.update(ref, { lifeTiles, lifeTileTotal: increment(totalChange), updatedAt: serverTimestamp() });
  });
  if (appliedEntries.length > 0) {
    const description = appliedEntries.map(({ amount, delta }) => `${delta > 0 ? "added" : "removed"} ${Math.abs(delta)} × ${formatK(amount)}`).join(", ");
    await logActivity(`Updated LIFE tiles: ${description}.`, { type: "life_tile", action: "update_multiple", totalChange, changes: appliedEntries });
  }
  resetTileAction();
}

function renderTileSummary() {
  const tiles = state.currentPlayer?.lifeTiles || {};
  const tileRows = TILE_DENOMS
    .filter((amount) => (tiles[String(amount)] || 0) > 0)
    .map((amount) => {
      const count = tiles[String(amount)] || 0;
      return `<div>${formatK(amount)} × ${count} = <strong>${formatK(amount * count)}</strong></div>`;
    })
    .join("");
  $("tileSummary").innerHTML = `${tileRows || "<p class='muted'>No LIFE tiles added yet.</p>"}<p><strong>LIFE Tile Total: ${formatK(state.currentPlayer?.lifeTileTotal || 0)}</strong></p>`;
}

async function markFinalTilesAwarded() {
  await updateDoc(gameRef(), { finalFourTilesAwarded: true, updatedAt: serverTimestamp() });
  await logActivity("Host marked the final 4 LIFE tiles from Millionaire Estates as awarded.", { type: "host", action: "final_four_awarded" });
}

function renderButtons() {
  const moneyCounters = $("moneyCounters");
  if (moneyCounters) {
    moneyCounters.innerHTML = MONEY_DENOMS.map((amount) => `
      <div class="moneyCounterRow" data-money-row="${amount}">
        <span><strong>${formatK(amount)}</strong></span>
        <button data-money-minus="${amount}" class="ghost">−</button>
        <strong id="moneyCount-${amount}">0</strong>
        <button data-money-plus="${amount}">+</button>
        <span class="moneySubtotal" id="moneySubtotal-${amount}">0K</span>
      </div>`).join("");
    moneyCounters.addEventListener("click", (e) => {
      const plusBtn = e.target.closest("[data-money-plus]");
      const minusBtn = e.target.closest("[data-money-minus]");
      if (plusBtn) changePendingMoneyDenomination(Number(plusBtn.dataset.moneyPlus), 1);
      if (minusBtn) changePendingMoneyDenomination(Number(minusBtn.dataset.moneyMinus), -1);
    });
  }

  const tileCounters = $("tileCounters");
  if (tileCounters) {
    tileCounters.innerHTML = TILE_DENOMS.map((amount) => `
      <div class="tileCounterRow" data-tile-row="${amount}">
        <span><strong>${formatK(amount)}</strong></span>
        <button data-tile-minus="${amount}" class="ghost">−</button>
        <strong id="tileCount-${amount}">0</strong>
        <button data-tile-plus="${amount}">+</button>
        <span class="tileTotal" id="tileTotal-${amount}">0K</span>
      </div>`).join("");
    tileCounters.addEventListener("click", (e) => {
      const plusBtn = e.target.closest("[data-tile-plus]");
      const minusBtn = e.target.closest("[data-tile-minus]");
      if (plusBtn) stageTileChange(Number(plusBtn.dataset.tilePlus), 1);
      if (minusBtn) stageTileChange(Number(minusBtn.dataset.tileMinus), -1);
    });
  }
}

function wireEvents() {
  on("themeSelect", "change", (e) => setVisualTheme(e.target.value));
  on("modeToggleBtn", "click", toggleColorMode);
  on("chooseLifeGameBtn", "click", () => chooseGame("life"));
  on("createGameBtn", "click", createGame);
  on("joinGameBtn", "click", joinGame);
  on("leaveBtn", "click", leaveGame);
  on("copyCodeBtn", "click", () => navigator.clipboard.writeText(state.gameCode));
  on("moneyAddBtn", "click", () => setMoneyMode("add"));
  on("moneySubtractBtn", "click", () => setMoneyMode("subtract"));
  on("applyMoneyBtn", "click", applyMoneyChange);
  on("cancelMoneyBtn", "click", resetMoneyAction);
  on("stagePlusChildBtn", "click", () => stageChildChange(1));
  on("stageMinusChildBtn", "click", () => stageChildChange(-1));
  on("applyChildBtn", "click", applyChildChange);
  on("cancelChildBtn", "click", resetChildAction);
  on("stageTakeLoanBtn", "click", () => stageLoanChange(1));
  on("stagePayLoanBtn", "click", () => stageLoanChange(-1));
  on("applyLoanBtn", "click", applyLoanChange);
  on("cancelLoanBtn", "click", resetLoanAction);
  on("settleAllLoansBtn", "click", settleAllLoans);
  on("finalizeCashBtn", "click", finalizeCash);
  on("applyTileBtn", "click", applyTileChange);
  on("cancelTileBtn", "click", resetTileAction);
  on("markFinalTilesBtn", "click", markFinalTilesAwarded);
  on("installBtn", "click", async () => {
    if (!window.deferredPrompt) return;
    window.deferredPrompt.prompt();
    await window.deferredPrompt.userChoice;
    window.deferredPrompt = null;
    $("installBtn")?.classList.add("hidden");
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredPrompt = event;
  $("installBtn")?.classList.remove("hidden");
});

// Service worker disabled during active development to avoid stale cached files.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

initializeColorMode();
renderButtons();
wireEvents();

if (state.gameCode && state.playerId) {
  startLiveGame();
} else if (state.selectedGameType) {
  chooseGame(state.selectedGameType);
} else {
  $("gameChooserView")?.classList.remove("hidden");
  $("setupView")?.classList.add("hidden");
  $("gameView")?.classList.add("hidden");
}
