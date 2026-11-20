import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'dashboard', title: 'Dashboard', icon: '📊', group: 'command', render: () => pageHead('Dashboard', 'Not built yet') + panel('Dashboard', empty('Coming soon')) });
