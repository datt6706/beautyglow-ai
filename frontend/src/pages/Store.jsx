import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useApp } from '../store.jsx';
import { Art, Card, Price } from '../ui.jsx';

const ask = t => window.dispatchEvent(new CustomEvent('bg-ask', { detail: t }));

export function Home() {
  const [top, setTop] = useState([]), [sale, setSale] = useState([]), [cats, setCats] = useState([]), nav = useNavigate();
  useEffect(() => {
    api('/products?sort=sold').then(d => { setTop(d); setSale(d.filter(p => p.sale_price).slice(0, 4)); });
    api('/categories').then(setCats);
  }, []);
  const submit = e => { e.preventDefault(); const q = new FormData(e.target).get('q').trim(); if (q) ask(q); };
  return (
    <>
      <section className="w hero">
        <div>
          <h1>Hỏi trợ lý trước, chọn mỹ phẩm sau.</h1>
          <p>Nói loại da và ngân sách của bạn. BeautyGlow AI gợi ý sản phẩm đang có hàng, bạn xem và thêm vào giỏ ngay trong khung chat.</p>
          <form className="ask" onSubmit={submit}>
            <input name="q" placeholder="Ví dụ: da dầu, hay nổi mụn, dưới 300k" aria-label="Hỏi trợ lý" /><button className="b">Hỏi trợ lý</button>
          </form>
          <div className="chips">{['Da khô, dưới 400k', 'Kem chống nắng cho da nhạy cảm', 'Giảm thâm, sáng da'].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
        </div>
        <div className="orb">{top.slice(0, 3).map(p => <Art key={p.id} p={p} />)}</div>
      </section>
      <div className="w">
        <div className="cats">{cats.map(c => <button key={c.id} onClick={() => nav('/shop?category=' + c.id)}>{c.name}</button>)}</div>
        <h2>Bán chạy</h2><div className="grid">{top.slice(0, 4).map(p => <Card key={p.id} p={p} />)}</div>
        {sale.length > 0 && <><h2>Đang giảm giá</h2><div className="grid">{sale.map(p => <Card key={p.id} p={p} />)}</div></>}
        <div className="trust">
          <div><h3>Tư vấn mọi giờ</h3><p>Trợ lý AI trả lời về loại da, thành phần và gợi ý theo ngân sách.</p></div>
          <div><h3>Theo dõi đơn hàng</h3><p>Xem trạng thái từ lúc chờ xác nhận đến khi hoàn tất.</p></div>
          <div><h3>Mã giảm giá</h3><p>Nhập GLOW10 để giảm 10% hoặc FREESHIP để miễn phí vận chuyển.</p></div>
        </div>
      </div>
    </>
  );
}

export function Shop() {
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: sp.get('q') || '', category: sp.get('category') || '', brand: '', range: '', skin: '', sort: 'sold' });
  const [list, setList] = useState(null), [cats, setCats] = useState([]), [brands, setBrands] = useState([]);
  useEffect(() => { setF(x => ({ ...x, q: sp.get('q') || '', category: sp.get('category') || '' })); }, [sp]);
  useEffect(() => { api('/categories').then(setCats); api('/brands').then(setBrands); }, []);
  useEffect(() => {
    const [min, max] = f.range ? f.range.split('-') : ['', ''];
    const t = setTimeout(() => api('/products?' + qs({ q: f.q, category: f.category, brand: f.brand, min, max, skin: f.skin, sort: f.sort })).then(setList), 250);
    return () => clearTimeout(t);
  }, [f]);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const sel = (label, k, opts) => <label>{label}<select value={f[k]} onChange={set(k)}>{opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>;
  return (
    <section className="w pg">
      <h1>Sản phẩm</h1>
      <div className="flt">
        <label>Từ khóa<input value={f.q} onChange={set('q')} placeholder="Tên hoặc thương hiệu" /></label>
        {sel('Danh mục', 'category', [['', 'Tất cả'], ...cats.map(c => [String(c.id), c.name])])}
        {sel('Thương hiệu', 'brand', [['', 'Tất cả'], ...brands.map(b => [b, b])])}
        {sel('Khoảng giá', 'range', [['', 'Mọi mức giá'], ['0-200000', 'Dưới 200.000đ'], ['200000-400000', '200.000đ đến 400.000đ'], ['400000-', 'Từ 400.000đ']])}
        {sel('Loại da', 'skin', [['', 'Tất cả'], ['dầu', 'Da dầu'], ['khô', 'Da khô'], ['hỗn hợp', 'Da hỗn hợp'], ['nhạy cảm', 'Da nhạy cảm'], ['mụn', 'Da mụn']])}
        {sel('Sắp xếp', 'sort', [['sold', 'Bán chạy'], ['new', 'Mới nhất'], ['asc', 'Giá tăng dần'], ['desc', 'Giá giảm dần']])}
      </div>
      {list && <p className="mu">{list.length} sản phẩm</p>}
      <div className="grid">
        {list?.map(p => <Card key={p.id} p={p} />)}
        {list?.length === 0 && <p className="empty" style={{ gridColumn: '1/-1' }}>Không có sản phẩm phù hợp. Hãy bỏ bớt bộ lọc hoặc đổi từ khóa.</p>}
      </div>
    </section>
  );
}

export function Product() {
  const { id } = useParams(), [p, setP] = useState(undefined), [rel, setRel] = useState([]), [n, setN] = useState(1);
  const { add } = useApp(), nav = useNavigate();
  useEffect(() => {
    setP(undefined); setN(1);
    api('/products/' + id).then(d => { setP(d); api('/products?category=' + d.category_id).then(r => setRel(r.filter(x => x.id !== d.id).slice(0, 4))); }).catch(() => setP(null));
  }, [id]);
  if (p === undefined) return <p className="empty">Đang tải…</p>;
  if (!p) return <section className="w pg empty"><p>Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.</p><Link className="b" to="/shop">Xem sản phẩm khác</Link></section>;
  return (
    <section className="w pg">
      <div className="det">
        <Art p={p} />
        <div>
          <p className="mu">{p.brand} · {p.category}</p><h1>{p.name}</h1>
          <div style={{ fontSize: '1.4rem', margin: '14px 0' }}><Price p={p} /></div>
          <p>{p.description}</p>
          <p>{p.tags.map(t => <span className="tg" key={t}>{t}</span>)}</p>
          <p className="mu">{p.stock > 0 ? `Còn ${p.stock} sản phẩm` : 'Tạm hết hàng'} · Đã bán {p.sold}</p>
          {p.stock > 0 && (
            <div className="qt" style={{ gap: 12 }}>
              <input type="number" min="1" max={p.stock} value={n} onChange={e => setN(Math.max(1, +e.target.value || 1))} style={{ width: 80 }} aria-label="Số lượng" />
              <button className="b" onClick={() => add(p, n)}>Thêm vào giỏ</button>
              <button className="b o" onClick={() => add(p, n) && nav('/cart')}>Mua ngay</button>
            </div>
          )}
        </div>
      </div>
      <h2 style={{ marginTop: 40 }}>Cùng danh mục</h2>
      <div className="grid">{rel.map(x => <Card key={x.id} p={x} />)}{!rel.length && <p className="mu">Chưa có sản phẩm khác.</p>}</div>
    </section>
  );
}
