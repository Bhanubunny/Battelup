import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { PaymentGateway } from '../types';

export const DEFAULT_PAYMENT_GATEWAY: PaymentGateway = {
  id: 'upi',
  name: 'Instant UPI / QR',
  isActive: true,
  upiId: 'khelgalli@upi'
};

class PaymentService {
  private activeGateway: PaymentGateway | null = DEFAULT_PAYMENT_GATEWAY;
  private unsubscriber: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    onAuthStateChanged(auth, (user) => {
      if (this.unsubscriber) {
        this.unsubscriber();
        this.unsubscriber = null;
      }

      if (user) {
        try {
          const q = query(collection(db, 'paymentSettings'), where('isActive', '==', true));
          this.unsubscriber = onSnapshot(
            q,
            (snapshot) => {
              if (!snapshot.empty) {
                const data = snapshot.docs[0].data() as PaymentGateway;
                this.activeGateway = { ...data, id: snapshot.docs[0].id };
                console.log(`[PaymentService] Active Gateway: ${this.activeGateway.name}`);
              } else {
                this.activeGateway = DEFAULT_PAYMENT_GATEWAY;
                console.log('[PaymentService] Using default fallback gateway');
              }
            },
            (error) => {
              console.warn('[PaymentService] Snapshot notice:', error.message);
              this.activeGateway = DEFAULT_PAYMENT_GATEWAY;
            }
          );
        } catch (e) {
          console.warn('[PaymentService] Init listener failed:', e);
          this.activeGateway = DEFAULT_PAYMENT_GATEWAY;
        }
      } else {
        this.activeGateway = DEFAULT_PAYMENT_GATEWAY;
      }
    });
  }

  public getActiveGateway(): PaymentGateway | null {
    return this.activeGateway || DEFAULT_PAYMENT_GATEWAY;
  }

  public async getActiveGatewayAsync(): Promise<PaymentGateway | null> {
    if (this.activeGateway && this.activeGateway.id !== 'upi') return this.activeGateway;
    
    if (auth.currentUser) {
      try {
        const q = query(collection(db, 'paymentSettings'), where('isActive', '==', true));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const data = snap.docs[0].data() as PaymentGateway;
          this.activeGateway = { ...data, id: snap.docs[0].id };
          return this.activeGateway;
        }
      } catch (e) {
        console.warn('[PaymentService] Failed to fetch gateway async:', e);
      }
    }
    
    return this.activeGateway || DEFAULT_PAYMENT_GATEWAY;
  }

  // Unified payment initiation method
  public async initiateDeposit(amount: number, userId: string) {
    let gateway = await this.getActiveGatewayAsync();
    
    if (!gateway) {
      gateway = DEFAULT_PAYMENT_GATEWAY;
      this.activeGateway = gateway;
    }

    // Logic for different gateways
    switch (gateway.id) {
      case 'razorpay':
        return this.initRazorpay(amount, userId, gateway);
      case 'cashfree':
        return this.initCashfree(amount, userId, gateway);
      case 'transupi':
      case 'zapupi':
        // If ZapUPI has no API key configured yet, gracefully fall back to direct UPI
        if (!gateway.apiKey && !process.env.ZAPUPI_API_KEY) {
          console.warn('[PaymentService] ZapUPI active but no API key configured; using direct UPI fallback');
          return this.initUPIGateway(amount, userId, { ...DEFAULT_PAYMENT_GATEWAY, id: 'upi' });
        }
        return this.initUPIGateway(amount, userId, gateway);
      default:
        return this.initUPIGateway(amount, userId, gateway);
    }
  }

  private async initRazorpay(amount: number, userId: string, config: PaymentGateway) {
    console.log('Initiating Razorpay payment...', { amount, userId, key: config.apiKey });
    // In a real app, you would call your backend to create an order
    // and then open the Razorpay checkout.
    return { type: 'razorpay', amount, config };
  }

  private async initCashfree(amount: number, userId: string, config: PaymentGateway) {
    try {
      console.log('Initiating Cashfree payment...', { amount, userId });
      
      // 1. Create order on backend
      const res = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userId })
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await res.json();
          throw new Error(error.error || error.message || 'Payment gateway initialization failed');
        } else {
          const text = await res.text();
          console.error('[PaymentService] Non-JSON error response:', text);
          throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}...`);
        }
      }

      const order = await res.json();
      
      // 2. Initialize Checkout
      const cashfree = (window as any).Cashfree({
        mode: config.id === 'cashfree' && (config.apiKey?.includes('TEST') || !config.apiKey) ? 'sandbox' : 'production'
      });

      return cashfree.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: "_self" 
      });
    } catch (error) {
      console.error('Cashfree Error:', error);
      throw error;
    }
  }

  private async initUPIGateway(amount: number, userId: string, config: PaymentGateway) {
    if (config.id === 'zapupi') {
      try {
        console.log('Initiating ZapUPI payment...', { amount, userId });
        
        // 1. Create order on backend
        const res = await fetch('/api/zapupi/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, userId })
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await res.json();
            throw new Error(error.error || error.message || 'ZapUPI initialization failed');
          } else {
            const text = await res.text();
            console.error('[PaymentService] ZapUPI non-JSON error response:', text);
            throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}...`);
          }
        }

        const data = await res.json();
        
        // Return data so frontend can choose to poll or redirect
        return { type: 'zapupi', amount, config, ...data };
      } catch (error) {
        console.error('ZapUPI Error:', error);
        throw error;
      }
    }
    
    console.log(`Initiating ${config.name} payment...`, { amount, userId, upi: config.upiId });
    return { type: 'upi', amount, config };
  }

  private async initCustomGateway(amount: number, userId: string, config: PaymentGateway) {
    console.log('Initiating Custom Gateway payment...', { amount, userId });
    return { type: 'custom', amount, config };
  }

  public dispose() {
    if (this.unsubscriber) {
      this.unsubscriber();
    }
  }
}

export const paymentService = new PaymentService();
