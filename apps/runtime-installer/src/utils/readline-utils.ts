import readline from 'node:readline';

let _rl: readline.Interface | null = null;

function getInterface(): readline.Interface {
  if (!_rl) {
    _rl = readline.createInterface({
      input: process.stdin,
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
  for (;;) {
    const answer = await prompt(question);
    if (answer) return answer;
    process.stdout.write(`  ${errorMsg}\n`);
  }
}

export async function promptWithDefault(question: string, defaultValue: string): Promise<string> {
  const answer = await prompt(`${question} [${defaultValue}]: `);
  return answer || defaultValue;
}

/**
 * Prompts for a secret without echoing it to the terminal (asterisks
 * instead) — unlike `prompt()`, which echoes everything typed in plain
 * text. Bypasses the shared `readline.Interface` temporarily (pausing
 * it, putting stdin in raw mode to read one keystroke at a time, then
 * restoring both) since `readline` itself has no built-in masked-input
 * mode. Falls back to plain (echoed) input when stdin isn't a TTY
 * (`setRawMode` unavailable — e.g. input piped from a file in a test or
 * a non-interactive install) rather than hanging forever waiting for raw
 * keystrokes that will never come.
 */
export function promptPassword(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.setRawMode) {
    return prompt(question);
  }

  return new Promise((resolve) => {
    const rl = getInterface();
    process.stdout.write(question);
    const wasRaw = stdin.isRaw;
    rl.pause();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const cleanup = (): void => {
      stdin.removeListener('data', onData);
      stdin.setRawMode?.(wasRaw ?? false);
      rl.resume();
    };
    const onData = (chunk: string): void => {
      switch (chunk) {
        case '\r':
        case '\n':
        case '\u0004': // Ctrl-D
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          break;
        case '\u0003': // Ctrl-C — same as an interactive shell
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          input += chunk;
          process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function promptChoice<T extends string>(
  question: string,
  choices: T[],
  defaultChoice?: T
): Promise<T> {
  const choiceStr = choices
    .map((c) => (c === defaultChoice ? c.toUpperCase() : c.toLowerCase()))
    .join('/');

  for (;;) {
    const answer = (await prompt(`${question} [${choiceStr}]: `)).toLowerCase();
    if (!answer && defaultChoice) return defaultChoice;
    const match = choices.find((c) => c.toLowerCase() === answer);
    if (match) return match;
    process.stdout.write(`  Please choose one of: ${choices.join(', ')}\n`);
  }
}
