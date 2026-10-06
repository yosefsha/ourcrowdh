import { TrackedCompany } from '../companies/company.js';
import {
  buildMessages,
  CLASSIFICATION_RESPONSE_SCHEMA,
  FEW_SHOT_EXAMPLES,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from './prompt.js';

const company: TrackedCompany = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'harvey',
  name: 'Harvey',
  formerNames: [],
  disambiguator: 'legal AI research company (harvey.ai)',
};

const companyWithFormerName: TrackedCompany = {
  id: '22222222-2222-2222-2222-222222222222',
  slug: 'lifeward',
  name: 'Lifeward',
  formerNames: ['ReWalk'],
  disambiguator: null,
};

describe('classification prompt', () => {
  it('matches the committed snapshot — review any diff here as a prompt change', () => {
    expect({
      version: PROMPT_VERSION,
      system: SYSTEM_PROMPT,
      examples: FEW_SHOT_EXAMPLES,
      schema: CLASSIFICATION_RESPONSE_SCHEMA,
      messages: buildMessages({
        company,
        title: 'Harvey raises $100M Series D to expand its legal AI product',
        outlet: 'TechCrunch',
      }),
    }).toMatchSnapshot();
  });

  it('includes at least four few-shot examples, including a name collision', () => {
    expect(FEW_SHOT_EXAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(FEW_SHOT_EXAMPLES.length).toBeLessThanOrEqual(6);
    expect(FEW_SHOT_EXAMPLES.some((example) => example.response.relevant === false)).toBe(true);
  });

  it('includes a headline naming several companies', () => {
    expect(FEW_SHOT_EXAMPLES.some((example) => /,.*and|,.*\band\b/.test(example.title))).toBe(true);
  });

  it('every irrelevant example has a null sentiment, matching the schema', () => {
    for (const example of FEW_SHOT_EXAMPLES) {
      if (!example.response.relevant) {
        expect(example.response.sentiment).toBeNull();
      } else {
        expect(example.response.sentiment).not.toBeNull();
      }
    }
  });

  it('puts the company name, former names, disambiguator, headline and outlet in the final user turn', () => {
    const messages = buildMessages({
      company: companyWithFormerName,
      title: 'ReWalk Robotics wins expanded FDA clearance',
      outlet: 'MedCity News',
    });
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('Lifeward');
    expect(lastMessage.content).toContain('ReWalk');
    expect(lastMessage.content).toContain('ReWalk Robotics wins expanded FDA clearance');
    expect(lastMessage.content).toContain('MedCity News');
  });

  it('starts every message list with the system prompt', () => {
    const messages = buildMessages({ company, title: 'Any headline', outlet: 'Any outlet' });

    expect(messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
  });
});
