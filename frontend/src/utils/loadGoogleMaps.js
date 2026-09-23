/**
 * Loads the Google Maps JS API on demand.
 *
 * The script used to sit in index.html, so every page load - including the login
 * screen - fetched it and its half-dozen sub-scripts. Only the screens that use
 * Places autocomplete or the Geocoder need it, so they call this instead.
 *
 * Safe to call repeatedly: the script is injected once and the same promise is reused.
 * Resolves to false when no API key is configured or the script fails to load, so
 * callers keep their existing `if (window.google && ...)` fallbacks.
 */
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDJeMis1L5Dlg1c22uhKBZqYq2W5MJ2ezU';
const SCRIPT_ID = 'google-maps-js-api';

let loaderPromise = null;

export const loadGoogleMaps = () => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (window.google?.maps?.places) return Promise.resolve(true);
    if (loaderPromise) return loaderPromise;

    loaderPromise = new Promise((resolve) => {
        if (!API_KEY) {
            resolve(false);
            return;
        }

        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
            existing.addEventListener('load', () => resolve(true));
            existing.addEventListener('error', () => resolve(false));
            return;
        }

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => {
            loaderPromise = null; // allow a retry on the next call
            resolve(false);
        };
        document.head.appendChild(script);
    });

    return loaderPromise;
};

export default loadGoogleMaps;
