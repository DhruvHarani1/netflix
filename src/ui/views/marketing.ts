import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'marketing', title: 'Marketing', icon: '📣', group: 'market', render: () => pageHead('Marketing', 'Not built yet') + panel('Marketing', empty('Coming soon')) });
