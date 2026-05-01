const api = {
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:4003/api", // Update for production

  getHeaders: () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  },
};

export default api;
