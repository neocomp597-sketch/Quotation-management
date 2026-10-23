import { loadGoogleMaps } from './loadGoogleMaps';

// Turns a GPS fix into a street address and a short area name, trying Google Maps,
// Photon, Nominatim and BigDataCloud in turn. Used by service visit check-in/out
// and by field attendance.
export const fetchAccurateLocation = async (lat, lng) => {
    let detailedAddress = '';
    let detailedArea = '';

    // The Maps API is fetched on demand (it is no longer loaded by index.html);
    // if it is unavailable we fall through to the OpenStreetMap lookup below.
    await loadGoogleMaps().catch(() => false);

    // 1. Google Maps JS API Geocoder (if available)
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
        try {
            const geocoder = new window.google.maps.Geocoder();
            const result = await new Promise((resolve) => {
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                        resolve(results[0].formatted_address);
                    } else {
                        resolve(null);
                    }
                });
            });
            if (result) {
                detailedAddress = result;
                detailedArea = result.split(',').slice(0, 2).join(', ').trim();
            }
        } catch (gErr) {
            console.warn('Google Maps Geocoder error:', gErr);
        }
    }

    // 2. Photon (Komoot Reverse Geocoding API based on OSM)
    if (!detailedAddress) {
        try {
            const pRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
            if (pRes.ok) {
                const pData = await pRes.json();
                if (pData?.features?.length > 0) {
                    const props = pData.features[0].properties || {};
                    const name = props.name || props.housenumber || '';
                    const street = props.street || '';
                    const district = props.district || props.suburb || props.neighbourhood || props.quarter || '';
                    const city = props.city || props.town || props.county || '';
                    const state = props.state || '';
                    const postcode = props.postcode ? ` - ${props.postcode}` : '';

                    const parts = [name, street, district, city, state ? `${state}${postcode}` : postcode].filter(Boolean);
                    if (parts.length >= 2) {
                        detailedAddress = parts.join(', ');
                        detailedArea = [name || street, district || city].filter(Boolean).join(', ');
                    }
                }
            }
        } catch (pErr) {
            console.warn('Photon geocoding error:', pErr);
        }
    }

    // 3. OpenStreetMap / Nominatim API (with zoom=18 & extratags)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&extratags=1`, {
            headers: { 'Accept-Language': 'en-US,en;q=0.9' }
        });
        if (response.ok) {
            const data = await response.json();
            let nomAddr = '';
            let nomArea = '';

            if (data && data.address) {
                const addr = data.address;
                const spot = addr.building || addr.amenity || addr.shop || addr.office || addr.commercial || addr.industrial || addr.historic || addr.tourism || addr.leisure || (addr.house_number ? `No. ${addr.house_number}` : '');
                const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
                const subLocality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.city_district || addr.hamlet || addr.subdistrict || '';
                const mainLocality = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
                const stateStr = addr.state || '';
                const pinStr = addr.postcode ? ` - ${addr.postcode}` : '';

                const areaParts = [spot, street, subLocality, mainLocality].filter(Boolean);
                if (areaParts.length > 0) {
                    nomArea = areaParts.slice(0, 2).join(', ');
                }

                const addrParts = [spot, street, subLocality, mainLocality, stateStr ? `${stateStr}${pinStr}` : pinStr].filter(Boolean);
                if (addrParts.length >= 3) {
                    nomAddr = addrParts.join(', ');
                }
            }

            // If display_name is richer than constructed address (or if constructed address has less detail), use display_name
            if (data?.display_name) {
                const cleanDisplayName = data.display_name.replace(/,\s*India$/i, '').trim();
                if (!nomAddr || cleanDisplayName.split(',').length > nomAddr.split(',').length) {
                    nomAddr = cleanDisplayName;
                }
            }

            if (nomAddr && (!detailedAddress || nomAddr.split(',').length > detailedAddress.split(',').length)) {
                detailedAddress = nomAddr;
            }
            if (nomArea && (!detailedArea || detailedArea.split(',').length < 2)) {
                detailedArea = nomArea;
            }
        }
    } catch (e) {
        console.warn('Nominatim reverse geocoding error:', e);
    }

    // 4. BigDataCloud API (fallback)
    if (!detailedAddress || detailedAddress.split(',').length < 2) {
        try {
            const bdcRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            if (bdcRes.ok) {
                const bdcData = await bdcRes.json();
                if (bdcData) {
                    const locality = bdcData.locality || bdcData.city || bdcData.principalSubdivision || '';
                    const informative = bdcData.localityInfo?.informative || [];
                    const infoNames = informative.map(i => i.name).filter(n => n && n !== locality);
                    const subLocality = infoNames.join(', ');

                    if (subLocality || locality) {
                        const bdcAddr = [subLocality, locality, bdcData.principalSubdivision, bdcData.postcode].filter(Boolean).join(', ');
                        if (bdcAddr && (!detailedAddress || bdcAddr.length > detailedAddress.length)) {
                            detailedAddress = bdcAddr;
                        }
                        if (!detailedArea) {
                            detailedArea = [infoNames[0] || subLocality, locality].filter(Boolean).join(', ');
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('BigDataCloud geocoding error:', err);
        }
    }

    if (!detailedArea && detailedAddress) {
        detailedArea = detailedAddress.split(',').slice(0, 2).join(', ').trim();
    }

    return {
        address: detailedAddress || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
        areaName: detailedArea || 'Field Location'
    };
};
