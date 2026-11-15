/**
 * CouponEngine — 优惠券规则引擎（纯逻辑，无 UI 依赖）
 *
 * 券结构:
 * {
 *   code, name, type: "flat" | "percent" | "shipping",
 *   minSpend, value,          // flat: 立减金额; percent: 折扣%; shipping 忽略
 *   cap,                      // percent: 封顶金额
 *   start, end,               // ISO 日期字符串
 *   category,                 // "" 表示全品类
 *   stackable, stock, used
 * }
 */
class CouponEngine {
  constructor(coupons = []) {
    this.coupons = coupons;
  }

  add(coupon) {
    if (this.coupons.some(c => c.code === coupon.code)) {
      throw new Error(`优惠码 ${coupon.code} 已存在`);
    }
    this.coupons.push({ used: 0, ...coupon });
    return coupon;
  }

  find(code) {
    return this.coupons.find(c => c.code.toUpperCase() === String(code).toUpperCase());
  }

  /** 校验券是否可用，返回 { ok, reason } */
  validate(coupon, cart, now = new Date()) {
    if (!coupon) return { ok: false, reason: "优惠码不存在" };
    if (coupon.used >= coupon.stock) return { ok: false, reason: "优惠券已被领完" };
    const start = new Date(coupon.start), end = new Date(coupon.end + "T23:59:59");
    if (now < start) return { ok: false, reason: "优惠券尚未生效" };
    if (now > end) return { ok: false, reason: "优惠券已过期" };

    const eligible = this._eligibleSubtotal(coupon, cart);
    if (eligible <= 0 && coupon.category) {
      return { ok: false, reason: `购物车中没有「${coupon.category}」品类商品` };
    }
    if (coupon.type !== "shipping" && eligible < coupon.minSpend) {
      return { ok: false, reason: `未满足门槛：适用品类金额需满 ¥${coupon.minSpend}` };
    }
    return { ok: true, eligible };
  }

  /** 计算单张券的优惠金额 */
  discountOf(coupon, cart, shippingFee = 0) {
    if (coupon.type === "shipping") return shippingFee; // 免运费券抵扣运费
    const eligible = this._eligibleSubtotal(coupon, cart);
    if (coupon.type === "flat") return Math.min(coupon.value, eligible);
    if (coupon.type === "percent") {
      const raw = eligible * coupon.value / 100;
      return Math.min(raw, coupon.cap || Infinity, eligible);
    }
    return 0;
  }

  /**
   * 自动选择最优券组合（考虑叠加规则），返回 { coupons, totalDiscount }
   * 策略：非叠加券取单张最大优惠；可叠加券全部叠加，二者取优。
   */
  bestCombination(cart, shippingFee = 0) {
    const usable = this.coupons.filter(c => this.validate(c, cart).ok);
    if (!usable.length) return { coupons: [], totalDiscount: 0 };

    const stackables = usable.filter(c => c.stackable);
    const nonStackables = usable.filter(c => !c.stackable);

    // 方案一：全部可叠加券
    const stackDiscount = stackables.reduce((s, c) => s + this.discountOf(c, cart, shippingFee), 0);
    // 方案二：最优单张不可叠加券 + 可叠加券
    let bestSingle = null, bestSingleVal = 0;
    for (const c of nonStackables) {
      const v = this.discountOf(c, cart, shippingFee);
      if (v > bestSingleVal) { bestSingleVal = v; bestSingle = c; }
    }

    const comboA = { coupons: stackables, totalDiscount: stackDiscount };
    const comboB = bestSingle
      ? { coupons: [bestSingle, ...stackables], totalDiscount: bestSingleVal + stackDiscount }
      : comboA;

    const best = comboB.totalDiscount >= comboA.totalDiscount ? comboB : comboA;

    // 免运费券在折扣券之后单独生效，总额不超过商品金额 + 运费
    const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
    best.totalDiscount = Math.min(best.totalDiscount, subtotal + shippingFee);
    return best;
  }

  /** 核销：标记一张券已使用 */
  redeem(code) {
    const c = this.find(code);
    if (!c) throw new Error("优惠码不存在");
    if (c.used >= c.stock) throw new Error("优惠券已被领完");
    c.used += 1;
    return c;
  }

  _eligibleSubtotal(coupon, cart) {
    return cart
      .filter(it => !coupon.category || it.category === coupon.category)
      .reduce((s, it) => s + it.price * it.qty, 0);
  }
}

window.CouponEngine = CouponEngine;
