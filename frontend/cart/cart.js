import { API } from "../js/api.js";

const container = document.getElementById("cart-container");
const token = localStorage.getItem("token");
if (!token) {
    alert('Please login to view your cart');
    window.location.href = 'auth/login.html';
}
function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  
  if (cart.length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    const checkoutSection = document.getElementById("checkout-section");
    if (checkoutSection) {
      checkoutSection.style.display = "none";
    }
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <h3>${item.name}</h3>
      <p>$${item.price}</p>
      ${item.quantity ? `<p>Quantity: ${item.quantity}</p>` : ''}
    </div>
  `).join("");

  const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  container.innerHTML += `<h2>Total: $${total}</h2>`;
  
  const checkoutSection = document.getElementById("checkout-section");
  if (checkoutSection) {
    checkoutSection.style.display = "block";
  }
}

// ADD THIS: Simple payment simulation
async function processPayment(totalAmount) {
  return new Promise((resolve, reject) => {
    // Simulate payment processing
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% success rate
      if (success) {
        resolve({
          success: true,
          transactionId: 'TXN_' + Math.random().toString(36).substr(2, 9)
        });
      } else {
        reject(new Error('Payment failed: Card declined'));
      }
    }, 1500);
  });
}

// UPDATED: Checkout function with payment
document.getElementById("checkout-btn").addEventListener("click", async () => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (!token) {
    alert("Please log in first.");
    window.location.href = "../auth/login.html";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  
  // ADD: Payment confirmation
  const proceed = confirm(`Proceed with payment of $${totalPrice}?`);
  if (!proceed) return;

  const btn = document.getElementById("checkout-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Processing Payment...";

  try {
    // Process payment first
    const paymentResult = await processPayment(totalPrice);
    
    if (paymentResult.success) {
      // Only create order after successful payment
      const items = cart.map(item => ({ product: item.id, quantity: item.quantity || 1 }));
      await API.createOrder({ items, totalPrice });
      
      alert("✅ Payment successful! Order placed.");
      localStorage.removeItem("cart");
      loadCart();
    }
  } catch (err) {
    alert("❌ " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

document.addEventListener('DOMContentLoaded', loadCart);
loadCart();