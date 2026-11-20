import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'corporate', title: 'Corporate M&A', icon: '🤝', group: 'money', render: () => pageHead('Corporate M&A', 'Not built yet') + panel('Corporate M&A', empty('Coming soon')) });
