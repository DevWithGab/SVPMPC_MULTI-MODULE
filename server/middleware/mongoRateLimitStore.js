const mongoose = require('mongoose');
const { createHash } = require('node:crypto');

const COLLECTION = 'rate_limit_counters';
const operationOptions = { maxTimeMS: 3000, writeConcern: { w: 'majority', wtimeoutMS: 3000 } };
const getCollection = () => {
  if (mongoose.connection.readyState !== 1) throw new Error('Database is disconnected');
  return mongoose.connection.db.collection(COLLECTION);
};

/* Tinatawag ito after connecting at before accepting HTTP traffic. Yung TTL
cleanup lang: bucket keys ang nagde-determine ng expiration kahit late
mag-delete ng rows ang MongoDB. */
const ensureRateLimitIndexes = async (collection = getCollection()) => {
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rate_limit_expiry' });
};

class MongoRateLimitStore {
  constructor({ prefix, collection = getCollection, now = Date.now }) {
    this.prefix = `${prefix}:`;
    this.localKeys = false;
    this.collection = collection;
    this.now = now;
  }

  init({ windowMs }) {
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0) throw new Error('Invalid rate-limit window');
    this.windowMs = windowMs;
  }

  /* I-capture yung window sa key na ginagamit ng express-rate-limit. Kung
  matapos ang successful request mamaya, puwede lang nitong i-decrement
  yung original window niya, hindi yung bagong window ng ibang request.
  Hash muna ang IPs/account identifiers bago i-store. */
  key(identifier) {
    const expiresAt = (Math.floor(this.now() / this.windowMs) + 1) * this.windowMs;
    const digest = createHash('sha256').update(String(identifier)).digest('hex');
    return `${expiresAt}:${digest}`;
  }

  entry(key) {
    if (!/^\d+:[a-f0-9]{64}$/.test(key)) throw new Error('Invalid rate-limit key');
    return { _id: `${this.prefix}${this.windowMs}:${key}`, expiresAt: new Date(Number(key.split(':')[0])) };
  }

  async run(operation) {
    try {
      return await operation(this.collection());
    } catch {
      // Never fall back to per-process counters or expose database errors.
      const error = new Error('Request protection is temporarily unavailable. Please try again shortly.');
      error.statusCode = 503;
      error.isOperational = true;
      throw error;
    }
  }

  async increment(key) {
    const { _id, expiresAt } = this.entry(key);
    return this.run(async collection => {
      const update = { $inc: { totalHits: 1 }, $setOnInsert: { expiresAt } };
      const options = { ...operationOptions, returnDocument: 'after', includeResultMetadata: false };
      let row;
      try {
        row = await collection.findOneAndUpdate({ _id }, update, { ...options, upsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Another instance may have inserted this bucket concurrently.
        row = await collection.findOneAndUpdate({ _id }, update, options);
      }
      if (!row) throw new Error('Rate-limit counter missing');
      return { totalHits: row.totalHits, resetTime: row.expiresAt };
    });
  }

  async decrement(key) {
    const { _id } = this.entry(key);
    /* Tumatakbo ito after matapos na ang successful response. Kung bumagsak
    ang database nung oras na, mas conservative option na i-retain lang
    yung hit. Hindi dapat mag-reject ng unawaited response-finish callback
    sa limiter. */
    await this.run(collection => collection.updateOne({ _id, totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } }, operationOptions))
      .catch(() => console.error('Unable to release a successful request from the shared rate-limit counter.'));
  }

  async resetKey(key) {
    const { _id } = this.entry(key);
    await this.run(collection => collection.deleteOne({ _id }, operationOptions));
  }

  async get(key) {
    const { _id, expiresAt } = this.entry(key);
    if (expiresAt.getTime() <= this.now()) return undefined;
    return this.run(async collection => {
      const row = await collection.findOne({ _id }, { maxTimeMS: 3000 });
      return row ? { totalHits: row.totalHits, resetTime: row.expiresAt } : undefined;
    });
  }
}

module.exports = { MongoRateLimitStore, ensureRateLimitIndexes };
