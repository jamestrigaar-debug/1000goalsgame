/* ============================================================================
 * FOOTBALL DNA SIMULATOR — GAME ENGINE  (Alpha 1.1)
 * Build a striker by drafting attributes from 8 different football eras,
 * then chase 1000 career goals across a fully-simulated career.
 *
 * Alpha 1.1 features:
 *   1. Hidden attribute influence  2. Academy club-roll  3. Free selection
 *   4. Team+Era flow / sorted rosters  5. Expanded stats + league tables
 *   6. End-of-career events  7. Physical-build synergy  8. Peak ratings
 *   9. Hidden-rating mentality system
 * Data lives in data.js (window.GAME_DATA).
 * ========================================================================== */
(function () {
  "use strict";

  const D = window.GAME_DATA;
  const {
    MENTALITY_TRAITS,
    ACADEMY_TIERS,
    CLUB_ACADEMY,
    PLAYER_DATABASE,
    TEAM_DATABASE,
    ACADEMY_STARTING_POOL,
    NATIONAL_TEAM,
  } = D;

  /* --------------------------- CONFIG / LEVERS --------------------------- */
  // The 7 attributes drafted from Team+Era squads (chosen in any order).
  const ATTRS = [
    { key: "heading", name: "Heading", short: "HDR", type: "numeric", desc: "Aerial threat — wins headers and attacks crosses." },
    { key: "mentality", name: "Mentality", short: "MEN", type: "mentality", desc: "Personality & temperament — hidden influence on big moments." },
    { key: "body", name: "Fitness & Strength", short: "PHY", type: "body", desc: "Stamina to play every game and hold off defenders." },
    { key: "size", name: "Height & Weight", short: "SIZ", type: "size", desc: "Physical frame — drives aerial, strength & agility synergy." },
    { key: "leftFoot", name: "Left Foot", short: "LF", type: "numeric", desc: "Finishing quality with the left foot." },
    { key: "rightFoot", name: "Right Foot", short: "RF", type: "numeric", desc: "Finishing quality with the right foot." },
    { key: "speed", name: "Speed", short: "PAC", type: "numeric", desc: "Raw pace to beat defenders and run in behind." },
  ];
  const ATTR_BY_KEY = Object.fromEntries(ATTRS.map((a) => [a.key, a]));
  // skill attributes that receive hidden-influence blending
  const HIDDEN_KEYS = ["heading", "fitness", "strength", "leftFoot", "rightFoot", "speed"];
  const HIDDEN_WEIGHT = 0.25;

  const LEVERS = {
    startRerolls: 3,
    goalTarget: 1000,
    conversionMultiplier: 1.3,
    primeWindow: [24, 29],
    injuryFreqMin: 3,
    injuryFreqMax: 5,
    debutAge: 17,
  };

  const SQUAD_KEYS = Object.keys(PLAYER_DATABASE);
  const CLUB_KEYS = Object.keys(CLUB_ACADEMY);
  const LEAGUE_CLUBS = Object.keys(TEAM_DATABASE);

  /* ------------------------------ STATE --------------------------------- */
  let state = null;

  function freshState() {
    return {
      // genesis
      phase: "attributes", // attributes -> academy
      rerolls: LEVERS.startRerolls,
      currentSpin: null, // { squadKey/club, team, year } or club spin
      chosenAttr: null,  // attribute key selected this turn
      selectedDonorIdx: null,
      player: { name: "Your Striker", slots: {} }, // attr -> { donor, donorObj, team, year, value, value2 }
      academy: null, // { club, tier }
      // compiled
      attrs: null, mentality: null, mentalityRating: 60, playstyle: null,
      baseRating: 0, synergyNotes: [], derived: null,
      // career
      season: 0, age: LEVERS.debutAge, club: null, role: "Rotation",
      reputation: 20, reputationTier: "Unknown",
      totalGoals: 0, totalApps: 0, totalAssists: 0, leagueGoals: 0,
      totalYellow: 0, totalRed: 0, teamCleanSheets: 0,
      careerLog: [], flags: {}, cooldowns: {},
      yearsAtClub: 0, injuryProneSeasons: 0, milestonesHit: {},
      intlCaps: 0, intlGoals: 0, intlDebut: false,
      seasonHistory: [], retired: false, bestRating: 0,
      clubsPlayed: new Set(), clubStats: {}, lastPerformanceTier: "Met Expectation",
      honours: {
        leagueTitles: 0, domesticCups: 0, europeanCups: 0, intlTrophies: 0,
        goldenBoots: 0, ballonDors: 0, playerOfSeason: 0, youngPlayer: 0, tots: 0,
      },
      competitionHistory: [],
      leagueTable: null,
      pendingTransfer: false,
      endCareerReason: null,
      finalSeasonForced: false,
    };
  }

  /* ------------------------------ UTILS --------------------------------- */
  const rand = Math.random;
  function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
  function randomBetween(min, max) { return rand() * (max - min) + min; }
  function choice(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function poissonRandom(lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  function weightedRandomPick(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    if (total <= 0) return null;
    let r = rand() * total;
    for (const i of items) { r -= i.weight; if (r <= 0) return i.item; }
    return items[items.length - 1].item;
  }
  function academyDisplay(name) { return name ? String(name).replace(/_/g, " ") : "—"; }
  function parseSquadKey(key) {
    const m = key.match(/^(.*) \((\d{4})\)$/);
    return m ? { team: m[1], year: parseInt(m[2], 10) } : { team: key, year: 0 };
  }
  function mentTag(trait) { return (MENTALITY_TRAITS[trait] || {}).tag || "neutral"; }
  function mentIsSpecial(trait) { return !!(MENTALITY_TRAITS[trait] || {}).special; }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================ GENESIS ================================= */
  function startCreation() {
    state = freshState();
    showScreen("screen-genesis");
    beginTurn();
  }

  function remainingAttrs() {
    return ATTRS.filter((a) => !state.player.slots[a.key]);
  }

  function beginTurn() {
    state.currentSpin = null;
    state.chosenAttr = null;
    state.selectedDonorIdx = null;

    const isAcademy = state.phase === "academy";
    document.getElementById("attr-name").textContent = isAcademy ? "Academy Roll" : "Roll a Squad";
    document.getElementById("attr-desc").textContent = isAcademy
      ? "Roll a Premier League club — whichever comes up decides which academy your striker graduated from."
      : "Spin to draw a random squad & era, then choose which attribute to draft from it.";

    const done = ATTRS.length - remainingAttrs().length;
    document.getElementById("roll-counter").textContent = isAcademy
      ? "Academy" : `Attribute ${done + 1} of ${ATTRS.length}`;
    document.getElementById("reroll-count").textContent = state.rerolls;

    document.getElementById("roll-result").innerHTML =
      `<div class="placeholder">Press <strong>SPIN</strong> to ${isAcademy ? "roll a club" : "draw a squad"}.</div>`;
    setBtn("btn-spin", true);
    setBtn("btn-accept", false);
    setBtn("btn-reroll", false);
    renderPreview();
  }

  function setBtn(id, show) {
    const b = document.getElementById(id);
    b.style.display = show ? "inline-block" : "none";
    if (id === "btn-spin") b.disabled = !show;
  }

  function spin() {
    document.getElementById("btn-spin").disabled = true;
    const target = document.getElementById("roll-result");
    const isAcademy = state.phase === "academy";
    let ticks = 0;
    const totalTicks = 16;
    const iv = setInterval(() => {
      if (isAcademy) {
        const c = choice(CLUB_KEYS);
        target.innerHTML = `<div class="spinner-team">${esc(c)}<span class="spinner-year">${CLUB_ACADEMY[c]} academy</span></div>`;
      } else {
        const { team, year } = parseSquadKey(choice(SQUAD_KEYS));
        target.innerHTML = `<div class="spinner-team">${esc(team)}<span class="spinner-year">${year}</span></div>`;
      }
      if (++ticks >= totalTicks) { clearInterval(iv); isAcademy ? landClub() : landSquad(); }
    }, 80);
  }

  /* ---- attribute squad roll ---- */
  function landSquad() {
    const squadKey = choice(SQUAD_KEYS);
    const { team, year } = parseSquadKey(squadKey);
    state.currentSpin = { squadKey, team, year };
    renderAttrChooser();
  }

  function renderAttrChooser() {
    const { team, year } = state.currentSpin;
    const chips = remainingAttrs().map((a) =>
      `<button class="attr-chip" data-key="${a.key}">${a.name}</button>`).join("");
    document.getElementById("roll-result").innerHTML = `
      <div class="roll-landed">🎯 <strong>${esc(team)}</strong> <span class="year-chip">${year}</span></div>
      <div class="chooser-label">Choose which attribute to draft from this squad:</div>
      <div class="attr-chips">${chips}</div>
      <div id="roster-slot"></div>`;
    document.querySelectorAll(".attr-chip").forEach((c) =>
      c.addEventListener("click", () => chooseAttr(c.dataset.key)));
    setBtn("btn-spin", false);
    setBtn("btn-accept", false);
    setBtn("btn-reroll", state.rerolls > 0);
  }

  function statForAttr(key, pl) {
    switch (key) {
      case "heading": case "leftFoot": case "rightFoot": case "speed": return pl[key];
      case "body": return Math.round((pl.fitness + pl.strength) / 2);
      case "size": return pl.height;
      case "mentality": return pl.overall; // sort mentality donors by peak overall
      default: return pl.overall || 0;
    }
  }

  function donorValueText(key, pl) {
    switch (key) {
      case "heading": return `Heading ${pl.heading}`;
      case "leftFoot": return `Left Foot ${pl.leftFoot}`;
      case "rightFoot": return `Right Foot ${pl.rightFoot}`;
      case "speed": return `Speed ${pl.speed}`;
      case "body": return `Fitness ${pl.fitness} · Strength ${pl.strength}`;
      case "size": return `${pl.height}cm · ${pl.weight}kg`;
      case "mentality": return `${pl.mentality}${mentIsSpecial(pl.mentality) ? " ★" : ""}`;
      default: return "";
    }
  }

  function chooseAttr(key) {
    state.chosenAttr = key;
    state.selectedDonorIdx = null;
    document.querySelectorAll(".attr-chip").forEach((c) =>
      c.classList.toggle("active", c.dataset.key === key));
    const { squadKey, team, year } = state.currentSpin;
    const cfg = ATTR_BY_KEY[key];
    // sort players high -> low by the chosen attribute
    const squad = PLAYER_DATABASE[squadKey]
      .map((pl, idx) => ({ pl, idx }))
      .sort((a, b) => statForAttr(key, b.pl) - statForAttr(key, a.pl));

    const cards = squad.map(({ pl, idx }) => {
      const badge = statForAttr(key, pl);
      const tierChip = pl.tier ? `<span class="legend-chip">${pl.tier}</span>` : "";
      return `
        <button class="donor-card" data-idx="${idx}">
          <div class="donor-badge">${key === "mentality" ? "" : badge}</div>
          <div class="donor-name">${esc(pl.name)} ${tierChip}</div>
          <div class="donor-pos">${pl.pos}</div>
          <div class="donor-value">${donorValueText(key, pl)}</div>
        </button>`;
    }).join("");

    document.getElementById("roster-slot").innerHTML = `
      <div class="chooser-label">Pick the <strong>${cfg.name}</strong> donor (sorted best → worst):</div>
      <div class="roster-grid">${cards}</div>
      <div id="selected-donor"></div>`;
    document.querySelectorAll("#roster-slot .donor-card").forEach((c) =>
      c.addEventListener("click", () => selectDonor(parseInt(c.dataset.idx, 10))));
  }

  function selectDonor(idx) {
    state.selectedDonorIdx = idx;
    const { squadKey } = state.currentSpin;
    const pl = PLAYER_DATABASE[squadKey][idx];
    document.querySelectorAll("#roster-slot .donor-card").forEach((c) =>
      c.classList.toggle("selected", parseInt(c.dataset.idx, 10) === idx));
    document.getElementById("selected-donor").innerHTML =
      `Selected: <strong>${esc(pl.name)}</strong> — ${donorValueText(state.chosenAttr, pl)} <em>(${esc(state.currentSpin.team)} ${state.currentSpin.year})</em>`;
    setBtn("btn-accept", true);
    setBtn("btn-reroll", state.rerolls > 0);
  }

  /* ---- academy club roll ---- */
  function landClub() {
    const club = choice(CLUB_KEYS);
    const tier = CLUB_ACADEMY[club];
    state.currentSpin = { club, tier };
    const info = ACADEMY_TIERS[tier] || {};
    document.getElementById("roll-result").innerHTML = `
      <div class="roll-landed">🎓 Youth product of <strong>${esc(club)}</strong></div>
      <div class="academy-card tier-${tier.replace(/\s/g, "")}">
        <div class="academy-tier">${tier} Academy</div>
        <div class="academy-flavor">${esc(info.flavor || "")}</div>
      </div>
      <div class="chooser-label">Accept this academy, or reroll for a different club.</div>`;
    setBtn("btn-spin", false);
    setBtn("btn-accept", true);
    setBtn("btn-reroll", state.rerolls > 0);
  }

  function accept() {
    if (state.phase === "academy") {
      if (!state.currentSpin || !state.currentSpin.club) return;
      state.academy = { club: state.currentSpin.club, tier: state.currentSpin.tier };
      compilePlayer();
      return;
    }
    // attribute phase
    if (state.chosenAttr == null || state.selectedDonorIdx == null) return;
    const key = state.chosenAttr;
    const { squadKey, team, year } = state.currentSpin;
    const pl = PLAYER_DATABASE[squadKey][state.selectedDonorIdx];
    const slot = { donor: pl.name, donorObj: pl, team, year };
    if (key === "body") { slot.value = pl.fitness; slot.value2 = pl.strength; }
    else if (key === "size") { slot.value = pl.height; slot.value2 = pl.weight; }
    else if (key === "mentality") { slot.value = pl.mentality; slot.rating = pl.mentalityRating; }
    else slot.value = pl[key];
    state.player.slots[key] = slot;

    if (remainingAttrs().length === 0) { state.phase = "academy"; }
    beginTurn();
  }

  function reroll() {
    if (state.rerolls <= 0) return;
    state.rerolls--;
    document.getElementById("reroll-count").textContent = state.rerolls;
    setBtn("btn-accept", false);
    setBtn("btn-reroll", false);
    spin();
  }

  function renderPreview() {
    const wrap = document.getElementById("player-preview");
    const slots = state.player.slots;
    const rows = ATTRS.map((cfg) => {
      const s = slots[cfg.key];
      if (!s) return `<div class="prev-row empty"><span>${cfg.name}</span><span>—</span></div>`;
      let val;
      if (cfg.key === "body") val = `${s.value}/${s.value2}`;
      else if (cfg.key === "size") val = `${s.value}cm`;
      else val = s.value;
      return `<div class="prev-row"><span>${cfg.name}</span><span class="prev-val">${val}</span><span class="prev-src">${esc(s.donor)}, ${esc(s.team)} ${s.year}</span></div>`;
    }).join("");
    const acad = state.academy
      ? `<div class="prev-row"><span>Academy</span><span class="prev-val">${state.academy.tier}</span><span class="prev-src">${esc(state.academy.club)}</span></div>`
      : `<div class="prev-row empty"><span>Academy</span><span>—</span></div>`;
    wrap.innerHTML = `<h3>Your DNA so far</h3>${rows}${acad}
      <div class="preview-hint">Every donor you pick secretly nudges your other attributes — trade-offs are real.</div>`;
  }

  /* ==================== COMPILE: HIDDEN INFLUENCE + SYNERGY ============== */
  function compilePlayer() {
    const slots = state.player.slots;
    const donors = Object.values(slots).map((s) => s.donorObj);

    // explicit picks
    const explicit = {
      heading: slots.heading.donorObj.heading,
      fitness: slots.body.donorObj.fitness,
      strength: slots.body.donorObj.strength,
      leftFoot: slots.leftFoot.donorObj.leftFoot,
      rightFoot: slots.rightFoot.donorObj.rightFoot,
      speed: slots.speed.donorObj.speed,
    };
    // hidden influence: blend each skill attr with the AVERAGE of the OTHER donors' same attr
    const attrs = {};
    HIDDEN_KEYS.forEach((k) => {
      const source = slots[hostSlotFor(k)].donorObj; // the donor explicitly chosen for this attr
      const others = donors.filter((d) => d !== source);
      const avgOther = others.reduce((s, d) => s + d[k], 0) / (others.length || 1);
      attrs[k] = Math.round(clamp(explicit[k] * (1 - HIDDEN_WEIGHT) + avgOther * HIDDEN_WEIGHT, 40, 99));
    });
    // height/weight taken straight from the size donor (no blend)
    attrs.height = slots.size.donorObj.height;
    attrs.weight = slots.size.donorObj.weight;

    // mentality: trait from the mentality donor; hidden rating nudged by locker-room average
    const mSource = slots.mentality.donorObj;
    const otherRatings = donors.filter((d) => d !== mSource).map((d) => d.mentalityRating);
    const avgMent = otherRatings.reduce((s, r) => s + r, 0) / (otherRatings.length || 1);
    state.mentality = mSource.mentality;
    state.mentalityRating = Math.round(clamp(mSource.mentalityRating * 0.8 + avgMent * 0.2, 15, 99));

    // physical build synergy
    const syn = applyPhysicalSynergy(attrs);
    state.attrs = syn.attrs;
    state.synergyNotes = syn.notes;
    state.derived = deriveStats(syn.attrs);

    state.academyTier = state.academy.tier;
    state.baseRating = calculateStrikerRating(state.attrs);
    state.playstyle = inferPlaystyle(state.attrs);

    renderConfirm();
    showScreen("screen-confirm");
  }

  function hostSlotFor(k) {
    if (k === "fitness" || k === "strength") return "body";
    return k; // heading, leftFoot, rightFoot, speed
  }

  function applyPhysicalSynergy(a0) {
    const a = Object.assign({}, a0);
    const notes = [];
    const h = a.height;
    const bmi = a.weight / Math.pow(a.height / 100, 2);
    if (h >= 190) {
      a.heading = clamp(a.heading + 3, 40, 99);
      a.strength = clamp(a.strength + 3, 40, 99);
      notes.push({ good: true, text: `Towering ${h}cm frame boosts Heading & Strength.` });
      if (a.speed >= 88) { a.speed = clamp(a.speed - 4, 40, 99); notes.push({ good: false, text: "So tall that elite pace is slightly unrealistic (−Speed)." }); }
      if (h >= 196) { a.heading = clamp(a.heading + 2, 40, 99); a.speed = clamp(a.speed - 3, 40, 99); }
    } else if (h <= 172) {
      a.speed = clamp(a.speed + 3, 40, 99);
      notes.push({ good: true, text: `Low ${h}cm centre of gravity aids Agility & Speed.` });
      if (a.heading >= 86) { a.heading = clamp(a.heading - 5, 40, 99); notes.push({ good: false, text: "Too short to dominate aerially (−Heading)." }); }
    } else {
      notes.push({ good: true, text: "Well-proportioned frame — no physical penalties." });
    }
    if (bmi >= 25) { a.strength = clamp(a.strength + 2, 40, 99); a.speed = clamp(a.speed - 2, 40, 99); notes.push({ good: true, text: "Powerful build adds Strength (slightly less mobile)." }); }
    // synergy bonus/penalty callouts
    if (h >= 188 && a.heading >= 85 && a.strength >= 85) notes.push({ good: true, text: "SYNERGY: classic Target Man — height + heading + strength." });
    if (h <= 174 && a.speed >= 88 && Math.max(a.leftFoot, a.rightFoot) >= 85) notes.push({ good: true, text: "SYNERGY: nimble poacher — small, fast & clinical." });
    return { attrs: a, notes };
  }

  function deriveStats(a) {
    const foot = Math.max(a.leftFoot, a.rightFoot);
    const agility = Math.round(clamp(a.speed * 0.55 + (188 - a.height) * 0.9 + 22, 30, 99));
    const balance = Math.round(clamp(a.strength * 0.4 + (186 - a.height) * 0.5 + 30, 30, 99));
    const dribbling = Math.round(clamp(a.speed * 0.4 + foot * 0.35 + agility * 0.2, 30, 99));
    return { agility, balance, dribbling, finishing: Math.round(foot * 0.7 + Math.min(a.leftFoot, a.rightFoot) * 0.3) };
  }

  function calculateStrikerRating(a) {
    const bestFoot = Math.max(a.leftFoot, a.rightFoot);
    const finishing = bestFoot * 0.7 + Math.min(a.leftFoot, a.rightFoot) * 0.3;
    const rating =
      finishing * 0.34 + a.heading * 0.16 + a.speed * 0.20 +
      a.strength * 0.12 + a.fitness * 0.10 + ((a.leftFoot + a.rightFoot) / 2) * 0.08;
    return Math.round(clamp(rating, 40, 99));
  }

  function inferPlaystyle(a) {
    if (a.heading >= 88 && a.height >= 189) return "Target Man";
    if (a.speed >= 90) return "Pace Merchant";
    if (a.strength >= 88) return "Powerhouse";
    if (Math.max(a.leftFoot, a.rightFoot) >= 92) return "Clinical Finisher";
    if (state.derived && state.derived.dribbling >= 85) return "Dribbler";
    return "Complete Forward";
  }

  function renderConfirm() {
    const a = state.attrs, dv = state.derived;
    const card = document.getElementById("confirm-card");
    const lines = [
      ["Heading", a.heading], ["Left Foot", a.leftFoot], ["Right Foot", a.rightFoot],
      ["Speed", a.speed], ["Strength", a.strength], ["Fitness", a.fitness],
      ["Height", a.height + " cm"], ["Weight", a.weight + " kg"],
      ["Agility", dv.agility], ["Balance", dv.balance], ["Dribbling", dv.dribbling],
    ];
    const rows = lines.map(([k, v]) =>
      `<div class="dna-row"><span class="dna-k">${k}</span><span class="dna-v">${v}</span></div>`).join("");
    const synHtml = state.synergyNotes.map((n) =>
      `<div class="syn-note ${n.good ? "good" : "bad"}">${n.good ? "✔" : "✖"} ${esc(n.text)}</div>`).join("");
    const acad = state.academy;
    card.innerHTML = `
      <div class="rating-hero">
        <div class="rating-num">${state.baseRating}</div>
        <div class="rating-label">STRIKER RATING</div>
        <div class="playstyle-chip">${state.playstyle}</div>
        <div class="ment-chip ${mentIsSpecial(state.mentality) ? "rare" : ""}">${state.mentality}</div>
        <div class="acad-chip">🎓 ${esc(acad.club)} · ${acad.tier} academy</div>
      </div>
      <div class="dna-table">${rows}</div>
      <div class="synergy-block"><h3>Physical Build Synergy</h3>${synHtml}</div>`;
  }

  /* ============================ CAREER START =========================== */
  function startCareer() {
    const nameInput = document.getElementById("player-name-input");
    state.player.name = (nameInput.value || "").trim() || "Your Striker";
    const tier = state.academy.tier;
    const pool = ACADEMY_STARTING_POOL[tier] || ACADEMY_STARTING_POOL.Average;
    state.club = choice(pool);
    state.clubsPlayed.add(state.club);
    ensureClubStat(state.club);
    state.season = 1;
    state.age = LEVERS.debutAge + (tier === "Strong" || tier === "World Class" ? 0 : randInt(0, 1));

    showScreen("screen-career");
    log(`🎬 ${state.player.name} begins their career at ${state.club} (${tier} academy). The chase for ${LEVERS.goalTarget} goals starts now.`, "milestone");
    renderCareerHeader();
    renderSeasonReady();
  }

  function ensureClubStat(club) {
    if (!state.clubStats[club]) state.clubStats[club] = { apps: 0, goals: 0, assists: 0, seasons: 0, titles: 0 };
  }

  /* ====================== CAREER SIMULATION ENGINE ====================== */
  function getAgeModifier(age) {
    if (age <= 20) return 0.7 + (age - 17) * 0.1;
    if (age <= 28) return 1.0 + (age - 21) * 0.0125;
    if (age <= 32) return 1.1 - (age - 28) * 0.05;
    return Math.max(0.3, 0.9 - (age - 32) * 0.15);
  }
  function agedRating() {
    let r = state.baseRating * getAgeModifier(state.age);
    if (state.age >= LEVERS.primeWindow[0] && state.age <= LEVERS.primeWindow[1]) r *= 1.04;
    // hidden mentality rating: consistent players squeeze a touch more out
    r *= 1 + (state.mentalityRating - 60) / 400;
    return r;
  }

  const TACTICAL = {
    Possession: { strongVs: ["Direct", "Route One"], weakVs: ["High Press"], atk: 1.0, mid: 1.08, chaos: 0 },
    "High Press": { strongVs: ["Possession"], weakVs: ["Counter"], atk: 1.04, def: 0.98, chaos: 6 },
    Counter: { strongVs: ["High Press"], weakVs: ["Park the Bus"], atk: 1.05, chaos: 4 },
    Direct: { strongVs: ["Park the Bus"], weakVs: ["Possession"], atk: 1.03, chaos: 4 },
    "Park the Bus": { strongVs: ["Counter"], weakVs: ["Direct"], atk: 0.9, def: 0.9, chaos: -4 },
    "Route One": { strongVs: [], weakVs: ["Possession"], atk: 1.0, chaos: 12 },
  };
  function applyTacticalMatchup(homeStyle, awayStyle) {
    const h = TACTICAL[homeStyle] || {}, a = TACTICAL[awayStyle] || {};
    let homeAtkMod = h.atk || 1, awayAtkMod = a.atk || 1;
    let homeDefMod = h.def || 1, awayDefMod = a.def || 1;
    let chaosMod = 15 + (h.chaos || 0) + (a.chaos || 0);
    if ((h.strongVs || []).includes(awayStyle)) { homeAtkMod *= 1.06; awayAtkMod *= 0.96; }
    if ((a.strongVs || []).includes(homeStyle)) { awayAtkMod *= 1.06; homeAtkMod *= 0.96; }
    return { homeAtkMod, awayAtkMod, homeDefMod, awayDefMod, chaosMod: clamp(chaosMod, 5, 30) };
  }
  function resolveDuel(attack, defence, chaosRange) {
    const diff = attack - defence;
    const baseXG = 1.3 + diff / 20;
    const chaos = randomBetween(-chaosRange, chaosRange) / 100;
    return Math.max(0.1, baseXG * (1 + chaos));
  }
  function simulateMatch(home, away, homeForm, awayForm) {
    const t = applyTacticalMatchup(home.tacticalStyle, away.tacticalStyle);
    const midDiff = home.midfield - away.midfield;
    const homeMid = 1 + midDiff / 200, awayMid = 1 - midDiff / 200;
    const mgrSwing = (home.manager - away.manager) / 300;
    let homeXG = resolveDuel(home.attack * t.homeAtkMod, away.defence * t.awayDefMod, t.chaosMod);
    let awayXG = resolveDuel(away.attack * t.awayAtkMod, home.defence * t.homeDefMod, t.chaosMod);
    homeXG *= homeMid; awayXG *= awayMid;
    homeXG += mgrSwing + (home.homeAdvantage || 0) / 100;
    awayXG -= mgrSwing;
    homeXG *= 1 + (homeForm || 0) / 100;
    awayXG *= 1 + (awayForm || 0) / 100;
    homeXG = Math.max(0.1, homeXG); awayXG = Math.max(0.1, awayXG);
    return { homeGoals: poissonRandom(homeXG), awayGoals: poissonRandom(awayXG) };
  }

  function getTacticalFitMultiplier(playstyle, teamStyle) {
    const fit = {
      "Target Man": { Direct: 1.25, "Route One": 1.2, "Park the Bus": 0.85, Possession: 0.95 },
      "Pace Merchant": { Counter: 1.25, "High Press": 1.15, Direct: 1.1, "Park the Bus": 0.85 },
      Powerhouse: { Direct: 1.15, "Route One": 1.15, Counter: 1.05 },
      "Clinical Finisher": { Possession: 1.2, "High Press": 1.1, Counter: 1.1 },
      Dribbler: { Possession: 1.15, Counter: 1.15, "High Press": 1.05 },
      "Complete Forward": { Possession: 1.1, Counter: 1.1, Direct: 1.05 },
    };
    return (fit[playstyle] && fit[playstyle][teamStyle]) || 1.0;
  }
  function getRoleMultiplier(role) {
    return { Star: 1.25, Starter: 1.0, Rotation: 0.7, Bench: 0.4 }[role] || 0.8;
  }
  function determineRole() {
    const r = agedRating();
    const teamAtk = TEAM_DATABASE[state.club].attack;
    const gap = r - teamAtk;
    if (state.age <= 19 && state.academyTier !== "World Class" && state.academyTier !== "Strong")
      return gap > 6 ? "Starter" : "Rotation";
    if (gap >= 6) return "Star";
    if (gap >= -3) return "Starter";
    if (gap >= -10) return "Rotation";
    return "Bench";
  }
  function formModifier() {
    let f = 0;
    if (state.flags.inForm) f += 8;
    if (state.flags.coldStreak) f -= 6;
    if (state.flags.redemptionArc) f += 4;
    return f;
  }

  function newTable() {
    const t = {};
    LEAGUE_CLUBS.forEach((c) => (t[c] = { team: c, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 }));
    return t;
  }
  function recordResult(row, gf, ga) {
    row.P++; row.GF += gf; row.GA += ga;
    if (gf > ga) { row.W++; row.Pts += 3; } else if (gf === ga) { row.D++; row.Pts++; } else row.L++;
  }
  function sortedTable(table) {
    return Object.values(table).sort((a, b) =>
      b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA) || b.GF - a.GF || a.team.localeCompare(b.team));
  }

  function simulateSeason() {
    const club = state.club;
    ensureClubStat(club);
    state.role = determineRole();
    const threat = agedRating();
    const clubData = TEAM_DATABASE[club];
    const table = newTable();
    const fm = formModifier();
    const fitMult = getTacticalFitMultiplier(state.playstyle, clubData.tacticalStyle);
    const roleMult = getRoleMultiplier(state.role);
    const appearanceChance = { Star: 0.97, Starter: 0.9, Rotation: 0.6, Bench: 0.3 }[state.role] || 0.7;
    const mentClutch = mentTag(state.mentality);
    const clutchBonus = ["clutch", "winner", "talisman"].includes(mentClutch) ? state.mentalityRating / 100 : 0;

    // injuries
    const fitness = state.attrs.fitness;
    let gamesMissed = randInt(LEVERS.injuryFreqMin, LEVERS.injuryFreqMax) +
      (state.injuryProneSeasons > 0 ? randInt(2, 6) : 0) + (state.age >= 32 ? randInt(1, 4) : 0);
    if (fitness >= 90) gamesMissed = Math.max(0, gamesMissed - 2);
    if (["workrate"].includes(mentClutch)) gamesMissed = Math.max(0, gamesMissed - 1);
    gamesMissed = clamp(gamesMissed, 0, 30);

    let leagueGoals = 0, assists = 0, apps = 0, cleanSheets = 0, playerMatch = 0;

    for (const h of LEAGUE_CLUBS) {
      for (const a of LEAGUE_CLUBS) {
        if (h === a) continue;
        const home = TEAM_DATABASE[h], away = TEAM_DATABASE[a];
        const involves = h === club || a === club;
        const hForm = h === club ? fm * 0.2 : 0, aForm = a === club ? fm * 0.2 : 0;
        const res = simulateMatch(home, away, hForm, aForm);
        recordResult(table[h], res.homeGoals, res.awayGoals);
        recordResult(table[a], res.awayGoals, res.homeGoals);
        if (!involves) continue;
        playerMatch++;
        const myGoals = h === club ? res.homeGoals : res.awayGoals;
        const oppGoals = h === club ? res.awayGoals : res.homeGoals;
        const playing = playerMatch > gamesMissed && rand() < appearanceChance;
        if (!playing) continue;
        apps++;
        if (oppGoals === 0) cleanSheets++;
        const teammateThreat = clubData.attack * 2.5;
        let share = threat / (threat + teammateThreat);
        share *= fitMult * roleMult * (1 + fm / 100) * (1 + clutchBonus * 0.15);
        share = clamp(share, 0.05, 0.8);
        const mine = poissonRandom(myGoals * share * LEVERS.conversionMultiplier);
        leagueGoals += mine;
        if (myGoals - mine > 0 && rand() < 0.35) assists += poissonRandom((myGoals - mine) * 0.25);
      }
    }

    // cup + european goals (all comps count toward 1000)
    const compFactor = { Elite: 0.5, Europe: 0.36, Mid: 0.18, Lower: 0.08 }[clubData.league] || 0.15;
    const cupEuroGoals = poissonRandom(leagueGoals * compFactor);
    const cupApps = Math.round(cupEuroGoals * 1.3) + (apps > 0 ? randInt(2, 6) : 0);
    const seasonGoals = leagueGoals + cupEuroGoals;
    apps += cupApps;

    // cards
    let yellow = poissonRandom(apps * 0.14);
    let red = rand() < (mentClutch === "aggressive" || mentClutch === "negative" ? 0.09 : 0.03) ? 1 : 0;
    if (mentClutch === "aggressive" || mentClutch === "negative") yellow += poissonRandom(2);

    // finalize table
    const sorted = sortedTable(table);
    const pos = sorted.findIndex((r) => r.team === club) + 1;
    const champion = sorted[0].team;
    const trajectory = trajectoryFromPos(pos);
    state.leagueTable = sorted;

    // season rating (influenced by hidden mentality consistency)
    const mentVar = mentClutch === "volatile" ? randomBetween(-0.6, 0.6) : 0;
    const seasonRating = round1(clamp(6.0 + (seasonGoals / Math.max(apps, 1)) * 4.2 +
      (state.role === "Star" ? 0.4 : 0) + (state.mentalityRating - 60) / 120 + mentVar, 5.3, 9.9));
    state.bestRating = Math.max(state.bestRating, seasonRating);
    const perfTier = performanceTier(seasonGoals, apps, state.role);
    state.lastPerformanceTier = perfTier;

    // ----- honours & awards -----
    const honoursThisSeason = [];
    if (champion === club) {
      state.honours.leagueTitles++; state.clubStats[club].titles++;
      honoursThisSeason.push("League Title");
      state.competitionHistory.push({ season: state.season, club, text: `🏆 League champions with ${club}` });
    }
    // domestic cup (weighted by strength)
    const cupWinner = weightedRandomPick(LEAGUE_CLUBS.map((c) => {
      const t = TEAM_DATABASE[c];
      return { item: c, weight: t.attack + t.defence + t.midfield + t.manager };
    }));
    if (cupWinner === club && rand() < 0.6) {
      state.honours.domesticCups++;
      honoursThisSeason.push("Domestic Cup");
      state.competitionHistory.push({ season: state.season, club, text: `🥇 Won the domestic cup with ${club}` });
    }
    // european trophy (only for top-4 qualifiers, strong teams)
    if (pos <= 4 && clubData.league === "Elite") {
      const euroField = sorted.slice(0, 6).map((r) => ({ item: r.team, weight: TEAM_DATABASE[r.team].attack + TEAM_DATABASE[r.team].defence }));
      const euroWinner = weightedRandomPick(euroField);
      if (euroWinner === club && rand() < 0.5) {
        state.honours.europeanCups++;
        honoursThisSeason.push("European Cup");
        state.competitionHistory.push({ season: state.season, club, text: `🌍 European champions with ${club}!` });
      }
    }
    // individual awards
    const awards = [];
    const bestAttack = Math.max(...LEAGUE_CLUBS.map((c) => TEAM_DATABASE[c].attack));
    const rivalTop = clamp(randInt(19, 26) + Math.round((bestAttack - 84) / 3), 15, 40);
    const isTopScorer = leagueGoals >= rivalTop && leagueGoals >= 16;
    if (isTopScorer) { state.honours.goldenBoots++; awards.push("Golden Boot"); }
    const potsScore = seasonRating * 10 + (champion === club ? 15 : 0) + (isTopScorer ? 15 : 0) + seasonGoals * 0.4 + state.reputation * 0.1;
    if (potsScore >= 128 && (perfTier === "Sensational" || perfTier === "Overperformed")) {
      state.honours.playerOfSeason++; awards.push("Player of the Season");
    }
    if (state.reputation >= 80 && (champion === club || honoursThisSeason.includes("European Cup")) &&
        (isTopScorer || seasonRating >= 8.3) && perfTier === "Sensational") {
      state.honours.ballonDors++; awards.push("Ballon d'Or");
    }
    if (state.age <= 21 && (seasonGoals >= 14 || perfTier === "Sensational" || perfTier === "Overperformed")) {
      state.honours.youngPlayer++; awards.push("Young Player of the Year");
    }
    if (perfTier === "Sensational" || perfTier === "Overperformed" || seasonRating >= 8.0) {
      state.honours.tots++; awards.push("Team of the Season");
    }

    // totals
    state.totalGoals += seasonGoals;
    state.leagueGoals += leagueGoals;
    state.totalApps += apps;
    state.totalAssists += assists;
    state.totalYellow += yellow;
    state.totalRed += red;
    state.teamCleanSheets += cleanSheets;
    const cs = state.clubStats[club];
    cs.apps += apps; cs.goals += seasonGoals; cs.assists += assists; cs.seasons++;

    // reputation drift
    let repDelta = { Sensational: 12, Overperformed: 7, "Met Expectation": 2, Underperformed: -3, Flop: -7 }[perfTier];
    if (champion === club) repDelta += 4;
    if (awards.includes("Ballon d'Or")) repDelta += 6;
    adjustReputation(repDelta);

    const seasonData = {
      season: state.season, age: state.age, club, role: state.role,
      goals: seasonGoals, leagueGoals, assists, apps, rating: seasonRating,
      yellow, red, cleanSheets, pos, trajectory, perfTier, gamesMissed,
      champion, honours: honoursThisSeason, awards, isTopScorer,
    };
    state.seasonHistory.push(seasonData);
    return seasonData;
  }

  function trajectoryFromPos(pos) {
    if (pos === 1) return "Title";
    if (pos <= 6) return "Europe";
    if (pos <= 14) return "Mid-table";
    if (pos <= 17) return "Battled Relegation";
    return "Relegated";
  }
  function performanceTier(goals, apps, role) {
    const per = goals / Math.max(apps, 1);
    if (goals >= 30 || per >= 0.95) return "Sensational";
    if (goals >= 20 || per >= 0.7) return "Overperformed";
    if (goals >= 12 || per >= 0.45) return "Met Expectation";
    if (goals >= 6) return "Underperformed";
    return "Flop";
  }
  function ageBracket(age) {
    if (age <= 20) return "Wonderkid";
    if (age <= 24) return "Rising";
    if (age <= 29) return "Prime";
    if (age <= 33) return "Veteran";
    return "Twilight";
  }
  function reputationTier(rep) {
    if (rep >= 90) return "Icon";
    if (rep >= 75) return "Superstar";
    if (rep >= 55) return "Star";
    if (rep >= 35) return "Squad Player";
    return "Unknown";
  }
  function adjustReputation(delta) {
    state.reputation = clamp(state.reputation + delta, 0, 100);
    state.reputationTier = reputationTier(state.reputation);
  }

  /* ---------------------- INTERNATIONAL CAREER -------------------------- */
  function simulateInternational() {
    if (!state.intlDebut && state.reputation >= 45) {
      state.intlDebut = true;
      log(`🦁 ${state.player.name} earns a first England call-up!`, "intl");
    }
    if (!state.intlDebut) return null;
    const isTournament = state.season % 2 === 0;
    const games = isTournament ? randInt(5, 7) : randInt(4, 6);
    let g = 0;
    for (let i = 0; i < games; i++) {
      const opp = { attack: randInt(72, 88), midfield: randInt(72, 86), defence: randInt(72, 88), manager: randInt(74, 86), tacticalStyle: choice(["Possession", "Counter", "High Press", "Direct"]), homeAdvantage: 4 };
      const res = simulateMatch(NATIONAL_TEAM, opp, 0, 0);
      const teammateThreat = NATIONAL_TEAM.attack * 3;
      const share = clamp(agedRating() / (agedRating() + teammateThreat), 0.05, 0.6);
      g += poissonRandom(res.homeGoals * share);
    }
    state.intlCaps += games;
    state.intlGoals += g;
    state.totalGoals += g;
    let wonTrophy = false;
    if (isTournament && (g >= 3 || rand() < 0.15) && state.reputation >= 60) {
      wonTrophy = true;
      state.honours.intlTrophies++;
      state.competitionHistory.push({ season: state.season, club: "England", text: `🦁 Won an international tournament with England (${g} goals)` });
      adjustReputation(8);
      log(`🏆 Tournament glory! ${state.player.name} lifts silverware with England (${g} goals).`, "intl");
    }
    return { games, goals: g, isTournament, wonTrophy };
  }

  /* ------------------------- DECISION ENGINE ---------------------------- */
  const EVENTS = [
    { id: "breakout", category: "PERFORMANCE", base: 6, req: { perf: ["Overperformed", "Sensational"], ageMax: 24 },
      text: (n) => `${n} explodes onto the scene with a breakout season. The hype is real.`,
      choices: [{ label: "Stay humble, keep working", fx: { rep: 4, flag: "fanFavorite" } }, { label: "Embrace the spotlight", fx: { rep: 8, flag: "mediaTarget" } }] },
    { id: "golden_boot_race", category: "PERFORMANCE", base: 5, req: { perf: ["Sensational"] },
      text: (n) => `Final day and ${n} is in a three-way Golden Boot race!`,
      choices: [{ label: "Go for glory — shoot on sight", fx: { rep: 6, goals: () => randInt(1, 3), flag: "inForm" } }, { label: "Play for the team", fx: { rep: 3, assists: () => randInt(1, 3) } }] },
    { id: "bench_frustration", category: "PERFORMANCE", base: 6, req: { perf: ["Underperformed", "Flop"], roleIn: ["Rotation", "Bench"] },
      text: (n) => `${n} is frustrated after another spell on the bench.`,
      choices: [{ label: "Talk with the manager", fx: { rep: 1, flag: "managerConflict" } }, { label: "Stay patient, train harder", fx: { rep: 2, flag: "redemptionArc" } }, { label: "Ask to leave", fx: { forceTransfer: true } }] },
    { id: "scapegoat", category: "PERFORMANCE", base: 5, req: { traj: ["Relegated", "Battled Relegation"], perf: ["Flop", "Underperformed"] },
      text: (n) => `The fans need someone to blame, and ${n} is in the crosshairs.`,
      choices: [{ label: "Take responsibility publicly", fx: { rep: -2, flag: "fanFavorite" } }, { label: "Blame teammates", fx: { rep: -6, flag: "burnedBridges" } }, { label: "Go quiet", fx: { rep: -3 } }] },
    // trajectory
    { id: "title_winner", category: "TRAJECTORY", base: 8, req: { traj: ["Title"] },
      text: (n) => `CHAMPIONS! ${n}'s club is crowned league winners.`,
      choices: [{ label: "Stay and defend the title", fx: { rep: 6, flag: "fanFavorite" } }, { label: "Use it as a platform to leave", fx: { rep: 4, forceTransfer: true } }] },
    { id: "cup_final", category: "TRAJECTORY", base: 6, req: { traj: ["Title", "Europe"] },
      text: (n) => `${n}'s side reaches a major cup final. Ninety minutes from glory.`,
      choices: [{ label: "Step up in the big moment", fx: { rep: 7, goals: () => randInt(1, 2), flag: "inForm" } }, { label: "Let the team carry it", fx: { rep: 3 } }] },
    { id: "relegated", category: "TRAJECTORY", base: 7, req: { traj: ["Relegated"] },
      text: (n) => `Heartbreak. ${n}'s club is relegated.`,
      choices: [{ label: "Stay and fight back up", fx: { rep: 2, flag: "fanFavorite" } }, { label: "Force an exit to a bigger club", fx: { rep: -2, forceTransfer: true } }] },
    { id: "manager_sacked", category: "TRAJECTORY", base: 4, req: { traj: ["Mid-table", "Battled Relegation", "Relegated"] },
      text: () => `The manager is sacked. A new boss arrives with a completely different system.`,
      choices: [{ label: "Adapt to the new tactics", fx: { rep: 2 } }, { label: "Clash with the new philosophy", fx: { flag: "managerConflict" } }] },
    // MENTALITY — driven by trait tags + hidden rating
    { id: "captain_armband", category: "MENTALITY", base: 7, req: { mentTag: ["leader"], yearsMin: 3 },
      text: (n) => `After years of service, ${n} is handed the captain's armband.`,
      choices: [{ label: "Lead from the front", fx: { rep: 6, flag: "fanFavorite" } }] },
    { id: "clutch_moment", category: "MENTALITY", base: 7, req: { mentTag: ["clutch", "winner", "talisman"], traj: ["Title", "Europe"] },
      text: (n) => `Penalty shootout. The stadium holds its breath as ${n} steps up.`,
      choices: [{ label: "Ice in the veins — bury it", fx: { rep: 6, goals: () => 1, flag: "inForm" } }] },
    { id: "maverick_viral", category: "MENTALITY", base: 6, req: { mentTraits: ["Maverick", "Mercurial"] },
      text: (n) => `An outrageous piece of skill from ${n} goes viral worldwide.`,
      choices: [{ label: "Milk the fame", fx: { rep: 7, flag: "mediaTarget" } }, { label: "Stay focused on football", fx: { rep: 3, flag: "inForm" } }] },
    { id: "temper_bustup", category: "MENTALITY", base: 6, req: { mentTag: ["negative", "volatile", "aggressive"], mentRatingMax: 60 },
      text: (n) => `A training-ground bust-up: ${n} squares up to a teammate after a poor result.`,
      choices: [{ label: "Apologise publicly", fx: { rep: 1, flag: "redemptionArc" } }, { label: "Demand a transfer", fx: { rep: -5, forceTransfer: true, flag: "burnedBridges" } }, { label: "Let your agent handle it", fx: { flag: "unsettled" } }] },
    { id: "relentless_ironman", category: "MENTALITY", base: 5, req: { mentTag: ["workrate", "consistency"] },
      text: (n) => `${n}'s relentless work ethic sees them play almost every minute.`,
      choices: [{ label: "Durability reputation grows", fx: { rep: 3 } }] },
    { id: "loyalty_test", category: "MENTALITY", base: 5, req: { mentTag: ["leader", "consistency"], repMin: 55 },
      text: (n) => `A huge offer arrives, but the club wants ${n} to sign a loyalty extension.`,
      choices: [{ label: "Sign for life", fx: { rep: 5, flag: "fanFavorite" } }, { label: "Chase the money", fx: { rep: -2, forceTransfer: true } }] },
    // injury / media
    { id: "serious_injury", category: "INJURY", base: 3, req: { ageMin: 29 },
      text: (n) => `Disaster — ${n} suffers a serious knee injury.`,
      choices: [{ label: "Begin the long road back", fx: { rep: -2, flag: "injuryProne", injuryProne: 2 } }] },
    { id: "sponsorship", category: "MEDIA", base: 4, req: { repMin: 55 },
      text: (n) => `A major boot brand offers ${n} a lucrative sponsorship deal.`,
      choices: [{ label: "Sign the deal", fx: { rep: 2 } }] },
    { id: "ballon_shortlist", category: "MEDIA", base: 4, req: { perf: ["Sensational"], repMin: 75 },
      text: (n) => `${n} is shortlisted for the Ballon d'Or!`,
      choices: [{ label: "An incredible honour", fx: { rep: 6, flag: "inForm" } }] },
    { id: "pundit_criticism", category: "MEDIA", base: 4, req: { perf: ["Underperformed", "Flop"], repMin: 55 },
      text: (n) => `Pundits queue up to criticise ${n} after a poor run.`,
      choices: [{ label: "Respond with a classy interview", fx: { rep: 2 } }, { label: "Hit back at the critics", fx: { rep: -2, flag: "mediaTarget" } }] },
  ];

  const FLAG_DEFAULT_DURATION = 2;

  function buildContext(sd) {
    return {
      mentality: state.mentality, mentTag: mentTag(state.mentality), mentRating: state.mentalityRating,
      academyTier: state.academyTier, perf: sd.perfTier, traj: sd.trajectory,
      ageBracket: ageBracket(state.age), age: state.age, yearsAtClub: state.yearsAtClub,
      repTier: state.reputationTier, rep: state.reputation, role: state.role,
      season: state.season, flags: state.flags,
    };
  }
  function meetsHardRequirements(ev, ctx) {
    const r = ev.req || {};
    if (r.mentTag && !r.mentTag.includes(ctx.mentTag)) return false;
    if (r.mentTraits && !r.mentTraits.includes(ctx.mentality)) return false;
    if (r.mentRatingMax != null && ctx.mentRating > r.mentRatingMax) return false;
    if (r.mentRatingMin != null && ctx.mentRating < r.mentRatingMin) return false;
    if (r.perf && !r.perf.includes(ctx.perf)) return false;
    if (r.traj && !r.traj.includes(ctx.traj)) return false;
    if (r.roleIn && !r.roleIn.includes(ctx.role)) return false;
    if (r.ageMax != null && ctx.age > r.ageMax) return false;
    if (r.ageMin != null && ctx.age < r.ageMin) return false;
    if (r.yearsMin != null && ctx.yearsAtClub < r.yearsMin) return false;
    if (r.repMin != null && ctx.rep < r.repMin) return false;
    if (r.seasonMax != null && ctx.season > r.seasonMax) return false;
    return true;
  }
  function getEventWeight(ev, ctx) {
    if (!meetsHardRequirements(ev, ctx)) return 0;
    if (state.cooldowns[ev.id] > 0) return 0;
    let w = ev.base;
    if (ctx.flags.mediaTarget && ev.category === "MEDIA") w += 4;
    if (ctx.flags.managerConflict && ev.id === "manager_sacked") w += 6;
    if (ctx.flags.injuryProne && ev.category === "INJURY") w += 6;
    return Math.max(0, w);
  }

  const MILESTONES = [
    { goals: 100, title: "Local Hero" }, { goals: 250, title: "Club Legend" },
    { goals: 500, title: "Generational Talent" }, { goals: 750, title: "All-Time Great" },
    { goals: 1000, title: "Football God" },
  ];
  function checkMilestoneInterrupt() {
    for (const m of MILESTONES) {
      if (state.totalGoals >= m.goals && !state.milestonesHit[m.goals]) {
        state.milestonesHit[m.goals] = true;
        return { id: "milestone_" + m.goals, milestone: true, category: "MILESTONE",
          text: () => `🏅 MILESTONE: ${state.totalGoals} career goals — "${m.title}"!`,
          choices: [{ label: "Onwards", fx: { rep: m.goals >= 500 ? 6 : 3 } }] };
      }
    }
    return null;
  }
  function pickSeasonEvent(ctx) {
    const milestone = checkMilestoneInterrupt();
    if (milestone) return milestone;
    const eligible = EVENTS.map((e) => ({ item: e, weight: getEventWeight(e, ctx) })).filter((e) => e.weight > 0);
    if (!eligible.length) return null;
    return weightedRandomPick(eligible);
  }

  function applyEffects(fx) {
    if (!fx) return;
    if (fx.rep) adjustReputation(fx.rep);
    if (fx.goals) { const g = typeof fx.goals === "function" ? fx.goals() : fx.goals; state.totalGoals += g; if (state.seasonHistory.length) state.seasonHistory[state.seasonHistory.length - 1].goals += g; }
    if (fx.assists) { const a = typeof fx.assists === "function" ? fx.assists() : fx.assists; state.totalAssists += a; }
    if (fx.flag) setFlag(fx.flag, FLAG_DEFAULT_DURATION);
    if (fx.injuryProne) state.injuryProneSeasons = Math.max(state.injuryProneSeasons, fx.injuryProne);
    if (fx.ratingBoost) state.baseRating = clamp(state.baseRating + fx.ratingBoost, 40, 99);
    if (fx.forceTransfer) state.pendingTransfer = true;
  }
  function setFlag(name, dur) { state.flags[name] = dur; }
  function decayFlags() {
    for (const k of Object.keys(state.flags)) { state.flags[k]--; if (state.flags[k] <= 0) delete state.flags[k]; }
    for (const k of Object.keys(state.cooldowns)) { state.cooldowns[k]--; if (state.cooldowns[k] <= 0) delete state.cooldowns[k]; }
  }

  /* --------------------------- TRANSFERS -------------------------------- */
  function generateOffers() {
    const tierByRep = state.reputation >= 80 ? ["Elite", "Europe"] :
      state.reputation >= 60 ? ["Elite", "Europe", "Mid"] :
      state.reputation >= 40 ? ["Europe", "Mid"] : ["Mid", "Lower"];
    const pool = LEAGUE_CLUBS.filter((t) => t !== state.club && tierByRep.includes(TEAM_DATABASE[t].league));
    const n = clamp(randInt(1, 3), 1, pool.length);
    const offers = [], used = new Set();
    while (offers.length < n && offers.length < pool.length) {
      const c = choice(pool);
      if (used.has(c)) continue;
      used.add(c); offers.push(c);
    }
    return offers;
  }

  /* ------------------------------ SEASON FLOW --------------------------- */
  function renderCareerHeader() {
    document.getElementById("career-season").textContent = `SEASON ${state.season}`;
    document.getElementById("hdr-age").textContent = state.age;
    document.getElementById("hdr-goals").textContent = state.totalGoals;
    document.getElementById("hdr-club").textContent = state.club;
    document.getElementById("hdr-rep").textContent = `${state.reputationTier} (${state.reputation})`;
    const pct = clamp((state.totalGoals / LEVERS.goalTarget) * 100, 0, 100);
    document.getElementById("goal-progress-fill").style.width = pct + "%";
    document.getElementById("goal-progress-label").textContent = `${state.totalGoals} / ${LEVERS.goalTarget} career goals`;
  }

  function renderSeasonReady() {
    const box = document.getElementById("season-action");
    box.innerHTML = `
      <div class="season-prompt">Age ${state.age} · ${state.club} · projected role: <strong>${determineRole()}</strong> · ${ageBracket(state.age)}</div>
      <button class="btn primary big" id="btn-play-season">▶ PLAY SEASON ${state.season}</button>`;
    document.getElementById("btn-play-season").addEventListener("click", playSeason);
  }

  function playSeason() {
    document.getElementById("season-action").innerHTML = `<div class="simming">Simulating season ${state.season}…</div>`;
    setTimeout(() => {
      const sd = simulateSeason();
      const intl = simulateInternational();
      renderSeasonResult(sd, intl);
      renderCareerHeader();
      let line = `S${state.season} (age ${state.age}) — ${state.club}: ${sd.goals}g ${sd.assists}a in ${sd.apps} apps (${sd.rating}). ${ordinal(sd.pos)} [${sd.trajectory}]. ${sd.role}.`;
      if (sd.honours.length) line += ` 🏆 ${sd.honours.join(", ")}.`;
      if (sd.awards.length) line += ` 🎖 ${sd.awards.join(", ")}.`;
      if (intl && intl.goals) line += ` 🦁 +${intl.goals} for England.`;
      log(line, perfClass(sd.perfTier));

      const ev = pickSeasonEvent(buildContext(sd));
      if (ev) presentDecision(ev, sd, intl); else proceedToTransfer(sd, intl);
    }, 400);
  }

  function renderSeasonResult(sd, intl) {
    const box = document.getElementById("season-result");
    const intlHtml = intl ? `<div class="stat-box"><div class="sb-num">${intl.goals}</div><div class="sb-lab">England</div></div>` : "";
    const honoursHtml = (sd.honours.length || sd.awards.length)
      ? `<div class="season-honours">${sd.honours.map((h) => `<span class="hon-badge title">🏆 ${h}</span>`).join("")}${sd.awards.map((a) => `<span class="hon-badge award">🎖 ${a}</span>`).join("")}</div>` : "";
    box.innerHTML = `
      <div class="result-banner ${perfClass(sd.perfTier)}">${sd.perfTier} season — finished ${ordinal(sd.pos)} (${sd.trajectory})${sd.champion === state.club ? " 🏆" : ""}</div>
      ${honoursHtml}
      <div class="stat-grid">
        <div class="stat-box"><div class="sb-num">${sd.goals}</div><div class="sb-lab">Goals</div></div>
        <div class="stat-box"><div class="sb-num">${sd.assists}</div><div class="sb-lab">Assists</div></div>
        <div class="stat-box"><div class="sb-num">${sd.apps}</div><div class="sb-lab">Apps</div></div>
        <div class="stat-box"><div class="sb-num">${sd.rating}</div><div class="sb-lab">Avg Rating</div></div>
        <div class="stat-box"><div class="sb-num">${sd.yellow}/${sd.red}</div><div class="sb-lab">Yel/Red</div></div>
        ${intlHtml}
      </div>
      ${renderLeagueTable(sd)}`;
  }

  function renderLeagueTable(sd) {
    if (!state.leagueTable) return "";
    const rows = state.leagueTable.map((r, i) => {
      const gd = r.GF - r.GA;
      const zone = i === 0 ? "champ" : i <= 3 ? "ucl" : i <= 5 ? "uel" : i >= 17 ? "releg" : "";
      const mine = r.team === state.club ? "mine" : "";
      return `<tr class="${zone} ${mine}"><td>${i + 1}</td><td class="lt-team">${esc(r.team)}</td><td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}</td><td>${r.GA}</td><td>${gd > 0 ? "+" : ""}${gd}</td><td class="lt-pts">${r.Pts}</td></tr>`;
    }).join("");
    return `
      <details class="league-details"><summary>Final League Table — ${ordinal(sd.pos)}</summary>
      <table class="league-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody></table></details>`;
  }

  function presentDecision(ev, sd, intl) {
    const box = document.getElementById("season-action");
    const name = state.player.name;
    const text = typeof ev.text === "function" ? ev.text(name) : ev.text;
    state.cooldowns[ev.id] = ev.cooldown || 3;
    const choicesHtml = ev.choices.map((c, i) => `<button class="btn choice" data-i="${i}">${c.label}</button>`).join("");
    box.innerHTML = `
      <div class="decision ${ev.milestone ? "milestone-event" : ""}">
        <div class="decision-tag">${ev.milestone ? "MILESTONE" : ev.category} EVENT</div>
        <div class="decision-text">${text}</div>
        <div class="decision-choices">${choicesHtml}</div>
      </div>`;
    box.querySelectorAll(".choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = ev.choices[parseInt(btn.dataset.i, 10)];
        applyEffects(c.fx);
        log(`   ↳ ${ev.milestone ? "🏅" : "🗲"} ${text.replace(/\.$/, "")} → "${c.label}"`, "decision");
        renderCareerHeader();
        proceedToTransfer(sd, intl);
      });
    });
  }

  function proceedToTransfer(sd, intl) {
    if (state.totalGoals >= LEVERS.goalTarget) { beginRetirement("goal"); return; }
    state.yearsAtClub++;
    const wantsMove = state.pendingTransfer ||
      (mentTag(state.mentality) === "winner" && state.age >= 24 && state.age <= 27 && TEAM_DATABASE[state.club].league !== "Elite") ||
      (state.reputation >= 70 && TEAM_DATABASE[state.club].league === "Lower") ||
      (rand() < 0.18 && state.yearsAtClub >= 3);
    const loyalStay = (mentTag(state.mentality) === "leader" || mentTag(state.mentality) === "consistency") && rand() < 0.6;
    if (wantsMove && !(loyalStay && !state.pendingTransfer)) presentTransfer(generateOffers(), sd, intl);
    else advanceToNextSeason();
  }

  function presentTransfer(offers, sd, intl) {
    const box = document.getElementById("season-action");
    const cards = offers.map((o, i) => {
      const t = TEAM_DATABASE[o];
      return `<button class="btn offer" data-i="${i}"><div class="offer-club">${o}</div><div class="offer-meta">${t.league} · ATK ${t.attack} MID ${t.midfield} DEF ${t.defence} · ${t.tacticalStyle}</div></button>`;
    }).join("");
    box.innerHTML = `
      <div class="transfer">
        <div class="decision-tag">TRANSFER WINDOW</div>
        <div class="decision-text">Offers are on the table${state.pendingTransfer ? " — and you've pushed to leave." : "."} Where next?</div>
        <div class="offers">${cards}</div>
        <button class="btn ghost" id="btn-stay">Stay at ${state.club}</button>
      </div>`;
    box.querySelectorAll(".offer").forEach((btn) => {
      btn.addEventListener("click", () => { moveToClub(offers[parseInt(btn.dataset.i, 10)]); advanceToNextSeason(); });
    });
    document.getElementById("btn-stay").addEventListener("click", () => {
      state.pendingTransfer = false;
      log(`   ↳ ✋ ${state.player.name} snubs the offers and stays at ${state.club}.`, "decision");
      advanceToNextSeason();
    });
  }

  function moveToClub(club) {
    log(`   ↳ ✈️ Transfer: ${state.player.name} joins ${club} (${TEAM_DATABASE[club].league}).`, "transfer");
    state.club = club; state.clubsPlayed.add(club); ensureClubStat(club);
    state.yearsAtClub = 0; state.pendingTransfer = false;
  }

  function advanceToNextSeason() {
    decayFlags();
    if (state.injuryProneSeasons > 0) state.injuryProneSeasons--;
    if (state.finalSeasonForced) { beginRetirement("planned"); return; }
    state.age++; state.season++;
    const retireChance = state.age >= 39 ? 1 : state.age >= 36 ? 0.5 + (state.age - 36) * 0.15 : state.age >= 34 ? 0.2 : 0;
    if (rand() < retireChance) { beginRetirement("age"); return; }
    renderCareerHeader();
    document.getElementById("season-result").innerHTML = "";
    renderSeasonReady();
  }

  /* --------------------- END-OF-CAREER EVENTS --------------------------- */
  const END_EVENTS = [
    { id: "immediate_retire", base: 6, text: (n) => `${n} calls time on a storied career, hanging up the boots for good.`,
      choices: [{ label: "Retire a legend", fx: {} }] },
    { id: "one_more_year", base: 4, req: (s) => s.age < 38, text: (n) => `${n} isn't ready to stop — there's one more season in those legs.`,
      choices: [{ label: "Play one final season", fx: { extend: true } }, { label: "Retire now instead", fx: {} }] },
    { id: "return_home", base: 4, req: (s) => s.clubsPlayed.size > 1, text: (n) => `${n} is offered a fairytale return to a former club for a farewell season.`,
      choices: [{ label: "Go back for one last dance", fx: { returnHome: true } }, { label: "Retire where you are", fx: {} }] },
    { id: "become_manager", base: 3, req: (s) => mentTag(s.mentality) === "leader" || s.honours.leagueTitles > 0, text: (n) => `${n} moves straight into the dugout, beginning a management career.`,
      choices: [{ label: "Take the manager's job", fx: { epilogue: "manager" } }] },
    { id: "become_pundit", base: 3, req: (s) => s.reputation >= 60, text: (n) => `${n} is snapped up by a broadcaster as a star pundit.`,
      choices: [{ label: "Head to the studio", fx: { epilogue: "pundit" } }] },
    { id: "final_trophy", base: 4, req: (s) => s.reputation >= 55, text: (n) => `In a storybook finish, ${n} lifts one final trophy before retiring.`,
      choices: [{ label: "The perfect send-off", fx: { trophy: true } }] },
    { id: "career_ending_injury", base: 3, req: (s) => s.injuryProneSeasons > 0 || s.age >= 34, text: (n) => `A cruel injury forces ${n} into an early, unwanted retirement.`,
      choices: [{ label: "Bow out with head held high", fx: { rep: -1 } }] },
    { id: "testimonial", base: 4, req: (s) => s.honours.leagueTitles > 0 || s.reputation >= 70, text: (n) => `A packed stadium turns out for ${n}'s legendary testimonial match.`,
      choices: [{ label: "Soak up the adoration", fx: { rep: 2 } }] },
  ];

  function beginRetirement(reason) {
    state.endCareerReason = reason;
    // reached the 1000-goal target -> celebrate straight to legacy
    if (reason === "goal" || state.totalGoals >= LEVERS.goalTarget) { endCareer(true); return; }
    const eligible = END_EVENTS.filter((e) => !e.req || e.req(state)).map((e) => ({ item: e, weight: e.base }));
    const ev = weightedRandomPick(eligible) || END_EVENTS[0];
    presentEndEvent(ev);
  }

  function presentEndEvent(ev) {
    const box = document.getElementById("season-action");
    document.getElementById("season-result").innerHTML = "";
    const text = typeof ev.text === "function" ? ev.text(state.player.name) : ev.text;
    const choicesHtml = ev.choices.map((c, i) => `<button class="btn choice" data-i="${i}">${c.label}</button>`).join("");
    box.innerHTML = `
      <div class="decision endcareer">
        <div class="decision-tag">END OF CAREER</div>
        <div class="decision-text">${text}</div>
        <div class="decision-choices">${choicesHtml}</div>
      </div>`;
    box.querySelectorAll(".choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = ev.choices[parseInt(btn.dataset.i, 10)];
        handleEndChoice(c.fx, text, c.label);
      });
    });
  }

  function handleEndChoice(fx, text, label) {
    fx = fx || {};
    log(`   ↳ 🎬 ${text.replace(/\.$/, "")} → "${label}"`, "milestone");
    if (fx.rep) adjustReputation(fx.rep);
    if (fx.trophy) {
      state.honours.domesticCups++;
      state.competitionHistory.push({ season: state.season, club: state.club, text: `🏆 Lifted a final trophy in a farewell season` });
    }
    if (fx.extend || fx.returnHome) {
      if (fx.returnHome) {
        const formers = [...state.clubsPlayed].filter((c) => c !== state.club && TEAM_DATABASE[c]);
        if (formers.length) moveToClub(choice(formers));
      }
      state.finalSeasonForced = true;
      state.age++; state.season++;
      renderCareerHeader();
      document.getElementById("season-result").innerHTML = "";
      renderSeasonReady();
      return;
    }
    if (fx.epilogue) state.epilogue = fx.epilogue;
    endCareer(false);
  }

  /* ----------------------------- LEGACY --------------------------------- */
  function endCareer(reachedGoal) {
    state.retired = true;
    showScreen("screen-legacy");
    const won = reachedGoal || state.totalGoals >= LEVERS.goalTarget;
    const statusEl = document.getElementById("legacy-status");
    statusEl.textContent = won ? "⚽ FOOTBALL GOD — 1000 GOALS!" : (state.totalGoals >= 500 ? "LEGENDARY CAREER!" : "CAREER COMPLETE");
    statusEl.className = "legacy-status " + (won ? "god" : (state.totalGoals >= 500 ? "legend" : ""));
    document.getElementById("legacy-goals").textContent = state.totalGoals;

    document.getElementById("legacy-grid").innerHTML = [
      ["Seasons", state.season], ["Clubs", state.clubsPlayed.size], ["Final Age", state.age],
      ["Apps", state.totalApps], ["Assists", state.totalAssists], ["League Goals", state.leagueGoals],
      ["Yellow/Red", `${state.totalYellow}/${state.totalRed}`],
      ["England Caps", state.intlCaps], ["England Goals", state.intlGoals],
      ["Best Rating", state.bestRating || "—"], ["Peak Rep", `${state.reputationTier}`],
    ].map(([k, v]) => `<div class="leg-box"><div class="leg-num">${v}</div><div class="leg-lab">${k}</div></div>`).join("");

    renderHonours();
    renderClubBreakdown();
    renderCompetitionHistory();
    renderEpilogue();
    renderLegacyDNA();
  }

  function renderHonours() {
    const h = state.honours;
    const items = [
      ["🏆", "League Titles", h.leagueTitles], ["🥇", "Domestic Cups", h.domesticCups],
      ["🌍", "European Cups", h.europeanCups], ["🦁", "Intl Trophies", h.intlTrophies],
      ["👟", "Golden Boots", h.goldenBoots], ["🏅", "Ballon d'Ors", h.ballonDors],
      ["⭐", "Player of the Season", h.playerOfSeason], ["🌱", "Young Player", h.youngPlayer],
      ["📋", "Team of the Season", h.tots],
    ].filter(([, , v]) => v > 0);
    const el = document.getElementById("legacy-honours");
    if (!items.length) { el.innerHTML = "<h3>Honours & Awards</h3><div class='muted'>No major honours — but a career to be proud of.</div>"; return; }
    el.innerHTML = "<h3>Honours & Awards</h3><div class='honours-grid'>" +
      items.map(([ic, k, v]) => `<div class="hon-item"><span class="hon-ic">${ic}</span><span class="hon-count">${v}×</span><span class="hon-name">${k}</span></div>`).join("") + "</div>";
  }

  function renderClubBreakdown() {
    const clubs = Object.entries(state.clubStats).filter(([, s]) => s.apps > 0)
      .sort((a, b) => b[1].goals - a[1].goals);
    const rows = clubs.map(([c, s]) =>
      `<tr><td class="lt-team">${esc(c)}</td><td>${s.seasons}</td><td>${s.apps}</td><td class="lt-pts">${s.goals}</td><td>${s.assists}</td><td>${s.titles}</td></tr>`).join("");
    document.getElementById("legacy-clubs").innerHTML = `
      <h3>Career by Club</h3>
      <table class="league-table clubs-table"><thead><tr><th>Club</th><th>Sea</th><th>Apps</th><th>Goals</th><th>Ast</th><th>🏆</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function renderCompetitionHistory() {
    const el = document.getElementById("legacy-history");
    if (!state.competitionHistory.length) { el.innerHTML = ""; return; }
    const items = state.competitionHistory.slice().reverse().map((c) =>
      `<li><span class="hist-season">S${c.season}</span> ${esc(c.text)}</li>`).join("");
    el.innerHTML = `<h3>Trophy Cabinet Timeline</h3><ul class="history-list">${items}</ul>`;
  }

  function renderEpilogue() {
    const el = document.getElementById("legacy-epilogue");
    const map = {
      manager: "🧑‍💼 After hanging up the boots, they moved into management, chasing silverware from the dugout.",
      pundit: "🎙️ They became a beloved TV pundit, dissecting the game for millions every weekend.",
    };
    const reasonMap = {
      age: "Retired gracefully with age catching up.",
      planned: "Bowed out after a planned farewell season.",
      goal: "Retired the moment the 1000-goal dream was realised.",
    };
    const parts = [];
    if (state.endCareerReason && reasonMap[state.endCareerReason]) parts.push(reasonMap[state.endCareerReason]);
    if (state.epilogue && map[state.epilogue]) parts.push(map[state.epilogue]);
    el.innerHTML = parts.length ? `<div class="epilogue">${parts.map((p) => `<div>${p}</div>`).join("")}</div>` : "";
  }

  function renderLegacyDNA() {
    const a = state.attrs;
    document.getElementById("legacy-dna").innerHTML = `
      <h3>Player DNA</h3>
      <div class="dna-summary">
        <span class="tag">${state.playstyle}</span>
        <span class="tag ${mentIsSpecial(state.mentality) ? "rare" : ""}">${state.mentality}</span>
        <span class="tag">🎓 ${esc(state.academy.club)} (${state.academy.tier})</span>
        <span class="tag">Peak ${state.baseRating}</span>
      </div>
      <div class="dna-key">
        ${dnaLine("Heading", a.heading)}${dnaLine("Left Foot", a.leftFoot)}${dnaLine("Right Foot", a.rightFoot)}
        ${dnaLine("Speed", a.speed)}${dnaLine("Strength", a.strength)}${dnaLine("Fitness", a.fitness)}
        ${dnaLine("Height", a.height + "cm")}${dnaLine("Weight", a.weight + "kg")}
      </div>`;
    function dnaLine(label, v) { return `<div class="dna-row"><span class="dna-k">${label}</span><span class="dna-v">${v}</span></div>`; }
  }

  /* ----------------------------- LOG ------------------------------------ */
  function log(text, cls) {
    state.careerLog.unshift({ text, cls });
    const wrap = document.getElementById("career-log");
    if (!wrap) return;
    const div = document.createElement("div");
    div.className = "log-entry " + (cls || "");
    div.textContent = text;
    wrap.insertBefore(div, wrap.firstChild);
  }
  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function perfClass(tier) {
    return { Sensational: "great", Overperformed: "good", "Met Expectation": "ok", Underperformed: "bad", Flop: "awful" }[tier] || "";
  }

  /* ----------------------------- WIRING --------------------------------- */
  function init() {
    document.getElementById("btn-start").addEventListener("click", startCreation);
    document.getElementById("btn-spin").addEventListener("click", spin);
    document.getElementById("btn-accept").addEventListener("click", accept);
    document.getElementById("btn-reroll").addEventListener("click", reroll);
    document.getElementById("btn-confirm-career").addEventListener("click", startCareer);
    document.querySelectorAll(".btn-play-again").forEach((b) => b.addEventListener("click", () => {
      document.getElementById("career-log").innerHTML = "";
      document.getElementById("season-result").innerHTML = "";
      showScreen("screen-welcome");
    }));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
