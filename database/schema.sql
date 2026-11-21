
-- =====================================================
-- DATABASE: BEAUTYGLOW AI
-- =====================================================

CREATE DATABASE IF NOT EXISTS beautyglow
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE beautyglow;

-- =====================================================
-- 1. TABLE: USERS
-- =====================================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    phone VARCHAR(15) DEFAULT '',
    address VARCHAR(255) DEFAULT '',
    verified TINYINT(1) NOT NULL DEFAULT 0,
    otp VARCHAR(100) NULL,
    otp_exp DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. TABLE: CATEGORIES
-- =====================================================

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- =====================================================
-- 3. TABLE: PRODUCTS
-- =====================================================

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100) NOT NULL DEFAULT 'Khác',
    category_id INT NOT NULL,
    price INT NOT NULL,
    sale_price INT NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    color VARCHAR(9) DEFAULT '#c06fbb',
    description TEXT,
    image_url VARCHAR(500) DEFAULT '',
    tags JSON NULL,
    sold INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_categories
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- =====================================================
-- 4. TABLE: ORDERS
-- =====================================================

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    address VARCHAR(255) NOT NULL,
    note VARCHAR(255) DEFAULT '',
    payment ENUM('cod','bank','vnpay') NOT NULL DEFAULT 'cod',
    discount INT NOT NULL DEFAULT 0,
    shipping_fee INT NOT NULL DEFAULT 0,
    total INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Chờ xác nhận',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_users
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- =====================================================
-- 5. TABLE: ORDER_ITEMS
-- =====================================================

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    price INT NOT NULL,
    quantity INT NOT NULL,

    CONSTRAINT fk_order_items_orders
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

    CONSTRAINT fk_order_items_products
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- =====================================================
-- 6. TABLE: CHAT_LOGS
-- =====================================================

CREATE TABLE chat_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_logs_users
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- =====================================================
-- 7. INSERT CATEGORIES
-- =====================================================

INSERT INTO categories (name) VALUES
('Sữa rửa mặt'),
('Serum'),
('Kem dưỡng'),
('Kem chống nắng'),
('Mặt nạ'),
('Trang điểm');

-- =====================================================
-- 8. INSERT PRODUCTS
-- =====================================================

INSERT INTO products
(name, brand, category_id, price, sale_price, stock,
 color, description, tags, sold)
VALUES

('Sữa rửa mặt Aqua Bloom Gentle',
'Aqua Bloom',1,185000,0,40,'#4fb3c8',
'Gel tạo bọt mịn, làm sạch bã nhờn mà không gây khô căng.',
'["dầu","hỗn hợp","sạch"]',120),

('Sữa rửa mặt Hanok Cica Calm',
'Hanok',1,220000,189000,35,'#7fb77e',
'Chiết xuất rau má giúp xoa dịu da đang kích ứng, phù hợp da mụn.',
'["nhạy cảm","mụn","sạch"]',95),

('Serum Vitamin C 10% Lumière',
'Lumière',2,390000,329000,25,'#f2a03d',
'Vitamin C ổn định cùng niacinamide giúp da đều màu và mờ thâm.',
'["sáng","lão hóa"]',210),

('Serum B5 Phục hồi Dewy Lab',
'Dewy Lab',2,350000,0,30,'#6fa8dc',
'Panthenol và hyaluronic acid giúp da khô, da yếu nhanh phục hồi.',
'["cấp ẩm","nhạy cảm","khô"]',140),

('Serum BHA 2% Sora',
'Sora',2,320000,0,28,'#e0709a',
'Làm thông thoáng lỗ chân lông, giảm mụn đầu đen và bã nhờn.',
'["mụn","dầu"]',160),

('Serum Retinol 0.3% Lumière',
'Lumière',2,490000,0,18,'#9b6bd1',
'Retinol nồng độ nhẹ cho người mới bắt đầu, làm mờ nếp nhăn nhỏ.',
'["lão hóa"]',70),

('Kem dưỡng Ceramide Dewy Lab',
'Dewy Lab',3,410000,369000,22,'#e8a9c4',
'Ceramide giữ ẩm và củng cố hàng rào bảo vệ da.',
'["khô","cấp ẩm","nhạy cảm"]',110),

('Gel dưỡng Aqua Bloom Oil-Free',
'Aqua Bloom',3,260000,0,45,'#58c4b6',
'Kết cấu gel mỏng nhẹ, cấp nước mà không gây bóng dầu.',
'["dầu","hỗn hợp","cấp ẩm"]',130),

('Kem dưỡng đêm Hanok Ginseng',
'Hanok',3,520000,0,15,'#c99a5b',
'Chiết xuất nhân sâm dưỡng da săn chắc qua đêm.',
'["lão hóa","khô"]',55),

('Kem chống nắng Sora SPF50+',
'Sora',4,280000,0,60,'#f5c542',
'Kết cấu lỏng nhẹ, không bết dính, khô thoáng nhanh.',
'["nắng","dầu","hỗn hợp"]',300),

('Kem chống nắng Lumière Mineral',
'Lumière',4,340000,299000,40,'#f08a5d',
'Màng lọc khoáng, dịu nhẹ cho da nhạy cảm.',
'["nắng","nhạy cảm"]',150),

('Mặt nạ cấp ẩm Dewy Lab (hộp 5)',
'Dewy Lab',5,150000,0,70,'#7ec8e3',
'Mặt nạ giấy tẩm tinh chất cấp ẩm, dùng 2 đến 3 lần mỗi tuần.',
'["cấp ẩm","khô"]',180),

('Mặt nạ đất sét Hanok Detox',
'Hanok',5,230000,0,26,'#8a9a5b',
'Đất sét hút dầu thừa và làm sạch sâu lỗ chân lông.',
'["dầu","mụn","sạch"]',85),

('Son tint Sora Velvet 02',
'Sora',6,190000,159000,50,'#d6336c',
'Chất son lì mịn như nhung, lên màu chuẩn.',
'["môi"]',240),

('Son dưỡng Aqua Bloom Lip Balm',
'Aqua Bloom',6,95000,0,80,'#f4a6b8',
'Dưỡng môi mềm mịn, dùng được dưới son màu.',
'["môi","khô","cấp ẩm"]',200),

('Cushion Lumière Glow SPF30',
'Lumière',6,450000,0,20,'#e9b38f',
'Nền căng bóng nhẹ, có chỉ số chống nắng SPF30.',
'["sáng","nắng"]',90);

-- =====================================================
-- 9. CHECK DATABASE AND FOREIGN KEYS
-- =====================================================

SHOW TABLES;

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'beautyglow'
AND REFERENCED_TABLE_NAME IS NOT NULL;
