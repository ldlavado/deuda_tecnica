const test = require('node:test');
const assert = require('node:assert');
const Money = require('../src/domain/Money');
const ProcessBillingUseCase = require('../src/application/ProcessBillingUseCase');

class InMemoryRepo {
  constructor() {
    this.subs = {
      sub_101: { id: 'sub_101', amount: 299.99, country: 'CO', plan: 'ENTERPRISE', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD', billingCycle: 'MONTHLY' },
      sub_102: { id: 'sub_102', amount: 99, country: 'MX', plan: 'PRO', status: 'ACTIVE', paymentMethod: 'CREDIT_CARD' }
    };
    this.billed = new Set();
  }
  async findById(id) { return this.subs[id] || null; }
  async wasBilledInPeriod(id, key) { return this.billed.has(id + key); }
  async markBilled(id, data) { this.billed.add(id + data.periodKey); }
  async getAll() { return Object.values(this.subs); }
}

class MockGateway {
  async charge() {
    return { success: true, transactionReference: 'TX_TEST_123' };
  }
}

test('Money: fromDecimal and operations avoid float bugs', () => {
  const a = Money.fromDecimal(0.1);
  const b = Money.fromDecimal(0.2);
  assert.strictEqual(a.add(b).toDecimal(), 0.3);
});

test('ProcessBillingUseCase: cobro exitoso CO con promo', async () => {
  const repo = new InMemoryRepo();
  const uc = new ProcessBillingUseCase(repo, new MockGateway());
  const result = await uc.execute('sub_101', { promoCode: 'FAST2026' });
  assert.strictEqual(result.success, true);
  assert.ok(result.breakdown.finalTotal > 300);
  assert.strictEqual(result.breakdown.discount, 30);
});

test('ProcessBillingUseCase: idempotencia bloquea segundo cobro en el mismo período', async () => {
  const repo = new InMemoryRepo();
  const uc = new ProcessBillingUseCase(repo, new MockGateway());
  const first = await uc.execute('sub_101', {});
  assert.strictEqual(first.success, true);
  const second = await uc.execute('sub_101', {});
  assert.strictEqual(second.success, false);
  assert.strictEqual(second.code, 'ALREADY_BILLED');
});

test('ProcessBillingUseCase: suscripción no encontrada', async () => {
  const uc = new ProcessBillingUseCase(new InMemoryRepo(), new MockGateway());
  const result = await uc.execute('no-existe', {});
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.code, 'ERR_SUB_NOT_FOUND');
});
