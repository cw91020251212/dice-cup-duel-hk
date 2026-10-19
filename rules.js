// All triples are classified first, including 1+1+1 and 6+6+6.
export function classifyRoll(values) {
  if (!Array.isArray(values) || values.length !== 3 || values.some(n => !Number.isInteger(n) || n < 1 || n > 6)) throw new TypeError('必須有三粒 1–6 點骰子');
  const total = values.reduce((a,b) => a+b, 0);
  const kind = values.every(n => n === values[0]) ? 'triple' : total <= 10 ? 'small' : 'big';
  return {total, kind, label: {triple:'骰', small:'小', big:'大'}[kind]};
}
export function judgeGuesses(values, guesses) {
  const result = classifyRoll(values);
  return {...result, points: guesses.map(guess => Number(result.kind !== 'triple' && guess === result.kind))};
}
