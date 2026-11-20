import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'legal', title: 'Legal', icon: '⚖️', group: 'risk', render: () => pageHead('Legal', 'Not built yet') + panel('Legal', empty('Coming soon')) });
