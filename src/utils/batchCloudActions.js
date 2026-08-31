export async function runSequentialCloudActions(items, dispatch, createAction) {
  const succeeded = [];
  const failed = [];

  for (const item of items) {
    const saved = await dispatch(createAction(item));
    (saved ? succeeded : failed).push(item);
  }

  return { succeeded, failed };
}
