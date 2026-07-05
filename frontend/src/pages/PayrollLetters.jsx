import React, { useState, useEffect } from 'react';
import { payrollService, companySettingsService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { MdDescription, MdAdd, MdSave, MdDelete, MdPictureAsPdf } from 'react-icons/md';
import { formatDate, resolveImageUrl } from '../utils/helpers';

const TEMPLATE_CONTENTS = {
    offer: "Dear {name},\n\nCongratulations! We are pleased to offer you the position of {designation} at {company}. Your experience and skills impressed us, and we are excited about the value you will bring to our organization.\n\nKindly review the terms and salary details below. We look forward to welcoming you to the {company} family.",
    appointment: "Dear {name},\n\nWe are pleased to appoint you as {designation} at {company}, effective from {joining_date}. This appointment is subject to the terms and conditions outlined below.\n\nWe welcome you to our team and look forward to a successful and productive professional journey together.",
    increment: "Dear {name},\n\nWe are pleased to inform you that, after reviewing your performance, dedication, professional excellence, and contribution towards the growth of {company}, the Management has approved a revision to your compensation.\n\nYour hard work, commitment, and willingness to take ownership have been greatly appreciated. We believe this salary revision reflects our confidence in your abilities and our expectation that you will continue contributing towards the organization's success.",
    promotion: "Dear {name},\n\nWe are pleased to inform you that, in recognition of your exceptional performance, dedication, and leadership, you have been promoted to the position of {new_designation}, effective from {joining_date}.\n\nConsequent to this promotion, your monthly gross compensation has been revised to INR {salary}. We are confident that you will excel in your new role and continue to drive success for {company}.",
    salary_certificate: "TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {name} is employed with {company} as {designation}. As per our employment records, the employee has been associated with the company since {joining_date}.\n\nAs per the current payroll records, the employee's monthly gross salary is INR {salary}.\n\nThis certificate is issued at the request of the employee for official verification and documentation purposes.",
    experience: "TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that {name} was employed with {company} as {designation} from {joining_date} to {relieving_date}.\n\nDuring the period of employment, the employee carried out assigned responsibilities in a professional manner and maintained satisfactory conduct. We thank them for their service and wish them success in future endeavors.",
    relieving: "Dear {name},\n\nThis is to confirm that your resignation has been accepted and you are relieved from your duties as {designation} with effect from the close of business hours on {relieving_date}.\n\nAs per company records, you have completed the required handover and separation formalities. We appreciate your contribution during your tenure with {company} and wish you success in your future endeavors."
};

const formatSalary = (salary) => {
    const numericSalary = parseFloat(salary);
    return Number.isFinite(numericSalary) ? numericSalary.toLocaleString('en-IN') : '[Salary]';
};

const getCompanyPrefix = (companyName) => {
    if (!companyName) return 'RR';
    const words = companyName.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return words.map(w => w[0]).join('').toUpperCase();
    }
    return companyName.substring(0, 3).toUpperCase();
};

const compileTemplate = (template, values, companySettings) => {
    return template
        .replace(/{name}/g, values.recipientName || '[Name]')
        .replace(/{designation}/g, values.designation || '[Designation]')
        .replace(/{new_designation}/g, values.newDesignation || '[New Designation]')
        .replace(/{company}/g, companySettings?.companyName || 'the company')
        .replace(/{salary}/g, values.salary ? formatSalary(values.salary) : '[Salary]')
        .replace(/{current_salary}/g, values.currentSalary ? formatSalary(values.currentSalary) : '[Current Salary]')
        .replace(/{joining_date}/g, values.joiningDate ? formatDate(values.joiningDate) : '[Joining Date]')
        .replace(/{relieving_date}/g, values.relievingDate ? formatDate(values.relievingDate) : '[Relieving Date]')
        .replace(/{employee_id}/g, values.employeeIdCode || '[Employee ID]')
        .replace(/{department}/g, values.department || '[Department]')
        .replace(/{employment_type}/g, values.employmentType || '[Employment Type]')
        .replace(/{reporting_manager}/g, values.reportingManager || '[Reporting Manager]')
        .replace(/{work_location}/g, values.workLocation || '[Work Location]');
};

const getPrintableContent = (letter, companySettings) => {
    const metadata = letter.metadata || {};
    if (TEMPLATE_CONTENTS[letter.type]) {
        return compileTemplate(TEMPLATE_CONTENTS[letter.type], {
            recipientName: letter.recipientName,
            designation: metadata.designation,
            newDesignation: metadata.newDesignation,
            salary: metadata.salary,
            joiningDate: metadata.joiningDate,
            relievingDate: metadata.relievingDate,
            employeeIdCode: metadata.employeeIdCode,
            department: metadata.department,
            employmentType: metadata.employmentType,
            reportingManager: metadata.reportingManager,
            workLocation: metadata.workLocation,
            currentSalary: metadata.currentSalary
        }, companySettings);
    }

    const shouldRefreshContent = TEMPLATE_CONTENTS[letter.type] && (
        !letter.content ||
        letter.content.includes('â‚¹') ||
        letter.content.includes('our company') ||
        letter.content.includes('Your full and final settlement has been processed and completed')
    );

    if (!shouldRefreshContent) {
        return letter.content;
    }

    return compileTemplate(TEMPLATE_CONTENTS[letter.type], {
        recipientName: letter.recipientName,
        designation: metadata.designation,
        newDesignation: metadata.newDesignation,
        salary: metadata.salary,
        joiningDate: metadata.joiningDate,
        relievingDate: metadata.relievingDate,
        employeeIdCode: metadata.employeeIdCode,
        department: metadata.department,
        employmentType: metadata.employmentType,
        reportingManager: metadata.reportingManager,
        workLocation: metadata.workLocation,
        currentSalary: metadata.currentSalary
    }, companySettings);
};

const getAddressString = (companySettings) => {
    if (!companySettings?.address) return '';
    const addr = companySettings.address;
    return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
};

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toParagraphs = (text) => text
    .split('\n\n')
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');

const getLetterTitle = (type) => ({
    offer: 'Offer of Employment',
    appointment: 'Appointment Letter',
    increment: 'Salary Revision Letter',
    promotion: 'Promotion and Role Revision Letter',
    salary_certificate: 'Salary Certificate',
    experience: 'Experience Certificate',
    relieving: 'Relieving Letter'
}[type] || 'HR Letter');

const buildProfessionalLetterHtml = (letter, companySettings) => {
    const companyName = companySettings?.companyName || 'OUR COMPANY';
    
    // Address components
    const address = companySettings?.address || {};
    const companyAddressString = [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ') || '';
    
    const companyEmail = companySettings?.email || '';
    let companyWebsite = companySettings?.website || '';
    if (companyWebsite) {
        try {
            let cleanUrl = companyWebsite.trim();
            if (!/^https?:\/\//i.test(cleanUrl)) {
                cleanUrl = 'http://' + cleanUrl;
            }
            const parsed = new URL(cleanUrl);
            if (parsed.hostname.includes('google.com') && parsed.searchParams.get('q')) {
                companyWebsite = parsed.searchParams.get('q');
            } else {
                companyWebsite = parsed.hostname.replace(/^www\./i, '');
            }
        } catch (e) {
            companyWebsite = companyWebsite.split('?')[0].replace(/^www\./i, '');
        }
    }
    const companyTagline = companySettings?.tagline || '';

    const content = getPrintableContent(letter, companySettings);
    const title = getLetterTitle(letter.type);
    
    const metadata = letter.metadata || {};
    const designation = metadata.designation || '[Designation]';
    const newDesignation = metadata.newDesignation || '[New Designation]';
    const salary = metadata.salary || '';
    const currentSalary = metadata.currentSalary || '';
    const joiningDate = metadata.joiningDate || '';
    const relievingDate = metadata.relievingDate || '';
    const employeeIdCode = metadata.employeeIdCode || 'EMP001';
    const department = metadata.department || 'Development';
    const employmentType = metadata.employmentType || 'Full-Time';
    const reportingManager = metadata.reportingManager || 'Development Head';
    const workLocation = metadata.workLocation || 'Nashik';

    const prefix = getCompanyPrefix(companyName);
    const stamp = letter.createdAt ? new Date(letter.createdAt) : new Date();
    const formattedStamp = [
        stamp.getFullYear(),
        String(stamp.getMonth() + 1).padStart(2, '0'),
        String(stamp.getDate()).padStart(2, '0')
    ].join('');
    
    let referenceNumber = '';
    if (letter.type === 'offer') {
        referenceNumber = `${prefix}/OFFER/${stamp.getFullYear()}/${formattedStamp.slice(-4)}`;
    } else if (letter.type === 'increment') {
        referenceNumber = `${prefix}/HR/INC/${stamp.getFullYear()}/${formattedStamp.slice(-4)}`;
    } else {
        referenceNumber = `${prefix}/HR/${letter.type?.toUpperCase().replace(/_/g, '-')}/${formattedStamp}`;
    }

    const isOfferOrAppt = ['offer', 'appointment'].includes(letter.type);
    const isIncOrProm = ['increment', 'promotion'].includes(letter.type);
    const isSalaryCert = letter.type === 'salary_certificate';
    const isRelieving = letter.type === 'relieving';

    const letterheadHtml = `
        <div class="header-letterhead">
            <div class="logo-area">
                ${companySettings?.logoUrl ? `
                    <img src="${escapeHtml(resolveImageUrl(companySettings.logoUrl))}" alt="Logo" style="height: 48px; max-width: 200px; object-fit: contain; display: block;" />
                ` : `
                    <h2 style="font-size: 26px; font-weight: 800; color: #1e3a8a; margin: 0; font-family: 'Poppins', sans-serif; letter-spacing: -0.5px;">${escapeHtml(companyName)}</h2>
                `}
                ${companyTagline ? `<p style="font-size: 10px; color: #6b7280; margin-top: 2px; font-weight: 500;">${escapeHtml(companyTagline)}</p>` : ''}
            </div>
            <div class="company-info-area">
                <strong style="color: #111827; font-size: 13px; font-weight: 700;">${escapeHtml(companyName)}</strong><br />
                ${companyAddressString ? `${escapeHtml(companyAddressString)}<br />` : ''}
                ${companyEmail ? `Email: ${escapeHtml(companyEmail)}` : ''} ${companyWebsite ? ` | Web: ${escapeHtml(companyWebsite)}` : ''}
            </div>
        </div>
    `;

    let templateHtml = '';

    if (isOfferOrAppt) {
        templateHtml = `
            <div class="top-bar"></div>
            <div class="content-wrapper">
                ${letterheadHtml}
                
                <div class="title-offer">
                    <h1>${escapeHtml(title.toUpperCase())}</h1>
                    <div class="subtitle">We are delighted to welcome you to our organization</div>
                </div>

                <div class="reference-offer">
                    <div class="ref-box">
                        <label>Issue Date</label>
                        <strong>${escapeHtml(formatDate(letter.createdAt || new Date()))}</strong>
                    </div>
                    <div class="ref-box">
                        <label>Reference Number</label>
                        <strong>${escapeHtml(referenceNumber)}</strong>
                    </div>
                </div>

                <div class="card-offer">
                    <div class="card-header">Candidate Information</div>
                    <div class="details-grid">
                        <div class="label-col">Candidate Name</div>
                        <div>${escapeHtml(letter.recipientName)}</div>
                        <div class="label-col">Email Address</div>
                        <div>${escapeHtml(letter.recipientEmail || '-')}</div>
                        <div class="label-col">Position</div>
                        <div>${escapeHtml(designation)}</div>
                        <div class="label-col">Department</div>
                        <div>${escapeHtml(department)}</div>
                        <div class="label-col">Employment Type</div>
                        <div>${escapeHtml(employmentType)}</div>
                        <div class="label-col">Joining Date</div>
                        <div>${escapeHtml(formatDate(joiningDate))}</div>
                        <div class="label-col">Reporting Manager</div>
                        <div>${escapeHtml(reportingManager)}</div>
                        <div class="label-col">Work Location</div>
                        <div>${escapeHtml(workLocation)}</div>
                    </div>
                </div>

                <div class="content-body text-justify">
                    ${toParagraphs(content)}
                </div>

                ${salary ? `
                <div class="salary-offer">
                    <h3>Monthly Gross Salary</h3>
                    <h1>₹${formatSalary(salary)}</h1>
                    <p>Effective from your joining date</p>
                </div>
                ` : ''}

                <div class="terms-offer">
                    <h3>Employment Terms</h3>
                    <ul>
                        <li>Your employment is subject to successful document verification.</li>
                        <li>You will initially be on probation as per company policy.</li>
                        <li>All company policies, confidentiality, and code of conduct must be followed.</li>
                        <li>Your compensation is subject to statutory deductions.</li>
                        <li>This offer is valid for seven days from the issue date.</li>
                    </ul>
                </div>

                <div class="acceptance-offer">
                    Kindly sign and return this offer letter as a token of your acceptance. We look forward to welcoming you to our team.
                </div>

                <div class="footer-signatures">
                    <div class="sign-block">
                        <div class="sign-line">Authorized Signatory</div>
                    </div>
                    <div class="sign-block">
                        <div class="sign-line">Candidate Signature</div>
                    </div>
                </div>
            </div>
            <div class="bottom-copyright">
                © ${new Date().getFullYear()} ${escapeHtml(companyName)} | This document is confidential and intended solely for the addressed recipient.
            </div>
        `;
    } else if (isIncOrProm) {
        templateHtml = `
            <div class="content-wrapper">
                ${letterheadHtml}

                <div class="top-row-inc">
                    <div>
                        <b>Letter Date</b><br>
                        ${escapeHtml(formatDate(letter.createdAt || new Date()))}
                    </div>
                    <div>
                        <b>Reference No.</b><br>
                        ${escapeHtml(referenceNumber)}
                    </div>
                </div>

                <div class="employee-grid-inc">
                    <b>Employee Name</b>
                    <span>${escapeHtml(letter.recipientName)}</span>
                    <b>Employee ID</b>
                    <span>${escapeHtml(employeeIdCode)}</span>
                    <b>Designation</b>
                    <span>${escapeHtml(designation)}</span>
                    <b>Department</b>
                    <span>${escapeHtml(department)}</span>
                </div>

                <div class="subject-inc">
                    Subject : ${escapeHtml(title)}
                </div>

                <div class="content-body text-justify">
                    ${toParagraphs(content)}
                </div>

                ${salary ? `
                <div class="salary-box-inc">
                    <table>
                        <tr>
                            <th>Salary Revision Details</th>
                            <th>Information</th>
                        </tr>
                        ${currentSalary ? `
                        <tr>
                            <td>Current Gross Salary</td>
                            <td>₹${formatSalary(currentSalary)}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td>Revised Gross Salary</td>
                            <td class="highlight-green">₹${formatSalary(salary)}</td>
                        </tr>
                        <tr>
                            <td>Effective From</td>
                            <td>${escapeHtml(formatDate(joiningDate))}</td>
                        </tr>
                    </table>
                </div>
                ` : ''}

                <div class="conditions-inc">
                    <h3>Terms & Conditions</h3>
                    <ul>
                        <li>This revised salary shall be effective from the above-mentioned date.</li>
                        <li>All existing employment terms and company policies remain unchanged.</li>
                        <li>This letter forms a part of your employment records.</li>
                        <li>The contents of this document are confidential.</li>
                        <li>The revised salary will be reflected in your payroll from the effective date.</li>
                    </ul>
                </div>

                <div class="note-inc">
                    <strong>Congratulations!</strong><br>
                    The Management appreciates your sincere efforts and wishes you continued success in your career with us.
                </div>

                <div class="footer-signatures">
                    <div class="sign-block">
                        <div class="sign-line">Authorized Signatory</div>
                    </div>
                    <div class="sign-block">
                        <div class="sign-line">Employee Acceptance</div>
                    </div>
                </div>
            </div>
            <div class="bottom-copyright">
                © ${new Date().getFullYear()} ${escapeHtml(companyName)} | Confidential Document
            </div>
        `;
    } else {
        templateHtml = `
            <div class="content-wrapper">
                ${letterheadHtml}

                <div class="top-row-inc">
                    <div>
                        <b>Date</b><br>
                        ${escapeHtml(formatDate(letter.createdAt || new Date()))}
                    </div>
                    <div>
                        <b>Reference No.</b><br>
                        ${escapeHtml(referenceNumber)}
                    </div>
                </div>

                <div class="employee-grid-inc">
                    <b>Employee Name</b>
                    <span>${escapeHtml(letter.recipientName)}</span>
                    <b>Employee ID</b>
                    <span>${escapeHtml(employeeIdCode)}</span>
                    <b>Designation</b>
                    <span>${escapeHtml(designation)}</span>
                    <b>Department</b>
                    <span>${escapeHtml(department)}</span>
                </div>

                <div class="subject-inc">
                    ${escapeHtml(title.toUpperCase())}
                </div>

                <div class="content-body text-justify">
                    ${toParagraphs(content)}
                </div>

                ${isSalaryCert && salary ? `
                <div class="salary-box-inc">
                    <table>
                        <tr>
                            <th>Salary Details</th>
                            <th>Monthly Gross Compensation</th>
                        </tr>
                        <tr>
                            <td>Current Salary</td>
                            <td class="highlight-green">₹${formatSalary(salary)}</td>
                        </tr>
                    </table>
                </div>
                ` : ''}

                <div class="footer-signatures" style="margin-top: 45px;">
                    <div class="sign-block">
                        <div class="sign-line">Authorized Signatory</div>
                    </div>
                    ${isRelieving ? `
                    <div class="sign-block">
                        <div class="sign-line">Employee Acknowledgment</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="bottom-copyright">
                © ${new Date().getFullYear()} ${escapeHtml(companyName)} | Official Verification Record
            </div>
        `;
    }

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
        
        @page {
            size: A4 portrait;
            margin: 0;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body, html {
            background: #fff;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
            font-family: 'Poppins', 'Inter', Arial, sans-serif;
            color: #111827;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .page-container {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background: #fff;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
        }
        
        .content-wrapper {
            padding: 20mm 20mm 15mm 20mm;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            overflow: hidden;
        }
        
        .header-letterhead {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 12px;
            margin-bottom: 18px;
        }
        
        .header-letterhead .logo-area {
            flex-grow: 1;
        }
        
        .header-letterhead .company-info-area {
            text-align: right;
            font-size: 11px;
            color: #4b5563;
            line-height: 1.45;
            font-family: 'Inter', sans-serif;
        }
        
        .top-bar {
            height: 6px;
            background: linear-gradient(90deg, #2563eb, #1d4ed8, #3b82f6);
        }
        
        .title-offer {
            text-align: center;
            margin-bottom: 15px;
        }
        .title-offer h1 {
            font-size: 24px;
            color: #111827;
            letter-spacing: 0.5px;
            font-weight: 700;
        }
        .title-offer .subtitle {
            margin-top: 4px;
            color: #6b7280;
            font-size: 12px;
            font-weight: 500;
        }
        
        .reference-offer {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .reference-offer .ref-box {
            background: #f8fafc;
            padding: 10px 15px;
            border-radius: 8px;
            width: 48%;
            border: 1px solid #dbeafe;
        }
        .reference-offer .ref-box label {
            display: block;
            font-size: 10px;
            color: #6b7280;
            margin-bottom: 2px;
            text-transform: uppercase;
            font-weight: 750;
            letter-spacing: 0.5px;
        }
        .reference-offer .ref-box strong {
            font-size: 13px;
            color: #1e3a8a;
        }
        
        .card-offer {
            border-radius: 10px;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            margin-bottom: 15px;
        }
        .card-offer .card-header {
            background: #2563eb;
            color: #fff;
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 600;
        }
        .card-offer .details-grid {
            display: grid;
            grid-template-columns: 180px auto;
            padding: 10px 18px;
            font-size: 12px;
        }
        .card-offer .details-grid div {
            padding: 6px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .card-offer .details-grid div:nth-last-child(-n+2) {
            border-bottom: none;
        }
        .card-offer .details-grid .label-col {
            font-weight: 600;
            color: #374151;
        }
        
        .salary-offer {
            background: #eff6ff;
            border: 2px dashed #3b82f6;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            text-align: center;
        }
        .salary-offer h3 {
            color: #1d4ed8;
            margin-bottom: 4px;
            font-size: 14px;
        }
        .salary-offer h1 {
            font-size: 30px;
            color: #16a34a;
            font-weight: 700;
        }
        .salary-offer p {
            font-size: 12px;
            color: #4b5563;
            margin-top: 2px;
        }
        
        .terms-offer {
            background: #fdfdfd;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #f3f4f6;
            margin-top: 15px;
        }
        .terms-offer h3 {
            margin-bottom: 10px;
            color: #1d4ed8;
            font-size: 14px;
            font-weight: 600;
        }
        .terms-offer ul {
            padding-left: 18px;
            font-size: 12px;
        }
        .terms-offer li {
            margin-bottom: 6px;
            line-height: 1.5;
            color: #4b5563;
        }
        
        .acceptance-offer {
            margin-top: 15px;
            padding: 12px 18px;
            background: #fff8e1;
            border-left: 5px solid orange;
            line-height: 1.5;
            font-size: 12px;
            color: #4b5563;
            border-radius: 0 8px 8px 0;
        }
        
        .top-row-inc {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-size: 13px;
            color: #4b5563;
        }
        
        .employee-grid-inc {
            display: grid;
            grid-template-columns: 150px auto;
            row-gap: 8px;
            margin-bottom: 18px;
            font-size: 13px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        .employee-grid-inc b {
            color: #4b5563;
        }
        .employee-grid-inc span {
            color: #111827;
            font-weight: 600;
        }
        
        .subject-inc {
            background: #f3f6ff;
            border-left: 5px solid #1e3a8a;
            padding: 12px 18px;
            margin-bottom: 18px;
            font-size: 14px;
            font-weight: 700;
            color: #1e3a8a;
            border-radius: 0 6px 6px 0;
        }
        
        .salary-box-inc {
            background: #fafafa;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            margin: 18px 0;
        }
        .salary-box-inc table {
            width: 100%;
            border-collapse: collapse;
        }
        .salary-box-inc th {
            background: #1e3a8a;
            color: #fff;
            padding: 10px 12px;
            font-size: 13px;
            text-align: left;
        }
        .salary-box-inc td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        .salary-box-inc tr:last-child td {
            border-bottom: none;
        }
        .salary-box-inc .highlight-green {
            font-size: 18px;
            font-weight: bold;
            color: #0b8d4d;
        }
        
        .conditions-inc {
            margin-top: 15px;
        }
        .conditions-inc h3 {
            color: #1e3a8a;
            margin-bottom: 10px;
            font-size: 14px;
            font-weight: 600;
        }
        .conditions-inc ul {
            padding-left: 18px;
            font-size: 12px;
        }
        .conditions-inc li {
            margin-bottom: 6px;
            line-height: 1.5;
            color: #4b5563;
        }
        
        .note-inc {
            margin-top: 20px;
            padding: 12px;
            background: #fff8e8;
            border-left: 4px solid orange;
            font-size: 12px;
            color: #555;
            border-radius: 0 6px 6px 0;
        }
        
        .content-body {
            font-size: 13px;
            line-height: 1.6;
            color: #374151;
            margin-bottom: 15px;
            font-family: 'Inter', sans-serif;
        }
        .content-body p {
            margin-bottom: 10px;
        }
        .text-justify {
            text-align: justify;
        }
        
        .footer-signatures {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
        }
        .sign-block {
            width: 200px;
            text-align: center;
        }
        .sign-line {
            border-top: 1px solid #000;
            margin-top: 35px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 12px;
        }
        
        .bottom-copyright {
            background: #1f2937;
            color: #9ca3af;
            text-align: center;
            padding: 10px;
            font-size: 11px;
            margin-top: auto;
            width: 100%;
        }
        
        @media print {
            body, html {
                background: #fff;
                width: 210mm;
                height: 297mm;
                overflow: hidden;
            }
            .page-container {
                margin: 0;
                box-shadow: none;
                width: 210mm;
                height: 297mm;
                overflow: hidden;
            }
        }
    </style>
</head>
<body>
    <div class="page-container">
        ${templateHtml}
    </div>
</body>
</html>`;
};

const PayrollLetters = () => {
    const [letters, setLetters] = useState([]);
    const [companySettings, setCompanySettings] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Custom Confirm Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    // Form inputs
    const [letterForm, setLetterForm] = useState({
        employeeId: '',
        type: 'offer',
        recipientName: '',
        recipientEmail: '',
        designation: '',
        joiningDate: '',
        relievingDate: '',
        salary: '',
        newDesignation: '',
        employeeIdCode: '',
        department: '',
        employmentType: 'Full-Time',
        reportingManager: 'Development Head',
        workLocation: 'Nashik',
        currentSalary: '',
        content: ''
    });

    const [pdfGeneratingId, setPdfGeneratingId] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [lettersRes, companyRes, empRes] = await Promise.all([
                payrollService.getLetters(),
                companySettingsService.get(),
                payrollService.getEmployees()
            ]);
            setLetters(lettersRes.data || []);
            setCompanySettings(companyRes.data || null);
            setEmployees(empRes.data || []);
        } catch (error) {
            console.error('Failed to load letters data', error);
            toast.error('Failed to load letters panel');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Autocomplete fields when employee is selected
    const handleEmployeeSelect = (e) => {
        const empId = e.target.value;
        if (!empId) {
            setLetterForm({
                ...letterForm,
                employeeId: '',
                recipientName: '',
                recipientEmail: '',
                designation: '',
                salary: '',
                employeeIdCode: '',
                department: '',
                currentSalary: ''
            });
            return;
        }

        const emp = employees.find(x => x._id === empId);
        if (emp) {
            const gross = Object.keys(emp.salaryStructure || {}).reduce((acc, curr) => {
                const earnings = ['basic', 'hra', 'da', 'specialAllowance', 'bonus', 'incentive', 'reimbursement'];
                return earnings.includes(curr) ? acc + (emp.salaryStructure[curr] || 0) : acc;
            }, 0);

            const code = 'EMP' + emp._id.slice(-4).toUpperCase();

            setLetterForm({
                ...letterForm,
                employeeId: empId,
                recipientName: emp.name || '',
                recipientEmail: emp.email || '',
                designation: emp.designation || '',
                joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().substring(0, 10) : '',
                salary: gross || '',
                employeeIdCode: code,
                department: emp.department || '',
                currentSalary: gross || ''
            });
        }
    };

    // Compile variables on input change
    const handleFormChange = (name, value) => {
        const updatedForm = { ...letterForm, [name]: value };
        
        // Auto compile content if type or specific variables change
        const template = TEMPLATE_CONTENTS[updatedForm.type] || '';
        const compiled = compileTemplate(template, updatedForm, companySettings);

        updatedForm.content = compiled;
        setLetterForm(updatedForm);
    };

    // Compile content when switching types
    useEffect(() => {
        handleFormChange('type', letterForm.type);
    }, [letterForm.type]);

    const handleCreateLetter = async (e) => {
        e.preventDefault();
        try {
            await payrollService.createLetter({
                employeeId: letterForm.employeeId || undefined,
                type: letterForm.type,
                recipientName: letterForm.recipientName,
                recipientEmail: letterForm.recipientEmail,
                content: letterForm.content,
                metadata: {
                    designation: letterForm.designation,
                    joiningDate: letterForm.joiningDate,
                    relievingDate: letterForm.relievingDate,
                    salary: letterForm.salary,
                    newDesignation: letterForm.newDesignation,
                    employeeIdCode: letterForm.employeeIdCode,
                    department: letterForm.department,
                    employmentType: letterForm.employmentType,
                    reportingManager: letterForm.reportingManager,
                    workLocation: letterForm.workLocation,
                    currentSalary: letterForm.currentSalary
                }
            });
            toast.success('Letter generated and archived!');
            setIsCreateOpen(false);
            fetchData();
        } catch (error) {
            console.error('Failed to create letter', error);
            toast.error('Failed to generate letter');
        }
    };

    const handleDeleteLetter = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Letter Record',
            message: 'Are you sure you want to delete this generated letter from logs?',
            onConfirm: async () => {
                try {
                    await payrollService.deleteLetter(id);
                    toast.success('Letter record deleted.');
                    fetchData();
                } catch (error) {
                    console.error('Failed to delete letter', error);
                    toast.error('Failed to delete letter');
                }
            }
        });
    };

    const handlePrintLetter = (letter) => {
        try {
            setPdfGeneratingId(letter._id);
            const htmlContent = buildProfessionalLetterHtml(letter, companySettings);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                printWindow.onload = () => {
                    printWindow.focus();
                    printWindow.print();
                };
                
                // Fallback for immediate print trigger
                setTimeout(() => {
                    if (printWindow) {
                        try {
                            printWindow.focus();
                            printWindow.print();
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }, 800);
            } else {
                toast.error('Pop-up blocker is active. Please allow pop-ups to print letters.');
            }
        } catch (error) {
            console.error('Failed to print letter HTML', error);
            toast.error('Failed to print letter');
        } finally {
            setPdfGeneratingId(null);
        }
    };

    const inputClass = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
    const labelClass = "block text-xs font-bold text-slate-400 uppercase mb-1.5";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">HR Letters</h1>
                    <p className="text-slate-500 font-medium">Generate, print, and archive dynamic HR letters using placeholders.</p>
                </div>

                <button
                    onClick={() => {
                        setLetterForm({
                            employeeId: '', type: 'offer', recipientName: '', recipientEmail: '',
                            designation: '', joiningDate: '', relievingDate: '', salary: '', newDesignation: '',
                            employeeIdCode: '', department: '', employmentType: 'Full-Time',
                            reportingManager: 'Development Head', workLocation: 'Nashik', currentSalary: '',
                            content: TEMPLATE_CONTENTS.offer
                        });
                        setIsCreateOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20"
                >
                    <MdAdd size={20} />
                    Generate Letter
                </button>
            </div>

            {/* Generated Letters List */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
                {loading && letters.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
                    </div>
                ) : letters.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-bold">
                        No letters generated yet. Click "Generate Letter" to start.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 text-slate-400 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-6 py-4">Recipient</th>
                                    <th className="px-6 py-4">Letter Type</th>
                                    <th className="px-6 py-4">Generated On</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                {letters.map((l) => (
                                    <tr key={l._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 font-bold">{l.recipientName}</p>
                                            <p className="text-xs text-slate-400">{l.recipientEmail || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4 uppercase text-sm text-slate-600">
                                            {l.type?.replace(/_/g, ' ')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {formatDate(l.createdAt)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handlePrintLetter(l)}
                                                    disabled={pdfGeneratingId === l._id}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 hover:bg-primary-650 hover:text-white text-primary-700 rounded-xl transition-all text-xs font-black"
                                                >
                                                    {pdfGeneratingId === l._id ? 'Generating...' : (
                                                        <>
                                                            <MdPictureAsPdf size={14} /> Print
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLetter(l._id)}
                                                    className="p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition-all"
                                                >
                                                    <MdDelete size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Generate Letter Modal */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Generate HR Letter"
                maxWidth="max-w-4xl"
            >
                            <form onSubmit={handleCreateLetter} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelClass}>Link Existing Employee</label>
                                        <select
                                            value={letterForm.employeeId}
                                            onChange={handleEmployeeSelect}
                                            className={inputClass}
                                        >
                                            <option value="">-- Manual entry (Not linked) --</option>
                                            {employees.map(e => (
                                                <option key={e._id} value={e._id}>{e.name} ({e.designation})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Letter Type</label>
                                        <select
                                            value={letterForm.type}
                                            onChange={(e) => handleFormChange('type', e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="offer">Offer Letter</option>
                                            <option value="appointment">Appointment Letter</option>
                                            <option value="increment">Increment Letter</option>
                                            <option value="promotion">Promotion Letter</option>
                                            <option value="salary_certificate">Salary Certificate</option>
                                            <option value="experience">Experience Letter</option>
                                            <option value="relieving">Relieving Letter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Recipient Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={letterForm.recipientName}
                                            onChange={(e) => handleFormChange('recipientName', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Ramesh Sharma"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Employee ID Code</label>
                                        <input
                                            type="text"
                                            value={letterForm.employeeIdCode}
                                            onChange={(e) => handleFormChange('employeeIdCode', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. EMP001"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelClass}>Recipient Email</label>
                                        <input
                                            type="email"
                                            value={letterForm.recipientEmail}
                                            onChange={(e) => handleFormChange('recipientEmail', e.target.value)}
                                            className={inputClass}
                                            placeholder="ramesh@company.com"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Department</label>
                                        <input
                                            type="text"
                                            value={letterForm.department}
                                            onChange={(e) => handleFormChange('department', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Development"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Current Designation</label>
                                        <input
                                            type="text"
                                            value={letterForm.designation}
                                            onChange={(e) => handleFormChange('designation', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Executive"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Proposed Designation / New Role</label>
                                        <input
                                            type="text"
                                            value={letterForm.newDesignation}
                                            onChange={(e) => handleFormChange('newDesignation', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Senior Associate"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className={labelClass}>Employment Type</label>
                                        <select
                                            value={letterForm.employmentType}
                                            onChange={(e) => handleFormChange('employmentType', e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="Full-Time">Full-Time</option>
                                            <option value="Part-Time">Part-Time</option>
                                            <option value="Internship">Internship</option>
                                            <option value="Contract">Contract</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Reporting Manager</label>
                                        <input
                                            type="text"
                                            value={letterForm.reportingManager}
                                            onChange={(e) => handleFormChange('reportingManager', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Development Head"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Work Location</label>
                                        <input
                                            type="text"
                                            value={letterForm.workLocation}
                                            onChange={(e) => handleFormChange('workLocation', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Nashik"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Date of Joining / Revision Date</label>
                                        <input
                                            type="date"
                                            value={letterForm.joiningDate}
                                            onChange={(e) => handleFormChange('joiningDate', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Relieving Date</label>
                                        <input
                                            type="date"
                                            value={letterForm.relievingDate}
                                            onChange={(e) => handleFormChange('relievingDate', e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Current Gross (Salary)</label>
                                        <input
                                            type="number"
                                            value={letterForm.currentSalary}
                                            onChange={(e) => handleFormChange('currentSalary', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. 25000"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Proposed Monthly Gross (Salary)</label>
                                        <input
                                            type="number"
                                            value={letterForm.salary}
                                            onChange={(e) => handleFormChange('salary', e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. 28873"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>Generated Content Preview & Edit</label>
                                    <textarea
                                        rows={8}
                                        value={letterForm.content}
                                        onChange={(e) => setLetterForm({ ...letterForm, content: e.target.value })}
                                        className={`${inputClass} resize-none font-sans leading-relaxed`}
                                    />
                                </div>

                                <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateOpen(false)}
                                        className="px-6 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                                    >
                                        <MdSave size={18} />
                                        Generate & Archive
                                    </button>
                                </div>
                            </form>
            </Modal>

            {/* Confirm Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={confirmModal.title}
                maxWidth="max-w-md"
            >
                <div className="space-y-6">
                    <p className="text-slate-650 font-medium leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                        <button
                            type="button"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="px-5 py-2.5 border border-slate-200 text-slate-650 font-bold rounded-xl hover:bg-slate-50 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (confirmModal.onConfirm) confirmModal.onConfirm();
                                setConfirmModal({ ...confirmModal, isOpen: false });
                            }}
                            className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 text-sm shadow-lg shadow-primary-600/20"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PayrollLetters;
