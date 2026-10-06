import { ClassificationInput } from './mention-classifier.js';

/**
 * The prompt behind `OllamaMentionClassifier`
 * (`repositories/ollama-mention-classifier.ts`): the system message that
 * defines Relevance and Sentiment, the few-shot examples that anchor them,
 * and the JSON schema the model's structured output is held to.
 *
 * Bump `PROMPT_VERSION` whenever the system message, the few-shot examples
 * or the response schema change. It travels with every classification
 * (`mentions.model` in `docs/PLAN.md#data-model`), so a prompt change is
 * visible in the data, not just in git history.
 */
export const PROMPT_VERSION = 'v1';

export interface PromptMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Defines the two judgements the model makes about one headline, in the
 * vocabulary of `CONTEXT.md#coverage`: whether the headline is a Relevant
 * Mention of the Tracked Company at all, and — only if it is — the
 * Sentiment of the coverage toward that company specifically.
 */
export const SYSTEM_PROMPT = `You classify one news headline as a press mention of exactly one company: the "Tracked Company" described in the user message. You are given that company's current name, any Former Names it used to be known by, and a Disambiguator — a non-name detail that tells it apart from anything else that happens to share its name (a storm, a person, an unrelated company, a common word).

Decide two things, in order:

1. RELEVANT — is this headline genuinely about the Tracked Company, under its current name or a Former Name, and not a name collision with something else that shares the name? A headline that names several companies is still relevant to the Tracked Company if the Tracked Company is one of the companies the headline is actually about.

2. SENTIMENT — only when relevant is true: the tone of the headline toward the Tracked Company specifically, never the tone of the article as a whole and never the tone toward a different company the same headline names.
   - "positive": funding rounds, new products or launches, partnerships, acquisitions of others, awards, strong results.
   - "negative": layoffs, lawsuits, breaches, outages, shutdowns, down-rounds, executive departures under a cloud.
   - "neutral": the company is merely named — a listicle, a market roundup, a factual mention that is neither good nor bad news for it.

When relevant is false, sentiment must be null — an irrelevant headline has no Sentiment toward a company it is not about.

Respond with ONLY the JSON object the schema requires: no prose, no markdown, no explanation outside the "rationale" field.`;

export interface FewShotCompany {
  readonly name: string;
  readonly formerNames: readonly string[];
  readonly disambiguator: string | null;
}

export interface FewShotResponse {
  readonly relevant: boolean;
  readonly sentiment: 'positive' | 'negative' | 'neutral' | null;
  readonly confidence: number;
  readonly rationale: string;
}

export interface FewShotExample {
  readonly company: FewShotCompany;
  readonly title: string;
  readonly outlet: string;
  readonly response: FewShotResponse;
}

/**
 * Six examples: a name collision, a headline naming several companies, one
 * example per Sentiment, and a Former Name. Edited here, not in the
 * implementation, so a reviewer sees exactly what the model is anchored on.
 */
export const FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    // Name collision: the storm, not the company.
    company: {
      name: 'Harvey',
      formerNames: [],
      disambiguator: 'legal AI research company (harvey.ai)',
    },
    title: 'Hurricane Harvey weakens to a tropical storm after pounding the Texas coast',
    outlet: 'Reuters',
    response: {
      relevant: false,
      sentiment: null,
      confidence: 0.98,
      rationale: 'Harvey here is the storm, not the legal AI company — a name collision.',
    },
  },
  {
    // A headline naming several companies; relevant to one of them.
    company: {
      name: 'Harvey',
      formerNames: [],
      disambiguator: 'legal AI research company (harvey.ai)',
    },
    title: 'Harvey, Hebbia and Ironclad all raise fresh funding as legal AI spending accelerates',
    outlet: 'TechCrunch',
    response: {
      relevant: true,
      sentiment: 'positive',
      confidence: 0.9,
      rationale: 'Harvey is one of the named companies, and the funding news is positive for it.',
    },
  },
  {
    // Positive: funding.
    company: { name: 'Wiz', formerNames: [], disambiguator: 'cloud security startup' },
    title: 'Wiz raises $1B Series E at a $12B valuation',
    outlet: 'Bloomberg',
    response: {
      relevant: true,
      sentiment: 'positive',
      confidence: 0.95,
      rationale: 'A large funding round is positive news for Wiz.',
    },
  },
  {
    // Negative: shutdown.
    company: { name: 'Fast', formerNames: [], disambiguator: 'one-click checkout startup' },
    title: 'Fast shuts down after burning through $100M in 18 months',
    outlet: 'The Information',
    response: {
      relevant: true,
      sentiment: 'negative',
      confidence: 0.97,
      rationale:
        'Shutting down after burning through its funding is clearly negative for the company.',
    },
  },
  {
    // Neutral: a listicle mention.
    company: { name: 'Notion', formerNames: [], disambiguator: 'productivity software company' },
    title: '15 productivity apps worth trying in 2025, from Notion to Todoist',
    outlet: 'Lifehacker',
    response: {
      relevant: true,
      sentiment: 'neutral',
      confidence: 0.8,
      rationale: 'A listicle mention with no good or bad news for Notion specifically.',
    },
  },
  {
    // Former Name resolves to the current Tracked Company.
    company: {
      name: 'Lifeward',
      formerNames: ['ReWalk'],
      disambiguator: 'wearable exoskeleton maker',
    },
    title: 'ReWalk Robotics wins expanded FDA clearance for its exoskeleton',
    outlet: 'MedCity News',
    response: {
      relevant: true,
      sentiment: 'positive',
      confidence: 0.92,
      rationale:
        'ReWalk is a Former Name of Lifeward, and winning regulatory clearance is positive.',
    },
  },
];

/**
 * JSON schema passed in Ollama's `format` field so the model's reply is
 * structured output, not free text to scrape
 * (`docs/PLAN.md#ports` — `Classification`). `sentiment` is nullable because
 * an irrelevant Mention has no Sentiment toward a company it is not about.
 */
export const CLASSIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    relevant: { type: 'boolean' },
    sentiment: { type: ['string', 'null'], enum: ['positive', 'negative', 'neutral', null] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string', maxLength: 200 },
  },
  required: ['relevant', 'sentiment', 'confidence', 'rationale'],
  additionalProperties: false,
} as const;

function formatCompanyBlock(company: FewShotCompany): string {
  const formerNames = company.formerNames.length > 0 ? company.formerNames.join(', ') : '(none)';
  const disambiguator = company.disambiguator ?? '(none)';
  return `Company: ${company.name}\nFormer names: ${formerNames}\nDisambiguator: ${disambiguator}`;
}

function formatUserPrompt(company: FewShotCompany, title: string, outlet: string): string {
  return `${formatCompanyBlock(company)}\nHeadline: "${title}"\nOutlet: ${outlet}`;
}

/**
 * The full message list for one `classify()` call: the system message, the
 * few-shot examples as alternating user/assistant turns, then the real
 * Mention to classify. Pass straight to the chat client's `messages`.
 */
export function buildMessages(input: ClassificationInput): PromptMessage[] {
  const exampleMessages: PromptMessage[] = FEW_SHOT_EXAMPLES.flatMap((example) => [
    { role: 'user', content: formatUserPrompt(example.company, example.title, example.outlet) },
    { role: 'assistant', content: JSON.stringify(example.response) },
  ]);

  const target: FewShotCompany = {
    name: input.company.name,
    formerNames: input.company.formerNames,
    disambiguator: input.company.disambiguator,
  };

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...exampleMessages,
    { role: 'user', content: formatUserPrompt(target, input.title, input.outlet) },
  ];
}
