const http = require('http');

function requestJson(method, path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const trimmed = body.trim();
        try {
          resolve({ status: res.statusCode, body: trimmed ? JSON.parse(trimmed) : null, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, body: trimmed, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const register = await requestJson('POST', '/api/register', {
    name: 'Verify Script User',
    email: 'verify-script-user@example.com',
    password: 'Pass123!'
  });

  console.log('REGISTER_STATUS', register.status);
  console.log('REGISTER_BODY', JSON.stringify(register.body));

  const login = await requestJson('POST', '/api/login', {
    email: 'verify-script-user@example.com',
    password: 'Pass123!'
  });

  console.log('LOGIN_STATUS', login.status);
  console.log('LOGIN_BODY', JSON.stringify(login.body));
})();
