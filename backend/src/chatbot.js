// Trợ lý tư vấn: dùng Claude nếu có ANTHROPIC_API_KEY, ngược lại (hoặc khi lỗi) dùng luật dự phòng.
const KW = [[/da dầu|bóng dầu|dầu nhờn|kiềm dầu/, 'dầu'], [/da khô|khô ráp|bong tróc|khô căng/, 'khô'], [/hỗn hợp/, 'hỗn hợp'],
  [/nhạy cảm|kích ứng|đỏ rát/, 'nhạy cảm'], [/mụn|lỗ chân lông|đầu đen/, 'mụn'], [/thâm|nám|sáng da|đều màu|xỉn/, 'sáng'],
  [/lão hóa|nếp nhăn|chống lão/, 'lão hóa'], [/cấp ẩm|dưỡng ẩm|căng bóng|độ ẩm/, 'cấp ẩm'], [/chống nắng|nắng|\buv\b/, 'nắng'],
  [/rửa mặt|làm sạch|tẩy trang/, 'sạch'], [/\bson\b|môi/, 'môi']];
const price = p => p.sale_price || p.price;
const money = n => Number(n).toLocaleString('vi-VN') + 'đ';
const TIP = 'Với da nhạy cảm, bạn nên thử trước ở vùng da nhỏ. Nếu da đang viêm nặng, hãy hỏi bác sĩ da liễu.';

function byRules(msg, list) {
  const t = msg.toLowerCase();
  if (/^(xin chào|chào|hello|hi|alo)\b/.test(t) && t.length < 20)
    return { reply: 'Chào bạn! Mình là trợ lý BeautyGlow AI. Hãy cho mình biết loại da, vấn đề cần cải thiện và ngân sách để mình gợi ý nhé.', ids: [] };
  if (/giao hàng|vận chuyển|ship|đổi trả|thanh toán|mã giảm/.test(t) && !/da |mụn/.test(t))
    return { reply: 'Phí vận chuyển 30.000đ (tiêu chuẩn) hoặc 50.000đ (nhanh), miễn phí cho đơn từ 500.000đ. Bạn có thể thanh toán khi nhận hàng, chuyển khoản hoặc qua VNPay. Mã GLOW10 giảm 10%, FREESHIP miễn phí vận chuyển.', ids: [] };
  const tags = KW.filter(([r]) => r.test(t)).map(x => x[1]);
  const cats = [...new Set(list.map(p => p.category))].filter(c => t.includes(c.toLowerCase()));
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|củ)\b/);
  const max = m ? parseFloat(m[1].replace(',', '.')) * (/^(tr|triệu|củ)$/.test(m[2]) ? 1e6 : 1e3) : 0;
  if (!tags.length && !cats.length && !max)
    return { reply: 'Mình chỉ hỗ trợ tư vấn mỹ phẩm và chăm sóc da. Bạn thử cho mình biết loại da (dầu, khô, hỗn hợp, nhạy cảm), vấn đề muốn cải thiện hoặc ngân sách nhé.', ids: [] };
  const r = list.filter(p => !max || price(p) <= max)
    .map(p => ({ p, s: p.tags.filter(x => tags.includes(x)).length + (cats.includes(p.category) ? 2 : 0) }))
    .filter(x => x.s > 0 || (!tags.length && !cats.length)).sort((a, b) => b.s - a.s || b.p.sold - a.p.sold).slice(0, 3);
  if (!r.length) return { reply: 'Mình chưa tìm thấy sản phẩm phù hợp' + (max ? ' trong mức ' + money(max) : '') + '. Bạn thử tăng ngân sách hoặc mô tả nhu cầu khác nhé.', ids: [] };
  return { reply: 'Dựa trên nhu cầu của bạn, mình gợi ý các sản phẩm sau:', ids: r.map(x => x.p.id), tip: TIP };
}

async function byClaude(msg, list) {
  const catalog = list.map(p => `${p.id}|${p.name}|${p.category}|${price(p)}đ|${p.tags.join(',')}|${p.description}`).join('\n');
  const system = `Bạn là trợ lý tư vấn mỹ phẩm của cửa hàng BeautyGlow AI. Chỉ tư vấn mỹ phẩm và chăm sóc da, không chẩn đoán bệnh da liễu. Chỉ gợi ý sản phẩm có trong danh mục bên dưới. Nếu câu hỏi ngoài phạm vi, từ chối lịch sự và hướng về chủ đề mỹ phẩm. Trả lời tiếng Việt, ngắn gọn, thân thiện. Chỉ trả về JSON dạng {"reply":"...","ids":[tối đa 3 id sản phẩm phù hợp, có thể rỗng]}.\nDanh mục (id|tên|danh mục|giá|nhãn|mô tả):\n${catalog}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: 600, system, messages: [{ role: 'user', content: msg }] })
  });
  if (!r.ok) throw new Error('AI ' + r.status);
  const j = await r.json();
  const txt = j.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  const ok = new Set(list.map(p => p.id));
  return { reply: String(o.reply || ''), ids: (o.ids || []).filter(i => ok.has(i)).slice(0, 3), tip: TIP };
}

export async function advise(msg, list) {
  if (process.env.ANTHROPIC_API_KEY) {
    try { const a = await byClaude(msg, list); if (a.reply) return a; } catch (e) { console.error('[chatbot]', e.message); }
  }
  return byRules(msg, list);
}
