import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import './DashboardClock.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n) => String(n).padStart(2, '0');

// Hour marks at 12, 1, 2 ... 11 o'clock, on a 200 x 200 face centred at (100, 100).
const TICKS = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const point = (r) => [100 + r * Math.sin(angle), 100 - r * Math.cos(angle)];
    const [x1, y1] = point(78);
    const [x2, y2] = point(92);
    return { x1, y1, x2, y2 };
});

// Sets the hands and text of the clock elements in `parts` to the current time; returns that time.
const paintClock = (parts) => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const rotate = (element, degrees) => element?.setAttribute('transform', `rotate(${degrees} 100 100)`);
    rotate(parts.second, s * 6);
    rotate(parts.minute, (m + s / 60) * 6);
    rotate(parts.hour, ((h % 12) + m / 60) * 30);
    if (parts.hoursMinutes) parts.hoursMinutes.textContent = `${pad(h)}:${pad(m)}`;
    if (parts.seconds) parts.seconds.textContent = pad(s);
    const date = `${DAYS[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    if (parts.date && parts.date.textContent !== date) parts.date.textContent = date;
    return now;
};

/**
 * Analog clock with a digital readout and the date, in the browser's local time.
 *
 * It repaints once a second, on the second, by setting the hands and text directly: nothing
 * re-renders and nothing runs between ticks. Each tick reads the current time, so a late timer
 * (a background tab) never leaves the clock behind, and it repaints as soon as the tab is shown.
 */
const DashboardClock = () => {
    const glowId = `arcrm-clock-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const parts = useRef({});
    const part = (name) => (element) => { parts.current[name] = element; };

    // First paint before the browser draws, so the clock never shows a blank or wrong time.
    useLayoutEffect(() => { paintClock(parts.current); }, []);

    useEffect(() => {
        let timer;
        const tick = () => {
            const now = paintClock(parts.current);
            timer = setTimeout(tick, 1000 - now.getMilliseconds());
        };
        const restart = () => {
            clearTimeout(timer);
            if (!document.hidden) tick();
        };
        tick();
        document.addEventListener('visibilitychange', restart);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', restart);
        };
    }, []);

    return (
        <div className="arcrm-clock" role="timer" aria-label="Current time">
            <div className="arcrm-clock__body">
                <svg className="arcrm-clock__face" viewBox="0 0 200 200" aria-hidden="true">
                    <defs>
                        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="2" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>
                    <g filter={`url(#${glowId})`} stroke="#cfe6ff" strokeLinecap="round" strokeWidth="3">
                        {TICKS.map((tick, i) => <line key={i} {...tick} />)}
                    </g>
                    <g filter={`url(#${glowId})`} strokeLinecap="round">
                        <line ref={part('hour')} x1="100" y1="112" x2="100" y2="58" stroke="#ffffff" strokeWidth="4" />
                        <line ref={part('minute')} x1="100" y1="116" x2="100" y2="34" stroke="#ffffff" strokeWidth="3" />
                        <line ref={part('second')} x1="100" y1="116" x2="100" y2="26" stroke="#ff4f93" strokeWidth="1.6" />
                    </g>
                    <circle cx="100" cy="100" r="3.5" fill="#ff4f93" />
                </svg>

                <div className="arcrm-clock__digital">
                    <div className="arcrm-clock__time">
                        <span ref={part('hoursMinutes')} />
                        <span ref={part('seconds')} className="arcrm-clock__sec" />
                    </div>
                    <div ref={part('date')} className="arcrm-clock__date" />
                </div>
            </div>
        </div>
    );
};

export default DashboardClock;
