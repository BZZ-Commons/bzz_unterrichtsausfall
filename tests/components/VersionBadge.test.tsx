import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionBadge from '@/components/VersionBadge';
import { APP_VERSION, CHANGELOG } from '@/src/lib/version';

describe('VersionBadge', () => {
  it('shows the current version, prefixed with "v"', () => {
    render(<VersionBadge />);
    expect(screen.getByRole('button', { name: `v${APP_VERSION}` })).toHaveTextContent(
      `v${APP_VERSION}`,
    );
  });

  it('opens the changelog dialog on click and lists every version', () => {
    render(<VersionBadge />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `v${APP_VERSION}` }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    for (const entry of CHANGELOG) {
      expect(screen.getByText(`Version ${entry.version}`)).toBeInTheDocument();
    }
    // The newest entry's first change note is rendered.
    expect(screen.getByText(CHANGELOG[0].changes[0])).toBeInTheDocument();
  });

  it('closes the dialog on Escape', () => {
    render(<VersionBadge />);
    fireEvent.click(screen.getByRole('button', { name: `v${APP_VERSION}` }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog via the close button', () => {
    render(<VersionBadge />);
    fireEvent.click(screen.getByRole('button', { name: `v${APP_VERSION}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('version changelog data', () => {
  it('APP_VERSION matches the newest changelog entry', () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version);
  });

  it('is ordered newest-first by date', () => {
    const dates = CHANGELOG.map((e) => e.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('every entry has at least one change note', () => {
    for (const entry of CHANGELOG) {
      expect(entry.changes.length).toBeGreaterThan(0);
    }
  });
});
