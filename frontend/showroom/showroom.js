import { API } from "../js/api.js";

const params = new URLSearchParams(window.location.search);
const showroomId = params.get("showroom") || params.get("id"); // Support both parameters

console.log('Showroom ID:', showroomId);

let products = []; // Store products globally

// CORRECT Cloudinary URL function
// ZOOMED IN VERSION - Shows whole clothing item
function getCloudinaryUrl(publicId, width = 300, height = 400) {
    if (!publicId) return "../images/default-product.png";
    
    // Clean the public_id
    publicId = publicId.replace(/^\//, "").replace(/\.(png|jpg|jpeg|webp)$/i, "");
    
    // Use 'c_fill' to fill the entire area and 'g_auto' for smart cropping
    return `https://res.cloudinary.com/djwoojdrl/image/upload/w_${width},h_${height},c_fill,g_auto/${publicId}`;
}

async function loadProducts() {
  try {
    console.log('Loading products for showroom:', showroomId);
    
    if (!showroomId) {
      console.log('No showroom ID provided');
      document.getElementById("showroom-name").textContent = "Select a Showroom";
      document.getElementById("product-list").innerHTML = "<p>Please select a showroom first.</p>";
      return;
    }

    products = await API.getProductsByShowroom(showroomId);
    console.log('Products loaded:', products);
    
    if (!products || products.length === 0) {
      document.getElementById("showroom-name").textContent = "No Products Found";
      document.getElementById("product-list").innerHTML = "<p>No products available in this showroom.</p>";
      return;
    }

    const showroomName = products[0]?.showroom?.name || "Collection";
    document.getElementById("showroom-name").textContent = showroomName;
    
    // FIXED: Use getCloudinaryUrl() for product images and proper tryOnProduct function
    document.getElementById("product-list").innerHTML = products.map(p => `
      <div class="product-card">
        <img src="${getCloudinaryUrl(p.image)}" alt="${p.name}" 
             class="product-image"
             onerror="this.src='../images/default-product.png'">
        <div class="product-info">
          <h3>${p.name}</h3>
          <p class="category">${p.category}</p>
          <p class="price"><b>₸${p.price}</b></p>
        </div>
        <div class="product-actions">
          <button class="btn try-on-btn" onclick="tryOnProduct('${p._id}')">Try On</button>
          <button class="btn cart-btn" onclick="addToCart('${p._id}', '${p.name}', ${p.price})">Add to Cart</button>
        </div>
      </div>
    `).join("");
    
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById("product-list").innerHTML = "<p>Error loading products. Please try again later.</p>";
  }
}

// FIXED: Proper tryOnProduct function
window.tryOnProduct = (productId) => {
    const product = products.find(p => p._id === productId);
    if (product) {
        console.log('🔄 Selecting product for try-on:', product.name);
        
        // Save product to localStorage for try-on page
        localStorage.setItem("selectedModel", JSON.stringify(product));
        
        // Save showroom context for back navigation
        if (showroomId && product.showroom) {
            localStorage.setItem('currentShowroom', JSON.stringify({
                id: showroomId,
                name: product.showroom.name
            }));
        } else if (showroomId) {
            // Fallback: use the showroom name from the page title
            const showroomName = document.getElementById("showroom-name").textContent;
            localStorage.setItem('currentShowroom', JSON.stringify({
                id: showroomId,
                name: showroomName
            }));
        }
        
        // Redirect to try-on page
        window.location.href = '../tryon/tryon.html';
    } else {
        console.error('❌ Product not found:', productId);
    }
};

// Message display function
function showMessage(message, type = 'success') {
  console.log('Showing message:', message, type);
  
  // Create message element if it doesn't exist
  let messageDiv = document.getElementById('cart-message');
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = 'cart-message';
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
    `;
    document.body.appendChild(messageDiv);
  }

  // Set message style based on type
  if (type === 'success') {
    messageDiv.style.background = '#27ae60';
  } else if (type === 'error') {
    messageDiv.style.background = '#e74c3c';
  } else {
    messageDiv.style.background = '#3498db';
  }

  messageDiv.textContent = message;
  messageDiv.style.display = 'block';

  // Auto hide after 3 seconds
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}

// Update cart counter
function updateCartCounter() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  console.log('Updating cart counter. Total items:', totalItems);
  
  // Update counter in navigation
  let counter = document.getElementById('cart-counter');
  if (!counter) {
    // Create counter if it doesn't exist
    const navAuth = document.querySelector('.nav-auth');
    if (navAuth) {
      counter = document.createElement('span');
      counter.id = 'cart-counter';
      counter.style.cssText = `
        background: #e74c3c;
        color: white;
        border-radius: 50%;
        padding: 2px 6px;
        font-size: 0.8rem;
        margin-left: 5px;
      `;
      
      const cartLink = document.querySelector('a[href*="cart.html"]');
      if (cartLink) {
        cartLink.appendChild(counter);
      }
    }
  }
  
  if (counter) {
    counter.textContent = totalItems;
    counter.style.display = totalItems > 0 ? 'inline' : 'none';
  }
}

// Add to cart function
window.addToCart = (id, name, price) => {
  console.log('Add to cart clicked:', { id, name, price });
  
  try {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    console.log('Current cart:', cart);
    
    // Check if item already exists
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
      existingItem.quantity = (existingItem.quantity || 1) + 1;
      console.log('Increased quantity for existing item:', existingItem);
    } else {
      cart.push({ 
        id, 
        name, 
        price, 
        quantity: 1 
      });
      console.log('Added new item to cart');
    }
    
    localStorage.setItem("cart", JSON.stringify(cart));
    console.log('Updated cart saved to localStorage');
    
    // Show success message
    showMessage(`"${name}" added to cart!`, 'success');
    
    // Update cart counter
    updateCartCounter();
    
  } catch (error) {
    console.error('Error adding to cart:', error);
    showMessage('Failed to add item to cart', 'error');
  }
};

// Remove the old tryOn function since we have tryOnProduct now
// window.tryOn = (image) => {
//   console.log('Try on clicked for image:', image);
//   localStorage.setItem("selectedModel", JSON.stringify({ image }));
//   window.location.href = "../tryon/tryon.html";
// };

// Initialize cart counter on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page loaded, initializing cart counter...');
  updateCartCounter();
  loadProducts();
});
