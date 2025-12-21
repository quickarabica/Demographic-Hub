const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://demographic-hub-10.onrender.com";

async function fetchRecords() {
  try {
    const response = await axios.get(`${API_BASE}/api/records`);
    return response.data;
  } catch (error) {
    console.error('Error fetching records:', error);
    return [];
  }
}