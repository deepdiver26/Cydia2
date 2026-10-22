// Pings each repo from GitHub's servers and writes data/status.json.
// Run by .github/workflows/status.yml. Requires Node 18+.
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const root = path.join(__dirname, '..');
const repos = JSON.parse(fs.readFileSync(path.join(root, 'data/repos.json'), 'utf8'));
const statusPath = path.join(root, 'data/status.json');
const previous = fs.existsSync(statusPath)
  ? JSON.parse(fs.readFileSync(statusPath, 'utf8'))
  : { repos: {} };

function ping(host) {
  return new Promise((resolve) => {
    const url = host.startsWith('http') ? host : 'https://' + host;
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      res.resume();
      resolve(true); // any HTTP response counts as "responded"
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

(async () => {
  const now = Date.now();
  const out = { updated: now, repos: {} };

  for (const repo of repos) {
    const prev = (previous.repos || {})[repo.url] || {};

    // Sample .test domains never respond. Keep their existing status so the demo colours stay.
    if (repo.url.endsWith('.test')) {
      if (prev.last_ok !== undefined) { out.repos[repo.url] = prev; }
      console.log(`${repo.url}: skipped (sample domain)`);
      continue;
    }

    const ok = await ping(repo.url);
    out.repos[repo.url] = {
      last_ok: ok ? now : (prev.last_ok || null),
      last_check: now,
      last_result: ok
    };
    console.log(`${repo.url}: ${ok ? 'responded' : 'no response'}`);
  }

  fs.writeFileSync(statusPath, JSON.stringify(out, null, 2) + '\n');
})();
