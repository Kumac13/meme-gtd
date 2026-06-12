import readline from 'node:readline/promises';

/**
 * Ask the user to confirm a destructive action by typing "yes".
 *
 * Returns false without prompting when stdin is not a TTY (scripts, CI,
 * AI agents) so destructive operations can never be confirmed implicitly.
 */
export const confirmDestructive = async (message: string): Promise<boolean> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message}\nType "yes" to continue: `);
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
};
