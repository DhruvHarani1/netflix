import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'people', title: 'People', icon: '👥', group: 'build', render: () => pageHead('People', 'Not built yet') + panel('People', empty('Coming soon')) });
