import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; ClassSelector calls it on keyboard nav.
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}
