import type { CreateMemoInput, CreateTaskInput } from 'meme-gtd-db';

/**
 * Generate sample memo data for testing
 */
export function createMemoFixture(overrides?: Partial<CreateMemoInput>): CreateMemoInput {
  return {
    bodyMd: 'Test memo body',
    ...overrides,
  };
}

/**
 * Generate sample task data for testing
 */
export function createTaskFixture(overrides?: Partial<CreateTaskInput>): CreateTaskInput {
  return {
    title: 'Test task title',
    bodyMd: 'Test task body',
    status: 'open',
    ...overrides,
  };
}

/**
 * Generate multiple memo fixtures
 */
export function createMemoFixtures(count: number): CreateMemoInput[] {
  return Array.from({ length: count }, (_, i) => ({
    bodyMd: `Test memo ${i + 1}`,
  }));
}

/**
 * Generate multiple task fixtures
 */
export function createTaskFixtures(count: number): CreateTaskInput[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Test task ${i + 1}`,
    bodyMd: `Test task body ${i + 1}`,
    status: 'open' as const,
  }));
}
