import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Err, money } from '../ui.jsx';

const ST = ['Chờ xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn tất', 'Đã hủy'];
const PAY = { cod: 'COD', bank: 'Chuyển khoản', vnpay: 'VNPay' };
function useLoad(path) {
  const [d, setD] = useState(null), [n, setN] = useState(0);
  useEffect(() => { api(path).then(setD).catch(() => setD([])); }, [path, n]);
  return [d, () => setN(x => x + 1)];
}

function Stats() {
  const [s] = useLoad('/admin/stats');
  if (!s || !s.top) return <p className="empty">Đang tải…</p>;
  const mx = Math.max(1, s.top[0]?.sold || 1);
  return (
    <>
      <div className="sc">
        <div><span className="mu">Doanh thu</span><b>{money(s.revenue)}</b></div><div><span className="mu">Đơn hàng</span><b>{s.orders}</b></div>
        <div><span className="mu">Chờ xác nhận</span><b>{s.pending}</b></div><div><span className="mu">Khách hàng</span><b>{s.customers}</b></div>
        <div><span className="mu">Sắp hết hàng (≤5)</span><b>{s.lowStock}</b></div>
      </div>
      <h2>Bán chạy nhất</h2>
      {s.top.map(p => <div className="bar" key={p.name}><span style={{ width: 230, maxWidth: '40%' }}>{p.name}</span><i style={{ width: p.sold / mx * 50 + '%' }} /><span>{p.sold}</span></div>)}
    </>
  );
}

function Products() {
  const [list, reload] = useLoad('/admin/products'), [cats] = useLoad('/categories'), { say } = useApp();
  const [edit, setEdit] = useState(null), [del, setDel] = useState(null), [e, setE] = useState('');
  const save = async ev => {
    ev.preventDefault(); setE('');
    const d = Object.fromEntries(new FormData(ev.target)); d.active = d.active === 'on';
    try {
      await api(edit.id ? '/products/' + edit.id : '/products', { method: edit.id ? 'PUT' : 'POST', body: d });
      setEdit(null); say('Đã lưu sản phẩm'); reload();
    } catch (x) { setE(x.message); }
  };
  const remove = async p => {
    if (del !== p.id) return setDel(p.id);
    const r = await api('/products/' + p.id, { method: 'DELETE' }); setDel(null);
    say(r.deactivated ? 'Sản phẩm đã có trong đơn hàng nên được chuyển sang ngừng kinh doanh' : 'Đã xóa sản phẩm'); reload();
  };
  const toggle = async p => { await api('/products/' + p.id, { method: 'PUT', body: { ...p, active: !p.active } }); reload(); };
  return (
    <>
      {edit ? (
        <form className="fm" key={edit.id || 'new'} onSubmit={save}>
          <h2>{edit.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
          <label>Tên<input name="name" defaultValue={edit.name} required /></label>
          <label>Thương hiệu<input name="brand" defaultValue={edit.brand} /></label>
          <label>Danh mục<select name="category_id" defaultValue={edit.category_id}>{(cats || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Giá bán (đ)<input name="price" type="number" min="1000" defaultValue={edit.price} required /></label>
          <label>Giá khuyến mãi (đ, bỏ trống nếu không có)<input name="sale_price" type="number" min="0" defaultValue={edit.sale_price || ''} /></label>
          <label>Tồn kho<input name="stock" type="number" min="0" defaultValue={edit.stock ?? 10} /></label>
          <label>Màu minh họa<input name="color" type="color" defaultValue={edit.color || '#c06fbb'} /></label>
          <label>Đường dẫn ảnh (tùy chọn)<input name="image_url" defaultValue={edit.image_url} placeholder="https://…" /></label>
          <label className="wide">Nhãn, cách nhau bằng dấu phẩy (dầu, khô, mụn, sáng…)<input name="tags" defaultValue={(edit.tags || []).join(', ')} /></label>
          <label className="wide">Mô tả<textarea name="description" rows="3" defaultValue={edit.description} /></label>
          <label className="o"><input type="checkbox" name="active" defaultChecked={edit.active !== 0 && edit.active !== false} /> Đang kinh doanh</label>
          <Err m={e} /><div><button className="b">Lưu sản phẩm</button> <button type="button" className="b o" onClick={() => setEdit(null)}>Hủy</button></div>
        </form>
      ) : <p><button className="b" onClick={() => { setE(''); setEdit({ category_id: cats?.[0]?.id }); }}>Thêm sản phẩm</button></p>}
      <div className="tw"><table className="tb"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Khuyến mãi</th><th>Kho</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{(list || []).map(p => (
          <tr key={p.id}><td>{p.name}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.sale_price ? money(p.sale_price) : '—'}</td><td>{p.stock}</td><td>{p.active ? 'Đang bán' : 'Ngừng kinh doanh'}</td>
            <td><button className="lk" onClick={() => { setE(''); setEdit(p); }}>Sửa</button><button className="lk" onClick={() => toggle(p)}>{p.active ? 'Ngừng bán' : 'Bán lại'}</button>
              <button className="lk" onClick={() => remove(p)}>{del === p.id ? 'Bấm lại để xóa' : 'Xóa'}</button></td></tr>))}</tbody></table></div>
    </>
  );
}

function Categories() {
  const [list, reload] = useLoad('/categories'), [e, setE] = useState(''), [del, setDel] = useState(null), { say } = useApp();
  const run = async fn => { setE(''); try { await fn(); reload(); } catch (x) { setE(x.message); } };
  return (
    <>
      <form onSubmit={ev => { ev.preventDefault(); const f = ev.target; run(async () => { await api('/categories', { method: 'POST', body: { name: f.name.value } }); f.reset(); say('Đã thêm danh mục'); }); }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input name="name" placeholder="Tên danh mục mới" required /><button className="b sm">Thêm danh mục</button>
      </form><Err m={e} />
      <div className="tw"><table className="tb"><thead><tr><th>Tên danh mục</th><th>Số sản phẩm</th><th /></tr></thead><tbody>
        {(list || []).map(c => (
          <tr key={c.id}><td><input defaultValue={c.name} aria-label="Tên danh mục" onBlur={ev => ev.target.value.trim() && ev.target.value !== c.name && run(async () => { await api('/categories/' + c.id, { method: 'PUT', body: { name: ev.target.value } }); say('Đã đổi tên danh mục'); })} /></td>
            <td>{c.products}</td>
            <td><button className="lk" onClick={() => del === c.id ? run(async () => { await api('/categories/' + c.id, { method: 'DELETE' }); setDel(null); say('Đã xóa danh mục'); }) : setDel(c.id)}>{del === c.id ? 'Bấm lại để xóa' : 'Xóa'}</button></td></tr>))}
      </tbody></table></div>
    </>
  );
}

function AdminOrders() {
  const [list, reload] = useLoad('/admin/orders'), { say } = useApp();
  const change = async (o, status) => { try { await api(`/admin/orders/${o.id}/status`, { method: 'PUT', body: { status } }); say('Đã cập nhật đơn ' + o.code); } catch (x) { say(x.message); } reload(); };
  if (list && !list.length) return <p className="empty">Chưa có đơn hàng nào.</p>;
  return (
    <div className="tw"><table className="tb"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Tổng</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead><tbody>
      {(list || []).map(o => (
        <tr key={o.id}><td>{o.code}</td><td>{o.name} ({o.email})</td><td>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td><td>{money(o.total)}</td><td>{PAY[o.payment]}</td>
          <td><select value={o.status} onChange={ev => change(o, ev.target.value)}>{ST.map(s => <option key={s}>{s}</option>)}</select></td></tr>))}
    </tbody></table></div>
  );
}

function Customers() {
  const [list] = useLoad('/admin/customers');
  return (
    <div className="tw"><table className="tb"><thead><tr><th>Họ tên</th><th>Email</th><th>Điện thoại</th><th>Xác thực</th><th>Số đơn</th></tr></thead><tbody>
      {(list || []).map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.phone || '—'}</td><td>{u.verified ? 'Đã xác thực' : 'Chưa'}</td><td>{u.orders}</td></tr>)}
      {list && !list.length && <tr><td colSpan="5">Chưa có khách hàng.</td></tr>}
    </tbody></table></div>
  );
}

const TABS = [['stats', 'Thống kê', Stats], ['prod', 'Sản phẩm', Products], ['cat', 'Danh mục', Categories], ['ord', 'Đơn hàng', AdminOrders], ['cus', 'Khách hàng', Customers]];
export default function Admin() {
  const [tab, setTab] = useState('stats'), View = TABS.find(t => t[0] === tab)[2];
  return (
    <section className="w pg"><h1>Quản trị</h1>
      <div className="tabs">{TABS.map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>
      <View />
    </section>
  );
}
