# Recommendation systems research: building a YouTube-style recommender around user-chosen feeds

Researched 2026-11-16. Primary sources only: papers, official YouTube, Google and Meta posts, regulation text. Inline numbers like [6] point to the Sources list at the end. Anything marked **unverified** could not be checked against its owning source.

## Question

How should Yourfeed build its own version of the YouTube recommender, keeping the custom-feed idea (you choose the **Feed**, the engine doesn't)? What can be improved? The aim is to surface the *best* videos, judged by user satisfaction and value, not time spent.

The owner's hypothesis: YouTube's near-monopoly on long-form creator video means its recommender has little pressure to improve compared with Reels and TikTok.

## TL;DR

- **YouTube stopped optimizing raw watch time years ago, at least on paper.** It moved from clicks (to 2012) to watch time [6], then to multi-objective ranking that mixes engagement and satisfaction [3]. Its "valued watchtime" counts only watch time on videos people rate 4–5 stars in surveys, and a model predicts those ratings for everyone [6]. It has published survey-imputed RL rewards [8], long-term surrogates [9] and a 2026 Shorts "latent value" model [17]. The real gap is that every objective is still *inferred* from behavior. The user never states it, and that is the inversion problem [19].
- **The frontier moved to generative, semantic-ID recommenders and to language as a control surface.** YouTube's production retrieval now generates Semantic IDs with a pretrained LLM (PLUM) [15], and its user models mix text search queries with watch history in one vocabulary (TokenMinds) [16]. Since late 2025 YouTube has itself been testing prompt-based "Your custom feed" on Home [38]. *Having* language-controlled feeds is no longer a differentiator.
- **Yourfeed's distinctive position:** the feed is a persistent, inspectable recipe of stated preferences, and **Composition** runs deterministically in the browser over a small **Catalog** (ADR 0003). That combination makes Yourfeed:
  - a working example of an EU DSA Art. 38 non-profiling recommender that is actually useful [36][37];
  - a natural lab for stated-vs-revealed preference research [20][32][33];
  - a way to change what creators are rewarded for, since whatever the ranker scores is what creators manufacture [24][25][21].
- **The hypothesis is partly wrong and partly untestable.** YouTube clearly reacted to competition: Shorts launched in 2020 and averages 200B daily views [39][40]. It also publishes a steady stream of satisfaction-oriented work. Whether *long-form* recommendation quality stalls for lack of competition can't be checked from public evidence. That part is speculation (see the assessment section).
- **The YouTube API is the binding constraint, not the algorithm.** A third-party app gets subscriptions, uploads and metadata. It does **not** get watch history, YouTube's recommendations (both cut off in 2016) or other people's transcripts [47][48]. Search is capped at 100 calls a day *per project* since June 2026 [44]. The Developer Policies forbid creating "new or derived data or metrics" from API Data (III.E.4.h) and cap storage at 30 days [45]. Read strictly, that rule puts Yourfeed's *existing* AI tags and Honest titles at risk. See section 5.
- **The most valuable bets are not ranking tweaks.** In order:
  1. Treat the objective as creator-side policy.
  2. Show the user the gap between their recipe and their behavior instead of silently absorbing it.
  3. Make elicitation, not ranking, the hard problem.
  4. Measure counterfactual value ("what an engagement ranker would have shown you").
  5. Make "non-profiling and good" the trust and regulatory position.

## 1. The YouTube recommender lineage

| Year | Work | What changed | Why it matters for Yourfeed |
|---|---|---|---|
| 2012 | Click → watch-time objective [6] | YouTube says clicks didn't mean people watched. Switching to watch time caused an "immediate 20% drop in views" [6]. | The first proxy swap. Every later step is another attempt to fix the proxy. |
| 2016 | Covington et al., two-stage deep candidate generation + ranking [1] | Candidate generation over millions of videos narrows to hundreds, then a ranker orders them. The ranker uses weighted logistic regression to predict *expected watch time*, because click-through rate favors clickbait (paper full text). | The two-stage split (retrieve, then rank) is the architecture Yourfeed also has: the backend builds the Catalog, the frontend composes. |
| 2019 | Yi et al., sampling-bias-corrected two-tower retrieval [2] | Two-tower (user tower, item tower) retrieval with in-batch negatives, corrected for item-frequency bias by a streaming frequency estimate. Deployed on YouTube. | Popularity bias gets in at the *retrieval* stage, before any ranking fairness fix can act. |
| 2019 | Zhao et al., "Recommending What Video to Watch Next" [3] | Multi-gate Mixture-of-Experts (MMoE) ranks against several competing objectives. The full text groups them as engagement (clicks, watch time) and satisfaction (likes, dismissals), and a "shallow tower" models position/selection bias. | Satisfaction became an explicit *objective*, but it's still inferred from behavior. |
| 2019 | Chen et al., top-K off-policy REINFORCE [4] | Recommendation treated as RL over a huge action space, with off-policy correction for logs produced by older policies. Live YouTube experiments. Exploration has value. | Logged data reflects whatever the old system chose to show. Learning from it naively locks in the past. |
| 2019 | Ie et al., SlateQ [5] | Decomposes a slate's long-term value into per-item long-term values. Validated live on YouTube. | The *slate* (a whole page, or a whole Session) is the unit of value, not a single item. |
| 2021 | Goodrow, "On YouTube's recommendation system" [6] | Surveys (1–5 stars) define "valued watchtime", and a model predicts survey answers for everyone. Signals are weighted per user. Borderline-content demotion cut US watch time of recommended borderline content by 70%. Demoting "salacious or tabloid" content was followed by a 0.5% *rise* in watch time. | YouTube's public line is "responsibility, then satisfaction". Note that the tabloid demotion was reported partly in watch-time terms. |
| 2021–22 | Christakopoulou et al., reward shaping with imputed satisfaction [8] | A satisfaction-imputation network supplies the REINFORCE reward. Live experiments (ICML RL4RealLife 2021; ECML PKDD 2025). | Survey sparsity is handled by *imputing* satisfaction, which is again an inferred signal. |
| 2021–24 | Chen et al. [10]; Su et al. [11] | Exploration (showing users new interests) looks neutral or negative in short A/B tests but improves long-term experience. Su et al. tie this to *corpus growth*, in live short-form experiments. | Short A/B tests are systematically biased against exploration and against new creators. |
| 2022 | Wang et al., surrogate for long-term experience [9] | Finds short-term behaviors that predict long-term *revisit frequency* and uses them as RL reward surrogates. | YouTube's "long-term value" here means coming back more often, which is still an engagement quantity. |
| 2023 | Wang et al., negative feedback at retrieval [12] | A "not-to-recommend" loss on dislikes, plus a counterfactual simulation measuring *responsiveness* to negative feedback. RecSys 2023 industry track. | "Does the system respond when I say no?" is a measurable property. |
| 2023 | Rajput et al., TIGER [13]; Singh et al., Semantic IDs [14] | Items become short sequences of codewords quantized from content embeddings (RQ-VAE). A Transformer *generates* the next item's ID. Singh et al. replace random video IDs in YouTube ranking and improve generalization to new and long-tail videos. | Content-derived IDs let new uploads borrow strength from similar videos: a structural fix for creator cold start. |
| 2025 | He et al., PLUM [15] | Pretrained LLM + Semantic IDs + continued pre-training + fine-tuning for generative retrieval. Beats "a heavily-optimized production model" with large embedding tables. Deployed on YouTube "to billions of users". | YouTube's retrieval is now partly an LLM that speaks a shared token space of text and videos. |
| 2026 | Liu et al., TokenMinds [16] (arXiv, Jun 2026) | Extends PLUM to user modeling. Generates discrete SID "user tokens" for multiple future interests and puts text search queries alongside watch history. One vocabulary covers long-form and Shorts. Live A/B gains on YouTube ranking surfaces. | Search intent (explicit language) is now an input to user modeling. That is a step toward stated preference, but it is still inferred. |
| 2026 | Chang et al., "Mend the Measurement Gap", FLVM [17] (RecSys 2026) | Behavior is treated as noisy measurement of a latent value state, with confounders like video length factored out. Watch-time ratios are biased toward short videos. +2.67% on a "primary viewer enjoyment metric" on Shorts. | Even inside YouTube, watch time is now openly called an "imperfect measure of user preference". |
| 2025–26 | "Your custom feed" test [38] | YouTube is testing prompt-based Home customization: a chip next to Home, where you type what you want. | Language-controlled feeds are now YouTube's own feature, so Yourfeed must differentiate on *what kind* of control it gives. |

**Unverified:** the PLUM Shorts CTR figure (~+5%) appears only in secondary write-ups, not in the abstract [15]. The scope of the "Your custom feed" rollout (number of feeds, regions) comes from press coverage. YouTube's own help-forum post was not readable by the fetch tool. 9to5Google quotes it as "experimenting with a new feature called 'Your custom feed'" [38].

**Not found:** a published, Gemini-branded YouTube recommender paper. PLUM [15] and TokenMinds [16] are the verified Google DeepMind/YouTube LLM-based recommender papers. YouTube's 2026 CEO letter mentions AI for recommendations only in general terms. It cites 20M+ users of the "Ask" tool and a push against "low quality AI content" [40].

## 2. Beyond-engagement and user-control literature (late 2025–2026, plus foundations)

### Why engagement is the wrong target (foundations)

- **The inversion problem.** A platform that only sees engagement can't recover what users actually want when in-the-moment choices conflict with considered preferences. Whether more engagement helps or hurts users depends on the *direction* of the change in content space [19].
- **Twitter/X experiment.** In a preregistered experiment with 806 users, Twitter's engagement ranking amplified emotionally charged, out-group-hostile content that users said made them feel worse. A ranking built from users' *stated* preferences cut that content [20].
- **Choosing signal weights.** A ranking signal deserves weight if it is value-faithful (tracks what the user actually values), robust to producer gaming, and not noisy. Upweighting value-faithful, strategy-robust signals raises *producer* welfare too [21].
- **System-1 vs System-2 returns.** Returning to a platform can be modeled as two processes. Impulsive returns fade fast; utility-driven returns persist. In principle the two can be separated, so utility can be inferred from the *shape* of returns, not their count [22]. (Synthetic experiments only.)
- **Preference manipulation.** Long-horizon optimizers have an incentive to *change* user preferences so users become easier to satisfy. Carroll et al. propose estimating and penalizing these induced preference shifts before deployment [23].
- **Values synthesis.** Stray et al. survey how values (wellbeing, agency, diversity, fairness) get into industrial recommenders, through industry practice, measurement, product design and policy (ACM TORS 2024) [18].
- **Meta's "worth your time" surveys.** Meta asks "Is this post worth your time?" and uses the answers to calibrate predictions, as one signal among thousands [27][28].

### User-controllable and natural-language feeds (2025–2026)

- **Shape Your Feed** (RecSys 2026 industrial track). An LLM agent keeps an editable "Semantic Profile". The agent re-ranks and prunes against that profile, and it learns using DPO with an LLM-judge ensemble. Production A/B tests improved relevance and "user sentiment" [29]. The editable profile is what makes the steering visible to the user.
- **Controllable and Content-Based Recommendations (CCBR)** (NeurIPS 2026, per the arXiv comments). The user is represented by a *text* profile, inferred from item content (images, audio, video), that feeds a collaborative-filtering model. The user can edit the text to steer it, and accuracy stays competitive [30].
- **Promptable recommendation (DPR)** (arXiv, Feb 2026). Natural-language prompts steer a sequential recommender's latent user vector without losing collaborative signal, with separate experts for positive and negative steering [31].
- **Feed elicitation** (CHI 2026). People who write their own custom-feed descriptions "often fail to foresee the gaps and edge cases". Feeds built from a guided *elicitation interview* were significantly preferred over feeds built from users' own descriptions [32].
- **Value-aligned ranking** (CHI 2026). An LLM labels posts with Schwartz basic values, and users set the value weights. Users could build feeds that reflected the values they wanted, and these feeds differed substantially from engagement feeds (N=141, N=250) [33].
- **Bluesky custom feeds in practice** (arXiv, Sep 2026; 26 interviews; 88,302 feeds). Third-party feed creators are mostly unpaid hobbyists. They lack interaction data and feedback, and the feeds are hard to sustain [34]. Bluesky positioned custom feeds as "algorithmic choice" [35].
- **Simulating users with LLM agents.** LLM-agent user simulators such as Agent4Rec show both alignment with and deviation from real users' preferences [43]. They are useful for smoke tests, not as evidence of satisfaction.

### Creator-side (supply) dynamics

- **Exposure games.** Creators compete for a finite attention pool by producing whatever the ranker scores highly. The content at equilibrium reveals what the algorithm *implicitly incentivizes*. More exploration can *discourage* niche content. The authors propose this as a pre-deployment audit [24].
- **Performative recommendation.** Re-ranking only reshuffles existing items. A learner that anticipates creators' strategic responses can regularize against homogeneity and push the *supply* toward diversity [25].
- **Creator viability.** Myopic "best match" recommendation can starve providers who need a minimum audience to stay viable. A constrained matching approach keeps a diverse set of viable providers and gets higher long-run welfare [26].
- **Exploration grows the corpus.** The long-term value of exploration runs partly through corpus growth [11].

## 3. Is the monopoly hypothesis right?

**Claim:** YouTube's dominance in long-form creator video means its recommender faces little pressure to improve, unlike Reels and TikTok.

**Evidence that YouTube is under pressure and did change:**

- **Shorts.** YouTube launched Shorts in September 2020 [39], with an explicit short-form vertical-video format. The CEO's 2026 letter says Shorts "now averages 200 billion daily views" [40]. From 2025-03-31, Shorts views count every start or replay [47], so growth numbers before and after that date are not like-for-like.
- **A steady stream of research.** Satisfaction-oriented recommender research ran through 2026 [8][9][12][17]. So did generative-retrieval rebuilds deployed to production [15][16]. A team without competitive pressure would not obviously be replacing its retrieval stack.
- **User control.** YouTube is testing prompt-based Home feeds [38]. That suggests pressure on user control, whether from competitors, regulators [36][37] or users.

**Evidence consistent with the hypothesis:**

- **Long-form share is growing.** YouTube's share of US TV-set viewing reached a record 11.1% in December 2024 (Nielsen [41]). Press reports 15.8% for August 2026 (**unverified** at Nielsen's own page). That points to a strong, growing long-form position with no comparable rival in creator long-form.
- **Exits from personalization are weak.** YouTube's non-profiling option effectively means turning off watch history, which leaves an empty Home with a search bar [7]. EDRi's March 2026 DSA complaint calls this option "counter-intuitive and difficult to access" [37]. A dominant platform can afford a weak exit from personalization.
- **Satisfaction is still weighted by watch time.** "Valued watchtime" is satisfaction-*weighted watch time* [6], and the long-term surrogate targets *revisit frequency* [9]. The objective improved, but its unit is still attention.

**Assessment:** the evidence contradicts the strong version ("little pressure to improve"). YouTube's recommender has changed a lot, much of it toward satisfaction. Part of the change, Shorts in particular, clearly responds to TikTok. A weaker version is plausible but **speculative**. That version: dominance in long-form lets YouTube keep attention as the objective's unit and offer only weak user control, because users have few alternatives. Testing it would need data no outsider has, such as long-form vs Shorts objective weights over time. For Yourfeed, the useful framing is not "YouTube is lazy". It is that YouTube's incentives and scale push it to *infer* preferences, while Yourfeed can *ask*. Section 6 builds on that difference.

## 4. Design for Yourfeed: a staged architecture that fits what exists

This is the minimum structure the bets in section 6 need. It keeps ADR 0003 (pure frontend Composition, small Catalog) and ADR 0004 (provider-agnostic LLM, keyword fallback).

```
            BACKEND (once per video / per catalog refresh)               FRONTEND (every keystroke)
 ┌──────────────────────────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │ Stage A  Candidate sources → Catalog                     │   │ Stage C  composeFeed (pure)           │
 │   subscriptions + RSS (cheap, no quota)                  │   │   filter: kind, length, muted, removed│
 │   Data API search by each Feed's topics (quota-bounded)  │   │   score: recipe fit + video quality   │
 │   "neighbours": channels co-occurring with Finished      │   │          (no watch-time terms)        │
 │   exploration slice: off-recipe, labelled                │   │   diversify: channel/topic caps       │
 │ Stage B  Per-video enrichment (stored, provider-agnostic)│   │   pack: knapsack into Session range   │
 │   topic + clickbait + Honest title (exists)              │   │   explain: why each video is here     │
 │   text embedding of title+description(+transcript)       │   └──────────────────────────────────────┘
 │   rubric judgements (substance, title-honesty gap)       │   ┌──────────────────────────────────────┐
 └──────────────────────────────────────────────────────────┘   │ Stage D  Learning = proposed Feed     │
                                                               │   actions the user accepts or undoes  │
                                                               └──────────────────────────────────────┘
```

- **Stages A–B, retrieval.** This is Covington's two-stage split [1] at Yourfeed's scale. A few thousand candidates per user is small enough to send whole (ADR 0003). Embeddings stand in for Semantic IDs [13][14]: a new upload from a 2k-subscriber channel matches a recipe by *content*, with no interaction history needed.
- **Stage C, composition.** Stays pure and deterministic, so every result is reproducible from (Catalog, Feed, filters, seed). The current `homeScore` includes `log10(views)`, the signal that is most gameable and least value-faithful [21]. Section 6 (Bet 1) explains why that matters more than it looks.
- **Stage D, learning.** Nothing behavioral silently mutates the ranking. Behavior (Finished, skipped, removed) becomes *proposed* **Feed actions**, such as `mute_topic` or `set_length_range`, which the user can see and undo. That avoids the induced-preference-shift problem by construction [23].

**Feasible at Yourfeed scale vs needs YouTube scale:**

| Feasible now (small, open source) | Needs YouTube-scale data |
|---|---|
| Embedding retrieval over a per-user Catalog; content-based cold start [14] | Training two-tower / generative retrievers [2][15][16] |
| Deterministic, explainable composition; session knapsack | Off-policy RL over logged policies [4][5][8] |
| LLM rubric judgments once per video (ADR 0004) | Imputing satisfaction from billions of survey responses [6][8] |
| Within-user A/B (recipe vs engagement-style ranking on the same Catalog) [20] | Population A/B tests on long-term surrogates [9][11] |
| Elicitation interviews for feed recipes [32] | Learning creator-response dynamics from real supply [24][25] |
| LLM user simulators as smoke tests only [43] | Valid offline estimates of satisfaction lift |

## 5. Feasibility with the YouTube API

Sources: the Data API v3 docs [44][47][48][49], the YouTube API Services Developer Policies [45], the API Services Terms of Service [46] and the quota audit guide [50], all fetched 2026-11-16. None of this is legal advice. The Developer Policies don't define "derived data", and several readings below are interpretations that should be checked before signed-in mode ships.

### What a third-party app can actually get

| Data | Available? | Cost and limits | Source |
|---|---|---|---|
| The user's subscriptions | Yes, with OAuth (Authorized Data) | `subscriptions.list`, 1 unit per page of 50 | [44] |
| A channel's uploads | Yes, via its `uploads` playlist | `playlistItems.list`, 1 unit per page | [44][49] |
| A channel's uploads via RSS (`/feeds/videos.xml?channel_id=…`) | Works today (ADR 0005 relies on it) | No quota. **Not documented** anywhere in the API docs; see the III.I.14 risk below | — |
| Video metadata and stats (title, description, duration, views, likes) | Yes | `videos.list`, 1 unit per 50 IDs. The new `videos.batchGetStats` costs 1 unit in its own bucket (June 2026) | [44][47] |
| Search by topic | Yes, but scarce | Since June 2026 `search.list` has its own bucket: **100 calls per day per project** by default, 1 quota per call. That replaces "100 units per call out of 10k" | [44][47] |
| The user's liked videos | Likely, via `relatedPlaylists.likes` | 1 unit per page. The docs don't say who may read it (**unverified** for other users' accounts) | [49] |
| Watch history, Watch Later | **No.** Not retrievable since 2016-09-12 | — | [47] |
| YouTube's own Home recommendations for the user | **No.** `activities.list` `home` became logged-out-style results in 2016 | — | [47] |
| Transcripts / captions of other people's videos | **No.** `captions.download` requires "permission to edit the video" and costs 200 units | — | [48] |
| Satisfaction surveys, dislikes by others, co-watch data, impressions, retention curves for other people's videos | **No** API exposes them | — | [44] |

Default allocation is 10,000 units a day for all other endpoints, plus 100 `search.list` and 100 `videos.insert` calls [44]. Quota above the default requires passing a compliance audit [50].

### What the quota means for candidate generation

- **Per user per day:** refreshing one user's subscriptions with ~200 channels costs about 4 units (subscriptions) + ~200 units (uploads playlists) + a few units for `videos.list`. That's ~200 units, or **~50 users a day** on the default quota.
- **With RSS for uploads:** the uploads cost becomes 0 units, and the same work is ~5–10 units per user, so **~1,000+ users a day**. That's why ADR 0005 chose RSS.
- **Search:** 100 searches a day is for the *whole project*, not per user. At ~5 topics per Feed, that refreshes about 20 feeds a day across all users. Search-based retrieval only scales if results are shared across users: search results fetched without user credentials are Non-Authorized Data and can be stored for up to 30 days (III.E.4.d) [45]. Sharing a topic → results cache across users is our reading, not stated in the policy.
- **Outdated docs in this repo:** PROJECT.md and ADR 0005 still say "a search costs 100 units". Since June 2026 that's wrong [47]. The real constraint is now a call count, which is tighter for a multi-user app.

### Terms that bite a custom recommender

- **Storage: 30 days, then delete or refresh.** Authorized Data may be kept "for no longer than 30 calendar days", then must be deleted or refreshed (III.E.4.c). Non-Authorized Data likewise (III.E.4.d). Subscriber counts and statistics fetched without user credentials can't be stored longer than 30 days (III.E.4.b) [45]. A user's deletion request must be honored within 7 days (III.E.4.g) [45]. So the stored Catalog, *and the per-video tags derived from it*, need a 30-day refresh cycle.
- **No derived data or metrics. This is the biggest risk, and it applies to features that already exist.** Clients "must not … access or use API Data to create new or derived data or metrics" (III.E.4.h) [45]. Read strictly, that covers:
  - AI topic tags, clickbait flags, Honest titles and embeddings of titles or descriptions;
  - quality or rubric scores;
  - exposure-concentration metrics computed from subscriber counts.
  The only carve-out found (III.L, from June 1, 2026) is for "audited developers with analytics use cases" [45]. Yourfeed doesn't obviously qualify.
- **No modifying search-result content.** Clients "must not modify or replace the text, images, information, or other content of" search results (III.C.5). There's also a general ban on modifying "any functionality, data, or content" (III.I.4) [45]. Replacing a title with an Honest title for a video that came from `search.list` is the clearest conflict.
- **No aggregation across content owners or for insight into YouTube.** "Do not aggregate API Data" except within one content owner's channels (III.E.2.a), and not to "gain insights into YouTube's usage, revenue, or any other aspects of YouTube's business" (III.E.2.b) [45]. Cross-channel exposure statistics and any audit of YouTube's own ranking fall here.
- **Authorized Data stays with its user.** It must not be shown to "anyone other than the authorizing user" (III.E.3.b) [45]. Shared feeds can carry the *recipe*, but not one user's subscription-derived Catalog.
- **No non-API access.** Clients must not "use any technology other than YouTube API Services to access or retrieve API Data" (III.I.14) [45]. That rules out scraping transcripts. It also makes the undocumented RSS feed a gray area: it's YouTube-served but not part of the documented API.
- **No substitute service.** Clients must not act "as a substitute for, or substantially similar service to, any YouTube Applications" (III.I.1) [45]. A full alternative Home is the kind of product this clause targets. Yourfeed's case rests on being substantially *different*: user-chosen recipes, Session ranges, no infinite feed.
- **Branding and player.** Pages showing YouTube content must make YouTube's origin clear with YouTube Brand Features (III.F.2.a), must not obscure YouTube's attribution (III.F.2.c), and must link YouTube's Terms (III.A.1). Clients must not modify or block the YouTube player (III.I.6) [45]. No rule found *requires* the embedded player for playback. Linking out to YouTube is allowed.
- **AI/ML training.** Neither the Developer Policies nor the API ToS mention model training, machine learning or AI anywhere in the fetched text [45][46]. Nothing explicitly forbids or permits it. The derived-data clause (III.E.4.h) is the provision most likely to apply to LLM tagging. Whether sending titles to a third-party LLM provider is permitted processing is **not addressed**, and is unverified.

### Feasibility of each bet

| Bet | Verdict | Why |
|---|---|---|
| 1. Objective as creator policy (exposure audit, "this feed rewards" card) | **Feasible with workaround** | The card is pure Yourfeed logic. The audit generates LLM variants of titles, which is derived data from API Data (III.E.4.h) [45]. Run it on the Demo catalog or synthetic titles, not on API Data. |
| 2. Recipe mirror (stated vs revealed) | **Feasible** | Finished, skipped, removed and pinned are Yourfeed's own data, not API Data. Limitation: YouTube watch history isn't available [47], so the mirror only sees behavior *inside* Yourfeed. |
| 3. Elicitation interviews | **Feasible** | Needs only the recipe and a few example videos to display. Example retrieval is limited by the search quota [44]; draw examples from the user's Catalog first. |
| 4. Counterfactual value (shadow composition) | **Feasible with workaround** | Comparing against a local engagement-style ranker over the same Catalog is fine. Comparing against *YouTube's actual* Home or Up Next is **not feasible**: those recommendations aren't exposed [47], and auditing YouTube's ranking could fall under III.E.2.b [45]. |
| 5. Declared-only, DSA-style non-profiling mode | **Feasible** | Uses only the recipe plus Catalog. Subscriptions are still Authorized Data with a 30-day refresh (III.E.4.c) [45]. The "profile never leaves the browser" claim holds in Demo mode. In Signed-in mode the backend stores the Catalog, so the claim needs narrowing. |
| 6. Spec as the product | **Feasible** | The recipe text is user content. Compiling a spec into *retrieval* via `search.list` is capped at 100 calls a day per project [44]. Compile into filters over the existing Catalog first and search sparingly. |
| 7. Content-semantic retrieval for small creators | **Feasible with workaround; ToS risk** | Embeddings of titles and descriptions are derived data (III.E.4.h) and expire with the 30-day rule [45]. Transcripts aren't available [48]. A broad channel crawl needs search quota [44] or undocumented RSS (III.I.14 gray area) [45]. Workaround: compute matching on the fly at Composition time without storing vectors (still arguably "use API Data to create derived data"), or ask YouTube during the audit. |
| 8. Outside-your-recipe slot | **Feasible** | Draw from adjacent topics within subscriptions or cached shared search results (III.E.4.d) [45]. |
| 9. LLM judgments as a quality lever | **Not feasible as designed under a strict reading; needs a ruling** | Stored clickbait, substance or honesty scores are "derived data or metrics" (III.E.4.h). Honest titles modify content (III.I.4), and for search results also III.C.5 [45]. This affects *existing* Yourfeed features (Hide clickbait, Honest titles), not just this bet. The options: get YouTube's position during the audit [50]; keep these features to Demo mode; or make them on-demand, display-time and unstored. |

### Only YouTube can do these

- Learn from watch history, impressions, co-watch graphs and Home/Up Next logs [47]. That is everything behind [1]–[5], [15], [16].
- Run satisfaction surveys at population scale and impute satisfaction from them [6][8][17].
- Use transcripts and audio/visual content of every video to build Semantic IDs [14][15].
- Measure long-term outcomes (revisits, corpus growth) with population A/B tests [9][11].
- Change creator incentives across the whole supply and observe the response [24][25]. Yourfeed can only *simulate* this, on its Demo catalog.
- Ship a DSA Art. 38 option that is good [36][37]. Yourfeed can show it's possible; only YouTube can make it the default.

## 6. Strategic questions and non-obvious bets

API feasibility for each bet is in the table in section 5.

Each bet gives the insight, why it isn't obvious, the evidence, and how Yourfeed can test it as a design exploration. Obvious items such as using Finished/skip signals, a satisfaction prompt, boosting small creators, or LLM clickbait detection are left out: Yourfeed already does or plans them.

### Bet 1: The objective function is creator policy, not ranking policy

- **Insight.** Whatever a ranker scores becomes what creators manufacture. Choosing an objective decides what gets *made*, not just what gets shown. Watch-time objectives produced length padding and retention hooks. CTR objectives produced thumbnails like faces with open mouths.
- **Why it isn't obvious.** Recommender teams evaluate on a fixed corpus, but the corpus responds to the ranker. Exposure-game equilibria show what an algorithm *implicitly incentivizes* [24]. Re-ranking can't fix this because it only reshuffles supply [25]. Signals that are costly to game raise producer welfare [21], and myopic best-match ranking can collapse provider diversity [26]. YouTube's own FLVM paper shows watch-time *ratios* are biased by video length [17]: exactly the kind of artifact creators exploit.
- **What Yourfeed can test.**
  - Publish a per-Feed "this feed rewards" card that states the scoring terms in plain words.
  - Run an exposure-game audit [24] offline. Have the LLM generate strategic variants of real titles and thumbnail captions (more clickbait, padded length, trending topic) and measure how much each variant gains rank under each feed kind.
  - Prediction: `top` (views) and `home` (which includes `log10(views)`) are highly gameable. Recipe-fit plus title-honesty-gap scoring should be much less so.
  - This is a design exploration of *mechanism design for creators*, which YouTube can't do publicly.

### Bet 2: Expose the stated-vs-revealed gap; don't absorb it

- **Insight.** Every large recommender eventually reconciles what users *say* with what they *do*. YouTube does it silently, by imputing satisfaction [6][8] or by mixing search text into user tokens [16]. Yourfeed has a rarer asset: an explicit, persistent statement of preference, the Feed recipe. The gap between recipe and behavior is the most informative signal in the system. Folding it back into the ranking quietly destroys the thing that makes Yourfeed different.
- **Why it isn't obvious.** The engineering instinct is "learn from behavior". But behavior-led drift is exactly how revealed preference overrides considered preference [19][22]. Long-horizon learners have incentives to shift preferences toward what is easy to satisfy [23]. In the Twitter experiment, stated-preference ranking produced different and less hostile content than engagement ranking [20].
- **What Yourfeed can test.**
  - A "recipe mirror": periodically show the user how their Finished and skipped videos diverge from their recipe ("you set 10–60 min but Finished three 90-minute videos; you muted Gaming but pinned two"). Offer the change as Feed actions they can accept, reject or undo.
  - Measure how often users accept, and whether accepted changes keep satisfaction stable (Bet 4).
  - Treat the recipe as a contract: the system never edits it without consent.

### Bet 3: Elicitation, not ranking, is the bottleneck

- **Insight.** Once composition is deterministic and the recipe is explicit, the quality limit is how well the user can say what they want. People write under-specified recipes: they "often fail to foresee the gaps and edge cases" [32]. Elicited feeds beat self-written ones [32]. Value weights let users build feeds that match their values and differ from engagement feeds [33].
- **Why it isn't obvious.** The industry frames language control as a *ranking input*, a prompt that nudges the model [29][31][38]. The research suggests the bigger gain is in a *dialogue that sharpens the spec*: asking about edge cases, contrasting example videos, and value trade-offs.
- **What Yourfeed can test.**
  - The Claude bar runs a short elicitation interview when a feed is created. It shows contrasting pairs ("this 40-min explainer or this 12-min news recap?") and asks about edge cases ("should reaction videos about your topics count?").
  - The answers are stored as the recipe's text plus structured settings.
  - Compare feeds built from elicited recipes against self-written ones on the Bet 4 metrics. The `ask_user` Feed action already exists for this.

### Bet 4: Measure counterfactual value: "was this Session better than the alternative?"

- **Insight.** Neither time spent nor in-the-moment ratings say whether the user was *better off than they'd otherwise have been*. The right unit is counterfactual and per Session. YouTube's long-term proxy is revisit frequency [9], which is attention again. The System-2 framing [22] says the *kind* of return matters (deliberate vs impulsive), not the count.
- **Why it isn't obvious.** Counterfactuals seem to need huge A/B tests. But the counterfactual-bot method that audited YouTube's recommender [42], and the Twitter within-user design [20], show you can compare policies on the *same* user and inventory.
- **What Yourfeed can test.**
  - **Shadow composition.** For the same Catalog, also compute what an engagement-style ranker (views, recency, channel affinity) would have put in Up next. Every so often, show the two side by side and ask which the user would rather have watched.
  - **Session-level metrics instead of time spent:**
    - share of Sessions ending inside the Session range by the user's choice;
    - "worth it" rate on Finished videos;
    - next-day regret ("any of yesterday's Finished you wish you'd skipped?");
    - deliberate-return rate (opening a specific feed after a gap, as opposed to reflexive opens).
  - Keep the shadow composition fully local, which ADR 0003 makes cheap.

### Bet 5: "Non-profiling and good" is the trust and regulatory position

- **Insight.** The EU DSA requires very large platforms to offer at least one recommender option per system that is "not based on profiling" (Art. 38), accessible right where recommendations appear (Art. 27(3), Recital 94) [36]. YouTube's version is effectively turning off watch history, which leaves an empty Home [7]. EDRi's March 2026 complaint says the option is "counter-intuitive and difficult to access" [37]. The regulation's weak point is that "non-profiling" has come to mean *useless*.
- **Why it isn't obvious.** A recipe-driven feed is a third category: personalized by *declaration*, not by *profiling*. Yourfeed's architecture already supports a strong privacy claim: composition runs in the browser, so in Demo mode the behavioral profile never leaves the device (ADR 0003). That is a trust position YouTube structurally can't take, because its models need logged behavior [15][16].
- **What Yourfeed can test.**
  - Add a strict "declared-only" mode. Composition uses only the recipe and the Catalog, and history-derived terms (the `sameTopic` and `sameChannel` history in `homeScore`) are switched off.
  - Measure how much worse the declared-only mode is on the Bet 4 metrics. If the gap is small, that is a publishable design result: a DSA-compliant feed that people actually prefer.
  - Being able to export a feed as a portable recipe is the user-facing form of this.
  - Legal interpretation of the DSA for this project is out of scope. This is a design argument, not legal advice.

### Bet 6: The generative turn makes the spec, not the prompt, the product

- **Insight.** YouTube's stack now shares one token space for text and videos [15][16], which makes prompt-steered feeds cheap. YouTube is testing them [38]. Research systems keep an *editable* text profile in the loop [29][30]. The open strategic question is whether the prompt is a **one-shot nudge the engine reabsorbs** or a **persistent, inspectable contract**. A nudge keeps control with the platform. A contract gives it to the user.
- **Why it isn't obvious.** "We added prompts" looks like user control. But with no inspectable state, users can't tell whether their prompt is still in effect. Yourfeed's own ADR 0003 cites research that controls which seem to do nothing feel like placebos.
- **What Yourfeed can test.**
  - Make the recipe text the canonical artifact, shown on the Settings line and diffable over time.
  - Every Claude-bar request compiles into Feed actions on that artifact, never into hidden state. Shared feeds (`shared` kind) then become portable *specs*, not opaque models.
  - That is the Bluesky "middleware" idea without the creator-sustainability problem: there's no server to run and no interaction data to collect [34].

### Bet 7: Content-semantic retrieval is the real small-creator policy

- **Insight.** A "Boost small creators" toggle is a patch. The structural fix is retrieval that doesn't depend on prior popularity. Semantic IDs exist because random video IDs give new uploads no link to similar videos [14]. Generative retrieval improves cold-start items [13]. Popularity bias enters at retrieval [2], before any re-ranking boost acts. Exploration pays off through corpus growth [11] but looks bad in short tests [10].
- **Why it isn't obvious.** Fairness work usually lives in the ranker. At Yourfeed's scale, the *Catalog sources* decide who can ever be shown. If candidates come from subscriptions and Data API search (which ranks by YouTube's own signals), YouTube's popularity priors are inherited upstream.
- **What Yourfeed can test.**
  - Add an embedding-retrieval source over a broad RSS crawl of channels around the user's topics, then compare the creator mix in the Catalog by source.
  - Report an exposure concentration measure per feed: the share of Up next going to the top-10% channels by subscribers.
  - This measures whether recipe-fit retrieval naturally spreads exposure, with no boost needed.

### Bet 8: Explicit control has failure modes, so design for them on purpose

- **Insight.** User-chosen feeds bring three new risks:
  - **Bubbles by choice.** Counterfactual-bot evidence suggests YouTube's recommender *moderated* partisan consumption after its 2019 changes, and that users' own choices drove partisanship more [42].
  - **Users don't know what they want.** Self-written specs are under-specified [32].
  - **Stale recipes.** Preferences drift, and a frozen recipe slowly diverges from the person.
- **Why it isn't obvious.** "Give users control" sounds strictly good. But part of a recommender's value is exploration the user wouldn't choose [10][11]. A recipe system removes that unless it is designed back in.
- **What Yourfeed can test.**
  - A fixed, clearly labelled "outside your recipe" slot per Session (one video), drawn from adjacent topics. The user can turn it off.
  - Record whether those videos get Finished at a rate comparable to in-recipe videos (the exploration-value test from [10][11], at small scale).
  - A recipe-age nudge that triggers Bet 2's mirror when a feed hasn't been edited in N weeks.

### Bet 9: LLM judgments are a quality-supply lever, so check them for bias first

- **Insight.** Per-video LLM judgments (substance, title-honesty gap) applied once in the backend are cheap and fit ADR 0004. They also become a *ranker that creators will target* (Bet 1), and they inherit the model's biases about production style, language and accent.
- **Why it isn't obvious.** LLM-as-judge is usually treated as a neutral measurement. In a ranking system it is an incentive, and Shape Your Feed even trains its alignment scorer with LLM judges [29].
- **What Yourfeed can test.**
  - Before using a judgment in Composition, measure how it correlates with channel size, language and production polish across the Catalog.
  - Use it only as a *filter threshold the user sets* (like Hide clickbait), not as a continuous score. That keeps the creator incentive coarse and the user in control.

## 7. Open questions

1. **Can satisfaction be measured with very few users?** Within-user comparisons [20] and shadow composition (Bet 4) help, but Yourfeed has no established survey instrument. Which question best separates "worth it" from "enjoyable"? Meta uses "worth your time" [27][28]; YouTube uses 1–5 stars [6].
2. **How much worse is declared-only than history-aware composition** for a typical user (Bet 5)? This is the core empirical question of the project.
3. **Does recipe-fit scoring actually resist gaming** better than views-based scoring once creators target the honesty or substance judge (Bets 1 and 9)? The exposure-game audit gives a simulated answer only [24].
4. **Data API quota vs breadth.** Search-based candidate generation is quota-bound. Is an RSS crawl of topic-adjacent channels enough to avoid inheriting YouTube's popularity priors (Bet 7)?
5. **How YouTube's "Your custom feed" works.** Does the prompt persist as visible state, or is it reabsorbed? No primary technical description was found [38].
6. **Are LLM user simulators good enough to rank design alternatives** before real users see them? Current evidence says only partly [43].
7. **Does YouTube treat AI tags, Honest titles and clickbait flags as prohibited "derived data"** (III.E.4.h) [45]? This is the highest-stakes open question for Signed-in mode. The quota audit [50] is the natural place to ask.
8. **Is the channel RSS feed allowed** under III.I.14 [45]? It's undocumented, and the quota plan in ADR 0005 depends on it.

## Sources

1. Covington, Adams, Sargin. "Deep Neural Networks for YouTube Recommendations." RecSys 2016. https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/ (DOI 10.1145/2959100.2959190)
2. Yi et al. "Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations." RecSys 2019. https://dl.acm.org/doi/10.1145/3298689.3346996
3. Zhao et al. "Recommending What Video to Watch Next: A Multitask Ranking System." RecSys 2019. https://research.google/pubs/recommending-what-video-to-watch-next-a-multitask-ranking-system/ (DOI 10.1145/3298689.3346997)
4. Chen, Beutel, Covington, Jain, Belletti, Chi. "Top-K Off-Policy Correction for a REINFORCE Recommender System." WSDM 2019. https://arxiv.org/abs/1812.02353
5. Ie et al. "Reinforcement Learning for Slate-based Recommender Systems: A Tractable Decomposition and Practical Methodology" (SlateQ). IJCAI 2019 (short). https://arxiv.org/abs/1905.12767
6. Goodrow, C. "On YouTube's recommendation system." YouTube Official Blog, 2021-09-15. https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/
7. YouTube Help. "How YouTube recommendations work." https://support.google.com/youtube/answer/16089387
8. Christakopoulou et al. "Reward Shaping for User Satisfaction in a REINFORCE Recommender." ICML RL4RealLife 2021; ECML PKDD 2025. https://arxiv.org/abs/2209.15166
9. Wang et al. "Surrogate for Long-Term User Experience in Recommender Systems." KDD 2022. https://research.google/pubs/surrogate-for-long-term-user-experience-in-recommender-systems/ (DOI 10.1145/3534678.3539073)
10. Chen, Wang, Xu et al. "Values of User Exploration in Recommender Systems." RecSys 2021. https://doi.org/10.1145/3460231.3474236
11. Su et al. "Value of Exploration: Measurements, Findings and Algorithms." WSDM 2024. https://arxiv.org/abs/2305.07764
12. Wang et al. "Learning from Negative User Feedback and Measuring Responsiveness for Sequential Recommenders." RecSys 2023. https://arxiv.org/abs/2308.12256
13. Rajput et al. "Recommender Systems with Generative Retrieval" (TIGER). NeurIPS 2023. https://arxiv.org/abs/2305.05065
14. Singh et al. "Better Generalization with Semantic IDs: A Case Study in Ranking for Recommendations." RecSys 2024. https://arxiv.org/abs/2306.08121
15. He et al. "PLUM: Adapting Pre-trained Language Models for Industrial-scale Generative Recommendations." arXiv, 2025-10-09. https://arxiv.org/abs/2510.07784
16. Liu et al. "TokenMinds: Pretrained User Tokens and Embeddings for User Understanding in Large Recommender Systems." arXiv, 2026-06-23 (v2 2026-10-26). https://arxiv.org/abs/2606.25147
17. Chang et al. "Mend the Measurement Gap: Latent User Preference Modeling for Short-Form Video Recommendation." RecSys 2026. https://arxiv.org/abs/2609.32839
18. Stray et al. "Building Human Values into Recommender Systems: An Interdisciplinary Synthesis and Open Problems." ACM TORS 2(3), 2024. https://arxiv.org/abs/2207.10192
19. Kleinberg, Mullainathan, Raghavan. "The Challenge of Understanding What Users Want: Inconsistent Preferences and Engagement Optimization." Management Science 70(9), 2024. https://arxiv.org/abs/2202.11776
20. Milli, Carroll, Wang, Pandey, Zhao, Dragan. "Engagement, User Satisfaction, and the Amplification of Divisive Content on Social Media." https://arxiv.org/abs/2305.16941
21. Milli, Pierson, Garg. "Choosing the Right Weights: Balancing Value, Strategy, and Noise in Recommender Systems." https://arxiv.org/abs/2305.17428
22. Agarwal, Usunier, Lazaric, Nickel. "System-2 Recommenders: Disentangling Utility and Engagement in Recommendation Systems via Temporal Point-Processes." FAccT 2024. https://arxiv.org/abs/2406.01611
23. Carroll, Dragan, Russell, Hadfield-Menell. "Estimating and Penalizing Induced Preference Shifts in Recommender Systems." ICML 2022. https://proceedings.mlr.press/v162/carroll22a.html
24. Hron, Krauth, Jordan, Kilbertus, Dean. "Modeling Content Creator Incentives on Algorithm-Curated Platforms." ICLR 2023. https://arxiv.org/abs/2206.13102
25. Eilat, Rosenfeld. "Performative Recommendation: Diversifying Content via Strategic Incentives." ICML 2023. https://arxiv.org/abs/2302.04336
26. Mladenov et al. "Optimizing Long-term Social Welfare in Recommender Systems: A Constrained Matching Approach." ICML 2020. https://arxiv.org/abs/2008.00104
27. Meta Engineering. "How machine learning powers Facebook's News Feed ranking algorithm." 2021-01-26. https://engineering.fb.com/2021/01/26/core-infra/news-feed-ranking/
28. Meta Newsroom. "Incorporating More Feedback Into News Feed Ranking." 2021-04. https://about.fb.com/news/2021/04/incorporating-more-feedback-into-news-feed-ranking/
29. Xu et al. "Shape Your Feed: An LLM-based Agentic System for Conversational Recommendation." RecSys 2026 Industrial Track. https://arxiv.org/abs/2608.06632
30. Öncel et al. "Controllable and Content-Based Recommendations." arXiv 2026 (accepted to NeurIPS 2026 per the arXiv comments). https://arxiv.org/abs/2607.20938
31. Lyu et al. "Give Users the Wheel: Towards Promptable Recommendation Paradigm." arXiv, 2026-02. https://arxiv.org/abs/2602.18929
32. Popowski, Wu, Zhu, Piccardi, Bernstein. "Social Media Feed Elicitation." CHI 2026 (per the arXiv comments). https://arxiv.org/abs/2602.18594
33. Jahanbakhsh et al. "Value Alignment of Social Media Ranking Algorithms." CHI 2026. https://arxiv.org/abs/2509.14434
34. Zhou, Wang, Zhang. "Middleware for Feed Recommendation in Practice: How Feed Creators Build, Maintain, and Sustain Custom Feeds on Bluesky." arXiv, 2026-09. https://arxiv.org/abs/2609.12958
35. Bluesky. "Algorithmic Choice with Custom Feeds." 2023-07-27. https://bsky.social/about/blog/7-27-2023-custom-feeds
36. Regulation (EU) 2022/2065 (Digital Services Act), Arts. 25, 27, 38 and Recital 94. https://eur-lex.europa.eu/eli/reg/2022/2065/oj
37. EDRi. Complaint against Google Ireland Ltd. regarding violation of Arts. 38, 27(3), 25 DSA (YouTube). Submitted March 2026 to BIPT. https://edri.org/wp-content/uploads/2026/03/EDRi-DSA-complaint-Youtube.pdf
38. YouTube Help Community. "YouTube test features and experiments" ("Your custom feed" entry, Nov 2025). https://support.google.com/youtube/thread/18138167 (the entry was not readable by fetch; wording confirmed via the quote in 9to5Google, 2025-11-26: https://9to5google.com/2025/11/26/youtube-testing-new-home-page-with-more-control-over-suggested-content/)
39. YouTube. "Building YouTube Shorts, a new way to watch & create on YouTube." 2020-09-14. https://blog.google/intl/en-in/products/platforms/building-youtube-shorts-new-way-to/
40. Mohan, N. "From the CEO: What's coming to YouTube in 2026." 2026-01-21. https://blog.google/intl/en-in/products/platforms/from-the-ceo-whats-coming-to-youtube-in-2026/
41. Nielsen. "Holidays, football and blockbusters drive record highs for YouTube, Netflix and Amazon Prime Video in December, according to The Gauge." 2025-01. https://www.nielsen.com/news-center/2025/holidays-football-and-blockbusters-drive-record-highs-for-youtube-netflix-and-amazon-prime-video-in-december-according-to-the-gauge/
42. Hosseinmardi et al. "Causally estimating the effect of YouTube's recommender system using counterfactual bots." PNAS 121(8), 2024. https://doi.org/10.1073/pnas.2313377121
43. Zhang et al. "On Generative Agents in Recommendation" (Agent4Rec). SIGIR 2024. https://arxiv.org/abs/2310.10108
44. YouTube Data API v3. "Quota Calculator" (quota costs and default allocation). https://developers.google.com/youtube/v3/determine_quota_cost
45. YouTube API Services. "Developer Policies" (sections III.A, III.C, III.E, III.F, III.I, III.L, IV). https://developers.google.com/youtube/terms/developer-policies
46. YouTube API Services. "Terms of Service." https://developers.google.com/youtube/terms/api-services-terms-of-service
47. YouTube Data API v3. "Revision History" (2016-08-11 and 2016-09-15 watch history / home deprecations; 2025-03-26 Shorts view counting; 2026-06-01 granular quota buckets; 2026-06-03 `videos.batchGetStats`). https://developers.google.com/youtube/v3/revision_history
48. YouTube Data API v3. "Captions: download." https://developers.google.com/youtube/v3/docs/captions/download
49. YouTube Data API v3. "Channels" resource (`contentDetails.relatedPlaylists`). https://developers.google.com/youtube/v3/docs/channels
50. YouTube Data API v3. "Quota and Compliance Audits." https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits

### Not verified

- The PLUM Shorts CTR lift (~+5%) appears only in secondary write-ups, not the abstract [15].
- YouTube's 15.8% US TV share for August 2026 is press-reported. Only the December 2024 figure (11.1%) was checked on Nielsen's site [41].
- The Shorts view-counting change (2025-03-31) is confirmed in the API revision history [47].
- The "Your custom feed" rollout details beyond the initial test (up to eight feeds; US, English, 13+) come from press only [38].
- The term "inversion problem" comes from a Mullainathan essay that was not fetched. The formal result cited is [19].
- The model details for [1] (expected-watch-time weighted logistic regression) and [3] (engagement vs satisfaction objectives, shallow tower for position bias) come from the papers' full text as recalled. The fetched abstract pages confirm the papers but not those specific details.
