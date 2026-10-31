import { describe, expect, it } from 'vitest';
import { EditSampleItemForm, SampleItemForm } from './forms';

describe('sample item forms', () => {
  it('trims and defaults', () => {
    expect(SampleItemForm.parse({ name: '  Lamp  ' })).toEqual({ name: 'Lamp', description: '' });
  });

  it('refuses an empty or long name, and an edit without an id', () => {
    expect(SampleItemForm.safeParse({ name: ' ' }).success).toBe(false);
    expect(SampleItemForm.safeParse({ name: 'x'.repeat(201) }).success).toBe(false);
    expect(EditSampleItemForm.safeParse({ name: 'Lamp' }).success).toBe(false);
  });
});
