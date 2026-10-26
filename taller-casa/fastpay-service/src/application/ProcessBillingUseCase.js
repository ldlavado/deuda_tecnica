const Money = require('../domain/Money');

/**
 * Caso de uso ProcessBilling - orquesta cobro desacoplado de infraestructura.
 * Incluye idempotencia básica por período.
 */
class ProcessBillingUseCase {
  constructor(subscriptionRepository, paymentGateway) {
    this.subscriptionRepository = subscriptionRepository;
    this.paymentGateway = paymentGateway;
  }

  async execute(subscriptionId, options = {}) {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return { success: false, code: 'ERR_SUB_NOT_FOUND', msg: 'Suscripcion no existe' };
    }

    if (subscription.status !== 'ACTIVE' && !(options.forceRetry && subscription.status === 'SUSPENDED')) {
      return { success: false, code: subscription.status === 'SUSPENDED' ? 'ERR_SUSPENDED' : 'ERR_INACTIVE' };
    }

    const periodKey = `${subscriptionId}-${new Date().toISOString().slice(0, 7)}`; // YYYY-MM
    if (await this.subscriptionRepository.wasBilledInPeriod(subscriptionId, periodKey)) {
      return { success: false, code: 'ALREADY_BILLED', msg: 'Ya facturado en este período' };
    }

    const base = Money.fromDecimal(subscription.amount);
    let discount = Money.zero();
    if (subscription.plan === 'ENTERPRISE_PLUS' && subscription.billingCycle === 'ANNUAL') {
      discount = base.multiply(0.15);
    } else if (options.promoCode === 'FAST2026' && subscription.plan === 'ENTERPRISE') {
      discount = Money.fromDecimal(30);
    }

    const taxable = base.subtract(discount);
    const taxRate = this._getTaxRate(subscription.country);
    const taxes = taxable.multiply(taxRate);
    const surcharge = this._getSurcharge(subscription);
    const finalTotal = taxable.add(taxes).add(surcharge);

    const chargeResult = await this.paymentGateway.charge({
      amount: finalTotal,
      subscriptionId,
      customerEmail: subscription.customerEmail
    });

    if (chargeResult.success) {
      await this.subscriptionRepository.markBilled(subscriptionId, {
        periodKey,
        transactionRef: chargeResult.transactionReference,
        finalTotal: finalTotal.toDecimal(),
        lastBilledAt: new Date().toISOString()
      });
    }

    return {
      success: chargeResult.success,
      code: chargeResult.success ? 'BILLING_PROCESSED' : 'GATEWAY_TIMEOUT',
      subId: subscriptionId,
      customer: subscription.customerEmail,
      breakdown: {
        baseAmount: base.toDecimal(),
        discount: discount.toDecimal(),
        taxes: taxes.toDecimal(),
        surcharge: surcharge.toDecimal(),
        finalTotal: finalTotal.toDecimal()
      },
      transactionReference: chargeResult.transactionReference
    };
  }

  _getTaxRate(country) {
    const rates = { CO: 0.19, MX: 0.16, AR: 0.56, US: 0.0825 };
    return rates[country] || 0.10;
  }

  _getSurcharge(sub) {
    if (sub.country === 'CO' && sub.amount > 200) return Money.fromDecimal(4.5);
    if (sub.country === 'MX' && sub.paymentMethod === 'WIRE_TRANSFER') return Money.fromDecimal(8.0);
    if (sub.country === 'AR') return Money.fromDecimal(12.5);
    return Money.zero();
  }
}

module.exports = ProcessBillingUseCase;
