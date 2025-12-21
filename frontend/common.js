const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://demographic-hub-10.onrender.com";

async function fetchRecords(params = {}) {
  try {
    const response = await axios.get(`${API_BASE}/api/records`, { params });
    // API returns { data, total, page, pageSize }; fall back to array for old shape
    const body = response.data;
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    return [];
  } catch (error) {
    console.error("Error fetching records:", error);
    return [];
  }
}
