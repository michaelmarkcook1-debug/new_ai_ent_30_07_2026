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

## 27 August 2026

**"Why now" no longer argues both ways at once, and no longer compares two
different markets.**

Three faults in how the product reasons across its own tabs, all found by
reading what it actually printed rather than what it was meant to print.

**A reason not to act was being printed as a reason to act now.** When two
datasets disagreed, the product recorded the disagreement, which is right, and
then put that same sentence in two places: under "Why now" and under "Against
this", word for word. A buyer reading the panel was told the identical fact was
why they should move and why they should not. It was live on Price /
Performance, Competitive Intel and Reputation Tracker. Why now is the case for
acting, so only evidence that argues for the recommendation can appear there.
Evidence that argues against it now appears once, under "Against this", where
it already had the effect of making the product less certain.

**The capability comparison was measuring the wrong set of companies.** The
most consequential thing this product can tell a buyer is whether the premium
they pay for a top model still buys a real lead. Price is measured across
frontier model providers, the companies you can actually buy tokens from.
Capability was being measured across all 43 tracked vendors, which includes
chip makers, cloud platforms, CRM and service-desk suppliers and sovereign
providers, most of which do not sell a model at all. The two halves were
answering different questions, and putting them in one sentence described a
market nobody had measured.

Capability is now measured twice: once across the whole tracked field, which is
what Competitive Intel wants when it asks how varied the market is, and once
across the frontier providers alone, which is the one the price comparison is
allowed to meet. Read across the frontier providers the spread is 10.6 points,
which is exactly the figure Competitive Intel already showed for those 14
companies. The page was right and the cross-tab comparison was wrong. With the
right set in place, that comparison now fires and appears on Price /
Performance as supporting evidence.

**It was pairing one company's strength with another company's problem.** The
product looked for a vendor that ranks well while carrying an open
high-severity finding, which is a genuine shortlist trap. What it actually did
was take the strongest vendor in the assessment, SAP, and the first company on
the risk register, Cerebras, and present them as a single contradiction, then
advise attaching one's findings to the other's shortlist entry. They are
unrelated companies in unrelated markets. Both halves must now be about the
same company. Against today's data nothing matches, so the product says
nothing, which is the correct outcome and better than the sentence it was
printing.

**And a five-week-old price reading can no longer create urgency.** The
benchmark behind the price comparison was captured on 24 July and is 34 days
old. It is not too old to inform a decision, and it is too old to be the reason
to act this week: a full release cycle has passed since anyone looked. The
product now separates those two questions. Evidence past its refresh window
still counts as evidence and can no longer answer "why now". Nothing was
retuned to reach this; the shelf life for that benchmark is unchanged.

What you should see: the same recommendations, with a "Why now" that only ever
gives you reasons to move, an "Against this" that is genuinely different from
it, and a capability-versus-price reading that compares like with like.

---

## 26 August 2026

**The analyst voice can no longer contradict what the product computed.**

The written analysis on every tab is produced the same way it always has been:
our own code works out the finding, and the model is then asked to say it
well. A check already existed for figures, and it is strict. Anything numeric
in the written version that was not in the computed version gets the whole
answer thrown away, and the plain computed text renders instead.

That check could only see numbers. Three ways of getting it wrong went past it
untouched, because none of them changes a number.

**It can no longer reverse the recommendation.** The three actions on Your
Pulse were handed to the model in full, so a computed "clear open risks before
widening" could come back as "widen scope now" and nothing would notice: the
figures were all still correct. What each action asks you to do is now fixed
before the model sees it. It may sharpen how the action is put and why it
matters this quarter. It may not turn a hold into a go, and it may not turn
"look into this first" into "commit", which is the quieter version of the same
problem.

**It can no longer reverse a finding.** If the computed reading says a gap is
narrowing, prices are falling, or three vendors are gaining, the written
version has to agree. It can explain what that means for you and argue about
what to do; it cannot say the opposite. Where our own reading is genuinely
mixed, saying so both ways stays allowed, because that is what the data says.

**It can no longer make up a small count.** "3 vendors meet the threshold"
used to pass when three was never one of our figures, because counts under
eleven were treated as turns of phrase rather than claims. Small numbers
attached to things we actually count are now checked like any other figure.
Numbered lists and ordinary phrasing are untouched.

**And it can only name what the page covers.** Naming a vendor was already
limited to the ones in the page's data, but a passing mention in our own
summary was enough to unlock a name for the rest of the answer. Where a page
states which vendors it covers, that list is now the boundary.

None of this is visible when it works, which is the point. When it fires you
get the computed wording instead of the written wording, which is what the
page showed before any of this was written. There is no state in which you are
shown something the product does not stand behind.

**Every recommendation now says what to actually do.**

Each tab has always ended in one of eight actions: Investigate, Monitor,
Renegotiate, Pause and so on. Those are defensible and they are a direction of
travel, not something you can do on Tuesday. "Investigate" tells you which way
to lean and leaves you to work out what that means.

Underneath the action you now get four more things, and all four are worked
out by our own code before any writing happens.

**What exactly to do.** On Price / Performance, instead of just "Renegotiate",
it now reads: route the workloads that do not need the top model to one of the
9 models reaching 80 per cent of the top score, and put the 12x input-price
difference to the incumbent before the next renewal.

**Why now.** The change, or the combination of figures, that makes it relevant
this quarter rather than in general.

**What argues against it.** This is the important one. On that same page it
says plainly that the comparison prices input tokens only, and that a real
workload's mix of input and output moves the answer. That sits next to the
recommendation rather than hidden behind a control, because a caveat you have
to go looking for is a caveat that does not do its job.

**When to change your mind.** The observable thing that should make you
reconsider: the price multiple falling below 5, a high-severity finding
closing, a vendor starting to break out AI revenue in a filing.

And where the evidence supports it, a plain "do not": do not sign a multi-year
commitment on the current benchmark lead alone. Where nothing warrants one,
nothing is written, rather than a warning being invented to fill the space.

**A recommendation can now be held back by its own evidence.** If one signal
says move and another says the implementation risk is high, the answer becomes
"look into this" rather than "go ahead", automatically. The same happens when a
conclusion rests on a single source where it should rest on several. The
strongest recommendations are only available to the pages that can actually
support them.

No confidence percentage anywhere. Those were removed from this platform on
request and they are not coming back: a score out of 100 over evidence of mixed
quality is a number with nothing behind it. What you get instead is how many
independent sources point the same way, stated in words, next to the sources
themselves.

Nothing moved on screen. No new tab, no new panel, no dashboard. The
recommendation box that was already there now has the answer in it.


**The product can now reason across its own tabs.**

Until now each tab was its own world. Competitive Intel knew capability had
converged. Price / Performance knew the price gap had not. Nobody put the two
together, because nothing in the product was allowed to look at two pages at
once.

It can now. Where a page holds readings from more than one dataset, it checks
eight specific combinations and says what they mean together. For example:

*Capability across the assessed set is narrow, while the price separation
between the top model and a qualifying alternative is wide. The two readings
come from different datasets and point the same way. A premium priced against a
capability lead is being paid into a market where that lead has narrowed.*

Neither page could say that on its own.

**It can now also disagree with itself, on purpose.** The assessment says a
vendor leads its market. The risk register says the same vendor is carrying two
open high-severity findings. Nothing upstream reconciles those, and the product
now says so out loud rather than presenting the ranking as the whole answer.

**A disagreement makes the recommendation weaker, automatically.** Where the
cross-check finds a contradiction, an action that told you to commit is pulled
back to "look into this first". It can only ever weaken a recommendation, never
strengthen one, and it does it through the same rules that already governed the
action rather than around them.

**Three rules it will not break.**

*A snapshot never becomes a trend.* Of the thirteen datasets behind this
product, exactly three carry a previous reading to compare against, and none
carries three. So most readings can only say what is true now, and the product
is not allowed to describe them as rising or falling. Where a source republishes
the same numbers unchanged, that counts as no movement rather than as movement
of zero.

*Two things moving together never becomes one causing the other.* The product
can say "coincides with" and "reinforces". It cannot say "because", "drove" or
"led to", and an answer that tries is thrown away and rewritten.

*A contradiction is never quietly dropped.* If the evidence disagrees, you see
the disagreement.

**Stale news can no longer create urgency.** The dated item beside a
recommendation was chosen purely on the source's own impact score, with no
reference to when it was published. Measured today, the winner was an article
from 31 July, twenty-six days old, sitting next to a line explaining why now.
Items now have to be from the last fortnight, and selection weighs how recent
and how relevant an item is alongside how big it is. An item with no date is
excluded rather than assumed recent. Some pages will show no dated item at all,
which is honest and was always meant to be a normal state.

**And two market claims stopped being permanent.** The analyst voice carried
five pieces of market knowledge. Three describe how this kind of market behaves
and will be true next year. Two were claims about the market right now, and this
product measures both of them on its own pages, so they had no business being
asserted from a prompt where nothing could check them. They now arrive only
where the page's own data has just confirmed them. Where the data disagrees, the
voice is told not to state them.


---

## 19 August 2026

**The Decision Desk now answers about your AI strategy, not one job.**

It used to work out a single market from the words you typed and hand back the
top three vendors in it. That is the wrong shape of answer. A retailer weighing
fraud detection, discount pricing and supplier risk is buying in three
different markets at once, and being told about one of them is being told a
third of the answer.

It now draws one leader from each of the markets your own AI areas point at.
For a food retailer that is Anthropic for agent platforms, OpenAI for the
enterprise assistant, and Oracle for customer AI.

**Which is also why it stopped answering with three frontier labs every time.**
That was never a decision, it was a side effect: whichever single market got
detected was usually the frontier one. Looking across your real markets brings
in application vendors and cloud providers, which is the mix you would actually
face.

**Their scores are not a league table, and the page says so.** Each of the three
leads a different market and is number one in it. A 3.34 in one market and a
2.25 in another are two separate readings; comparing them would be exactly the
mistake this product refuses to make everywhere else.

**Security and data are now weighed every time.** Four measures, on every vendor,
whether or not they are that vendor's strong suit: how they handle your data and
privacy, their exposure to security threats, their governance and compliance,
and their identity and access controls. Before this, the card showed what a
vendor was best at, so one that was weak on data handling simply never mentioned
it and you had to notice the silence. In the retail example Oracle leads its
market and scores 1.6 out of 5 on identity access, which is the kind of thing
nobody finds on their own.

**A wrong answer we found from your screenshot.** A luxury food retailer asking
about discount approval was told its market was developer coding tools. The
cause was ours: the keyword match looked inside whole words, so "ide" matched
inside "provide", "decide" and "outside", and almost any sentence about a
decision scored a hit for the coding market. Fixed, with the plural cases
kept working.

**Two links that did nothing now work.** "Score it against your weights" at the
bottom of a finding did not move the page when you were already on the Decision
Desk. And if you cleared the prefilled box and wrote your own words, the answer
quietly forgot which company you were carrying, even though the strip at the top
still named it.

**The five tabs now work as one path instead of five separate questions.**

Research your company on Your AI Position and everything after it knows who you
are. The Decision Desk opens with your situation part-written and its weights
already set where your sector puts them. ModelEngine opens on your industry and
the right function. Trust Rank says what your own areas make relevant. You
establish something once instead of four times.

**Your AI Position now takes a view on where AI could go.**

It used to report what the sources said and stop, so you learned what had been
written about your company and nothing about what to do with it. It now names
the areas, and it is careful about where each one comes from. An area your own
sources spoke to is marked evidenced and quotes them. An area your sector
typically runs is marked sector, which is a place to look rather than something
we found. Those two are never merged, because one is a fact about you and the
other is a fact about your industry.

The view is taken from our own workflow library rather than from an impression
of your company. The research itself is forbidden from saying anything the
retrieved pages do not contain, and that rule stays exactly as it was.

**The weighting on the Decision Desk starts where your sector puts it.** A
hospital opens weighted toward governance and away from cost; a software company
the other way. It says on screen why, and every slider is still yours to move.

**ModelEngine does not pick your role, on purpose.** It fills in your industry
and the function, which are things you already established about yourself. The
role is the question you came to ask, and a tool that answers it before you have
asked is not being helpful.

**You can now clear a company you no longer want carried.** The strip at the top
of each tab that reads "carried through" has a button beside it. Before today it
only offered to drop the vendors, so a company you had researched while trying
the tool stayed on five tabs with no way out of it except finding a list on
another page. Your AI Position also lists everything saved in your browser, with
a clear on each.

**Ask AI works when you are already on the Decision Desk.** It only ever worked
if you arrived from another tab. Clicking a question while looking at the Desk
changed the address bar and left the previous answer on screen, and so did
asking a second question after a first. Fixed.

---

## 17 August 2026

**The Decision Desk now tells you which three vendors to look at, and it is not
the AI that picks them.**

Describe your situation and the finding comes back naming three vendors, in
order, with the score out of 5 behind each and the evidence that produced it.
One button carries all three into ModelEngine, Trust Rank and Integrators, so
those pages open already narrowed to your three.

The three are chosen by the weighted assessment before the AI writes anything.
That distinction matters more than it sounds. We tested what happened when the
finding was left to name vendors itself: asked about a European bank doing
agentic onboarding, it came back with Cohere and DeepSeek, not because they fit
but because those words happened to appear near the question. Now the
assessment picks and the AI only explains.

Where it cannot tell which market you are in, it recommends nobody and asks.
That is deliberate. Three vendors from the wrong market is worse than a
question.

**A third option, Weighted score.** Alongside Quick response and Comprehensive.
It asks you nothing and goes straight to the three with every variable behind
each score. Findings are also much shorter now: they were unbounded and often
did not name a single vendor.

**Competitive Intel was telling you the opposite of what its own data said.**

The page compared vendors inside one market but calculated its headline across
all of them. TSMC, a chip foundry, was being counted as the top performer on a
page about model providers, which made the gap between leaders look far wider
than it is. So the page said capability still separates the leaders and told you
to shortlist on it.

Corrected, every one of the thirteen markets tells the same story: the leaders
have converged, and the gap in most markets is under two points out of a
hundred. The advice flips from "shortlist on capability" to "your leverage is
commercial". That is a materially different instruction, and the old one was
wrong.

The category menu was also showing seven markets out of thirteen. Workflow
automation, CRM, service management, silicon, cloud and inference were all
missing, and all six had complete data behind them the whole time.

**Financial Snapshot is roughly half the size.**

Two panels went. One showed share prices, EBITDA and "activist risk exposure",
which is written for someone buying the shares rather than the software. The
other estimated private company revenue by multiplying a valuation, on the one
page whose whole argument is that you should not treat an undisclosed figure as
known.

What stays is the finding worth having: most AI revenue claims appear in
nobody's filings, which is a procurement problem before it is a finance one.
The page is worth keeping for that. It was the machinery around it that was not.

**Smaller things.** Vendor View was opening with all thirteen categories shut,
so the page whose job is to be the evidence table showed no table. Picking a
single category did not open it either. Both fixed. Some old text that repeated
itself has gone, and two pages of dead code left behind by earlier moves has
been removed.

**Construction can now ask about the people who do the designing.**

Ask ModelEngine about construction and it used to answer for five jobs: the
civil engineer, the project manager, the site manager, the quantity surveyor and
the health and safety manager. Between them those are delivery, cost and safety.
The three disciplines that actually produce the design were missing, so a
practice full of designers got nothing back.

Architect, structural engineer and building services (MEP) engineer are now in
the library. Each was scored against its own profession's published competence
standard rather than from general knowledge: the Architects Registration Board
for the architect, the Institution of Structural Engineers for the structural
engineer, and CIBSE for building services. All three carry the Building Safety
Act duties that came in after Grenfell.

**One of the three comes back with no answer, and that is the interesting
result.** The structural engineer and the building services engineer both get a
recommendation, and both land on small, cheap models: a few pounds per person
per year. The architect does not. No model available today is good enough at
handling genuinely unfamiliar problems while also being accurate enough for work
that carries public safety duties, and those two requirements have to be met at
once. So the product says so, and names the two things blocking it, instead of
recommending something that would not do the job.

That is worth reading twice, because it is the shape of answer this product is
for. Architecture is not a job AI cannot help with at all. It is a job where the
model has to clear a bar it currently does not clear, and pretending otherwise
would cost somebody real money.

**The sector lens now covers every industry, not a third of them.**

Pick a customer-operations role and the product tells you what a named industry
changes about it: what the regulator requires, and therefore what the role has
to be able to do. Until today it could answer for six industries out of the
fifteen it can classify a company into, so two thirds of the time the honest
answer was "we have not researched that industry".

It now answers for all fifteen. 198 new findings across nine industries,
each carrying the rule it rests on and a link to it: insurance, pharma and life
sciences, legal, professional services, technology and software, manufacturing,
public sector, education and real estate.

**Nine claims were held back, and you can overrule that.** All nine are in
insurance and rest on two sources I opened and read. One is a Texas regulation
quoted accurately and about a different kind of organisation entirely: it
governs health care collaboratives, not insurers. The other is a genuine Cayman
Islands regulator page about complaints that does not mention deadlines, cited
for a claim about deadlines.

They are recorded in the file with the source and what reading it showed, so
putting them in is one edit rather than a re-run. Nothing about either is a
judgement on the sector.

**Fourteen of the findings confirm that a requirement does not move** in that
industry. Those are kept. A sector confirming a requirement is unchanged is a
research result, not an empty one.

---

## 16 August 2026

**Commentary on each tab is now ours, from that tab's data.**

Every tab picks the most relevant recent news item and shows it inside its
analysis block. It was showing the news source's own commentary underneath the
headline, under our heading, which presented somebody else's reading as ours on
nine tabs.

That would be wrong even where the commentary is right. On the OpenAI funding
item it was not right: the source's line restates that round's investors
incorrectly, and we were reprinting it.

**The headline stays exactly as the source wrote it**, attributed and linked,
because rewriting somebody's headline to correct it misattributes rather than
corrects. The line beside it is now ours, and it is calculated rather than
written, so it cannot drift from the page it sits on: where the item names
vendors this page covers it names them and says how many of the page's set that
is; where it names none, it says so, so you read it as market context rather
than as a read on the figures; where it names nobody at all, it says nothing.

It never characterises the item, because that would be asserting something the
page cannot check.

Market Watch reads, for example: "It names DeepSeek, which is among the 43 this
page covers. The figures below are what this page holds on it, and are not
derived from this item."

**Finished later the same day.** Six of the nine tabs now carry their own line.
Two of those say the item names no vendor the page covers, which is the same
mechanism reporting a real absence. The remaining three are Price/Performance,
Peer Insights and the News tab itself: the first two are about models and about
adoption rather than about vendors, so there is nothing for a line to be true
of, and inventing one to fill the slot would put a sentence there that means
nothing.

**The integrator table was ranking on the wrong number.**

That panel is headed "the integrators who would deliver your AI programme" and
was sorted on a score called AI readiness. That score measures how far a
provider has adopted AI inside its own operations. It says nothing about how
well they would deliver an AI programme for you.

The evidence was on screen the whole time: Accenture held the highest
assessment score of any provider listed and sat tenth, below firms scoring in
the sixties on that measure.

It now sorts on the assessment score, which is a weighted composite of four
dimensions with published reasoning, and Accenture is first. The other column
stays, renamed "Own AI adoption", because a services firm that has not adopted
AI itself is worth noticing. It is simply not a ranking of who would deliver
well. Neither number changed.

**The comparison is laid out as a ranking now, not a table.**

A table gave every column equal weight, which was backwards: one of them was
the rating and the rest were context. Sitting momentum, capability maturity and
reputation next to the assessment invited you to weigh them against it, when
the assessment already reads fourteen variables and each of those reads one.

It now reads the way the AI Enterprise category ranking reads. Rank, vendor,
band and score on one line. Underneath, the evidence: how many domains were
evidenced out of how many the market weighs, the weakest grade among them, and
one chip per domain showing what it scored. Hover a chip for its grade and
confidence.

**A dash is not a zero.** Where a domain had too little evidence to score it
draws a dash. It contributes nothing to the composite, but that is a fact about
the evidence and not a finding that the vendor scored nothing.

Category presence still appears and now says "context only, not the rank" on
its own line, because a share figure in a column beside a rank invites the
reading that it produced the rank.

**Known difference from the source.** The domain chips carry the same fourteen
values in a different order: AI Enterprise orders them by weight, and the
weights are not in the data we can read, so ours follow the order the source
serialises them in. The numbers are identical; the sequence is not.

**There is now one vendor rating, and it is the assessment out of 5.**

The product was carrying three ways of scoring a vendor. The vendor comparison
ranked on a single 0 to 100 figure calculated identically for every vendor. The
Decision Desk ranked on our own composite of three inputs, weighted the same in
every market. Both are gone from the ordering.

Everything now ranks on the AI Enterprise assessment, because it reads more and
guesses less: seven to fourteen evidence-graded domains depending on the market,
weighted differently for each market, every domain capped by the quality of the
evidence behind it, and any vendor with less than 60 per cent coverage withheld
rather than given a default.

**The variables came with it.** Each ranked vendor now carries the domains
behind its score: what each scored, how confident, what grade of evidence, and
up to three source links you can open. Where a domain had too little evidence it
says so rather than showing a zero, because those are different facts.

**A withheld vendor does not appear at all**, rather than appearing last. The
assessment declined to rank it, and putting it below a scored vendor would
invent an order the evidence refused to give.

The Decision Desk now reads 3.65 for Anthropic in frontier models, the same
number to the same two decimals as AI Enterprise publishes.

**The Decision Desk was missing whole markets, and now has all thirteen.**

It grouped vendors by the single label each vendor's record carries. AI
Enterprise ranks a vendor in every market it competes in, which is a different
thing: Microsoft competes in seven, Google in five, Anthropic in four.

Two effects, both now fixed. Frontier models showed twelve vendors on the
Decision Desk and fourteen in the vendor comparison, on the same page of the
same product. And three markets were absent altogether, because
"Developer/coding agent", "Agent platform" and "Neocloud & inference" are
markets a vendor is ranked in rather than the label its record happens to
carry. You could not pick them at all.

Both surfaces now read the same source, so they cannot disagree about who
competes where.

**The vendor rankings now agree with AI Enterprise v1, and show where they don't.**

Comparing the two products side by side, v1 named Anthropic the leader in
frontier models and this one named OpenAI. Both were reading the same engine.
It publishes two different scores, and we were showing the weaker one.

The one we showed is a single 0 to 100 figure calculated the same way for every
vendor, so a chip foundry and a service desk are judged on one yardstick and
everything gets a rank. The one v1 uses is scored out of 5, weighted
differently for each market, and it withholds a vendor entirely when the
evidence behind it is too thin rather than giving it a default. On that
measure, Anthropic leads frontier models at 3.65 and OpenAI is second at 3.36.

The comparison table now sorts on the better one. It briefly showed both side
by side so the disagreement was visible, and later the same day the 0 to 100
figure was removed entirely: carrying two ratings invites the question of which
to believe, and the answer is that one of them reads many variables and the
other reads one.

A vendor with too little evidence now reads "held" rather than showing an empty
cell. Those are different facts and the old blank cell conflated them: held
means the assessment looked and deliberately withheld a score.

Verified against v1's own front page across all thirteen markets: the same
leader, the same score, the same number of vendors ranked, and both of the two
cases where a vendor is held.

**A permanently empty panel was removed from AI Adoption.**

"What moved, by vendor and measure" read a catalogue endpoint that answers
"fetch failed" against production, so it could only ever show its own empty
state. The empty state was doing its job and was honest, but a panel that is
reliably honest about having nothing is still a panel with nothing in it, and
it sat above real content. The component is kept, so if that endpoint starts
answering the panel comes back in one line.

**A wrong figure about OpenAI was corrected, and one is still on screen.**

Four news items were checked against their original sources. Three held up.
One did not, and the same error had been copied into our own financial record.

The product said OpenAI's $110 billion round involved "Amazon, Microsoft and
Nvidia". Microsoft was not in it. The round was Amazon at $50 billion, Nvidia
at $30 billion and SoftBank at $30 billion, announced on 27 February 2026.

The more serious half was not the name. Our record filed that round under
"compute and infrastructure commitments, not equity rounds", which is what it
uses to explain why a number must not be turned into a revenue estimate. A
$110 billion funding round is an equity round. It was being excluded for a
reason that was not true. The financial snapshot also told you there was "no
disclosed valuation" when one had been disclosed: $730 billion before the money.
Both are now stated correctly.

**What has not changed, on purpose.** We still do not estimate OpenAI's revenue
from that valuation. We could, and we already do exactly that for Anthropic, so
this is an inconsistency rather than a principle. It is a decision about whether
a privately negotiated price is a fair basis for a revenue estimate of the
largest company in the set, and that is your call rather than ours.

**Still wrong on screen.** The news headline itself still reads "from Amazon,
Microsoft, Nvidia" on the News tab, and the paragraph above it still says
"Nvidia and Microsoft among them". That text came from the news source, not
from us, and quietly rewriting what a source said would be its own kind of
dishonesty. It needs a visible correction printed next to it, which is not
built yet.

**Asking to exclude Chinese providers now actually excludes all of them.**

The Decision Desk lets a buyer say how much foreign-jurisdiction exposure they
will accept. Until today that control could only see 13 of the 43 vendors we
score, because it read from the set of vendors whose privacy policies we had
actually fetched and quoted. A vendor outside that set was left in the ranking
rather than excluded, on the principle that not having looked at something is
not the same as having cleared it.

That principle is right, and at 13 of 43 it had a consequence nobody would
want. MiniMax is a Shanghai-headquartered AI lab, and it sat in the two thirds
we had not reached, so a reader who asked to exclude anything flagged was shown
it anyway. Jurisdiction is now established for all 43, and MiniMax is named in
the dropped list with the reason.

**The product is careful to say how it knows.** There are two kinds of answer
here and they are not equally strong. Thirteen come from the vendor's own
published terms, which say where your data physically sits. Thirty come from
public record, which establishes only which country's law reaches the company
and says nothing about where it keeps anything. Every card says which of the
two it is, and the summary line gives the split rather than one total, so
thirty of the weaker answer can never be read as thirty of the stronger.

**Two more vendors were flagged, and one deliberately was not.** G42 in Abu
Dhabi and HUMAIN in Riyadh are both owned or chaired by their states, and
neither country holds a European or UK data-adequacy decision, so both are
flagged as a consideration. TSMC is Taiwanese and Taiwan holds no adequacy
decision either, but TSMC makes chips and never holds anyone's data, so
flagging it would be noise. It is left unflagged and the note says why, rather
than sitting there looking as though it had been cleared.

A flag says a question is open, not that a country is bad. Each one carries the
facts it rests on, so you can accept the facts and still disagree with the
conclusion.

**The app now works properly on a phone, and tells you when it is working.**

A design audit walked the live app at phone, tablet and desktop. Three things
came out of it, and two more turned out not to need fixing at all.

**Twenty controls were too small to tap reliably.** The sidebar toggle, the
theme switch, the notification bell and the info icons beside every label were
all around 28 pixels, where a thumb needs 44. They now grow to 44 on a touch
device and stay exactly as they were on a desktop, so nothing moved for anyone
using a mouse. Measured after the change: zero controls left under the mark.

**Every tab now shows that it is loading.** There were no loading states
anywhere. A tab that fetches live sources sat on the previous page, motionless,
until the new one arrived whole. Trust Rank does one to two seconds of real work
at open, reading vendor status and overnight news. That silence mattered more
here than it normally would, because this product spent a week genuinely broken
with pages taking thirty-eight seconds, so a reader waiting with no feedback had
recent grounds to assume the worst. Tabs now show the shape of the page arriving
and say plainly: assembling this page, live sources are being read now.

**ModelEngine says what it is about to do with your vendors.** Take three
vendors forward on the Decision Desk, open ModelEngine, and the control that
applies them only appeared after you had picked a role. Now the page says up
front that three are approved and that it will answer twice: the model the role
needs, and the best you may buy inside your list. It stays silent for anyone who
has not been to the Decision Desk.

Two things were checked and found already right, and are recorded so nobody
spends time on them again. Every wide table on every tab already scrolls inside
its own box, so no page has ever pushed sideways on a small screen. And keyboard
focus is already drawn properly, on the modern rule that shows a ring for the
keyboard and not for the mouse.

---

## 8 August 2026

**Investment funds no longer appear where you are being told what to buy.**

The ranking engine tracks four investors beside the vendors: Andreessen
Horowitz, MGX, Sequoia and SoftBank. They belong in a market map. They do not
belong anywhere you are being advised.

Two places were showing them, and both were writing advice off the back of it.

**"Since you last looked" filled all six rows with MGX**, then wrote a
paragraph about unit economics recommending shorter commitments and priced exit
terms. Every figure behind that was an investment fund's capability score. MGX
had the joint-highest number of recorded moves of anything tracked, not because
it is important but because it is thinly assessed: with little evidence behind
it, small revisions swing its numbers hard, and it wins any list sorted by size
of movement.

**Your Pulse said "worth a dated check before renewing or widening SoftBank"**
in its momentum panel, and named SoftBank in the headline of what moved. There
is no SoftBank contract to renew.

Both are fixed. The movement line now reads "AWS gaining, Cohere gaining, AI21
Labs slipping, Groq slipping": a real vendor took the vacated place rather than
the list getting shorter.

The rule itself is not new. The vendor scores have excluded investors since
they were written, on the grounds that "is it winning, do people trust it, will
it still exist in three years" are questions about a supplier, and asking them
of Sequoia Capital is a category error. It was enforced in one place and needed
in several. It now lives in one place and every buyer-facing surface uses it.

---

**The Decision Desk asks better questions, and the shortlist can now exclude a
jurisdiction.**

Four things, all on the Decision Desk.

**It stopped repeating itself.** The engine was shown your answers but never
its own questions, so it had no memory of what it had just asked and re-used
the same opening. Two consecutive questions beginning "Across supply chain, HR
and payroll, which functions..." is what that looked like. It now sees the
exchange as pairs, is told plainly not to rephrase a question it has already
put, and is given a standard for what makes a question worth a turn: one thing
rather than three joined by "and", asked about your specific case, and only
where the two possible answers would send the finding somewhere different.

**Comprehensive now thinks harder about what to ask.** The cheapest model was
shaping every question regardless of the depth you chose, which is why a
comprehensive run still produced broad questions. Comprehensive now uses a
stronger model for the questions as well as the finding. Quick is unchanged
and still cheap.

**The finding hands you to the three vendors.** Its first link is now "Your
three vendors, and what next" rather than a list of pages to go and read.

**You can exclude a jurisdiction.** Three settings: rank everybody, exclude
hard stops, or exclude anything flagged. Choosing the strictest on frontier
models drops Alibaba, DeepSeek, Moonshot and Z.ai and promotes the next vendor
into third, so you still get three rather than a list that quietly got shorter.

Three things about that filter are worth knowing.

**It uses the vendors' own words.** Every flag comes from the Sovereignty Lens
on Trust Rank, which rests on quotes fetched from the vendors' published terms.
DeepSeek is a hard stop on its own privacy policy. The others are flagged as a
consideration because their documented hosting is Singapore while their parent
sits under PRC law, and both halves of that are shown.

**Nothing is dropped silently.** Every excluded vendor is named with the
sentence explaining why. A vendor that disappears from a ranking without a
reason is a decision made on your behalf.

**A vendor we have not assessed stays in the list.** Jurisdiction is
established for 13 of the 43 scored vendors. The rest have not been cleared,
they have not been looked at, and excluding on silence would drop most of the
market on no evidence. The panel says so in those words.

---

**The five tabs under "AI and Your Company" now carry your answers between
them.**

They were always meant to be read in order: where do we stand, what call do we
make, what does it cost for a role, what binds us, and who would deliver it.
Each one asked its question in isolation, so anyone who named their company on
the first tab had to remember it themselves on the other four.

Two things now travel, and a strip at the top of every one of the five says
what is being carried, so it is never a hidden setting.

**Your company**, once you save it on Your AI Position. Every tab after it
knows who you are and what sector you are in.

**The vendors you take forward** from the Decision Desk. A button on each of
the three cards, and one that takes all three at once. From that moment
ModelEngine prices those vendors for a role, Trust Rank reads their contracts
and tells you what changed overnight about them, and Integrators shows who
would actually deliver them.

The second half needed almost nothing new. Those three tabs already watched a
shortlist and had done for weeks: ModelEngine's own caption reads "vendors
approved on the Decision Desk", written before anything on the Decision Desk
could approve one. The list existed, the readers existed, and the step that
produced it did not. That is now connected.

---

**The Decision Desk now ends with three vendors and a plan, not with a score.**

It could tell you what your situation was and how to weigh the call, and then
it stopped, one step short of the thing anybody actually came for, which is a
name. A third step names three, puts a paragraph beside each saying why, and
then walks you through what to do about them.

**Each vendor gets its own card**: its composite score, how many of the three
inputs that score rests on, and a paragraph explaining the placing in terms of
what is actually published about it. Every sentence in that paragraph restates
a figure on the card above it. Nothing is written by a model, so the reason
cannot drift from the score it explains, and it reads the same whether or not
the analyst is reachable, which on 8 August it was not.

**It asks which market you are buying in first, and that is not a formality.**
Capability is scored against the other vendors doing the same job, so ranking a
frontier lab against a chip maker would order two different scales and mean
nothing. The list never crosses a category.

**Where a category holds fewer than three vendors, you get fewer than three and
the reason why.** Six of the ten categories are like this: CRM/customer AI has
one. Filling those cards from a neighbouring category would produce exactly the
false comparison the paragraph above avoids, so it says the gap is our coverage
rather than a verdict on the market.

**Then it guides you through the next seven steps**, from building an eval set
on your own tasks to setting the go or no-go threshold before you look at any
results. You can tick them off as you go. Nothing is stored and nothing is
reported back.

The shortlist is deliberately not a recommendation, and every card says so. It
does not price the work, does not know your stack, and has not read your
contract. Trust Rank answers the contract question and the seven steps answer
the rest.

---

**Research a company once, and the Decision Desk knows who you are.**

Until today the two tools did not speak. You could research your company on Your
AI Position, read what its sources said, then go to the Decision Desk and be
asked to describe that same company from scratch, including which industry you
are in, which the research had just established. Three changes close that.

**The outcome can now be saved.** A finished research result gets a "Save this
position" button. It is offered rather than automatic: it is your company and
your browser, and a tool that quietly keeps what you typed is a different
product from one that asks. Saving tells you what it does, which is that the
Decision Desk will open with that company already named.

**The Decision Desk opens with part of the sentence written.** It fills in who
you are, which the research established, and stops at the point only you know:
what you are actually trying to decide. Writing the whole thing would get it
submitted unread and answer a question nobody asked. The box says where the
words came from and clears in one click.

**Ask about a company you have researched, and the finding uses that research.**
Type a question naming them, whether or not you used the prefill, and what their
sources said is carried into the answer. The most visible effect is that the
engine stops asking what sector you are in when it has already been told.

Two things worth knowing about how this behaves.

**It is kept separate in the answer.** Your research came from web pages about
your company; the rest of the finding comes from this workspace's own tracked
sources. The finding says "your own research on X found ..." rather than
folding the two together and citing them alike, because they are not the same
kind of evidence and reading them as one would be the quiet sort of wrong.

**Saved positions live in this browser.** There is no sign-in here, so a
shared store would mean your saved company was whichever one the last person
looked up. That is stated on screen: clearing site data removes them, and they
do not follow you to another machine.

One known limit, and it is on screen rather than hidden. Matching your question
to a saved company is done on the name, so a company called Apple will match a
sentence about apple juice. The interface names the research it attached and
offers to drop it, so a wrong match is visible and one click from undone.

---

## 6 August 2026

**Your AI Position can now tell a bank's customer service job from a shop's,
and show you the rule that makes them different.**

Until today the product could not. The role library holds one profile per
cross-industry job, so a customer care agent read identically in investment
banking and in retail, which is plainly wrong and which the library's own
specification already recorded as a known gap.

A first piece of research closes it for the six customer operations roles:
support advisor, complaints manager, contact centre manager, service quality
analyst, operations director and customer success manager. Six sectors were
researched against the regulators' own published rules. Where a sector changes
what a job demands, the panel now says which requirement moved, by how much,
and links the statute or regulator rule it read that from.

Two things are worth knowing about what came back.

**Retail turned out to be the baseline, and that is a finding rather than a
blank.** No sector regulator imposes a complaint timetable, an approved code or
compulsory dispute resolution on general retail. Banking, telecoms, healthcare,
energy and aviation all do. That gap is the difference you feel.

**The sectors move the front line hardest.** A complaints manager is already
held to strict procedure and heavy assurance wherever they work, so there is
little left for a regulator to add. A front-line advisor moving from a shop to
a bank is the job that changes most.

Every claim carries a grade for the evidence behind it: a statute you can open,
something that follows from one, job descriptions, or judgement alone. The
reading takes the grade of its weakest input, the same way the lane badges work
everywhere else. Nothing here rests on judgement alone, and the nine sectors
not yet researched say so rather than showing an average.

The research turned up two live facts worth acting on. Ofcom cut the window
before a telecoms complaint can be escalated from eight weeks to six, on
8 April 2026, so any process still built on eight is out of date. And the EU AI
Act's transparency duty started on 2 August 2026, while the high-risk duties
were pushed back to December 2027 and August 2028 by an amendment in force on
27 July. A plan written against the original dates is now wrong in both
directions at once.

**Everything from The Security Desk now lives on Trust Rank, in one place.**
It was briefly spread across six tabs, which was the wrong call: split up it
was six additions to six products, and together it is a product. Trust Rank
asks whether you can defend a vendor choice, and every part of it answers some
piece of that. Your Pulse, News, Decision Desk, Workflow Shortlist and the
vendor profiles are back exactly as they were.

Trust Rank is now four steps rather than one long page, because it holds
sixteen things and a page where everything is present is a page where nothing
is findable. **Today** is what changed overnight and whether the labs are up.
**The terms** is what each vendor's contract permits and who can reach your
data. **Source** is who you may therefore buy from, and the pilot that proves
what the ranking cannot. **Obligations** is what the law puts on you rather
than on them, with the security posture underneath.

Your Pulse keeps Today's Pulse as its single headline judgement. A second
brief above it was competing for the same job.

---


**Your Pulse now answers what happened overnight.** It read the market well
and could tell you nothing about today. Above the market read there is now a
brief where every line pairs something that happened with what to do about it,
across security, regulation, what the labs shipped and who is quietly competing
with your suppliers. Each line links the source it came from.

**And it gives your portfolio a verdict.** Clear, watch, or action, computed
from the vendors you shortlisted and never asserted: the reason for the colour
is always printed next to it. It goes red for a live outage or a model
retirement inside thirty days on a vendor you run, amber for one landing in
thirty to ninety days, for a vendor whose contract terms score two or below out
of four, or for a legal obligation inside thirty days that binds you rather
than your vendor. With nothing shortlisted it says it has no portfolio to judge
instead of inventing one.

**You can see whether the labs are up.** Six official status pages, read at the
moment you load the page. If a page does not answer, that provider shows
nothing at all rather than a stale "operational", and the panel says how many
of the six replied. Today five answer and DeepSeek's does not, which is exactly
the case this rule exists for.

**A live security and AI feed.** Five sources: the labs' own newsrooms, two
security publications and the developer community, filtered to enterprise AI,
deduplicated and led by security. The News tab had three feeds and none of them
answered what broke in the last few hours. Anthropic publishes no public feed,
so it is absent rather than faked.

**Two taps make a corner of the Pulse yours.** Industry and region, and the
adoption picture for firms like yours fills in. Nothing is uploaded and there
is no account. You are not asked for company size, because nothing in that
dataset varies by it.

**Decision Desk has a third step: the sourcing shortlist.** Set hard
requirements, and get the vendors you may buy from ranked on their own contract
terms, with every rejected vendor saying which requirement dropped it. It
refuses to score capability, because no honest per-vendor capability number
exists, and it says so on the page rather than quietly filling the gap.

**The pilot that fills that gap.** Seven steps for proving capability on your
own data, plus the specific trap each workflow hides that a good demo will not
show you. Method, never results: nothing in it claims how any vendor performs.

**The Decision Pack.** Everything from that step as one document: the
recommendation, the shortlist, why each rejected vendor was dropped, what the
decision does not cover, the pilot and every source. It is built from the same
structure that drew the page, so a figure cannot differ between what you read
and what you hand to your board, and it is assembled in your browser and sent
nowhere.

**Workflow Shortlist can be entered from your industry.** It had 75 workflows
in 15 areas and the only way in was to know which area you wanted. Now you can
start from being a bank.

**Every vendor profile shows what that vendor's own contract permits.** Their
words, their document, their date, sitting above our assessment of them. Where
we have not read a vendor's terms, the page says so rather than showing a zero,
because a zero there would read as a verdict.

**The analyst can now answer a contract question.** The quoted vendor terms are
part of the evidence it is allowed to draw on, and they outrank everything
except a document you uploaded yourself. Asked whether a vendor may train on
your data, it now answers from that vendor's published terms with the link,
rather than from what it happens to remember.

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

**Trust Rank now says what each vendor's own contract allows.** It could tell
you what the law binds you to. It could not tell you the thing a buyer asks
first, which is what this supplier has actually committed to in writing about
our data. Fourteen model providers are now graded on four questions: will they
train on your data, how long do they keep it, will they defend you if an output
is claimed to infringe someone's copyright, and where is it processed. Every
answer is a sentence lifted out of the vendor's own published terms, with a
link to the document and the date a person read it. Nothing is scored by us.
Ten of the fourteen are answered on all four questions; five state plainly that
they offer no protection at all if an output is challenged, which is a fact
they published rather than a gap in our reading. Where we could not obtain a
document, the row says so and counts as nothing, rather than being quietly
filled in or quietly dropped.

You can also tell it what you care about. A hospital may treat where the data
lives as non-negotiable and not care about the copyright cover at all; a media
business is the other way round. Moving those priorities re-orders the table
without changing a single underlying fact, and no setting can make a vendor
that fails all four look acceptable.

**A second reading asks who can reach your data,** which is not the same
question as where it sits. A supplier can host in Singapore and still answer to
a parent company in another country, and reading only the residency line would
miss that. One provider rules out any choice of location in its own policy;
three host outside their parent's jurisdiction. This is drawn entirely from the
marks above plus public record, so the two can never tell different stories.

**How current this is now looks after itself.** Legal terms have no feed to
poll, so claiming they are "live" would be false. Instead the page counts the
days since a person last read those documents and says, on its own, when a
re-read is due. Today it reads 22 days and will turn amber at 30 without
anybody remembering to check.

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
