import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'world', title: 'World Map', icon: '🌍', group: 'world', render: () => pageHead('World Map', 'Not built yet') + panel('World Map', empty('Coming soon')) });
