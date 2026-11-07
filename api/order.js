// Vercel serverless funksiya — buyurtmani Telegram guruhiga yuboradi.
// Kerakli Environment Variables (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  — bot tokeni
//   TELEGRAM_CHAT_ID    — guruh yoki kanal ID si (masalan -1004325663257)

// Do'konlar uchun avtomatik chegirma (foizda). index.html dagi DISCOUNT bilan bir xil bo'lsin.
const DISCOUNT = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT  = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT) {
    console.error("Telegram env variables not set");
    return res.status(500).json({ error: "Not configured" });
  }

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const name   = String(b.name   || "").slice(0, 120);
    const phone  = String(b.phone  || "").slice(0, 40);
    const region = String(b.region || "").slice(0, 80);
    const branch = String(b.branch || "").slice(0, 200);
    const note    = String(b.note || "").slice(0, 500);
    const pay     = b.pay === "hozir" ? "hozir" : "keyin";
    const receipt = typeof b.receipt === "string" ? b.receipt : "";
    const items  = Array.isArray(b.items) ? b.items.slice(0, 30) : [];

    if (!name || !phone || !items.length) {
      return res.status(400).json({ error: "Bad request" });
    }

    const money = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let base = 0, total = 0;
    const lines = items.map(i => {
      const qty = Math.max(1, Math.min(9999, parseInt(i.qty, 10) || 1));
      const price = parseInt(i.price, 10) || 0;
      const dprice = Math.round(price * (100 - DISCOUNT) / 100);
      base += qty * price;
      total += qty * dprice;
      return `• ${esc(i.title)} × ${qty} — ${money(qty * dprice)}`;
    });

    const when = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });

    const text =
      "🏷 <b>SABO NASHR</b>\n🆕 <b>YANGI BUYURTMA (sayt)</b>\n\n" +
      `👤 <b>${esc(name)}</b>\n` +
      `📞 ${esc(phone)}\n` +
      `📍 ${esc(region)}\n` +
      (branch ? `🏤 ${esc(branch)}\n` : "") +
      "\n📚 <b>Kitoblar:</b>\n" + lines.join("\n") +
      `\n\nChegirmasiz: ${money(base)}` +
      `\n🏷 Do'kon chegirmasi ${DISCOUNT}%: −${money(base - total)}` +
      `\n💰 <b>Jami: ${money(total)}</b>` +
      "\n<i>(yetkazib berish alohida)</i>" +
      (note ? `\n\n📝 <b>Izoh:</b> ${esc(note)}` : "") +
      (pay === "hozir"
        ? (receipt ? "\n\n✅ <b>TO'LANGAN — chek biriktirilgan</b>"
                   : "\n\n🟡 <b>To'layman dedi, lekin chek yuklamagan</b>")
        : "\n\n💳 <b>To'lov:</b> menejer bilan kelishiladi") +
      `\n\n🕒 ${when}`;

    const tg = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: "HTML" })
    });

    if (!tg.ok) {
      const detail = await tg.text();
      console.error("Telegram error:", detail);
      return res.status(502).json({ error: "Telegram failed" });
    }

    // chek surati bo'lsa — alohida rasm qilib yuboramiz
    if (pay === "hozir" && receipt.startsWith("data:image/")) {
      try {
        const base64 = receipt.split(",")[1] || "";
        const bytes = Buffer.from(base64, "base64");
        if (bytes.length > 0 && bytes.length < 9 * 1024 * 1024) {
          const fd = new FormData();
          fd.append("chat_id", String(CHAT));
          fd.append("caption", `🧾 To'lov cheki — ${esc(name)} (${esc(phone)})`);
          fd.append("parse_mode", "HTML");
          fd.append("photo", new Blob([bytes], { type: "image/jpeg" }), "chek.jpg");
          const ph = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
            method: "POST", body: fd
          });
          if (!ph.ok) console.error("sendPhoto failed:", await ph.text());
        }
      } catch (e) { console.error("receipt error:", e); }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
