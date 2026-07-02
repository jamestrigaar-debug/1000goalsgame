/* Transform 686 Premier League roster JSON files into PLAYER_DATABASE.
 * Reads all *.json under /home/ubuntu/attachments, emits data.js content. */
const fs = require("fs");
const path = require("path");

const ATTACH = "/home/ubuntu/attachments";
const OUT = "/home/ubuntu/football-dna-simulator/data.js";

/* ---- deterministic RNG seeded per player so re-runs are stable ---- */
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

/* ---- mentality pool (weighted: mostly common) ---- */
const COMMON_MENT = ["Professional", "Hard Working", "Team Player", "Leader",
  "Determined", "Loyal", "Ambitious"];
const RARE_MENT = ["Captain", "Icon", "Legend", "Maverick", "Toxic",
  "Generational", "Untouchable", "Ice Veins", "Prodigy"];
function pickMentality(rng) {
  return rng() < 0.15 ? RARE_MENT[Math.floor(rng() * RARE_MENT.length)]
                      : COMMON_MENT[Math.floor(rng() * COMMON_MENT.length)];
}

/* ---- club -> academy mapping (must match ACADEMY_TIERS keys) ---- */
const ACADEMY_BY_CLUB = {
  "Manchester United": "Carrington",
  "Chelsea FC": "Cobham (Chelsea)",
  "Arsenal FC": "Hale_End",
  "Southampton FC": "Southampton",
  "Liverpool FC": "Kirkby (Liverpool)",
  "Manchester City": "City Football Academy",
  "Tottenham Hotspur": "Tottenham",
  "Leicester City": "Leicester",
  "West Ham United": "West Ham",
  "Everton FC": "Everton",
  "Stoke City": "Stoke",
  "Blackburn Rovers": "Blackburn",
};
function academyFor(club, rng) {
  if (ACADEMY_BY_CLUB[club]) return ACADEMY_BY_CLUB[club];
  return rng() < 0.5 ? "Lower League" : "Professional";
}

/* ---- position groups ---- */
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

/* attribute ranges keyed by position group: [lo,hi] */
const RANGES = {
  GK: { heading: [72, 90], speed: [40, 62], strength: [70, 88], defH: 190 },
  CB: { heading: [70, 90], speed: [55, 74], strength: [72, 92], defH: 187 },
  FB: { heading: [58, 74], speed: [70, 90], strength: [62, 80], defH: 179 },
  DM: { heading: [60, 80], speed: [60, 78], strength: [68, 86], defH: 182 },
  CM: { heading: [55, 74], speed: [62, 82], strength: [62, 82], defH: 180 },
  AM: { heading: [50, 70], speed: [70, 88], strength: [58, 76], defH: 178 },
  WG: { heading: [48, 68], speed: [80, 97], strength: [56, 76], defH: 177 },
  FW: { heading: [66, 90], speed: [70, 92], strength: [66, 88], defH: 184 },
};

function parseHeight(h, defH) {
  if (!h) return defH;
  const m = String(h).replace("m", "").replace(",", ".").trim();
  const v = parseFloat(m);
  if (isNaN(v) || v < 1.4 || v > 2.2) return defH;
  return Math.round(v * 100);
}

/* ---- filename -> {club, year} ---- */
function parseFile(base) {
  const noExt = base.replace(/\.json$/, "");
  const parts = noExt.split("_");
  const year = parts[parts.length - 1];
  let name = parts.slice(0, parts.length - 2).join(" ");
  name = name.replace(/\s*-\s*\d{4}\s*$/, "").trim(); // strip stray "- 2004"
  return { club: name, year };
}

function transformPlayer(pl, club, rng) {
  const g = posGroup(pl.position);
  const R = RANGES[g];
  const height = parseHeight(pl.height, R.defH);
  const bmi = 22.0 + rng() * 2.2;
  const weight = Math.round(bmi * Math.pow(height / 100, 2));
  const heading = ri(rng, R.heading[0], R.heading[1]);
  const speed = ri(rng, R.speed[0], R.speed[1]);
  const strength = ri(rng, R.strength[0], R.strength[1]);
  const fitness = ri(rng, 64, 96);
  const foot = (pl.foot || "").toLowerCase();
  let leftFoot, rightFoot;
  if (foot === "left") { leftFoot = ri(rng, 80, 96); rightFoot = ri(rng, 52, 70); }
  else if (foot === "both") { leftFoot = ri(rng, 76, 90); rightFoot = ri(rng, 76, 90); }
  else { rightFoot = ri(rng, 80, 96); leftFoot = ri(rng, 50, 68); }
  const mentality = pickMentality(rng);
  const academy = academyFor(club, rng);
  return { name: pl.name, heading, mentality, fitness, strength, height, weight, leftFoot, rightFoot, speed, academy };
}

/* ---- gather files ---- */
const files = [];
for (const d of fs.readdirSync(ATTACH)) {
  const dir = path.join(ATTACH, d);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".json")) files.push(path.join(dir, f));
  }
}

const DB = {};
const clubYears = {}; // club -> set of years
let totalPlayers = 0;
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
    const rng = mulberry32(seedFrom((pl.id || pl.name) + "|" + key));
    arr.push(transformPlayer(pl, club, rng));
    totalPlayers++;
  }
  (clubYears[club] = clubYears[club] || new Set()).add(year);
}

/* ---- serialize ---- */
function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
function playerLine(p) {
  return `    p("${esc(p.name)}", ${p.heading}, "${esc(p.mentality)}", ${p.fitness}, ${p.strength}, ${p.height}, ${p.weight}, ${p.leftFoot}, ${p.rightFoot}, ${p.speed}, "${esc(p.academy)}"),`;
}
const keys = Object.keys(DB).sort();
let out = "const PLAYER_DATABASE = {\n";
for (const k of keys) {
  out += `  "${esc(k)}": [\n`;
  for (const pl of DB[k]) out += playerLine(pl) + "\n";
  out += "  ],\n";
}
out += "};\n";

fs.writeFileSync("/tmp/player_db.js", out);
console.log("squads:", keys.length, "players:", totalPlayers);
console.log("clubs:", Object.keys(clubYears).length);
console.log("sample keys:", keys.slice(0, 3), keys.slice(-3));
