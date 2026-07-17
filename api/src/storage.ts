import { AzureNamedKeyCredential, TableClient, TableEntity } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { questionFingerprint } from './validation.js';

export type QuestionStatus = 'New' | 'Reviewed' | 'Selected' | 'Answered' | 'Duplicate' | 'Archived';

export interface QuestionRecord {
  partitionKey: string;
  rowKey: string;
  QuestionText: string;
  SubmittedUtc: string;
  Status: QuestionStatus;
  Category: string;
  InternalNotes: string;
  IsAnswered: boolean;
  TownHallName: string;
  SelectedForPresentation: boolean;
  Archived: boolean;
  ModerationFlag: boolean;
  QuestionFingerprint: string;
}

export interface QuestionDto {
  id: string;
  questionText: string;
  submittedUtc: string;
  status: QuestionStatus;
  category: string;
  internalNotes: string;
  isAnswered: boolean;
  townHallName: string;
  selectedForPresentation: boolean;
  archived: boolean;
  moderationFlag: boolean;
  duplicateCandidate?: boolean;
}

export interface TownHallSettings {
  submissionsOpen: boolean;
  townHallName: string;
  landingPrompt: string;
  successMessage: string;
}

const defaultSettings: TownHallSettings = {
  submissionsOpen: true,
  townHallName: getConfig().townHallName,
  landingPrompt: 'Please let us know what questions you would like to ask of Origin Exterior Partners.',
  successMessage: 'Thank you. Your question has been submitted anonymously.'
};

const memoryQuestions = new Map<string, QuestionRecord>();
let memorySettings = { ...defaultSettings };

function getTableClient(tableName: string): TableClient | null {
  const config = getConfig();
  if (!config.storageAccountName) return null;

  if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
    return TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, tableName);
  }

  if (process.env.AZURE_STORAGE_ACCOUNT_KEY) {
    const credential = new AzureNamedKeyCredential(config.storageAccountName, process.env.AZURE_STORAGE_ACCOUNT_KEY);
    return new TableClient(`https://${config.storageAccountName}.table.core.windows.net`, tableName, credential);
  }

  return new TableClient(`https://${config.storageAccountName}.table.core.windows.net`, tableName, new DefaultAzureCredential());
}

function toDto(record: QuestionRecord, duplicateCandidate = false): QuestionDto {
  return {
    id: record.rowKey,
    questionText: record.QuestionText,
    submittedUtc: record.SubmittedUtc,
    status: record.Status,
    category: record.Category,
    internalNotes: record.InternalNotes,
    isAnswered: record.IsAnswered,
    townHallName: record.TownHallName,
    selectedForPresentation: record.SelectedForPresentation,
    archived: record.Archived,
    moderationFlag: record.ModerationFlag,
    duplicateCandidate
  };
}

function fromEntity(entity: TableEntity<QuestionRecord>): QuestionRecord {
  return {
    partitionKey: entity.partitionKey!,
    rowKey: entity.rowKey!,
    QuestionText: entity.QuestionText,
    SubmittedUtc: entity.SubmittedUtc,
    Status: entity.Status,
    Category: entity.Category,
    InternalNotes: entity.InternalNotes,
    IsAnswered: entity.IsAnswered,
    TownHallName: entity.TownHallName,
    SelectedForPresentation: entity.SelectedForPresentation,
    Archived: entity.Archived,
    ModerationFlag: entity.ModerationFlag,
    QuestionFingerprint: entity.QuestionFingerprint
  };
}

async function allQuestionRecords(): Promise<QuestionRecord[]> {
  const client = getTableClient(getConfig().tableName);
  if (!client) return [...memoryQuestions.values()];

  const records: QuestionRecord[] = [];
  for await (const entity of client.listEntities<QuestionRecord>()) {
    records.push(fromEntity(entity));
  }
  return records;
}

export async function ensureTables(): Promise<void> {
  const config = getConfig();
  const questionClient = getTableClient(config.tableName);
  const settingsClient = getTableClient(config.settingsTableName);
  await questionClient?.createTable().catch((error) => {
    if (error.statusCode !== 409) throw error;
  });
  await settingsClient?.createTable().catch((error) => {
    if (error.statusCode !== 409) throw error;
  });
}

export async function createQuestion(questionText: string): Promise<void> {
  const now = new Date().toISOString();
  const settings = await getSettings();
  const record: QuestionRecord = {
    partitionKey: settings.townHallName || getConfig().townHallName,
    rowKey: randomUUID(),
    QuestionText: questionText,
    SubmittedUtc: now,
    Status: 'New',
    Category: '',
    InternalNotes: '',
    IsAnswered: false,
    TownHallName: settings.townHallName || getConfig().townHallName,
    SelectedForPresentation: false,
    Archived: false,
    ModerationFlag: false,
    QuestionFingerprint: questionFingerprint(questionText)
  };

  const client = getTableClient(getConfig().tableName);
  if (!client) {
    memoryQuestions.set(record.rowKey, record);
    return;
  }
  await client.createEntity(record);
}

export async function listQuestions(filters: Record<string, string | undefined> = {}): Promise<QuestionDto[]> {
  const records = await allQuestionRecords();
  const fingerprintCounts = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.QuestionFingerprint] = (accumulator[record.QuestionFingerprint] ?? 0) + 1;
    return accumulator;
  }, {});

  return records
    .filter((record) => {
      if (filters.status && record.Status !== filters.status) return false;
      if (filters.isAnswered && String(record.IsAnswered) !== filters.isAnswered) return false;
      if (filters.selected && String(record.SelectedForPresentation) !== filters.selected) return false;
      if (filters.category && !record.Category.toLowerCase().includes(filters.category.toLowerCase())) return false;
      if (filters.search && !record.QuestionText.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.duplicates === 'true' && fingerprintCounts[record.QuestionFingerprint] < 2) return false;
      return true;
    })
    .sort((a, b) => b.SubmittedUtc.localeCompare(a.SubmittedUtc))
    .map((record) => toDto(record, fingerprintCounts[record.QuestionFingerprint] > 1));
}

export async function updateQuestion(rowKey: string, changes: Partial<QuestionDto>): Promise<QuestionDto> {
  const records = await allQuestionRecords();
  const existing = records.find((record) => record.rowKey === rowKey);
  if (!existing) throw new Error('not_found');

  const updated: QuestionRecord = {
    ...existing,
    Status: changes.status ?? existing.Status,
    Category: changes.category ?? existing.Category,
    InternalNotes: changes.internalNotes ?? existing.InternalNotes,
    IsAnswered: changes.isAnswered ?? existing.IsAnswered,
    SelectedForPresentation: changes.selectedForPresentation ?? existing.SelectedForPresentation,
    Archived: changes.archived ?? existing.Archived,
    ModerationFlag: changes.moderationFlag ?? existing.ModerationFlag
  };

  const client = getTableClient(getConfig().tableName);
  if (!client) {
    memoryQuestions.set(rowKey, updated);
    return toDto(updated);
  }
  await client.updateEntity(updated, 'Merge');
  return toDto(updated);
}

export async function getSettings(): Promise<TownHallSettings> {
  const client = getTableClient(getConfig().settingsTableName);
  if (!client) return memorySettings;

  try {
    const entity = await client.getEntity<Record<string, string | boolean>>('settings', 'active');
    return {
      submissionsOpen: Boolean(entity.submissionsOpen),
      townHallName: String(entity.townHallName ?? defaultSettings.townHallName),
      landingPrompt: String(entity.landingPrompt ?? defaultSettings.landingPrompt),
      successMessage: String(entity.successMessage ?? defaultSettings.successMessage)
    };
  } catch {
    await client.upsertEntity({
      partitionKey: 'settings',
      rowKey: 'active',
      submissionsOpen: defaultSettings.submissionsOpen,
      townHallName: defaultSettings.townHallName,
      landingPrompt: defaultSettings.landingPrompt,
      successMessage: defaultSettings.successMessage
    });
    return defaultSettings;
  }
}

export async function saveSettings(changes: Partial<TownHallSettings>): Promise<TownHallSettings> {
  const next = { ...(await getSettings()), ...changes };
  const client = getTableClient(getConfig().settingsTableName);
  if (!client) {
    memorySettings = next;
    return memorySettings;
  }
  await client.upsertEntity({
    partitionKey: 'settings',
    rowKey: 'active',
    submissionsOpen: next.submissionsOpen,
    townHallName: next.townHallName,
    landingPrompt: next.landingPrompt,
    successMessage: next.successMessage
  });
  return next;
}

export function resetMemoryStore() {
  memoryQuestions.clear();
  memorySettings = { ...defaultSettings };
}
