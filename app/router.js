import EmberRouter from '@embroider/router';
import config from 'soroban-trainer/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('assessment');
  this.route('practice', { path: '/practice/:level_id' });
});
