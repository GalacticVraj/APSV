import { execSync } from 'child_process';

const KEY_PATTERNS = [
  /gsk_[A-Za-z0-9]{32,}/i, // Groq keys
  /xai-[A-Za-z0-9]{32,}/i, // xAI keys
  /AIza[0-9A-Za-z-_]{35}/i, // Google Gemini keys
];

try {
  // Get staged files
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
    .split('\n')
    .filter(file => file.trim().length > 0);

  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  let foundKey = false;

  for (const file of stagedFiles) {
    try {
      // Get the staged content of the file
      const content = execSync(`git show :${file}`, { encoding: 'utf-8' });
      
      for (const pattern of KEY_PATTERNS) {
        if (pattern.test(content)) {
          console.error(`\x1b[31mERROR: Potential API Key found in staged file: ${file}\x1b[0m`);
          foundKey = true;
        }
      }
    } catch (e) {
      // If file is deleted, git show fails, ignore
    }
  }

  if (foundKey) {
    console.error('\x1b[31mCommit rejected: Please remove API keys from your code and use environment variables.\x1b[0m');
    process.exit(1);
  }

  process.exit(0);
} catch (err) {
  console.error('Error running key check:', err);
  process.exit(1);
}
