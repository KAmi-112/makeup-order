import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  settingsResult: { data: null, error: null },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: table => {
      if (table !== 'settings') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          single: async () => mockState.settingsResult,
        }),
      };
    },
  }),
}));

const { fetchSettings } = await import('./db.js');

describe('fetchSettings', () => {
  beforeEach(() => {
    mockState.settingsResult = { data: null, error: null };
  });

  it('云端读取失败时必须抛出错误，不能伪装成空配置', async () => {
    mockState.settingsResult = { data: null, error: new Error('settings network failed') };
    await expect(fetchSettings()).rejects.toThrow('settings network failed');
  });

  it('settings 主记录不存在时必须报错，不能回退成空配置', async () => {
    mockState.settingsResult = { data: null, error: null };
    await expect(fetchSettings()).rejects.toThrow('云端设置不存在');
  });
});
