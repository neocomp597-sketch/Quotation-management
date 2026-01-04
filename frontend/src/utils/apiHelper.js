const api = {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', // Update for production

    getHeaders: () => {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }
};

export default api;
