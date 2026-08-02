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
            version: 'v2.6.0',
            title: 'Master Pages Inline Form, OrgChart Profile Preview, PDF Flowchart Export & Location Data Expansion',
            message: 'GitHub Commits 57a8f15 & 482930f (02 Aug 2026): Replaced fullscreen overlay forms with inline page-level forms across 13+ master pages. Added maximized profile picture preview in OrgChart. Expanded location data to cover all 36 Indian States & UTs with 700+ cities. Flowchart export changed from JSON to PDF with title, metadata & diagram. System Updates page & modal UI improvements.',
            releaseNotes: [
                'Master Pages: Replaced fullscreen overlay form with inline page-level form layout across 13+ modules (Attributes, Branch, Contacts, Customers, Products, Salespersons, Vendors, Terms, Territory, Status, MGR, CSM Masters, Payroll Masters)',
                'OrgChart: Added maximized profile picture preview modal — click any employee avatar to view full-size photo with name, designation, department & employee ID',
                'Location Data: Expanded DEFAULT_CITIES to cover all 36 Indian States & Union Territories with 700+ cities, added shortcode-to-state lookup & partial match fallback',
                'Flowchart Canvas: Replaced JSON export with PDF export — generates landscape A4 PDF with title, description, metadata, flowchart diagram & footer using jsPDF + html2canvas',
                'System Updates: Improved SystemUpdates page with enhanced controller & added scratch seed script for version management',
                'State Master: Added custom city input option with "Select from list" toggle when city is not in the dropdown'
            ],
            detailedChanges: [
                {
                    date: '02.08.2026',
                    module: 'Master Pages',
                    submodule: 'Inline Form Layout',
                    changes: 'Replaced fullscreen overlay (fixed inset-0 z-[100]) with inline max-w-3xl centered form layout across Attributes, BranchMaster, Contacts, Customers, Products, Salespersons, Vendors, Terms, TerritoryMaster, StatusMaster, MGRMaster, CSMMasters, and PayrollMasters pages.'
                },
                {
                    date: '02.08.2026',
                    module: 'OrgChart',
                    submodule: 'Profile Picture Preview',
                    changes: 'Added clickable profile picture avatars in employee modal with maximized preview modal showing full-size photo, employee name, designation, department and employee ID. Supports both photo URLs and initial-based avatars.'
                },
                {
                    date: '02.08.2026',
                    module: 'Location Data',
                    submodule: 'Indian States & Cities',
                    changes: 'Expanded DEFAULT_CITIES constant to cover all 36 Indian States & Union Territories (Maharashtra, Gujarat, Delhi NCT, Karnataka, Tamil Nadu, Rajasthan, UP, MP, WB, Punjab, Haryana, Kerala, Telangana, AP, Bihar, Assam, Jharkhand, Chhattisgarh, Goa, Uttarakhand, HP, Odisha, J&K, Ladakh, Chandigarh, Puducherry, A&N Islands, DNH & DD, Tripura, Meghalaya, Manipur, Nagaland, Arunachal Pradesh, Mizoram, Sikkim, Lakshadweep) with 700+ cities.'
                },
                {
                    date: '02.08.2026',
                    module: 'Location Data',
                    submodule: 'ShortCode & Partial Match',
                    changes: 'Added STATE_SHORTCODE_MAP for 2-letter state code lookup (MH→Maharashtra, GJ→Gujarat, etc.) and implemented partial/contains match fallback in getCitiesForState helper.'
                },
                {
                    date: '02.08.2026',
                    module: 'State Master',
                    submodule: 'Custom City Input',
                    changes: 'Added custom city text input option with "__CUSTOM_CITY__" sentinel value. Users can type a custom city when not found in the dropdown and toggle back with "Select from list" link.'
                },
                {
                    date: '02.08.2026',
                    module: 'Flowchart Builder',
                    submodule: 'PDF Export',
                    changes: 'Replaced JSON export with PDF export using jsPDF and html2canvas libraries. Generates landscape A4 PDF with flowchart title, description, generation metadata (date, node count, connector count), separator line, centered flowchart diagram image, and branded footer.'
                },
                {
                    date: '02.08.2026',
                    module: 'Flowchart Builder',
                    submodule: 'Export Button UI',
                    changes: 'Changed Export toolbar button icon from MdFileDownload to MdPictureAsPdf and updated label from "Export" to "Export PDF".'
                },
                {
                    date: '02.08.2026',
                    module: 'System Updates',
                    submodule: 'Page & Modal Improvements',
                    changes: 'Enhanced System Updates page layout and improved SystemUpdatesModal component with better data handling and display.'
                },
                {
                    date: '02.08.2026',
                    module: 'Employee Master',
                    submodule: 'Family Info Contacts',
                    changes: 'Added Contact Number and Aadhaar Number fields per family member entry with numeric validation, emergency contact checkbox, and per-member remove button in collapsible accordion.'
                }
            ],
            deployedBy: 'GitHub main (57a8f15, 482930f)',
            deployedAt: new Date()
        };

        let existing = await SystemUpdate.findOne({ version: 'v2.6.0' });
        if (existing) {
            Object.assign(existing, newUpdate);
            await existing.save();
            console.log("Updated existing v2.6.0 system update document in MongoDB!");
        } else {
            const doc = new SystemUpdate(newUpdate);
            await doc.save();
            console.log("Created new v2.6.0 system update document in MongoDB!");
        }

        process.exit(0);
    } catch (e) {
        console.error("Error updating system updates:", e);
        process.exit(1);
    }
}

run();
