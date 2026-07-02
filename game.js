/* ============================================================================
 * FOOTBALL DNA SIMULATOR — GAME ENGINE
 * Build a striker from 8 different football eras, then chase 1000 goals.
 * Data lives in data.js (window.GAME_DATA).
 * ========================================================================== */
(function () {
  "use strict";

  const D = window.GAME_DATA;
  const {
    MENTALITIES,
    ACADEMY_TIERS,
    PLAYER_DATABASE,
    TEAM_DATABASE,
    ACADEMY_STARTING_POOL,
    NATIONAL_TEAM,
  } = D;

  /* --------------------------- CONFIG / LEVERS --------------------------- */
  const ROLL_CONFIG = [
    { id: 1, attribute: "heading", name: "Heading Ability", type: "numeric", desc: "Aerial threat — wins headers and attacks crosses." },
    { id: 2, attribute: "mentality", name: "Mentality", type: "mentality", desc: "A behavioural flag that drives the Decision Engine." },
    { id: 3, attribute: "body", name: "Fitness & Strength", type: "body", desc: "Stamina to play every game and hold off defenders." },
    { id: 4, attribute: "size", name: "Height & Weight", type: "size", desc: "Physical frame — affects aerial and physical play." },
    { id: 5, attribute: "leftFoot", name: "Left Foot Striking", type: "numeric", desc: "Finishing quality with the left foot." },
    { id: 6, attribute: "rightFoot", name: "Right Foot Striking", type: "numeric", desc: "Finishing quality with the right foot." },
    { id: 7, attribute: "speed", name: "Speed", type: "numeric", desc: "Raw pace to beat defenders and run in behind." },
    { id: 8, attribute: "academy", name: "Academy", type: "academy", desc: "Starting club & development path." },
  ];

  const LEVERS = {
    startRerolls: 3,
    goalTarget: 1000,
    attackTargetFloor: 60,
    conversionMultiplier: 1.3,
    primeWindow: [24, 29],
    injuryFreqMin: 3,
    injuryFreqMax: 5,
    debutAge: 17,
  };

  const SQUAD_KEYS = Object.keys(PLAYER_DATABASE);

  /* ------------------------------ STATE --------------------------------- */
  let state = null;

  function freshState() {
    return {
      // genesis
      rollIndex: 0, // 0..7
      rerolls: LEVERS.startRerolls,
      currentRoll: null, // { squadKey, team, year, donor, slot, value }
      player: {
        name: "Your Striker",
        slots: {}, // attribute -> { value, value2, donor, team, year }
      },
      // career
      season: 0,
      age: LEVERS.debutAge,
      club: null,
      role: "Rotation",
      reputation: 20, // 0-100
      reputationTier: "Unknown",
      totalGoals: 0,
      totalApps: 0,
      totalAssists: 0,
      careerLog: [],
      flags: {}, // name -> seasonsRemaining
      cooldowns: {}, // eventId -> seasonsRemaining
      yearsAtClub: 0,
      injuryProneSeasons: 0,
      milestonesHit: {},
      intlCaps: 0,
      intlGoals: 0,
      intlDebut: false,
      seasonHistory: [],
      retired: false,
      bestRating: 0,
      clubsPlayed: new Set(),
      lastPerformanceTier: "Met Expectation",
      pendingDecision: null,
      awaitingDecision: false,
      currentAttributes: null, // aged attributes snapshot for season
    };
  }

  /* ------------------------------ UTILS --------------------------------- */
  const rand = Math.random;
  function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
  function randomBetween(min, max) { return rand() * (max - min) + min; }
  function choice(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }

  function poissonRandom(lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }

  function weightedRandomPick(items) {
    // items: [{ item, weight }]
    const total = items.reduce((s, i) => s + i.weight, 0);
    if (total <= 0) return null;
    let r = rand() * total;
    for (const i of items) { r -= i.weight; if (r <= 0) return i.item; }
    return items[items.length - 1].item;
  }

  function academyDisplay(name) {
    if (!name) return "—";
    return String(name).replace(/_/g, " ");
  }

  function parseSquadKey(key) {
    const m = key.match(/^(.*) \((\d{4})\)$/);
    return m ? { team: m[1], year: parseInt(m[2], 10) } : { team: key, year: 0 };
  }

  /* ---------------------------- SCREENS --------------------------------- */
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================ GENESIS ================================= */
  function startCreation() {
    state = freshState();
    showScreen("screen-genesis");
    beginRoll();
  }

  function beginRoll() {
    const cfg = ROLL_CONFIG[state.rollIndex];
    document.getElementById("roll-counter").textContent = `Roll ${state.rollIndex + 1} of 8`;
    document.getElementById("reroll-count").textContent = state.rerolls;
    document.getElementById("attr-name").textContent = cfg.name;
    document.getElementById("attr-desc").textContent = cfg.desc;
    document.getElementById("roll-result").innerHTML =
      `<div class="placeholder">Press <strong>SPIN</strong> to draw a random Premier League squad and era.</div>`;
    document.getElementById("btn-spin").style.display = "inline-block";
    document.getElementById("btn-spin").disabled = false;
    document.getElementById("btn-accept").style.display = "none";
    document.getElementById("btn-reroll").style.display = "none";
    state.currentRoll = null;
    renderPreview();
  }

  function spin() {
    const cfg = ROLL_CONFIG[state.rollIndex];
    const btn = document.getElementById("btn-spin");
    btn.disabled = true;
    const target = document.getElementById("roll-result");

    // animated cycling through squads
    let ticks = 0;
    const totalTicks = 18;
    const interval = setInterval(() => {
      const k = choice(SQUAD_KEYS);
      const { team, year } = parseSquadKey(k);
      target.innerHTML = `<div class="spinner-team">${team}<span class="spinner-year">${year}</span></div>`;
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(interval);
        landRoll(cfg);
      }
    }, 80);
  }

  function landRoll(cfg) {
    const squadKey = choice(SQUAD_KEYS);
    const { team, year } = parseSquadKey(squadKey);
    state.currentRoll = { squadKey, team, year, slot: cfg.attribute, type: cfg.type, donor: null };
    renderRoster(cfg, squadKey, team, year);
  }

  function donorValueText(cfg, pl) {
    switch (cfg.type) {
      case "numeric": return `${cfg.name}: ${pl[cfg.attribute]}`;
      case "mentality": return `Mentality: ${pl.mentality}${MENTALITIES[pl.mentality] && MENTALITIES[pl.mentality].rare ? " ★RARE" : ""}`;
      case "body": return `Fitness ${pl.fitness} · Strength ${pl.strength}`;
      case "size": return `Height ${pl.height}cm · Weight ${pl.weight}kg`;
      case "academy": {
        const tier = (ACADEMY_TIERS[pl.academy] || { tier: "Average" }).tier;
        return `Academy: ${academyDisplay(pl.academy)} (${tier})`;
      }
      default: return "";
    }
  }

  function statBadgeForRoll(cfg, pl) {
    // The headline value the user is drafting, used for sorting/highlight.
    switch (cfg.type) {
      case "numeric": return pl[cfg.attribute];
      case "body": return Math.round((pl.fitness + pl.strength) / 2);
      case "size": return pl.height;
      case "mentality": return MENTALITIES[pl.mentality] && MENTALITIES[pl.mentality].rare ? 99 : 70;
      case "academy": {
        const t = (ACADEMY_TIERS[pl.academy] || { tier: "Average" }).tier;
        return { "World Class": 99, Strong: 85, Average: 70, Weak: 55 }[t] || 70;
      }
      default: return 0;
    }
  }

  function renderRoster(cfg, squadKey, team, year) {
    const squad = PLAYER_DATABASE[squadKey].slice();
    const target = document.getElementById("roll-result");

    const cards = squad.map((pl, idx) => {
      const badge = statBadgeForRoll(cfg, pl);
      const badgeLabel = typeof badge === "number" ? badge : "";
      return `
        <button class="donor-card" data-idx="${idx}">
          <div class="donor-badge">${badgeLabel}</div>
          <div class="donor-name">${pl.name}</div>
          <div class="donor-value">${donorValueText(cfg, pl)}</div>
          <div class="donor-mini">HDR ${pl.heading} · LF ${pl.leftFoot} · RF ${pl.rightFoot} · PAC ${pl.speed}</div>
        </button>`;
    }).join("");

    target.innerHTML = `
      <div class="roll-landed">🎯 <strong>${team}</strong> <span class="year-chip">${year}</span> — pick the player to take your <strong>${cfg.name}</strong> from:</div>
      <div class="roster-grid">${cards}</div>`;

    target.querySelectorAll(".donor-card").forEach((c) => {
      c.addEventListener("click", () => selectDonor(parseInt(c.dataset.idx, 10), squadKey));
    });

    document.getElementById("btn-spin").style.display = "none";
    document.getElementById("btn-accept").style.display = "none";
    document.getElementById("btn-reroll").style.display = state.rerolls > 0 ? "inline-block" : "none";
  }

  function selectDonor(idx, squadKey) {
    const cfg = ROLL_CONFIG[state.rollIndex];
    const pl = PLAYER_DATABASE[squadKey][idx];
    const target = document.getElementById("roll-result");
    target.querySelectorAll(".donor-card").forEach((c) =>
      c.classList.toggle("selected", parseInt(c.dataset.idx, 10) === idx));

    state.currentRoll.donor = pl.name;
    state.currentRoll.donorObj = pl;

    document.getElementById("btn-accept").style.display = "inline-block";
    document.getElementById("btn-reroll").style.display = state.rerolls > 0 ? "inline-block" : "none";

    const sel = document.getElementById("selected-donor");
    if (sel) sel.remove();
    const div = document.createElement("div");
    div.id = "selected-donor";
    div.className = "selected-donor";
    div.innerHTML = `Selected: <strong>${pl.name}</strong> — ${donorValueText(cfg, pl)} <em>(${state.currentRoll.team} ${state.currentRoll.year})</em>`;
    target.appendChild(div);
  }

  function acceptDonor() {
    const cfg = ROLL_CONFIG[state.rollIndex];
    const r = state.currentRoll;
    if (!r || !r.donorObj) return;
    const pl = r.donorObj;
    const slot = { donor: pl.name, team: r.team, year: r.year };

    switch (cfg.type) {
      case "numeric": slot.value = pl[cfg.attribute]; break;
      case "mentality": slot.value = pl.mentality; break;
      case "body": slot.value = pl.fitness; slot.value2 = pl.strength; break;
      case "size": slot.value = pl.height; slot.value2 = pl.weight; break;
      case "academy": slot.value = pl.academy; slot.tier = (ACADEMY_TIERS[pl.academy] || { tier: "Average" }).tier; break;
    }
    state.player.slots[cfg.attribute] = slot;

    state.rollIndex++;
    if (state.rollIndex >= ROLL_CONFIG.length) {
      compilePlayer();
    } else {
      beginRoll();
    }
  }

  function reroll() {
    if (state.rerolls <= 0) return;
    state.rerolls--;
    document.getElementById("reroll-count").textContent = state.rerolls;
    const sel = document.getElementById("selected-donor");
    if (sel) sel.remove();
    // re-spin same slot
    document.getElementById("btn-spin").style.display = "inline-block";
    document.getElementById("btn-spin").disabled = false;
    document.getElementById("btn-accept").style.display = "none";
    document.getElementById("btn-reroll").style.display = "none";
    spin();
  }

  function renderPreview() {
    const wrap = document.getElementById("player-preview");
    const slots = state.player.slots;
    const rows = ROLL_CONFIG.map((cfg) => {
      const s = slots[cfg.attribute];
      if (!s) return `<div class="prev-row empty"><span>${cfg.name}</span><span>—</span></div>`;
      let val;
      if (cfg.type === "body") val = `${s.value}/${s.value2}`;
      else if (cfg.type === "size") val = `${s.value}cm/${s.value2}kg`;
      else val = s.value;
      return `<div class="prev-row"><span>${cfg.name}</span><span class="prev-val">${val}</span><span class="prev-src">${s.donor}, ${s.team} ${s.year}</span></div>`;
    }).join("");
    wrap.innerHTML = `<h3>Your DNA so far</h3>${rows}`;
  }

  /* ----------------------- STRIKER RATING / CARD ------------------------ */
  function calculateStrikerRating(slots) {
    const s = slots;
    const heading = num(s.heading);
    const lf = num(s.leftFoot);
    const rf = num(s.rightFoot);
    const speed = num(s.speed);
    const fitness = s.body ? s.body.value : 75;
    const strength = s.body ? s.body.value2 : 75;
    const bestFoot = Math.max(lf, rf);
    const finishing = bestFoot * 0.7 + Math.min(lf, rf) * 0.3;
    // weighted blend tuned so elite DNA ~ 88-92
    let rating =
      finishing * 0.34 +
      heading * 0.16 +
      speed * 0.20 +
      strength * 0.12 +
      fitness * 0.10 +
      ((lf + rf) / 2) * 0.08;
    return Math.round(clamp(rating, 40, 99));
  }
  function num(slot) { return slot ? slot.value : 70; }

  function compilePlayer() {
    const slots = state.player.slots;
    state.baseRating = calculateStrikerRating(slots);
    // playstyle inferred from DNA
    state.playstyle = inferPlaystyle(slots);
    renderConfirm();
    showScreen("screen-confirm");
  }

  function inferPlaystyle(s) {
    const heading = num(s.heading);
    const speed = num(s.speed);
    const strength = s.body ? s.body.value2 : 75;
    if (heading >= 90 && (s.size ? s.size.value : 180) >= 190) return "Target Man";
    if (speed >= 90) return "Pace Merchant";
    if (strength >= 88) return "Powerhouse";
    if (Math.max(num(s.leftFoot), num(s.rightFoot)) >= 92) return "Clinical Finisher";
    return "Complete Forward";
  }

  function renderConfirm() {
    const s = state.player.slots;
    const card = document.getElementById("confirm-card");
    const acad = s.academy || { value: "—", tier: "Average", donor: "—", team: "—", year: "" };
    const lines = [
      ["Academy", `${academyDisplay(acad.value)} (${acad.tier || "Average"})`, `${acad.donor}, ${acad.team} ${acad.year}`],
      ["Heading", num(s.heading), src(s.heading)],
      ["Mentality", s.mentality ? s.mentality.value : "—", src(s.mentality)],
      ["Fitness", s.body ? s.body.value : "—", src(s.body)],
      ["Strength", s.body ? s.body.value2 : "—", src(s.body)],
      ["Height", s.size ? s.size.value + " cm" : "—", src(s.size)],
      ["Weight", s.size ? s.size.value2 + " kg" : "—", src(s.size)],
      ["Left Foot", num(s.leftFoot), src(s.leftFoot)],
      ["Right Foot", num(s.rightFoot), src(s.rightFoot)],
      ["Speed", num(s.speed), src(s.speed)],
    ];
    const rows = lines.map(([k, v, source]) =>
      `<div class="dna-row"><span class="dna-k">${k}</span><span class="dna-v">${v}</span><span class="dna-s">${source}</span></div>`).join("");

    const ment = s.mentality ? s.mentality.value : "Professional";
    const mentInfo = MENTALITIES[ment] || { effect: "" };
    card.innerHTML = `
      <div class="rating-hero">
        <div class="rating-num">${state.baseRating}</div>
        <div class="rating-label">STRIKER RATING</div>
        <div class="playstyle-chip">${state.playstyle}</div>
        <div class="ment-chip ${mentInfo.rare ? "rare" : ""}">${ment} — ${mentInfo.effect}</div>
      </div>
      <div class="dna-table">${rows}</div>`;
    function src(slot) { return slot ? `${slot.donor}, ${slot.team} ${slot.year}` : "—"; }
  }

  function startCareer() {
    const nameInput = document.getElementById("player-name-input");
    const name = (nameInput.value || "").trim() || "Your Striker";
    state.player.name = name;

    // Academy determines starting club
    const acad = state.player.slots.academy;
    const tier = (acad && acad.tier) || "Average";
    const pool = ACADEMY_STARTING_POOL[tier] || ACADEMY_STARTING_POOL.Average;
    state.club = choice(pool);
    state.clubsPlayed.add(state.club);
    state.academyTier = tier;
    state.season = 1;
    state.age = LEVERS.debutAge + (tier === "Strong" || tier === "World Class" ? 0 : randInt(0, 1));
    state.mentality = (state.player.slots.mentality && state.player.slots.mentality.value) || "Professional";

    showScreen("screen-career");
    log(`🎬 ${name} begins their career at ${state.club} (${tier} academy). The chase for ${LEVERS.goalTarget} goals starts now.`, "milestone");
    renderCareerHeader();
    renderSeasonReady();
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
    // prime window hidden boost
    if (state.age >= LEVERS.primeWindow[0] && state.age <= LEVERS.primeWindow[1]) r *= 1.04;
    return r;
  }

  // ---- Match resolution (per spec) ----
  const TACTICAL = {
    Possession: { strongVs: ["Direct", "Route One"], weakVs: ["High Press"], atk: 1.0, mid: 1.08, chaos: 0 },
    "High Press": { strongVs: ["Possession"], weakVs: ["Counter"], atk: 1.04, def: 0.98, chaos: 6 },
    Counter: { strongVs: ["High Press"], weakVs: ["Park the Bus"], atk: 1.05, chaos: 4 },
    Direct: { strongVs: ["Park the Bus"], weakVs: ["Possession"], atk: 1.03, chaos: 4 },
    "Park the Bus": { strongVs: ["Counter"], weakVs: ["Direct"], atk: 0.9, def: 0.9, chaos: -4 },
    "Route One": { strongVs: [], weakVs: ["Possession"], atk: 1.0, chaos: 12 },
  };

  function applyTacticalMatchup(homeStyle, awayStyle) {
    const h = TACTICAL[homeStyle] || {};
    const a = TACTICAL[awayStyle] || {};
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
    return { homeGoals: poissonRandom(homeXG), awayGoals: poissonRandom(awayXG), homeXG, awayXG };
  }

  function getTacticalFitMultiplier(playstyle, teamStyle) {
    const fit = {
      "Target Man": { "Direct": 1.25, "Route One": 1.2, "Park the Bus": 0.85, "Possession": 0.95 },
      "Pace Merchant": { "Counter": 1.25, "High Press": 1.15, "Direct": 1.1, "Park the Bus": 0.85 },
      "Powerhouse": { "Direct": 1.15, "Route One": 1.15, "Counter": 1.05 },
      "Clinical Finisher": { "Possession": 1.2, "High Press": 1.1, "Counter": 1.1 },
      "Complete Forward": { "Possession": 1.1, "Counter": 1.1, "Direct": 1.05 },
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
    if (state.age <= 19 && state.academyTier !== "World Class" && state.academyTier !== "Strong") {
      return gap > 6 ? "Starter" : "Rotation";
    }
    if (gap >= 6) return "Star";
    if (gap >= -3) return "Starter";
    if (gap >= -10) return "Rotation";
    return "Bench";
  }

  function buildFixtures() {
    // 38 matches: every other PL club home & away approximated by sampling.
    const opponents = Object.keys(TEAM_DATABASE).filter((t) => t !== state.club);
    const fixtures = [];
    for (let i = 0; i < 38; i++) {
      const opp = opponents[i % opponents.length];
      fixtures.push({ opp, home: i % 2 === 0 });
    }
    return fixtures;
  }

  function formModifier() {
    let f = 0;
    if (state.flags.inForm) f += 8;
    if (state.flags.coldStreak) f -= 6;
    if (state.flags.redemptionArc) f += 4;
    return f;
  }

  function simulateSeason() {
    const club = TEAM_DATABASE[state.club];
    state.role = determineRole();
    const playerThreat = agedRating();
    const fixtures = buildFixtures();

    let teamPoints = 0, teamGF = 0, teamGA = 0;
    let playerGoals = 0, playerAssists = 0, apps = 0;

    // injuries
    const baseMiss = randInt(LEVERS.injuryFreqMin, LEVERS.injuryFreqMax);
    const fitness = state.player.slots.body ? state.player.slots.body.value : 75;
    let gamesMissed = baseMiss + (state.injuryProneSeasons > 0 ? randInt(2, 6) : 0) + (state.age >= 32 ? randInt(1, 4) : 0);
    if (fitness >= 90) gamesMissed = Math.max(0, gamesMissed - 2);
    if (state.mentality === "Hard Working" || state.mentality === "Determined") gamesMissed = Math.max(0, gamesMissed - 1);
    gamesMissed = clamp(gamesMissed, 0, 30);

    const fm = formModifier();
    const fitMult = getTacticalFitMultiplier(state.playstyle, club.tacticalStyle);
    const roleMult = getRoleMultiplier(state.role);
    const appearanceChance = { Star: 0.97, Starter: 0.9, Rotation: 0.6, Bench: 0.3 }[state.role] || 0.7;

    fixtures.forEach((fx, i) => {
      const oppTeam = TEAM_DATABASE[fx.opp];
      const home = fx.home ? club : oppTeam;
      const away = fx.home ? oppTeam : club;
      const res = simulateMatch(home, away, fx.home ? fm * 0.2 : 0, fx.home ? 0 : fm * 0.2);
      const myTeamGoals = fx.home ? res.homeGoals : res.awayGoals;
      const oppGoals = fx.home ? res.awayGoals : res.homeGoals;
      teamGF += myTeamGoals; teamGA += oppGoals;
      if (myTeamGoals > oppGoals) teamPoints += 3; else if (myTeamGoals === oppGoals) teamPoints += 1;

      const playing = i >= gamesMissed && rand() < appearanceChance; // injuries + rotation
      if (!playing) return;
      apps++;
      const teammateThreat = club.attack * 2.5;
      let share = playerThreat / (playerThreat + teammateThreat);
      share *= fitMult * roleMult * (1 + fm / 100);
      share = clamp(share, 0.05, 0.8);
      const myGoals = poissonRandom(myTeamGoals * share * LEVERS.conversionMultiplier);
      playerGoals += myGoals;
      // assists ~ proportional to creativity (use foot avg)
      if (myTeamGoals - myGoals > 0 && rand() < 0.35) playerAssists += poissonRandom((myTeamGoals - myGoals) * 0.25);
    });

    // Domestic cup + European competition goals (all comps count toward 1000).
    const compFactor = { Elite: 0.5, Europe: 0.36, Mid: 0.18, Lower: 0.08 }[club.league] || 0.15;
    const cupEuroGoals = poissonRandom(playerGoals * compFactor);
    playerGoals += cupEuroGoals;
    apps += Math.round(cupEuroGoals * 1.3) + (apps > 0 ? randInt(2, 6) : 0);

    // league position estimate
    const pos = estimatePosition(teamPoints, club.league);
    const trajectory = trajectoryFromPos(pos);

    // season rating
    const seasonRating = round1(clamp(6.0 + (playerGoals / Math.max(apps, 1)) * 4.2 + (state.role === "Star" ? 0.4 : 0), 5.5, 9.9));
    state.bestRating = Math.max(state.bestRating, seasonRating);

    // performance tier
    const perfTier = performanceTier(playerGoals, apps, state.role);
    state.lastPerformanceTier = perfTier;

    state.totalGoals += playerGoals;
    state.totalApps += apps;
    state.totalAssists += playerAssists;

    // reputation drift from performance
    let repDelta = { Sensational: 12, Overperformed: 7, "Met Expectation": 2, Underperformed: -3, Flop: -7 }[perfTier];
    if (pos <= 1) repDelta += 4;
    adjustReputation(repDelta);

    const seasonData = {
      season: state.season, age: state.age, club: state.club, role: state.role,
      goals: playerGoals, assists: playerAssists, apps, rating: seasonRating,
      teamPoints, pos, trajectory, perfTier, gamesMissed,
    };
    state.seasonHistory.push(seasonData);
    return seasonData;
  }

  function estimatePosition(points, league) {
    // map points (out of 114) to a plausible finishing position, biased by league band
    const bandBias = { Elite: -3, Europe: 0, Mid: 3, Lower: 6 }[league] || 0;
    let pos = Math.round(clamp(21 - (points / 114) * 20 + bandBias + randInt(-1, 1), 1, 20));
    return pos;
  }

  function trajectoryFromPos(pos) {
    if (pos === 1) return "Title";
    if (pos <= 4) return "Europe";
    if (pos <= 7) return "Europe";
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
    let g = 0, c = games;
    for (let i = 0; i < games; i++) {
      const opp = { attack: randInt(72, 88), midfield: randInt(72, 86), defence: randInt(72, 88), manager: randInt(74, 86), tacticalStyle: choice(["Possession", "Counter", "High Press", "Direct"]), homeAdvantage: 4 };
      const res = simulateMatch(NATIONAL_TEAM, opp, 0, 0);
      const teammateThreat = NATIONAL_TEAM.attack * 3;
      let share = clamp(agedRating() / (agedRating() + teammateThreat), 0.05, 0.6);
      g += poissonRandom(res.homeGoals * share);
    }
    state.intlCaps += c;
    state.intlGoals += g;
    state.totalGoals += g;
    if (isTournament && g >= 3) { adjustReputation(8); log(`🏆 Tournament heroics! ${g} goals for England — reputation surges.`, "intl"); }
    return { games: c, goals: g, isTournament };
  }

  /* ------------------------- DECISION ENGINE ---------------------------- */
  const EVENTS = [
    // Performance-tier
    { id: "breakout", category: "PERFORMANCE", base: 6, req: { perf: ["Overperformed", "Sensational"], ageMax: 24 },
      text: (n) => `${n} explodes onto the scene with a breakout season. The hype is real.`,
      choices: [
        { label: "Stay humble, keep working", fx: { rep: 4, flag: "fanFavorite" } },
        { label: "Embrace the spotlight", fx: { rep: 8, flag: "mediaTarget" } },
      ] },
    { id: "golden_boot", category: "PERFORMANCE", base: 5, req: { perf: ["Sensational"] },
      text: (n) => `Final day of the season and ${n} is in a three-way Golden Boot race!`,
      choices: [
        { label: "Go for glory — shoot on sight", fx: { rep: 6, goals: () => randInt(1, 3), flag: "inForm" } },
        { label: "Play for the team", fx: { rep: 3, assists: () => randInt(1, 3) } },
      ] },
    { id: "bench_frustration", category: "PERFORMANCE", base: 6, req: { perf: ["Underperformed", "Flop"], roleIn: ["Rotation", "Bench"] },
      text: (n) => `${n} is frustrated after another spell on the bench.`,
      choices: [
        { label: "Talk with the manager", fx: { rep: 1, flag: "managerConflict" } },
        { label: "Stay patient, train harder", fx: { rep: 2, flag: "redemptionArc" } },
        { label: "Ask to go out on loan", fx: { forceTransfer: true } },
      ] },
    { id: "scapegoat", category: "PERFORMANCE", base: 5, req: { traj: ["Relegated", "Battled Relegation"], perf: ["Flop", "Underperformed"] },
      text: (n) => `The fans need someone to blame after a dreadful campaign, and ${n} is in the crosshairs.`,
      choices: [
        { label: "Take responsibility publicly", fx: { rep: -2, flag: "fanFavorite" } },
        { label: "Blame teammates", fx: { rep: -6, flag: "burnedBridges" } },
        { label: "Go quiet", fx: { rep: -3 } },
      ] },
    { id: "career_best", category: "PERFORMANCE", base: 4, req: { perf: ["Sensational", "Overperformed"] },
      text: (n) => `${n} smashes a personal best for goals in a season.`,
      choices: [
        { label: "Soak it in", fx: { rep: 5, flag: "inForm" } },
      ] },
    // Team trajectory
    { id: "title_winner", category: "TRAJECTORY", base: 8, req: { traj: ["Title"] },
      text: (n) => `CHAMPIONS! ${n}'s club is crowned league winners.`,
      choices: [
        { label: "Stay and defend the title", fx: { rep: 6, flag: "fanFavorite" } },
        { label: "Use it as a platform to leave", fx: { rep: 4, forceTransfer: true } },
      ] },
    { id: "cup_final", category: "TRAJECTORY", base: 6, req: { traj: ["Title", "Europe"] },
      text: (n) => `${n}'s side reaches a major cup final. Ninety minutes from glory.`,
      choices: [
        { label: "Step up in the big moment", fx: { rep: 7, goals: () => randInt(1, 2), flag: "inForm" } },
        { label: "Let the team carry it", fx: { rep: 3 } },
      ] },
    { id: "relegated", category: "TRAJECTORY", base: 7, req: { traj: ["Relegated"] },
      text: (n) => `Heartbreak. ${n}'s club is relegated.`,
      choices: [
        { label: "Stay and fight back up", fx: { rep: 2, flag: "fanFavorite" } },
        { label: "Force an exit to a bigger club", fx: { rep: -2, forceTransfer: true } },
      ] },
    { id: "takeover", category: "TRAJECTORY", base: 4, req: {},
      text: (n) => `A wealthy consortium completes a takeover of ${n}'s club. Big changes incoming.`,
      choices: [
        { label: "Welcome the project", fx: { rep: 3, teamBoost: 4 } },
        { label: "Distrust the new owners", fx: { flag: "unsettled" } },
      ] },
    { id: "manager_sacked", category: "TRAJECTORY", base: 4, req: { traj: ["Mid-table", "Battled Relegation", "Relegated"] },
      text: (n) => `The manager is sacked. A new boss arrives with a completely different system.`,
      choices: [
        { label: "Adapt to the new tactics", fx: { rep: 2 } },
        { label: "Clash with the new philosophy", fx: { flag: "managerConflict" } },
      ] },
    // Mentality-flavoured
    { id: "captain_armband", category: "MENTALITY", base: 7, req: { mentality: ["Captain", "Leader"], yearsMin: 3 },
      text: (n) => `After years of service, ${n} is handed the captain's armband.`,
      choices: [
        { label: "Lead from the front", fx: { rep: 6, flag: "fanFavorite" } },
      ] },
    { id: "toxic_bustup", category: "MENTALITY", base: 6, req: { mentality: ["Toxic"] },
      text: (n) => `A dressing-room bust-up: ${n} squares up to a teammate after a poor result.`,
      choices: [
        { label: "Apologise publicly", fx: { rep: 1, flag: "redemptionArc" } },
        { label: "Demand a transfer", fx: { rep: -5, forceTransfer: true, flag: "burnedBridges" } },
        { label: "Let your agent handle it", fx: { flag: "unsettled" } },
      ] },
    { id: "loyal_offer", category: "MENTALITY", base: 6, req: { mentality: ["Loyal"] },
      text: (n) => `A huge offer arrives, but the club wants ${n} to sign a loyalty extension.`,
      choices: [
        { label: "Sign for life", fx: { rep: 5, flag: "fanFavorite" } },
        { label: "Chase the money", fx: { rep: -2, forceTransfer: true } },
      ] },
    { id: "maverick_viral", category: "MENTALITY", base: 6, req: { mentality: ["Maverick"] },
      text: (n) => `An outrageous piece of skill from ${n} goes viral worldwide.`,
      choices: [
        { label: "Milk the fame", fx: { rep: 7, flag: "mediaTarget" } },
        { label: "Stay focused on football", fx: { rep: 3, flag: "inForm" } },
      ] },
    { id: "ice_veins", category: "MENTALITY", base: 6, req: { mentality: ["Ice Veins"], traj: ["Title", "Europe"] },
      text: (n) => `Penalty shootout. The whole stadium holds its breath as ${n} steps up.`,
      choices: [
        { label: "Bury it, nerves of steel", fx: { rep: 6, goals: () => 1, flag: "inForm" } },
      ] },
    { id: "generational", category: "MENTALITY", base: 5, req: { mentality: ["Generational", "Icon"] },
      text: (n) => `Pundits are openly comparing ${n} to the all-time greats. The pressure mounts.`,
      choices: [
        { label: "Rise to the billing", fx: { rep: 5, flag: "inForm" } },
        { label: "Shut out the noise", fx: { rep: 2 } },
      ] },
    { id: "prodigy_track", category: "MENTALITY", base: 7, req: { mentality: ["Prodigy"], ageMax: 22, seasonMax: 3 },
      text: (n) => `${n} is fast-tracked into the senior setup, development accelerating.`,
      choices: [
        { label: "Seize the opportunity", fx: { rep: 4, ratingBoost: 2 } },
      ] },
    // Injury & fitness
    { id: "minor_knock", category: "INJURY", base: 4, req: {},
      text: (n) => `${n} picks up a minor knock late in the season.`,
      choices: [{ label: "Rest up, no lasting damage", fx: {} }] },
    { id: "serious_injury", category: "INJURY", base: 3, req: { ageMin: 29 },
      text: (n) => `Disaster — ${n} suffers a serious knee injury.`,
      choices: [
        { label: "Begin the long road back", fx: { rep: -2, flag: "injuryProne", injuryProne: 2 } },
      ] },
    { id: "iron_man", category: "INJURY", base: 3, req: {},
      text: (n) => `${n} played every single minute this season — a model of durability.`,
      choices: [{ label: "Iron man reputation grows", fx: { rep: 3 } }] },
    // Media & reputation
    { id: "sponsorship", category: "MEDIA", base: 4, req: { repMin: 55 },
      text: (n) => `A major boot brand offers ${n} a lucrative sponsorship deal.`,
      choices: [{ label: "Sign the deal", fx: { rep: 2 } }] },
    { id: "ballon_dor", category: "MEDIA", base: 4, req: { perf: ["Sensational"], repMin: 75 },
      text: (n) => `${n} is shortlisted for the Ballon d'Or!`,
      choices: [{ label: "An incredible honour", fx: { rep: 6, flag: "inForm" } }] },
    { id: "pundit_criticism", category: "MEDIA", base: 4, req: { perf: ["Underperformed", "Flop"], repMin: 55 },
      text: (n) => `Pundits queue up to criticise ${n} after a poor run.`,
      choices: [
        { label: "Respond with a classy interview", fx: { rep: 2 } },
        { label: "Hit back at the critics", fx: { rep: -2, flag: "mediaTarget" } },
      ] },
  ];

  const FLAG_DEFAULT_DURATION = 2;

  function buildContext(seasonData) {
    return {
      mentality: state.mentality,
      academyTier: state.academyTier,
      perf: seasonData.perfTier,
      traj: seasonData.trajectory,
      ageBracket: ageBracket(state.age),
      age: state.age,
      yearsAtClub: state.yearsAtClub,
      repTier: state.reputationTier,
      rep: state.reputation,
      role: state.role,
      season: state.season,
      flags: state.flags,
    };
  }

  function meetsHardRequirements(ev, ctx) {
    const r = ev.req || {};
    if (r.mentality && !r.mentality.includes(ctx.mentality)) return false;
    if (r.perf && !r.perf.includes(ctx.perf)) return false;
    if (r.traj && !r.traj.includes(ctx.traj)) return false;
    if (r.roleIn && !r.roleIn.includes(ctx.role)) return false;
    if (r.academyTier && !r.academyTier.includes(ctx.academyTier)) return false;
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
    // generic weight modifiers from flags
    if (ctx.flags.mediaTarget && ev.category === "MEDIA") w += 4;
    if (ctx.flags.managerConflict && ev.id === "manager_sacked") w += 6;
    if (ctx.flags.unsettled && ev.req && ev.req.forceTransfer) w += 4;
    if (ctx.flags.injuryProne && ev.category === "INJURY") w += 6;
    return Math.max(0, w);
  }

  const MILESTONES = [
    { goals: 100, title: "Local Hero" },
    { goals: 250, title: "Club Legend" },
    { goals: 500, title: "Generational Talent" },
    { goals: 750, title: "All-Time Great" },
    { goals: 1000, title: "Football God" },
  ];

  function checkMilestoneInterrupt() {
    for (const m of MILESTONES) {
      if (state.totalGoals >= m.goals && !state.milestonesHit[m.goals]) {
        state.milestonesHit[m.goals] = true;
        return {
          id: "milestone_" + m.goals, milestone: true, goals: m.goals,
          text: () => `🏅 MILESTONE: ${state.totalGoals} career goals — "${m.title}"!`,
          choices: [{ label: "Onwards", fx: { rep: m.goals >= 500 ? 6 : 3 } }],
        };
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
    if (fx.teamBoost) { TEAM_DATABASE[state.club].attack = clamp(TEAM_DATABASE[state.club].attack + fx.teamBoost, 50, 99); }
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
    const pool = Object.keys(TEAM_DATABASE).filter((t) => t !== state.club && tierByRep.includes(TEAM_DATABASE[t].league));
    const n = clamp(randInt(1, 3), 1, pool.length);
    const offers = [];
    const used = new Set();
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
      <div class="season-prompt">Age ${state.age} · ${state.club} · projected role: <strong>${determineRole()}</strong></div>
      <button class="btn primary big" id="btn-play-season">▶ PLAY SEASON ${state.season}</button>`;
    document.getElementById("btn-play-season").addEventListener("click", playSeason);
  }

  function playSeason() {
    const box = document.getElementById("season-action");
    box.innerHTML = `<div class="simming">Simulating season ${state.season}…</div>`;

    setTimeout(() => {
      const sd = simulateSeason();
      const intl = simulateInternational();
      renderSeasonResult(sd, intl);
      renderCareerHeader();

      // log season
      let line = `Season ${state.season} (age ${state.age}) — ${state.club}: ${sd.goals} goals, ${sd.assists} assists in ${sd.apps} apps (rating ${sd.rating}). League: ${ordinal(sd.pos)} [${sd.trajectory}]. Role: ${sd.role}.`;
      if (intl && intl.goals) line += ` 🦁 +${intl.goals} for England (${intl.games} caps).`;
      log(line, perfClass(sd.perfTier));

      // decision / milestone
      const ctx = buildContext(sd);
      const ev = pickSeasonEvent(ctx);
      if (ev) presentDecision(ev, sd, intl); else proceedToTransfer(sd, intl);
    }, 450);
  }

  function renderSeasonResult(sd, intl) {
    const box = document.getElementById("season-result");
    const intlHtml = intl ? `<div class="stat-box"><div class="sb-num">${intl.goals}</div><div class="sb-lab">England goals</div></div>` : "";
    box.innerHTML = `
      <div class="result-banner ${perfClass(sd.perfTier)}">${sd.perfTier} season — finished ${ordinal(sd.pos)} (${sd.trajectory})</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="sb-num">${sd.goals}</div><div class="sb-lab">Goals</div></div>
        <div class="stat-box"><div class="sb-num">${sd.assists}</div><div class="sb-lab">Assists</div></div>
        <div class="stat-box"><div class="sb-num">${sd.apps}</div><div class="sb-lab">Apps</div></div>
        <div class="stat-box"><div class="sb-num">${sd.rating}</div><div class="sb-lab">Avg Rating</div></div>
        ${intlHtml}
      </div>`;
  }

  function presentDecision(ev, sd, intl) {
    const box = document.getElementById("season-action");
    const name = state.player.name;
    const text = typeof ev.text === "function" ? ev.text(name) : ev.text;
    state.cooldowns[ev.id] = ev.cooldown || 3;
    const choicesHtml = ev.choices.map((c, i) =>
      `<button class="btn choice" data-i="${i}">${c.label}</button>`).join("");
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
    // milestone victory check
    if (state.totalGoals >= LEVERS.goalTarget) { endCareer(true); return; }

    state.yearsAtClub++;
    // transfer window
    const wantsMove = state.pendingTransfer ||
      (state.mentality === "Ambitious" && state.age >= 24 && state.age <= 27 && TEAM_DATABASE[state.club].league !== "Elite") ||
      (state.reputation >= 70 && TEAM_DATABASE[state.club].league === "Lower") ||
      (rand() < 0.18 && state.yearsAtClub >= 3);
    const loyalStay = (state.mentality === "Loyal" || state.mentality === "Determined") && rand() < 0.6;

    if (wantsMove && !(loyalStay && !state.pendingTransfer)) {
      const offers = generateOffers();
      presentTransfer(offers, sd, intl);
    } else {
      advanceToNextSeason();
    }
  }

  function presentTransfer(offers, sd, intl) {
    const box = document.getElementById("season-action");
    const cards = offers.map((o, i) => {
      const t = TEAM_DATABASE[o];
      return `<button class="btn offer" data-i="${i}">
        <div class="offer-club">${o}</div>
        <div class="offer-meta">${t.league} · ATK ${t.attack} MID ${t.midfield} DEF ${t.defence} · ${t.tacticalStyle}</div>
      </button>`;
    }).join("");
    box.innerHTML = `
      <div class="transfer">
        <div class="decision-tag">TRANSFER WINDOW</div>
        <div class="decision-text">Offers are on the table${state.pendingTransfer ? " — and you've pushed to leave." : "."} Where next?</div>
        <div class="offers">${cards}</div>
        <button class="btn ghost" id="btn-stay">Stay at ${state.club}</button>
      </div>`;
    box.querySelectorAll(".offer").forEach((btn) => {
      btn.addEventListener("click", () => {
        const club = offers[parseInt(btn.dataset.i, 10)];
        moveToClub(club);
        advanceToNextSeason();
      });
    });
    document.getElementById("btn-stay").addEventListener("click", () => {
      state.pendingTransfer = false;
      log(`   ↳ ✋ ${state.player.name} snubs the offers and stays at ${state.club}.`, "decision");
      advanceToNextSeason();
    });
  }

  function moveToClub(club) {
    log(`   ↳ ✈️ Transfer: ${state.player.name} joins ${club} (${TEAM_DATABASE[club].league}).`, "transfer");
    state.club = club;
    state.clubsPlayed.add(club);
    state.yearsAtClub = 0;
    state.pendingTransfer = false;
  }

  function advanceToNextSeason() {
    decayFlags();
    if (state.injuryProneSeasons > 0) state.injuryProneSeasons--;
    state.age++;
    state.season++;

    // retirement check
    const decline = getAgeModifier(state.age);
    const retireChance =
      state.age >= 39 ? 1 :
      state.age >= 36 ? 0.5 + (state.age - 36) * 0.15 :
      state.age >= 34 ? 0.2 : 0;
    if (rand() < retireChance) { endCareer(false); return; }

    renderCareerHeader();
    document.getElementById("season-result").innerHTML = "";
    renderSeasonReady();
  }

  /* ----------------------------- LEGACY --------------------------------- */
  function endCareer(reachedGoal) {
    state.retired = true;
    showScreen("screen-legacy");
    const s = state.player.slots;
    const won = reachedGoal || state.totalGoals >= LEVERS.goalTarget;
    document.getElementById("legacy-status").textContent =
      won ? "⚽ FOOTBALL GOD — 1000 GOALS!" : (state.totalGoals >= 500 ? "LEGENDARY CAREER!" : "CAREER COMPLETE");
    document.getElementById("legacy-status").className = "legacy-status " + (won ? "god" : (state.totalGoals >= 500 ? "legend" : ""));
    document.getElementById("legacy-goals").textContent = state.totalGoals;

    const grid = document.getElementById("legacy-grid");
    grid.innerHTML = [
      ["Seasons Played", state.season - (state.retired ? 0 : 0)],
      ["Clubs Played For", state.clubsPlayed.size],
      ["Final Age", state.age],
      ["Career Apps", state.totalApps],
      ["Career Assists", state.totalAssists],
      ["England Caps", state.intlCaps],
      ["England Goals", state.intlGoals],
      ["Best Avg Rating", state.bestRating || "—"],
      ["Peak Reputation", `${state.reputationTier} (${state.reputation})`],
    ].map(([k, v]) => `<div class="leg-box"><div class="leg-num">${v}</div><div class="leg-lab">${k}</div></div>`).join("");

    const dna = document.getElementById("legacy-dna");
    const ment = s.mentality ? s.mentality.value : "—";
    dna.innerHTML = `
      <h3>Player DNA</h3>
      <div class="dna-summary">
        <span class="tag">${state.playstyle}</span>
        <span class="tag ${MENTALITIES[ment] && MENTALITIES[ment].rare ? "rare" : ""}">${ment}</span>
        <span class="tag">${academyDisplay(s.academy && s.academy.value) || "—"} academy</span>
      </div>
      <div class="dna-key">
        ${dnaLine("Heading", s.heading)}
        ${dnaLine("Left Foot", s.leftFoot)}
        ${dnaLine("Right Foot", s.rightFoot)}
        ${dnaLine("Speed", s.speed)}
      </div>`;
    function dnaLine(label, slot) {
      if (!slot) return "";
      return `<div class="dna-row"><span class="dna-k">${label}</span><span class="dna-v">${slot.value}</span><span class="dna-s">${slot.donor}, ${slot.team} ${slot.year}</span></div>`;
    }
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
    document.getElementById("btn-accept").addEventListener("click", acceptDonor);
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
