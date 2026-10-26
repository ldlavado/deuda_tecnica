const fs = require('fs').promises;
const path = require('path');

/**
 * Adaptador de repositorio basado en archivo JSON con control de concurrencia simple.
 */
class FileSubscriptionRepository {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../../../data/subscriptions.json');
    this._lock = Promise.resolve();
  }

  async _withLock(fn) {
    const prev = this._lock;
    let release;
    this._lock = new Promise(resolve => { release = resolve; });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async findById(id) {
    return this._withLock(async () => {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const subs = JSON.parse(raw);
      return subs.find(s => s.id === id) || null;
    });
  }

  async wasBilledInPeriod(id, periodKey) {
    const sub = await this.findById(id);
    return sub && sub.lastPeriodKey === periodKey;
  }

  async markBilled(id, data) {
    return this._withLock(async () => {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const subs = JSON.parse(raw);
      const idx = subs.findIndex(s => s.id === id);
      if (idx === -1) return;
      subs[idx].balance = (subs[idx].balance || 0) + data.finalTotal;
      subs[idx].lastBilledAt = data.lastBilledAt;
      subs[idx].lastTransactionRef = data.transactionRef;
      subs[idx].lastPeriodKey = data.periodKey;
      await fs.writeFile(this.filePath, JSON.stringify(subs, null, 2));
    });
  }

  async getAll() {
    return this._withLock(async () => {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    });
  }
}

module.exports = FileSubscriptionRepository;
