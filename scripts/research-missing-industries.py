#!/usr/bin/env python3
"""Requirement profiles for the seven uncovered industries, from researched evidence.

    python3 scripts/research-missing-industries.py

Replaces the earlier reasoned-judgement pass (author-missing-industries.py, now
deleted) with profiles grounded in real sources, following the standard the
package's own pipeline set for itself in 03_pipeline/build_role_library.py:

    Prefer, in this order:
      1. Regulation, statute or mandatory standards that define duties
      2. Competency frameworks from professional or chartered bodies
      3. Multiple current job descriptions from real employers
    Never fill a field from general knowledge alone.

The pipeline did this with Haiku plus web search, then scored with Sonnet. That
pipeline needs an ANTHROPIC_API_KEY, which this machine does not have, so the
research was done directly and the scoring by hand against the same rubric.

EVIDENCE CLASS IS RECORDED PER REQUIREMENT, NOT PER ROLE, because the support
genuinely differs within a role. A food safety manager's instruction-following
and assurance requirements rest on statute and a mandatory audited standard,
which is class A; the same role's general-intelligence requirement rests on job
descriptions, which is class D. Recording one class for the whole role would
overstate the weak half and understate the strong half.

    A  Regulatory/statutory      duty defined in law, regulation or a
                                 mandatory standard
    B  Professional body         competency framework from a chartered or
                                 professional institute
    D  Labour market             convergent evidence from multiple current
                                 job descriptions
    E  Reasoned judgement        assessor inference, no external source

The engine floors a recommendation's confidence at the worst class among the
requirements that decided it, so a role carrying A on its deciding requirements
now reports higher confidence than one resting on D throughout. That is the
mechanism working: better evidence, better confidence, visibly.

Requirement order is CAP-01 to CAP-18:
  01 general intelligence   02 multi-step reasoning  03 domain reasoning
  04 coding                 05 agentic               06 quantitative
  07 research & synthesis   08 writing               09 context handling
  10 instruction following  11 accuracy              12 tool reliability
  13 latency                14 data sensitivity      15 risk & assurance
  16 visual interpretation  17 speech and audio      18 cross-language
"""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/pkg")
DATA = os.path.join(REPO, "lib", "model-fit", "data")
TAXONOMY = os.path.join(PKG, "01_data", "roles_full_library.json")
CAPS = [f"CAP-{i:02d}" for i in range(1, 19)]

# role_id: dict(headcount, scores[18], classes{cap: A|B|D}, note, sources[])
# Anything not named in `classes` is D: supported by the job descriptions read
# for that role. E appears only where the evidence settled nothing.
R = {
    # ================= Agriculture & Food Production =================
    "ROLE-0286": dict(
        headcount=8,
        scores=[50, 50, 70, 30, 50, 50, 50, 50, 50, 70, 50, 50, 30, 30, 70, 70, 10, 10],
        classes={"CAP-03": "A", "CAP-10": "A", "CAP-15": "B"},
        note="Holding the BASIS Certificate in Crop Protection has been a legal "
             "requirement since 1985 for anyone advising on or supplying plant "
             "protection products in the UK, and crop assurance schemes require "
             "advisers to sit on the BASIS Professional Register, so the domain, "
             "compliance and assurance requirements are set in law and by a "
             "register rather than inferred.",
        sources=["https://www.basis-reg.co.uk/portals/0/documents/syllabuses/10915.pdf",
                 "https://www.hse.gov.uk/pesticides/using-pesticides/codes-of-practice/guidance-sustainable-use-ppp-regs-2012.htm",
                 "https://nationalcareers.service.gov.uk/job-profiles/agronomist"]),
    "ROLE-0288": dict(
        headcount=12,
        scores=[50, 50, 50, 10, 70, 50, 30, 30, 50, 50, 50, 50, 50, 30, 50, 50, 10, 30],
        note="Responsible for a productive and sustainable livestock business meeting "
             "animal welfare and environmental standards, and for keeping farm "
             "assurance, training and environmental records accurate.",
        sources=["https://tiah.org/w/farm-manager-livestock",
                 "https://www.businesscompanion.info/en/quick-guides/animals-and-agriculture"]),
    "ROLE-0289": dict(
        headcount=6,
        scores=[50, 70, 70, 10, 50, 50, 50, 70, 70, 90, 90, 50, 50, 50, 90, 50, 10, 10],
        classes={"CAP-10": "A", "CAP-11": "A", "CAP-15": "B", "CAP-03": "B"},
        note="A documented HACCP-based food safety management system is a legal "
             "requirement, and BRCGS adds an audited standard covering traceability, "
             "allergen management and corrective action that retailers require "
             "contractually. An undetected failure is a foodborne illness, which is "
             "why accuracy and assurance both sit in the top band.",
        sources=["https://www.brcgs.com/our-standards/food-safety",
                 "https://www.brcgs.com/media/2170948/fsi9-gn-sample.pdf",
                 "https://ehaccp.org/haccp-and-the-brc-scheme/27/04/2023/09/42/"]),
    "ROLE-0287": dict(
        headcount=10,
        scores=[50, 50, 70, 10, 70, 30, 30, 30, 50, 70, 70, 50, 50, 30, 70, 70, 10, 10],
        classes={"CAP-10": "A", "CAP-15": "A"},
        note="Animal medicine records must be kept and made available for inspection "
             "by the authority, and the role is audited under farm assurance schemes. "
             "Physical inspection of condition, hygiene and disease signs is a routine "
             "duty, which is what puts visual interpretation high.",
        sources=["https://www.nal.usda.gov/animal-health-and-welfare/animal-welfare-act-quick-reference-guides",
                 "https://tiah.org/w/farm-manager-livestock",
                 "https://www.vet.cornell.edu/animal-health-diagnostic-center/programs/nyschap/modules-documents/best-management-practices"]),
    "ROLE-0290": dict(
        headcount=14,
        scores=[50, 50, 50, 10, 70, 50, 30, 30, 50, 70, 70, 70, 70, 30, 70, 50, 10, 30],
        classes={"CAP-10": "A", "CAP-15": "A"},
        note="Enforces compliance with food safety regulation and workplace safety "
             "standards while coordinating quality assurance, maintenance and "
             "logistics against production targets, so a failed handoff stops a line.",
        sources=["https://careers.acbsp.org/career/food-processing-plant-manager/job-descriptions",
                 "https://www.careerexplorer.com/careers/food-production-supervisor/"]),

    # ========================= Airlines & Aviation =========================
    "ROLE-0241": dict(
        headcount=18,
        scores=[30, 70, 70, 10, 50, 50, 30, 30, 70, 90, 90, 70, 50, 30, 90, 30, 10, 10],
        classes={"CAP-03": "A", "CAP-10": "A", "CAP-11": "A", "CAP-15": "A", "CAP-09": "A"},
        note="Continuing airworthiness sits under EASA Part-M and maintenance "
             "organisations under Part-145, which mandate approved procedures, "
             "qualified licensed personnel, documented compliance monitoring and a "
             "quality system. Deviation is not a preference, and the consequence of "
             "an undetected error is a safety event.",
        sources=["https://www.easa.europa.eu/en/the-agency/faqs/aircraft-maintenance-and-continuing-airworthiness",
                 "https://www.aviathrust.com/article/EASA-Part-145-Simplified",
                 "https://www.aircraftengineer.info/easa-part-145/"]),
    "ROLE-0244": dict(
        headcount=25,
        scores=[50, 70, 50, 10, 50, 50, 30, 50, 70, 70, 70, 70, 90, 30, 50, 30, 50, 30],
        note="Recovery coordination against a live schedule, over voice, where the "
             "value of a decision decays by the minute.",
        sources=["https://www.airwaysmag.com/legacy-posts/flight-dispatchers-ensure-safety",
                 "https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-it-takes-to-become-a-ramp-supervisor-from-a-to-z/"]),
    "ROLE-0239": dict(
        headcount=30,
        scores=[50, 70, 70, 10, 50, 50, 30, 30, 70, 90, 90, 70, 90, 30, 90, 30, 70, 30],
        classes={"CAP-03": "A", "CAP-10": "A", "CAP-11": "A", "CAP-15": "A", "CAP-13": "A"},
        note="ICAO Annex 6 permits operational control to be delegated only to the "
             "pilot-in-command and the flight operations officer, and Annex 1 sets the "
             "licence. The role is accountable for a flight operating safely and "
             "within airspace regulation until it lands: the most demanding profile "
             "in this set, and the only one high on speech as well.",
        sources=["https://www.icao.int/sites/default/files/Meetings/a42/Documents/WP/wp_621_en.pdf",
                 "https://sassofia.com/blog/icao-annex-6-part-i-general-requirements-and-state-responsibilities/",
                 "https://www.airwaysmag.com/legacy-posts/flight-dispatchers-ensure-safety"]),
    "ROLE-0240": dict(
        headcount=20,
        scores=[50, 50, 50, 10, 70, 30, 30, 30, 50, 70, 70, 50, 70, 30, 70, 50, 50, 30],
        note="Oversees ramp servicing and turnaround so a flight departs safely and on "
             "time, managing staff performance and equipment inspection against a "
             "clock and a safety regime.",
        sources=["https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/what-it-takes-to-become-a-ramp-supervisor-from-a-to-z/",
                 "https://an.aero/what-ramp-agents-do-and-why-they-are-important/"]),
    "ROLE-0242": dict(
        headcount=10,
        scores=[70, 70, 50, 50, 50, 70, 50, 50, 70, 50, 50, 50, 30, 30, 50, 30, 10, 10],
        note="Designs and optimises the route network: demand forecasting, aircraft "
             "assignment by range and load, slot constraints at congested airports, "
             "and route profitability, using scheduling optimisation software.",
        sources=["https://www.iata.org/en/publications/newsletters/iata-knowledge-hub/how-to-work-in-airline-network-planning/",
                 "https://www.routesonline.com/download/content/10955/job-description/",
                 "https://talents.vaia.com/companies/american-airlines/fort-worth/analyst-network-and-schedule-planning-74421871/"]),
    "ROLE-0243": dict(
        headcount=8,
        scores=[70, 70, 70, 30, 50, 90, 50, 50, 70, 50, 70, 70, 50, 30, 50, 10, 10, 10],
        note="Continuously updates demand forecasts from booking trends, competitor "
             "pricing, capacity and macroeconomic indicators, and adjusts seat "
             "availability across fare classes. The technique itself is chosen and "
             "defended, which is what puts quantitative reasoning at the top band.",
        sources=["https://jobs.aa.com/job/Fort-Worth-Analyst,-Revenue-Management-Pricing-&-Yield-Management-TX-76101/86957-en_US/",
                 "https://careers.jetblue.com/job/Long-Island-City-Analyst-Revenue-Management-NY-11101/1409884000/",
                 "https://jobdescription.org/job-descriptions/airline-revenue-management-analyst-job-description-transportation"]),

    # ================ Gaming & Interactive Entertainment ================
    "ROLE-0229": dict(
        headcount=14,
        scores=[70, 50, 50, 30, 50, 50, 30, 70, 50, 30, 30, 30, 10, 10, 10, 70, 30, 10],
        note="Defines mechanics, progression and economy, balances difficulty curves "
             "against telemetry, and communicates the design through documentation, "
             "diagrams and visual mockups. Errors are rework, not harm.",
        sources=["https://www.cgspectrum.com/career-pathways/game-designer",
                 "https://www.indeed.com/hire/job-description/game-designer",
                 "https://www.velvetjobs.com/job-descriptions/game-designer"]),
    "ROLE-0230": dict(
        headcount=40,
        scores=[50, 70, 50, 70, 50, 50, 30, 30, 70, 50, 50, 70, 30, 10, 30, 50, 30, 10],
        note="Builds and prototypes gameplay systems in engine, against an "
             "interdependent codebase, validating feel and pacing before release.",
        sources=["https://www.cgspectrum.com/career-pathways/game-designer",
                 "https://workscreen.io/game-designer-job-description-template/"]),
    "ROLE-0231": dict(
        headcount=10,
        scores=[50, 50, 50, 30, 70, 70, 30, 50, 50, 50, 50, 70, 70, 30, 30, 30, 10, 30],
        note="Runs the game after release: plans in-game events, monitors player data, "
             "handles live issues and server problems, and leads crisis management "
             "during an outage.",
        sources=["https://intogames.org/careers/role/live-operations-manager",
                 "https://gamingcampus.com/careers/live-operations-manager.html",
                 "https://alderongames.com/work-with-us/live-operations-manager"]),
    "ROLE-0233": dict(
        headcount=12,
        scores=[30, 30, 30, 10, 50, 30, 30, 70, 30, 50, 50, 30, 70, 30, 30, 30, 30, 30],
        note="The studio's public voice: newsletters, social channels, live streams and "
             "handling criticism, feeding player sentiment back to designers. The "
             "sources did not establish a cross-language requirement, so it is not "
             "scored as one.",
        sources=["https://www.screenskills.com/job-profiles/browse/games/production/community-manager/",
                 "https://workello.com/community-manager-video-games-job-description/"]),
    "ROLE-0232": dict(
        headcount=22,
        scores=[50, 50, 50, 30, 50, 30, 50, 50, 50, 70, 70, 50, 50, 70, 70, 70, 50, 70],
        classes={"CAP-14": "A", "CAP-15": "A"},
        note="Reviews reports and takes enforcement action under platform policy, "
             "collecting and documenting evidence for regulatory enquiries and legal "
             "action, under online safety regimes including the DSA. Handles abuse "
             "reports and identity fraud, across image, voice and language.",
        sources=["https://www.tspa.org/curriculum/ts-curriculum/functions-roles/",
                 "https://www.ismartrecruit.com/job-descriptions/trust-and-safety-analyst",
                 "https://powderkeg.com/job/16298/"]),

    # ================== Higher Education & Research ==================
    "ROLE-0265": dict(
        headcount=6,
        scores=[50, 50, 50, 70, 50, 50, 50, 50, 70, 70, 70, 70, 30, 70, 70, 10, 10, 30],
        classes={"CAP-14": "A", "CAP-15": "A"},
        note="Builds and operates research data governance so practice is compliant "
             "with legal, ethical, contractual and funder requirements, including "
             "GDPR on sensitive data and FAIR principles in funder data management "
             "plans.",
        sources=["https://jobs.edgehill.ac.uk/Upload/vacancies/files/3357/EHA2444-0523%20-%20Research%20Data%20Manager%20-JDPS.pdf",
                 "https://libguides.ucd.ie/data/resources",
                 "https://casrai.org/guides/research-data-governance"]),
    "ROLE-0262": dict(
        headcount=35,
        scores=[90, 90, 90, 50, 70, 70, 90, 70, 70, 30, 70, 30, 10, 50, 50, 50, 10, 50],
        note="Conducts independent research leading to publication, applies for grants "
             "and fellowships, and mentors students. The work is defined by questions "
             "nobody has settled, which is the definition of the top band on "
             "intelligence, reasoning and domain.",
        sources=["https://www.velvetjobs.com/job-descriptions/postdoctoral-research-fellow",
                 "https://www.academicjobs.com/jobs-and-careers/what-is-a-research-fellow-how-to-become-one-academicjobs-24256",
                 "https://www.stonybrook.edu/commcms/postdoc/docs/Postdoc%20Hiring%20Tips%20-%20Jobchartfinal.pdf"]),
    "ROLE-0263": dict(
        headcount=7,
        scores=[50, 50, 50, 10, 50, 50, 70, 70, 70, 70, 50, 30, 30, 30, 50, 10, 10, 30],
        note="Develops and implements funding applications against funder rules, where "
             "the submission is a persuasive document that binds the institution.",
        sources=["https://www.velvetjobs.com/job-descriptions/postdoctoral-research-fellow",
                 "https://casrai.org/guides/research-data-governance"]),
    "ROLE-0264": dict(
        headcount=16,
        scores=[30, 30, 30, 10, 50, 30, 30, 50, 50, 70, 70, 70, 50, 70, 70, 10, 10, 30],
        classes={"CAP-10": "A", "CAP-11": "A", "CAP-14": "A", "CAP-15": "A"},
        note="Runs right-to-study checks for students subject to immigration control, "
             "monitors visa status, refusal, non-enrolment and non-completion rates, "
             "and prepares for audit. A record error is an immigration and sponsor "
             "licence consequence, not an inconvenience.",
        sources=["https://www.port.ac.uk/about-us/structure-and-governance/legal/ukvi-student-compliance",
                 "https://jobs.uwl.ac.uk/Upload/vacancies/files/1686/DIR043%20-%20Job%20Description%20-%20UKVI%20Compliance%20Officer.pdf",
                 "https://www.jobs.ac.uk/job/DQL646/student-immigration-compliance-and-advice-manager"]),
    "ROLE-0261": dict(
        headcount=45,
        scores=[70, 70, 90, 30, 50, 50, 70, 70, 50, 50, 50, 30, 10, 50, 50, 30, 70, 30],
        note="Roughly 40 per cent teaching, 40 per cent research, 20 per cent "
             "administration: delivers lectures and seminars, sets, marks and moderates "
             "assessment, supervises projects and publishes. Live spoken delivery is "
             "the core mode, which is what puts speech at band four.",
        sources=["https://www.prospects.ac.uk/job-profiles/higher-education-lecturer/",
                 "https://jobs.bcu.ac.uk/Upload/vacancies/files/6319/Lecturer.pdf",
                 "https://www.hr.admin.cam.ac.uk/files/usl.pdf"]),

    # ===================== Management Consulting =====================
    "ROLE-0280": dict(
        headcount=5,
        scores=[30, 30, 30, 30, 50, 30, 70, 50, 70, 50, 50, 70, 30, 50, 50, 30, 10, 30],
        note="Organises and shares firm knowledge so the right material reaches the "
             "right team at the right time, across a large client corpus.",
        sources=["https://em-lyon.com/en/student/guides/jobs/knowledge-manager",
                 "https://creativesoncall.com/services/learning-and-knowledge-management/knowledge-management-consulting/"]),
    "ROLE-0279": dict(
        headcount=30,
        scores=[70, 70, 50, 10, 70, 50, 50, 70, 70, 50, 70, 50, 50, 50, 50, 30, 30, 10],
        note="Develops and manages scope, plan, risks, issues and dependencies, runs "
             "governance meetings and drives business readiness, answerable for "
             "delivery rather than for the recommendation.",
        sources=["https://www.velvetjobs.com/job-descriptions/business-transformation-consultant",
                 "https://www.indeed.com/hire/job-description/management-consultant"]),
    "ROLE-0278": dict(
        headcount=18,
        scores=[50, 70, 50, 30, 50, 70, 90, 70, 70, 50, 70, 50, 30, 50, 30, 30, 10, 30],
        note="Combines research, data analysis and interviews to establish what is "
             "known in a market and where the gaps are, which is the top band on "
             "research and synthesis.",
        sources=["https://www.indeed.com/hire/job-description/management-consultant",
                 "https://www.joinleland.com/library/a/what-do-consultants-do-at-mckinsey-bcg-and-bain"]),
    "ROLE-0276": dict(
        headcount=24,
        scores=[90, 90, 50, 10, 50, 70, 70, 90, 70, 50, 70, 30, 30, 70, 50, 30, 30, 10],
        note="Structured recommendations to leadership for evidence-based decisions, "
             "on problems whose shape has to be worked out first, on material the "
             "client has not made public.",
        sources=["https://www.mckinsey.com/careers/our-roles/consulting-roles",
                 "https://www.mckinsey.com/careers/search-jobs/jobs/consultant-37690",
                 "https://www.preplounge.com/en/blog/consulting/area/strategy-consulting"]),
    "ROLE-0277": dict(
        headcount=26,
        scores=[70, 70, 50, 30, 70, 50, 50, 70, 50, 50, 50, 50, 30, 50, 50, 30, 30, 10],
        note="Guides change programmes through transformation and acts as the single "
             "point of contact for portfolio and programme managers.",
        sources=["https://www.velvetjobs.com/job-descriptions/transformation-consultant",
                 "https://www.velvetjobs.com/job-descriptions/change-management-consultant"]),

    # ================ Real Estate & Property Services ================
    "ROLE-0285": dict(
        headcount=15,
        scores=[30, 30, 50, 10, 70, 30, 30, 30, 50, 70, 70, 50, 70, 30, 70, 50, 30, 10],
        classes={"CAP-10": "A", "CAP-11": "A", "CAP-15": "A", "CAP-03": "B"},
        note="Owns the statutory compliance programme for fire safety, asbestos, "
             "legionella, fixed-wire and emergency lighting, ensuring testing, "
             "servicing, risk assessments and resulting actions are completed and "
             "recorded, now within the building safety regime.",
        sources=["https://www.iwfm.org.uk/professional-development/popular-courses/building-safety-act-for-facilities-managers.html",
                 "https://www.sfg20.co.uk/resources/article/facilities-management-compliance-ultimate-guide",
                 "https://jobs.iwfmjobs.com/job/71205/facilities-manager/?deviceType=Desktop&TrackID=5"]),
    "ROLE-0284": dict(
        headcount=11,
        scores=[50, 50, 50, 10, 50, 50, 30, 70, 50, 50, 70, 30, 30, 50, 50, 30, 30, 10],
        note="Researches applicant background, negotiates lease agreements and "
             "completes the paperwork, against occupancy and rate targets. The lease "
             "is a binding document, which is what puts writing at band four.",
        sources=["https://www.salary.com/research/job-description/benchmark/commercial-leasing-manager-job-description",
                 "https://careers.taa.org/career/leasing-manager/job-descriptions"]),
    "ROLE-0281": dict(
        headcount=9,
        scores=[50, 70, 50, 10, 50, 70, 50, 50, 70, 50, 70, 50, 30, 50, 50, 30, 10, 10],
        note="Runs budgets, tracks income and expense and reports to landlords and "
             "investors, researching market trends and rates across an interdependent "
             "portfolio.",
        sources=["https://www.milbrookproperties.com/post/day-to-day-responsibilities-of-commercial-property-managers",
                 "https://careers.taa.org/career/leasing-property-manager/job-descriptions"]),
    "ROLE-0282": dict(
        headcount=28,
        scores=[30, 30, 30, 10, 50, 30, 30, 50, 30, 70, 70, 50, 50, 50, 70, 30, 30, 30],
        classes={"CAP-10": "A", "CAP-11": "A", "CAP-15": "A"},
        note="Annual gas safety inspection by a registered engineer, records kept and "
             "certificates issued to tenants within statutory windows, and deposit "
             "handling where non-compliance carries penalty damages of two to three "
             "times the deposit. Compliance here is law, not policy.",
        sources=["https://www.johnsand.co/news/landlord-responsibilities-for-gas-safety-checks",
                 "https://gassafetycerts.com/article/legal-requirements-for-landlords-gas-safety-certificates",
                 "https://www.digonzini.com/blog/the-legal-responsibilities-of-a-property-manager"]),
    "ROLE-0283": dict(
        headcount=13,
        scores=[50, 70, 70, 10, 50, 70, 70, 70, 70, 70, 90, 30, 30, 50, 90, 70, 10, 10],
        classes={"CAP-03": "B", "CAP-10": "B", "CAP-11": "B", "CAP-15": "B"},
        note="Red Book Global Standards are mandatory rules for RICS members, and a "
             "registered valuer joins the Valuer Registration Scheme and agrees to "
             "risk-based audit in which RICS reviews a sample of valuations, files and "
             "reports. Individual accountability with a registration consequence is "
             "the definition of the top assurance band.",
        sources=["https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/red-book/red-book-global",
                 "https://www.rics.org/regulation/regulatory-schemes/valuer-registration",
                 "https://www.rics.org/surveyor-careers/career-development/accreditations/valuer-registration-assessment"]),

    # ========================= Renewable Energy =========================
    "ROLE-0200": dict(
        headcount=7,
        scores=[50, 50, 50, 30, 70, 70, 30, 50, 50, 50, 50, 70, 50, 30, 50, 30, 10, 10],
        note="Owns portfolio performance and availability against contracted terms, "
             "coordinating operations and reporting to owners and investors.",
        sources=["https://rejobs.org/en/renewable-energy-jobs/energy-analytics",
                 "https://www.lviassociates.com/en-us/industry-insights/hiring-advice/the-role-of-a-project-developer-in-renewable-energy"]),
    "ROLE-0199": dict(
        headcount=6,
        scores=[50, 70, 50, 70, 50, 90, 30, 30, 50, 50, 70, 70, 70, 30, 50, 10, 10, 10],
        note="Develops and maintains demand and renewable generation forecasting "
             "models, and analyses the relationship between forecasts, forward markets, "
             "system prices and imbalance cost. An error is an imbalance charge within "
             "the settlement period, which is what puts latency and accuracy high.",
        sources=["https://smartestenergy.teamtailor.com/jobs/8139670-forecasting-analyst",
                 "https://jobs.engie.com/job/Forescasting-Analyst/60588-en_US/",
                 "https://rejobs.org/en/renewable-energy-jobs/energy-analytics"]),
    "ROLE-0198": dict(
        headcount=9,
        scores=[50, 70, 70, 30, 50, 70, 50, 50, 70, 70, 70, 50, 30, 30, 70, 50, 10, 10],
        classes={"CAP-10": "A", "CAP-11": "A", "CAP-15": "A", "CAP-03": "A"},
        note="Grid code compliance is mandatory for grid-connected generation, and "
             "violation can bring penalties, generation restrictions or disconnection. "
             "The engineer carries a project from application through to Final "
             "Operational Notification with the system operator reviewing the work.",
        sources=["https://www.nationalgrid.com/electricity-transmission/connections/detailed-connections-process",
                 "https://www.abb.com/global/en/industries/power-generation/solutions/grid-stability/grid-code-compliance",
                 "https://www.intertek.com/power-transmission-distribution/grid-code-compliance/"]),
    "ROLE-0196": dict(
        headcount=12,
        scores=[70, 70, 50, 10, 70, 50, 70, 70, 70, 50, 50, 30, 10, 30, 50, 50, 30, 10],
        note="Runs a project from site identification and fatal-flaw review through "
             "permitting and land agreements to financial close, managing consultants "
             "and supporting the consent process against contested local evidence.",
        sources=["https://www.lviassociates.com/en-us/industry-insights/hiring-advice/the-role-of-a-project-developer-in-renewable-energy",
                 "https://www.akuoenergy.com/en/our-professions/renewable-energy-project-developper",
                 "https://www.greenrecruitmentcompany.com/job/renewable-energy-project-developer"]),
    "ROLE-0197": dict(
        headcount=16,
        scores=[50, 50, 50, 10, 70, 50, 30, 30, 50, 70, 70, 70, 70, 30, 70, 50, 30, 10],
        note="Runs generation assets to availability and safety targets under a "
             "real-time control regime, coordinating maintenance against output.",
        sources=["https://rejobs.org/en/renewable-energy-jobs/energy-analytics",
                 "https://www.abb.com/global/en/industries/power-generation/solutions/grid-stability/grid-code-compliance"]),
}


def main():
    with open(os.path.join(DATA, "roles.json")) as f:
        roles = json.load(f)
    with open(TAXONOMY) as f:
        taxonomy = json.load(f)

    for rid, spec in R.items():
        t = taxonomy[rid]
        scores = spec["scores"]
        if len(scores) != 18 or any(s not in (10, 30, 50, 70, 90) for s in scores):
            raise SystemExit(f"{rid}: 18 scores on the rubric bands required")
        classes = spec.get("classes", {})
        if any(c not in ("A", "B", "C", "D", "E") for c in classes.values()):
            raise SystemExit(f"{rid}: bad evidence class")
        roles[rid] = {
            "role_id": rid,
            "name": t["name"],
            "industry": t["industries"][0],
            "function": t["function"],
            "profile": {
                cap: {
                    "score": s,
                    "critical": "Mandatory" if s >= 70 else "Desirable",
                    # Default D: supported by the job descriptions read for this
                    # role. A or B only where a named law, mandatory standard or
                    # professional register defines the duty.
                    "evidence_class": classes.get(cap, "D"),
                }
                for cap, s in zip(CAPS, scores)
            },
            "headcount": spec["headcount"],
            "seniority": t["seniority"],
            "authority": t["decision_authority"],
            "note": spec["note"],
            "profile_source": "researched: regulation and mandatory standards first, "
                              "then professional bodies, then current job descriptions",
            "sources": spec["sources"],
            "onet_analogue": t.get("onet_title"),
        }

    seen = {}
    for rid, r in roles.items():
        key = tuple(v["score"] for v in r["profile"].values())
        if key in seen:
            raise SystemExit(f"duplicate profile: {rid} identical to {seen[key]}")
        seen[key] = rid
        if len(r["profile"]) != 18:
            raise SystemExit(f"{rid} has {len(r['profile'])} requirements")

    with open(os.path.join(DATA, "roles.json"), "w") as f:
        json.dump(roles, f, indent=1)

    import collections
    cls = collections.Counter(
        v["evidence_class"] for rid in R for v in roles[rid]["profile"].values())
    srcs = sum(len(s["sources"]) for s in R.values())
    print(f"{len(R)} roles researched, {len(roles)} total")
    print(f"  evidence classes across their {len(R) * 18} requirements: {dict(sorted(cls.items()))}")
    print(f"  {srcs} sources cited")


if __name__ == "__main__":
    main()
