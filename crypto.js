const GameCrypto = {
  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  generateUUID() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  async createSignature(transactionId, amount, sender, secretKey) {
    const data = transactionId + amount + sender + secretKey;
    return await this.sha256(data);
  },

  async verifySignature(transactionId, amount, sender, signature, secretKey) {
    const expectedSignature = await this.createSignature(transactionId, amount, sender, secretKey);
    return expectedSignature === signature;
  }
};
