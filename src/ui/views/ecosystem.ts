import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'ecosystem', title: 'Ecosystem', icon: '🕸️', group: 'world', render: () => pageHead('Ecosystem', 'Not built yet') + panel('Ecosystem', empty('Coming soon')) });
