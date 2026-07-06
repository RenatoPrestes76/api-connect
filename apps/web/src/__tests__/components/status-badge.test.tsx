import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/common/status-badge';

describe('StatusBadge', () => {
  it('renders status text', () => {
    render(<StatusBadge status="RUNNING" />);
    expect(screen.getByText('RUNNING')).toBeDefined();
  });

  it('renders a dot by default', () => {
    const { container } = render(<StatusBadge status="RUNNING" />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toBeTruthy();
  });

  it('hides dot when dot=false', () => {
    const { container } = render(<StatusBadge status="RUNNING" dot={false} />);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('applies correct classes for RUNNING status', () => {
    const { container } = render(<StatusBadge status="RUNNING" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('emerald');
  });

  it('applies correct classes for ERROR status', () => {
    const { container } = render(<StatusBadge status="ERROR" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('rose');
  });

  it('applies correct classes for UNKNOWN status', () => {
    const { container } = render(<StatusBadge status="UNKNOWN_X" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('slate');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="RUNNING" className="test-class" />);
    expect((container.firstChild as HTMLElement).className).toContain('test-class');
  });
});
