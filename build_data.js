/* ============================================================================
 * BUILD SCRIPT — generates data.js from 686 Premier League roster JSON files.
 * Emits the FULL data.js (constants + PLAYER_DATABASE + exports).
 *
 * Alpha 1.1 changes:
 *  - Peak ratings: each player is seeded by their ID only, so the SAME player
 *    has identical (peak) attributes across every season/squad they appear in.
 *  - Legend boosting: known greats are lifted to tiered peak ratings.
 *  - New mentality system: a descriptive trait + a HIDDEN numeric rating.
 *  - Position codes + a per-player peak "overall".
 *  - Club -> academy tier mapping used by the new academy club-roll.
 * ========================================================================== */
const fs = require("fs");
const path = require("path");
 
const ATTACH = "/home/ubuntu/attachments";
const OUT = "/home/ubuntu/football-dna-simulator/data.js";
 
/* ---- deterministic RNG (seeded per player id, for peak-rating stability) ---- */
function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
 
/* ------------------------------------------------------------------ *
 * MENTALITY SYSTEM (hidden rating + descriptive trait)
 * ~75% neutral/balanced, ~25% rarer & more impactful (some negative).
 * ------------------------------------------------------------------ */
const NEUTRAL_TRAITS = ["Calm", "Composed", "Professional", "Steady", "Balanced",
  "Grounded", "Level-Headed", "Measured", "Reliable", "Focused", "Diligent",
  "Team Player", "Dependable", "Unflappable", "Adaptable", "Consistent",
  "Quiet", "Modest", "Honest", "Understated"];
 
// special traits: [name, min, max, tag]
const SPECIAL_TRAITS = [
  ["Leader", 74, 88, "leader"],
  ["Big Game Player", 78, 92, "clutch"],
  ["Ice Cold", 80, 94, "clutch"],
  ["Fearless", 72, 88, "aggressive"],
  ["Relentless", 74, 90, "workrate"],
  ["Determined", 70, 86, "workrate"],
  ["Perfectionist", 68, 86, "consistency"],
  ["Winner", 80, 93, "winner"],
  ["Talisman", 82, 95, "talisman"],
  ["Maverick", 55, 92, "volatile"],
  ["Mercurial", 45, 90, "volatile"],
  ["Temperamental", 28, 58, "negative"],
];
const SPECIAL_POSITIVE = SPECIAL_TRAITS.filter((t) => t[3] !== "negative" && t[3] !== "volatile");
 
function pickMentality(rng, isLegend) {
  if (isLegend) {
    if (rng() < 0.8) {
      const t = pick(rng, SPECIAL_POSITIVE);
      const mid = Math.round((t[1] + t[2]) / 2);
      return { trait: t[0], rating: ri(rng, mid, t[2]) };
    }
    return { trait: pick(rng, NEUTRAL_TRAITS), rating: ri(rng, 62, 74) };
  }
  if (rng() < 0.25) {
    const t = pick(rng, SPECIAL_TRAITS);
    return { trait: t[0], rating: ri(rng, t[1], t[2]) };
  }
  return { trait: pick(rng, NEUTRAL_TRAITS), rating: ri(rng, 44, 70) };
}
 
/* ------------------------------------------------------------------ *
 * POSITION GROUPS + attribute ranges
 * ------------------------------------------------------------------ */
function posGroup(pos) {
  const p = (pos || "").toLowerCase();
  if (p.includes("goalkeep")) return "GK";
  if (p.includes("centre-back") || p === "defender") return "CB";
  if (p.includes("-back")) return "FB";
  if (p.includes("defensive mid")) return "DM";
  if (p.includes("central mid") || p.includes("left mid") || p.includes("right mid")) return "CM";
  if (p.includes("attacking mid")) return "AM";
  if (p.includes("wing")) return "WG";
  if (p.includes("forward") || p.includes("striker")) return "FW";
  return "CM";
}
 
const RANGES = {
  GK: { heading: [70, 88], speed: [40, 62], strength: [70, 88], defH: 190 },
  CB: { heading: [70, 90], speed: [55, 74], strength: [72, 92], defH: 187 },
  FB: { heading: [58, 74], speed: [70, 90], strength: [62, 80], defH: 179 },
  DM: { heading: [60, 80], speed: [60, 78], strength: [68, 86], defH: 182 },
  CM: { heading: [55, 74], speed: [62, 82], strength: [62, 82], defH: 180 },
  AM: { heading: [50, 70], speed: [70, 88], strength: [58, 76], defH: 178 },
  WG: { heading: [48, 68], speed: [80, 97], strength: [56, 76], defH: 177 },
  FW: { heading: [66, 90], speed: [70, 92], strength: [66, 88], defH: 184 },
};
 
// headline attributes by position group (the ones lifted highest for legends)
const HEADLINE = {
  GK: ["strength", "heading"],
  CB: ["heading", "strength"],
  FB: ["speed", "strength"],
  DM: ["strength", "heading"],
  CM: ["fitness", "strength"],
  AM: ["speed"],
  WG: ["speed"],
  FW: ["heading", "speed"],
};
 
function parseHeight(h, defH) {
  if (!h) return defH;
  const m = String(h).replace("m", "").replace(",", ".").trim();
  const v = parseFloat(m);
  if (isNaN(v) || v < 1.4 || v > 2.2) return defH;
  return Math.round(v * 100);
}
 
/* ------------------------------------------------------------------ *
 * LEGENDS — tiered peak ratings. Matched by accent-insensitive name.
 * ------------------------------------------------------------------ */
const TIER_INFO = {
  "S+": { overall: 93, floor: 86 },
  "S": { overall: 90, floor: 84 },
  "A+": { overall: 87, floor: 82 },
  "A": { overall: 84, floor: 79 },
};
const LEGEND_TIERS = {
  "S+": ["Cristiano Ronaldo", "Thierry Henry", "Luka Modric", "Mohamed Salah", "Wayne Rooney"],
  "S": ["Kevin De Bruyne", "Luis Suarez", "Virgil van Dijk", "Didier Drogba",
        "Sergio Aguero", "Harry Kane", "Alan Shearer", "Patrick Vieira",
        "Roy Keane", "Peter Schmeichel"],
  "A+": ["Petr Cech", "Edwin van der Sar", "Alisson", "Alisson Becker", "John Terry",
         "Rio Ferdinand", "Nemanja Vidic", "Vincent Kompany", "Ashley Cole",
         "Tony Adams", "Steven Gerrard", "Frank Lampard", "Paul Scholes",
         "David Silva", "Yaya Toure", "Cesc Fabregas", "Robin van Persie",
         "Dennis Bergkamp", "Eric Cantona", "Ryan Giggs", "Robbie Fowler"],
  "A": ["Gareth Bale", "Carlos Tevez", "Javier Mascherano", "Xabi Alonso",
        "David de Gea", "Joe Hart", "Jens Lehmann", "Mark Schwarzer",
        "David James", "Nigel Martyn", "David Seaman", "Jaap Stam",
        "Jamie Carragher", "Gary Neville", "Claude Makelele", "Andy Cole",
        "Andrew Cole", "Jermain Defoe", "James Milner", "Gareth Barry",
        "Gary Speed", "Emile Heskey", "Phil Neville", "Nicolas Anelka",
        "Michael Owen", "Steve McManaman", "Rio Ferdinand", "Teddy Sheringham",
        "Ian Wright", "Les Ferdinand", "Matt Le Tissier", "Gianfranco Zola",
        "Juninho", "Fernando Torres", "Wayne Bridge"],
};
function normName(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
const LEGENDS = {};
for (const tier of Object.keys(LEGEND_TIERS)) {
  for (const name of LEGEND_TIERS[tier]) {
    const k = normName(name);
    if (!(k in LEGENDS)) LEGENDS[k] = tier; // first (best) tier wins
  }
}
 
function computeOverall(a, g) {
  // generic peak overall from attributes, position-weighted
  const foot = Math.max(a.leftFoot, a.rightFoot);
  if (g === "GK") return Math.round((a.strength * 0.4 + a.heading * 0.35 + a.fitness * 0.25));
  if (g === "FW" || g === "AM" || g === "WG")
    return Math.round(foot * 0.35 + a.speed * 0.25 + a.heading * 0.18 + a.strength * 0.12 + a.fitness * 0.10);
  if (g === "CB" || g === "DM")
    return Math.round(a.heading * 0.28 + a.strength * 0.30 + a.speed * 0.16 + a.fitness * 0.16 + foot * 0.10);
  return Math.round(a.strength * 0.22 + a.speed * 0.20 + a.heading * 0.18 + a.fitness * 0.20 + foot * 0.20);
}
 
function transformPlayer(pl) {
  // seed by player ID only -> identical peak attributes across all seasons
  const seedKey = String(pl.id || pl.name);
  const rng = mulberry32(seedFrom(seedKey));
  const g = posGroup(pl.position);
  const R = RANGES[g];
  const height = parseHeight(pl.height, R.defH);
  const bmi = 22.0 + rng() * 2.2;
  const weight = Math.round(bmi * Math.pow(height / 100, 2));
 
  const a = {
    heading: ri(rng, R.heading[0], R.heading[1]),
    speed: ri(rng, R.speed[0], R.speed[1]),
    strength: ri(rng, R.strength[0], R.strength[1]),
    fitness: ri(rng, 64, 96),
    height, weight,
  };
  const foot = (pl.foot || "").toLowerCase();
  if (foot === "left") { a.leftFoot = ri(rng, 80, 96); a.rightFoot = ri(rng, 52, 70); }
  else if (foot === "both") { a.leftFoot = ri(rng, 76, 90); a.rightFoot = ri(rng, 76, 90); }
  else { a.rightFoot = ri(rng, 80, 96); a.leftFoot = ri(rng, 50, 68); }
 
  const tier = LEGENDS[normName(pl.name)];
  const isLegend = !!tier;
  if (isLegend) {
    const info = TIER_INFO[tier];
    const headline = HEADLINE[g] || [];
    const lift = (key, target) => { a[key] = Math.min(99, Math.max(a[key], ri(rng, target - 3, target + 2))); };
    // lift all skill attributes to at least floor-6, headline to ~overall
    ["heading", "speed", "strength", "fitness"].forEach((k) =>
      lift(k, headline.includes(k) ? info.overall : info.floor - 4));
    // strong foot to peak, weak foot lifted modestly
    if (a.leftFoot >= a.rightFoot) { lift("leftFoot", info.overall); lift("rightFoot", info.floor - 10); }
    else { lift("rightFoot", info.overall); lift("leftFoot", info.floor - 10); }
  }
 
  const ment = pickMentality(rng, isLegend);
  let overall = computeOverall(a, g);
  if (isLegend) overall = Math.max(overall, TIER_INFO[tier].overall);
  overall = Math.min(99, overall);
 
  return {
    name: pl.name, pos: g,
    heading: a.heading, fitness: a.fitness, strength: a.strength,
    height: a.height, weight: a.weight,
    leftFoot: a.leftFoot, rightFoot: a.rightFoot, speed: a.speed,
    mentality: ment.trait, mentalityRating: ment.rating,
    overall, tier: tier || "",
  };
}
 
/* ------------------------------------------------------------------ *
 * Gather files -> DB keyed by "Club (Year)"
 * ------------------------------------------------------------------ */
function parseFile(base) {
  const noExt = base.replace(/\.json$/, "");
  const parts = noExt.split("_");
  const year = parts[parts.length - 1];
  let name = parts.slice(0, parts.length - 2).join(" ");
  name = name.replace(/\s*-\s*\d{4}\s*$/, "").trim();
  return { club: name, year };
}
 
const files = [];
for (const d of fs.readdirSync(ATTACH)) {
  const dir = path.join(ATTACH, d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".json")) files.push(path.join(dir, f));
  }
}
 
const DB = {};
const clubs = new Set();
let totalPlayers = 0, legendCount = 0;
const legendSeen = new Set();
for (const fp of files) {
  const base = path.basename(fp);
  const { club, year } = parseFile(base);
  const key = `${club} (${year})`;
  let json;
  try { json = JSON.parse(fs.readFileSync(fp, "utf8")); }
  catch (e) { console.error("parse fail", base, e.message); continue; }
  const players = Array.isArray(json.players) ? json.players : [];
  if (!players.length) continue;
  const arr = (DB[key] = DB[key] || []);
  for (const pl of players) {
    if (!pl || !pl.name) continue;
    const t = transformPlayer(pl);
    arr.push(t);
    totalPlayers++;
    if (t.tier) { legendCount++; legendSeen.add(normName(pl.name)); }
  }
  clubs.add(club);
}
 
/* ------------------------------------------------------------------ *
 * CLUB -> ACADEMY TIER (used by the academy club-roll)
 * ------------------------------------------------------------------ */
const ACADEMY_TIER_BY_CLUB = {
  "Manchester United": "World Class", "Manchester City": "World Class",
  "Chelsea FC": "World Class", "Arsenal FC": "World Class", "Liverpool FC": "World Class",
  "Southampton FC": "Strong", "Tottenham Hotspur": "Strong", "Everton FC": "Strong",
  "Leeds United": "Strong", "West Ham United": "Strong", "Aston Villa": "Strong",
  "Leicester City": "Strong", "Crystal Palace": "Strong", "Middlesbrough FC": "Strong",
  "Newcastle United": "Average", "Nottingham Forest": "Average", "Norwich City": "Average",
  "Fulham FC": "Average", "Blackburn Rovers": "Average", "Bolton Wanderers": "Average",
  "Charlton Athletic": "Average", "Coventry City": "Average", "Derby County": "Average",
  "Ipswich Town": "Average", "Reading FC": "Average", "Sunderland AFC": "Average",
  "Wolverhampton Wanderers": "Average", "Brighton and Hove Albion": "Average",
  "Brentford FC": "Average", "Watford FC": "Average", "Stoke City": "Average",
  "West Bromwich Albion": "Average", "Birmingham City": "Average", "Cardiff City": "Average",
  "Swansea City": "Average", "Hull City": "Average", "Wigan Athletic": "Average",
  "Portsmouth FC": "Average", "Queens Park Rangers": "Average", "AFC Bournemouth": "Average",
  "Sheffield United": "Average", "Sheffield Wednesday": "Average",
  "Barnsley FC": "Weak", "Blackpool FC": "Weak", "Bradford City": "Weak",
  "Burnley FC": "Weak", "Huddersfield Town": "Weak", "Luton Town": "Weak",
  "Oldham Athletic": "Weak", "Swindon Town": "Weak", "Wimbledon FC": "Weak",
};
const clubList = Array.from(clubs).sort();
const CLUB_ACADEMY = {};
for (const c of clubList) CLUB_ACADEMY[c] = ACADEMY_TIER_BY_CLUB[c] || "Average";
 
/* ------------------------------------------------------------------ *
 * SERIALIZE the whole data.js
 * ------------------------------------------------------------------ */
function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
 
const MENTALITY_META = (() => {
  const m = {};
  for (const n of NEUTRAL_TRAITS) m[n] = { special: false, tag: "neutral" };
  for (const [n, , , tag] of SPECIAL_TRAITS) m[n] = { special: true, tag };
  return m;
})();
 
const HEADER = `/* ============================================================================
 * FOOTBALL DNA SIMULATOR — DATA FILE  (auto-generated by build_data.js)
 * Alpha 1.1: peak ratings, hidden-rating mentalities, club->academy mapping.
 *
 * Player fields (via p()):
 *   name, pos, heading, fitness, strength, height, weight,
 *   leftFoot, rightFoot, speed, mentality (trait), mentalityRating (HIDDEN),
 *   overall (peak), tier (legend tier or "")
 * ========================================================================== */
 
/* Mentality traits — the numeric rating is HIDDEN from the player in-game;
 * only the descriptive trait is shown. \`special\` traits are rarer & impactful. */
const MENTALITY_TRAITS = ${JSON.stringify(MENTALITY_META, null, 2)};
 
/* Academy tiers -> development flavour. */
const ACADEMY_TIERS = {
  "World Class": { flavor: "Elite production line — 'wonderkid' expectations." },
  "Strong": { flavor: "Respected pathway with a real conveyor belt of talent." },
  "Average": { flavor: "Standard grounding — solid but unspectacular." },
  "Weak": { flavor: "Unfashionable setup — the ultimate underdog story." },
};
 
/* Every club present in the data, mapped to its academy tier.
 * The academy club-roll draws from these. */
const CLUB_ACADEMY = ${JSON.stringify(CLUB_ACADEMY, null, 2)};
 
/* Helper to keep squads compact.
 * Order: name, pos, heading, fitness, strength, height, weight, LF, RF, speed, mentality, mentalityRating, overall, tier */
function p(name, pos, heading, fitness, strength, height, weight, leftFoot, rightFoot, speed, mentality, mentalityRating, overall, tier) {
  return { name, pos, heading, fitness, strength, height, weight, leftFoot, rightFoot, speed, mentality, mentalityRating, overall, tier: tier || "" };
}
 
`;
 
function playerLine(p) {
  return `    p("${esc(p.name)}","${p.pos}",${p.heading},${p.fitness},${p.strength},${p.height},${p.weight},${p.leftFoot},${p.rightFoot},${p.speed},"${esc(p.mentality)}",${p.mentalityRating},${p.overall}${p.tier ? `,"${p.tier}"` : ""}),`;
}
const keys = Object.keys(DB).sort();
let dbOut = "const PLAYER_DATABASE = {\n";
for (const k of keys) {
  dbOut += `  "${esc(k)}": [\n`;
  for (const pl of DB[k]) dbOut += playerLine(pl) + "\n";
  dbOut += "  ],\n";
}
dbOut += "};\n\n";
 
const FOOTER = `/* ============================ TEAM DATABASE ============================
 * Clubs the career simulation places the player at & builds league tables from.
 * ====================================================================== */
const TEAM_DATABASE = {
  "Manchester City": { attack: 92, midfield: 90, defence: 86, manager: 95, tacticalStyle: "Possession", homeAdvantage: 8, league: "Elite" },
  "Liverpool": { attack: 90, midfield: 86, defence: 85, manager: 92, tacticalStyle: "High Press", homeAdvantage: 9, league: "Elite" },
  "Arsenal": { attack: 86, midfield: 85, defence: 84, manager: 86, tacticalStyle: "Possession", homeAdvantage: 8, league: "Elite" },
  "Manchester United": { attack: 84, midfield: 80, defence: 80, manager: 82, tacticalStyle: "Direct", homeAdvantage: 8, league: "Elite" },
  "Chelsea": { attack: 84, midfield: 82, defence: 82, manager: 84, tacticalStyle: "Counter", homeAdvantage: 7, league: "Elite" },
  "Tottenham": { attack: 83, midfield: 79, defence: 78, manager: 80, tacticalStyle: "High Press", homeAdvantage: 7, league: "Europe" },
  "Newcastle United": { attack: 80, midfield: 78, defence: 80, manager: 80, tacticalStyle: "Counter", homeAdvantage: 8, league: "Europe" },
  "Aston Villa": { attack: 80, midfield: 77, defence: 76, manager: 82, tacticalStyle: "Direct", homeAdvantage: 7, league: "Europe" },
  "Brighton": { attack: 78, midfield: 80, defence: 74, manager: 84, tacticalStyle: "Possession", homeAdvantage: 6, league: "Europe" },
  "West Ham": { attack: 76, midfield: 74, defence: 75, manager: 76, tacticalStyle: "Counter", homeAdvantage: 7, league: "Mid" },
  "Crystal Palace": { attack: 74, midfield: 73, defence: 74, manager: 76, tacticalStyle: "Counter", homeAdvantage: 7, league: "Mid" },
  "Brentford": { attack: 75, midfield: 73, defence: 73, manager: 78, tacticalStyle: "Route One", homeAdvantage: 7, league: "Mid" },
  "Fulham": { attack: 73, midfield: 72, defence: 72, manager: 76, tacticalStyle: "Possession", homeAdvantage: 6, league: "Mid" },
  "Everton": { attack: 70, midfield: 70, defence: 72, manager: 72, tacticalStyle: "Park the Bus", homeAdvantage: 8, league: "Mid" },
  "Wolves": { attack: 72, midfield: 71, defence: 72, manager: 74, tacticalStyle: "Counter", homeAdvantage: 6, league: "Mid" },
  "Nottingham Forest": { attack: 70, midfield: 68, defence: 69, manager: 72, tacticalStyle: "Park the Bus", homeAdvantage: 8, league: "Lower" },
  "Bournemouth": { attack: 71, midfield: 69, defence: 67, manager: 74, tacticalStyle: "High Press", homeAdvantage: 6, league: "Lower" },
  "Burnley": { attack: 66, midfield: 66, defence: 68, manager: 70, tacticalStyle: "Route One", homeAdvantage: 7, league: "Lower" },
  "Sheffield United": { attack: 64, midfield: 65, defence: 66, manager: 68, tacticalStyle: "Park the Bus", homeAdvantage: 7, league: "Lower" },
  "Luton Town": { attack: 63, midfield: 64, defence: 64, manager: 70, tacticalStyle: "Route One", homeAdvantage: 8, league: "Lower" },
};
 
/* Academy tier -> pool of realistic starting clubs (by league band). */
const ACADEMY_STARTING_POOL = {
  "World Class": ["Manchester City", "Liverpool", "Arsenal", "Manchester United", "Chelsea"],
  "Strong": ["Tottenham", "Newcastle United", "Aston Villa", "Brighton"],
  "Average": ["West Ham", "Crystal Palace", "Brentford", "Fulham", "Wolves"],
  "Weak": ["Everton", "Nottingham Forest", "Bournemouth", "Burnley", "Sheffield United", "Luton Town"],
};
 
/* National team for the international track. */
const NATIONAL_TEAM = { name: "England", attack: 84, midfield: 82, defence: 82, manager: 82, tacticalStyle: "Possession", homeAdvantage: 6 };
 
/* Expose to game.js. */
if (typeof window !== "undefined") {
  window.GAME_DATA = {
    MENTALITY_TRAITS,
    ACADEMY_TIERS,
    CLUB_ACADEMY,
    PLAYER_DATABASE,
    TEAM_DATABASE,
    ACADEMY_STARTING_POOL,
    NATIONAL_TEAM,
  };
}
`;
 
fs.writeFileSync(OUT, HEADER + dbOut + FOOTER);
console.log("squads:", keys.length, "players:", totalPlayers);
console.log("clubs:", clubList.length);
console.log("legend appearances:", legendCount, "unique legends matched:", legendSeen.size);
console.log("wrote", OUT);
