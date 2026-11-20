import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'market', title: 'Market', icon: '🛒', group: 'market', render: () => pageHead('Market', 'Not built yet') + panel('Market', empty('Coming soon')) });
