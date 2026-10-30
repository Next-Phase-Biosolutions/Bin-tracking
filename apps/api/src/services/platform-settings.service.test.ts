import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ rows: new Map<string, { value: unknown; updatedBy: string | null }>() }));

vi.mock('@bin-tracker/db', () => ({
  prisma: {
    platformSetting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(store.rows.has(where.key) ? { key: where.key, ...store.rows.get(where.key)! } : null),
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { key: string };
        update: { value: unknown; updatedBy: string };
        create: { key: string; value: unknown; updatedBy: string };
      }) => {
        store.rows.set(where.key, store.rows.has(where.key) ? update : { value: create.value, updatedBy: create.updatedBy });
        return Promise.resolve({});
      },
    },
  },
}));

const { platformSettings } = await import('./platform-settings.service.js');

beforeEach(() => {
  store.rows = new Map();
});

describe('platformSettings offline threshold', () => {
  it('falls back to the default (20) when unset', async () => {
    expect(await platformSettings.getOfflineAfterMinutes()).toBe(20);
  });

  it('round-trips a stored value and records who set it', async () => {
    await platformSettings.setOfflineAfterMinutes(7, 'admin-1');
    expect(await platformSettings.getOfflineAfterMinutes()).toBe(7);
    expect(store.rows.get('sensor.offlineAfterMinutes')!.updatedBy).toBe('admin-1');
  });

  it('ignores a corrupt stored value instead of breaking every reader', async () => {
    for (const bad of ['soon', 0, -5, 1.5, 5000, null]) {
      store.rows.set('sensor.offlineAfterMinutes', { value: bad, updatedBy: null });
      expect(await platformSettings.getOfflineAfterMinutes()).toBe(20);
    }
  });

  it('refuses to store a value outside 1–1440', async () => {
    await expect(platformSettings.setOfflineAfterMinutes(0, 'a')).rejects.toThrow();
    await expect(platformSettings.setOfflineAfterMinutes(1441, 'a')).rejects.toThrow();
    expect(store.rows.size).toBe(0);
  });
});
