import fs from 'node:fs';
import path from 'node:path';
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ['node_modules', '.next', '.git', '.local', 'test-results'].includes(
        entry.name,
      )
    )
      continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx|md|css|json)$/.test(p)) {
      const b = fs.readFileSync(p);
      const t = b.toString('utf8');
      if (!Buffer.from(t, 'utf8').equals(b)) console.log('INVALID UTF8', p);
      if (/[âÃ][\u0080-\u00ff]/.test(t)) console.log('MOJIBAKE', p);
    }
  }
}
walk('.');
