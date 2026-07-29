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

    const [isCustomState, setIsCustomState] = useState(false);
    const [isCustomCity, setIsCustomCity] = useState(false);

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
        setIsCustomState(false);
        setIsCustomCity(false);

        onChange({
            country: newCountry,
            state: '',
            city: '',
            dialCode: newDial,
            shortCode: '',
            gstCode: ''
        });
    };

    const handleStateSelect = (newStateName) => {
        if (newStateName === '__CUSTOM_STATE__') {
            setIsCustomState(true);
            setSelectedState('');
            setSelectedCity('');
            onChange({
                country: selectedCountry,
                state: '',
                city: '',
                dialCode: selectedDialCode,
                shortCode: '',
                gstCode: ''
            });
            return;
        }

        setIsCustomState(false);
        setSelectedState(newStateName);
        const matched = availableStates.find(s => s.state.toLowerCase() === newStateName.toLowerCase());
        const shortCode = matched ? matched.shortCode : '';
        const gstCode = matched ? matched.gstCode : '';

        const cities = getCitiesForState(newStateName);
        setAvailableCities(cities);
        const defaultCity = cities.length > 0 ? cities[0] : '';
        setSelectedCity(defaultCity);

        onChange({
            country: selectedCountry,
            state: newStateName,
            city: defaultCity,
            dialCode: selectedDialCode,
            shortCode,
            gstCode
        });
    };

    const handleCustomStateInput = (val) => {
        setSelectedState(val);
        onChange({
            country: selectedCountry,
            state: val,
            city: selectedCity,
            dialCode: selectedDialCode,
            shortCode: '',
            gstCode: ''
        });
    };

    const handleCitySelect = (newCity) => {
        if (newCity === '__CUSTOM_CITY__') {
            setIsCustomCity(true);
            setSelectedCity('');
            return;
        }
        setIsCustomCity(false);
        setSelectedCity(newCity);
        const matched = availableStates.find(s => s.state.toLowerCase() === selectedState.toLowerCase());

        onChange({
            country: selectedCountry,
            state: selectedState,
            city: newCity,
            dialCode: selectedDialCode,
            shortCode: matched ? matched.shortCode : '',
            gstCode: matched ? (matched.gstCode || '') : ''
        });
    };

    const handleCustomCityInput = (val) => {
        setSelectedCity(val);
        const matched = availableStates.find(s => s.state.toLowerCase() === selectedState.toLowerCase());

        onChange({
            country: selectedCountry,
            state: selectedState,
            city: val,
            dialCode: selectedDialCode,
            shortCode: matched ? matched.shortCode : '',
            gstCode: matched ? (matched.gstCode || '') : ''
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
            shortCode: matched ? matched.shortCode : '',
            gstCode: matched ? (matched.gstCode || '') : ''
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

            {/* State Dropdown / Input */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className={labelClass}>
                        State {required && <span className="text-rose-500">*</span>}
                    </label>
                    {availableStates.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsCustomState(!isCustomState)}
                            className="text-[10px] text-primary-600 font-bold hover:underline"
                        >
                            {isCustomState ? 'Select List' : '+ Custom'}
                        </button>
                    )}
                </div>
                {!isCustomState && availableStates.length > 0 ? (
                    <select
                        value={selectedState}
                        onChange={(e) => handleStateSelect(e.target.value)}
                        className={inputClass}
                        required={required}
                    >
                        <option value="">Select State</option>
                        {availableStates.map(st => (
                            <option key={st.state} value={st.state}>
                                {st.state} {st.shortCode ? `(${st.shortCode})` : ''} {st.gstCode ? `- GST: ${st.gstCode}` : ''}
                            </option>
                        ))}
                        <option value="__CUSTOM_STATE__" className="font-bold text-primary-600">+ Enter Custom State...</option>
                    </select>
                ) : (
                    <input
                        type="text"
                        placeholder="State name"
                        value={selectedState}
                        onChange={(e) => handleCustomStateInput(e.target.value)}
                        className={inputClass}
                        required={required}
                    />
                )}
            </div>

            {/* City Dropdown / Input */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className={labelClass}>
                        City {required && <span className="text-rose-500">*</span>}
                    </label>
                    {availableCities.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsCustomCity(!isCustomCity)}
                            className="text-[10px] text-primary-600 font-bold hover:underline"
                        >
                            {isCustomCity ? 'Select List' : '+ Custom'}
                        </button>
                    )}
                </div>
                {!isCustomCity && availableCities.length > 0 ? (
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
                        <option value="__CUSTOM_CITY__" className="font-bold text-primary-600">+ Custom City...</option>
                    </select>
                ) : (
                    <input
                        type="text"
                        placeholder="City name"
                        value={selectedCity}
                        onChange={(e) => handleCustomCityInput(e.target.value)}
                        className={inputClass}
                        required={required}
                    />
                )}
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
