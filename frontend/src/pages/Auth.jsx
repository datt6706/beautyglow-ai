import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Err, Field } from '../ui.jsx';

// Form dùng chung: gom dữ liệu, gọi API, hiển thị lỗi ngay trong form
function AuthForm({ title, submit, children, button, foot, intro }) {
  const [e, setE] = useState(''), [busy, setBusy] = useState(false);
  const on = async ev => {
    ev.preventDefault(); setE(''); setBusy(true);
    try { await submit(Object.fromEntries(new FormData(ev.target))); } catch (x) { setE(x.message); } finally { setBusy(false); }
  };
  return (
    <section className="w pg au"><h1>{title}</h1>{intro}
      <form className="fm" onSubmit={on}>{children}<Err m={e} /><div><button className="b" disabled={busy}>{button}</button></div>{foot}</form>
    </section>
  );
}

export function Login() {
  const { login, user, say } = useApp(), nav = useNavigate(), loc = useLocation();
  if (user) return <Navigate to="/" replace />;
  return (
    <>
      <AuthForm title="Đăng nhập" button="Đăng nhập"
        foot={<p className="mu" style={{ margin: 0 }}><Link to="/forgot">Quên mật khẩu?</Link> · <Link to="/register">Tạo tài khoản</Link></p>}
        submit={async d => {
          try {
            const r = await api('/auth/login', { method: 'POST', body: d }); login(r.token, r.user);
            nav(loc.state?.from || (r.user.role === 'admin' ? '/admin' : '/'), { replace: true });
          } catch (x) {
            if (x.data?.needOtp) { say(x.message); return nav('/otp', { state: { email: x.data.email, purpose: 'register', devOtp: x.data.devOtp } }); }
            throw x;
          }
        }}>
        <Field label="Email" name="email" type="email" autoComplete="username" required />
        <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      </AuthForm>
      <p className="mu au" style={{ fontSize: '.85rem', padding: '0 16px' }}>Tài khoản quản trị mặc định: admin@beautyglow.vn / Admin@123</p>
    </>
  );
}

export function Register() {
  const nav = useNavigate();
  return (
    <AuthForm title="Đăng ký" button="Đăng ký" foot={<p className="mu" style={{ margin: 0 }}>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>}
      submit={async d => {
        const r = await api('/auth/register', { method: 'POST', body: d });
        nav('/otp', { state: { email: d.email.trim().toLowerCase(), purpose: 'register', devOtp: r.devOtp } });
      }}>
      <Field label="Họ tên" name="name" required />
      <Field label="Email" name="email" type="email" required />
      <Field label="Mật khẩu (tối thiểu 8 ký tự, gồm chữ và số)" name="password" type="password" required />
      <Field label="Nhập lại mật khẩu" name="confirm" type="password" required />
    </AuthForm>
  );
}

export function Otp() {
  const { state } = useLocation(), nav = useNavigate(), { say } = useApp(), [dev, setDev] = useState(state?.devOtp);
  if (!state?.email) return <Navigate to="/login" replace />;
  return (
    <AuthForm title="Nhập mã OTP" button="Xác thực"
      intro={<p className="mu">Mã gồm 6 số, có hiệu lực 5 phút, gửi tới {state.email}.{dev && <> Chế độ phát triển: mã của bạn là <b>{dev}</b>.</>}</p>}
      foot={<button type="button" className="b o" onClick={async () => { try { const r = await api('/auth/resend-otp', { method: 'POST', body: { email: state.email } }); setDev(r.devOtp); say('Đã gửi lại mã OTP'); } catch (x) { say(x.message); } }}>Gửi lại mã</button>}
      submit={async d => {
        const r = await api('/auth/verify-otp', { method: 'POST', body: { email: state.email, otp: d.otp.trim(), purpose: state.purpose } });
        if (state.purpose === 'reset') return nav('/reset', { state: { resetToken: r.resetToken } });
        say('Xác thực thành công. Hãy đăng nhập.'); nav('/login');
      }}>
      <Field label="Mã OTP" name="otp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" required />
    </AuthForm>
  );
}

export function Forgot() {
  const nav = useNavigate();
  return (
    <AuthForm title="Quên mật khẩu" button="Gửi mã xác thực"
      submit={async d => { const r = await api('/auth/forgot', { method: 'POST', body: d }); nav('/otp', { state: { email: d.email.trim().toLowerCase(), purpose: 'reset', devOtp: r.devOtp } }); }}>
      <Field label="Email đã đăng ký" name="email" type="email" required />
    </AuthForm>
  );
}

export function Reset() {
  const { state } = useLocation(), nav = useNavigate(), { say } = useApp();
  if (!state?.resetToken) return <Navigate to="/forgot" replace />;
  return (
    <AuthForm title="Đặt mật khẩu mới" button="Cập nhật mật khẩu"
      submit={async d => { await api('/auth/reset', { method: 'POST', body: { ...d, resetToken: state.resetToken } }); say('Đã đổi mật khẩu. Hãy đăng nhập lại.'); nav('/login'); }}>
      <Field label="Mật khẩu mới" name="password" type="password" required />
      <Field label="Nhập lại mật khẩu mới" name="confirm" type="password" required />
    </AuthForm>
  );
}

export function Account() {
  const { user, setUser, logout, say } = useApp(), nav = useNavigate();
  const form = (title, button, submit, fields, reset) => (
    <AuthFormInline title={title} button={button} submit={submit} reset={reset}>{fields}</AuthFormInline>
  );
  return (
    <section className="w pg"><h1>Tài khoản</h1><p className="mu">{user.email}</p>
      {form('Hồ sơ cá nhân', 'Lưu thông tin', async d => { const r = await api('/auth/me', { method: 'PUT', body: d }); setUser(r.user); say('Đã lưu thông tin'); },
        <><Field label="Họ tên" name="name" defaultValue={user.name} required /><Field label="Số điện thoại" name="phone" defaultValue={user.phone} />
          <label className="wide">Địa chỉ<input name="address" defaultValue={user.address} /></label></>)}
      {form('Đổi mật khẩu', 'Đổi mật khẩu', async d => { await api('/auth/password', { method: 'PUT', body: d }); say('Đã đổi mật khẩu'); },
        <><Field label="Mật khẩu hiện tại" name="current" type="password" required /><Field label="Mật khẩu mới" name="password" type="password" required />
          <Field label="Nhập lại mật khẩu mới" name="confirm" type="password" required /></>, true)}
      <button className="b o" onClick={() => { logout(); say('Đã đăng xuất'); nav('/'); }}>Đăng xuất</button>
    </section>
  );
}
function AuthFormInline({ title, button, submit, children, reset }) {
  const [e, setE] = useState('');
  return (
    <form className="fm" onSubmit={async ev => {
      ev.preventDefault(); setE(''); const f = ev.target;
      try { await submit(Object.fromEntries(new FormData(f))); if (reset) f.reset(); } catch (x) { setE(x.message); }
    }}>
      <h2>{title}</h2>{children}<Err m={e} /><div><button className="b">{button}</button></div>
    </form>
  );
}
