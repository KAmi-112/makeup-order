export async function saveActionWithFeedback({ dispatch, action, showMsg, successMessage, failureMessage }) {
  const saved = await dispatch(action);
  showMsg(
    saved ? successMessage : failureMessage,
    saved ? 'success' : 'error',
  );
  return saved;
}
