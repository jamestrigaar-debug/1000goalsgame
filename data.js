/* ============================================================================
 * FOOTBALL DNA SIMULATOR — DATA FILE
 * ============================================================================
 * This file holds all the donor data the game draws from. It is intentionally
 * kept separate from the game logic (game.js) so it is trivial to extend.
 *
 * >>> HOW TO ADD / EDIT PLAYERS <<<
 * Each squad is keyed by "Club (Year)" and contains an array of player objects.
 * Every player MUST provide all of these fields:
 *
 *   name      : string   – display name
 *   heading   : 60-99     – Roll 1 (Heading)
 *   mentality : string    – Roll 2 (must be one of MENTALITIES below)
 *   fitness   : 60-99     – Roll 3 (Body, part 1)
 *   strength  : 60-99     – Roll 3 (Body, part 2)
 *   height    : cm        – Roll 4 (Physique, part 1)
 *   weight    : kg        – Roll 4 (Physique, part 2)
 *   leftFoot  : 60-99     – Roll 5 (Left Foot)
 *   rightFoot : 60-99     – Roll 6 (Right Foot)
 *   speed     : 60-99     – Roll 7 (Speed)
 *   academy   : string    – Roll 8 (Academy / development path)
 *
 * Premier League (English clubs) only for now, across different eras.
 * Add as many "Club (Year)" squads as you like — the game auto-discovers them.
 * ========================================================================== */
 
/* Mentalities — common are available widely, rare are special behavioural flags.
 * The game reads `rare: true` to flavour rarity in the UI. */
const MENTALITIES = {
  Professional: { rare: false, effect: "Standard decision weights" },
  "Hard Working": { rare: false, effect: "+Fitness retention when aging, ignores bad offers" },
  "Team Player": { rare: false, effect: "Bonus to team chemistry events" },
  Leader: { rare: false, effect: "Leadership narrative boosts" },
  Determined: { rare: false, effect: "+Fitness retention, resists relegation transfer pull" },
  Captain: { rare: true, effect: "Auto-captain after 3 seasons; big teams only" },
  Icon: { rare: true, effect: "Legacy status events unlocked" },
  Legend: { rare: true, effect: "Special retirement narratives" },
  Maverick: { rare: true, effect: "Viral moments, reputation spikes, media attention" },
  Toxic: { rare: true, effect: "Forces moves after bad seasons, burns bridges" },
  Generational: { rare: true, effect: "Comparisons to all-time greats" },
  Untouchable: { rare: true, effect: "Immune to negative event severity" },
  "Ice Veins": { rare: true, effect: "Clutch goals in big matches" },
  Loyal: { rare: false, effect: "Rejects offers, signs loyalty extensions" },
  Ambitious: { rare: false, effect: "Actively seeks the next step up" },
  Prodigy: { rare: true, effect: "Accelerated growth in first 3 seasons" },
};
 
/* Academy tiers — Roll 8 maps an academy string to a tier + effect.
 * If a player's `academy` is not listed here it defaults to "Average". */
const ACADEMY_TIERS = {
  // World Class
  Carrington: { tier: "World Class", flavor: "'Wonderkid' tag — big expectations" },
  "Cobham (Chelsea)": { tier: "World Class", flavor: "Elite London production line" },
  Hale_End: { tier: "World Class", flavor: "Arsenal's gem factory" },
  // Strong
  Southampton: { tier: "Strong", flavor: "'Conveyor belt' pedigree" },
  "Kirkby (Liverpool)": { tier: "Strong", flavor: "Anfield's accelerated path" },
  "City Football Academy": { tier: "Strong", flavor: "State-of-the-art development" },
  Tottenham: { tier: "Strong", flavor: "North London top-half academy" },
  // Average
  Leicester: { tier: "Average", flavor: "Standard pathway" },
  "West Ham": { tier: "Average", flavor: "The Academy of Football" },
  Everton: { tier: "Average", flavor: "Steady Merseyside grounding" },
  // Weak
  Stoke: { tier: "Weak", flavor: "Underdog grit, high hidden potential" },
  Blackburn: { tier: "Weak", flavor: "Unfashionable, slow-burn" },
  "Lower League": { tier: "Weak", flavor: "'Nobody academy' — underdog story" },
};
 
/* Helper used only inside this file to keep squads compact & readable.
 * Order: heading, mentality, fitness, strength, height, weight, LF, RF, speed, academy */
function p(name, heading, mentality, fitness, strength, height, weight, leftFoot, rightFoot, speed, academy) {
  return { name, heading, mentality, fitness, strength, height, weight, leftFoot, rightFoot, speed, academy };
}
 
/* ============================== THE DATABASE ============================== */
const PLAYER_DATABASE = {
  "Manchester United (1999)": [
    p("Peter Schmeichel", 70, "Leader", 84, 88, 191, 92, 70, 78, 68, "Lower League"),
    p("Gary Neville", 74, "Determined", 86, 78, 180, 75, 65, 80, 78, "Carrington"),
    p("Jaap Stam", 88, "Determined", 87, 90, 191, 95, 68, 82, 74, "Lower League"),
    p("Ronny Johnsen", 84, "Professional", 83, 84, 187, 84, 72, 78, 76, "Lower League"),
    p("Denis Irwin", 72, "Professional", 85, 76, 175, 70, 88, 82, 79, "Lower League"),
    p("David Beckham", 78, "Icon", 88, 74, 183, 76, 70, 96, 80, "Carrington"),
    p("Roy Keane", 82, "Captain", 90, 86, 178, 74, 74, 86, 80, "Lower League"),
    p("Paul Scholes", 80, "Professional", 86, 76, 170, 70, 78, 92, 76, "Carrington"),
    p("Ryan Giggs", 76, "Icon", 88, 74, 179, 67, 94, 76, 90, "Carrington"),
    p("Nicky Butt", 78, "Hard Working", 86, 80, 177, 73, 72, 82, 78, "Carrington"),
    p("Andy Cole", 86, "Professional", 84, 78, 179, 74, 76, 90, 88, "Lower League"),
    p("Dwight Yorke", 88, "Team Player", 85, 80, 178, 76, 80, 89, 84, "Lower League"),
    p("Teddy Sheringham", 90, "Professional", 80, 78, 185, 79, 78, 90, 70, "Lower League"),
    p("Ole Gunnar Solskjaer", 84, "Professional", 83, 74, 178, 71, 82, 92, 82, "Lower League"),
    p("Jesper Blomqvist", 70, "Professional", 82, 72, 180, 74, 90, 70, 84, "Lower League"),
    p("Phil Neville", 72, "Hard Working", 85, 76, 180, 72, 80, 78, 80, "Carrington"),
    p("Wes Brown", 84, "Professional", 84, 82, 185, 80, 66, 80, 78, "Carrington"),
    p("Henning Berg", 82, "Professional", 83, 82, 183, 80, 70, 80, 78, "Lower League"),
  ],
 
  "Manchester United (2008)": [
    p("Edwin van der Sar", 72, "Leader", 82, 84, 197, 90, 80, 80, 66, "Lower League"),
    p("Rio Ferdinand", 88, "Leader", 86, 84, 189, 82, 72, 85, 82, "West Ham"),
    p("Nemanja Vidic", 94, "Determined", 87, 92, 188, 84, 70, 84, 78, "Lower League"),
    p("Patrice Evra", 74, "Team Player", 88, 80, 175, 76, 90, 74, 88, "Lower League"),
    p("Wes Brown", 84, "Professional", 84, 82, 185, 80, 66, 80, 78, "Carrington"),
    p("Cristiano Ronaldo", 90, "Generational", 90, 84, 187, 83, 86, 95, 94, "Lower League"),
    p("Michael Carrick", 76, "Professional", 84, 78, 185, 75, 80, 88, 72, "West Ham"),
    p("Paul Scholes", 80, "Professional", 84, 76, 170, 70, 78, 92, 72, "Carrington"),
    p("Ryan Giggs", 76, "Icon", 84, 72, 179, 67, 94, 76, 82, "Carrington"),
    p("Owen Hargreaves", 78, "Hard Working", 85, 80, 180, 76, 78, 84, 82, "Lower League"),
    p("Anderson", 74, "Professional", 84, 82, 176, 78, 78, 82, 82, "Lower League"),
    p("Nani", 76, "Maverick", 85, 74, 177, 71, 80, 88, 90, "Lower League"),
    p("Wayne Rooney", 86, "Determined", 88, 86, 176, 83, 80, 92, 86, "Everton"),
    p("Carlos Tevez", 84, "Hard Working", 89, 84, 173, 71, 82, 88, 86, "Lower League"),
    p("Dimitar Berbatov", 88, "Maverick", 80, 80, 188, 80, 86, 88, 74, "Lower League"),
    p("Park Ji-sung", 76, "Hard Working", 90, 76, 175, 70, 78, 82, 88, "Lower League"),
    p("Darren Fletcher", 78, "Hard Working", 87, 78, 184, 76, 72, 82, 80, "Carrington"),
    p("John O'Shea", 82, "Professional", 84, 80, 188, 79, 74, 80, 76, "Carrington"),
  ],
 
  "Arsenal (2004)": [
    p("Jens Lehmann", 70, "Maverick", 82, 82, 192, 87, 76, 80, 68, "Lower League"),
    p("Lauren", 74, "Determined", 87, 80, 178, 74, 70, 82, 84, "Lower League"),
    p("Sol Campbell", 90, "Leader", 86, 90, 188, 90, 70, 82, 84, "Tottenham"),
    p("Kolo Toure", 84, "Hard Working", 90, 84, 183, 76, 70, 80, 88, "Lower League"),
    p("Ashley Cole", 74, "Professional", 90, 78, 176, 73, 90, 74, 90, "Hale_End"),
    p("Patrick Vieira", 86, "Captain", 90, 88, 193, 81, 76, 86, 82, "Lower League"),
    p("Gilberto Silva", 80, "Team Player", 88, 82, 188, 76, 78, 84, 78, "Lower League"),
    p("Robert Pires", 76, "Professional", 84, 74, 185, 75, 78, 90, 82, "Lower League"),
    p("Freddie Ljungberg", 80, "Hard Working", 88, 76, 175, 68, 76, 86, 88, "Lower League"),
    p("Dennis Bergkamp", 84, "Icon", 82, 78, 183, 77, 80, 94, 76, "Lower League"),
    p("Thierry Henry", 84, "Generational", 90, 80, 188, 83, 82, 94, 96, "Lower League"),
    p("Jose Antonio Reyes", 78, "Maverick", 85, 74, 177, 73, 76, 88, 90, "Lower League"),
    p("Robert Pires", 76, "Professional", 84, 74, 185, 75, 78, 90, 82, "Lower League"),
    p("Edu", 78, "Professional", 84, 78, 183, 75, 86, 80, 78, "Lower League"),
    p("Ray Parlour", 78, "Hard Working", 88, 80, 180, 76, 72, 82, 82, "Hale_End"),
    p("Nwankwo Kanu", 86, "Maverick", 80, 80, 197, 82, 78, 84, 78, "Lower League"),
    p("Pascal Cygan", 82, "Professional", 82, 82, 192, 84, 80, 74, 72, "Lower League"),
    p("Gael Clichy", 72, "Professional", 89, 74, 176, 71, 84, 72, 90, "Lower League"),
  ],
 
  "Chelsea (2005)": [
    p("Petr Cech", 72, "Professional", 84, 84, 196, 90, 74, 80, 70, "Lower League"),
    p("John Terry", 95, "Leader", 85, 88, 187, 90, 70, 82, 72, "Cobham (Chelsea)"),
    p("Ricardo Carvalho", 86, "Professional", 86, 82, 183, 79, 72, 82, 80, "Lower League"),
    p("William Gallas", 84, "Professional", 88, 82, 178, 76, 74, 82, 86, "Lower League"),
    p("Paulo Ferreira", 74, "Hard Working", 87, 78, 183, 73, 70, 80, 82, "Lower League"),
    p("Wayne Bridge", 72, "Professional", 88, 78, 180, 78, 88, 72, 84, "Southampton"),
    p("Claude Makelele", 70, "Professional", 88, 82, 170, 70, 76, 82, 80, "Lower League"),
    p("Frank Lampard", 82, "Leader", 89, 82, 184, 88, 76, 92, 76, "West Ham"),
    p("Michael Essien", 84, "Hard Working", 92, 90, 178, 84, 76, 88, 86, "Lower League"),
    p("Joe Cole", 74, "Maverick", 86, 76, 173, 74, 82, 86, 84, "West Ham"),
    p("Arjen Robben", 72, "Maverick", 82, 70, 180, 73, 88, 80, 92, "Lower League"),
    p("Damien Duff", 74, "Professional", 86, 74, 175, 70, 86, 80, 88, "Lower League"),
    p("Didier Drogba", 93, "Ice Veins", 88, 92, 189, 91, 80, 92, 86, "Lower League"),
    p("Eidur Gudjohnsen", 84, "Professional", 84, 80, 185, 82, 82, 86, 78, "Lower League"),
    p("Hernan Crespo", 88, "Professional", 82, 78, 184, 78, 76, 90, 82, "Lower League"),
    p("Shaun Wright-Phillips", 68, "Hard Working", 88, 72, 166, 67, 72, 84, 92, "Lower League"),
    p("Geremi", 76, "Professional", 86, 80, 180, 78, 74, 84, 82, "Lower League"),
    p("Asier del Horno", 74, "Professional", 86, 80, 178, 76, 86, 72, 82, "Lower League"),
  ],
 
  "Manchester City (2023)": [
    p("Ederson", 72, "Professional", 84, 80, 188, 86, 90, 82, 74, "Lower League"),
    p("Kyle Walker", 76, "Professional", 90, 84, 183, 83, 70, 82, 96, "Tottenham"),
    p("Ruben Dias", 90, "Leader", 88, 88, 187, 83, 72, 84, 80, "Lower League"),
    p("John Stones", 84, "Professional", 86, 82, 188, 80, 76, 86, 80, "Everton"),
    p("Nathan Ake", 84, "Professional", 88, 82, 180, 75, 88, 76, 86, "Cobham (Chelsea)"),
    p("Rodri", 84, "Determined", 88, 86, 191, 82, 80, 88, 74, "Lower League"),
    p("Kevin De Bruyne", 80, "Generational", 86, 80, 181, 76, 78, 96, 82, "Lower League"),
    p("Bernardo Silva", 70, "Hard Working", 90, 72, 173, 64, 80, 88, 84, "Lower League"),
    p("Phil Foden", 74, "Prodigy", 86, 72, 171, 70, 78, 90, 86, "City Football Academy"),
    p("Jack Grealish", 72, "Maverick", 88, 80, 180, 74, 92, 74, 82, "Lower League"),
    p("Riyad Mahrez", 70, "Maverick", 84, 70, 179, 67, 70, 92, 86, "Leicester"),
    p("Erling Haaland", 91, "Generational", 90, 92, 195, 88, 80, 95, 92, "Lower League"),
    p("Julian Alvarez", 80, "Hard Working", 88, 78, 170, 71, 82, 86, 88, "Lower League"),
    p("Ilkay Gundogan", 82, "Leader", 84, 78, 180, 80, 78, 88, 76, "Lower League"),
    p("Manuel Akanji", 86, "Professional", 88, 84, 187, 80, 74, 82, 86, "Lower League"),
    p("Kalvin Phillips", 78, "Hard Working", 86, 82, 178, 72, 76, 82, 76, "Lower League"),
    p("Jeremy Doku", 66, "Maverick", 86, 70, 171, 70, 78, 84, 95, "Lower League"),
    p("Josko Gvardiol", 84, "Professional", 88, 84, 185, 80, 88, 76, 88, "Lower League"),
  ],
 
  "Liverpool (2019)": [
    p("Alisson", 74, "Professional", 86, 84, 191, 91, 80, 84, 78, "Lower League"),
    p("Trent Alexander-Arnold", 76, "Professional", 86, 74, 175, 69, 72, 94, 82, "Kirkby (Liverpool)"),
    p("Virgil van Dijk", 95, "Leader", 88, 92, 195, 92, 78, 86, 86, "Lower League"),
    p("Joel Matip", 86, "Professional", 84, 84, 195, 85, 72, 82, 80, "Lower League"),
    p("Andy Robertson", 74, "Hard Working", 92, 78, 178, 64, 90, 72, 88, "Lower League"),
    p("Fabinho", 80, "Professional", 88, 86, 188, 78, 76, 86, 80, "Lower League"),
    p("Jordan Henderson", 76, "Captain", 90, 80, 182, 80, 76, 84, 82, "Lower League"),
    p("Georginio Wijnaldum", 80, "Hard Working", 90, 80, 175, 69, 78, 86, 82, "Lower League"),
    p("Mohamed Salah", 80, "Generational", 88, 78, 175, 71, 78, 92, 94, "Lower League"),
    p("Roberto Firmino", 82, "Team Player", 88, 80, 181, 76, 82, 88, 84, "Lower League"),
    p("Sadio Mane", 84, "Determined", 90, 80, 175, 69, 76, 88, 94, "Lower League"),
    p("Naby Keita", 72, "Professional", 86, 76, 172, 67, 80, 86, 88, "Lower League"),
    p("Divock Origi", 84, "Ice Veins", 84, 82, 185, 80, 80, 84, 88, "Lower League"),
    p("Xherdan Shaqiri", 74, "Maverick", 80, 80, 169, 72, 76, 88, 82, "Lower League"),
    p("James Milner", 78, "Hard Working", 90, 80, 175, 71, 82, 84, 80, "Leeds"),
    p("Joe Gomez", 82, "Professional", 88, 82, 188, 78, 70, 80, 88, "Kirkby (Liverpool)"),
    p("Dejan Lovren", 86, "Professional", 84, 84, 188, 84, 72, 80, 80, "Lower League"),
    p("Alex Oxlade-Chamberlain", 76, "Professional", 86, 78, 175, 70, 76, 86, 88, "Southampton"),
  ],
 
  "Leicester City (2016)": [
    p("Kasper Schmeichel", 72, "Leader", 84, 82, 189, 87, 74, 80, 70, "Lower League"),
    p("Danny Simpson", 72, "Hard Working", 86, 78, 178, 76, 66, 80, 82, "Carrington"),
    p("Wes Morgan", 90, "Captain", 82, 90, 188, 90, 68, 80, 70, "Lower League"),
    p("Robert Huth", 92, "Determined", 80, 92, 191, 93, 70, 80, 66, "Cobham (Chelsea)"),
    p("Christian Fuchs", 76, "Hard Working", 88, 80, 182, 78, 90, 70, 82, "Lower League"),
    p("N'Golo Kante", 70, "Hard Working", 96, 78, 168, 70, 76, 82, 88, "Lower League"),
    p("Danny Drinkwater", 76, "Professional", 88, 78, 178, 74, 74, 86, 78, "Carrington"),
    p("Riyad Mahrez", 68, "Maverick", 84, 68, 179, 67, 70, 92, 86, "Leicester"),
    p("Marc Albrighton", 74, "Hard Working", 90, 76, 175, 70, 74, 86, 84, "Aston Villa"),
    p("Shinji Okazaki", 82, "Hard Working", 90, 78, 174, 76, 78, 82, 82, "Lower League"),
    p("Jamie Vardy", 80, "Determined", 92, 78, 179, 74, 74, 88, 95, "Lower League"),
    p("Leonardo Ulloa", 88, "Professional", 80, 84, 188, 84, 76, 84, 74, "Lower League"),
    p("Demarai Gray", 70, "Professional", 86, 72, 178, 73, 78, 84, 90, "Birmingham"),
    p("Andy King", 78, "Team Player", 86, 78, 183, 78, 76, 82, 76, "Leicester"),
    p("Daniel Amartey", 80, "Professional", 86, 82, 185, 80, 70, 80, 82, "Lower League"),
    p("Nathan Dyer", 64, "Hard Working", 88, 68, 165, 64, 70, 82, 90, "Southampton"),
    p("Gokhan Inler", 76, "Professional", 84, 80, 182, 78, 78, 84, 74, "Lower League"),
    p("Yohan Benalouane", 82, "Professional", 82, 84, 187, 82, 72, 78, 80, "Lower League"),
  ],
 
  "Stoke City (2011)": [
    p("Asmir Begovic", 74, "Professional", 82, 84, 198, 91, 76, 80, 70, "Portsmouth"),
    p("Andy Wilkinson", 76, "Hard Working", 86, 80, 180, 74, 66, 78, 82, "Stoke"),
    p("Ryan Shawcross", 90, "Leader", 82, 90, 193, 86, 68, 82, 70, "Carrington"),
    p("Robert Huth", 92, "Determined", 80, 92, 191, 93, 70, 80, 66, "Cobham (Chelsea)"),
    p("Marc Wilson", 80, "Professional", 84, 82, 188, 80, 84, 74, 76, "Stoke"),
    p("Rory Delap", 78, "Hard Working", 88, 84, 183, 80, 72, 84, 80, "Lower League"),
    p("Glenn Whelan", 74, "Professional", 86, 80, 178, 74, 74, 82, 72, "Stoke"),
    p("Dean Whitehead", 76, "Hard Working", 86, 80, 180, 76, 72, 82, 74, "Stoke"),
    p("Jermaine Pennant", 70, "Maverick", 84, 70, 175, 70, 70, 86, 88, "Lower League"),
    p("Matthew Etherington", 72, "Professional", 84, 72, 175, 71, 88, 70, 86, "Lower League"),
    p("Peter Crouch", 97, "Team Player", 78, 80, 201, 78, 76, 86, 64, "Tottenham"),
    p("Kenwyne Jones", 90, "Professional", 84, 88, 191, 88, 74, 84, 82, "Lower League"),
    p("Jonathan Walters", 84, "Hard Working", 88, 84, 183, 80, 78, 84, 76, "Stoke"),
    p("Cameron Jerome", 82, "Hard Working", 88, 82, 180, 78, 74, 82, 90, "Lower League"),
    p("Ricardo Fuller", 84, "Maverick", 82, 84, 188, 82, 80, 84, 82, "Lower League"),
    p("Salif Diao", 78, "Professional", 84, 82, 185, 80, 72, 78, 78, "Lower League"),
    p("Danny Higginbotham", 82, "Professional", 82, 82, 183, 80, 84, 74, 72, "Carrington"),
    p("Wilson Palacios", 76, "Hard Working", 86, 82, 178, 76, 74, 82, 80, "Lower League"),
  ],
 
  "Tottenham (2017)": [
    p("Hugo Lloris", 72, "Captain", 84, 80, 188, 82, 78, 82, 80, "Lower League"),
    p("Kieran Trippier", 74, "Professional", 88, 74, 178, 71, 70, 90, 80, "Carrington"),
    p("Toby Alderweireld", 88, "Professional", 84, 84, 187, 81, 76, 88, 78, "Lower League"),
    p("Jan Vertonghen", 86, "Professional", 86, 84, 189, 86, 88, 76, 80, "Lower League"),
    p("Danny Rose", 76, "Hard Working", 90, 80, 173, 75, 88, 72, 90, "Tottenham"),
    p("Mousa Dembele", 78, "Professional", 90, 90, 187, 82, 84, 86, 82, "Lower League"),
    p("Victor Wanyama", 84, "Hard Working", 90, 90, 185, 90, 72, 82, 78, "Southampton"),
    p("Eric Dier", 82, "Professional", 86, 82, 188, 80, 74, 84, 74, "Southampton"),
    p("Christian Eriksen", 76, "Professional", 84, 72, 182, 76, 78, 92, 78, "Lower League"),
    p("Dele Alli", 84, "Maverick", 86, 80, 188, 80, 78, 86, 82, "Lower League"),
    p("Son Heung-min", 80, "Ice Veins", 90, 80, 183, 78, 92, 90, 90, "Lower League"),
    p("Harry Kane", 90, "Leader", 86, 86, 188, 86, 84, 94, 78, "Tottenham"),
    p("Heung-Min Son", 80, "Determined", 90, 80, 183, 78, 92, 90, 90, "Lower League"),
    p("Erik Lamela", 76, "Maverick", 84, 74, 184, 75, 88, 78, 82, "Lower League"),
    p("Moussa Sissoko", 78, "Hard Working", 92, 86, 187, 80, 72, 82, 88, "Lower League"),
    p("Ben Davies", 76, "Professional", 86, 78, 181, 76, 86, 72, 80, "Southampton"),
    p("Vincent Janssen", 84, "Professional", 80, 82, 187, 79, 78, 84, 76, "Lower League"),
    p("Harry Winks", 70, "Professional", 84, 70, 178, 67, 72, 84, 78, "Tottenham"),
  ],
 
  "Blackburn Rovers (1995)": [
    p("Tim Flowers", 70, "Leader", 82, 82, 188, 90, 72, 78, 68, "Southampton"),
    p("Henning Berg", 82, "Professional", 84, 82, 183, 80, 70, 80, 80, "Lower League"),
    p("Colin Hendry", 90, "Captain", 82, 88, 185, 84, 68, 80, 72, "Blackburn"),
    p("Graeme Le Saux", 76, "Professional", 88, 78, 180, 76, 90, 72, 84, "Lower League"),
    p("Ian Pearce", 84, "Professional", 82, 84, 188, 82, 70, 78, 78, "Lower League"),
    p("Tim Sherwood", 78, "Captain", 86, 80, 183, 80, 74, 86, 76, "Lower League"),
    p("David Batty", 74, "Hard Working", 88, 82, 173, 72, 74, 84, 76, "Leeds"),
    p("Stuart Ripley", 76, "Hard Working", 88, 78, 183, 78, 72, 82, 86, "Blackburn"),
    p("Jason Wilcox", 74, "Professional", 86, 74, 180, 74, 88, 70, 84, "Blackburn"),
    p("Alan Shearer", 92, "Leader", 88, 90, 183, 84, 78, 96, 82, "Southampton"),
    p("Chris Sutton", 90, "Determined", 84, 86, 188, 84, 80, 88, 78, "Lower League"),
    p("Mike Newell", 82, "Professional", 82, 80, 180, 78, 76, 84, 76, "Lower League"),
    p("Kevin Gallacher", 78, "Hard Working", 88, 74, 168, 68, 76, 84, 90, "Lower League"),
    p("Paul Warhurst", 80, "Professional", 84, 80, 183, 78, 72, 80, 82, "Lower League"),
    p("Jeff Kenna", 72, "Hard Working", 86, 76, 178, 74, 70, 80, 82, "Southampton"),
    p("Mark Atkins", 76, "Professional", 84, 78, 183, 78, 74, 80, 76, "Lower League"),
    p("Lars Bohinen", 78, "Professional", 82, 76, 183, 77, 80, 86, 78, "Lower League"),
    p("Matt Holmes", 70, "Hard Working", 84, 74, 170, 70, 84, 74, 80, "West Ham"),
  ],
};
 
/* ============================ TEAM DATABASE ============================
 * Clubs the career simulation can place the player at, keyed by tier band.
 * Each has unit ratings + a tactical style. Used to build fixtures & resolve
 * matches. Extend freely; `league` is a soft band used for transfer offers.
 * ====================================================================== */
const TEAM_DATABASE = {
  // Elite
  "Manchester City": { attack: 92, midfield: 90, defence: 86, manager: 95, tacticalStyle: "Possession", homeAdvantage: 8, league: "Elite" },
  "Liverpool": { attack: 90, midfield: 86, defence: 85, manager: 92, tacticalStyle: "High Press", homeAdvantage: 9, league: "Elite" },
  "Arsenal": { attack: 86, midfield: 85, defence: 84, manager: 86, tacticalStyle: "Possession", homeAdvantage: 8, league: "Elite" },
  "Manchester United": { attack: 84, midfield: 80, defence: 80, manager: 82, tacticalStyle: "Direct", homeAdvantage: 8, league: "Elite" },
  "Chelsea": { attack: 84, midfield: 82, defence: 82, manager: 84, tacticalStyle: "Counter", homeAdvantage: 7, league: "Elite" },
  // Europe / top half
  "Tottenham": { attack: 83, midfield: 79, defence: 78, manager: 80, tacticalStyle: "High Press", homeAdvantage: 7, league: "Europe" },
  "Newcastle United": { attack: 80, midfield: 78, defence: 80, manager: 80, tacticalStyle: "Counter", homeAdvantage: 8, league: "Europe" },
  "Aston Villa": { attack: 80, midfield: 77, defence: 76, manager: 82, tacticalStyle: "Direct", homeAdvantage: 7, league: "Europe" },
  "Brighton": { attack: 78, midfield: 80, defence: 74, manager: 84, tacticalStyle: "Possession", homeAdvantage: 6, league: "Europe" },
  // Mid-table
  "West Ham": { attack: 76, midfield: 74, defence: 75, manager: 76, tacticalStyle: "Counter", homeAdvantage: 7, league: "Mid" },
  "Crystal Palace": { attack: 74, midfield: 73, defence: 74, manager: 76, tacticalStyle: "Counter", homeAdvantage: 7, league: "Mid" },
  "Brentford": { attack: 75, midfield: 73, defence: 73, manager: 78, tacticalStyle: "Route One", homeAdvantage: 7, league: "Mid" },
  "Fulham": { attack: 73, midfield: 72, defence: 72, manager: 76, tacticalStyle: "Possession", homeAdvantage: 6, league: "Mid" },
  "Everton": { attack: 70, midfield: 70, defence: 72, manager: 72, tacticalStyle: "Park the Bus", homeAdvantage: 8, league: "Mid" },
  "Wolves": { attack: 72, midfield: 71, defence: 72, manager: 74, tacticalStyle: "Counter", homeAdvantage: 6, league: "Mid" },
  // Relegation scrap / weaker
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
 
/* Expose to game.js (works whether loaded as module or plain script). */
if (typeof window !== "undefined") {
  window.GAME_DATA = {
    MENTALITIES,
    ACADEMY_TIERS,
    PLAYER_DATABASE,
    TEAM_DATABASE,
    ACADEMY_STARTING_POOL,
    NATIONAL_TEAM,
  };
}
