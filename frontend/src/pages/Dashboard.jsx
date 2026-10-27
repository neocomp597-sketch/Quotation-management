import React from 'react';
import DashboardClock from '../components/DashboardClock';

/**
 * The home page shows only a clock.
 *
 * It used to show quotation figures and recent quotations, which only suit a company that
 * works that way; everyone else was landing on numbers that meant nothing to them. People
 * now go straight to the module they came for from the menu.
 *
 * Nothing is fetched here, so signing in no longer waits on a reporting query.
 */
const Dashboard = () => (
    <div className="flex min-h-[60vh] items-center justify-center py-4">
        <DashboardClock />
    </div>
);

export default Dashboard;
