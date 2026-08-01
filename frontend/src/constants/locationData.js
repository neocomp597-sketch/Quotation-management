// Location Data & Cascading Dropdown Helper

export const DEFAULT_COUNTRIES = [
    { country: 'India', alpha2: 'IN', dialCode: '+91' },
    { country: 'United States', alpha2: 'US', dialCode: '+1' },
    { country: 'Canada', alpha2: 'CA', dialCode: '+1' },
    { country: 'United Kingdom', alpha2: 'GB', dialCode: '+44' },
    { country: 'Australia', alpha2: 'AU', dialCode: '+61' },
    { country: 'Germany', alpha2: 'DE', dialCode: '+49' },
    { country: 'France', alpha2: 'FR', dialCode: '+33' },
    { country: 'Singapore', dialCode: '+65' },
    { country: 'United Arab Emirates', dialCode: '+971' },
    { country: 'Saudi Arabia', dialCode: '+966' },
    { country: 'Japan', alpha2: 'JP', dialCode: '+81' },
    { country: 'China', alpha2: 'CN', dialCode: '+86' },
    { country: 'Nepal', dialCode: '+977' },
    { country: 'Bangladesh', dialCode: '+880' },
    { country: 'Sri Lanka', dialCode: '+94' },
    { country: 'Brazil', alpha2: 'BR', dialCode: '+55' }
];

export const DEFAULT_STATES = {
    'India': [
        { state: 'Andhra Pradesh', shortCode: 'AP', gstCode: '37' },
        { state: 'Arunachal Pradesh', shortCode: 'AR', gstCode: '12' },
        { state: 'Assam', shortCode: 'AS', gstCode: '18' },
        { state: 'Bihar', shortCode: 'BR', gstCode: '10' },
        { state: 'Chhattisgarh', shortCode: 'CG', gstCode: '22' },
        { state: 'Goa', shortCode: 'GA', gstCode: '30' },
        { state: 'Gujarat', shortCode: 'GJ', gstCode: '24' },
        { state: 'Haryana', shortCode: 'HR', gstCode: '06' },
        { state: 'Himachal Pradesh', shortCode: 'HP', gstCode: '02' },
        { state: 'Jharkhand', shortCode: 'JH', gstCode: '20' },
        { state: 'Karnataka', shortCode: 'KA', gstCode: '29' },
        { state: 'Kerala', shortCode: 'KL', gstCode: '32' },
        { state: 'Madhya Pradesh', shortCode: 'MP', gstCode: '23' },
        { state: 'Maharashtra', shortCode: 'MH', gstCode: '27' },
        { state: 'Manipur', shortCode: 'MN', gstCode: '14' },
        { state: 'Meghalaya', shortCode: 'ML', gstCode: '17' },
        { state: 'Mizoram', shortCode: 'MZ', gstCode: '15' },
        { state: 'Nagaland', shortCode: 'NL', gstCode: '13' },
        { state: 'Odisha', shortCode: 'OD', gstCode: '21' },
        { state: 'Punjab', shortCode: 'PB', gstCode: '03' },
        { state: 'Rajasthan', shortCode: 'RJ', gstCode: '08' },
        { state: 'Sikkim', shortCode: 'SK', gstCode: '11' },
        { state: 'Tamil Nadu', shortCode: 'TN', gstCode: '33' },
        { state: 'Telangana', shortCode: 'TS', gstCode: '36' },
        { state: 'Tripura', shortCode: 'TR', gstCode: '16' },
        { state: 'Uttar Pradesh', shortCode: 'UP', gstCode: '09' },
        { state: 'Uttarakhand', shortCode: 'UK', gstCode: '05' },
        { state: 'West Bengal', shortCode: 'WB', gstCode: '19' },
        { state: 'Andaman & Nicobar Islands', shortCode: 'AN', gstCode: '35' },
        { state: 'Chandigarh', shortCode: 'CH', gstCode: '04' },
        { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH', gstCode: '26' },
        { state: 'Delhi (NCT)', shortCode: 'DL', gstCode: '07' },
        { state: 'Jammu & Kashmir', shortCode: 'JK', gstCode: '01' },
        { state: 'Ladakh', shortCode: 'LA', gstCode: '38' },
        { state: 'Lakshadweep', shortCode: 'LD', gstCode: '31' },
        { state: 'Puducherry', shortCode: 'PY', gstCode: '34' }
    ],
    'United States': [
        { state: 'California', shortCode: 'CA' },
        { state: 'New York', shortCode: 'NY' },
        { state: 'Texas', shortCode: 'TX' },
        { state: 'Florida', shortCode: 'FL' },
        { state: 'Illinois', shortCode: 'IL' },
        { state: 'Washington', shortCode: 'WA' }
    ],
    'United Kingdom': [
        { state: 'England', shortCode: 'ENG' },
        { state: 'Scotland', shortCode: 'SCT' },
        { state: 'Wales', shortCode: 'WLS' }
    ],
    'Canada': [
        { state: 'Ontario', shortCode: 'ON' },
        { state: 'Quebec', shortCode: 'QC' },
        { state: 'British Columbia', shortCode: 'BC' }
    ]
};

export const DEFAULT_CITIES = {
    'Maharashtra': ['Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Thane', 'Aurangabad', 'Solapur', 'Kolhapur'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'],
    'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
    'Delhi (NCT)': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
    'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Prayagraj', 'Ghaziabad'],
    'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
    'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
    'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
    'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan'],
    'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'],
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Syracuse', 'Albany'],
    'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
    'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
    'Ontario': ['Toronto', 'Ottawa', 'Hamilton', 'London'],
    'England': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds']
};

export const getDialCodeForCountry = (countryName) => {
    if ((countryName || '').toLowerCase() === 'usa') return '+1';
    const found = DEFAULT_COUNTRIES.find(c => c.country.toLowerCase() === (countryName || '').toLowerCase());
    return found ? found.dialCode : '+91';
};

export const getStatesForCountry = (countryName, masterStateList = []) => {
    if (!countryName) return [];
    const normalizedCountry = countryName.toLowerCase() === 'usa' ? 'United States' : countryName;
    
    // Combine states from backend State Master database and local default states
    const masterMatches = masterStateList.filter(s => 
        (s.country || 'India').toLowerCase() === normalizedCountry.toLowerCase()
    ).map(s => ({
        state: s.state,
        shortCode: s.shortCode || 'ST',
        gstCode: s.gstCode || '',
        country: s.country || 'India',
        _id: s._id
    }));

    const defaults = (DEFAULT_STATES[normalizedCountry] || []).map(s => ({
        ...s,
        country: normalizedCountry
    }));

    // Merge without duplicates
    const stateMap = new Map();
    [...masterMatches, ...defaults].forEach(st => {
        if (!stateMap.has(st.state.toLowerCase())) {
            stateMap.set(st.state.toLowerCase(), st);
        }
    });

    return Array.from(stateMap.values());
};

export const getCitiesForState = (stateName) => {
    if (!stateName) return [];
    if (DEFAULT_CITIES[stateName]) return DEFAULT_CITIES[stateName];
    const key = Object.keys(DEFAULT_CITIES).find(k => k.toLowerCase() === stateName.toLowerCase());
    return key ? DEFAULT_CITIES[key] : [];
};
