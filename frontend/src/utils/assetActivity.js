// Shared by the Activity Log component and the screens that export it.

export const ACTIVITY_CATEGORIES = ['All', 'Lifecycle', 'Customer', 'Ticket', 'Service Visit'];

export const formatActivityDate = (value) => (value
    ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '');

export const filterActivity = (activity, category) => (category === 'All' ? activity : activity.filter((a) => a.category === category));
