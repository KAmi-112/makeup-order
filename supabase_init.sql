-- ============================================
-- 妆点订单 · Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  customer_name   TEXT NOT NULL DEFAULT '',
  customer_phone  TEXT DEFAULT '',
  customer_wechat TEXT DEFAULT '',
  date            TEXT NOT NULL DEFAULT '',
  time            TEXT DEFAULT '',
  duration        REAL DEFAULT 1,
  location        TEXT DEFAULT '',
  makeup_type     TEXT DEFAULT '',
  price           REAL DEFAULT 0,
  deposit         REAL DEFAULT 0,
  source          TEXT DEFAULT '',
  status          TEXT DEFAULT 'pending',
  payment_status  TEXT DEFAULT 'unpaid',
  notes           TEXT DEFAULT '',
  extra_services  JSONB DEFAULT '[]'::jsonb,
  created_at      TEXT DEFAULT ''
);

-- 2. 设置表（单行，upsert 更新）
CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  makeup_types    JSONB DEFAULT '[]'::jsonb,
  extra_services  JSONB DEFAULT '[]'::jsonb,
  notice          TEXT DEFAULT '',
  theme           TEXT DEFAULT 'rose',
  updated_at      TEXT DEFAULT ''
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_name, customer_phone);

-- 4. 启用实时订阅（可选）
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 5. 插入默认设置（如无则创建）
INSERT INTO settings (id, makeup_types, extra_services, notice, theme, updated_at)
VALUES (
  1,
  '[
    {"id":"1","name":"日常妆 / lo妆","defaultPrice":38,"defaultDuration":1},
    {"id":"2","name":"COS展妆","defaultPrice":42,"defaultDuration":1.5},
    {"id":"3","name":"COS正片妆","defaultPrice":48,"defaultDuration":2},
    {"id":"4","name":"COS华改妆","defaultPrice":58,"defaultDuration":2}
  ]'::jsonb,
  '[
    {"id":"e1","name":"胶带绷脸","price":3},
    {"id":"e2","name":"身体素颜霜（自己涂）","price":3},
    {"id":"e3","name":"鼻贴（基础贴法）","price":3},
    {"id":"e4","name":"加宽超大发网","price":5},
    {"id":"e5","name":"全新粉扑（用完包装好带走）","price":3}
  ]'::jsonb,
  '【约妆必看】

📍 位置：地铁5号线大塘站附近

💰 定金统一 18 元，任何理由放鸽子都不退

💄 包含黑色假睫毛，有基础化妆材料，异色粉底/假睫毛/口红请自备

🚫 不接男生、不接敏感肌、不接大面积瑕疵皮

⏰ 约定时间为开始化妆的时间，不是到达时间

⏱ 迟到20分钟以上收取迟到费10r

🕐 工作时间 7:00~18:00

📸 约妆默认可拍妆面图，可以不发但不能不拍',
  'rose',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
