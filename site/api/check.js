// POST /api/check with x-password -> 200 if it unlocks, 401 if not. No model call.
const { access } = require("./_lib");
module.exports = async (req, res) => {
  const a = await access(req);
  res.setHeader("Cache-Control", "no-store");
  if (a.ok) return res.status(200).json({ ok: true, kind: a.kind });
  if (a.unpaid) return res.status(402).json({ error: "That password's payment hasn't gone through yet." });
  return res.status(401).json({ error: "That password didn't match." });
};
