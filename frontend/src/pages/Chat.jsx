import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { Art, money } from '../ui.jsx';

const HELLO = { r: 'b', t: 'Xin chào! Bạn muốn tìm sản phẩm cho loại da nào, và ngân sách khoảng bao nhiêu?' };
const CHIPS = ['Da dầu, hay nổi mụn', 'Da khô, dưới 400k', 'Kem chống nắng cho da nhạy cảm'];

export default function Chat() {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([HELLO]), [wait, setWait] = useState(false), [q, setQ] = useState('');
  const { add, say } = useApp(), end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, open, wait]);

  const send = async text => {
    text = text.trim();
    if (!text) return say('Hãy nhập câu hỏi trước khi gửi');
    setMsgs(m => [...m, { r: 'u', t: text }]); setQ(''); setWait(true);
    try {
      const d = await api('/chat', { method: 'POST', body: { message: text } });
      setMsgs(m => [...m, { r: 'b', t: d.reply, products: d.products, tip: d.tip }]);
    } catch (e) {
      setMsgs(m => [...m, { r: 'b', t: 'Trợ lý hiện chưa khả dụng. Bạn vui lòng thử lại sau ít phút nhé.' }]);
    } finally { setWait(false); }
  };
  // Cho phép trang chủ mở chat kèm câu hỏi
  const sendRef = useRef(send); sendRef.current = send;
  useEffect(() => {
    const h = e => { setOpen(true); sendRef.current(e.detail); };
    window.addEventListener('bg-ask', h); return () => window.removeEventListener('bg-ask', h);
  }, []);

  return (
    <>
      <button id="cb" onClick={() => setOpen(!open)} aria-expanded={open}>Hỏi trợ lý AI</button>
      {open && (
        <section id="cp" className="on" aria-label="Trợ lý BeautyGlow AI">
          <div className="hd">Trợ lý BeautyGlow AI<small>Gợi ý mang tính tham khảo, không thay thế bác sĩ da liễu</small></div>
          <div id="ms" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={'m' + (m.r === 'u' ? ' u' : '')}>{m.t}
                {m.products?.map(p => (
                  <div className="rc" key={p.id}>
                    <Art p={p} /><div><b>{p.name}</b><br /><span className="mu">{money(p.sale_price || p.price)}</span></div>
                    <div className="a"><Link className="b sm o" to={'/product/' + p.id} onClick={() => setOpen(false)}>Xem chi tiết</Link><button className="b sm" onClick={() => add(p)}>Thêm vào giỏ</button></div>
                  </div>
                ))}
                {m.tip && <p className="mu" style={{ fontSize: '.82rem', margin: '8px 0 0' }}>{m.tip}</p>}
              </div>
            ))}
            {wait && <div className="m mu">Đang soạn câu trả lời…</div>}
            <div ref={end} />
          </div>
          {msgs.length === 1 && <div className="chips" style={{ padding: '0 10px 8px' }}>{CHIPS.map(c => <button key={c} onClick={() => send(c)}>{c}</button>)}</div>}
          <form id="cf" onSubmit={e => { e.preventDefault(); send(q); }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Loại da, vấn đề, ngân sách…" aria-label="Câu hỏi" maxLength={500} autoComplete="off" />
            <button className="b sm" disabled={wait}>Gửi</button>
          </form>
        </section>
      )}
    </>
  );
}
