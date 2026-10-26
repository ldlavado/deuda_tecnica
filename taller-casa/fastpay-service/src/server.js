/**
 * Servidor Express desacoplado - usa Arquitectura Hexagonal.
 */
const express = require('express');
const ProcessBillingUseCase = require('./application/ProcessBillingUseCase');
const FileSubscriptionRepository = require('./infrastructure/FileSubscriptionRepository');
const MockPaymentGateway = require('./infrastructure/MockPaymentGateway');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const repo = new FileSubscriptionRepository();
const gateway = new MockPaymentGateway();
const billingUseCase = new ProcessBillingUseCase(repo, gateway);

app.get('/health', (req, res) => {
  res.json({
    service: 'fastpay-billing-service',
    version: '2.0.0-hexagonal',
    status: 'HEALTHY'
  });
});

app.get('/api/subscriptions', async (req, res) => {
  try {
    const data = await repo.getAll();
    res.json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/subscriptions/:id/bill', async (req, res) => {
  try {
    const result = await billingUseCase.execute(req.params.id, req.body || {});
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_BILLING_FAILURE' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`FastPay Hexagonal listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
