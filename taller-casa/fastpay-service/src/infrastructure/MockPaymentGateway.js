/**
 * Adaptador mock de pasarela de pago.
 * Lee la clave desde variable de entorno.
 */
class MockPaymentGateway {
  constructor() {
    this.apiKey = process.env.PAYMENT_GATEWAY_API_KEY || 'sk_test_mock_secret_key_12345';
  }

  async charge({ amount, subscriptionId, customerEmail }) {
    const transactionReference = `TX_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      success: true,
      transactionReference,
      amount: amount.toDecimal ? amount.toDecimal() : amount
    };
  }
}

module.exports = MockPaymentGateway;
