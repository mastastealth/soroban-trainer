import { helper } from '@ember/component/helper';
import { formatMs } from '../utils/format';

export default helper(([ms]) => formatMs(ms));
