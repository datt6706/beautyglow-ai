
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom';

import { useEffect } from 'react';
import { useApp } from './store.jsx';

import { Home, Shop, Product } from './pages/Store.jsx';
import { Cart, Checkout, Orders } from './pages/Orders.jsx';
import {
  Login,
  Register,
  Otp,
  Forgot,
  Reset,
  Account
} from './pages/Auth.jsx';

import Admin from './pages/Admin.jsx';
import Chat from './pages/Chat.jsx';

// Kiểm tra quyền truy cập
function Guard({ role, children }) {
  const { user, ready } = useApp();
  const loc = useLocation();

  if (!ready) {
    return <p className="empty">Đang tải…</p>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: loc.pathname }}
        replace
      />
    );
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Thanh điều hướng
function Header() {
  const { user, cart } = useApp();
  const nav = useNavigate();

  const n = cart.reduce((a, i) => a + i.qty, 0);

  const search = (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const q = formData.get('q');

    nav('/shop?q=' + encodeURIComponent(q));
  };

  return (
    <header>
      <div className="w hb">
        <Link className="lg" to="/">
          BeautyGlow<span>AI</span>
        </Link>

        <nav>
          <Link to="/shop">Sản phẩm</Link>

          {user && (
            <Link to="/orders">Đơn hàng</Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin">Quản trị</Link>
          )}
        </nav>

        <form className="sr" onSubmit={search}>
          <input
            name="q"
            placeholder="Tìm mỹ phẩm"
            aria-label="Tìm mỹ phẩm"
          />
        </form>

        <Link className="ic" to="/cart">
          Giỏ hàng <em>{n}</em>
        </Link>

        {user ? (
          <Link to="/account">
            {user.name.split(' ').pop()}
          </Link>
        ) : (
          <Link className="b sm" to="/login">
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}

// Ứng dụng chính
export default function App() {
  const { toast } = useApp();
  const loc = useLocation();

  // Đưa trang về đầu khi chuyển đường dẫn
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  return (
    <>
      <Header />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/shop" element={<Shop />} />

          <Route
            path="/product/:id"
            element={<Product />}
          />

          <Route path="/cart" element={<Cart />} />

          <Route
            path="/checkout"
            element={
              <Guard>
                <Checkout />
              </Guard>
            }
          />

          <Route
            path="/orders"
            element={
              <Guard>
                <Orders />
              </Guard>
            }
          />

          <Route
            path="/account"
            element={
              <Guard>
                <Account />
              </Guard>
            }
          />

          <Route
            path="/admin"
            element={
              <Guard role="admin">
                <Admin />
              </Guard>
            }
          />

          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route path="/otp" element={<Otp />} />

          <Route path="/forgot" element={<Forgot />} />

          <Route path="/reset" element={<Reset />} />

          <Route
            path="*"
            element={
              <p className="empty">
                Không tìm thấy trang này.{' '}
                <Link to="/">Về trang chủ</Link>
              </p>
            }
          />
        </Routes>
      </main>

      <footer>
        <div className="w">
          BeautyGlow AI · Đồ án môn Phát triển dự án CNTT,
          Nhóm 10, Đại học Công nghiệp Hà Nội.
        </div>
      </footer>

      <Chat />

      <div
        id="toast"
        className={toast ? 'on' : ''}
        role="status"
      >
        {toast}
      </div>
    </>
  );
}
