import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'facilities', title: 'Facilities', icon: '🏢', group: 'build', render: () => pageHead('Facilities', 'Not built yet') + panel('Facilities', empty('Coming soon')) });
