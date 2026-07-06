import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders text', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label')).toBeDefined();
  });

  it('applies default variant', () => {
    const { container } = render(<Badge>X</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('slate');
  });

  it('applies primary variant', () => {
    const { container } = render(<Badge variant="primary">X</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('indigo');
  });

  it('applies danger variant', () => {
    const { container } = render(<Badge variant="danger">X</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('rose');
  });

  it('applies success variant', () => {
    const { container } = render(<Badge variant="success">X</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('emerald');
  });

  it('merges custom className', () => {
    const { container } = render(<Badge className="custom">X</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain('custom');
  });
});
