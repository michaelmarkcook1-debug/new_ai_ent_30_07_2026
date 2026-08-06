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

## 6 August 2026

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
