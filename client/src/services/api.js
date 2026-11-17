
import { auth } from "./firebase";

// Backend API URL
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

// Reusable API request function
const apiRequest = async (endpoint, options = {}) => {
  try {
    const currentUser = auth.currentUser;

    // Get Firebase ID token
    const token = currentUser
      ? await currentUser.getIdToken()
      : null;

    // Detect FormData uploads
    const isFormData = options.body instanceof FormData;

    // Prepare request headers
    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    };

    // Attach authentication token
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Send request to backend
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Read response
    const data = await response.json();

    // Handle API errors
    if (!response.ok) {
      throw new Error(
        data.message || "Something went wrong with the API request."
      );
    }

    return data;
  } catch (error) {
    console.error("API Request Error:", error.message);
    throw error;
  }
};

export default apiRequest;
