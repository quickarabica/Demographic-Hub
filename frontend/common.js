async function fetchRecords() {
  try {
    const response = await axios.get('http://localhost:3000/api/records');
    return response.data;
  } catch (error) {
    console.error('Error fetching records:', error);
    return [];
  }
}