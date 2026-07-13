module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const enabled = !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.CRON_SECRET
  );
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ enabled, publicKey: enabled ? process.env.VAPID_PUBLIC_KEY : "" });
};
