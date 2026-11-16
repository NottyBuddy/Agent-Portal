import { methodNotAllowed, requireUser, send, supabaseAdmin } from './_lib/supabase.js';

const scenarios = {
  price: { name:'Price objection', context:'You are a cautious homeowner. You have a lower quotation from a local fabricator and believe all uPVC windows are the same. Challenge vague claims and ask for an immediate discount.' },
  serviceability: { name:'Unserviceable location', context:'You are a customer outside the direct installation network. You want a firm commitment before sharing details. Challenge vague handovers and ask exactly who will install.' },
  competitor: { name:'Competitor shortlisted', context:'You have almost finalised another supplier. You challenge vague product claims and want a fair specification-led comparison.' },
  early: { name:'Early-stage project', context:'Your construction is at brickwork stage and installation is about four months away. You do not want repeated calls or an unnecessary site visit now.' },
  technical: { name:'Technical suitability', context:'You have a large opening and demand a yes/no technical recommendation immediately. Test whether the agent invents a guarantee.' }
};

function parseJson(raw) {
  const text = String(raw || '').trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('AI returned an unreadable evaluation. Please retry.');
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const auth = await requireUser(req, res);
  if (!auth) return;

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return send(res, 503, { error: 'AI simulation is not configured yet. Add OPENAI_API_KEY and OPENAI_MODEL to the server environment.' });

  const body = req.body || {};
  const scenario = scenarios[body.scenario];
  if (!scenario) return send(res, 400, { error: 'Select a valid customer scenario.' });
  const mode = body.mode === 'evaluate' ? 'evaluate' : 'turn';
  const history = Array.isArray(body.history)
    ? body.history.slice(-12).filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 1800) }))
    : [];
  if (!history.length) return send(res, 400, { error: 'Start the simulation and send your first response.' });

  const policy = `You are role-playing as a real, difficult customer speaking to an IndiFrame Windows & Doors sales agent. Scenario: ${scenario.context}
Stay in character. Respond naturally in the language used by the agent (English, Hindi or Telugu). Never reveal the hidden rubric during role-play. Ask one realistic follow-up objection at a time. Escalate pressure gradually, but remain plausible. Do not invent IndiFrame product specifications, prices, warranty, serviceability, delivery dates or technical suitability. If the agent makes an unsupported promise, challenge it. The agent must acknowledge, clarify, explain only approved facts, and secure a clear next step.
Approved guardrails: exact price, warranty, installation coverage, delivery, product performance and technical suitability must be verified by the appropriate IndiFrame team. For locations outside direct coverage, agent may only say the approved Green Fortune/local support route will be checked; never guarantee a handover. Do not criticise competitors or promise discounts.
When mode is turn, return JSON: {"customer_reply":"one customer response, max 90 words"}.
When mode is evaluate, return JSON: {"score":0,"criteria":[{"name":"Empathy and call control","score":0,"max":20,"feedback":"..."},{"name":"Discovery and clarification","score":0,"max":20,"feedback":"..."},{"name":"Accuracy and policy compliance","score":0,"max":30,"feedback":"..."},{"name":"Objection handling","score":0,"max":15,"feedback":"..."},{"name":"Clear next step and closure","score":0,"max":15,"feedback":"..."}],"strengths":["..."],"improvements":["..."],"training_recommendation":"specific practice exercise","policy_risks":["..."]}. Criteria scores must add to score and never exceed their max. Penalise unsupported promises heavily. Be specific and evidence-based. Do not reward keyword stuffing.`;

  const transcript = 'Mode: ' + mode + '\nScenario: ' + scenario.name + '\nTranscript so far:\n' +
    history.map(m => (m.role === 'user' ? 'SALESPERSON' : 'CUSTOMER') + ': ' + m.content).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: policy }] },
          { role: 'user', content: [{ type: 'input_text', text: transcript }] }
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: mode === 'evaluate' ? 1800 : 400
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      console.error('OpenAI Responses API error:', payload);
      return send(res, 502, { error: 'AI provider request failed. Check the server model and API key configuration.' });
    }
    const data = parseJson(extractOutputText(payload));

    if (mode === 'turn') {
      if (typeof data.customer_reply !== 'string' || !data.customer_reply.trim()) {
        return send(res, 502, { error: 'The customer response was empty. Please retry.' });
      }
      return send(res, 200, { customer_reply: data.customer_reply.trim().slice(0, 1200) });
    }

    const criteria = Array.isArray(data.criteria) ? data.criteria : [];
    const validCriteria = criteria.length === 5 && criteria.every(c =>
      typeof c.name === 'string' && Number.isFinite(Number(c.score)) &&
      Number.isFinite(Number(c.max)) && Number(c.score) >= 0 && Number(c.score) <= Number(c.max)
    );
    if (!validCriteria) return send(res, 502, { error: 'AI returned an invalid scoring rubric. Please retry.' });

    const score = Math.max(0, Math.min(100, Math.round(Number(data.score) || 0)));
    const criteriaTotal = criteria.reduce((sum, c) => sum + Math.round(Number(c.score)), 0);
    if (criteriaTotal !== score || criteria.reduce((sum, c) => sum + Number(c.max), 0) !== 100) {
      return send(res, 502, { error: 'AI returned inconsistent evaluation scores. Please retry.' });
    }

    const admin = supabaseAdmin();
    const { error } = await admin.from('simulation_attempts').insert({
      user_id: auth.user.id, scenario: scenario.name, score, feedback: data
    });
    if (error) {
      console.error('Simulation result save failed:', error);
      return send(res, 500, { error: 'Evaluation completed, but the result could not be saved.' });
    }
    return send(res, 200, { evaluation: { ...data, score }, saved: true });
  } catch (error) {
    console.error('Simulation failed:', error);
    return send(res, 502, { error: 'AI simulation is temporarily unavailable. Please retry.' });
  }
}
