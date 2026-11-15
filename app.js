// CouponEngine 演示应用
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => "¥" + n.toFixed(2);

  // 模拟购物车
  const CART = [
    { name: "机械键盘 87 键", category: "数码", price: 329, qty: 1 },
    { name: "陶瓷马克杯", category: "家居", price: 49, qty: 2 },
    { name: "连帽卫衣", category: "服饰", price: 159, qty: 1 },
  ];

  const engine = new CouponEngine();
  const applied = [];

  // 预置两张演示券
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const nextMonth = new Date(today.getTime() + 30 * 864e5);
  engine.add({
    code: "WELCOME20", name: "全场 8 折券（封顶 ¥60）", type: "percent",
    minSpend: 100, value: 20, cap: 60,
    start: iso(today), end: iso(nextMonth), category: "", stackable: false, stock: 500,
  });
  engine.add({
    code: "FREESHIP", name: "免运费券", type: "shipping",
    minSpend: 0, value: 0, cap: 0,
    start: iso(today), end: iso(nextMonth), category: "", stackable: true, stock: 1000,
  });

  /* ---------- 创建券 ---------- */
  $("#cStart").value = iso(today);
  $("#cEnd").value = iso(nextMonth);

  $("#cType").addEventListener("change", () => {
    const t = $("#cType").value;
    $("#flatValueRow").hidden = t !== "flat";
    $("#percentValueRow").hidden = t !== "percent";
    $("#capRow").hidden = t !== "percent";
  });

  $("#createBtn").addEventListener("click", () => {
    const type = $("#cType").value;
    try {
      engine.add({
        code: $("#cCode").value.trim().toUpperCase() || "CODE" + Date.now() % 10000,
        name: $("#cName").value.trim() || "未命名券",
        type,
        minSpend: +$("#cMinSpend").value || 0,
        value: type === "percent" ? +$("#cPercent").value : +$("#cValue").value,
        cap: type === "percent" ? +$("#cCap").value : 0,
        start: $("#cStart").value, end: $("#cEnd").value,
        category: $("#cCategory").value,
        stackable: $("#cStackable").checked,
        stock: Math.max(1, +$("#cStock").value || 1),
      });
      renderCoupons();
      msg("✅ 创建成功，可在结算台用码使用");
    } catch (err) {
      msg("⚠️ " + err.message);
    }
  });

  /* ---------- 券池渲染 ---------- */
  function typeDesc(c) {
    if (c.type === "flat") return `满 ¥${c.minSpend} 减 ¥${c.value}`;
    if (c.type === "percent") return `${(10 - c.value / 10).toFixed(1)} 折（满 ¥${c.minSpend}，封顶 ¥${c.cap}）`;
    return "免运费";
  }

  function renderCoupons() {
    $("#couponCount").textContent = engine.coupons.length;
    const now = new Date();
    $("#couponList").innerHTML = engine.coupons.map(c => {
      const expired = now > new Date(c.end + "T23:59:59");
      return `<div class="coupon ${expired ? "expired" : ""}">
        <div>
          <div class="c-name">${c.name}</div>
          <div class="c-meta">${typeDesc(c)} · ${c.category || "全品类"} · ${c.start} ~ ${c.end}${c.stackable ? " · 可叠加" : ""}</div>
        </div>
        <div class="c-right">
          <span class="c-code">${c.code}</span>
          <div class="c-stock">剩 ${c.stock - c.used} / ${c.stock}</div>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------- 结算台 ---------- */
  function renderCart() {
    $("#cartSim").innerHTML = CART.map(it =>
      `<div class="cart-row">
        <span class="nm">${it.name}</span>
        <span class="cat-tag">${it.category}</span>
        <span>${fmt(it.price)} × ${it.qty}</span>
      </div>`).join("");
  }

  function recalc() {
    const shippingFee = +$("#shipFee").value || 0;
    const subtotal = CART.reduce((s, it) => s + it.price * it.qty, 0);

    // 引擎自动推荐最优组合
    const best = engine.bestCombination(CART, shippingFee);
    const autoCodes = new Set(best.coupons.map(c => c.code));

    // 手动用券优先；未手动选择的采用自动推荐
    const manual = applied.map(code => engine.find(code)).filter(Boolean);
    const finalCoupons = manual.length ? manual : best.coupons;

    let discount = 0;
    const rows = [];
    for (const c of finalCoupons) {
      const v = engine.validate(c, CART);
      if (!v.ok) { msg(`⚠️ ${c.code}：${v.reason}`); continue; }
      const d = engine.discountOf(c, CART, shippingFee);
      discount += d;
      rows.push([`${c.name}（${c.code}）`, "-" + fmt(d)]);
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    $("#calcRows").innerHTML =
      `<div class="calc-row"><span>商品金额</span><span>${fmt(subtotal)}</span></div>
       <div class="calc-row"><span>运费</span><span>${fmt(shippingFee)}</span></div>` +
      rows.map(([k, v]) => `<div class="calc-row"><span>${k}</span><span class="neg">${v}</span></div>`).join("");
    $("#grandTotal").textContent = fmt(total);

    if (!manual.length && best.coupons.length) {
      msg(`💡 引擎已自动匹配最优组合：${best.coupons.map(c => c.code).join(" + ")}`);
    }
  }

  $("#redeemBtn").addEventListener("click", () => {
    const code = $("#redeemCode").value.trim().toUpperCase();
    if (!code) return;
    const coupon = engine.find(code);
    const v = engine.validate(coupon, CART);
    if (!v.ok) { msg("⚠️ " + v.reason); return; }
    if (applied.includes(coupon.code)) { msg("⚠️ 该券已在用"); return; }
    // 不可叠加检查
    if (!coupon.stackable && applied.some(cd => !engine.find(cd).stackable)) {
      msg("⚠️ 不可叠加：已有不可叠加券在用");
      return;
    }
    engine.redeem(code);
    applied.push(coupon.code);
    $("#redeemCode").value = "";
    renderApplied();
    renderCoupons();
    recalc();
    msg(`✅ ${coupon.code} 核销成功，优惠 ${fmt(engine.discountOf(coupon, CART, +$("#shipFee").value || 0))}`);
  });

  function renderApplied() {
    $("#appliedList").innerHTML = applied.map(code => {
      const c = engine.find(code);
      return `<div class="applied-item"><span>🎟️ ${c.name}</span><button data-rm="${code}">移除</button></div>`;
    }).join("");
  }

  $("#appliedList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rm]");
    if (!btn) return;
    const c = engine.find(btn.dataset.rm);
    c.used = Math.max(0, c.used - 1);
    applied.splice(applied.indexOf(c.code), 1);
    renderApplied(); renderCoupons(); recalc();
  });

  $("#shipFee").addEventListener("input", recalc);

  function msg(text) { $("#engineMsg").textContent = text; }

  renderCoupons();
  renderCart();
  recalc();
})();
