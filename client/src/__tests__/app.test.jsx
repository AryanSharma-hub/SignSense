import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.jsx';
import { params, gestures } from '../lib/__tests__/helpers.js';

const routes = {
  '/api/parameters': params,
  '/api/gestures': { gestures: gestures.map(({ flat, ...g }) => g) },
  '/api/config': { ai: { sentence: false, concepts: false }, stt: { server: false } },
};

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><App /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const body = routes[url];
    return { ok: !!body, status: body ? 200 : 404, json: async () => body ?? { error: 'nope' } };
  }));
  window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SignSense app (integration, real seed data)', () => {
  it('loads the vocabulary and renders the stage, transcript and reply controls', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'SignSense' })).toBeTruthy();
    await screen.findByRole('region', { name: 'Signer' });
    expect(screen.getByRole('region', { name: 'Signer' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Conversation' })).toBeTruthy();
    expect(screen.getByLabelText(/Other person: speak or type/)).toBeTruthy();
    // the data-accuracy caveat is visible, not buried
    expect(screen.getByText(/Sign data · not yet reviewed/)).toBeTruthy();
  });

  it('Direction A: build a sign, get suggestions, add to sentence, say it into the conversation', async () => {
    mount();
    await screen.findByRole('region', { name: 'Signer' }); // the translator is ready once the library loads

    // Precise controls (the accessible fallback): pick location + handshape + movement.
    fireEvent.click(screen.getByText('Precise controls'));
    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forehead' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Hands' }));
    fireEvent.click(screen.getByRole('button', { name: /5 \(open hand\)/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Movement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Straight (repeated)' }));

    // FATHER (ASL-LEX): thumb of a 5-hand tapping the forehead; MOTHER differs only by location (chin).
    const suggestions = screen.getByRole('region', { name: 'Suggested signs' });
    await waitFor(() => expect(within(suggestions).getByText('FATHER')).toBeTruthy());
    const glosses = [...suggestions.querySelectorAll('.gloss')].map((n) => n.textContent);
    expect(glosses.indexOf('FATHER')).toBeLessThan(glosses.indexOf('MOTHER'));
    expect(within(suggestions).getAllByText('Exact match').length).toBeGreaterThan(0);

    fireEvent.click(within(suggestions).getAllByRole('button', { name: 'Add' })[0]);
    const sentence = screen.getByRole('region', { name: 'Your sentence' });
    expect(within(sentence).getByText('FATHER')).toBeTruthy();
    await waitFor(() => expect(sentence.querySelector('textarea').value).toBe('Father.'));

    fireEvent.click(within(sentence).getByRole('button', { name: /Add to conversation|Say it/ }));
    const convo = screen.getByRole('region', { name: 'Conversation' });
    expect(within(convo).getByText(/You signed/)).toBeTruthy();
    expect(within(convo).getByText('Father.')).toBeTruthy();
  });

  it('tapping a body part on the signer opens all its options beside the figure', async () => {
    mount();
    await screen.findByRole('region', { name: 'Signer' }); // the translator is ready once the library loads
    const stage = screen.getByRole('region', { name: 'Signer' });
    const panel = within(stage).getByRole('complementary', { name: 'Body part options' });

    // Face -> every facial expression
    fireEvent.keyDown(within(stage).getByRole('button', { name: /^Face — choose an expression\. Drag/ }), { key: 'Enter' });
    for (const e of params.expressions) expect(within(panel).getByRole('button', { name: new RegExp(e.label) })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: /Raised brow/ }));

    // Right hand -> handshapes; right arm -> movements; body -> locations (with dots on the figure)
    fireEvent.keyDown(within(stage).getByRole('button', { name: /^Right hand — choose a handshape\. Drag/ }), { key: 'Enter' });
    fireEvent.click(within(panel).getByRole('button', { name: /5 \(open hand\)/ }));
    fireEvent.keyDown(within(stage).getByRole('button', { name: /^Right arm — choose a movement/ }), { key: 'Enter' });
    expect(within(panel).getByRole('button', { name: /Small up-tap/ })).toBeTruthy();
    fireEvent.keyDown(within(stage).getByRole('button', { name: /^Body — choose where/ }), { key: 'Enter' });
    expect(within(stage).getByRole('button', { name: 'Location: Forehead' })).toBeTruthy();

    // the choices land in the step being built
    const steps = screen.getByRole('region', { name: 'Sign steps' });
    expect(within(steps).getByText('Raised brow')).toBeTruthy();
    expect(within(steps).getByText(/R · 5 \(open hand\)/)).toBeTruthy();
  });

  it('Direction B: a typed reply becomes signs, with unmatched words shown explicitly', async () => {
    mount();
    await screen.findByRole('region', { name: 'Signer' }); // the translator is ready once the library loads
    const input = screen.getByLabelText(/Other person: speak or type/);
    fireEvent.change(input, { target: { value: 'Do you want some water or a quinoa?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const convo = screen.getByRole('region', { name: 'Conversation' });
    await waitFor(() => expect(within(convo).getByText(/They said/)).toBeTruthy());
    const chips = [...convo.querySelectorAll('.gloss')].map((n) => n.textContent);
    expect(chips).toEqual(['YOU', 'WANT', 'WATER']);
    expect(within(convo).getByText(/No sign available for: quinoa/)).toBeTruthy();
    expect(within(convo).getByText(/Face and head: raised brow/)).toBeTruthy();   // question marker
    // the stage is performing this turn; Direction A steps back
    await waitFor(() => expect(screen.getByRole('region', { name: 'Signer' }).textContent).toMatch(/Signing/));
  });

  it('Direction B: no matches -> nothing performed, explicit message', async () => {
    mount();
    await screen.findByRole('region', { name: 'Signer' }); // the translator is ready once the library loads
    const input = screen.getByLabelText(/Other person: speak or type/);
    fireEvent.change(input, { target: { value: 'the quinoa or the gazebo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const convo = screen.getByRole('region', { name: 'Conversation' });
    await waitFor(() => expect(within(convo).getByText(/None of these words have a sign/)).toBeTruthy());
  });
});
