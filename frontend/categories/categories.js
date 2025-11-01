import { API } from "../js/api.js";

const container = document.getElementById("showrooms-container");

async function loadShowrooms() {
  try {
    const showrooms = await API.getShowrooms();
    container.innerHTML = showrooms.map(s => `
      <div class="showroom-card">
        <img src="${s.logo}" alt="${s.name}">
        <h2>${s.name}</h2>
        <p>${s.description}</p>
        <a href="../showroom/showroom.html?id=${s._id}" class="btn">View Collection</a>
      </div>
    `).join("");
  } catch {
    container.innerHTML = "<p>Error loading showrooms.</p>";
  }
}

loadShowrooms();
