// Add the three construction design disciplines the library was missing.
//
// WHAT WAS WRONG. Construction & Engineering held five roles: Civil Engineer,
// Construction Project Manager, Site Manager, Quantity Surveyor and Health and
// Safety Manager. That is delivery, commercial and safety, plus one generic
// engineer. The three disciplines that actually produce the design were absent:
// the architect, the structural engineer and the building services (MEP)
// engineer. A buyer asking which model suits their design office got nothing.
//
// HOW THESE WERE SCORED. Against the published competence frameworks for each
// discipline, not from general knowledge. Evidence class D throughout, which is
// what the rest of the library carries and what the rubric means by "derived
// from role definitions rather than from statute". The frameworks read:
//
//   Architect      ARB "Tomorrow's Architects" competency outcomes. Five areas:
//                  Contextual and Architectural Knowledge, Design, Research and
//                  Evaluation, Management Practice and Leadership,
//                  Professionalism and Ethics. Outcome D5 has the architect
//                  proposing strategies across "structure, construction
//                  technology, materials, services, ventilation, thermal
//                  environment and lighting and acoustics", which is the
//                  breadth behind CAP-09. PE4 puts the health and safety of the
//                  public and building users on them, which is CAP-11 and
//                  CAP-15. RIBA Plan of Work stage 3 is "spatial coordination"
//                  and stage 4 produces "thorough drawing packages and a
//                  detailed specification", which is CAP-16 and CAP-08.
//
//   Structural     IStructE Code of Conduct: members are "employed for their
//                  high level of technical knowledge and skills, to design and
//                  provide advice for safe and serviceable structures", and
//                  undertake "only those tasks and appointments for which they
//                  are competent". Calculation is the work product, so CAP-02
//                  and CAP-06 are the highest in the set, and an undetected
//                  error is a collapse, so CAP-11 is 90.
//
//   MEP / MEPH     CIBSE Level 6 Building Services Design Engineering standard,
//                  which lists the systems in scope: "heating, ventilation, air
//                  conditioning, drainage, lighting, power, water services,
//                  controls, life-safety systems, communications and building
//                  transportation". Drainage and water services are the public
//                  health half of MEPH. Twelve system families to hold together
//                  is CAP-09 at 90; "life-safety systems" in that list is
//                  CAP-11 at 90; the work is model-led, which is CAP-12.
//
// All three carry the Building Safety Act 2022 dutyholder regime, and PAS 8671
// sets the competence threshold for the individual principal designer that an
// architect or lead engineer may hold. That is the basis for CAP-15 and CAP-10
// sitting high across the three.
//
// WHAT THIS IS NOT. It is not a claim that these scores are measured. Class D
// means derived, the same as the other 289 roles, and the frameworks above are
// what they were derived from rather than a source that states a number.
//
// Usage:  node scripts/add-construction-design-roles.mjs [--dry]

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "lib/model-fit/data/roles.json";
const DRY = process.argv.includes("--dry");

// score >= 70 is Mandatory, below is Desirable. Verified against all 5,292
// existing entries: the rule holds without exception, so it is applied rather
// than restated per capability.
const critical = (score) => (score >= 70 ? "Mandatory" : "Desirable");

const ROLES = [
  {
    role_id: "ROLE-0295",
    name: "Architect",
    industry: "Construction & Engineering",
    function: "Architecture",
    seniority: "Individual contributor",
    scores: {
      "CAP-01": 70, // ARB: every brief and site is unfamiliar; no defined procedure
      "CAP-02": 70, // design developed across RIBA stages 2 to 4
      "CAP-03": 90, // building regulations, materials, construction technology
      "CAP-04": 10, // no code
      "CAP-05": 30, // design work is reviewed, not run unsupervised
      "CAP-06": 50, // areas and cost planning, but not calculation-led
      "CAP-07": 70, // "Research and Evaluation" is a named ARB competency area
      "CAP-08": 70, // the specification is a contract document
      "CAP-09": 90, // ARB D5: structure, services, thermal, lighting, acoustics at once
      "CAP-10": 90, // building regulations compliance is not negotiable
      "CAP-11": 90, // ARB PE4: health and safety of the public and building users
      "CAP-12": 70, // BIM and CAD are the working medium
      "CAP-13": 10, // stage work measured in weeks
      "CAP-14": 30, // commercially sensitive rather than personal data
      "CAP-15": 90, // Building Safety Act dutyholder, PAS 8671 principal designer
      "CAP-16": 90, // the drawing IS the work product
      "CAP-17": 30, // client and site meetings
      "CAP-18": 10,
    },
  },
  {
    role_id: "ROLE-0296",
    name: "Structural Engineer",
    industry: "Construction & Engineering",
    function: "Structural Engineering",
    seniority: "Individual contributor",
    scores: {
      "CAP-01": 50, // more defined method than architectural design
      "CAP-02": 90, // long dependent calculation chains to a single conclusion
      "CAP-03": 90, // IStructE: "high level of technical knowledge and skills"
      "CAP-04": 30, // analysis scripting, not production code
      "CAP-05": 30,
      "CAP-06": 90, // calculation is the work product
      "CAP-07": 50,
      "CAP-08": 70, // design statements and verification records
      "CAP-09": 70,
      "CAP-10": 90, // Eurocodes and Approved Documents are prescriptive
      "CAP-11": 90, // an undetected error is a structural failure
      "CAP-12": 70, // analysis and modelling packages
      "CAP-13": 10,
      "CAP-14": 30,
      "CAP-15": 90, // IStructE: only tasks "for which they are competent"; BSA regime
      "CAP-16": 70, // reads and issues drawings, but calculation-led
      "CAP-17": 10,
      "CAP-18": 10,
    },
  },
  {
    role_id: "ROLE-0297",
    name: "Building Services (MEP) Engineer",
    industry: "Construction & Engineering",
    function: "Building Services Engineering",
    seniority: "Individual contributor",
    scores: {
      "CAP-01": 50,
      "CAP-02": 70, // load and flow calculations through a system chain
      "CAP-03": 90, // CIBSE guides across twelve system families
      "CAP-04": 30,
      "CAP-05": 30,
      "CAP-06": 90, // loads, flows, energy modelling
      "CAP-07": 50,
      "CAP-08": 50, // schedules and specifications rather than prose
      "CAP-09": 90, // heating, ventilation, drainage, power, controls, lifts, at once
      "CAP-10": 90, // regulations and standards across every system
      "CAP-11": 90, // CIBSE scope names "life-safety systems" explicitly
      "CAP-12": 90, // the work is model-led and clash-detected
      "CAP-13": 10,
      "CAP-14": 30,
      "CAP-15": 70, // BSA regime, though the dutyholder is usually the lead designer
      "CAP-16": 70, // coordination drawings and clash review
      "CAP-17": 10,
      "CAP-18": 10,
    },
  },
];

function main() {
  const roles = JSON.parse(readFileSync(FILE, "utf8"));
  const before = Object.keys(roles).length;

  for (const r of ROLES) {
    if (roles[r.role_id]) {
      throw new Error(`${r.role_id} already exists; refusing to overwrite a role`);
    }
    const profile = {};
    for (const [cap, score] of Object.entries(r.scores)) {
      profile[cap] = { score, critical: critical(score), evidence_class: "D" };
    }
    if (Object.keys(profile).length !== 18) {
      throw new Error(`${r.role_id} has ${Object.keys(profile).length} capabilities, expected 18`);
    }
    roles[r.role_id] = {
      role_id: r.role_id,
      name: r.name,
      industry: r.industry,
      function: r.function,
      profile,
      headcount: null,
      seniority: r.seniority,
      authority: null,
    };
    console.log(`  ${r.role_id}  ${r.name.padEnd(34)} ${r.function}`);
  }

  const after = Object.keys(roles).length;
  console.log(`\nroles ${before} -> ${after}`);
  const construction = Object.values(roles).filter(
    (r) => r.industry === "Construction & Engineering"
  );
  console.log(`Construction & Engineering: ${construction.length} roles`);
  for (const r of construction) console.log(`   ${r.name}`);

  if (DRY) {
    console.log("\n--dry: nothing written");
    return;
  }
  writeFileSync(FILE, JSON.stringify(roles, null, 1) + "\n");
  console.log(`\nwrote ${FILE}`);
}

main();
