const http = require('http');
const https = require('https');
const { URL } = require('url');

function request(url, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const opt = {
        method: opts.method || 'GET',
        headers: opts.headers || {},
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
      };
      const req = lib.request(opt, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, body: text, headers: res.headers });
        });
      });
      req.on('error', (err) => reject(err));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

(async () => {
  const base = process.env.TEST_API_BASE || 'http://localhost:3000/api';
  try {
    console.log('Logging in as admin@example.com / admin123');
    const login = await request(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ email: 'admin@example.com', password: 'admin123' }));
    console.log('login status', login.status);
    console.log('login body', login.body);
    if (login.status === 200) {
      const j = JSON.parse(login.body);
      const token = j.token;
      console.log('got token length', token && token.length);
      const me = await request(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      console.log('/me status', me.status);
      console.log('/me body', me.body);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
