import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClassSelector from '@/components/ClassSelector';
import type { UntisClass } from '@/src/types';

const classes: UntisClass[] = [
  { id: 1, name: 'IA23 a', longName: 'Informatik', active: true },
  { id: 2, name: 'ME23 a', longName: 'Mediamatik', active: true, companionNames: ['AB23 a'] },
];

// The pill now holds three buttons (‹ prev, the dropdown trigger, next ›);
// the trigger is the one carrying the "Klasse auswählen" label.
const trigger = () => screen.getByRole('button', { name: 'Klasse auswählen' });

function open() {
  return userEvent.setup().click(trigger());
}

describe('ClassSelector — combobox accessibility', () => {
  it('exposes combobox/listbox/option roles with the expected ARIA wiring', async () => {
    render(<ClassSelector classes={classes} selectedId={null} onChange={() => {}} />);
    await open();

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', 'class-selector-listbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    expect(screen.getByRole('listbox')).toHaveAttribute('id', 'class-selector-listbox');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('id', 'class-option-1');
    expect(options[1]).toHaveAttribute('id', 'class-option-2');
  });

  it('tracks the highlighted option via aria-activedescendant on arrow navigation', async () => {
    const user = userEvent.setup();
    render(<ClassSelector classes={classes} selectedId={null} onChange={() => {}} />);
    await user.click(trigger());

    const input = screen.getByRole('combobox');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    input.focus();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'class-option-1');

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'class-option-2');
  });

  it('calls onChange with the class id when an option is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ClassSelector classes={classes} selectedId={null} onChange={onChange} />);
    await user.click(trigger());

    await user.click(screen.getByRole('option', { name: /ME23 a/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('ClassSelector — prev/next arrows', () => {
  it('steps to the neighbouring class, wrapping around at both ends', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ClassSelector classes={classes} selectedId={1} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Nächste Klasse' }));
    expect(onChange).toHaveBeenLastCalledWith(2);

    await user.click(screen.getByRole('button', { name: 'Vorherige Klasse' }));
    expect(onChange).toHaveBeenLastCalledWith(2); // id 1 → wraps to last (id 2)
  });

  it('with nothing selected, › picks the first class and ‹ the last', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ClassSelector classes={classes} selectedId={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Nächste Klasse' }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Vorherige Klasse' }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });
});
