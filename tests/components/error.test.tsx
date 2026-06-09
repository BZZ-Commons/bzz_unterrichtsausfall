import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from '@/app/error';

describe('app/error.tsx (Error Boundary fallback)', () => {
  beforeEach(() => {
    // The component console.errors the error in an effect — keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the German fallback and the error message', () => {
    render(<ErrorPage error={new Error('Boom')} reset={() => {}} />);
    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('calls reset() when the retry button is clicked', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('Boom')} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
