import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'research', title: 'Research', icon: '🔬', group: 'build', render: () => pageHead('Research', 'Not built yet') + panel('Research', empty('Coming soon')) });
