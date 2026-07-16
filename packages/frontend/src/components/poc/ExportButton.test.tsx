import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportMenu } from './ExportButton';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    blob: async () => new Blob(['x'], { type: 'text/plain' }),
    headers: { get: () => null },
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:x'),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function openMenu() {
  render(<ExportMenu pocId="poc-1" />);
  fireEvent.click(screen.getByRole('button', { name: /export/i }));
}

describe('ExportMenu', () => {
  it('opens on click and lists the three export formats', () => {
    openMenu();
    expect(screen.getByRole('menuitem', { name: /plan for coding agent/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /promptfoo config/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /raw json/i })).toBeInTheDocument();
  });

  it('downloads plan.md and closes the menu', async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /plan for coding agent/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pocs/poc-1/export/plan'));
    expect(screen.queryByRole('menuitem', { name: /raw json/i })).not.toBeInTheDocument();
  });

  it('downloads the promptfoo config', async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /promptfoo config/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/pocs/poc-1/evals/export/promptfoo'),
    );
  });

  it('downloads the raw JSON export', async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /raw json/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pocs/poc-1/export'));
  });

  it('closes on Escape', () => {
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: /raw json/i })).not.toBeInTheDocument();
  });
});
