# AI Enterprise: capability history

What the product can do, and when that changed. Written for Michael and anyone
deciding what to build next, in plain language. The developer record is
[RULES-AND-CALCULATIONS.md](RULES-AND-CALCULATIONS.md).

**This record starts on 5 August 2026.** Everything before that date was built
without one, and reconstructing it from commit subjects after the fact would
produce a history that reads authoritative and is not. What exists before today
is in the git log, and stays there. From today it is tracked as it happens.

One entry per day on which a capability changed. A day with only fixes,
wording or refactors gets no entry, and that is the intended behaviour rather
than a gap.

---

## 5 August 2026

**Your AI Position became real.** It used to show one worked example, the same
company for every reader, marked as a sample. Now you name any company, listed
or private, and its public sources are fetched and read while you wait, with a
progress wheel and every statement carrying the link it came from. Where the
sources say nothing, the page says nothing rather than filling the gap. The
answer is held for your session, so you can move between tabs and come back.

**The analyst can no longer invent a vendor.** It already could not invent a
figure. It turned out it could still assemble a plausible sentence naming a
company that appears nowhere in the data, which reads exactly like the real
thing. Names are now checked as strictly as numbers, against the tracked
roster.

**Decision Desk now feeds ModelEngine.** They were two separate answers to what
is really one question. The Desk works out which vendors an enterprise should
consider; ModelEngine picks the model for a given role. A switch on ModelEngine
now restricts its answer to the vendors the Desk approved, and prices what that
policy costs you against the open-market pick. Decision Desk sits above
ModelEngine in the navigation to match the order you use them in.

**A capability we had paid for became visible.** Accuracy scores were sitting
in the catalogue, measured on 145 models, better covered than two things
already on screen, and had never been given a tab. It has one now.

**Peer Insights became its own tab,** and three panels that were making Market
Watch harder to read were removed.

**You can supply figures no source holds.** Where nothing is published, the
page now lets you enter your own number, marked as yours and never mixed into
anything we publish.

**Trust Rank became a daily brief,** with the Security Desk folded into it
rather than sitting separately.

**An operator page** at `/admin`, unlinked and reachable by typing the URL,
showing what the data holds, what has run, what failed and what each run cost.

---

## Before this record began

30 July to 4 August 2026: the build itself, from an empty repository to the
product as it stands. 122 commits. Summarised rather than tracked, because it
was reconstructed afterwards:

- The dataset was ported in, then progressively replaced by live sources: real
  filings for revenue, live rankings, evidence-graded assessments in place of
  placeholders.
- Confidence scores were removed everywhere, because nobody could derive them.
- The analyst voice moved to a language model writing over figures it is not
  permitted to invent.
- The role library filled out to its full size, and a recommender was built
  that picks the cheapest model meeting a role's requirements and shows what it
  eliminated.
- Private-company revenue became a range with its assumption exposed, never a
  single invented number.
- The navigation was cut from 18 items to 13 and renamed throughout.
