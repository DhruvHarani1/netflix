import { registerView, registerActions, pageHead, panel, empty } from '../kit';
import { S } from '../state';
registerView({ id: 'products', title: 'Products', icon: '📦', group: 'build', render: () => pageHead('Products', 'Not built yet') + panel('Products', empty('Coming soon')) });
