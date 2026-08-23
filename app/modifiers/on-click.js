import { modifier } from 'ember-modifier';

/**
 * Click binding via a plain native listener. Identical intent to
 * {{on "click" ...}} — kept as a fallback where the framework modifier's
 * teardown interferes with long-lived interactive sessions.
 */
export default modifier((el, [handler]) => {
  window.__onClickInstalls = (window.__onClickInstalls ?? 0) + 1;
  window.__onClickHandlerType = typeof handler;
  const wrapped = (e) => handler(e);
  el.addEventListener('click', wrapped);
  return () => el.removeEventListener('click', wrapped);
});
