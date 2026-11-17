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
