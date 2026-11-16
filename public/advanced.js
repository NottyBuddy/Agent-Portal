/* AI role-play, daily leaderboard and coaching centre */
var simCaseIndex=0,simHistory=[],simBusy=false,simEvaluation=null;
var simCases=[
 {key:'price',name:'Price objection',level:'HARD',opening:'Your price is much higher than the local fabricator. Why should I pay more?'},
 {key:'serviceability',name:'Unserviceable location',level:'HARD',opening:'Your company does not install in my city. Why are you calling me then?'},
 {key:'competitor',name:'Competitor shortlisted',level:'EXPERT',opening:'I have almost finalised another company. What is actually different about your offer?'},
 {key:'early',name:'Early-stage project',level:'MEDIUM',opening:'Construction will take another four months. Why should I discuss windows now?'},
 {key:'technical',name:'Technical suitability',level:'EXPERT',opening:'Can you confirm that a sliding system will work for my 12-foot opening?'}
];
function advEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function advToast(s){const e=document.querySelector('#toast');if(e){e.textContent=s;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500);}}
async function advGet(view){const token=await window.agentAuth.accessToken();const r=await fetch('/api/insights'+(view?'?view='+view:''),{headers:{Authorization:'Bearer '+token}});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not load insights');return j;}
async function advPost(body){const token=await window.agentAuth.accessToken();const r=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error||'Simulation request failed');return j;}
function simTranscript(){return simHistory.map(m=>'<div class="rule" style="display:block;margin:8px 0;padding:12px 14px"><b style="display:block;color:'+(m.role==='user'?'#8bd9cc':'#f0c77a')+';font-size:10px;letter-spacing:1px;margin-bottom:5px">'+(m.role==='user'?'YOU · SALESPERSON':'CUSTOMER')+'</b>'+advEsc(m.content)+'</div>').join('');}
function simEvalHtml(e){const criteria=(e.criteria||[]).map(c=>'<div class="rule"><i>'+Number(c.score||0)+'/'+Number(c.max||0)+'</i><div><b>'+advEsc(c.name)+'</b><br><span class="muted">'+advEsc(c.feedback)+'</span></div></div>').join('');return '<div class="alert" style="margin-top:14px"><b>Simulation evaluation · '+Number(e.score||0)+'/100</b><div class="kpi-big" style="font-size:38px;margin:8px 0">'+Number(e.score||0)+' / 100</div><div class="rule-list">'+criteria+'</div></div><div class="two-col" style="margin-top:12px"><div class="panel"><h3>Strengths</h3><ul>'+((e.strengths||[]).map(x=>'<li>'+advEsc(x)+'</li>').join('')||'<li>Not specified</li>')+'</ul></div><div class="panel"><h3>Improve next</h3><ul>'+((e.improvements||[]).map(x=>'<li>'+advEsc(x)+'</li>').join('')||'<li>Not specified</li>')+'</ul></div></div><div class="tip" style="margin-top:12px"><b>Recommended training:</b> '+advEsc(e.training_recommendation||'Review the feedback and repeat the scenario.')+'</div>'+((e.policy_risks||[]).length?'<div class="alert" style="margin-top:10px"><b>Policy risks</b>'+e.policy_risks.map(advEsc).join('<br>')+'</div>':'');}
function simulationPage(){
 const s=simCases[simCaseIndex];
 return '<div class="section-head"><div><h3>AI customer role-play</h3><p>Respond as the IndiFrame salesperson. The AI customer adapts its objections to your replies; a coaching evaluation is generated at the end.</p></div></div>'+
 '<div class="two-col"><div class="panel"><span class="tag">CUSTOMER SCENARIO · '+s.level+'</span><h3 style="margin-top:12px">'+s.name+'</h3><div class="form-field" style="margin-top:12px"><label>Choose scenario</label><select class="select" id="simScenario">'+simCases.map((x,i)=>'<option value="'+i+'" '+(i===simCaseIndex?'selected':'')+'>'+x.name+' · '+x.level+'</option>').join('')+'</select></div><div class="alert" style="margin-top:14px"><b>Customer opening</b>'+s.opening+'</div><div class="form-actions"><button class="btn ghost" id="resetSim">Restart scenario</button></div></div><div class="panel"><h3>Evaluation framework</h3><div class="rule-list"><div class="rule"><i>20</i> Empathy and call control</div><div class="rule"><i>20</i> Discovery and clarification</div><div class="rule"><i>30</i> Accuracy and policy compliance</div><div class="rule"><i>15</i> Objection handling</div><div class="rule"><i>15</i> Clear next step and closure</div></div><p class="muted" style="font-size:10px;margin-top:12px">AI practice feedback is for coaching. It is not a formal QA or appraisal score.</p></div></div>'+
 '<div class="panel" style="margin-top:14px"><div class="script-top"><h3>Live conversation</h3><span class="tag">'+(simHistory.filter(x=>x.role==='user').length)+' AGENT TURNS</span></div><div id="simTranscript" style="max-height:420px;overflow:auto;padding:8px 0">'+(simHistory.length?simTranscript():'<div class="alert"><b>CUSTOMER</b>'+s.opening+'</div>')+'</div><textarea class="field" id="simAnswer" style="width:100%;min-height:100px;margin-top:12px" placeholder="Type your response exactly as you would speak to the customer..." '+(simEvaluation?'disabled':'')+'></textarea><div class="form-actions"><button class="btn primary" id="sendSim" '+(simBusy||simEvaluation?'disabled':'')+'>Send response</button><button class="btn ghost" id="finishSim" '+(simHistory.filter(x=>x.role==='user').length<1||simBusy||simEvaluation?'disabled':'')+'>Finish & evaluate</button></div><div id="simResult">'+(simEvaluation?simEvalHtml(simEvaluation):'')+'</div></div>';
}
async function sendSimTurn(){
 const input=document.querySelector('#simAnswer'),answer=(input?.value||'').trim();if(answer.length<5){advToast('Enter your response first.');return;}
 simHistory.push({role:'user',content:answer});simBusy=true;document.querySelector('#content').innerHTML=simulationPage();
 try{const d=await advPost({mode:'turn',scenario:simCases[simCaseIndex].key,history:simHistory});simHistory.push({role:'assistant',content:d.customer_reply});}
 catch(e){simHistory.pop();advToast(e.message);}
 finally{simBusy=false;document.querySelector('#content').innerHTML=simulationPage();wireAdvanced();}
}
async function finishSim(){
 if(simBusy||!simHistory.some(x=>x.role==='user'))return;simBusy=true;document.querySelector('#content').innerHTML=simulationPage();
 try{const d=await advPost({mode:'evaluate',scenario:simCases[simCaseIndex].key,history:simHistory});simEvaluation=d.evaluation;}
 catch(e){advToast(e.message);}
 finally{simBusy=false;document.querySelector('#content').innerHTML=simulationPage();wireAdvanced();}
}
async function leaderboardPage(){
 try{
  const d=await advGet('leaderboard'),rows=d.rows||[];
  const max=k=>Math.max(1,...rows.map(x=>Number(x[k]||0)));
  const ranked=rows.map(x=>({...x,score:(Number(x.connect_rate||0)/max('connect_rate')*30)+(Number(x.qualified||0)/max('qualified')*30)+(Number(x.consultations||0)/max('consultations')*25)+(Number(x.productive_actions||0)/max('productive_actions')*15)})).sort((a,b)=>b.score-a.score);
  return '<div class="section-head"><div><h3>Daily performance leaderboard</h3><p>Today’s manager-entered KPI data · refreshes on demand and every 60 seconds while this page is open</p></div><button class="btn ghost" id="refreshBoard">↻ Refresh ranking</button></div><div class="tip">RANKING MODEL · Connect rate 30% · Qualified leads 30% · Site consultations 25% · Productivity actions 15%. Productivity actions = follow-ups completed + CRM updates + WhatsApp shares. Score is a comparative daily index, not revenue or call quality.</div><div class="table-wrap" style="margin-top:14px"><table class="data-table"><thead><tr><th>Rank</th><th>Agent</th><th>Connect rate</th><th>Qualified</th><th>Consultations</th><th>Productivity actions</th><th>Score / 100</th></tr></thead><tbody>'+(ranked.map((x,i)=>'<tr><td><b>#'+(i+1)+'</b></td><td>'+advEsc(x.display_name||x.email)+'</td><td>'+Number(x.connect_rate||0).toFixed(1)+'%</td><td>'+x.qualified+'</td><td>'+x.consultations+'</td><td>'+x.productive_actions+'</td><td><b>'+x.score.toFixed(1)+'</b></td></tr>').join('')||'<tr><td colspan="7" class="empty">No agent KPI data is available yet. Ask the manager to enter daily figures.</td></tr>')+'</tbody></table></div><p class="muted" style="font-size:10px;margin-top:10px">Connect rate = connected calls ÷ (inbound calls + outbound attempts). Daily figures are supplied by the manager.</p>';
 }catch(e){return '<div class="alert"><b>Leaderboard unavailable</b>'+advEsc(e.message)+'</div>';}
}
async function coachingPage(){
 try{
  const d=await advGet(),rows=d.rows||[];
  const cards=rows.map(x=>{
   const tips=[];
   if(Number(x.attempts)>0&&Number(x.connect_rate)<25)tips.push('Connect rate below 25%: practise opening, permission checks and varied callback slots.');
   if(Number(x.connected)>0&&Number(x.qualified)/Number(x.connected)<.30)tips.push('Qualification conversion below 30%: practise the six discovery questions and need identification.');
   if(Number(x.qualified)>0&&Number(x.consultations)/Number(x.qualified)<.20)tips.push('Consultation conversion below 20%: practise requirement summaries and direct consultation asks.');
   if(x.quiz_score!==null&&Number(x.quiz_score)<80)tips.push('Quiz average below 80%: review the FAQ bank, objection responses and missed quiz explanations.');
   if(x.quiz_score===null)tips.push('No quiz history: complete the weekly knowledge quiz to establish a baseline.');
   if(x.sim_score!==null&&Number(x.sim_score)<70)tips.push('AI simulation average below 70%: repeat difficult-customer role-play and focus on the lowest-scoring rubric areas.');
   if(x.sim_score===null)tips.push('No AI simulation history: complete at least one customer role-play to establish call-handling baseline.');
   if(!tips.length)tips.push('No threshold-based gap detected. Continue scenario practice and maintain consistent CRM closure.');
   return '<article class="script-card"><div class="script-top"><h3>'+advEsc(x.display_name||x.email)+'</h3><span class="tag">'+(x.quiz_score===null?'QUIZ NOT TAKEN':'QUIZ '+Number(x.quiz_score).toFixed(0)+'%')+'</span></div><div class="grid stats" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:12px"><div class="stat"><small>CONNECT RATE</small><strong style="font-size:19px">'+Number(x.connect_rate||0).toFixed(1)+'%</strong></div><div class="stat"><small>QUALIFIED</small><strong style="font-size:19px">'+x.qualified+'</strong></div><div class="stat"><small>CONSULTS</small><strong style="font-size:19px">'+x.consultations+'</strong></div><div class="stat"><small>SIM AVG</small><strong style="font-size:19px">'+(x.sim_score===null?'—':Number(x.sim_score).toFixed(0)+'%')+'</strong></div></div><div class="rule-list" style="margin-top:12px">'+tips.map(t=>'<div class="rule"><i>✦</i>'+t+'</div>').join('')+'</div></article>';
  }).join('');
  return '<div class="section-head"><div><h3>Individual coaching recommendations</h3><p>Training priorities from each agent’s last 30 days of KPI, quiz and AI simulation performance.</p></div></div><div class="tip">COACHING LOGIC · Threshold-based recommendations identify practice needs. They do not automatically change an agent’s KPI or formal performance rating.</div><div class="script-list" style="margin-top:14px">'+(cards||'<div class="empty">No active agent KPI records are available yet.</div>')+'</div>';
 }catch(e){return '<div class="alert"><b>Coaching data unavailable</b>'+advEsc(e.message)+'</div>';}
}
var boardTimer=null;
function wireAdvanced(){
 if(boardTimer){clearInterval(boardTimer);boardTimer=null;}
 if(typeof current!=='undefined'&&current==='leaderboard')boardTimer=setInterval(async()=>{if(current!=='leaderboard')return;const c=document.querySelector('#content');if(c){c.innerHTML=await leaderboardPage();wireAdvanced();}},60000);
 const select=document.querySelector('#simScenario');if(select)select.onchange=()=>{simCaseIndex=Number(select.value)||0;simHistory=[];simEvaluation=null;document.querySelector('#content').innerHTML=simulationPage();wireAdvanced();};
 const reset=document.querySelector('#resetSim');if(reset)reset.onclick=()=>{simHistory=[];simEvaluation=null;document.querySelector('#content').innerHTML=simulationPage();wireAdvanced();};
 const send=document.querySelector('#sendSim');if(send)send.onclick=sendSimTurn;
 const finish=document.querySelector('#finishSim');if(finish)finish.onclick=finishSim;
 const refresh=document.querySelector('#refreshBoard');if(refresh)refresh.onclick=async()=>{document.querySelector('#content').innerHTML=await leaderboardPage();wireAdvanced();};
}