import React, { useState, useEffect } from 'react';
import { DEFAULT_COUNTRIES, getStatesForCountry, getCitiesForState, getDialCodeForCountry } from '../constants/locationData';

const CascadingLocationSelector = ({
    country = 'India',
    state = '',
    city = '',
    dialCode = '+91',
    masterStateList = [],
    onChange = () => {},
    required = false,
    className = ""
}) => {
    const [selectedCountry, setSelectedCountry] = useState(country || 'India');
    const [selectedState, setSelectedState] = useState(state || '');
    const [selectedCity, setSelectedCity] = useState(city || '');
    const [selectedDialCode, setSelectedDialCode] = useState(dialCode || '+91');

    const [availableStates, setAvailableStates] = useState([]);
    const [availableCities, setAvailableCities] = useState([]);

    useEffect(() => {
        if (country) setSelectedCountry(country);
        if (state) setSelectedState(state);
        if (city) setSelectedCity(city);
        if (dialCode) setSelectedDialCode(dialCode);
    }, [country, state, city, dialCode]);

    // Recalculate available states when country or master list changes
    useEffect(() => {
        const states = getStatesForCountry(selectedCountry, masterStateList);
        setAvailableStates(states);
    }, [selectedCountry, masterStateList]);

    // Recalculate available cities when state changes
    useEffect(() => {
        const cities = getCitiesForState(selectedState);
        setAvailableCities(cities);
    }, [selectedState]);

    const handleCountrySelect = (newCountry) => {
        setSelectedCountry(newCountry);
        const newDial = getDialCodeForCountry(newCountry);
        setSelectedDialCode(newDial);

        const newStates = getStatesForCountry(newCountry, masterStateList);
        setAvailableStates(newStates);
        setSelectedState('');
        setSelectedCity('');

        onChange({
            country: newCountry,
            state: '',
            city: '',
            dialCode: newDial,
            shortCode: ''
        });
    };

    const handleStateSelect = (newStateName) => {
        setSelectedState(newStateName);
        const matched = availableStates.find(s => s.state.toLowerCase() === newStateName.toLowerCase());
        const shortCode = matched ? matched.shortCode : '';

        const cities = getCitiesForState(newStateName);
        setAvailableCities(cities);
        setSelectedCity('');

        onChange({
            country: selectedCountry,
            state: newStateName,
            city: '',
            dialCode: selectedDialCode,
            shortCode
        });
    };

    const handleCitySelect = (newCity) => {
        setSelectedCity(newCity);
        const matched = availableStates.find(s => s.state.toLowerCase() === selectedState.toLowerCase());

        onChange({
            country: selectedCountry,
            state: selectedState,
            city: newCity,
            dialCode: selectedDialCode,
            shortCode: matched ? matched.shortCode : ''
        });
    };

    const handleDialCodeSelect = (newCode) => {
        setSelectedDialCode(newCode);
        const matched = availableStates.find(s => s.state.toLowerCase() === selectedState.toLowerCase());

        onChange({
            country: selectedCountry,
            state: selectedState,
            city: selectedCity,
            dialCode: newCode,
            shortCode: matched ? matched.shortCode : ''
        });
    };

    const inputClass = "w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all cursor-pointer";
    const labelClass = "block text-xs font-bold text-slate-700 mb-1.5";

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
            {/* Country Dropdown */}
            <div>
                <label className={labelClass}>
                    Country {required && <span className="text-rose-500">*</span>}
                </label>
                <select
                    value={selectedCountry}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                    className={inputClass}
                    required={required}
                >
                    {DEFAULT_COUNTRIES.map(c => (
                        <option key={c.country} value={c.country}>{c.country}</option>
                    ))}
                </select>
            </div>

            {/* State Dropdown */}
            <div>
                <label className={labelClass}>
                    State {required && <span className="text-rose-500">*</span>}
                </label>
                <select
                    value={selectedState}
                    onChange={(e) => handleStateSelect(e.target.value)}
                    className={inputClass}
                    required={required}
                >
                    <option value="">Select State</option>
                    {availableStates.map(st => (
                        <option key={st.state} value={st.state}>
                            {st.state} {st.shortCode ? `(${st.shortCode})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {/* City Dropdown */}
            <div>
                <label className={labelClass}>
                    City {required && <span className="text-rose-500">*</span>}
                </label>
                <select
                    value={selectedCity}
                    onChange={(e) => handleCitySelect(e.target.value)}
                    className={inputClass}
                    required={required}
                >
                    <option value="">Select City</option>
                    {availableCities.map(ct => (
                        <option key={ct} value={ct}>{ct}</option>
                    ))}
                </select>
            </div>

            {/* Country Dial Code */}
            <div>
                <label className={labelClass}>Country Dial Code</label>
                <select
                    value={selectedDialCode}
                    onChange={(e) => handleDialCodeSelect(e.target.value)}
                    className={inputClass}
                >
                    {DEFAULT_COUNTRIES.map(c => (
                        <option key={c.country} value={c.dialCode}>
                            {c.dialCode} ({c.country})
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default CascadingLocationSelector;
