const { OpenAI } = require('openai');
const { evaluateFallbackUrgency } = require('../utils/keywordsFallback');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || 'mock_key',
});

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

const GREETING_PATTERNS = [
  /^(hi|hello|hey|good morning|good evening|salam|marhaba|ahla|yo)\b/i,
  /^(السلام|مرحب|أهلا|اهلا|سلام|صباح|مساء)/,
];

const HELP_PATTERNS = [
  /\b(help|what can you|how do i|menu|options)\b/i,
  /(مساعدة|شو بتعمل|كيف|ماذا تفعل|شو بتقدر)/,
];

const ARABIC_RE = /[\u0600-\u06FF]/;

const detectLanguage = (text) => (ARABIC_RE.test(text) ? 'ar' : 'en');

const getSession = (fromNumber) => {
  const existing = sessions.get(fromNumber);
  if (existing && Date.now() - existing.updatedAt < SESSION_TTL_MS) {
    return existing;
  }
  const fresh = {
    history: [],
    language: 'en',
    pendingIssue: null,
    updatedAt: Date.now(),
  };
  sessions.set(fromNumber, fresh);
  return fresh;
};

const pushHistory = (session, role, content) => {
  session.history.push({ role, content });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }
  session.updatedAt = Date.now();
};

const capabilitiesText = (lang, campName) => {
  if (lang === 'ar') {
    return (
      `🤖 *مرحباً، أنا مساعد CedarRelief للإغاثة.*\n\n` +
      `أنا هنا لمساعدة مشرف مخيم *${campName}* على تسجيل طلبات الإغاثة.\n\n` +
      `*يمكنني:*\n` +
      `• تسجيل نقص المياه أو الطعام أو الدواء\n` +
      `• تصنيف حالة الطوارئ وإرسالها لمنظمات NGO\n` +
      `• إعطاؤك رقم تذكرة للمتابعة\n\n` +
      `*اكتب ببساطة ما تحتاجه* — مثلاً:\n` +
      `_"ما في مي من الصبح"_\n` +
      `_"وصلت عائلات جديدة بدون طعام"_\n` +
      `_"حالة طبية عاجلة"_\n\n` +
      `_كلما كانت التفاصيل أوضح، كلما كانت الاستجابة أسرع._`
    );
  }
  return (
    `🤖 *Hello, I'm the CedarRelief dispatch assistant.*\n\n` +
    `I help the supervisor at *${campName}* log relief requests for NGOs.\n\n` +
    `*I can:*\n` +
    `• Log water, food, medical, or shelter shortages\n` +
    `• Rate urgency and alert the right NGO\n` +
    `• Give you a ticket ID to track the request\n\n` +
    `*Just describe what you need* — for example:\n` +
    `_"Water tanks empty since morning"_\n` +
    `_"60 new families arrived, no food"_\n` +
    `_"Medical emergency — child with high fever"_\n\n` +
    `_Short messages are fine — I'll ask follow-up questions if needed._`
  );
};

const followUpText = (lang) => {
  if (lang === 'ar') {
    return (
      `شكراً. لأتمكن من إرسال الطلب للمنظمات، أحتاج المزيد من التفاصيل:\n\n` +
      `• *ما المشكلة بالتحديد؟* (مياه، طعام، دواء، مأوى...)\n` +
      `• *كم شخص متأثر؟*\n` +
      `• *هل الحالة عاجلة؟*\n\n` +
      `_مثال: "350 شخص بدون مياه شرب من 8 الصبح"_`
    );
  }
  return (
    `Thanks. To dispatch this to NGOs, I need a bit more detail:\n\n` +
    `• *What's the problem?* (water, food, medicine, shelter...)\n` +
    `• *How many people are affected?*\n` +
    `• *Is it urgent?*\n\n` +
    `_Example: "350 people without drinking water since 8am"_`
  );
};

const isGreeting = (text) => GREETING_PATTERNS.some((re) => re.test(text.trim()));
const isHelpRequest = (text) => HELP_PATTERNS.some((re) => re.test(text.trim()));

const isVagueReport = (text) => {
  const t = text.trim();
  if (t.length < 8) return true;
  const vague = [
    /^help$/i,
    /^need help/i,
    /^(we need|need something|emergency)$/i,
    /^نحتاج/,
    /^مساعدة$/,
    /^طوارئ$/,
    /^مساعدة$/,
  ];
  return vague.some((re) => re.test(t));
};

const extractNeedsListFromText = (text) => {
  const normalized = text.toLowerCase();
  const list = [];
  const rules = [
    [/urgent|عاجل|طوارئ|فور/i, 'urgent_flag'],
    [/water|مياه|مي\b|ماء|شرب/i, 'water'],
    [/food|طعام|اكل|أكل|وجبات/i, 'food'],
    [/medic|دواء|طب|مستشف|clinic/i, 'medical'],
    [/blanket|shelter|مأوى|خيم|بطان|roof|سقف/i, 'shelter'],
  ];
  for (const [re, tag] of rules) {
    if (re.test(normalized) && !list.includes(tag)) list.push(tag);
  }
  if (list.length === 0) list.push('general_relief');
  return list;
};

const runFallbackTurn = (session, camp, userMessage) => {
  const lang = detectLanguage(userMessage) || session.language;
  session.language = lang;
  const campName = camp.name;

  if (isGreeting(userMessage)) {
    return {
      action: 'reply',
      replyToUser: capabilitiesText(lang, campName),
      language: lang,
    };
  }

  if (isHelpRequest(userMessage)) {
    return {
      action: 'reply',
      replyToUser: capabilitiesText(lang, campName),
      language: lang,
    };
  }

  const combined = session.pendingIssue
    ? `${session.pendingIssue}\n${userMessage}`
    : userMessage;

  if (isVagueReport(userMessage) && !session.pendingIssue) {
    session.pendingIssue = userMessage;
    return {
      action: 'reply',
      replyToUser: followUpText(lang),
      language: lang,
    };
  }

  if (isVagueReport(combined)) {
    session.pendingIssue = combined;
    return {
      action: 'reply',
      replyToUser: followUpText(lang),
      language: lang,
    };
  }

  session.pendingIssue = null;
  const needsList = extractNeedsListFromText(combined);
  const fallback = evaluateFallbackUrgency(combined, needsList);

  const confirmAr =
    `✅ *تم تسجيل الطلب!*\n\n` +
    `• *التذكرة:* {{ticket}}\n` +
    `• *المخيم:* ${campName}\n` +
    `• *الأولوية:* {{score}}/10\n\n` +
    `_تم تنبيه المنظمات المعنية._`;

  const confirmEn =
    `✅ *Request logged!*\n\n` +
    `• *Ticket:* {{ticket}}\n` +
    `• *Camp:* ${campName}\n` +
    `• *Urgency:* {{score}}/10\n\n` +
    `_Relevant NGOs have been alerted._`;

  return {
    action: 'create_request',
    language: lang,
    issueDescriptionEnglish: combined,
    needsList,
    urgencyScore: fallback.score,
    urgencyReason: fallback.reason,
    summary: fallback.summary,
    confirmationTemplate: lang === 'ar' ? confirmAr : confirmEn,
  };
};

const runAiTurn = async (session, camp, userMessage) => {
  const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '8000', 10);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const historyText = session.history
    .map((m) => `${m.role === 'user' ? 'Supervisor' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `You are CedarRelief, a WhatsApp AI dispatch assistant for camp supervisors in Lebanon.

Camp: ${camp.name} (${camp.region})
Supervisor: ${camp.supervisorName || 'Supervisor'}

Conversation so far:
${historyText || '(new conversation)'}

Latest supervisor message:
"${userMessage}"

RULES:
1. Detect language: "ar" if Arabic script, else "en". ALWAYS reply in the same language as the user's latest message.
2. If greeting (hi, marhaba, السلام عليكم): action=greet — introduce yourself and explain you log water/food/medical/shelter requests for NGOs. Keep reply concise for WhatsApp.
3. If user asks what you can do: action=explain_capabilities.
4. If message is too vague to create a dispatch ticket (e.g. "help", "نحتاج مساعدة", "emergency" with no details): action=ask_followup — ask 2-3 specific questions (what need, how many people, urgency).
5. If you have enough detail OR user answered follow-ups: action=create_request — fill issueDescriptionEnglish (always English for internal records, translate if user wrote Arabic), needsList from [water, food, medical, shelter, urgent_flag, general_relief], score 1-10, reason, summary (English for NGOs).
6. Merge context from conversation history when creating a request.
7. confirmationReply: short WhatsApp message in user's language confirming ticket will be created (ticket ID added later by system).

Respond JSON only:
{
  "detectedLanguage": "ar" | "en",
  "action": "greet" | "explain_capabilities" | "ask_followup" | "create_request" | "reply",
  "replyToUser": "message in user's language",
  "issueDescriptionEnglish": "string or null",
  "needsList": ["water"],
  "urgencyScore": null,
  "urgencyReason": null,
  "summary": null,
  "confirmationReply": "string or null"
}`;

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);
    const parsed = JSON.parse(completion.choices[0].message.content);
    session.language = parsed.detectedLanguage === 'ar' ? 'ar' : 'en';

    if (parsed.action === 'create_request' && parsed.issueDescriptionEnglish) {
      return {
        action: 'create_request',
        language: session.language,
        issueDescriptionEnglish: parsed.issueDescriptionEnglish,
        needsList: parsed.needsList?.length ? parsed.needsList : extractNeedsListFromText(parsed.issueDescriptionEnglish),
        urgencyScore: parsed.urgencyScore,
        urgencyReason: parsed.urgencyReason,
        summary: parsed.summary,
        confirmationTemplate: parsed.confirmationReply || (session.language === 'ar'
          ? '✅ *تم تسجيل الطلب!*\n\n• *التذكرة:* {{ticket}}\n• *الأولوية:* {{score}}/10'
          : '✅ *Request logged!*\n\n• *Ticket:* {{ticket}}\n• *Urgency:* {{score}}/10'),
      };
    }

    let reply = parsed.replyToUser;
    if (parsed.action === 'greet' || parsed.action === 'explain_capabilities') {
      reply = reply || capabilitiesText(session.language, camp.name);
    }
    if (parsed.action === 'ask_followup') {
      reply = reply || followUpText(session.language);
      session.pendingIssue = session.pendingIssue
        ? `${session.pendingIssue}\n${userMessage}`
        : userMessage;
    }

    return {
      action: 'reply',
      replyToUser: reply || followUpText(session.language),
      language: session.language,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    logger.warn('WhatsApp conversation AI failed, using fallback.', { error: error.message });
    return runFallbackTurn(session, camp, userMessage);
  }
};

const handleConversationTurn = async (fromNumber, userMessage, camp) => {
  const session = getSession(fromNumber);
  pushHistory(session, 'user', userMessage);

  const hasOpenAi = Boolean(
    process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY,
  ) && (process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY) !== 'mock_key';

  const turn = hasOpenAi
    ? await runAiTurn(session, camp, userMessage)
    : runFallbackTurn(session, camp, userMessage);

  if (turn.action === 'reply' && turn.replyToUser) {
    pushHistory(session, 'assistant', turn.replyToUser);
  }

  return turn;
};

const clearSession = (fromNumber) => {
  sessions.delete(fromNumber);
};

module.exports = {
  handleConversationTurn,
  clearSession,
  detectLanguage,
  capabilitiesText,
};
