# Press Mentions Monitoring

Tracks news coverage of OurCrowd's portfolio and fund companies, classifies the sentiment of each piece of coverage, and reports how recently each company was covered.

## Language

### Companies

**Company List**:
OurCrowd's list of portfolio and fund companies — the source of truth for which companies are tracked.
_Avoid_: Seed file, portfolio list

**Tracked Company**:
A company on the OurCrowd company list whose press coverage is monitored. Portfolio and fund companies are not distinguished; the list carries no such flag.
_Avoid_: Portfolio company, fund company, startup

**Former Name**:
A name a Tracked Company was previously known by (e.g. "ReWalk" for Lifeward), which still identifies it in coverage.
_Avoid_: Old name, legacy name, alias

**Disambiguator**:
An identifying detail on the company list that is not a name (e.g. "lambda.ai" for Lambda), used to tell the Tracked Company apart from things sharing its name.
_Avoid_: Hint, qualifier

### Coverage

**News Source**:
The external service Articles are collected from.
_Avoid_: Feed, provider, API

**Article**:
A single news item from the News Source, identified by its link. One Article can concern several Tracked Companies.
_Avoid_: Story, item, result

**Mention**:
The pairing of one Article with one Tracked Company it was found for. The Mention, not the Article, is what gets classified, counted and alerted on.
_Avoid_: Hit, press appearance, coverage item

**Relevant Mention**:
A Mention whose Article is genuinely about its Tracked Company rather than a name collision (e.g. "Harvey" the hurricane). Only Relevant Mentions count anywhere.
_Avoid_: Valid mention, match

**Sentiment**:
The tone of a Relevant Mention toward its Tracked Company specifically — positive, negative or neutral — not the tone of the Article as a whole.
_Avoid_: Tone, polarity, score

**Quarter**:
The trailing 90 days ending today.
_Avoid_: Period, calendar quarter

**Mention Status**:
How long ago a Tracked Company's most recent Relevant Mention was published, or "no coverage found" when it has none.
_Avoid_: Last seen, freshness

### Monitoring

**Run**:
One execution of collecting Articles, classifying new Mentions and sending the Alert.
_Avoid_: Job, sync, crawl

**New Mention**:
A Relevant Mention that has not yet appeared in any Alert and was published recently enough to be news.
_Avoid_: Fresh mention, delta

**Alert**:
The notification a Run sends listing its New Mentions.
_Avoid_: Digest, notification, report

## Relationships

- An **Article** can concern several **Tracked Companies**; each pairing is exactly one **Mention**.
- Each **Mention** is first discovered by exactly one **Run**.
- Each **Run** sends exactly one **Alert**, possibly empty, and a **Mention** is a **New Mention** in only one Run's Alert unless recording that Alert fails.

How these are stored and move through a Run: `docs/PLAN.md#entities-and-flow`.
