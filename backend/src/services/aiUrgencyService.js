const { OpenAI } = require('openai');
const { evaluateFallbackUrgency } = require('../utils/keywordsFallback');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'mock_key' });

// Simple localized execution memory cache to fulfill RULE 6
const triageCache = new Map();

const computeUrgencyRating = async (issueDescription, needsList) => {
  const cacheKey = Buffer.from(`${issueDescription}_${needsList.sort().join(',')}`).toString('base64');
  
  // Return cached execution result if under 1 hour old
  if (triageCache.has(cacheKey)) {
    const cachedItem = triageCache.get(cacheKey);
    if (Date.now() - cachedItem.timestamp < 3600000) {
      logger.info('Triage Cache Hit: Serving pre-computed scoring metrics.');
      return cachedItem.data;
    }
  }

  // Create an explicit abort controller to guarantee execution limits
  const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '5000', 10);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.info('Evaluating core triage profiles via AI Endpoint API.');
    
    const prompt = `You are an emergency coordinator in Lebanon. Rate this camp request urgency 1-10.

RULES:
- 10 = Imminent loss of life expected within hours (severe bleeding, no water, fire)
- 8-9 = Serious threat within 24 hours (medical emergency, children sick)
- 6-7 = Urgent but not life-threatening (insufficient food, minor injuries)
- 4-5 = Important but can wait 3 days (lack of blankets, non-urgent supplies)
- 1-3 = Low priority (recreational items, minor inconveniences)

Request: ${issueDescription}
Needs: ${needsList.join(', ')}

Respond in valid JSON only: {"score": number, "reason": "short reason", "summary": "one sentence for NGO to act"}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    
    const parsedPayload = JSON.parse(completion.choices[0].message.content);
    
    const outputResult = {
      urgencyScore: Math.min(Math.max(parsedPayload.score || 5, 1), 10),
      urgencyReason: parsedPayload.reason || "Processed successfully via structured schema heuristics.",
      summary: (parsedPayload.summary || "Emergency request submitted.").substring(0, 200)
    };

    // Commit metrics block straight to localized tracking cache
    triageCache.set(cacheKey, { timestamp: Date.now(), data: outputResult });
    logger.info('AI Urgency evaluation completed successfully.', outputResult);
    return outputResult;

  } catch (error) {
    clearTimeout(timeoutId);
    logger.warn('AI compilation limits exceeded or errored. Intercepting with keyword fallback pipeline.', { error: error.message });
    
    const fallbackData = evaluateFallbackUrgency(issueDescription, needsList);
    return {
      urgencyScore: fallbackData.score,
      urgencyReason: fallbackData.reason,
      summary: fallbackData.summary
    };
  }
};

module.exports = { computeUrgencyRating };
