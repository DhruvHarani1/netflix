import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'achievements', title: 'Goals', icon: '🏆', group: 'risk', render: () => pageHead('Goals', 'Not built yet') + panel('Goals', empty('Coming soon')) });
