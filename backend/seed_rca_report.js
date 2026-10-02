/**
 * Seed script: Insert 1 fully-filled, realistic Why-Why Analysis + RCA Report
 * for the user super@gmail.com
 *
 * Usage:  node seed_rca_report.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const CSMRcaReport = require('./models/CSMRcaReport');
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // ── Find the user ──────────────────────────────────────────────
        const user = await User.findOne({ email: 'super@gmail.com' });
        if (!user) {
            console.error('❌ User super@gmail.com not found');
            process.exit(1);
        }
        console.log(`👤 Found user: ${user.name || user.email}  (companyId: ${user.companyId || 'none'})`);

        // Remove the old report if it exists so we get a clean re-seed.
        const deleted = await CSMRcaReport.deleteMany({ rcaNumber: 'RCA-2026-001' });
        if (deleted.deletedCount) console.log(`🗑️  Deleted ${deleted.deletedCount} existing RCA-2026-001 report(s)`);

        // ── Build the report ───────────────────────────────────────────
        const report = {
            companyId: user.companyId || undefined,
            createdBy: user._id,

            // ─── Document Header ───────────────────────────────────────
            rcaNumber: 'RCA-2026-001',
            ticketNo: 'TKT-2026-00347',
            date: new Date('2026-09-18'),
            department: 'Maintenance',
            priority: 'High',
            status: 'Resolved',

            // ─── Incident ──────────────────────────────────────────────
            problemStatement:
                'CNC Vertical Machining Centre (VMC-03) hydraulic power pack unit tripped on thermal overload during second-shift production run. ' +
                'Hydraulic pressure dropped from 65 bar to 12 bar within 90 seconds, triggering auto-stop. ' +
                'Spindle clamping lost mid-cycle causing tool holder ejection. Machine was running Job Order JO-2026-1184 (Crank Housing – Batch 40 pcs).',
            impact:
                'Production loss of 6.5 hours on VMC-03 (₹78,000 estimated). 3 semi-finished crank housings scrapped due to tool crash (₹14,400 material cost). ' +
                'Delivery commitment to Bajaj Auto delayed by 1 day for PO-BA-20260912.',

            // ─── Product & Customer ────────────────────────────────────
            productCode: 'STL-VCB-11KV-630A',
            productDescription: '11kV Vacuum Circuit Breaker, 630A, 25kA, Indoor Panel Mounted – Model VCB-11/630',
            serialNumber: 'SN-VMC03-2026-09174',
            customerName: 'Bajaj Auto Ltd., Chakan Plant',
            postalCode: '410501',
            yyyNumber: 'YYY-2026-001',
            yyyDate: new Date('2026-09-18'),

            // ─── Why-Why Analysis Sheet Fields ─────────────────────────
            sectionCell: 'Cell-2 / CNC Shop Floor',
            machineNo: 'VMC-03',
            machineDescription: 'BFW VF-3 Vertical Machining Centre – 2018 Make, 12000 RPM, BT-40 Spindle, Fanuc 0i-MF Controller, Yuken Hydraulic Pack 3.7 kW',
            breakdownDate: new Date('2026-09-17'),

            symptomBeforeBreakdown:
                'Operator reported unusual whining noise from hydraulic unit 2 days prior (15-Sep-2026). ' +
                'Oil temperature gauge was reading 58°C against normal 42°C. ' +
                'Slight oil seepage observed around suction line flange joint. ' +
                'Hydraulic pressure fluctuation noticed (65→55→65 bar) during clamping cycles on 16-Sep-2026.',

            sparePartReplaced: true,

            finalCountermeasure:
                'Replaced clogged suction strainer (Mesh 100, P/N: YK-SF-100-38) and damaged shaft seal on hydraulic pump (Yuken PV2R1-19-F-RAA-4222). ' +
                'Flushed entire hydraulic circuit with filtered ISO VG-68 oil. ' +
                'Replaced 42 litres of hydraulic oil (Servo System-68) that had exceeded contamination limits (NAS Class 11 vs required NAS Class 8). ' +
                'Realigned pump-motor coupling (misalignment measured: 0.18 mm radial, corrected to 0.04 mm).',

            dueTo:
                'Root cause traced to blocked suction strainer causing cavitation in hydraulic pump. ' +
                'Cavitation led to excessive heat generation, seal degradation, and internal leakage. ' +
                'Oil contamination accelerated strainer clogging beyond its 6-month service interval. ' +
                'Contributing factor: no suction vacuum gauge installed to give early warning of filter restriction.',

            rootCauseReason: 'Poor Basic Condition',

            kaizenIdea:
                '1. Install differential pressure gauge / vacuum switch on suction line of all hydraulic packs (8 machines) to alert operator when strainer is 70% blocked.\n' +
                '2. Introduce monthly particle count check (NAS classification) using portable oil contamination sensor.\n' +
                '3. Reduce suction strainer replacement interval from 6 months to 4 months for machines running 2-shift operations.',

            inCharge: 'Rajesh Patil (Sr. Maintenance Engineer)',

            youDidNot:
                'Follow the planned preventive maintenance schedule for hydraulic suction strainer cleaning/replacement. ' +
                'PM was overdue by 5 weeks (last done: 28-Jul-2026, due: 28-Aug-2026). ' +
                'Did not act on operator\'s verbal complaint about noise on 15-Sep — no breakdown call was logged.',

            actionThatDay:
                'Emergency strainer cleaning performed using ultrasonic bath. Temporary seal fitted on pump. ' +
                'Machine restarted at 02:30 AM for trial run. Pressure held at 63 bar for 45 min trial. ' +
                'Released for production at 03:15 AM with condition monitoring every 2 hours until permanent repair next day.',

            schedule: 'Permanent repair completed on 18-Sep-2026 (Day shift). Kaizen items 1 & 2 to be completed by 15-Oct-2026. Item 3 already updated in SAP PM module.',

            // ─── 5-Why Breakdown ───────────────────────────────────────
            fiveWhys: [
                {
                    whyNo: 1,
                    analysis: 'Why did the hydraulic power pack trip? — Because the thermal overload relay activated due to motor drawing 14.2A against rated 9.8A (145% overload). Oil temperature reached 72°C.'
                },
                {
                    whyNo: 2,
                    analysis: 'Why was the motor drawing excess current? — Because the hydraulic pump was cavitating severely, creating high resistance and air pockets in the suction line. Pump was starved of oil flow.'
                },
                {
                    whyNo: 3,
                    analysis: 'Why was the pump cavitating? — Because the suction strainer (100 mesh) was 85% clogged with metallic sludge and fibre debris, restricting oil flow to the pump inlet below minimum required 12 LPM.'
                },
                {
                    whyNo: 4,
                    analysis: 'Why was the suction strainer clogged beyond limits? — Because the strainer had not been cleaned or replaced for 7+ weeks past the scheduled PM date (due 28-Aug-2026). Oil NAS class had deteriorated to Class 11.'
                },
                {
                    whyNo: 5,
                    analysis: 'Why was PM not carried out on schedule? — Because the maintenance planner had deferred the hydraulic PM due to production pressure (month-end dispatch targets) and there was no automated alert system for overdue PMs in the current SAP setup.'
                }
            ],

            // ─── Root Cause Classification ─────────────────────────────
            category: 'Machine / Equipment',
            rootCause:
                'Hydraulic suction strainer clogged beyond serviceable limits due to missed preventive maintenance schedule. ' +
                'Lack of condition-based monitoring (no vacuum gauge on suction line, no oil particle count trending) allowed deterioration to progress undetected until catastrophic failure.',

            // ─── CAPA Actions ──────────────────────────────────────────
            capaActions: [
                {
                    actionType: 'Corrective',
                    action: 'Replace suction strainer, shaft seal, and 42L hydraulic oil on VMC-03. Realign pump-motor coupling. Flush hydraulic circuit and validate pressure holding at 65 bar ± 2 bar for 1 hour.',
                    responsiblePerson: 'Rajesh Patil',
                    targetDate: new Date('2026-09-18'),
                    status: 'Completed'
                },
                {
                    actionType: 'Corrective',
                    action: 'Log and close all overdue hydraulic PM work orders in SAP. Conduct strainer inspection on remaining 7 CNC machines in Cell-1 and Cell-2 within 1 week.',
                    responsiblePerson: 'Amit Deshmukh',
                    targetDate: new Date('2026-09-25'),
                    status: 'Completed'
                },
                {
                    actionType: 'Preventive',
                    action: 'Install differential pressure / vacuum switch on suction line of all 8 CNC hydraulic packs. Interlock with PLC to flash HMI warning when strainer blockage reaches 70%.',
                    responsiblePerson: 'Sanjay Kulkarni',
                    targetDate: new Date('2026-10-15'),
                    status: 'In Progress'
                },
                {
                    actionType: 'Preventive',
                    action: 'Procure portable laser particle counter and introduce monthly NAS classification oil sampling for all hydraulic systems. Create SAP notification auto-trigger for PM overdue > 3 days.',
                    responsiblePerson: 'Rajesh Patil',
                    targetDate: new Date('2026-10-31'),
                    status: 'Open'
                }
            ],

            // ─── Verification ──────────────────────────────────────────
            verificationDate: new Date('2026-09-25'),
            effectiveness: 'Effective',
            verificationRemarks:
                'VMC-03 running stable since 18-Sep-2026. Hydraulic pressure steady at 64–66 bar across all shifts. ' +
                'Oil temperature maintained at 40–44°C. No abnormal noise or vibration detected. ' +
                '7-day production validation completed — 312 crank housings machined, zero hydraulic-related stoppages. ' +
                'Strainer inspection on 7 other machines completed: 2 machines (VMC-05, HMC-02) had strainers at 60% blockage — replaced proactively.'
        };

        // ── Insert ─────────────────────────────────────────────────────
        const created = await CSMRcaReport.create(report);
        console.log(`\n🎉 RCA Report created successfully!`);
        console.log(`   RCA Number : ${created.rcaNumber}`);
        console.log(`   Ticket     : ${created.ticketNo}`);
        console.log(`   Department : ${created.department}`);
        console.log(`   Priority   : ${created.priority}`);
        console.log(`   Status     : ${created.status}`);
        console.log(`   Category   : ${created.category}`);
        console.log(`   Root Cause Reason : ${created.rootCauseReason}`);
        console.log(`   CAPA Actions      : ${created.capaActions.length}`);
        console.log(`   Effectiveness     : ${created.effectiveness}`);
        console.log(`   ID         : ${created._id}\n`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
})();
