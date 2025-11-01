import { API } from "../js/api.js";
(async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("You must log in first!");
    window.location.href = "../auth/login.html";
    return;
  }

  // Optionally verify if user is admin
  const res = await fetch(`${API.baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await res.json();

  if (user.role !== "admin") {
    alert("Access denied: Admins only");
    window.location.href = "../index/index.html";
  }
})();

document.getElementById("showroomForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("showroomName").value;
  const description = document.getElementById("showroomDesc").value;
  const logo = document.getElementById("showroomLogo").value;

  try {
    await API.addShowroom({ name, description, logo });
    alert("Showroom added!");
    e.target.reset();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const product = {
    name: document.getElementById("productName").value,
    price: document.getElementById("productPrice").value,
    category: document.getElementById("productCategory").value,
    image: document.getElementById("productImage").value,
    showroom: document.getElementById("productShowroomId").value,
  };

  try {
    await API.addProduct(product);
    alert("Product added!");
    e.target.reset();
  } catch (err) {
    alert("Error: " + err.message);
  }
});
