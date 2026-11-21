import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [toast, setToast] = useState('');
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('bg_cart')) || []; } catch { return []; } });
  const [coupon, setCoupon] = useState(''), [ship, setShip] = useState('std');
  useEffect(() => { localStorage.setItem('bg_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    if (!localStorage.getItem('bg_token')) return setReady(true);
    api('/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('bg_token')).finally(() => setReady(true));
  }, []);
  const say = useCallback(m => { setToast(m); setTimeout(() => setToast(''), 3500); }, []);
  const login = (token, u) => { localStorage.setItem('bg_token', token); setUser(u); };
  const logout = () => { localStorage.removeItem('bg_token'); setUser(null); };
  const add = (p, n = 1) => {
    const cur = cart.find(i => i.id === p.id)?.qty || 0;
    if (cur + n > p.stock) { say('Chỉ còn ' + p.stock + ' sản phẩm trong kho'); return false; }
    setCart(c => c.some(i => i.id === p.id) ? c.map(i => i.id === p.id ? { ...i, qty: i.qty + n, stock: p.stock } : i)
      : [...c, { id: p.id, name: p.name, price: p.sale_price || p.price, stock: p.stock, color: p.color, category_id: p.category_id, image_url: p.image_url, qty: n }]);
    say('Đã thêm vào giỏ hàng'); return true;
  };
  const setQty = (id, q) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.min(q, i.stock) } : i).filter(i => i.qty > 0));
  const clear = () => { setCart([]); setCoupon(''); };
  const sub = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const disc = coupon === 'GLOW10' ? Math.round(sub * 0.1) : 0;
  const fee = !sub || sub >= 500000 || coupon === 'FREESHIP' ? 0 : ship === 'fast' ? 50000 : 30000;
  return <Ctx.Provider value={{ user, ready, login, logout, setUser, cart, add, setQty, clear, coupon, setCoupon, ship, setShip, sub, disc, fee, total: sub - disc + fee, say, toast }}>{children}</Ctx.Provider>;
}
