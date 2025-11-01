const API_BASE = "http://localhost:5000/api";

class API {
  static baseUrl = API_BASE;

  static async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };

    // Add auth token if available
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      console.log(`API Call: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      const data = await response.json();

      console.log('API Response:', data);

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  static async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  }

  static async login(email, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  // Showrooms
  static async getShowrooms() {
    return this.request("/showrooms");
  }

  static async addShowroom(showroom) {
    return this.request("/showrooms", {
      method: "POST",
      body: JSON.stringify(showroom)
    });
  }

  // Products
  static async getProductsByShowroom(id) {
    return this.request(`/products/showroom/${id}`);
  }

  static async addProduct(product) {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(product)
    });
  }

// ORDERS - ADD THESE METHODS
  static async createOrder(orderData) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(orderData)
    });
  }

  static async getUserOrders() {
    return this.request("/orders/my-orders");
  }

  static async getOrder(id) {
    return this.request(`/orders/${id}`);
  }
}
export { API };