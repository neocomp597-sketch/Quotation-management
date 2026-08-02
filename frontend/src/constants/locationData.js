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
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Chhatrapati Sambhajinagar', 'Solapur', 'Kolhapur', 'Amravati', 'Nanded', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar', 'Satara', 'Beed', 'Yavatmal', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Bhusawal', 'Navi Mumbai', 'Panvel', 'Kalyan-Dombivli', 'Vasai-Virar', 'Mira-Bhayandar', 'Pimpri-Chinchwad', 'Baramati', 'Ratnagiri', 'Sindhudurg', 'Gondia', 'Bhandara', 'Wardha', 'Washim', 'Hingoli', 'Gadchiroli', 'Palghar', 'Nandurbar', 'Buldhana', 'Dharashiv', 'Karad', 'Malegaon', 'Ambernath', 'Badlapur', 'Bhiwandi'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj', 'Porbandar', 'Palanpur', 'Valsad', 'Vapi', 'Gondal', 'Veraval', 'Godhra', 'Patan', 'Dahod', 'Botad', 'Amreli', 'Ankleshwar', 'Gandhidham', 'Deesa', 'Jetpur'],
    'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'North East Delhi', 'North West Delhi', 'South East Delhi', 'South West Delhi', 'Shahdara', 'Dwarka', 'Rohini', 'Connaught Place', 'Janakpuri', 'Saket', 'Pitampura', 'Vasant Kunj', 'Lajpat Nagar', 'Karol Bagh'],
    'Delhi (NCT)': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'North East Delhi', 'North West Delhi', 'South East Delhi', 'South West Delhi', 'Shahdara', 'Dwarka', 'Rohini', 'Connaught Place', 'Janakpuri', 'Saket', 'Pitampura', 'Vasant Kunj', 'Lajpat Nagar', 'Karol Bagh'],
    'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar', 'Hospet', 'Hassan', 'Udupi', 'Robertsonpet', 'Ranebennuru', 'Mandya', 'Chikkamagaluru', 'Chitradurga', 'Kolar', 'Bagalkot', 'Karwar', 'Sirsi', 'Chikkaballapur', 'Ramanagara', 'Yadgir'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode', 'Vellore', 'Tirunelveli', 'Thanjavur', 'Thoothukudi', 'Dindigul', 'Nagercoil', 'Kanchipuram', 'Kumarapalayam', 'Karaikudi', 'Neyveli', 'Cuddalore', 'Kumbakonam', 'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Gudiyatham', 'Pudukkottai', 'Hosur', 'Ambur', 'Nagapattinam', 'Namakkal', 'Viluppuram', 'Tiruvarur', 'Sivaganga'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sanganer', 'Pali', 'Sikar', 'Tonk', 'Hanumangarh', 'Beawar', 'Kishangarh', 'Jhunjhunu', 'Churu', 'Gangapur City', 'Sawai Madhopur', 'Suratgarh', 'Jaisalmer', 'Mount Abu', 'Barmer', 'Dholpur', 'Nagaur', 'Banswara', 'Chittorgarh', 'Dungarpur', 'Jalor', 'Pratapgarh'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Badaun', 'Rampur', 'Shahjahanpur', 'Farrukhabad', 'Ayodhya', 'Jaunpur', 'Lakhimpur', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr', 'Sambhal', 'Amroha', 'Hardoi', 'Fatehpur', 'Raebareli', 'Orai', 'Sitapur', 'Bahraich', 'Modinagar', 'Unnao', 'Baghpat', 'Greater Noida', 'Azamgarh', 'Deoria', 'Gonda', 'Basti', 'Sultanpur', 'Bhadohi', 'Barabanki'],
    'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Bhind', 'Chhatarpur', 'Damoh', 'Mandsaur', 'Khargone', 'Neemuch', 'Pithampur', 'Narmadapuram', 'Itarsi', 'Sehore', 'Vidisha', 'Shivpuri', 'Nagda', 'Guna', 'Betul', 'Seoni', 'Datia'],
    'West Bengal': ['Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Raiganj', 'Krishnanagar', 'Nabadwip', 'Medinipur', 'Jalpaiguri', 'Balurghat', 'Basirhat', 'Bankura', 'Purulia', 'Cooch Behar', 'Darjeeling', 'Kalimpong', 'Bangarh', 'Bolpur', 'Suri'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Khanna', 'Phagwara', 'Muktsar', 'Barnala', 'Rajpura', 'Firozpur', 'Kapurthala', 'Faridkot', 'Sangrur', 'Fazilka', 'Gurdaspur', 'Tarn Taran', 'Rupnagar', 'Malerkotla'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Kaithal', 'Rewari', 'Palwal', 'Narnaul', 'Fatehabad', 'Kurukshetra', 'Jhajjhar', 'Charkhi Dadri'],
    'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha', 'Kannur', 'Kottayam', 'Kasaragod', 'Malappuram', 'Pathanamthitta', 'Idukki', 'Wayanad', 'Vatakara', 'Kanhangad', 'Thalassery', 'Kayamkulam', 'Nedumangad', 'Guruvayur'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Siddipet', 'Suryapet', 'Miryalaguda', 'Jagtial', 'Mancherial', 'Kothagudem', 'Kamareddy', 'Wanaparthy'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Eluru', 'Vizianagaram', 'Ongole', 'Nandyal', 'Machilipatnam', 'Adoni', 'Tenali', 'Proddatur', 'Chittoor', 'Hindupur', 'Bhimavaram', 'Madanapalle', 'Srikakulam', 'Narasaraopet'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 'Munger', 'Chhapra', 'Danapur', 'Bettiah', 'Saharsa', 'Sasaram', 'Hajipur', 'Dehri', 'Siwan', 'Motihari', 'Nawada', 'Bagaha', 'Buxar', 'Kishanganj', 'Sitamarhi', 'Jamui', 'Jehanabad'],
    'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon', 'Dhubri', 'Diphu', 'North Lakhimpur', 'Karimganj', 'Sivasagar', 'Goalpara', 'Barpeta', 'Haflong', 'Hailakandi', 'Hojai', 'Lumding'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Phusro', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chas', 'Chaibasa', 'Jhumri Telaiya', 'Sahibganj', 'Dumka', 'Ghatshila'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Raigarh', 'Jagdalpur', 'Ambikapur', 'Dhamtari', 'Chirmiri', 'Bhatapara', 'Mahasamund', 'Kanker', 'Kawardha', 'Durg'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem', 'Cuncolim', 'Pernem', 'Valpoi', 'Quepem'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Pithoragarh', 'Nainital', 'Mussoorie', 'Kotdwar', 'Ramnagar', 'Tehri', 'Uttarkashi', 'Chamoli', 'Almora'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Baddi', 'Palampur', 'Kullu', 'Manali', 'Bilaspur', 'Hamirpur', 'Una', 'Chamba', 'Nahan', 'Paonta Sahib', 'Dalhousie', 'Keylong'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore', 'Bargarh', 'Rayagada', 'Bolangir', 'Keonjhar', 'Paradip', 'Dhenkanal'],
    'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua', 'Udhampur', 'Sopore', 'Rajouri', 'Poonch', 'Kupwara', 'Pulwama', 'Ganderbal', 'Budgam', 'Kishtwar', 'Ramban', 'Reasi'],
    'Ladakh': ['Leh', 'Kargil', 'Diskit', 'Padum'],
    'Chandigarh': ['Chandigarh', 'Manimajra'],
    'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Oulgaret'],
    'Andaman & Nicobar Islands': ['Port Blair', 'Garacharma', 'Havelock Island', 'Mayabunder', 'Diglipur'],
    'Dadra & Nagar Haveli and Daman & Diu': ['Daman', 'Diu', 'Silvassa', 'Dadra'],
    'Tripura': ['Agartala', 'Dharmanagar', 'Udaipur', 'Kailashahar', 'Belonia', 'Ambassa', 'Khowai'],
    'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Baghmara', 'Williamnagar', 'Resubelpara'],
    'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Ukhrul', 'Senapati', 'Kakching'],
    'Nagaland': ['Dimapur', 'Kohima', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon', 'Phek'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Tezu', 'Bomdila', 'Aalo'],
    'Mizoram': ['Aizawl', 'Lunglei', 'Saiha', 'Champhai', 'Kolasib', 'Serchhip', 'Lawngtlai'],
    'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo', 'Jorethang', 'Singtam'],
    'Lakshadweep': ['Kavaratti', 'Agatti', 'Amini', 'Andrott', 'Minicoy'],
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

const STATE_SHORTCODE_MAP = {
    'MH': 'Maharashtra',
    'GJ': 'Gujarat',
    'DL': 'Delhi (NCT)',
    'KA': 'Karnataka',
    'TN': 'Tamil Nadu',
    'RJ': 'Rajasthan',
    'UP': 'Uttar Pradesh',
    'MP': 'Madhya Pradesh',
    'WB': 'West Bengal',
    'PB': 'Punjab',
    'HR': 'Haryana',
    'KL': 'Kerala',
    'TS': 'Telangana',
    'AP': 'Andhra Pradesh',
    'BR': 'Bihar',
    'AS': 'Assam',
    'JH': 'Jharkhand',
    'CG': 'Chhattisgarh',
    'GA': 'Goa',
    'UK': 'Uttarakhand',
    'HP': 'Himachal Pradesh',
    'OD': 'Odisha',
    'JK': 'Jammu & Kashmir',
    'LA': 'Ladakh',
    'CH': 'Chandigarh',
    'PY': 'Puducherry',
    'AN': 'Andaman & Nicobar Islands',
    'DH': 'Dadra & Nagar Haveli and Daman & Diu',
    'TR': 'Tripura',
    'ML': 'Meghalaya',
    'MN': 'Manipur',
    'NL': 'Nagaland',
    'AR': 'Arunachal Pradesh',
    'MZ': 'Mizoram',
    'SK': 'Sikkim',
    'LD': 'Lakshadweep'
};

export const getCitiesForState = (stateName) => {
    if (!stateName) return [];
    
    // Direct match
    if (DEFAULT_CITIES[stateName]) return DEFAULT_CITIES[stateName];
    
    // Case-insensitive match
    const key = Object.keys(DEFAULT_CITIES).find(k => k.toLowerCase() === stateName.toLowerCase());
    if (key) return DEFAULT_CITIES[key];
    
    // ShortCode match (e.g. "MH", "GJ", "DL")
    const uppercaseCode = stateName.trim().toUpperCase();
    if (STATE_SHORTCODE_MAP[uppercaseCode] && DEFAULT_CITIES[STATE_SHORTCODE_MAP[uppercaseCode]]) {
        return DEFAULT_CITIES[STATE_SHORTCODE_MAP[uppercaseCode]];
    }

    // Contains / Partial match (e.g. "Delhi" matching "Delhi (NCT)")
    const partialKey = Object.keys(DEFAULT_CITIES).find(k => 
        k.toLowerCase().includes(stateName.toLowerCase()) || stateName.toLowerCase().includes(k.toLowerCase())
    );
    return partialKey ? DEFAULT_CITIES[partialKey] : [];
};
