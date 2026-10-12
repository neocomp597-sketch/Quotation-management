// Shared by the Activity Log component and the screens that export it.

import { formatDateTime } from './helpers';

export const ACTIVITY_CATEGORIES = ['All', 'Lifecycle', 'Customer', 'Ticket', 'Service Visit'];

export const formatActivityDate = (value) => formatDateTime(value, '');

export const filterActivity = (activity, category) => (category === 'All' ? activity : activity.filter((a) => a.category === category));
