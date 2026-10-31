import { describe, expect, it } from 'vitest';
import { nounForms, substitution } from './naming.ts';

describe('naming', () => {
  it('pluralizes like the monolith', () => {
    expect(nounForms('review').plural.kebab).toBe('reviews');
    expect(nounForms('category').plural.kebab).toBe('categories');
    expect(nounForms('box').plural.kebab).toBe('boxes');
    expect(nounForms('person', 'people').plural.pascal).toBe('People');
  });

  it('renames every form of sample-items, plural before singular', () => {
    const { singular, plural } = nounForms('payment-method');
    const rename = substitution(singular, plural);
    expect(
      rename(
        "sampleItems sampleItem SampleItems SampleItem sample-items sample-item sample_items SAMPLE_ITEM 'Sample items' 'sample item'",
      ),
    ).toBe(
      "paymentMethods paymentMethod PaymentMethods PaymentMethod payment-methods payment-method payment_methods PAYMENT_METHOD 'Payment methods' 'payment method'",
    );
  });

  it('refuses bad nouns', () => {
    expect(() => nounForms('Review')).toThrow('kebab-case');
    expect(() => nounForms('sheep')).not.toThrow();
    expect(() => nounForms('fish', 'fish')).toThrow('differ');
    expect(() => nounForms('default')).toThrow('reserved');
  });
});
