import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.jsx';
import { params, gestures } from '../lib/__tests__/helpers.js';

/** A small stateful fake of the server's account / learning / admin API. */
function fakeServer() {
  const state = { user: null, calls: [] };
  const lesson = { id: 1, slug: 'social-1', unit: 'First conversations', title: 'First conversations 1', description: 'Greetings.', level: 'beginner', position: 0, total: 3, learned: 0, studied: 0, completed: false, bestScore: null };
  const signs = gestures.filter((g) => ['HELLO', 'THANK YOU', 'PLEASE'].includes(g.gloss)).map(({ flat, ...g }) => ({ ...g, progress: null }));
  const users = { 'lee@example.com': { id: 2, email: 'lee@example.com', name: 'Lee', role: 'user' }, 'ada@example.com': { id: 1, email: 'ada@example.com', name: 'Ada', role: 'admin' } };
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const handler = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = String(url).replace(/^\/api/, '').split('?')[0];
    state.calls.push({ method, path, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null });
    if (path === '/parameters') return json(params);
    if (path === '/gestures') return json({ gestures: gestures.map(({ flat, ...g }) => g) });
    if (path === '/config') return json({ ai: { sentence: false, concepts: false }, stt: { server: false } });
    if (path === '/settings') return json({ settings: { siteTitle: 'SignSense', tagline: 't', announcement: 'Welcome to the new course!', registrationOpen: true, learningEnabled: true, feedbackEnabled: true } });
    if (path === '/auth/me') return json({ user: state.user });
    if (path === '/auth/login' && method === 'POST') {
      const { email } = JSON.parse(init.body);
      state.user = users[email] ?? null;
      return state.user ? json({ user: state.user }) : json({ error: 'That email and password don’t match an account.' }, 401);
    }
    if (path === '/learn/lessons') return json({ lessons: [lesson], dueCount: 0 });
    if (path === '/learn/report') return json({ totals: { studied: 0, learned: 0, mastered: 0, due: 0, correct: 0, wrong: 0, accuracy: null, streak: 0 }, units: [], tests: [], weakest: [] });
    if (path === '/learn/lessons/1') return json({ lesson, signs, passMark: 0.8 });
    if (/^\/learn\/signs\/\d+\/studied$/.test(path)) return json({ ok: true });
    if (path === '/learn/tests' && method === 'POST') {
      return json({ id: 9, kind: 'lesson', lessonId: 1, questions: [{ type: 'recognize', prompt: 'Which sign is this?', signForm: signs[0].signForm, options: [{ label: 'PLEASE' }, { label: 'HELLO' }, { label: 'THANK YOU' }] }] }, 201);
    }
    if (path === '/learn/tests/9/answer') return json({ correct: JSON.parse(init.body).choice === 1, answer: 1, gloss: 'HELLO', gestureId: signs[0].id, signForm: signs[0].signForm });
    if (path === '/learn/tests/9/submit') return json({ score: 1, total: 1, passed: true, passMark: 0.8, results: [{ correct: true, answer: 1, chosen: 1, gloss: 'HELLO' }] });
    if (path === '/admin/overview') {
      return json({ users: { total: 2, admins: 1, disabled: 0 }, signs: [{ source: 'asl-lex', n: 2280, reviewed: 0 }], feedback: [{ status: 'new', n: 3 }], learning: { tests30: 4, active7: 2, lessons: 30, avg_score: 0.75 }, perDay: [], missed: [], reported: [{ gloss: 'WATER', gesture_id: 7, n: 2, open: 1 }] });
    }
    if (path === '/admin/reports/learners') return json({ learners: [] });
    return json({ error: 'not found' }, 404);
  };
  return { state, handler };
}

let server;
function mountAt(path) {
  window.history.pushState({}, '', path);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><App /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  server = fakeServer();
  vi.stubGlobal('fetch', vi.fn(server.handler));
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.pushState({}, '', '/'); });

describe('accounts and learning', () => {
  it('asks a signed-out visitor to sign in before learning; the translator needs no account', async () => {
    mountAt('/learn');
    expect(await screen.findByRole('heading', { name: 'Sign in to start learning' })).toBeTruthy();
    expect(screen.getByText('Welcome to the new course!')).toBeTruthy(); // admin announcement banner
    expect(screen.queryByRole('link', { name: /Admin/ })).toBeNull();
  });

  it('a learner signs in (with the CSRF header) and lands on their lessons', async () => {
    mountAt('/login');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'lee@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'learner-pass-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('First conversations 1')).toBeTruthy();
    const login = server.state.calls.find((c) => c.path === '/auth/login');
    expect(login.headers['x-requested-with']).toBe('SignSense');
    expect(window.location.pathname).toBe('/learn');
    expect(screen.queryByRole('link', { name: /Admin/ })).toBeNull(); // learners don't see the dashboard
  });

  it('shows a clear error for a wrong password', async () => {
    mountAt('/login');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'nobody@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'whatever-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/don’t match/);
  });

  it('a test gives instant feedback per answer, then a score', async () => {
    server.state.user = { id: 2, email: 'lee@example.com', name: 'Lee', role: 'user' };
    mountAt('/learn/1/test');
    expect(await screen.findByRole('heading', { name: 'Which sign is this?' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /HELLO/ }));
    expect((await screen.findByText(/Correct!/))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See my score' }));
    expect(await screen.findByText('100%')).toBeTruthy();
    expect(screen.getByText(/Lesson complete/)).toBeTruthy();
  });

  it('an administrator signs in and reaches the dashboard', async () => {
    mountAt('/login');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'admin-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeTruthy();
    expect(window.location.pathname).toBe('/admin');
    const nav = screen.getByRole('navigation', { name: 'Dashboard' });
    for (const tab of ['Signs', 'Lessons', 'Feedback', 'Users', 'Site settings', 'Activity log']) expect(within(nav).getByText(tab)).toBeTruthy();
    expect(screen.getByText('WATER')).toBeTruthy(); // most-reported signs
  });

  it('a learner cannot open the dashboard', async () => {
    server.state.user = { id: 2, email: 'lee@example.com', name: 'Lee', role: 'user' };
    mountAt('/admin');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Administrators only' })).toBeTruthy());
  });
});
