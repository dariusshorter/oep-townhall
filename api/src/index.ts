import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { isAuthorizedAdmin } from './auth.js';
import { getConfig } from './config.js';
import { badRequest, empty, json, serverError, unauthorized } from './http.js';
import { isRateLimited } from './rateLimit.js';
import {
  createQuestion,
  ensureTables,
  getSettings,
  listQuestions,
  saveSettings,
  updateQuestion
} from './storage.js';
import { escapeCsvValue, validateQuestionText } from './validation.js';

async function readJson(request: HttpRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

app.http('submitQuestion', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'questions',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      const config = getConfig();
      if (Number(request.headers.get('content-length') ?? '0') > 12_000) return badRequest();
      if (config.rateLimitEnabled && isRateLimited('anonymous-submission')) return json({ error: 'Too many requests' }, 429);
      if (config.captchaEnabled) return json({ error: 'Captcha is not configured for this deployment' }, 400);

      await ensureTables();
      const settings = await getSettings();
      if (!settings.submissionsOpen) return json({ error: 'Submissions closed' }, 403);

      const body = await readJson(request);
      const validation = validateQuestionText(body.questionText, config.maxQuestionLength);
      if (!validation.ok || !validation.value) return badRequest();

      await createQuestion(validation.value);
      return json({ ok: true });
    } catch (error) {
      context.error(error);
      return serverError();
    }
  }
});

app.http('publicSettings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'public/settings',
  handler: async () => json(await getSettings())
});

app.http('adminListQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/questions',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    const filters = Object.fromEntries(request.query.entries());
    const questions = await listQuestions(filters);
    const countsByStatus = ['New', 'Reviewed', 'Selected', 'Answered', 'Duplicate', 'Archived'].map((status) => ({
      status,
      count: questions.filter((question) => question.status === status).length
    }));
    return json({ questions, total: questions.length, countsByStatus });
  }
});

app.http('adminUpdateQuestion', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'manage/questions/{id}',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    const body = await readJson(request);
    return json(await updateQuestion(request.params.id, body));
  }
});

app.http('adminSettings', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'settings',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    const body = await readJson(request);
    return json(
      await saveSettings({
        submissionsOpen: typeof body.submissionsOpen === 'boolean' ? body.submissionsOpen : undefined,
        townHallName: typeof body.townHallName === 'string' ? body.townHallName : undefined,
        landingPrompt: typeof body.landingPrompt === 'string' ? body.landingPrompt : undefined,
        successMessage: typeof body.successMessage === 'string' ? body.successMessage : undefined
      })
    );
  }
});

app.http('presenterQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'presenter/questions',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    const questions = (await listQuestions({ selected: 'true' })).filter((question) => !question.archived && !question.moderationFlag);
    return json({ questions });
  }
});

app.http('presenterAnswered', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'presenter/questions/{id}/answered',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    return json(await updateQuestion(request.params.id, { isAnswered: true, status: 'Answered' }));
  }
});

app.http('adminExport', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/export',
  handler: async (request: HttpRequest) => {
    if (!isAuthorizedAdmin(request)) return unauthorized();
    const questions = await listQuestions({});
    const headers = [
      'Question ID',
      'Question Text',
      'Submitted Date and Time',
      'Status',
      'Category',
      'Internal Notes',
      'Is Answered',
      'Selected for Presentation',
      'Archived',
      'Moderation Flag',
      'Town Hall Name'
    ];
    const rows = questions.map((question) => [
      question.id,
      question.questionText,
      question.submittedUtc,
      question.status,
      question.category,
      question.internalNotes,
      question.isAnswered,
      question.selectedForPresentation,
      question.archived,
      question.moderationFlag,
      question.townHallName
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
    return {
      status: 200,
      body: `\uFEFF${csv}`,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="OEP-Town-Hall-Questions.csv"',
        'Cache-Control': 'no-store'
      }
    };
  }
});

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => empty()
});
