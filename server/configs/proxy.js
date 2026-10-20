// Keep direct/local connections untrusted unless the deployment opts in.
// A hop count limits which forwarded address Express uses for req.ip.
const configureProxy = (app, env = process.env) => {
  const value = env.TRUST_PROXY_HOPS?.trim() || '0';
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
  app.set('trust proxy', Number(value));
};

module.exports = configureProxy;
