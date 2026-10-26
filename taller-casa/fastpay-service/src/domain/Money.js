/**
 * Value Object Money - elimina Primitive Obsession y bugs de coma flotante.
 * Opera internamente con centavos enteros.
 */
class Money {
  constructor(amountInCents, currency = 'USD') {
    if (!Number.isInteger(amountInCents)) {
      throw new Error('Money must be constructed from integer cents');
    }
    this.amountInCents = amountInCents;
    this.currency = currency;
  }

  static fromDecimal(decimal, currency = 'USD') {
    return new Money(Math.round(Number(decimal) * 100), currency);
  }

  static zero(currency = 'USD') {
    return new Money(0, currency);
  }

  add(other) {
    this._assertSameCurrency(other);
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  subtract(other) {
    this._assertSameCurrency(other);
    return new Money(this.amountInCents - other.amountInCents, this.currency);
  }

  multiply(factor) {
    return new Money(Math.round(this.amountInCents * factor), this.currency);
  }

  toDecimal() {
    return this.amountInCents / 100;
  }

  toString() {
    return `$${this.toDecimal().toFixed(2)} ${this.currency}`;
  }

  _assertSameCurrency(other) {
    if (this.currency !== other.currency) {
      throw new Error('Currency mismatch');
    }
  }
}

module.exports = Money;
