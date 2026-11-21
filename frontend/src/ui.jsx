import { Link } from 'react-router-dom';
import { useApp } from './store.jsx';
export const money = n => Number(n).toLocaleString('vi-VN') + 'đ';
const SP = {
  t: '<path d="M34 20h32l-4 78H38z"/><rect x="38" y="8" width="24" height="12" rx="3" opacity=".6"/>',
  s: '<rect x="34" y="40" width="32" height="60" rx="8"/><rect x="43" y="24" width="14" height="16" rx="2" opacity=".6"/><path d="M46 6h8v18h-8z" opacity=".85"/>',
  j: '<rect x="22" y="56" width="56" height="42" rx="10"/><rect x="26" y="40" width="48" height="16" rx="5" opacity=".6"/>',
  m: '<rect x="26" y="18" width="48" height="80" rx="6"/><rect x="26" y="18" width="48" height="10" opacity=".55"/>',
  l: '<rect x="36" y="58" width="28" height="42" rx="4" opacity=".7"/><rect x="40" y="30" width="20" height="28" rx="3"/><path d="M40 30l10-16 10 16z"/>'
};
const SH = { 1: 't', 2: 's', 3: 'j', 4: 't', 5: 'm', 6: 'l' };
// Có image_url thì hiện ảnh thật, không thì vẽ hình minh họa theo danh mục
export function Art({ p }) {
  return (
    <div className="th" style={{ '--c': p.color || '#c06fbb' }}>
      {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" />
        : <svg viewBox="0 0 100 110" fill={p.color || '#c06fbb'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SP[SH[p.category_id] || 'j'] }} />}
    </div>
  );
}
export const Price = ({ p }) => p.sale_price
  ? <div className="pr"><b>{money(p.sale_price)}</b><s>{money(p.price)}</s><i>-{Math.round(100 - p.sale_price / p.price * 100)}%</i></div>
  : <div className="pr"><b>{money(p.price)}</b></div>;
export function Card({ p }) {
  const { add } = useApp();
  return (
    <article className="pc">
      <Link to={'/product/' + p.id}><Art p={p} /><small>{p.brand}</small><h3>{p.name}</h3></Link>
      <Price p={p} />
      <button className="b sm" disabled={p.stock < 1} onClick={() => add(p)}>{p.stock < 1 ? 'Hết hàng' : 'Thêm vào giỏ'}</button>
    </article>
  );
}
export const Err = ({ m }) => <p className="err" role="alert">{m}</p>;
export const Field = ({ label, ...r }) => <label>{label}<input {...r} /></label>;
