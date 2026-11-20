import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'news', title: 'News', icon: '📰', group: 'risk', render: () => pageHead('News', 'Not built yet') + panel('News', empty('Coming soon')) });
