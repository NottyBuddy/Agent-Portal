import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gradeQuizAnswers, quizBank } from '../api/_lib/quiz.js';
import { numericFields, validDate } from '../api/_lib/supabase.js';

test('quiz grading accepts valid unique answers and calculates the score server-side', () => {
  const answers = quizBank.slice(0, 3).map(q => ({
    question: q.question,
    selected: q.correct
  }));
  const result = gradeQuizAnswers(answers);
  assert.equal(result.error, undefined);
  assert.equal(result.score, 3);
  assert.equal(result.total, 3);
  assert.deepEqual(result.answers.map(x => x.correct), [true, true, true]);
});

test('quiz grading rejects empty, oversized, duplicate and unknown submissions', () => {
  assert.match(gradeQuizAnswers([]).error, /1 to 7/);
  assert.match(gradeQuizAnswers(quizBank.slice(0, 8).map(q => ({ question: q.question, selected: q.correct })).concat([])).error, /1 to 7/);
  const duplicate = { question: quizBank[0].question, selected: 0 };
  assert.match(gradeQuizAnswers([duplicate, duplicate]).error, /duplicate/);
  assert.match(gradeQuizAnswers([{ question: 'Unknown question', selected: 0 }]).error, /unknown/);
  assert.match(gradeQuizAnswers([{ question: quizBank[0].question, selected: 999 }]).error, /invalid/);
});

test('quiz grading rejects malformed answer objects and non-integer selections', () => {
  assert.match(gradeQuizAnswers([null]).error, /incomplete or invalid/);
  assert.match(gradeQuizAnswers([{ question: quizBank[0].question, selected: '0' }]).error, /incomplete or invalid/);
});

test('date validation accepts real ISO dates and rejects impossible or reversed values', () => {
  assert.equal(validDate('2026-11-17'), true);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('17-11-2026'), false);
  assert.equal(validDate('2026-1-7'), false);
  assert.equal(validDate(null), false);
});

test('numeric KPI validation rejects negative, non-finite and excessive values', () => {
  assert.deepEqual(numericFields({ calls: 12, talk: 3.5 }, ['calls', 'talk']), [12, 3.5]);
  assert.deepEqual(numericFields({}, ['calls']), [0]);
  assert.throws(() => numericFields({ calls: -1 }, ['calls']), /non-negative/);
  assert.throws(() => numericFields({ calls: 'NaN' }, ['calls']), /non-negative/);
  assert.throws(() => numericFields({ calls: 100000001 }, ['calls']), /non-negative/);
});

test('server auth and database migration retain required access-control guardrails', async () => {
  const auth = await readFile(new URL('../api/_lib/supabase.js', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/202611160001_initial_schema.sql', import.meta.url), 'utf8');
  const team = await readFile(new URL('../api/team.js', import.meta.url), 'utf8');
  const kpi = await readFile(new URL('../api/kpi.js', import.meta.url), 'utf8');

  assert.match(auth, /auth\.getUser\(token\)/);
  assert.match(auth, /!profile\.active/);
  assert.match(auth, /mahesh\.s@hrhnext\.com/);
  assert.match(auth, /options\.manager/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /public\.is_authorized_manager\(\)/);
  assert.match(migration, /quiz_insert_own/);
  assert.match(migration, /No INSERT\/UPDATE\/DELETE policy for authenticated on simulation_attempts/);
  assert.match(team, /requireUser\(req, res, \{ manager: true \}\)/);
  assert.match(kpi, /if \(!auth\.isManager\)/);
});


test('agent-visible leaderboard returns only approved ranking fields', async () => {
  const { publicLeaderboardRows } = await import('../api/_lib/insights.js');
  const projected = publicLeaderboardRows([{
    user_id: 'private-user-id', email: 'agent@example.com', display_name: 'Agent A',
    attempts: 40, connected: 12, qualified: 5, consultations: 2,
    productive_actions: 8, connect_rate: 30, quiz_score: 95, quiz_count: 4,
    sim_score: 88, sim_count: 3, talk_minutes: 120
  }]);
  assert.deepEqual(projected, [{
    display_name: 'Agent A', connect_rate: 30, qualified: 5,
    consultations: 2, productive_actions: 8
  }]);
  assert.equal(Object.hasOwn(projected[0], 'email'), false);
  assert.equal(Object.hasOwn(projected[0], 'quiz_score'), false);
  assert.equal(Object.hasOwn(projected[0], 'sim_score'), false);
  assert.equal(Object.hasOwn(projected[0], 'talk_minutes'), false);
});


test('simulation history enforces alternating roles, mode readiness and transcript size', async () => {
  const { validateSimulationHistory } = await import('../api/_lib/simulation.js');
  const valid = [{ role: 'user', content: 'I need a quote for my home.' }];
  assert.equal(validateSimulationHistory(valid, 'turn').history.length, 1);
  assert.match(validateSimulationHistory(valid, 'evaluate').error, /not ready/);
  assert.match(validateSimulationHistory([{ role: 'assistant', content: 'Hello, how can I help?' }], 'turn').error, /sequence/);
  assert.match(validateSimulationHistory([{ role: 'user', content: 'x'.repeat(1801) }], 'turn').error, /1,800/);
  const long = Array.from({ length: 7 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(1800)
  }));
  assert.match(validateSimulationHistory(long, 'turn').error, /too long/);
});

test('simulation output validators reject oversized or malformed AI responses', async () => {
  const { validateCustomerReply, validateSimulationEvaluation } = await import('../api/_lib/simulation.js');
  assert.equal(validateCustomerReply({ customer_reply: 'Please explain the quotation.' }), 'Please explain the quotation.');
  assert.equal(validateCustomerReply({ customer_reply: 'word '.repeat(91) }), null);
  assert.equal(validateCustomerReply({ customer_reply: 'x'.repeat(901) }), null);

  const criteria = [
    { name: 'Empathy and call control', score: 18, max: 20, feedback: 'Good control.' },
    { name: 'Discovery and clarification', score: 18, max: 20, feedback: 'Good discovery.' },
    { name: 'Accuracy and policy compliance', score: 27, max: 30, feedback: 'No unsupported claims.' },
    { name: 'Objection handling', score: 13, max: 15, feedback: 'Handled objection.' },
    { name: 'Clear next step and closure', score: 13, max: 15, feedback: 'Clear next step.' }
  ];
  const evaluation = {
    score: 89, criteria, strengths: ['Clear language'], improvements: ['Probe timeline'],
    training_recommendation: 'Practise project timeline discovery.', policy_risks: []
  };
  assert.equal(validateSimulationEvaluation(evaluation).score, 89);
  assert.equal(validateSimulationEvaluation({ ...evaluation, score: '89' }), null);
  assert.equal(validateSimulationEvaluation({ ...evaluation, criteria: criteria.map((x, i) => i ? x : { ...x, score: 99 }) }), null);
  assert.equal(validateSimulationEvaluation({ ...evaluation, strengths: ['x'.repeat(241)] }), null);
});
