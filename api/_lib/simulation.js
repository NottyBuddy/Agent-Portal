export const simulationRubric = [
  { name: 'Empathy and call control', max: 20 },
  { name: 'Discovery and clarification', max: 20 },
  { name: 'Accuracy and policy compliance', max: 30 },
  { name: 'Objection handling', max: 15 },
  { name: 'Clear next step and closure', max: 15 }
];

const MAX_MESSAGE_CHARS = 1800;
const MAX_TRANSCRIPT_CHARS = 12000;

export function validateSimulationHistory(history, mode) {
  if (!Array.isArray(history) || history.length < 1 || history.length > 12) {
    return { error: 'The conversation must contain between 1 and 12 messages. Restart the scenario if needed.' };
  }
  if (!['turn', 'evaluate'].includes(mode)) {
    return { error: 'Select a valid simulation action.' };
  }

  const clean = [];
  let totalChars = 0;
  for (let index = 0; index < history.length; index += 1) {
    const message = history[index];
    const expectedRole = index % 2 === 0 ? 'user' : 'assistant';
    if (!message || message.role !== expectedRole || typeof message.content !== 'string') {
      return { error: 'The conversation sequence is invalid. Restart the scenario and try again.' };
    }
    const text = message.content.trim();
    if (text.length < 5 || text.length > MAX_MESSAGE_CHARS) {
      return { error: 'Each message must contain 5 to 1,800 characters.' };
    }
    totalChars += text.length;
    if (totalChars > MAX_TRANSCRIPT_CHARS) {
      return { error: 'The conversation is too long. Restart the scenario before continuing.' };
    }
    clean.push({ role: expectedRole, content: text });
  }

  const lastRole = clean.at(-1).role;
  if ((mode === 'turn' && lastRole !== 'user') || (mode === 'evaluate' && lastRole !== 'assistant')) {
    return { error: 'The conversation is not ready for this action. Complete the current turn first.' };
  }
  return { history: clean };
}

export function validateCustomerReply(data) {
  if (!data || typeof data.customer_reply !== 'string') return null;
  const reply = data.customer_reply.trim();
  if (!reply || reply.length > 900 || reply.split(/\s+/).length > 90) return null;
  return reply;
}

function cleanTextList(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const clean = value.map(item => typeof item === 'string' ? item.trim() : '');
  if (clean.some(item => !item || item.length > maxLength)) return null;
  return clean;
}

export function validateSimulationEvaluation(data) {
  if (!data || !Number.isInteger(data.score) || data.score < 0 || data.score > 100) return null;
  if (!Array.isArray(data.criteria) || data.criteria.length !== simulationRubric.length) return null;

  const criteria = [];
  for (let index = 0; index < simulationRubric.length; index += 1) {
    const expected = simulationRubric[index];
    const item = data.criteria[index];
    if (!item || item.name !== expected.name || item.max !== expected.max ||
        !Number.isInteger(item.score) || item.score < 0 || item.score > expected.max ||
        typeof item.feedback !== 'string' || !item.feedback.trim() || item.feedback.length > 500) {
      return null;
    }
    criteria.push({ name: expected.name, score: item.score, max: expected.max, feedback: item.feedback.trim() });
  }

  if (criteria.reduce((sum, item) => sum + item.score, 0) !== data.score) return null;
  const strengths = cleanTextList(data.strengths, 5, 240);
  const improvements = cleanTextList(data.improvements, 5, 240);
  const policyRisks = cleanTextList(data.policy_risks, 5, 240);
  if (!strengths || !improvements || !policyRisks ||
      typeof data.training_recommendation !== 'string' ||
      !data.training_recommendation.trim() || data.training_recommendation.length > 500) return null;

  return {
    score: data.score,
    criteria,
    strengths,
    improvements,
    training_recommendation: data.training_recommendation.trim(),
    policy_risks: policyRisks
  };
}
