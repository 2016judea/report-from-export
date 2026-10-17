// GET /api/session-status?session_id=cs_... -> { paid, email, password? }
// With no webhook, the return page IS the delivery: once Stripe says this session paid,
// its password comes back here (only to whoever holds the session id Stripe redirected
// with) and the same password is in the Stripe invoice footer.
const { stripe, unlocked, PRODUCT } = require("./_lib");

module.exports = async (req, res) => {
  const id = String(req.query.session_id || "");
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: "bad session id" });
  try {
    const s = await stripe(`checkout/sessions/${id}`);
    if (s.metadata?.product !== PRODUCT) return res.status(404).json({ error: "not found" });
    const paid = unlocked(s);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({ paid, email: s.customer_details?.email || null, ...(paid ? { password: s.metadata.password } : {}) });
  } catch (e) {
    console.error("[status]", e.message);
    res.status(502).json({ error: "Could not check the payment. Refresh in a minute." });
  }
};
