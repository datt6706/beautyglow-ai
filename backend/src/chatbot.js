
// Chatbot tư vấn mỹ phẩm BeautyGlow AI
// Ưu tiên Claude AI nếu có API key.
// Nếu không có API key hoặc Claude gặp lỗi, sử dụng luật dự phòng.

const KEYWORDS = [
  [/da dầu|bóng dầu|dầu nhờn|kiềm dầu/i, 'dầu'],
  [/da khô|khô ráp|bong tróc|khô căng/i, 'khô'],
  [/da hỗn hợp|hỗn hợp/i, 'hỗn hợp'],
  [/da nhạy cảm|kích ứng|đỏ rát/i, 'nhạy cảm'],
  [/mụn|lỗ chân lông|đầu đen/i, 'mụn'],
  [/thâm|nám|sáng da|đều màu|xỉn màu/i, 'sáng'],
  [/lão hóa|nếp nhăn|chống lão/i, 'lão hóa'],
  [/cấp ẩm|dưỡng ẩm|căng bóng|độ ẩm/i, 'cấp ẩm'],
  [/chống nắng|tia uv|\buv\b/i, 'nắng'],
  [/rửa mặt|làm sạch|tẩy trang/i, 'sạch'],
  [/\bson\b|môi/i, 'môi']
];

const TIP =
  'Với da nhạy cảm, bạn nên thử sản phẩm trước ở vùng da nhỏ. Nếu da đang viêm nặng, hãy tham khảo ý kiến bác sĩ da liễu.';

// Lấy giá bán của sản phẩm
function getPrice(product) {
  return Number(product.sale_price || product.price || 0);
}

// Định dạng tiền Việt Nam
function formatMoney(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ';
}

// Tư vấn bằng luật dự phòng
function adviseByRules(message, products) {
  const text = String(message || '').toLowerCase();

  if (!text.trim()) {
    return {
      reply: 'Bạn hãy nhập nhu cầu chăm sóc da để mình tư vấn nhé!',
      ids: []
    };
  }

  // Chào hỏi
  if (/^(xin chào|chào|hello|hi|alo)\b/.test(text) && text.length < 30) {
    return {
      reply: 'Chào bạn! Mình là trợ lý BeautyGlow AI. Bạn hãy cho mình biết loại da, vấn đề muốn cải thiện và ngân sách để mình gợi ý sản phẩm phù hợp nhé!',
      ids: []
    };
  }

  // Câu hỏi về chính sách cửa hàng
  if (
    /giao hàng|vận chuyển|ship|đổi trả|thanh toán|mã giảm/.test(text) &&
    !/da |mụn/.test(text)
  ) {
    return {
      reply: 'Phí vận chuyển tiêu chuẩn là 30.000đ, giao nhanh là 50.000đ. Miễn phí vận chuyển cho đơn từ 500.000đ. Cửa hàng hỗ trợ thanh toán khi nhận hàng, chuyển khoản hoặc VNPay. Mã GLOW10 giảm 10%, FREESHIP miễn phí vận chuyển.',
      ids: []
    };
  }

  // Phân tích nhu cầu
  const tags = KEYWORDS
    .filter(([regex]) => regex.test(text))
    .map(([, tag]) => tag);

  const categories = [
    ...new Set(
      products.map(product => product.category).filter(Boolean)
    )
  ].filter(category =>
    text.includes(String(category).toLowerCase())
  );

  // Phân tích ngân sách
  const priceMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|củ)\b/i
  );

  let maxPrice = 0;

  if (priceMatch) {
    const number = Number(priceMatch[1].replace(',', '.'));
    const unit = priceMatch[2].toLowerCase();

    maxPrice = ['tr', 'triệu', 'củ'].includes(unit)
      ? number * 1000000
      : number * 1000;
  }

  // Chưa xác định được nhu cầu
  if (!tags.length && !categories.length && !maxPrice) {
    return {
      reply: 'Mình hỗ trợ tư vấn mỹ phẩm và chăm sóc da. Bạn có thể cho mình biết loại da (dầu, khô, hỗn hợp, nhạy cảm), vấn đề muốn cải thiện hoặc ngân sách nhé!',
      ids: []
    };
  }

  // Tìm và chấm điểm sản phẩm
  const recommendations = products
    .filter(product => !maxPrice || getPrice(product) <= maxPrice)
    .map(product => {
      const productTags = Array.isArray(product.tags)
        ? product.tags
        : [];

      const score =
        productTags.filter(tag =>
          tags.includes(String(tag).toLowerCase())
        ).length +
        (categories.some(category =>
          String(category).toLowerCase() ===
          String(product.category).toLowerCase()
        ) ? 2 : 0);

      return { product, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      Number(b.product.sold || 0) -
      Number(a.product.sold || 0)
    )
    .slice(0, 3);

  if (!recommendations.length) {
    return {
      reply:
        'Mình chưa tìm thấy sản phẩm phù hợp' +
        (maxPrice ? ' trong mức ' + formatMoney(maxPrice) : '') +
        '. Bạn thử tăng ngân sách hoặc mô tả nhu cầu khác nhé!',
      ids: []
    };
  }

  return {
    reply: 'Dựa trên nhu cầu của bạn, mình gợi ý các sản phẩm sau:',
    ids: recommendations.map(item => item.product.id),
    tip: TIP
  };
}

// Tư vấn bằng Claude AI
async function adviseByClaude(message, products) {
  const catalog = products.map(product =>
    `${product.id}|${product.name}|${product.category}|${getPrice(product)}đ|${(Array.isArray(product.tags) ? product.tags : []).join(',')}|${product.description || ''}`
  ).join('\n');

  const systemPrompt = `
Bạn là trợ lý tư vấn mỹ phẩm của cửa hàng BeautyGlow AI.

QUY TẮC:
1. Chỉ tư vấn mỹ phẩm và chăm sóc da.
2. Không chẩn đoán bệnh da liễu.
3. Chỉ gợi ý sản phẩm có trong danh mục được cung cấp.
4. Không tự tạo tên sản phẩm, giá bán hoặc mã sản phẩm.
5. Trả lời bằng tiếng Việt, ngắn gọn và thân thiện.
6. Nếu câu hỏi ngoài phạm vi, lịch sự hướng người dùng về chủ đề mỹ phẩm.
7. Chỉ trả về JSON hợp lệ theo định dạng:
{"reply":"Nội dung tư vấn","ids":[]}

DANH MỤC SẢN PHẨM:
${catalog}
`;

  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Claude API lỗi: ${response.status}`);
  }

  const data = await response.json();

  const content = (data.content || [])
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('');

  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Claude trả về dữ liệu không hợp lệ');
  }

  const result = JSON.parse(jsonMatch[0]);

  const validIds = new Set(
    products.map(product => String(product.id))
  );

  const ids = Array.isArray(result.ids)
    ? result.ids.filter(id => validIds.has(String(id))).slice(0, 3)
    : [];

  return {
    reply: String(result.reply || 'Mình chưa có gợi ý phù hợp.'),
    ids,
    tip: TIP
  };
}

// Hàm chính được Backend sử dụng
export async function advise(message, products = []) {
  const text = String(message || '').trim();

  if (!text) {
    return {
      reply: 'Bạn hãy nhập nội dung cần tư vấn nhé!',
      ids: []
    };
  }

  // Ưu tiên Claude AI
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await adviseByClaude(text, products);

      if (result.reply) {
        return result;
      }
    } catch (error) {
      console.error('[BeautyGlow Chatbot]', error.message);
    }
  }

  // Claude không khả dụng: dùng luật dự phòng
  return adviseByRules(text, products);
}
