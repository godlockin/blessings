import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('base', 'active')).toBe('base active');
  });

  it('should handle conditional classes', () => {
    const condition1 = true;
    const condition2 = false;
    expect(cn('base', condition1 && 'conditional')).toBe('base conditional');
    expect(cn('base', condition2 && 'conditional')).toBe('base');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('class name merging', () => {
  it('should handle complex conditional logic', () => {
    const isActive = true;
    const isDisabled = false;
    const size = 'lg' as 'lg' | 'sm';

    const result = cn(
      'base',
      isActive && 'active',
      isDisabled && 'disabled',
      size === 'lg' && 'lg-size'
    );

    expect(result).toBe('base active lg-size');
  });
});
