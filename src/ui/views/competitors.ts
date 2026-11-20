import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'competitors', title: 'Competitors', icon: '🏁', group: 'market', render: () => pageHead('Competitors', 'Not built yet') + panel('Competitors', empty('Coming soon')) });
