import { logger } from '../utils/logger';
import {
  InsightTemplateKey,
  INSIGHT_TEMPLATES,
  INSIGHT_SYSTEM_PREAMBLE,
} from '../ai-insights/templates';

// AI service supporting Google Gemini and Groq with graceful fallback
// Provider selection: try primary first, fall back to secondary, then to rule-based response

interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIContext {
  role: string;
  _systemOverride?: string;
  stats?: Record<string, unknown>;
  listings?: unknown[];
  matches?: unknown[];
  pickups?: unknown[];
  facilities?: unknown[];
}

const SYSTEM_PROMPT = `You are the CarbonLoop AI assistant. CarbonLoop is a platform that connects 
waste generators with carbon-conversion facilities (biochar plants, biogas digesters, composting facilities) 
in India, optimizing collection logistics and calculating verified CO2 sequestration.

You help users understand their waste listings, match scores, carbon impact, and platform data.

Rules:
1. Only discuss data provided to you in the context. Do not invent numbers or claim data you were not given.
2. When you do not have enough data to answer, say so clearly.
3. Be concise, specific, and actionable. Avoid generic AI-sounding filler.
4. Carbon sequestration figures follow EPA WARM v15 and IPCC AR6 WG3 methodology.
5. Do not use em dashes. Use commas, periods, or parentheses instead.`;

// Gemini implementation
async function callGemini(messages: AIMessage[], context: AIContext): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Lazy import to avoid crashing when key is absent
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });

  // Use _systemOverride when present (structured insight calls), else build role-context prompt
  const systemInstruction = context._systemOverride
    ? context._systemOverride
    : `${SYSTEM_PROMPT}\n\nUser context:\n${JSON.stringify(context, null, 2)}`;

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    systemInstruction,
    history,
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

// Groq implementation
async function callGroq(messages: AIMessage[], context: AIContext): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  });

  // Use _systemOverride when present (structured insight calls), else build role-context prompt
  const systemContent = context._systemOverride
    ? context._systemOverride
    : `${SYSTEM_PROMPT}\n\nUser context:\n${JSON.stringify(context, null, 2)}`;

  const openAIMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: openAIMessages,
  });

  return completion.choices[0]?.message?.content || 'No response generated.';
}

// Rule-based fallback when no AI provider is available
function rulesBasedResponse(userMessage: string, context: AIContext): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('match') || lower.includes('facilit')) {
    const matchCount = context.matches?.length ?? 0;
    if (matchCount === 0) {
      return 'I do not have any active matches in your current context. Try creating a new waste listing and the matching engine will compute scored facility recommendations for you.';
    }
    return `You have ${matchCount} match(es) in your current context. The matching engine scores facilities using a weighted formula: distance (30%), waste-type compatibility (30%), remaining capacity (25%), and facility efficiency (15%). Review your matches in the Matches section for detailed breakdowns.`;
  }

  if (lower.includes('carbon') || lower.includes('co2') || lower.includes('sequestrat')) {
    const stats = context.stats;
    if (stats) {
      return `Your platform data shows ${stats.total_co2_sequestered_t ?? 0} tonnes of CO2 sequestered so far, from ${stats.total_waste_diverted_t ?? 0} tonnes of waste diverted. Carbon calculations follow EPA WARM v15 and IPCC AR6 WG3 methodology.`;
    }
    return 'Carbon sequestration is calculated per pickup based on waste type, conversion method, and collection distance. Biochar pyrolysis sequesters approximately 0.8 to 1.0 tonnes of CO2 per tonne of organic waste. Composting avoids 0.15 to 0.22 tonnes CO2 per tonne.';
  }

  if (lower.includes('pickup') || lower.includes('status') || lower.includes('transit')) {
    const pickupCount = context.pickups?.length ?? 0;
    return `You have ${pickupCount} pickup(s) in your context. Check the Pickups section for status updates. Pickups progress through: Requested, Scheduled, In Transit, Delivered, Verified.`;
  }

  return 'I can help with questions about your waste listings, facility matches, pickup status, and carbon impact. Please ask a specific question and I will do my best to help using your platform data. (AI provider not configured. Add your GEMINI_API_KEY or GROQ_API_KEY in .env to enable full AI responses.)';
}

export async function getAIResponse(
  messages: AIMessage[],
  context: AIContext
): Promise<{ response: string; provider: string }> {
  const primary = process.env.AI_PROVIDER || 'groq';
  const secondary = primary === 'gemini' ? 'groq' : 'gemini';

  // Try primary
  try {
    let response: string;
    if (primary === 'gemini') {
      response = await Promise.race([
        callGemini(messages, context),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)),
      ]);
    } else {
      response = await Promise.race([
        callGroq(messages, context),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)),
      ]);
    }
    return { response, provider: primary };
  } catch (err) {
    logger.warn(`Primary AI provider (${primary}) failed`, { error: (err as Error).message });
  }

  // Try secondary
  try {
    let response: string;
    if (secondary === 'gemini') {
      response = await Promise.race([
        callGemini(messages, context),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)),
      ]);
    } else {
      response = await Promise.race([
        callGroq(messages, context),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000)),
      ]);
    }
    return { response, provider: secondary };
  } catch (err) {
    logger.warn(`Secondary AI provider (${secondary}) failed`, { error: (err as Error).message });
  }

  // Rule-based fallback
  logger.info('Using rule-based AI fallback');
  return {
    response: rulesBasedResponse(messages[messages.length - 1]?.content || '', context),
    provider: 'rules-based',
  };
}

// ─── Structured Insight Generation ──────────────────────────────────────────

export interface StructuredInsight {
  finding: string;
  carbonEconomicFraming: string;
  action: string;
  supportingDetail: string;
}

export class InsightParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsightParseError';
  }
}

function validateInsightShape(obj: unknown): StructuredInsight {
  if (!obj || typeof obj !== 'object') throw new InsightParseError('Response is not an object');
  const o = obj as Record<string, unknown>;
  const required = ['finding', 'carbonEconomicFraming', 'action', 'supportingDetail'];
  for (const field of required) {
    if (typeof o[field] !== 'string' || !(o[field] as string).trim()) {
      throw new InsightParseError(`Missing or empty field: ${field}`);
    }
  }
  return {
    finding: (o.finding as string).trim(),
    carbonEconomicFraming: (o.carbonEconomicFraming as string).trim(),
    action: (o.action as string).trim(),
    supportingDetail: (o.supportingDetail as string).trim(),
  };
}

function extractJSON(text: string): unknown {
  // Strip markdown fences if the model wrapped the JSON anyway
  const stripped = text
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  // Find outermost JSON object
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new InsightParseError('No JSON object found in response');
  return JSON.parse(stripped.slice(start, end + 1));
}

export async function generateStructuredInsight(
  templateKey: InsightTemplateKey,
  dataPackage: Record<string, unknown>
): Promise<{ insight: StructuredInsight; provider: string }> {
  const componentTemplate = INSIGHT_TEMPLATES[templateKey];
  const dataJson = JSON.stringify(dataPackage, null, 2);

  const systemPrompt = INSIGHT_SYSTEM_PREAMBLE;
  const userMessage = `${componentTemplate}\n\n--- DATA PACKAGE ---\n${dataJson}`;

  const messages: AIMessage[] = [{ role: 'user', content: userMessage }];
  // We reuse the existing context-free call path but override the system prompt
  const insightContext: AIContext = { role: 'insight', _systemOverride: systemPrompt } as unknown as AIContext;

  const { response, provider } = await getAIResponse(messages, insightContext);

  try {
    const parsed = extractJSON(response);
    const insight = validateInsightShape(parsed);
    return { insight, provider };
  } catch (err) {
    logger.warn('Insight parse failed', { templateKey, error: (err as Error).message, raw: response.slice(0, 200) });
    throw new InsightParseError(`Failed to parse structured insight: ${(err as Error).message}`);
  }
}
