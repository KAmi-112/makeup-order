import { describe, expect, it, vi } from 'vitest';
import { saveActionWithFeedback } from './cloudSave.js';

describe('saveActionWithFeedback', () => {
  it('云端尚未返回时不能提前提示成功', async () => {
    let finish;
    const dispatch = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const showMsg = vi.fn();
    const saving = saveActionWithFeedback({
      dispatch,
      action: { type: 'UPDATE_NOTICE', payload: '测试' },
      showMsg,
      successMessage: '已保存',
      failureMessage: '保存失败',
    });

    expect(showMsg).not.toHaveBeenCalled();
    finish(true);
    await expect(saving).resolves.toBe(true);
    expect(showMsg).toHaveBeenCalledWith('已保存', 'success');
  });

  it('云端返回失败时必须提示失败，不能提示成功', async () => {
    const showMsg = vi.fn();
    const saved = await saveActionWithFeedback({
      dispatch: vi.fn().mockResolvedValue(false),
      action: { type: 'UPDATE_NOTICE', payload: '测试' },
      showMsg,
      successMessage: '已保存',
      failureMessage: '保存失败',
    });

    expect(saved).toBe(false);
    expect(showMsg).toHaveBeenCalledWith('保存失败', 'error');
  });
});
