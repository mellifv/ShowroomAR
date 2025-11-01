import { API } from "../js/api.js";

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Registering...";

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const data = await API.register({name, email, password});

    // Save token and user info
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    alert("Registration successful!");
// Update navigation
if (typeof AuthManager !== 'undefined') {
    AuthManager.updateNavigation();
}
    // Redirect immediately
    if (data.user.role === "admin") {
      window.location.href = "../admin/adminDashboard.html";
    } else {
      window.location.href = "../categories/categories.html";
    }

  } catch (err) {
    alert("Registration failed: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Register";
  }
});
