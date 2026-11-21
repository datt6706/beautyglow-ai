import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Art, Err, money } from '../ui.jsx';

const PAY = { cod: 'Thanh toán khi nhận hàng', bank: 'Chuyển khoản ngân hàng', vnpay: 'Cổng VNPay (mô phỏng)' };
const STEPS = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn tất'];

function Summary({ children }) {
  const { sub, disc, fee, total } = useApp();
  return (
    <aside className="sum">{children}
      <div className="r"><span>Tạm tính</span><span>{money(sub)}</span></div>
      <div className="r"><span>Giảm giá</span><span>-{money(disc)}</span></div>
      <div className="r"><span>Vận chuyển</span><span>{money(fee)}</span></div>
      <div className="r t"><span>Tổng cộng</span><span>{money(total)}</span></div>
    </aside>
  );
}

export function Cart() {
  const { cart, setQty, coupon, setCoupon, ship, setShip } = useApp(), [code, setCode] = useState(coupon), [e, setE] = useState('');
  if (!cart.length) return <section className="w pg empty"><h1>Giỏ hàng</h1><p>Giỏ hàng đang trống. Hãy chọn vài sản phẩm bạn thích.</p><Link className="b" to="/shop">Xem sản phẩm</Link></section>;
  const apply = ev => {
    ev.preventDefault(); const c = code.trim().toUpperCase();
    if (c && !['GLOW10', 'FREESHIP'].includes(c)) return setE('Mã giảm giá không hợp lệ.');
    setE(''); setCoupon(c);
  };
  return (
    <section className="w pg"><h1>Giỏ hàng</h1>
      <div className="two">
        <div>{cart.map(i => (
          <div className="ln" key={i.id}>
            <Art p={i} />
            <div><Link to={'/product/' + i.id}><b>{i.name}</b></Link><div className="mu">{money(i.price)}</div>
              <div className="qt">
                <button onClick={() => setQty(i.id, i.qty - 1)} aria-label="Giảm số lượng">−</button><span>{i.qty}</span>
                <button onClick={() => setQty(i.id, i.qty + 1)} aria-label="Tăng số lượng">+</button>
                <button className="lk" onClick={() => setQty(i.id, 0)}>Xóa</button>
              </div></div>
            <b>{money(i.price * i.qty)}</b>
          </div>))}</div>
        <Summary>
          <form onSubmit={apply} style={{ display: 'flex', gap: 6 }}>
            <input value={code} onChange={x => setCode(x.target.value)} placeholder="Mã giảm giá" style={{ flex: 1, minWidth: 0 }} /><button className="b sm o">Áp dụng</button>
          </form><Err m={e} />
          <label className="o"><input type="radio" checked={ship === 'std'} onChange={() => setShip('std')} /> Tiêu chuẩn 30.000đ</label>
          <label className="o"><input type="radio" checked={ship === 'fast'} onChange={() => setShip('fast')} /> Nhanh 50.000đ</label>
          <p className="mu" style={{ fontSize: '.85rem', margin: '2px 0 10px' }}>Miễn phí vận chuyển cho đơn từ 500.000đ.</p>
          <Link className="b" to="/checkout" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>Tiến hành đặt hàng</Link>
        </Summary>
      </div>
    </section>
  );
}

export function Checkout() {
  const { cart, user, coupon, ship, clear, say } = useApp(), nav = useNavigate(), [e, setE] = useState(''), [busy, setBusy] = useState(false);
  if (!cart.length) return <section className="w pg empty"><p>Giỏ hàng đang trống.</p><Link className="b" to="/shop">Xem sản phẩm</Link></section>;
  const submit = async ev => {
    ev.preventDefault(); const d = Object.fromEntries(new FormData(ev.target)); setE(''); setBusy(true);
    try {
      const r = await api('/orders', { method: 'POST', body: { ...d, items: cart.map(i => ({ id: i.id, qty: i.qty })), coupon, shipping: ship } });
      clear(); say('Đặt hàng thành công. Mã đơn của bạn: ' + r.code); nav('/orders');
    } catch (x) { setE(x.message); } finally { setBusy(false); }
  };
  return (
    <section className="w pg"><h1>Đặt hàng</h1>
      <div className="two">
        <form className="fm" style={{ margin: 0 }} onSubmit={submit}>
          <h2>Thông tin nhận hàng</h2>
          <label>Họ tên người nhận<input name="name" defaultValue={user.name} required /></label>
          <label>Số điện thoại<input name="phone" defaultValue={user.phone} inputMode="tel" placeholder="0912345678" required /></label>
          <label className="wide">Địa chỉ giao hàng<input name="address" defaultValue={user.address} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" required /></label>
          <label className="wide">Ghi chú<input name="note" /></label>
          <fieldset><legend>Phương thức thanh toán</legend>
            {Object.entries(PAY).map(([k, v], i) => <label className="o" key={k}><input type="radio" name="payment" value={k} defaultChecked={!i} /> {v}</label>)}
          </fieldset>
          <Err m={e} /><div><button className="b" disabled={busy}>{busy ? 'Đang đặt hàng…' : 'Đặt hàng'}</button></div>
        </form>
        <Summary>{cart.map(i => <div className="r" key={i.id}><span>{i.name} × {i.qty}</span><span>{money(i.price * i.qty)}</span></div>)}</Summary>
      </div>
    </section>
  );
}

export function Orders() {
  const [list, setList] = useState(null), { say } = useApp();
  const load = () => api('/orders/mine').then(setList);
  useEffect(() => { load(); }, []);
  const cancel = async id => { try { await api(`/orders/${id}/cancel`, { method: 'POST' }); say('Đã hủy đơn hàng'); load(); } catch (x) { say(x.message); } };
  if (!list) return <p className="empty">Đang tải…</p>;
  return (
    <section className="w pg"><h1>Đơn hàng của tôi</h1>
      {!list.length && <><p className="empty">Bạn chưa có đơn hàng nào.</p><p className="empty"><Link className="b" to="/shop">Mua sắm ngay</Link></p></>}
      {list.map(o => {
        const k = STEPS.indexOf(o.status);
        return (
          <div className="od" key={o.id}>
            <b>{o.code}</b> <span className="mu">· {new Date(o.created_at).toLocaleString('vi-VN')}</span>
            {o.status === 'Đã hủy' ? <p className="err">Đơn hàng đã hủy</p> : <div className="st">{STEPS.map((s, i) => <span key={s} className={i <= k ? 'on' : ''}>{s}</span>)}</div>}
            {o.items.map(i => <div className="r" style={{ display: 'flex', justifyContent: 'space-between' }} key={i.id}><span>{i.product_name} × {i.quantity}</span><span>{money(i.price * i.quantity)}</span></div>)}
            <p className="mu" style={{ margin: '8px 0' }}>Giao đến: {o.name}, {o.phone}, {o.address}<br />{PAY[o.payment]}</p>
            <b>Tổng: {money(o.total)}</b>
            {o.status === 'Chờ xác nhận' && <button className="b sm o" style={{ marginLeft: 12 }} onClick={() => cancel(o.id)}>Hủy đơn</button>}
          </div>
        );
      })}
    </section>
  );
}
