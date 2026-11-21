import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { advise } from './chatbot.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEV = process.env.NODE_ENV !== 'production';
const STAT = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn tất', 'Đã hủy'];
class Err extends Error {}
const h = f => (q, s, n) => f(q, s).catch(n);
const bad = (s, m, c = 400) => s.status(c).json({ error: m });
const sign = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
const tokenOf = q => (q.headers.authorization || '').replace('Bearer ', '');
const auth = (q, s, n) => { try { q.user = jwt.verify(tokenOf(q), SECRET); n(); } catch { bad(s, 'Vui lòng đăng nhập.', 401); } };
const maybe = (q, s, n) => { try { q.user = jwt.verify(tokenOf(q), SECRET); } catch { /* khách vãng lai */ } n(); };
const admin = [auth, (q, s, n) => (q.user.role === 'admin' ? n() : bad(s, 'Bạn không có quyền truy cập.', 403))];
const mailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const pwOk = p => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p);
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address });
const tags = r => ({ ...r, tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags || [] });

// OTP: ghi ra console; ở môi trường dev còn trả về để hiển thị (chưa tích hợp gửi email)
async function sendOtp(u) {
  const otp = String(crypto.randomInt(100000, 1000000));
  await db.query('UPDATE users SET otp=?, otp_exp=DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id=?', [await bcrypt.hash(otp, 8), u.id]);
  console.log(`[OTP] ${u.email}: ${otp}`);
  return DEV ? otp : undefined;
}

/* ============ Xác thực ============ */
app.post('/api/auth/register', h(async (q, s) => {
  const { name = '', email = '', password = '', confirm } = q.body;
  const e = email.trim().toLowerCase();
  if (!name.trim() || !e || !password) return bad(s, 'Vui lòng nhập đủ họ tên, email và mật khẩu.');
  if (!mailOk(e)) return bad(s, 'Email không đúng định dạng.');
  if (!pwOk(password)) return bad(s, 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.');
  if (password !== confirm) return bad(s, 'Mật khẩu xác nhận không khớp.');
  const [[ex]] = await db.query('SELECT id, verified FROM users WHERE email=?', [e]);
  if (ex?.verified) return bad(s, 'Email này đã được đăng ký.', 409);
  const hash = await bcrypt.hash(password, 10);
  let id = ex?.id;
  if (id) await db.query('UPDATE users SET name=?, password_hash=? WHERE id=?', [name.trim(), hash, id]);
  else id = (await db.query('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', [name.trim(), e, hash]))[0].insertId;
  s.json({ message: 'Đã gửi mã OTP.', devOtp: await sendOtp({ id, email: e }) });
}));

app.post('/api/auth/verify-otp', h(async (q, s) => {
  const e = (q.body.email || '').trim().toLowerCase();
  const [[u]] = await db.query('SELECT *, otp_exp < NOW() AS expired FROM users WHERE email=?', [e]);
  if (!u || !u.otp) return bad(s, 'Không có yêu cầu xác thực. Hãy thử lại từ đầu.');
  if (u.expired) return bad(s, 'Mã OTP đã hết hạn. Hãy gửi lại mã.');
  if (!(await bcrypt.compare(String(q.body.otp || ''), u.otp))) return bad(s, 'Mã OTP không đúng.');
  await db.query('UPDATE users SET verified=1, otp=NULL, otp_exp=NULL WHERE id=?', [u.id]);
  s.json({ message: 'Xác thực thành công.', resetToken: q.body.purpose === 'reset' ? jwt.sign({ id: u.id, purpose: 'reset' }, SECRET, { expiresIn: '10m' }) : undefined });
}));

const resend = h(async (q, s) => {
  const [[u]] = await db.query('SELECT id, email FROM users WHERE email=?', [(q.body.email || '').trim().toLowerCase()]);
  if (!u) return bad(s, 'Email này chưa được đăng ký.', 404);
  s.json({ message: 'Đã gửi mã OTP.', devOtp: await sendOtp(u) });
});
app.post('/api/auth/resend-otp', resend);
app.post('/api/auth/forgot', resend);

app.post('/api/auth/reset', h(async (q, s) => {
  const { resetToken, password = '', confirm } = q.body;
  let p; try { p = jwt.verify(resetToken, SECRET); } catch { return bad(s, 'Phiên đặt lại mật khẩu đã hết hạn. Hãy xác thực OTP lại.'); }
  if (p.purpose !== 'reset') return bad(s, 'Phiên không hợp lệ.');
  if (!pwOk(password)) return bad(s, 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.');
  if (password !== confirm) return bad(s, 'Mật khẩu xác nhận không khớp.');
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 10), p.id]);
  s.json({ message: 'Đã đổi mật khẩu.' });
}));

app.post('/api/auth/login', h(async (q, s) => {
  const e = (q.body.email || '').trim().toLowerCase();
  if (!e || !q.body.password) return bad(s, 'Hãy nhập đủ email và mật khẩu.');
  const [[u]] = await db.query('SELECT * FROM users WHERE email=?', [e]);
  if (!u || !(await bcrypt.compare(q.body.password, u.password_hash))) return bad(s, 'Email hoặc mật khẩu không đúng.', 401);
  if (!u.verified) return s.status(403).json({ error: 'Tài khoản chưa xác thực. Đã gửi mã OTP mới.', needOtp: true, email: e, devOtp: await sendOtp(u) });
  s.json({ token: sign(u), user: pub(u) });
}));

app.get('/api/auth/me', auth, h(async (q, s) => {
  const [[u]] = await db.query('SELECT * FROM users WHERE id=?', [q.user.id]);
  u ? s.json({ user: pub(u) }) : bad(s, 'Tài khoản không tồn tại.', 401);
}));
app.put('/api/auth/me', auth, h(async (q, s) => {
  const { name = '', phone = '', address = '' } = q.body;
  if (!name.trim()) return bad(s, 'Họ tên không được để trống.');
  if (phone && !/^0\d{9}$/.test(phone.trim())) return bad(s, 'Số điện thoại gồm 10 số và bắt đầu bằng 0.');
  await db.query('UPDATE users SET name=?, phone=?, address=? WHERE id=?', [name.trim(), phone.trim(), address.trim(), q.user.id]);
  const [[u]] = await db.query('SELECT * FROM users WHERE id=?', [q.user.id]);
  s.json({ user: pub(u) });
}));
app.put('/api/auth/password', auth, h(async (q, s) => {
  const { current = '', password = '', confirm } = q.body;
  const [[u]] = await db.query('SELECT * FROM users WHERE id=?', [q.user.id]);
  if (!(await bcrypt.compare(current, u.password_hash))) return bad(s, 'Mật khẩu hiện tại không đúng.');
  if (!pwOk(password)) return bad(s, 'Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.');
  if (password !== confirm) return bad(s, 'Mật khẩu xác nhận không khớp.');
  await db.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 10), u.id]);
  s.json({ message: 'Đã đổi mật khẩu.' });
}));

/* ============ Danh mục ============ */
app.get('/api/categories', h(async (q, s) => s.json((await db.query(
  'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS products FROM categories c ORDER BY c.id'))[0])));
app.post('/api/categories', admin, h(async (q, s) => {
  const n = String(q.body.name || '').trim(); if (!n) return bad(s, 'Hãy nhập tên danh mục.');
  s.json({ id: (await db.query('INSERT INTO categories(name) VALUES(?)', [n]))[0].insertId });
}));
app.put('/api/categories/:id', admin, h(async (q, s) => {
  const n = String(q.body.name || '').trim(); if (!n) return bad(s, 'Hãy nhập tên danh mục.');
  await db.query('UPDATE categories SET name=? WHERE id=?', [n, q.params.id]); s.json({ ok: true });
}));
app.delete('/api/categories/:id', admin, h(async (q, s) => {
  const [[c]] = await db.query('SELECT COUNT(*) n FROM products WHERE category_id=?', [q.params.id]);
  if (c.n) return bad(s, 'Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước.', 409);
  await db.query('DELETE FROM categories WHERE id=?', [q.params.id]); s.json({ ok: true });
}));

/* ============ Sản phẩm ============ */
const PRICE = 'COALESCE(NULLIF(p.sale_price,0), p.price)';
const SEL = 'SELECT p.*, c.name AS category FROM products p JOIN categories c ON c.id=p.category_id';
const SORT = { sold: 'p.sold DESC', new: 'p.id DESC', asc: PRICE + ' ASC', desc: PRICE + ' DESC' };
app.get('/api/brands', h(async (q, s) => s.json((await db.query('SELECT DISTINCT brand FROM products WHERE active=1 ORDER BY brand'))[0].map(r => r.brand))));
app.get('/api/products', h(async (q, s) => {
  const { q: kw, category, brand, min, max, skin, sort } = q.query, w = ['p.active=1'], a = [];
  if (kw) { w.push('(p.name LIKE ? OR p.brand LIKE ? OR CAST(p.tags AS CHAR) LIKE ?)'); a.push(...Array(3).fill(`%${kw}%`)); }
  if (category) { w.push('p.category_id=?'); a.push(category); }
  if (brand) { w.push('p.brand=?'); a.push(brand); }
  if (min) { w.push(PRICE + '>=?'); a.push(+min); }
  if (max) { w.push(PRICE + '<?'); a.push(+max); }
  if (skin) { w.push('JSON_CONTAINS(p.tags, JSON_QUOTE(?))'); a.push(skin); }
  s.json((await db.query(`${SEL} WHERE ${w.join(' AND ')} ORDER BY ${SORT[sort] || SORT.sold}`, a))[0].map(tags));
}));
app.get('/api/products/:id', h(async (q, s) => {
  const [[p]] = await db.query(`${SEL} WHERE p.id=? AND p.active=1`, [q.params.id]);
  p ? s.json(tags(p)) : bad(s, 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
}));
const pbody = b => {
  const price = +b.price, sale = +b.sale_price || 0, stock = Math.max(0, Math.floor(+b.stock) || 0);
  if (!String(b.name || '').trim() || !(price > 0) || !b.category_id) throw new Err('Hãy nhập tên, danh mục và giá bán lớn hơn 0.');
  if (sale && sale >= price) throw new Err('Giá khuyến mãi phải nhỏ hơn giá bán.');
  const t = (Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',')).map(x => String(x).trim().toLowerCase()).filter(Boolean);
  return [String(b.name).trim(), String(b.brand || 'Khác').trim(), +b.category_id, price, sale, stock, b.color || '#c06fbb',
    b.description || '', b.image_url || '', JSON.stringify(t), b.active === false || b.active === 0 ? 0 : 1];
};
const COLS = 'name,brand,category_id,price,sale_price,stock,color,description,image_url,tags,active';
app.get('/api/admin/products', admin, h(async (q, s) => s.json((await db.query(`${SEL} ORDER BY p.id DESC`))[0].map(tags))));
app.post('/api/products', admin, h(async (q, s) => {
  s.json({ id: (await db.query(`INSERT INTO products(${COLS}) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, pbody(q.body)))[0].insertId });
}));
app.put('/api/products/:id', admin, h(async (q, s) => {
  await db.query(`UPDATE products SET ${COLS.split(',').map(c => c + '=?').join(',')} WHERE id=?`, [...pbody(q.body), q.params.id]); s.json({ ok: true });
}));
app.delete('/api/products/:id', admin, h(async (q, s) => {
  const [[u]] = await db.query('SELECT COUNT(*) n FROM order_items WHERE product_id=?', [q.params.id]);
  if (u.n) { await db.query('UPDATE products SET active=0 WHERE id=?', [q.params.id]); return s.json({ ok: true, deactivated: true }); }
  await db.query('DELETE FROM products WHERE id=?', [q.params.id]); s.json({ ok: true });
}));

/* ============ Đơn hàng ============ */
const withItems = async rows => {
  if (!rows.length) return rows;
  const [it] = await db.query('SELECT * FROM order_items WHERE order_id IN (?)', [rows.map(r => r.id)]);
  return rows.map(r => ({ ...r, items: it.filter(i => i.order_id === r.id) }));
};
app.post('/api/orders', auth, h(async (q, s) => {
  const { items = [], name, phone, address, note = '', payment = 'cod', shipping = 'std', coupon = '' } = q.body;
  if (!Array.isArray(items) || !items.length) return bad(s, 'Giỏ hàng chưa có sản phẩm.');
  if (!name?.trim() || !phone?.trim() || !address?.trim()) return bad(s, 'Hãy nhập đủ tên, số điện thoại và địa chỉ nhận hàng.');
  if (!/^0\d{9}$/.test(phone.trim())) return bad(s, 'Số điện thoại gồm 10 số và bắt đầu bằng 0.');
  if (!['cod', 'bank', 'vnpay'].includes(payment)) return bad(s, 'Phương thức thanh toán không hợp lệ.');
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    let sub = 0; const lines = [];
    for (const it of items) {
      const qty = Math.floor(+it.qty);
      if (!(qty > 0)) throw new Err('Số lượng không hợp lệ.');
      const [[p]] = await c.query('SELECT * FROM products WHERE id=? AND active=1 FOR UPDATE', [it.id]);
      if (!p) throw new Err('Có sản phẩm không còn kinh doanh. Hãy cập nhật giỏ hàng.');
      if (p.stock < qty) throw new Err(`${p.name} chỉ còn ${p.stock} sản phẩm. Hãy điều chỉnh giỏ hàng.`);
      const price = p.sale_price || p.price; sub += price * qty; lines.push([p.id, p.name, price, qty]);
    }
    const cp = String(coupon).toUpperCase();
    const discount = cp === 'GLOW10' ? Math.round(sub * 0.1) : 0;
    const fee = sub >= 500000 || cp === 'FREESHIP' ? 0 : shipping === 'fast' ? 50000 : 30000;
    const total = sub - discount + fee, code = 'BG' + Date.now().toString(36).toUpperCase();
    const [r] = await c.query('INSERT INTO orders(code,user_id,name,phone,address,note,payment,discount,shipping_fee,total) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [code, q.user.id, name.trim(), phone.trim(), address.trim(), note, payment, discount, fee, total]);
    for (const [pid, pn, pr, qty] of lines) {
      await c.query('INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES(?,?,?,?,?)', [r.insertId, pid, pn, pr, qty]);
      await c.query('UPDATE products SET stock=stock-?, sold=sold+? WHERE id=?', [qty, qty, pid]);
    }
    await c.commit(); s.json({ code, total });
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}));
app.get('/api/orders/mine', auth, h(async (q, s) =>
  s.json(await withItems((await db.query('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC', [q.user.id]))[0]))));

async function setStatus(id, status, uid) {
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [[o]] = await c.query('SELECT * FROM orders WHERE id=? FOR UPDATE', [id]);
    if (!o || (uid && o.user_id !== uid)) throw new Err('Không tìm thấy đơn hàng.');
    if (o.status === 'Đã hủy') throw new Err('Đơn đã hủy không thể thay đổi.');
    if (uid && o.status !== STAT[0]) throw new Err('Chỉ hủy được đơn đang chờ xác nhận.');
    if (status === 'Đã hủy') await c.query('UPDATE products p JOIN order_items i ON i.product_id=p.id SET p.stock=p.stock+i.quantity, p.sold=GREATEST(0,p.sold-i.quantity) WHERE i.order_id=?', [id]);
    await c.query('UPDATE orders SET status=? WHERE id=?', [status, id]);
    await c.commit();
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
app.post('/api/orders/:id/cancel', auth, h(async (q, s) => { await setStatus(q.params.id, 'Đã hủy', q.user.id); s.json({ ok: true }); }));
app.put('/api/admin/orders/:id/status', admin, h(async (q, s) => {
  if (!STAT.includes(q.body.status)) return bad(s, 'Trạng thái không hợp lệ.');
  await setStatus(q.params.id, q.body.status); s.json({ ok: true });
}));
app.get('/api/admin/orders', admin, h(async (q, s) =>
  s.json(await withItems((await db.query('SELECT o.*, u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC'))[0]))));
app.get('/api/admin/customers', admin, h(async (q, s) => s.json((await db.query(
  "SELECT u.id,u.name,u.email,u.phone,u.verified,u.created_at,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS orders FROM users u WHERE u.role='customer' ORDER BY u.id DESC"))[0])));
app.get('/api/admin/stats', admin, h(async (q, s) => {
  const [[r]] = await db.query("SELECT COALESCE(SUM(CASE WHEN status<>'Đã hủy' THEN total END),0) AS revenue, COUNT(*) AS orders, COALESCE(SUM(status='Chờ xác nhận'),0) AS pending FROM orders");
  const [[c]] = await db.query("SELECT COUNT(*) n FROM users WHERE role='customer'");
  const [[l]] = await db.query('SELECT COUNT(*) n FROM products WHERE active=1 AND stock<=5');
  const [top] = await db.query('SELECT name, sold FROM products ORDER BY sold DESC LIMIT 5');
  s.json({ revenue: Number(r.revenue), orders: r.orders, pending: Number(r.pending), customers: c.n, lowStock: l.n, top });
}));

/* ============ Chatbot ============ */
app.post('/api/chat', maybe, h(async (q, s) => {
  const msg = String(q.body.message || '').trim();
  if (!msg) return bad(s, 'Hãy nhập câu hỏi trước khi gửi.');
  if (msg.length > 500) return bad(s, 'Câu hỏi tối đa 500 ký tự.');
  const list = (await db.query(`${SEL} WHERE p.active=1 AND p.stock>0`))[0].map(tags);
  const a = await advise(msg, list);
  const products = a.ids.map(id => list.find(p => p.id === id)).filter(Boolean);
  await db.query('INSERT INTO chat_logs(user_id,question,answer) VALUES(?,?,?)', [q.user?.id || null, msg, a.reply]);
  s.json({ reply: a.reply, products, tip: products.length ? a.tip : undefined });
}));

app.use((e, q, s, n) => {
  if (e instanceof Err) return bad(s, e.message);
  if (e.code === 'ER_DUP_ENTRY') return bad(s, 'Dữ liệu này đã tồn tại.', 409);
  console.error(e); bad(s, 'Lỗi máy chủ, vui lòng thử lại sau.', 500);
});

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@beautyglow.vn').toLowerCase();
  const [[a]] = await db.query('SELECT id FROM users WHERE email=?', [email]);
  if (!a) {
    await db.query("INSERT INTO users(name,email,password_hash,role,verified) VALUES('Quản trị viên',?,?, 'admin',1)",
      [email, await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10)]);
    console.log('Đã tạo tài khoản quản trị:', email);
  }
}
const PORT = process.env.PORT || 5000;
ensureAdmin().then(() => app.listen(PORT, () => console.log(`API chạy tại http://localhost:${PORT}`)))
  .catch(e => { console.error('Không kết nối được MySQL:', e.message); process.exit(1); });
