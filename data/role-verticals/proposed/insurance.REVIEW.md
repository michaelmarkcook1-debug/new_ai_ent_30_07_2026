# Insurance: class A and B claims read against their sources

Reviewed 17 August 2026. This is the gate the sync script names in its own
output: "PROPOSED, NOT MERGED. Read every class A and B claim against its
source before this goes into the pilot file."

**Verdict: do not merge as it stands.** Two of the five sources do not support
what is claimed of them, and four of the twenty-six deltas are not deltas.

26 deltas across 6 roles, 20 class A and 6 class B, resting on 5 distinct
sources. All five URLs resolve (HTTP 200). Three were read in full against the
claims; two were checked for reachability and topic only, and are marked below.

---

## 1. Four "deltas" change nothing

| Role | Capability | From | To | Class |
|---|---|---|---|---|
| ROLE-0044 | CAP-15 | 70 | 70 | A |
| ROLE-0047 | CAP-10 | 90 | 90 | A |
| ROLE-0048 | CAP-10 | 70 | 70 | A |
| ROLE-0049 | CAP-15 | 70 | 70 | A |

`from` equals `to`. The reasoning on each says as much: ROLE-0044 CAP-15
"reaffirming rather than shifting". A reaffirmation is a real research finding
and worth recording, but counting it as a delta inflates the total: 26 becomes
22, and the headline "165 class A deltas" across nine sectors is overstated by
however many of these the other eight carry.

**Action:** the script should separate `deltas` from `reaffirmed`, and the
per-sector counts should report both.

---

## 2. The Texas regulation is real, and about a different kind of entity

`28 Tex. Admin. Code § 13.492`, cited as class A evidence four times.

The claim: "Texas 13.492 seven-day deadlines" impose fixed procedural deadlines
on insurance complaint handling.

**The deadline is quoted accurately.** The section reads: "Not later than seven
calendar days after receipt of an oral or written complaint, the HCC must
(1) acknowledge receipt of the complaint in writing..."

**The scope is not.** The full path of that section is:

> Title 28 INSURANCE → Part 1 TEXAS DEPARTMENT OF INSURANCE → Chapter 13
> MISCELLANEOUS INSURERS AND OTHER REGULATED ENTITIES →
> **Subchapter E, HEALTH CARE COLLABORATIVES** → Division 10, COMPLAINT
> SYSTEMS; RIGHTS OF PHYSICIANS

"HCC" is a Health Care Collaborative, a specific Texas entity type created
under Insurance Code Chapter 848. The obligation binds those bodies, and the
section's own language is about patients, physicians and health care providers.
It is not a general Texas insurance complaint-handling rule and does not reach
a general insurance customer-operations role.

This is the failure mode the evidence grades cannot catch: the quote is
verbatim, the citation resolves, and the inference from it is still too wide.

**Action:** withdraw the four class A claims resting on it, or re-scope them to
health care collaboratives and re-grade.

---

## 3. CIMA does not mention deadlines

`https://www.cima.ky/complaints-handling-and-regulatory-expectations`, cited as
class A evidence four times.

The claim: "CIMA Corporate Governance/Internal Controls rules impose fixed
procedural deadlines".

The page is genuine, from the Cayman Islands Monetary Authority, and squarely
about complaints handling: 57 mentions of "complaint", and it does reference
Corporate Governance (4) and Internal Controls (3).

**It contains the word "deadline" zero times.** Whatever it supports, it does
not support a claim about fixed procedural deadlines on this page.

**Action:** either cite the specific CIMA rule that does set a deadline, or
drop the deadline clause and keep the governance point.

---

## 4. Quebec holds, exactly as claimed

`https://chad.ca/en/professional-practice/complaint-examination-policy`, the
heaviest source at nine class A claims.

The claim: a Quebec complaint regulation came into force in July 2025 requiring
formal complaint policies and audit-ready records.

The page states it verbatim: "Due to the entry into force of the Regulation
respecting complaint processing and dispute resolution in the financial sector
on July 1, 2025, the Chambre de l'assurance has produced the article New
Regulation on complaint handling..."

Publisher is the Chambre de l'assurance de dommages, Quebec's regulator for
damage insurance professionals. On point, current, correctly characterised.
**No action.**

---

## 5. Not read in full

Reachability and topic confirmed; the claims resting on them were not opened.

- `media.umbraco.io/.../managing-customer-vulnerability-in-insurance-...pdf`
  (CII), 2 class A claims. 1.7 MB PDF, HTTP 200.
- `dwfgroup.com/.../data-protection-act-2018-...-insurance`, 1 class A claim.
  HTTP 200. **Dated 2018**, and the claim it supports concerns DPA 2018
  Schedule 1 Paragraph 20, which is plausible for a 2018 article but should be
  checked against the statute rather than a law-firm summary of it.

---

## What this says about the other eight sectors

Three of the four problems here are structural rather than particular to
insurance, so expect them elsewhere:

1. **No-op deltas** are a script behaviour and will appear in every sector.
2. **Scope over-reach on a correctly quoted citation** is the failure the
   pipeline is least able to see. The retrieval model found a real regulation
   with a real deadline; nothing in the grading asks whether the regulated
   entity is the one the role sits in.
3. **A claim citing a page that does not contain it.** The CIMA page is about
   the right subject, which is likely why it passed.

The Quebec source shows the pipeline also does good work: nine claims on a
correctly read, correctly dated, correctly attributed regulator page.

**Recommendation:** do not merge any sector until the no-op split is fixed in
the script and every class A citation has been checked for entity scope, not
just for existence and topic.
