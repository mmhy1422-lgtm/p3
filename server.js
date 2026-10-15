const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

let OAuth2Client = null;
try {
  const googleAuth = require('google-auth-library');
  OAuth2Client = googleAuth.OAuth2Client;
} catch (error) {
  OAuth2Client = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '630733901982-i4j85d059qnqjjn1t7ifpv4jnrjjitc8.apps.googleusercontent.com';
const ROOT_DIR = __dirname;
const SEED_DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_DIR = process.env.DATA_DIR || SEED_DATA_DIR;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'admin@burgercraft.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');

if (process.env.NODE_ENV === 'production' && !ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD must be configured in production');
}

const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const OFFERS_FILE = path.join(DATA_DIR, 'offers.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function normalizeUser(user) {
  return {
    id: Number(user.id || Date.now() + Math.floor(Math.random() * 1000)),
    name: String(user.name || user.email || 'مستخدم').trim(),
    email: String(user.email || '').trim().toLowerCase(),
    password: user.password ? String(user.password) : '',
    role: user.role || 'user',
    provider: user.provider || 'local',
    googleId: user.googleId || null,
    created_at: user.created_at || new Date().toISOString()
  };
}

ensureDirectory(DATA_DIR);

const defaultMenu = [
  { id: 1, name: 'دابل سماش برجر', price: 160, description: 'قطعتين لحم بقرى طازج، جبنة أمريكي مزدوجة، صوص كرافت.', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
  { id: 2, name: 'كريسبي تشيكن برجر', price: 145, description: 'صدور دجاج مقرمشة حارة، صوص المايونيز الحار، خس وجبنة شيدر.', image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80' },
  { id: 3, name: 'لوديد فرايز بالجبعة', price: 75, description: 'بطاطس مقرمشة مغطاة بصوص الجبنة السائحة وقطع البيكون.', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80' }
];

const defaultOffers = [
  { id: 1, title: 'عرض العيلة الحصري', description: '٣ سندوتش برجر مشوي + طبق بطاطس كبير.', price: 299 },
  { id: 2, title: 'عرض الدابل اللذيذ', description: '٢ دابل سماش برجر + بطاطس لوديد بالجبنة + كانز.', price: 240 }
];

const defaultUsers = ADMIN_PASSWORD
  ? [{ id: 1, name: 'Admin', email: ADMIN_EMAIL, password: hashPassword(ADMIN_PASSWORD), role: 'admin', provider: 'local' }]
  : [];

if (!fs.existsSync(MENU_FILE)) writeJSON(MENU_FILE, readJSON(path.join(SEED_DATA_DIR, 'menu.json'), defaultMenu));
if (!fs.existsSync(OFFERS_FILE)) writeJSON(OFFERS_FILE, readJSON(path.join(SEED_DATA_DIR, 'offers.json'), defaultOffers));
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, defaultUsers);

const state = {
  menu: readJSON(MENU_FILE, defaultMenu),
  offers: readJSON(OFFERS_FILE, defaultOffers),
  orders: readJSON(ORDERS_FILE, []),
  users: readJSON(USERS_FILE, defaultUsers).map(normalizeUser).map((user) => ({
    ...user,
    password: user.password
      ? (user.password.startsWith('$') || /^[a-f0-9]{64}$/i.test(user.password) ? user.password : hashPassword(user.password))
      : ''
  }))
};

writeJSON(USERS_FILE, state.users);

const sessions = new Map();
const ORDER_STATUSES = new Set(['received', 'preparing', 'ready', 'delivered', 'cancelled']);

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email: user.email, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return token;
}

function getSessionUser(req) {
  const authorization = req.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = sessions.get(token);

  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return state.users.find((item) => item.email === session.email) || null;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'سجل دخولك مرة أخرى' });
  }

  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'سجل دخول الأدمن مرة أخرى' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تنفيذ هذا الإجراء' });
  }

  req.user = user;
  return next();
}

app.use(express.json({ limit: '1mb' }));
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'login.html'));
});
app.use((req, res, next) => {
  const blockedPath = /^\/(?:data|tests|node_modules|\.git)(?:\/|$)/.test(req.path)
    || /^\/(?:server\.js|package\.json|package-lock\.json|render\.yaml|start\.bat)$/.test(req.path);
  if (blockedPath) return res.sendStatus(404);
  return next();
});
app.use(express.static(ROOT_DIR, { index: false, dotfiles: 'deny' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'BurgerCraft API is running' });
});

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'يرجى إدخال بريد إلكتروني صحيح' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' });
  }

  const existingUser = state.users.find((user) => user.email === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'هذا البريد الإلكتروني مسجل بالفعل' });
  }

  const newUser = normalizeUser({
    id: Date.now(),
    name,
    email: normalizedEmail,
    password: hashPassword(password),
    role: 'user',
    provider: 'local',
    created_at: new Date().toISOString()
  });

  state.users.push(newUser);
  writeJSON(USERS_FILE, state.users);

  return res.status(201).json({
    success: true,
    message: 'تم إنشاء الحساب بنجاح',
    user: { email: newUser.email, role: newUser.role, name: newUser.name }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'من فضلك أدخل البريد الإلكتروني وكلمة المرور' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = state.users.find(
    (item) => item.email === normalizedEmail && item.password === hashPassword(String(password))
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
  }

  return res.json({
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    token: createSession(user),
    admin: user.role === 'admin',
    user: { email: user.email, role: user.role, name: user.name || user.email }
  });
});

app.post('/api/google-login', async (req, res) => {
  const { credential } = req.body || {};

  if (!credential) {
    return res.status(400).json({ success: false, message: 'لم يتم استلام بيانات تسجيل الدخول من جوجل' });
  }

  if (!OAuth2Client) {
    return res.status(503).json({ success: false, message: 'التحقق من جوجل غير مهيأ على الخادم' });
  }

  let payload;
  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'رمز جوجل غير صالح أو منتهي الصلاحية' });
  }

  if (!payload || !payload.email) {
    return res.status(401).json({ success: false, message: 'فشل التحقق من الهوية من جوجل' });
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = state.users.find((item) => item.email === normalizedEmail);

  if (!user) {
    user = normalizeUser({
      id: Date.now(),
      name: payload.name || payload.email.split('@')[0],
      email: normalizedEmail,
      password: hashPassword(`google-${payload.sub || Date.now()}`),
      role: 'user',
      provider: 'google',
      googleId: payload.sub || null,
      created_at: new Date().toISOString()
    });
    state.users.push(user);
    writeJSON(USERS_FILE, state.users);
  }

  return res.json({
    success: true,
    message: 'تم تسجيل الدخول بجوجل بنجاح',
    token: createSession(user),
    admin: user.role === 'admin',
    user: { email: user.email, role: user.role, name: user.name || payload.name }
  });
});

app.get('/api/menu', (req, res) => {
  res.json(state.menu);
});

app.post('/api/menu', requireAdmin, (req, res) => {
  const { name, price, description, image, category, badge } = req.body || {};

  if (!name || !description || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'الاسم والسعر والوصف مطلوبة' });
  }

  const item = {
    id: Date.now(),
    name: String(name).trim(),
    price: Number(price),
    description: String(description).trim(),
    image: image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    category: category === 'sides' ? 'sides' : 'burger',
    badge: String(badge || '').trim()
  };

  state.menu.push(item);
  writeJSON(MENU_FILE, state.menu);
  res.status(201).json({ success: true, item });
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const menuIndex = state.menu.findIndex((item) => String(item.id) === req.params.id);
  if (menuIndex === -1) {
    return res.status(404).json({ success: false, message: 'الصنف غير موجود' });
  }

  const [deletedItem] = state.menu.splice(menuIndex, 1);
  writeJSON(MENU_FILE, state.menu);
  return res.json({ success: true, item: deletedItem });
});

app.get('/api/offers', (req, res) => {
  res.json(state.offers);
});

app.post('/api/offers', requireAdmin, (req, res) => {
  const { title, description, price, image, badge } = req.body || {};

  if (!title || !description || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ success: false, message: 'عنوان العرض والتفاصيل والسعر مطلوبة' });
  }

  const offer = {
    id: Date.now(),
    title: String(title).trim(),
    description: String(description).trim(),
    price: Number(price),
    image: image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    badge: String(badge || 'عرض مميز').trim()
  };

  state.offers.push(offer);
  writeJSON(OFFERS_FILE, state.offers);
  res.status(201).json({ success: true, offer });
});

app.delete('/api/offers/:id', requireAdmin, (req, res) => {
  const offerIndex = state.offers.findIndex((offer) => String(offer.id) === req.params.id);
  if (offerIndex === -1) {
    return res.status(404).json({ success: false, message: 'العرض غير موجود' });
  }

  const [deletedOffer] = state.offers.splice(offerIndex, 1);
  writeJSON(OFFERS_FILE, state.offers);
  return res.json({ success: true, offer: deletedOffer });
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = req.user.role === 'admin'
    ? state.orders
    : state.orders.filter((order) => order.user_email === req.user.email);
  return res.json(orders);
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { customer_name, phone, address, payment_method, items } = req.body || {};

  if (!customer_name || !phone || !address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'بيانات الطلب غير مكتملة' });
  }

  const safeItems = items.map((item) => ({
    name: String(item.name || '').trim(),
    price: Number(item.price),
    quantity: Number(item.quantity)
  }));
  if (safeItems.some((item) => !item.name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return res.status(400).json({ success: false, message: 'أحد أصناف الطلب غير صالح' });
  }

  const order = {
    id: `KAZA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    user_email: req.user.email,
    customer_name: String(customer_name).trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    payment_method: payment_method || 'كاش',
    total_price: safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    items: safeItems,
    status: 'received',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.orders.push(order);
  writeJSON(ORDERS_FILE, state.orders);
  return res.status(201).json({ success: true, order });
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!ORDER_STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: 'حالة الطلب غير صالحة' });
  }

  const order = state.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
  }

  order.status = status;
  order.updated_at = new Date().toISOString();
  writeJSON(ORDERS_FILE, state.orders);
  return res.json({ success: true, order });
});

app.use((req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`BurgerCraft backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, state, startServer };
