// payment-simulator.js
class PaymentSimulator {
  static async processPayment(orderData) {
    console.log('💰 Processing payment simulation...', orderData);
    
    return new Promise((resolve, reject) => {
      // Simulate API call delay
      setTimeout(() => {
        // 85% success rate for demo
        const success = Math.random() > 0.15;
        
        if (success) {
          resolve({
            success: true,
            transactionId: 'TXN_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            paymentMethod: 'credit_card',
            amount: orderData.totalPrice,
            timestamp: new Date().toISOString(),
            message: 'Payment processed successfully'
          });
        } else {
          reject({
            success: false,
            errorCode: 'PAYMENT_FAILED',
            message: this.getRandomErrorMessage()
          });
        }
      }, 2000); // 2 second delay
    });
  }

  static getRandomErrorMessage() {
    const errors = [
      'Insufficient funds',
      'Card declined',
      'Invalid CVV',
      'Expired card',
      'Transaction timeout',
      'Bank rejection'
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }

  static getPaymentMethods() {
    return [
      { id: 'credit_card', name: 'Credit Card', icon: '💳' },
      { id: 'debit_card', name: 'Debit Card', icon: '💳' },
      { id: 'paypal', name: 'PayPal', icon: '🔵' },
      { id: 'apple_pay', name: 'Apple Pay', icon: '🍎' },
      { id: 'google_pay', name: 'Google Pay', icon: '📱' }
    ];
  }
}