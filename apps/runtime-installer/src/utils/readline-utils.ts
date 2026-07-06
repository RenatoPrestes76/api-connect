import readline from 'node:readline';

let _rl: readline.Interface | null = null;

function getInterface(): readline.Interface {
  if (!_rl) {
    _rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });
  }
  return _rl;
}

export function closeInterface(): void {
  _rl?.close();
  _rl = null;
}

export function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    getInterface().question(question, (answer) => resolve(answer.trim()));
  });
}

export async function promptRequired(question: string, errorMsg: string): Promise<string> {
  while (true) {
    const answer = await prompt(question);
    if (answer) return answer;
    process.stdout.write(`  ${errorMsg}\n`);
  }
}

export async function promptWithDefault(question: string, defaultValue: string): Promise<string> {
  const answer = await prompt(`${question} [${defaultValue}]: `);
  return answer || defaultValue;
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function promptChoice<T extends string>(
  question: string,
  choices:  T[],
  defaultChoice?: T,
): Promise<T> {
  const choiceStr = choices
    .map((c) => (c === defaultChoice ? c.toUpperCase() : c.toLowerCase()))
    .join('/');

  while (true) {
    const answer = (await prompt(`${question} [${choiceStr}]: `)).toLowerCase();
    if (!answer && defaultChoice) return defaultChoice;
    const match = choices.find((c) => c.toLowerCase() === answer);
    if (match) return match;
    process.stdout.write(`  Please choose one of: ${choices.join(', ')}\n`);
  }
}
