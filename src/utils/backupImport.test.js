import { describe, expect, it } from 'vitest';
import { buildSettingsImportPayload } from './backupImport.js';

describe('buildSettingsImportPayload', () => {
  it('只恢复设置，绝不把备份订单写入页面假装已同步', () => {
    const result = buildSettingsImportPayload({
      orders: [{ id: 'order-1' }],
      makeupTypes: [{ id: 'type-1' }],
      notice: '须知',
    });

    expect(result).toEqual({
      payload: { makeupTypes: [{ id: 'type-1' }], notice: '须知' },
      skippedOrderCount: 1,
    });
    expect(result.payload).not.toHaveProperty('orders');
  });

  it('没有可恢复设置时拒绝导入', () => {
    expect(() => buildSettingsImportPayload({ orders: [] }))
      .toThrow('备份文件中没有可恢复的设置');
  });
});
