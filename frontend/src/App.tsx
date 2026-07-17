import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  Download,
  Flag,
  ListFilter,
  Lock,
  Maximize2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck
} from 'lucide-react';
import {
  getPresenterQuestions,
  getSettings,
  listQuestions,
  markPresentedAnswered,
  statusOptions,
  submitQuestion,
  updateQuestion,
  updateSettings
} from './api';
import type { QuestionFilters } from './api';
import type { QuestionStatus, TownHallQuestion, TownHallSettings } from './types';

const defaultSettings: TownHallSettings = {
  submissionsOpen: true,
  townHallName: 'OEP Strategy Town Hall',
  landingPrompt: 'Please let us know what questions you would like to ask of Origin Exterior Partners.',
  successMessage: 'Thank you. Your question has been submitted anonymously.'
};

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Origin Exterior Partners home">
        <img src="/logo-placeholder.svg" alt="Origin Exterior Partners" />
      </a>
      <nav aria-label="Primary navigation">
        <a href="/privacy">Privacy</a>
      </nav>
    </header>
  );
}

function PublicForm() {
  const [settings, setSettings] = useState(defaultSettings);
  const [questionText, setQuestionText] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(defaultSettings));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    try {
      await submitQuestion(questionText);
      setQuestionText('');
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="public-page">
      <section className="question-panel" aria-labelledby="question-heading">
        <div>
          <p className="eyebrow">{settings.townHallName}</p>
          <h1 id="question-heading">{settings.landingPrompt}</h1>
          <p className="anonymity">
            Your submission is anonymous. Please do not include your name, company, location, or other
            identifying information unless you choose to do so.
          </p>
        </div>

        {!settings.submissionsOpen ? (
          <div className="notice" role="status">
            Question submissions are currently closed. Thank you for participating.
          </div>
        ) : state === 'success' ? (
          <div className="success-state" role="status">
            <CheckCircle2 aria-hidden="true" />
            <p>{settings.successMessage}</p>
            <button className="secondary-button" type="button" onClick={() => setState('idle')}>
              Submit Another Question
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="question-form">
            <label htmlFor="questionText">Question</label>
            <textarea
              id="questionText"
              value={questionText}
              minLength={5}
              maxLength={2000}
              required
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="Type your question here"
            />
            <div className="form-footer">
              <span>{questionText.length}/2,000</span>
              <button type="submit" disabled={state === 'submitting' || questionText.trim().length < 5}>
                <Send aria-hidden="true" />
                {state === 'submitting' ? 'Submitting' : 'Submit Question'}
              </button>
            </div>
            {state === 'error' && (
              <p className="error" role="alert">
                We were unable to submit your question. Please try again.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}

function Privacy() {
  return (
    <main className="content-page">
      <h1>Privacy Notice</h1>
      <p>
        This question portal does not ask for or intentionally store your name, email address, company,
        location, Microsoft account, device identifier, browser fingerprint, or other identifying details.
      </p>
      <p>
        Questions are stored as plain text for OEP administrators to review for the town hall. Please do not
        include identifying information in your question unless you choose to do so.
      </p>
    </main>
  );
}

function Admin() {
  const [filters, setFilters] = useState<QuestionFilters>({});
  const [data, setData] = useState<TownHallQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);

  async function refresh() {
    setLoading(true);
    try {
      const [questionResponse, settingsResponse] = await Promise.all([listQuestions(filters), getSettings()]);
      setData(questionResponse.questions);
      setTotal(questionResponse.total);
      setCounts(Object.fromEntries(questionResponse.countsByStatus.map((item) => [item.status, item.count])));
      setSettings(settingsResponse);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [filters.status, filters.isAnswered, filters.selected, filters.duplicates]);

  async function saveQuestion(id: string, changes: Partial<TownHallQuestion>) {
    const updated = await updateQuestion(id, changes);
    setData((items) => items.map((item) => (item.id === id ? updated : item)));
  }

  async function saveSettings(changes: Partial<TownHallSettings>) {
    setSettings(await updateSettings(changes));
  }

  return (
    <main className="admin-page">
      <section className="admin-toolbar" aria-label="Question filters">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Town hall questions</h1>
          <p>{total} total submissions</p>
        </div>
        <div className="toolbar-actions">
          <a className="icon-button" href="/api/admin/export" aria-label="Download CSV">
            <Download aria-hidden="true" />
          </a>
          <button className="icon-button" type="button" onClick={refresh} aria-label="Refresh questions">
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="settings-strip" aria-label="Town hall settings">
        <label>
          <span>Submissions</span>
          <select
            value={settings.submissionsOpen ? 'open' : 'closed'}
            onChange={(event) => saveSettings({ submissionsOpen: event.target.value === 'open' })}
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          <span>Town hall name</span>
          <input value={settings.townHallName} onChange={(event) => saveSettings({ townHallName: event.target.value })} />
        </label>
        <label>
          <span>Landing prompt</span>
          <input value={settings.landingPrompt} onChange={(event) => saveSettings({ landingPrompt: event.target.value })} />
        </label>
        <label>
          <span>Success message</span>
          <input value={settings.successMessage} onChange={(event) => saveSettings({ successMessage: event.target.value })} />
        </label>
      </section>

      <section className="filter-grid">
        <label>
          <Search aria-hidden="true" />
          <span className="sr-only">Search question text</span>
          <input
            value={filters.search ?? ''}
            placeholder="Search questions"
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') refresh();
            }}
          />
        </label>
        <label>
          <ListFilter aria-hidden="true" />
          <span className="sr-only">Filter by status</span>
          <select value={filters.status ?? ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <select aria-label="Filter by answered status" value={filters.isAnswered ?? ''} onChange={(event) => setFilters((current) => ({ ...current, isAnswered: event.target.value }))}>
          <option value="">Answered and unanswered</option>
          <option value="true">Answered</option>
          <option value="false">Unanswered</option>
        </select>
        <select aria-label="Filter by selected status" value={filters.selected ?? ''} onChange={(event) => setFilters((current) => ({ ...current, selected: event.target.value }))}>
          <option value="">Selected and not selected</option>
          <option value="true">Selected</option>
          <option value="false">Not selected</option>
        </select>
        <label className="checkbox-filter">
          <input type="checkbox" checked={Boolean(filters.duplicates)} onChange={(event) => setFilters((current) => ({ ...current, duplicates: event.target.checked }))} />
          Possible duplicates
        </label>
      </section>

      <section className="status-counts" aria-label="Counts by status">
        {statusOptions.map((status) => (
          <div key={status}>
            <strong>{counts[status] ?? 0}</strong>
            <span>{status}</span>
          </div>
        ))}
      </section>

      <section className="question-list" aria-busy={loading}>
        {data.map((question) => (
          <article key={question.id} className={question.archived ? 'question-card archived' : 'question-card'}>
            <div className="question-meta">
              <span>{new Date(question.submittedUtc).toLocaleString()}</span>
              {question.duplicateCandidate && <span>Possible duplicate</span>}
              {question.moderationFlag && <span>Flagged</span>}
            </div>
            <p>{question.questionText}</p>
            <div className="question-controls">
              <select value={question.status} aria-label="Update status" onChange={(event) => saveQuestion(question.id, { status: event.target.value as QuestionStatus })}>
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <input aria-label="Category" value={question.category} placeholder="Category" onBlur={(event) => saveQuestion(question.id, { category: event.target.value })} onChange={(event) => setData((items) => items.map((item) => (item.id === question.id ? { ...item, category: event.target.value } : item)))} />
              <button type="button" className={question.selectedForPresentation ? 'selected' : ''} onClick={() => saveQuestion(question.id, { selectedForPresentation: !question.selectedForPresentation, status: !question.selectedForPresentation ? 'Selected' : question.status })}>
                Select
              </button>
              <button type="button" onClick={() => saveQuestion(question.id, { isAnswered: !question.isAnswered, status: !question.isAnswered ? 'Answered' : question.status })}>
                Answered
              </button>
              <button type="button" aria-label="Flag inappropriate question" onClick={() => saveQuestion(question.id, { moderationFlag: !question.moderationFlag })}>
                <Flag aria-hidden="true" />
              </button>
              <button type="button" aria-label={question.archived ? 'Restore question' : 'Archive question'} onClick={() => saveQuestion(question.id, { archived: !question.archived, status: question.archived ? 'Reviewed' : 'Archived' })}>
                <ArchiveRestore aria-hidden="true" />
              </button>
            </div>
            <textarea aria-label="Internal notes" value={question.internalNotes} placeholder="Internal notes" onBlur={(event) => saveQuestion(question.id, { internalNotes: event.target.value })} onChange={(event) => setData((items) => items.map((item) => (item.id === question.id ? { ...item, internalNotes: event.target.value } : item)))} />
          </article>
        ))}
      </section>
    </main>
  );
}

function Presenter() {
  const [questions, setQuestions] = useState<TownHallQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const current = questions[index];

  async function refresh() {
    const response = await getPresenterQuestions();
    setQuestions(response.questions);
    setIndex(0);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="presenter-page">
      <div className="presenter-bar">
        <span>{questions.length ? `${index + 1} of ${questions.length}` : 'No selected questions'}</span>
        <div>
          <button type="button" onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>
            <Maximize2 aria-hidden="true" />
            Full Screen
          </button>
        </div>
      </div>
      <section className="presenter-card" aria-live="polite">
        <p>{current?.questionText ?? 'No questions have been selected for presentation.'}</p>
      </section>
      <div className="presenter-controls">
        <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
          Previous
        </button>
        <button type="button" disabled={!current} onClick={() => current && markPresentedAnswered(current.id).then(refresh)}>
          Mark Answered
        </button>
        <button type="button" disabled={index >= questions.length - 1} onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>
          Next
        </button>
      </div>
    </main>
  );
}

function Unauthorized() {
  const adminLoginUrl = '/.auth/login/aad?post_login_redirect_uri=/admin';

  return (
    <main className="content-page centered">
      <Lock aria-hidden="true" className="large-icon" />
      <h1>Access not authorized</h1>
      <p>Please sign in with an approved OEP administrator account.</p>
      <a className="primary-link-button" href={adminLoginUrl}>
        Sign in to admin
      </a>
    </main>
  );
}

export function App() {
  const path = window.location.pathname;
  const page = useMemo(() => {
    if (path === '/privacy') return <Privacy />;
    if (path === '/admin') return <Admin />;
    if (path === '/present') return <Presenter />;
    if (path === '/unauthorized') return <Unauthorized />;
    return <PublicForm />;
  }, [path]);

  return (
    <>
      {path !== '/present' && <Header />}
      {page}
      {path !== '/present' && (
        <footer>
          <ShieldCheck aria-hidden="true" />
          <span>Anonymous public submission. Administrative access is restricted to approved OEP accounts.</span>
        </footer>
      )}
    </>
  );
}
