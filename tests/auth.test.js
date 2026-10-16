const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PORT = '3456';

const { app } = require('../server.js');

async function request(path, options = {}) {
  const baseUrl = `http://localhost:${process.env.PORT}${path}`;
  const res = await fetch(baseUrl, options);
  return {
    status: res.status,
    body: await res.json()
  };
}

test('register user and login with created account', async () => {
  const registerRes = await request('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'مستخدم جديد',
      email: 'newuser@example.com',
      password: 'Pass123!'
    })
  });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.success, true);

  const loginRes = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newuser@example.com',
      password: 'Pass123!'
    })
  });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.success, true);
  assert.equal(loginRes.body.user.email, 'newuser@example.com');
});
