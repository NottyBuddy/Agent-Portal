export const quizBank = [
  { question: 'Which check must happen before dialling any lead?', options: ['Confirm lead owner and protected-account status', 'Check the customer budget', 'Send a WhatsApp first', 'Ask for a site photo'], correct: 0 },
  { question: 'Which six items form the mandatory outbound discovery framework?', options: ['Name, age, budget, email, brand, source', 'Project type, location, stakeholder, stage, quantity, aperture readiness', 'Price, colour, glass, mesh, discount, delivery', 'PIN, payment, architect, vendor, order, warranty'], correct: 1 },
  { question: 'Customer says a local fabricator is cheaper. What is the best response?', options: ['Tell them local products are poor', 'Offer an unapproved discount', 'Acknowledge and offer a specification-led comparison', 'End the call'], correct: 2 },
  { question: 'What should an agent do for an unserviceable location?', options: ['Guarantee installation anyway', 'Check the approved Green Fortune / local support route', 'Transfer without consent', 'Close as lost immediately'], correct: 1 },
  { question: 'What should happen when the customer asks for a technical recommendation?', options: ['Guess based on room', 'Recommend the most expensive type', 'Capture opening details and route to Sales / Technical', 'Promise all types fit'], correct: 2 },
  { question: 'How should a callback be recorded?', options: ['Callback later', 'Follow up soon', 'Exact date, time and next action', 'No CRM note needed'], correct: 2 },
  { question: 'What is the correct response to a request for an exact price?', options: ['Invent a range', 'Use the approved starting reference and explain quote dependencies', 'Promise a discount', 'Compare a competitor'], correct: 1 },
  { question: 'What does a good call close include?', options: ['Only thank the customer', 'Clear next step, owner and timeframe', 'A long product pitch', 'Ask customer to call back'], correct: 1 },
  { question: 'When should WhatsApp information be sent?', options: ['Whenever the agent remembers', 'After confirming relevant requirement and consent', 'Instead of CRM update', 'Only after lost disposition'], correct: 1 },
  { question: 'Which warranty statement is safe?', options: ['All products have lifetime warranty', 'Every colour has identical coverage', 'Use approved headline terms and confirm written terms / exclusions', 'Promise replacement for any issue'], correct: 2 }
];

export function gradeQuizAnswers(answers) {
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 7) {
    return { error: 'Submit answers for 1 to 7 quiz questions.' };
  }
  const seen = new Set();
  let score = 0;
  const storedAnswers = [];
  for (const answer of answers) {
    if (!answer || typeof answer.question !== 'string' || !Number.isInteger(answer.selected)) {
      return { error: 'Quiz answers are incomplete or invalid.' };
    }
    const question = quizBank.find(item => item.question === answer.question);
    if (!question || seen.has(question.question) || answer.selected < 0 || answer.selected >= question.options.length) {
      return { error: 'Quiz contains an unknown, duplicate or invalid answer.' };
    }
    seen.add(question.question);
    if (answer.selected === question.correct) score += 1;
    storedAnswers.push({ question: question.question, selected: answer.selected, correct: answer.selected === question.correct });
  }
  return { score, total: storedAnswers.length, answers: storedAnswers };
}
