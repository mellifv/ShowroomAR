import { API } from "../js/api.js";     // ✅ Correct

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // Show loading state
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Logging in...";
  submitBtn.disabled = true;

  try {
    console.log('Attempting login with:', { email, password: '***' });

    const data = await API.login(email, password);
    console.log('Login response:', data);

    // Save token and user info
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    alert("Login successful!");
// Update navigation
if (typeof AuthManager !== 'undefined') {
    AuthManager.updateNavigation();
}
    // Redirect based on role
    if (data.user.role === "admin") {
      window.location.href = "../admin/admin.html";
    } else {
      window.location.href = "../categories/categories.html"; // Fixed path
    }

  } catch (err) {
    console.error('Login error details:', err);
    alert("Login failed: " + err.message);
  } finally {
    // Reset button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Test API connection on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Try to ping the backend to check connectivity
    const response = await fetch('http://localhost:5000/api/');
    console.log('Backend connectivity check:', response.status);
  } catch (error) {
    console.error('Cannot connect to backend:', error);
    alert('Warning: Cannot connect to server. Make sure backend is running on localhost:5000');
  }
});