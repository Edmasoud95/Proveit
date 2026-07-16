import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderForm } from './ProviderForm';
import type { ProviderFormValues } from '../../hooks/useProviders';

const baseForm: ProviderFormValues = {
  name: 'LM Studio',
  endpointUrl: 'http://localhost:1234/v1',
  apiKey: '',
  model: '',
};

function renderForm(over: Partial<Parameters<typeof ProviderForm>[0]> = {}) {
  const props = {
    form: baseForm,
    setForm: vi.fn(),
    formModels: [] as string[],
    fetchingModels: false,
    editing: false,
    saving: false,
    onFetchModels: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
  render(<ProviderForm {...props} />);
  return props;
}

describe('ProviderForm', () => {
  it('renders create mode with the form values', () => {
    renderForm();
    expect(screen.getByText('New provider')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LM Studio')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://localhost:1234/v1')).toBeInTheDocument();
    expect(screen.getByText('Add provider')).toBeInTheDocument();
  });

  it('renders edit mode labels', () => {
    renderForm({ editing: true });
    expect(screen.getByText('Edit provider')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('lists fetched models and selects one on click', () => {
    const props = renderForm({ formModels: ['model-a', 'model-b'] });
    fireEvent.click(screen.getByText('model-b'));
    expect(props.setForm).toHaveBeenCalled();
  });

  it('disables Load models until an endpoint is set', () => {
    renderForm({ form: { ...baseForm, endpointUrl: '' } });
    expect(screen.getByRole('button', { name: /load/i })).toBeDisabled();
  });

  it('wires save and cancel', () => {
    const props = renderForm();
    fireEvent.click(screen.getByRole('button', { name: /add provider/i }));
    expect(props.onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
