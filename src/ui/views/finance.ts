import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'finance', title: 'Finance', icon: '💰', group: 'money', render: () => pageHead('Finance', 'Not built yet') + panel('Finance', empty('Coming soon')) });
