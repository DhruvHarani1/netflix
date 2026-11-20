import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'stock', title: 'Stock Market', icon: '📈', group: 'money', render: () => pageHead('Stock Market', 'Not built yet') + panel('Stock Market', empty('Coming soon')) });
