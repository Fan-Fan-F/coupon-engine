# CouponEngine · 优惠券规则引擎

电商优惠券系统的核心规则引擎 + 可视化演示，零依赖原生 JS。
`engine.js` 为纯逻辑层（无 UI 依赖，可直接用于 Node/浏览器），`app.js` 为演示界面。

## 规则能力

- 三种券型：**满减券**（满 X 减 Y）、**折扣券**（按比例 + 封顶金额）、**免运费券**
- 校验链：有效期 → 库存余量 → 品类限制 → 门槛金额
- 品类定向券（仅数码/家居/服饰等生效）
- 叠加规则：可叠加券自由组合，不可叠加券互斥
- **最优组合推荐**：自动计算「全部可叠加券」与「最优单张 + 可叠加券」两种方案取优
- 核销与撤回（库存联动）
- 优惠总额封顶保护（不超过商品金额 + 运费）

## 引擎 API

```js
const engine = new CouponEngine();
engine.add({ code, name, type, minSpend, value, cap, start, end, category, stackable, stock });
engine.validate(coupon, cart);          // { ok, reason }
engine.discountOf(coupon, cart, fee);   // 单券优惠金额
engine.bestCombination(cart, fee);      // { coupons, totalDiscount }
engine.redeem(code);                    // 核销
```

cart 结构：`[{ name, category, price, qty }]`

## 运行

浏览器直接打开 `index.html`，预置券 `WELCOME20`（8 折封顶 60）、`FREESHIP`（免运费）。

## License

MIT
