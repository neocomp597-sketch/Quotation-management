import React from 'react';

/**
 * Stelmec "Why Why Analysis Sheet (Maintenance)" - the printed RCA report.
 *
 * The layout follows the controlled form cell for cell, so a download or a print comes out
 * the way the paper sheet does. Everything is styled inline in plain hex and pixel units:
 * html2canvas draws this node into the PDF and does not understand modern colour functions,
 * and the fixed width keeps the proportions whatever the screen is.
 */

const SHEET_WIDTH = 1120;

const BORDER = '1px solid #000000';
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

const cell = (extra = {}) => ({
    border: BORDER,
    padding: '3px 5px',
    verticalAlign: 'top',
    fontFamily: FONT,
    fontSize: '12px',
    color: '#000000',
    ...extra
});

const label = { fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' };
const value = { fontWeight: 400, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' };

/** A label with what was filled in beside it, the way the sheet is written on. */
const Filled = ({ text, children, block = false }) => (
    <>
        <span style={label}>{text}</span>
        {block
            ? <div style={{ ...value, marginTop: '4px' }}>{children || ''}</div>
            : <span style={{ ...value, marginLeft: '6px' }}>{children || ''}</span>}
    </>
);

/** One of the five root causes, ticked when it is the one chosen. */
const ReasonRow = ({ text, chosen, style = {} }) => (
    <>
        <td style={cell({ fontWeight: 700, ...style })}>{text}</td>
        <td style={cell({ textAlign: 'center', fontWeight: 700, fontSize: '15px', ...style })}>
            {chosen ? 'X' : ''}
        </td>
    </>
);

const WhyWhySheet = ({ data = {}, logo = null, companyName = '' }) => {
    const whys = Array.isArray(data.fiveWhys) && data.fiveWhys.length
        ? data.fiveWhys
        : [1, 2, 3, 4, 5].map((whyNo) => ({ whyNo, analysis: '' }));
    const reason = data.rootCauseReason || '';
    const whyRow = (index) => whys[index]?.analysis || '';
    // The why block is one open area on the paper sheet, so the rules between Why 1 and
    // Why 5 are taken out while the rows themselves keep the labels aligned.
    const whyEdges = (index) => ({
        ...(index > 0 ? { borderTop: 'none' } : {}),
        ...(index < 4 ? { borderBottom: 'none' } : {})
    });

    return (
        <table
            style={{
                width: `${SHEET_WIDTH}px`,
                borderCollapse: 'collapse',
                border: '2px solid #000000',
                background: '#ffffff',
                tableLayout: 'fixed'
            }}
        >
            {/* Shares of the width rather than pixels: printing narrows the sheet and the
                columns have to keep their proportions instead of being cut off. */}
            <colgroup>
                <col style={{ width: '6.25%' }} />
                <col style={{ width: '32.14%' }} />
                <col style={{ width: '38.39%' }} />
                <col style={{ width: '19.11%' }} />
                <col style={{ width: '4.11%' }} />
            </colgroup>
            <tbody>
                {/* Title, department and the company logo */}
                <tr>
                    <td colSpan={2} rowSpan={2} style={cell({ verticalAlign: 'middle', padding: '6px 8px' })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: '42px', height: '42px', border: '1px solid #000000', borderRadius: '3px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: '13px', letterSpacing: '0.5px', flexShrink: 0
                            }}>
                                TPM
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '19px', lineHeight: 1.2 }}>
                                Why Why Analysis Sheet<br />(Maintenance)
                            </div>
                        </div>
                    </td>
                    <td style={cell({ height: '30px' })}><Filled text="Dept Name :">{data.department}</Filled></td>
                    <td colSpan={2} rowSpan={2} style={cell({ textAlign: 'center', verticalAlign: 'middle' })}>
                        {logo
                            ? <img src={logo} alt={companyName || 'Company'} crossOrigin="anonymous" style={{ maxHeight: '44px', maxWidth: '96%', objectFit: 'contain' }} />
                            : <span style={{ fontWeight: 700, fontSize: '16px' }}>{companyName}</span>}
                    </td>
                </tr>
                <tr>
                    <td style={cell({ height: '30px' })}><Filled text="Section / Cell :">{data.sectionCell}</Filled></td>
                </tr>

                {/* Machine, date of breakdown and the list of five root causes */}
                <tr>
                    <td colSpan={2} style={cell({ height: '26px' })}><Filled text="Machine No. :">{data.machineNo}</Filled></td>
                    <td rowSpan={2} style={cell()}><Filled text="Date of Breakdown :">{data.breakdownDate}</Filled></td>
                    <td colSpan={2} rowSpan={2} style={cell({ fontWeight: 700, verticalAlign: 'middle' })}>
                        Root Cause is always from the following 5 reasons
                    </td>
                </tr>
                <tr>
                    <td colSpan={2} style={cell({ height: '26px' })}><Filled text="Machine Description :">{data.machineDescription}</Filled></td>
                </tr>

                {/* Breakdown, symptom and the five reasons down the right */}
                <tr>
                    <td colSpan={3} rowSpan={2} style={cell({ height: '134px' })}>
                        <Filled text="Breakdown (Physical Phenomenon) :" block>{data.problemStatement}</Filled>
                    </td>
                    <ReasonRow text="1. Poor Basic Condition" chosen={reason === 'Poor Basic Condition'} style={{ height: '67px' }} />
                </tr>
                <tr>
                    <ReasonRow text="2. Poor Operating Condition" chosen={reason === 'Poor Operating Condition'} style={{ height: '67px' }} />
                </tr>
                <tr>
                    <td colSpan={3} style={cell({ height: '64px' })}>
                        <Filled text="Symptom Before Breakdown :" block>{data.symptomBeforeBreakdown}</Filled>
                    </td>
                    <ReasonRow text="3. Deterioration" chosen={reason === 'Deterioration'} style={{ height: '64px' }} />
                </tr>

                {/* Spare part replacement and the final countermeasure */}
                <tr>
                    <td style={cell({ textAlign: 'center', verticalAlign: 'middle', height: '62px' })}>
                        <span style={{
                            display: 'inline-block', width: '44px', height: '16px',
                            border: '1px solid #000000',
                            background: data.sparePartReplaced ? '#000000' : '#ffffff'
                        }} />
                    </td>
                    <td style={cell({ fontWeight: 700, verticalAlign: 'middle' })}>In case of spare part replacement</td>
                    <td rowSpan={2} style={cell()}>
                        <Filled text="What is your final Action or Countermeasure :" block>{data.finalCountermeasure}</Filled>
                    </td>
                    <ReasonRow text="4. Weak Design" chosen={reason === 'Weak Design'} style={{ height: '62px' }} />
                </tr>
                <tr>
                    <td style={cell({ textAlign: 'center', verticalAlign: 'middle', height: '62px' })}>
                        <span style={{
                            display: 'inline-block', width: '44px', height: '16px',
                            border: '1px solid #000000',
                            background: data.sparePartReplaced ? '#ffffff' : '#000000'
                        }} />
                    </td>
                    <td style={cell({ fontWeight: 700, verticalAlign: 'middle' })}>In case of no spare part replacement</td>
                    <ReasonRow text="5. Poor Skill" chosen={reason === 'Poor Skill'} style={{ height: '62px' }} />
                </tr>

                {/* The five whys, with what they were due to, and the kaizen column */}
                <tr>
                    <td style={cell({ height: '58px' })} />
                    <td style={cell()}>
                        <div style={label}>Why did you take above countermeasure</div>
                        <div style={{ fontSize: '10px', marginTop: '6px' }}>(Always ask first why to the final action taken)</div>
                    </td>
                    <td rowSpan={6} style={cell()}>
                        <Filled text="Due to :" block>{data.dueTo}</Filled>
                    </td>
                    <td colSpan={2} style={cell({ verticalAlign: 'bottom' })}>
                        <span style={{ ...label, textDecoration: 'underline' }}>Kaizen Idea &amp; Schedule</span>
                    </td>
                </tr>
                {[0, 1, 2, 3, 4].map((index) => (
                    <tr key={index}>
                        <td style={cell({ ...whyEdges(index), height: '42px', fontWeight: 700 })}>Why {index + 1}</td>
                        <td style={cell({ ...whyEdges(index), ...value })}>{whyRow(index)}</td>
                        {index === 0 && (
                            <td colSpan={2} rowSpan={4} style={cell()}>
                                <Filled text="Kaizen Idea :" block>{data.kaizenIdea}</Filled>
                            </td>
                        )}
                        {index === 4 && (
                            <td colSpan={2} style={cell({ fontWeight: 700 })}>
                                <Filled text="In-Charge :">{data.inCharge}</Filled>
                            </td>
                        )}
                    </tr>
                ))}

                {/* What was not done, what was done on the day, and when the kaizen is due */}
                <tr>
                    <td colSpan={2} style={cell({ height: '64px' })}>
                        <Filled text="You Did not :" block>{data.youDidNot}</Filled>
                    </td>
                    <td style={cell()}>
                        <Filled text={'Action or Countermeasure "That Day" :'} block>{data.actionThatDay}</Filled>
                    </td>
                    <td colSpan={2} style={cell()}>
                        <Filled text="Schedule :" block>{data.schedule}</Filled>
                    </td>
                </tr>
            </tbody>
        </table>
    );
};

export { SHEET_WIDTH };
export default WhyWhySheet;
