import { helper } from '@ember/component/helper';

export default helper(([timestamp]) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
});
