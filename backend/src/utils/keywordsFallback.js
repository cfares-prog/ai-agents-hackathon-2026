/**
 * Keyword-based urgency fallback if the primary AI engine encounters timeouts or issues.
 * @param {string} issueDescription 
 * @param {Array<string>} needsList 
 * @returns {Object} Static matched triage scores
 */
const evaluateFallbackUrgency = (issueDescription, needsList) => {
  const normalizedText = `${issueDescription} ${needsList.join(' ')}`.toLowerCase();
  
  const highUrgencyKeywords = ["bleeding", "choking", "no water", "dehydration", "fever", "child", "infant", "insulin", "doctor", "hospital"];
  
  const containsCriticalKeywords = highUrgencyKeywords.some(keyword => normalizedText.includes(keyword));
  
  if (containsCriticalKeywords) {
    return {
      score: 8,
      reason: "Fallback triggered: Urgent keywords matched regarding life safety or hydration bounds.",
      summary: "CRITICAL ACTION REQUIRED: Immediate resource matching needed due to critical safety markers."
    };
  }
  
  return {
    score: 5,
    reason: "Fallback triggered: Standard resource allocation rules applied due to generic need description.",
    summary: "Standard relief pipeline: Resources requested require general priority matching."
  };
};

module.exports = { evaluateFallbackUrgency };
