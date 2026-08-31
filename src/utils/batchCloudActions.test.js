import { describe, expect, it, vi } from 'vitest';
import { runSequentialCloudActions } from './batchCloudActions.js';

describe('runSequentialCloudActions', () => {
  it('逐项等待云端结果，不并发启动下一项', async () => {
    let finishFirst;
    const first = new Promise(resolve => { finishFirst = resolve; });
    const dispatch = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(true);

    const running = runSequentialCloudActions(['a', 'b'], dispatch, id => ({ type: 'TEST', payload: id }));
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledTimes(1);

    finishFirst(true);
    await running;
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('分别报告成功项和失败项', async () => {
    const dispatch = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(runSequentialCloudActions(
      ['a', 'b', 'c'],
      dispatch,
      id => ({ type: 'TEST', payload: id }),
    )).resolves.toEqual({ succeeded: ['a', 'c'], failed: ['b'] });
  });
});
