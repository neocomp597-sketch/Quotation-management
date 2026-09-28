import React from 'react';

/**
 * The home page is deliberately blank.
 *
 * It used to show quotation figures and recent quotations, which only suit a company that
 * works that way; everyone else was landing on numbers that meant nothing to them. People
 * now go straight to the module they came for from the menu.
 *
 * Nothing is fetched here, so signing in no longer waits on a reporting query.
 */
const Dashboard = () => <div className="min-h-[60vh]" />;

export default Dashboard;
