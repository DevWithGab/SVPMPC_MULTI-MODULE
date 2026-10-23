/* Hindi dapat trusted ang direct/local connections unless mag-opt in ang
deployment. Yung hop count ang naglilimita kung aling forwarded address
gagamitin ng Express para sa req.ip. */
const configureProxy = (app, env = process.env) => {
  const value = env.TRUST_PROXY_HOPS?.trim() || '0';
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
  app.set('trust proxy', Number(value));
};

module.exports = configureProxy;
