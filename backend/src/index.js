
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


import { db } from './db.js';
import { advise } from './chatbot.js';

const app = express();

/* =========================================
   1. CẤU HÌNH SERVER
========================================= */

const PORT = Number(process.env.PORT) || 5000;

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';


const STAT = [
  'Chờ xác nhận',
  'Đang chuẩn bị',
  'Đang giao',
  'Hoàn tất',
  'Đã hủy'
];

app.use(cors({
  origin: CLIENT_URL === '*' ? true : CLIENT_URL
}));

app.use(express.json({ limit: '1mb' }));

/* =========================================
   2. HÀM DÙNG CHUNG
========================================= */

class Err extends Error {}

const h = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const bad = (res, message, code = 400) =>
  res.status(code).json({ error: message });

const sign = user =>
  jwt.sign(
    { id: user.id, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );

const tokenOf = req =>
  (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

const auth = (req, res, next) => {
  try {
    req.user = jwt.verify(tokenOf(req), SECRET);
    next();
  } catch {
    return bad(res, 'Vui lòng đăng nhập.', 401);
  }
};

const maybe = (req, res, next) => {
  try {
    req.user = jwt.verify(tokenOf(req), SECRET);
  } catch {
    req.user = null;
  }

  next();
};

const admin = [
  auth,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return bad(res, 'Bạn không có quyền truy cập.', 403);
  }
];

const mailOk = email =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const pwOk = password =>
  /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);

const pub = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  address: user.address
});

const tags = product => ({
  ...product,
  tags: typeof product.tags === 'string'
    ? JSON.parse(product.tags)
    : product.tags || []
});





/* =========================================
   3. OTP - CHẾ ĐỘ DEMO, KHÔNG GỬI EMAIL
========================================= */

async function sendOtp(user) {
  // Tạo mã OTP ngẫu nhiên gồm 6 chữ số
  const otp = String(crypto.randomInt(100000, 1000000));

  // Mã hóa OTP trước khi lưu vào Database
  const hashedOtp = await bcrypt.hash(otp, 8);

  // Lưu OTP và thời gian hết hạn 5 phút
  await db.query(
    `UPDATE users
     SET otp = ?,
         otp_exp = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
     WHERE id = ?`,
    [hashedOtp, user.id]
  );

  // Hiển thị OTP trong log Backend
  console.log('[OTP DEMO]', user.email, otp);

  // Trả OTP về Frontend
  return otp;
}


/* =========================================
   4. KIỂM TRA SERVER
========================================= */

// Kiểm tra trạng thái Backend
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BeautyGlow AI Backend đang hoạt động'
  });
});

// Kiểm tra kết nối Database
app.get('/api/health/db', h(async (req, res) => {
  await db.query('SELECT 1');

  res.json({
    status: 'OK',
    database: process.env.DB_NAME || 'beautyglow',
    message: 'Kết nối MySQL thành công'
  });
}));


/* =========================================
   5. XÁC THỰC TÀI KHOẢN
========================================= */

// =========================================
// ĐĂNG KÝ - OTP DEMO KHÔNG CẦN GMAIL
// =========================================

app.post('/api/auth/register', h(async (req, res) => {
  const {
    name = '',
    email = '',
    password = '',
    confirm
  } = req.body;

  const e = String(email).trim().toLowerCase();

  // Kiểm tra dữ liệu đầu vào
  if (!String(name).trim() || !e || !password) {
    return bad(res, 'Vui lòng nhập đủ họ tên, email và mật khẩu.');
  }

  if (!mailOk(e)) {
    return bad(res, 'Email không đúng định dạng.');
  }

  if (!pwOk(password)) {
    return bad(res, 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.');
  }

  if (password !== confirm) {
    return bad(res, 'Mật khẩu xác nhận không khớp.');
  }

  // Kiểm tra email đã tồn tại
  const [[existing]] = await db.query(
    'SELECT id, verified FROM users WHERE email = ?',
    [e]
  );

  if (existing?.verified) {
    return bad(res, 'Email này đã được đăng ký.', 409);
  }

  // Mã hóa mật khẩu
  const hash = await bcrypt.hash(password, 10);

  let id = existing?.id;

  if (id) {
    // Cập nhật tài khoản chưa xác thực
    await db.query(
      'UPDATE users SET name = ?, password_hash = ? WHERE id = ?',
      [String(name).trim(), hash, id]
    );
  } else {
    // Tạo tài khoản mới
    const [result] = await db.query(
      'INSERT INTO users(name, email, password_hash) VALUES(?,?,?)',
      [String(name).trim(), e, hash]
    );

    id = result.insertId;
  }

  // Tạo OTP demo, không gửi email
  const otp = await sendOtp({
    id,
    email: e
  });

  // Trả OTP về Frontend để hiển thị
  return res.json({
    success: true,
    message: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    devOtp: otp,
    email: e
  });
}));


// =========================================
// XÁC THỰC OTP
// =========================================

app.post('/api/auth/verify-otp', h(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();

  const otp = String(req.body.otp || '');

  // Tìm tài khoản
  const [[user]] = await db.query(
    `SELECT *,
            otp_exp < NOW() AS expired
     FROM users
     WHERE email = ?`,
    [email]
  );

  if (!user || !user.otp) {
    return bad(
      res,
      'Không có yêu cầu xác thực. Hãy thử lại từ đầu.'
    );
  }

  // Kiểm tra thời hạn OTP
  if (user.expired) {
    return bad(
      res,
      'Mã OTP đã hết hạn. Hãy gửi lại mã.'
    );
  }

  // Kiểm tra mã OTP
  const valid = await bcrypt.compare(
    otp,
    user.otp
  );

  if (!valid) {
    return bad(res, 'Mã OTP không đúng.');
  }

  // Xác thực tài khoản
  await db.query(
    `UPDATE users
     SET verified = 1,
         otp = NULL,
         otp_exp = NULL
     WHERE id = ?`,
    [user.id]
  );

  return res.json({
    success: true,
    message: 'Xác thực tài khoản thành công.',
    resetToken: req.body.purpose === 'reset'
      ? jwt.sign(
          {
            id: user.id,
            purpose: 'reset'
          },
          SECRET,
          {
            expiresIn: '10m'
          }
        )
      : undefined
  });
}));


// =========================================
// GỬI LẠI OTP - CHẾ ĐỘ DEMO
// =========================================

const resend = h(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();

  if (!email || !mailOk(email)) {
    return bad(res, 'Email không hợp lệ.');
  }

  // Tìm tài khoản
  const [[user]] = await db.query(
    'SELECT id, email, verified FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    return bad(res, 'Email này chưa được đăng ký.', 404);
  }

  if (user.verified) {
    return bad(res, 'Tài khoản đã được xác thực.');
  }

  // Tạo OTP mới
  const otp = await sendOtp(user);

  return res.json({
    success: true,
    message: `Mã OTP mới của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
    devOtp: otp,
    email: user.email
  });
});

app.post('/api/auth/resend-otp', resend);
app.post('/api/auth/forgot', resend);


// =========================================
// ĐẶT LẠI MẬT KHẨU
// =========================================

app.post('/api/auth/reset', h(async (req, res) => {
  const {
    resetToken,
    password = '',
    confirm
  } = req.body;

  let payload;

  // Kiểm tra Token
  try {
    payload = jwt.verify(resetToken, SECRET);
  } catch {
    return bad(
      res,
      'Phiên đặt lại mật khẩu đã hết hạn. Hãy xác thực OTP lại.'
    );
  }

  if (payload.purpose !== 'reset') {
    return bad(res, 'Phiên không hợp lệ.');
  }

  // Kiểm tra mật khẩu mới
  if (!pwOk(password)) {
    return bad(
      res,
      'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số.'
    );
  }

  if (password !== confirm) {
    return bad(res, 'Mật khẩu xác nhận không khớp.');
  }

  // Cập nhật mật khẩu
  const hash = await bcrypt.hash(password, 10);

  await db.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hash, payload.id]
  );

  return res.json({
    success: true,
    message: 'Đã đổi mật khẩu thành công.'
  });
}));


// =========================================
// ĐĂNG NHẬP
// =========================================

app.post('/api/auth/login', h(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase();

  const password = req.body.password || '';

  if (!email || !password) {
    return bad(res, 'Hãy nhập đủ email và mật khẩu.');
  }

  // Tìm tài khoản
  const [[user]] = await db.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  // Kiểm tra tài khoản và mật khẩu
  if (
    !user ||
    !(await bcrypt.compare(password, user.password_hash))
  ) {
    return bad(res, 'Email hoặc mật khẩu không đúng.', 401);
  }

  // Tài khoản chưa xác thực
  if (!user.verified) {
    const otp = await sendOtp(user);

    return res.status(403).json({
      success: false,
      error: 'Tài khoản chưa xác thực.',
      message: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
      needOtp: true,
      email,
      devOtp: otp
    });
  }

  // Đăng nhập thành công
  return res.json({
    success: true,
    token: sign(user),
    user: pub(user)
  });
}));


// =========================================
// LẤY THÔNG TIN TÀI KHOẢN HIỆN TẠI
// =========================================

app.get('/api/auth/me', auth, h(async (req, res) => {
  const [[user]] = await db.query(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id]
  );

  if (!user) {
    return bad(res, 'Tài khoản không tồn tại.', 401);
  }

  return res.json({
    user: pub(user)
  });
}));


// =========================================
// CẬP NHẬT THÔNG TIN CÁ NHÂN
// =========================================

app.put('/api/auth/me', auth, h(async (req, res) => {
  const {
    name = '',
    phone = '',
    address = ''
  } = req.body;

  if (!String(name).trim()) {
    return bad(res, 'Họ tên không được để trống.');
  }

  if (phone && !/^0\d{9}$/.test(phone.trim())) {
    return bad(
      res,
      'Số điện thoại gồm 10 số và bắt đầu bằng 0.'
    );
  }

  await db.query(
    `UPDATE users
     SET name = ?,
         phone = ?,
         address = ?
     WHERE id = ?`,
    [
      name.trim(),
      phone.trim(),
      address.trim(),
      req.user.id
    ]
  );

  const [[user]] = await db.query(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id]
  );

  return res.json({
    user: pub(user)
  });
}));


// =========================================
// ĐỔI MẬT KHẨU KHI ĐÃ ĐĂNG NHẬP
// =========================================

app.put('/api/auth/password', auth, h(async (req, res) => {
  const {
    current = '',
    password = '',
    confirm
  } = req.body;

  // Lấy thông tin tài khoản
  const [[user]] = await db.query(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id]
  );

  if (
    !user ||
    !(await bcrypt.compare(current, user.password_hash))
  ) {
    return bad(res, 'Mật khẩu hiện tại không đúng.');
  }

  if (!pwOk(password)) {
    return bad(
      res,
      'Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.'
    );
  }

  if (password !== confirm) {
    return bad(res, 'Mật khẩu xác nhận không khớp.');
  }

  // Cập nhật mật khẩu mới
  const hash = await bcrypt.hash(password, 10);

  await db.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hash, user.id]
  );

  return res.json({
    success: true,
    message: 'Đổi mật khẩu thành công.'
  });
}));

/* =========================================
   6. DANH MỤC SẢN PHẨM
========================================= */

// Lấy danh sách danh mục
app.get('/api/categories', h(async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.*,
      (SELECT COUNT(*)
       FROM products p
       WHERE p.category_id = c.id) AS products
     FROM categories c
     ORDER BY c.id`
  );

  res.json(rows);
}));

// Thêm danh mục
app.post('/api/categories', admin, h(async (req, res) => {
  const name = String(req.body.name || '').trim();

  if (!name) {
    return bad(res, 'Hãy nhập tên danh mục.');
  }

  const [result] = await db.query(
    'INSERT INTO categories(name) VALUES(?)',
    [name]
  );

  res.json({ id: result.insertId });
}));

// Sửa danh mục
app.put('/api/categories/:id', admin, h(async (req, res) => {
  const name = String(req.body.name || '').trim();

  if (!name) {
    return bad(res, 'Hãy nhập tên danh mục.');
  }

  await db.query(
    'UPDATE categories SET name = ? WHERE id = ?',
    [name, req.params.id]
  );

  res.json({ ok: true });
}));

// Xóa danh mục
app.delete('/api/categories/:id', admin, h(async (req, res) => {
  const [[category]] = await db.query(
    'SELECT COUNT(*) AS n FROM products WHERE category_id = ?',
    [req.params.id]
  );

  if (category.n) {
    return bad(
      res,
      'Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước.',
      409
    );
  }

  await db.query(
    'DELETE FROM categories WHERE id = ?',
    [req.params.id]
  );

  res.json({ ok: true });
}));

/* =========================================
   7. SẢN PHẨM
========================================= */

const PRICE = 'COALESCE(NULLIF(p.sale_price,0), p.price)';

const SEL = `
  SELECT p.*, c.name AS category
  FROM products p
  JOIN categories c ON c.id = p.category_id
`;

const SORT = {
  sold: 'p.sold DESC',
  new: 'p.id DESC',
  asc: PRICE + ' ASC',
  desc: PRICE + ' DESC'
};

// Lấy thương hiệu
app.get('/api/brands', h(async (req, res) => {
  const [rows] = await db.query(
    'SELECT DISTINCT brand FROM products WHERE active = 1 ORDER BY brand'
  );

  res.json(rows.map(row => row.brand));
}));

// Lấy danh sách sản phẩm và lọc
app.get('/api/products', h(async (req, res) => {
  const {
    q: keyword,
    category,
    brand,
    min,
    max,
    skin,
    sort
  } = req.query;

  const where = ['p.active = 1'];
  const values = [];

  if (keyword) {
    where.push(
      '(p.name LIKE ? OR p.brand LIKE ? OR CAST(p.tags AS CHAR) LIKE ?)'
    );

    values.push(
      ...Array(3).fill(`%${keyword}%`)
    );
  }

  if (category) {
    where.push('p.category_id = ?');
    values.push(category);
  }

  if (brand) {
    where.push('p.brand = ?');
    values.push(brand);
  }

  if (min) {
    where.push(`${PRICE} >= ?`);
    values.push(Number(min));
  }

  if (max) {
    where.push(`${PRICE} <= ?`);
    values.push(Number(max));
  }

  if (skin) {
    where.push('JSON_CONTAINS(p.tags, JSON_QUOTE(?))');
    values.push(skin);
  }

  const orderBy = SORT[sort] || SORT.sold;

  const [rows] = await db.query(
    `${SEL}
     WHERE ${where.join(' AND ')}
     ORDER BY ${orderBy}`,
    values
  );

  res.json(rows.map(tags));
}));

// Chi tiết sản phẩm
app.get('/api/products/:id', h(async (req, res) => {
  const [[product]] = await db.query(
    `${SEL}
     WHERE p.id = ? AND p.active = 1`,
    [req.params.id]
  );

  if (!product) {
    return bad(res, 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
  }

  res.json(tags(product));
}));

// Kiểm tra dữ liệu sản phẩm
const pbody = body => {
  const price = Number(body.price);
  const sale = Number(body.sale_price) || 0;
  const stock = Math.max(0, Math.floor(Number(body.stock) || 0));

  if (
    !String(body.name || '').trim() ||
    !(price > 0) ||
    !body.category_id
  ) {
    throw new Err('Hãy nhập tên, danh mục và giá bán lớn hơn 0.');
  }

  if (sale && sale >= price) {
    throw new Err('Giá khuyến mãi phải nhỏ hơn giá bán.');
  }

  const productTags = (
    Array.isArray(body.tags)
      ? body.tags
      : String(body.tags || '').split(',')
  )
    .map(item => String(item).trim().toLowerCase())
    .filter(Boolean);

  return [
    String(body.name).trim(),
    String(body.brand || 'Khác').trim(),
    Number(body.category_id),
    price,
    sale,
    stock,
    body.color || '#c06fbb',
    body.description || '',
    body.image_url || '',
    JSON.stringify(productTags),
    body.active === false || body.active === 0 ? 0 : 1
  ];
};

const COLS =
  'name,brand,category_id,price,sale_price,stock,color,description,image_url,tags,active';

// Danh sách sản phẩm Admin
app.get('/api/admin/products', admin, h(async (req, res) => {
  const [rows] = await db.query(
    `${SEL} ORDER BY p.id DESC`
  );

  res.json(rows.map(tags));
}));

// Thêm sản phẩm
app.post('/api/products', admin, h(async (req, res) => {
  const [result] = await db.query(
    `INSERT INTO products(${COLS})
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    pbody(req.body)
  );

  res.json({ id: result.insertId });
}));

// Cập nhật sản phẩm
app.put('/api/products/:id', admin, h(async (req, res) => {
  const columns = COLS.split(',')
    .map(column => column + ' = ?')
    .join(', ');

  await db.query(
    `UPDATE products SET ${columns} WHERE id = ?`,
    [...pbody(req.body), req.params.id]
  );

  res.json({ ok: true });
}));

// Xóa sản phẩm
app.delete('/api/products/:id', admin, h(async (req, res) => {
  const [[usage]] = await db.query(
    'SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?',
    [req.params.id]
  );

  if (usage.n) {
    await db.query(
      'UPDATE products SET active = 0 WHERE id = ?',
      [req.params.id]
    );

    return res.json({
      ok: true,
      deactivated: true
    });
  }

  await db.query(
    'DELETE FROM products WHERE id = ?',
    [req.params.id]
  );

  res.json({ ok: true });
}));

/* =========================================
   8. ĐƠN HÀNG
========================================= */

// Gắn chi tiết sản phẩm vào đơn hàng
const withItems = async rows => {
  if (!rows.length) return rows;

  const [items] = await db.query(
    'SELECT * FROM order_items WHERE order_id IN (?)',
    [rows.map(row => row.id)]
  );

  return rows.map(row => ({
    ...row,
    items: items.filter(item => item.order_id === row.id)
  }));
};

// Tạo đơn hàng
app.post('/api/orders', auth, h(async (req, res) => {
  const {
    items = [],
    name,
    phone,
    address,
    note = '',
    payment = 'cod',
    shipping = 'std',
    coupon = ''
  } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return bad(res, 'Giỏ hàng chưa có sản phẩm.');
  }

  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    return bad(res, 'Hãy nhập đủ tên, số điện thoại và địa chỉ nhận hàng.');
  }

  if (!/^0\d{9}$/.test(phone.trim())) {
    return bad(res, 'Số điện thoại gồm 10 số và bắt đầu bằng 0.');
  }

  if (!['cod', 'bank', 'vnpay'].includes(payment)) {
    return bad(res, 'Phương thức thanh toán không hợp lệ.');
  }

  if (!['std', 'fast'].includes(shipping)) {
    return bad(res, 'Phương thức vận chuyển không hợp lệ.');
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let subtotal = 0;
    const lines = [];

    for (const item of items) {
      const quantity = Math.floor(Number(item.qty));

      if (!(quantity > 0)) {
        throw new Err('Số lượng không hợp lệ.');
      }

      const [[product]] = await connection.query(
        'SELECT * FROM products WHERE id = ? AND active = 1 FOR UPDATE',
        [item.id]
      );

      if (!product) {
        throw new Err('Có sản phẩm không còn kinh doanh. Hãy cập nhật giỏ hàng.');
      }

      if (product.stock < quantity) {
        throw new Err(
          `${product.name} chỉ còn ${product.stock} sản phẩm. Hãy điều chỉnh giỏ hàng.`
        );
      }

      const price = product.sale_price || product.price;

      subtotal += price * quantity;

      lines.push([
        product.id,
        product.name,
        price,
        quantity
      ]);
    }

    const codeCoupon = String(coupon).toUpperCase();

    const discount = codeCoupon === 'GLOW10'
      ? Math.round(subtotal * 0.1)
      : 0;

    const shippingFee =
      subtotal >= 500000 || codeCoupon === 'FREESHIP'
        ? 0
        : shipping === 'fast' ? 50000 : 30000;

    const total = subtotal - discount + shippingFee;

    const code =
      'BG' + Date.now().toString(36).toUpperCase();

    const [order] = await connection.query(
      `INSERT INTO orders
       (code,user_id,name,phone,address,note,payment,discount,shipping_fee,total)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        code,
        req.user.id,
        name.trim(),
        phone.trim(),
        address.trim(),
        note,
        payment,
        discount,
        shippingFee,
        total
      ]
    );

    for (const [productId, productName, price, quantity] of lines) {
      await connection.query(
        `INSERT INTO order_items
         (order_id,product_id,product_name,price,quantity)
         VALUES(?,?,?,?,?)`,
        [
          order.insertId,
          productId,
          productName,
          price,
          quantity
        ]
      );

      await connection.query(
        'UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?',
        [quantity, quantity, productId]
      );
    }

    await connection.commit();

    res.json({ code, total });

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}));

// Đơn hàng của khách hàng
app.get('/api/orders/mine', auth, h(async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC',
    [req.user.id]
  );

  res.json(await withItems(rows));
}));

// Cập nhật trạng thái đơn hàng
async function setStatus(id, status, userId) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[order]] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!order || (userId && Number(order.user_id) !== Number(userId))) {
      throw new Err('Không tìm thấy đơn hàng.');
    }

    if (order.status === 'Đã hủy') {
      throw new Err('Đơn đã hủy không thể thay đổi.');
    }

    if (userId && order.status !== STAT[0]) {
      throw new Err('Chỉ hủy được đơn đang chờ xác nhận.');
    }

    if (status === 'Đã hủy') {
      await connection.query(
        `UPDATE products p
         JOIN order_items i ON i.product_id = p.id
         SET p.stock = p.stock + i.quantity,
             p.sold = GREATEST(0, p.sold - i.quantity)
         WHERE i.order_id = ?`,
        [id]
      );
    }

    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    await connection.commit();

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// Khách hàng hủy đơn
app.post('/api/orders/:id/cancel', auth, h(async (req, res) => {
  await setStatus(
    req.params.id,
    'Đã hủy',
    req.user.id
  );

  res.json({ ok: true });
}));

// Admin cập nhật trạng thái
app.put('/api/admin/orders/:id/status', admin, h(async (req, res) => {
  if (!STAT.includes(req.body.status)) {
    return bad(res, 'Trạng thái không hợp lệ.');
  }

  await setStatus(
    req.params.id,
    req.body.status
  );

  res.json({ ok: true });
}));

// Danh sách đơn hàng Admin
app.get('/api/admin/orders', admin, h(async (req, res) => {
  const [rows] = await db.query(
    `SELECT o.*, u.email
     FROM orders o
     JOIN users u ON u.id = o.user_id
     ORDER BY o.id DESC`
  );

  res.json(await withItems(rows));
}));

// Danh sách khách hàng
app.get('/api/admin/customers', admin, h(async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id,u.name,u.email,u.phone,u.verified,u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders
     FROM users u
     WHERE u.role = 'customer'
     ORDER BY u.id DESC`
  );

  res.json(rows);
}));

// Thống kê Admin
app.get('/api/admin/stats', admin, h(async (req, res) => {
  const [[result]] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status <> 'Đã hủy' THEN total END),0) AS revenue,
       COUNT(*) AS orders,
       COALESCE(SUM(status = 'Chờ xác nhận'),0) AS pending
     FROM orders`
  );

  const [[customers]] = await db.query(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"
  );

  const [[lowStock]] = await db.query(
    'SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock <= 5'
  );

  const [top] = await db.query(
    'SELECT name, sold FROM products ORDER BY sold DESC LIMIT 5'
  );

  res.json({
    revenue: Number(result.revenue),
    orders: result.orders,
    pending: Number(result.pending),
    customers: customers.n,
    lowStock: lowStock.n,
    top
  });
}));

/* =========================================
   9. CHATBOT BEAUTYGLOW AI
========================================= */

app.post('/api/chat', maybe, h(async (req, res) => {
  const message = String(req.body.message || '').trim();

  if (!message) {
    return bad(res, 'Hãy nhập câu hỏi trước khi gửi.');
  }

  if (message.length > 500) {
    return bad(res, 'Câu hỏi tối đa 500 ký tự.');
  }

  // Lấy sản phẩm đang kinh doanh và còn hàng
  const [rows] = await db.query(
    `${SEL}
     WHERE p.active = 1 AND p.stock > 0`
  );

  const productsList = rows.map(tags);

  // Gọi Claude AI hoặc luật dự phòng
  const result = await advise(message, productsList);

  // Lọc sản phẩm được chatbot đề xuất
  const products = result.ids
    .map(id => productsList.find(
      product => String(product.id) === String(id)
    ))
    .filter(Boolean);

  // Lưu lịch sử chatbot
  await db.query(
    `INSERT INTO chat_logs(user_id,question,answer)
     VALUES(?,?,?)`,
    [
      req.user?.id || null,
      message,
      result.reply
    ]
  );

  res.json({
    reply: result.reply,
    products,
    tip: products.length ? result.tip : undefined
  });
}));

/* =========================================
   10. XỬ LÝ LỖI
========================================= */

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof Err) {
    return bad(res, error.message);
  }

  if (error.code === 'ER_DUP_ENTRY') {
    return bad(res, 'Dữ liệu này đã tồn tại.', 409);
  }

  console.error('[SERVER ERROR]', error);

  return bad(
    res,
    'Lỗi máy chủ, vui lòng thử lại sau.',
    500
  );
});

/* =========================================
   11. TẠO TÀI KHOẢN ADMIN
========================================= */

async function ensureAdmin() {
  const email = (
    process.env.ADMIN_EMAIL || 'admin@beautyglow.vn'
  ).trim().toLowerCase();

  const [[existing]] = await db.query(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (!existing) {
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      throw new Error(
        'Chưa cấu hình ADMIN_PASSWORD trong file .env'
      );
    }

    await db.query(
      `INSERT INTO users
       (name,email,password_hash,role,verified)
       VALUES('Quản trị viên',?,?, 'admin',1)`,
      [
        email,
        await bcrypt.hash(password, 10)
      ]
    );

    console.log('Đã tạo tài khoản quản trị:', email);
  } else {
    console.log('Tài khoản Admin đã tồn tại:', email);
  }
}

/* =========================================
   12. KHỞI ĐỘNG SERVER
========================================= */

async function startServer() {
  try {
    console.log('Đang kiểm tra kết nối MySQL...');

    const connection = await db.getConnection();

    console.log('MySQL kết nối thành công!');
    console.log('Database:', process.env.DB_NAME || 'beautyglow');

    connection.release();

    // Kiểm tra hoặc tạo tài khoản Admin
    await ensureAdmin();

    // Khởi động Express
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`BeautyGlow AI Backend đang chạy tại port ${PORT}`);
    });

  } catch (error) {
    console.error('Không thể khởi động Backend:', error.message);

    await db.end().catch(() => {});

    process.exit(1);
  }
}

startServer();
