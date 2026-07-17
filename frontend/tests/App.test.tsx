import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  });
}

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  window.history.pushState({}, '', '/');
});

describe('public submission page', () => {
  it('renders the required anonymous prompt', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        submissionsOpen: true,
        townHallName: 'OEP Strategy Town Hall',
        landingPrompt: 'Please let us know what questions you would like to ask of Origin Exterior Partners.',
        successMessage: 'Thank you. Your question has been submitted anonymously.'
      })
    );
    render(<App />);
    expect(await screen.findByText(/Please let us know what questions/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('prevents double-click submission while processing', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({ submissionsOpen: true, townHallName: 'OEP Strategy Town Hall', landingPrompt: 'Please let us know what questions you would like to ask of Origin Exterior Partners.', successMessage: 'Thank you. Your question has been submitted anonymously.' }))
      .mockReturnValueOnce(jsonResponse({ ok: true }));

    render(<App />);
    const textArea = await screen.findByLabelText('Question');
    await userEvent.type(textArea, 'How will OEP support acquired brands?');
    const button = screen.getByRole('button', { name: /submit question/i });
    await userEvent.dblClick(button);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a failure message on API failure', async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse({ submissionsOpen: true, townHallName: 'OEP Strategy Town Hall', landingPrompt: 'Please let us know what questions you would like to ask of Origin Exterior Partners.', successMessage: 'Thank you. Your question has been submitted anonymously.' }))
      .mockReturnValueOnce(jsonResponse({ error: 'failed' }, 500));

    render(<App />);
    await userEvent.type(await screen.findByLabelText('Question'), 'What happens next?');
    await userEvent.click(screen.getByRole('button', { name: /submit question/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We were unable to submit your question. Please try again.');
  });
});

describe('protected views', () => {
  it('renders unauthorized guidance', () => {
    window.history.pushState({}, '', '/unauthorized');
    render(<App />);
    expect(screen.getByText(/Access not authorized/i)).toBeInTheDocument();
  });

  it('renders presenter filtering result', async () => {
    window.history.pushState({}, '', '/present');
    fetchMock.mockReturnValueOnce(jsonResponse({ questions: [{ id: '1', questionText: 'Selected question?', submittedUtc: new Date().toISOString(), status: 'Selected', category: '', internalNotes: '', isAnswered: false, townHallName: 'OEP Strategy Town Hall', selectedForPresentation: true, archived: false, moderationFlag: false }] }));
    render(<App />);
    expect(await screen.findByText('Selected question?')).toBeInTheDocument();
  });
});
