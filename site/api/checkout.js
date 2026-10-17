// POST /api/checkout -> { clientSecret } for Stripe embedded Checkout. One price, once.
// No webhook (account at its endpoint cap): the password is minted here, shown on the
// return page once paid (api/session-status), and printed in the invoice footer.
// metadata.product + metadata.handler let the shared stripe-router route this session.
const { SITE, PRODUCT, TOOL, stripe, newPassword } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { nonce, password } = newPassword();
    const b = typeof req.body === "object" && req.body ? req.body : {};
    const token = /^[a-z0-9]{6,16}$/.test(b.token || "") ? b.token : "";
    const name = `${TOOL.name}: unlimited runs`;
    const s = await stripe("checkout/sessions", {
      method: "POST",
      form: {
        ui_mode: "embedded_page",
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(TOOL.price_usd * 100),
        "line_items[0][price_data][product_data][name]": name,
        "line_items[0][price_data][product_data][description]": TOOL.checkout_line,
        "payment_method_types[0]": "card",
        "payment_method_types[1]": "link",
        customer_creation: "always",
        "invoice_creation[enabled]": "true",
        "invoice_creation[invoice_data][description]": name,
        "invoice_creation[invoice_data][custom_fields][0][name]": "Password",
        "invoice_creation[invoice_data][custom_fields][0][value]": password,
        "invoice_creation[invoice_data][footer]": `Your password: ${password}. Open the tool at ${SITE}/?pw=${password}. Brick & Mortar · aidan@brickandmortar.dev`,
        "invoice_creation[invoice_data][metadata][product]": PRODUCT,
        "metadata[product]": PRODUCT,
        "metadata[site]": SITE,
        "metadata[handler]": `${SITE}/api/session-status`,
        "metadata[pw_nonce]": nonce,
        "metadata[password]": password,
        "metadata[token]": token,
        "payment_intent_data[metadata][product]": PRODUCT,
        "payment_intent_data[metadata][pw_nonce]": nonce,
        "payment_intent_data[description]": name,
        return_url: `${SITE}/${token ? `for/${token}/` : ""}?paid={CHECKOUT_SESSION_ID}`,
      },
    });
    res.status(200).json({ clientSecret: s.client_secret });
  } catch (e) {
    console.error("[checkout]", e.message);
    res.status(502).json({ error: "Checkout could not start. Please try again in a minute." });
  }
};
