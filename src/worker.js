const ORDER_STATUSES = new Set(['received', 'preparing', 'ready', 'delivered', 'cancelled']);
const DEFAULT_GOOGLE_CLIENT_ID = '630733901982-i4j85d059qnqjjn1t7ifpv4jnrjjitc8.apps.googleusercontent.com';

function json(data, status = 200) {
  return Response.json(data, { status });
}

function text(value, status = 200) {
  return new Response(value, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function createId(bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeMenu(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    image: row.image,
    category: row.category,
    badge: row.badge || ''
  };
}

function normalizeOffer(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    image: row.image,
    badge: row.badge || ''
  };
}

async function ensureAdmin(env) {
  const email = String(env.ADMIN_EMAIL || 'admin@burgercraft.com').trim().toLowerCase();
  if (!env.ADMIN_PASSWORD) throw new Error('Set the ADMIN_PASSWORD Worker secret before using the API.');

  const existing = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, provider, created_at)
       VALUES (?, ?, ?, ?, 'admin', 'local', ?)`
    ).bind(createId(), 'Admin', email, await sha256(env.ADMIN_PASSWORD), new Date().toISOString()).run();
  }
}

async function seedCatalog(env, request) {
  const marker = await env.DB.prepare("SELECT value FROM app_meta WHERE key = 'catalog_seeded'").first();
  if (marker) return;

  const base = new URL(request.url);
  const [menuResponse, offersResponse] = await Promise.all([
    env.ASSETS.fetch(new Request(new URL('/_seed/menu.json', base))),
    env.ASSETS.fetch(new Request(new URL('/_seed/offers.json', base)))
  ]);
  if (!menuResponse.ok || !offersResponse.ok) throw new Error('Catalog seed assets are missing.');

  const menu = await menuResponse.json();
  const offers = await offersResponse.json();
  const statements = [];

  for (const item of menu) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO menu_items (id, name, price, description, image, category, badge)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(String(item.id), String(item.name), Number(item.price), String(item.description), String(item.image || ''), String(item.category || 'burger'), String(item.badge || '')));
  }

  for (const offer of offers) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO offers (id, title, description, price, image, badge)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(String(offer.id), String(offer.title), String(offer.description), Number(offer.price), String(offer.image || ''), String(offer.badge || '')));
  }

  statements.push(env.DB.prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES ('catalog_seeded', ?)").bind(new Date().toISOString()));
  await env.DB.batch(statements);
}

async function getUser(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const tokenHash = await sha256(authorization.slice(7));
  const now = Date.now();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();
  const session = await env.DB.prepare(
    `SELECT users.id, users.name, users.email, users.role, users.provider
     FROM sessions JOIN users ON users.email = sessions.user_email
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
  ).bind(tokenHash, now).first();
  return session || null;
}

async function requireUser(request, env) {
  const user = await getUser(request, env);
  return user ? { user } : { response: json({ success: false, message: 'سجل دخولك مرة أخرى' }, 401) };
}

async function createSession(env, user) {
  const token = createId(32);
  const tokenHash = await sha256(token);
  const now = new Date();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_email, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(tokenHash, user.email, now.getTime() + 8 * 60 * 60 * 1000, now.toISOString()).run();
  return token;
}

async function handleRegister(request, env) {
  const { name, email, password } = await request.json();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();

  if (!normalizedName || !normalizedEmail || !password) {
    return json({ success: false, message: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return json({ success: false, message: 'يرجى إدخال بريد إلكتروني صحيح' }, 400);
  }
  if (String(password).length < 6) {
    return json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' }, 400);
  }

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, provider, created_at)
       VALUES (?, ?, ?, ?, 'user', 'local', ?)`
    ).bind(createId(), normalizedName, normalizedEmail, await sha256(password), now).run();
  } catch (error) {
    if (String(error.message).toLowerCase().includes('unique')) {
      return json({ success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' }, 409);
    }
    throw error;
  }

  return json({
    success: true,
    message: 'تم إنشاء الحساب بنجاح',
    user: { email: normalizedEmail, role: 'user', name: normalizedName }
  }, 201);
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return json({ success: false, message: 'من فضلك أدخل البريد الإلكتروني وكلمة المرور' }, 400);
  }

  const user = await env.DB.prepare(
    `SELECT id, name, email, role, provider, password_hash
     FROM users WHERE email = ? AND password_hash = ?`
  ).bind(normalizedEmail, await sha256(password)).first();
  if (!user) return json({ success: false, message: 'بيانات الدخول غير صحيحة' }, 401);

  return json({
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    token: await createSession(env, user),
    admin: user.role === 'admin',
    user: { email: user.email, role: user.role, name: user.name || user.email }
  });
}

async function handleGoogleLogin(request, env) {
  const { credential } = await request.json();
  if (!credential) return json({ success: false, message: 'لم يتم استلام بيانات تسجيل الدخول من جوجل' }, 400);

  const clientId = env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const verificationUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
  verificationUrl.searchParams.set('id_token', credential);
  const verification = await fetch(verificationUrl);
  if (!verification.ok) return json({ success: false, message: 'رمز جوجل غير صالح أو منتهي الصلاحية' }, 401);

  const profile = await verification.json();
  if (profile.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(profile.iss) || profile.email_verified !== 'true') {
    return json({ success: false, message: 'فشل التحقق من الهوية من جوجل' }, 401);
  }

  const email = String(profile.email || '').trim().toLowerCase();
  if (!email) return json({ success: false, message: 'لم يرسل Google بريدًا إلكترونيًا موثقًا' }, 401);
  let user = await env.DB.prepare('SELECT id, name, email, role, provider FROM users WHERE email = ?').bind(email).first();

  if (!user) {
    user = { id: createId(), name: profile.name || email.split('@')[0], email, role: 'user', provider: 'google' };
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, role, provider, google_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, user.name, user.email, user.role, user.provider, profile.sub || null, new Date().toISOString()).run();
  }

  return json({
    success: true,
    message: 'تم تسجيل الدخول بجوجل بنجاح',
    token: await createSession(env, user),
    admin: user.role === 'admin',
    user: { email: user.email, role: user.role, name: user.name || profile.name }
  });
}

async function handleMenu(request, env, url) {
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM menu_items ORDER BY rowid').all();
    return json(results.map(normalizeMenu));
  }

  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'admin') return json({ success: false, message: 'ليس لديك صلاحية تنفيذ هذا الإجراء' }, 403);

  if (request.method === 'POST') {
    const { name, price, description, image, category, badge } = await request.json();
    if (!name || !description || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return json({ success: false, message: 'الاسم والسعر والوصف مطلوبة' }, 400);
    }
    const item = {
      id: createId(12), name: String(name).trim(), price: Number(price), description: String(description).trim(),
      image: String(image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'),
      category: category === 'sides' ? 'sides' : 'burger', badge: String(badge || '').trim()
    };
    await env.DB.prepare(
      'INSERT INTO menu_items (id, name, price, description, image, category, badge) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(item.id, item.name, item.price, item.description, item.image, item.category, item.badge).run();
    return json({ success: true, item }, 201);
  }

  if (request.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.split('/').pop());
    const result = await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
    if (!result.meta.changes) return json({ success: false, message: 'الصنف غير موجود' }, 404);
    return json({ success: true, id });
  }

  return text('Method Not Allowed', 405);
}

async function handleOffers(request, env, url) {
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM offers ORDER BY rowid').all();
    return json(results.map(normalizeOffer));
  }

  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'admin') return json({ success: false, message: 'ليس لديك صلاحية تنفيذ هذا الإجراء' }, 403);

  if (request.method === 'POST') {
    const { title, description, price, image, badge } = await request.json();
    if (!title || !description || !Number.isFinite(Number(price)) || Number(price) < 0) {
      return json({ success: false, message: 'عنوان العرض والتفاصيل والسعر مطلوبة' }, 400);
    }
    const offer = {
      id: createId(12), title: String(title).trim(), description: String(description).trim(), price: Number(price),
      image: String(image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'),
      badge: String(badge || 'عرض مميز').trim()
    };
    await env.DB.prepare(
      'INSERT INTO offers (id, title, description, price, image, badge) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(offer.id, offer.title, offer.description, offer.price, offer.image, offer.badge).run();
    return json({ success: true, offer }, 201);
  }

  if (request.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.split('/').pop());
    const result = await env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(id).run();
    if (!result.meta.changes) return json({ success: false, message: 'العرض غير موجود' }, 404);
    return json({ success: true, id });
  }

  return text('Method Not Allowed', 405);
}

async function handleOrders(request, env, url, user) {
  if (request.method === 'GET') {
    const query = user.role === 'admin'
      ? env.DB.prepare(
        `SELECT orders.*, GROUP_CONCAT(order_items.name || ' × ' || order_items.quantity, '، ') AS items_summary
         FROM orders LEFT JOIN order_items ON order_items.order_id = orders.id
         GROUP BY orders.id ORDER BY orders.created_at DESC`
      )
      : env.DB.prepare(
        `SELECT orders.*, GROUP_CONCAT(order_items.name || ' × ' || order_items.quantity, '، ') AS items_summary
         FROM orders LEFT JOIN order_items ON order_items.order_id = orders.id
         WHERE orders.user_email = ? GROUP BY orders.id ORDER BY orders.created_at DESC`
      ).bind(user.email);
    const { results } = await query.all();
    const orders = await Promise.all(results.map(async (order) => {
      const { results: items } = await env.DB.prepare(
        'SELECT name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id'
      ).bind(order.id).all();
      return { ...order, items };
    }));
    return json(orders);
  }

  if (request.method === 'POST') {
    const { customer_name, phone, address, payment_method, items } = await request.json();
    if (!customer_name || !phone || !address || !Array.isArray(items) || !items.length) {
      return json({ success: false, message: 'بيانات الطلب غير مكتملة' }, 400);
    }
    const safeItems = items.map((item) => ({ name: String(item.name || '').trim(), price: Number(item.price), quantity: Number(item.quantity) }));
    if (safeItems.some((item) => !item.name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return json({ success: false, message: 'أحد أصناف الطلب غير صالح' }, 400);
    }

    const now = new Date().toISOString();
    const order = {
      id: `KAZA-${createId(4).toUpperCase()}`, user_email: user.email, customer_name: String(customer_name).trim(),
      phone: String(phone).trim(), address: String(address).trim(), payment_method: payment_method || 'كاش',
      total_price: safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0), status: 'received',
      created_at: now, updated_at: now, items: safeItems
    };
    const statements = [env.DB.prepare(
      `INSERT INTO orders (id, user_email, customer_name, phone, address, payment_method, total_price, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(order.id, order.user_email, order.customer_name, order.phone, order.address, order.payment_method, order.total_price, order.status, now, now)];
    for (const item of safeItems) {
      statements.push(env.DB.prepare(
        'INSERT INTO order_items (order_id, name, price, quantity) VALUES (?, ?, ?, ?)'
      ).bind(order.id, item.name, item.price, item.quantity));
    }
    await env.DB.batch(statements);
    return json({ success: true, order }, 201);
  }

  const statusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (request.method === 'PATCH' && statusMatch) {
    if (user.role !== 'admin') return json({ success: false, message: 'ليس لديك صلاحية تنفيذ هذا الإجراء' }, 403);
    const { status } = await request.json();
    if (!ORDER_STATUSES.has(status)) return json({ success: false, message: 'حالة الطلب غير صالحة' }, 400);
    const id = decodeURIComponent(statusMatch[1]);
    const result = await env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, new Date().toISOString(), id).run();
    if (!result.meta.changes) return json({ success: false, message: 'الطلب غير موجود' }, 404);
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
    const { results: items } = await env.DB.prepare('SELECT name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id').bind(id).all();
    return json({ success: true, order: { ...order, items } });
  }

  return text('Method Not Allowed', 405);
}

async function dispatchApi(request, env, url) {
  await seedCatalog(env, request);
  await ensureAdmin(env);
  const { pathname } = url;

  if (pathname === '/api/health' && request.method === 'GET') return json({ success: true, message: 'BurgerCraft API is running' });
  if (pathname === '/api/register' && request.method === 'POST') return handleRegister(request, env);
  if (pathname === '/api/login' && request.method === 'POST') return handleLogin(request, env);
  if (pathname === '/api/google-login' && request.method === 'POST') return handleGoogleLogin(request, env);
  if (pathname === '/api/menu') return handleMenu(request, env, url);
  if (pathname.startsWith('/api/menu/')) return handleMenu(request, env, url);
  if (pathname === '/api/offers') return handleOffers(request, env, url);
  if (pathname.startsWith('/api/offers/')) return handleOffers(request, env, url);
  if (pathname === '/api/orders') {
    const auth = await requireUser(request, env);
    if (auth.response) return auth.response;
    return handleOrders(request, env, url, auth.user);
  }
  if (pathname.startsWith('/api/orders/')) {
    const auth = await requireUser(request, env);
    if (auth.response) return auth.response;
    return handleOrders(request, env, url, auth.user);
  }

  return json({ success: false, message: 'المسار غير موجود' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/_seed/')) return text('Not Found', 404);

    try {
      if (url.pathname.startsWith('/api/')) return await dispatchApi(request, env, url);
      if (url.pathname === '/') {
        return env.ASSETS.fetch(new Request(new URL('/login.html', url), request));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Worker request failed:', error);
      return json({ success: false, message: 'حدث خطأ داخلي، حاول مرة أخرى' }, 500);
    }
  }
};
