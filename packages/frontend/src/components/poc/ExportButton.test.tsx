import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportButton, PromptfooExportButton } from './ExportButton';

function mockDownload(contentType: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    blob: async () => new Blob(['x'], { type: contentType }),
    headers: { get: () => null },
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:x'),
    revokeObjectURL: vi.fn(),
  });
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('export buttons', () => {
  it('ExportButton downloads the JSON export', async () => {
    const fetchMock = mockDownload('application/json');
    render(<ExportButton pocId="poc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /export json/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pocs/poc-1/export'));
  });

  it('PromptfooExportButton downloads the promptfoo config', async () => {
    const fetchMock = mockDownload('text/yaml');
    render(<PromptfooExportButton pocId="poc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /promptfoo/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/pocs/poc-1/evals/export/promptfoo'),
    );
  });
});
