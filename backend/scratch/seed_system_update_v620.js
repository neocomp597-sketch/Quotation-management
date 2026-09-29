const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function run() {
    try {
        console.log("Connecting to MongoDB database...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        const newUpdate = {
            version: 'v6.2.0',
            title: 'Product BOM Master, Faster Load Times, Branch-Wise Data Access, Customer Service Fixes & Payroll Withdrawal',
            message: 'Release Updates (21 - 28 Sep 2026): Introduced the Product BOM Master with bulk upload, serial-number lookup, remarks, Excel and PDF export including sub-BOMs, and a read-only BOM tab on complaints. BOMs are now deactivated with a status log instead of being deleted, and descriptions with MGR1-MGR5 are read from Product Master on every view. Branch-wise data access is enforced at the API, not only in the screens. Load times were cut with response compression, cached master data and route-level code splitting. Support ticket search now covers every field on the register, the Close Ticket screen keeps spare parts and expenses, and visit check-out records the real location. Payroll salary screens were withdrawn, the Master menu was renamed and sorted, and the page after sign-in is now blank.',
            releaseNotes: [
                'Product BOM Master: one BOM per finished-good serial with item code, description, quantity, batch, serial number, remarks and MGR1-MGR5, plus bulk upload with a downloadable template that replaces a serial on re-upload',
                'BOM on Complaints: a read-only BOM tab appears once a serial number is entered on a complaint, so engineers see the bill of materials without being able to change it',
                'BOM Export: Export to Excel and Export to PDF on BOM Details, the PDF carrying invoice number, invoice date, customer code, customer name and MGR1-MGR5, with any sub-BOM printed underneath in a smaller font',
                'BOM Safety: the Delete button was replaced by Deactivate / Activate, keeping the BOM and its components in the register with a status log of who switched it and why; a permanent delete is left to administrators',
                'Live Product Master Data: component descriptions and MGR1-MGR5 are read from Product Master every time a BOM is opened, so a product maintained after the BOM was saved now shows up without re-entering anything',
                'Menu: Products, BOM Master and MGR Master renamed to Product Master, Product BOM Master and Product MGR Master, and every submenu is sorted alphabetically',
                'Branch-Wise Data Access: branch scoping moved into the tenant layer so the API filters by branch for every model that carries one, instead of relying on the screens to hide rows',
                'Speed: responses are compressed, static assets are cached for a year, screens load as separate chunks with skeletons instead of a spinner, master data is cached in the browser and cleared on every write, and engineer synchronisation dropped from about 20 seconds to a fraction of a second',
                'Support Ticket Search: the register now searches Sr No and Ticket No, customer and contact, subject, invoice number, product and serial number, and engineer, on partial or exact matches',
                'Customer Service Fixes: ticket import template downloads again, Close Ticket saves spare parts and expenses, visit check-out records the engineer\'s real location, completed visits can be re-opened or rescheduled, and Service Reports and RCA have their own permission instead of following the CSM Dashboard',
                'RCA Report: the Stelmec logo was added to the PDF and the date moved out of the heading',
                'Payroll: salary runs, payments, payslips, letters and settings were withdrawn from the menus and routes; Employees, Department Master, Designation Master and the Org Chart stay under Master',
                'Home Page: the screen after signing in is blank, so people go straight to the module they need instead of landing on quotation figures'
            ],
            detailedChanges: [
                {
                    date: '21.09.2026',
                    module: 'CSM Support',
                    submodule: 'Ticket Import, Close Ticket & Visit Check-Out',
                    changes: 'Fixed the ticket import Template download. Close Ticket now stores spare parts and expenses against the ticket as closureExpenses with resolution notes, an SLA breach flag and a Part Change entry on the timeline. Visit check-out records the coordinates read from the device instead of a fixed location, and a completed visit can be re-opened or rescheduled. Service Reports and RCA moved to their own csm_rca permission, with a fallback to the old CSM Dashboard permission so existing roles keep working.'
                },
                {
                    date: '21.09.2026',
                    module: 'Employee Master',
                    submodule: 'Employee Form Field Order',
                    changes: 'Reordered the employee form to Employee Name, Email Address, Reporting To. The rest of the form and its layout are unchanged.'
                },
                {
                    date: '23.09.2026',
                    module: 'CSM Support',
                    submodule: 'Support Ticket Register Search & RCA PDF',
                    changes: 'Search on the ticket register resolves customers, contacts, assets, invoices, products, engineers and salespeople before matching, so Sr No, Ticket No, customer and contact, subject, invoice number, product, serial number and engineer all find their tickets on partial or exact text. The RCA PDF carries the Stelmec logo and the date sits below the heading rather than beside it.'
                },
                {
                    date: '23.09.2026',
                    module: 'Security',
                    submodule: 'Branch-Wise Data Access',
                    changes: 'Branch scoping moved into the tenant plugin: a non-admin user with assigned branches now has every query on a branch-aware model filtered at the API, including the branch list itself, instead of the screens hiding rows that the API had already returned. Covered by an end-to-end test that signs in and checks each scoped list.'
                },
                {
                    date: '23.09.2026',
                    module: 'Platform',
                    submodule: 'Load Time & Response Size',
                    changes: 'Responses are compressed, built assets are served with a one-year immutable cache and index.html with no cache, and Google Maps is loaded only on the screens that draw a map. Engineer synchronisation was rewritten from roughly 940 queries to two reads and a single bulk write, taking it from about 20 seconds to a fraction of a second.'
                },
                {
                    date: '24.09.2026',
                    module: 'Platform',
                    submodule: 'Route Splitting & API Response Cache',
                    changes: 'Screens load as separate chunks behind skeleton placeholders instead of a full-page spinner, with the most used screens prefetched while the browser is idle and skipped on slow or data-saving connections. Master data reads are cached in the browser against an allowlist with time limits, identical in-flight requests are shared, every write clears the cached reads for that resource, and the cache is emptied on sign-out.'
                },
                {
                    date: '25.09.2026',
                    module: 'Payroll',
                    submodule: 'Salary Screens Withdrawn',
                    changes: 'Salary runs, payments, payslips, letters and payroll settings were removed from the menu, the routes and the permission catalogue. Employees, Department Master, Designation Master and the Org Chart remain under Master because other modules read that data.'
                },
                {
                    date: '25.09.2026',
                    module: 'Master Management',
                    submodule: 'Product BOM Master',
                    changes: 'New BOM register: one BOM per finished-good serial number, with each component carrying item code, description, quantity, batch number and serial number. Descriptions and MGR1-MGR5 come from Product Master when the item code is known, and a component that is not in the master keeps the description that was entered, marked as such. Complaint booking, edit and view gained a read-only BOM tab that appears once a serial number is entered.'
                },
                {
                    date: '25.09.2026',
                    module: 'Master Management',
                    submodule: 'BOM Bulk Upload & Template',
                    changes: 'Download Template and Upload on Product BOM Master. The workbook is read in memory, accepts either the template headings or the original layout with two Serial number columns, groups the rows by finished-good serial, and reports per-serial counts with the reason for every serial it could not take. Re-uploading a serial replaces the components of its BOM rather than duplicating them.'
                },
                {
                    date: '26.09.2026',
                    module: 'Master Management',
                    submodule: 'Serial Number Lookup, Remarks & Excel Export',
                    changes: 'The FG Serial Number box searches the serials registered in Invoice Bulk Upload and fills in the finished good when one is picked, so a BOM can no longer be filed against a serial that does not exist. A Remarks field runs through upload, new entry, edit and view. Export to Excel produces FG item code, description and serial, FG MGR1-5, then each component with its code, description, batch, serial, quantity, MGR1-5 and remarks. Products, BOM Master and MGR Master were renamed Product Master, Product BOM Master and Product MGR Master.'
                },
                {
                    date: '26.09.2026',
                    module: 'Master Management',
                    submodule: 'BOM Status Log & Live MGR Resolution',
                    changes: 'Delete was replaced by Deactivate / Activate. An inactive BOM keeps its components in the register, stops being offered on complaints, and can be switched back on; every switch is written to a status log with the user, the time and an optional reason, shown under the components, and creation and re-uploads are logged too. A permanent delete is now refused for anyone who is not an administrator. Component descriptions and MGR1-MGR5, and the finished good\'s own MGRs, are read from Product Master on every load, so a product maintained after the BOM was saved appears without re-entering the BOM.'
                },
                {
                    date: '27.09.2026',
                    module: 'Master Management',
                    submodule: 'BOM Export to PDF & Sub-BOMs',
                    changes: 'Export to PDF sits beside Export to Excel. The A4 landscape sheet follows the screen: the finished good with its invoice number, invoice date, customer code, customer name and MGR1-MGR5, then the components. Where a component has a BOM of its own it prints underneath, one font size smaller and indented per level, matched on the component serial number or on an unambiguous item code. Created and Last Updated were removed from the sheet and the screen, which now show the invoice, customer and MGR fields instead.'
                },
                {
                    date: '27.09.2026',
                    module: 'Navigation',
                    submodule: 'Alphabetical Submenus & Logo Shortcut',
                    changes: 'Every submenu in the sidebar is sorted alphabetically where it is rendered, so entries added later fall into place on their own. The ARCRM logo and title block is now a link back to the home page.'
                },
                {
                    date: '28.09.2026',
                    module: 'Dashboard',
                    submodule: 'Blank Home Page',
                    changes: 'The page after signing in no longer shows quotation totals, draft quotes, pipeline value or recent quotations, which only suited companies working that way. It is empty, nothing is fetched there, and people go straight to the module they need from the menu.'
                }
            ],
            deployedBy: 'Super Admin',
            deployedAt: new Date(),
            // Held back until the build is live on arcrm.co.in. Flip to true to announce it:
            //   db.systemupdates.updateOne({ version: 'v6.2.0' }, { $set: { isActive: true, deployedAt: new Date() } })
            isActive: false
        };

        let existing = await SystemUpdate.findOne({ version: 'v6.2.0' });
        if (existing) {
            Object.assign(existing, newUpdate);
            await existing.save();
            console.log("Updated existing v6.2.0 system update document in MongoDB!");
        } else {
            const doc = new SystemUpdate(newUpdate);
            await doc.save();
            console.log("Created new v6.2.0 system update document in MongoDB!");
        }

        process.exit(0);
    } catch (e) {
        console.error("Error updating system updates:", e);
        process.exit(1);
    }
}

run();
