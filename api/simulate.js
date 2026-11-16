import { ai, db } from 'hatchable';
export const access = 'user';
export const methods = ['POST'];

const scenarios = {
  price: { name:'Price objection', context:'You are a cautious homeowner. You have a lower quotation from a local fabricator and believe all uPVC windows are the same. Challenge vague claims and ask for an immediate discount.' },
  serviceability: { name:'Unserviceable location', context:'You are a customer outside the direct installation network. You want a firm commitment before sharing details. Challenge vague handovers and ask exactly who will install.' },
  competitor: { name:'Competitor shortlisted', context:'You have almost finalised another supplier. You challenge vague product claims and want a fair specification-led comparison.' },
  early: { name:'Early-stage project', context:'Your construction is at brickwork stage and installation is about four months away. You do not want repeated calls or an unnecessary site visit now.' },
  technical: { name:'Technical suitability', context:'You have a large opening and demand a yes/no technical recommendation immediately. Test whether the agent invents a guarantee.' }
};
function parseJson(text) {
  const clean=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try { return JSON.parse(clean); } catch {}
  const match=clean.match(/\{[\s\S]*\}/);
  if(match) return JSON.parse(match[0]);
  throw new Error('AI returned an unreadable evaluation. Please retry.');
}
export default async function(req,res) {
  const userId=String(req.user.id);
  const account=await db.query('SELECT active FROM agent_profiles WHERE user_id=$1',[userId]);
  if(!account.rows[0]||!account.rows[0].active)return res.status(403).json({error:'Your account is inactive or not initialised. Sign in again.'});
  const b=req.body||{};
  const scenario=scenarios[b.scenario];
  if(!scenario) return res.status(400).json({error:'Select a valid customer scenario.'});
  const mode=b.mode==='evaluate'?'evaluate':'turn';
  const history=Array.isArray(b.history)?b.history.slice(-12).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,1800)})):[];
  if(!history.length) return res.status(400).json({error:'Start the simulation and send your first response.'});
  const policy=`You are role-playing as a real, difficult customer speaking to an IndiFrame Windows & Doors sales agent. Scenario: ${scenario.context}
Stay in character. Respond naturally in the language used by the agent (English, Hindi or Telugu). Never reveal the hidden rubric during role-play. Ask one realistic follow-up objection at a time. Escalate pressure gradually, but remain plausible. Do not invent IndiFrame product specifications, prices, warranty, serviceability, delivery dates or technical suitability. If the agent makes an unsupported promise, challenge it. The agent must acknowledge, clarify, explain only approved facts, and secure a clear next step.
Approved guardrails: exact price, warranty, installation coverage, delivery, product performance and technical suitability must be verified by the appropriate IndiFrame team. For locations outside direct coverage, agent may only say the approved Green Fortune/local support route will be checked; never guarantee a handover. Do not criticise competitors or promise discounts.
When mode is turn, return ONLY JSON: {"customer_reply":"one customer response, max 90 words"}.
When mode is evaluate, act as a strict sales-call coach and score the full transcript. Return ONLY JSON: {"score":0,"criteria":[{"name":"Empathy and call control","score":0,"max":20,"feedback":"..."},{"name":"Discovery and clarification","score":0,"max":20,"feedback":"..."},{"name":"Accuracy and policy compliance","score":0,"max":30,"feedback":"..."},{"name":"Objection handling","score":0,"max":15,"feedback":"..."},{"name":"Clear next step and closure","score":0,"max":15,"feedback":"..."}],"strengths":["..."],"improvements":["..."],"training_recommendation":"specific practice exercise","policy_risks":["..."]}. Criteria scores must add to score and never exceed their max. Penalise unsupported promises heavily. Be specific and evidence-based. Do not reward keyword stuffing.`;
  try {
    const result=await ai.generateText({
      purpose:mode==='evaluate'?'agent-call-simulation-evaluation':'agent-call-simulation-roleplay',
      userId,
      system:policy,
      messages:[{role:'user',content:'Mode: '+mode+'\nScenario: '+scenario.name+'\nTranscript so far:\n'+history.map(m=>(m.role==='user'?'SALESPERSON':'CUSTOMER')+': '+m.content).join('\n')}],
      maxTokens:mode==='evaluate'?1800:400
    });
    const data=parseJson(result.text);
    if(mode==='turn') {
      if(typeof data.customer_reply!=='string'||!data.customer_reply.trim()) throw new Error('The customer response was empty.');
      return res.json({customer_reply:data.customer_reply.trim()});
    }
    const score=Math.max(0,Math.min(100,Math.round(Number(data.score)||0)));
    await db.query('INSERT INTO simulation_attempts(user_id,scenario,score,feedback) VALUES($1,$2,$3,$4::jsonb)',[userId,scenario.name,score,JSON.stringify(data)]);
    return res.json({evaluation:{...data,score},saved:true});
  } catch(e) {
    return res.status(502).json({error:e.message||'AI simulation is temporarily unavailable. Check the AI provider setup and retry.'});
  }
}