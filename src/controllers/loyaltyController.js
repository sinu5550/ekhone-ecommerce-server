const prisma = require('../utils/db');
const { errorResponse, successResponse } = require("../utils/responseHandler");

const loyaltyController = {
  // 1. Get loyalty balance for customer
  async getLoyaltyBalance(req, res) {
    try {
      const { id } = req.params;
      
      // Get or create loyalty record
      let loyalty = await prisma.loyaltyPoints.findUnique({
        where: { customerId: parseInt(id) }
      });
      
      // If no loyalty record exists, create one
      if (!loyalty) {
        loyalty = await prisma.loyaltyPoints.create({
          data: {
            customerId: parseInt(id),
            balance: 0,
            lifetimeEarned: 0,
            lifetimeRedeemed: 0
          }
        });
      }
      
      return successResponse(res, 'Success', {
        balance: loyalty.balance,
        balanceInBDT: loyalty.balance, // 1 point = 1 BDT
        lifetimeEarned: loyalty.lifetimeEarned,
        lifetimeRedeemed: loyalty.lifetimeRedeemed,
        minRedemption: 500,
        canRedeem: loyalty.balance >= 500
      });
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },

  // 2. Validate points redemption at checkout
  async validateRedemption(req, res) {
    try {
      const { customerId, pointsToRedeem, orderSubtotal, existingDiscounts = 0 } = req.body;
      
      if (!customerId || pointsToRedeem === undefined || orderSubtotal === undefined) {
        return errorResponse(res, 'Customer ID, points to redeem, and order subtotal are required');
      }
      
      // Get customer's points
      const loyalty = await prisma.loyaltyPoints.findUnique({
        where: { customerId: parseInt(customerId) }
      });
      
      const balance = loyalty ? loyalty.balance : 0;
      const pointsToRedeemInt = parseInt(pointsToRedeem);
      const orderSubtotalFloat = parseFloat(orderSubtotal);
      const existingDiscountsFloat = parseFloat(existingDiscounts);
      
      // Validation rules
      if (pointsToRedeemInt < 500) {
        return errorResponse(res, 'Minimum 500 points required to redeem');
      }
      
      if (pointsToRedeemInt > balance) {
        return errorResponse(res, `Insufficient points balance. Available: ${balance} points`);
      }
      
      // Check if redemption exceeds payable amount
      const payableAmount = orderSubtotalFloat - existingDiscountsFloat;
      if (pointsToRedeemInt > payableAmount) {
        return errorResponse(res, 
          `Cannot redeem more than ${Math.floor(payableAmount)} points for this order`,
          400,
          { maxRedeemable: Math.floor(payableAmount) }
        );
      }
      
      return successResponse(res, 'Valid redemption', {
        isValid: true,
        pointsToRedeem: pointsToRedeemInt,
        pointsValue: pointsToRedeemInt,
        discountAmount: pointsToRedeemInt,
        newBalance: balance - pointsToRedeemInt,
        currentBalance: balance
      });
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },

  // 3. Process points when order is PAID & DELIVERED
  async processOrderPayment(req, res) {
    try {
      const { orderId } = req.params;
      
      // Get order details
      const order = await prisma.onlineOrder.findUnique({
        where: { id: parseInt(orderId) },
        include: { customer: true }
      });
      
      if (!order) {
        return errorResponse(res, 'Order not found');
      }
      
      // Check if order is delivered AND paid
      const isPaid = order.paymentMethod === 'COD' || 
                    (order.paidAmount && order.paidAmount >= order.grandTotal);
      
      if (order.status !== 'Delivered' || !isPaid) {
        return successResponse(res, 'Order not yet eligible for points', {
          eligible: false,
          reason: 'Order must be delivered and paid to earn points',
          status: order.status,
          isPaid: isPaid
        });
      }
      
      // Check if already processed
      if (order.pointsEarned !== null) {
        return successResponse(res, 'Points already processed for this order', {
          alreadyProcessed: true,
          pointsEarned: order.pointsEarned
        });
      }
      
      // Calculate points (1 point per 1000 BDT, min 10,000 BDT)
      let pointsEarned = 0;
      if (order.grandTotal >= 10000) {
        pointsEarned = Math.floor(order.grandTotal / 1000);
      }
      
      // If no points earned, just mark as processed
      if (pointsEarned === 0) {
        await prisma.onlineOrder.update({
          where: { id: parseInt(orderId) },
          data: { pointsEarned: 0 }
        });
        
        return successResponse(res, 'Order not eligible for points', {
          pointsEarned: 0,
          reason: 'Order total less than 10,000 BDT'
        });
      }
      
      // Use transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Get or create loyalty record
        let loyalty = await tx.loyaltyPoints.findUnique({
          where: { customerId: order.customerId }
        });
        
        if (!loyalty) {
          loyalty = await tx.loyaltyPoints.create({
            data: {
              customerId: order.customerId,
              balance: pointsEarned,
              lifetimeEarned: pointsEarned,
              lifetimeRedeemed: 0
            }
          });
        } else {
          // Update existing loyalty
          loyalty = await tx.loyaltyPoints.update({
            where: { id: loyalty.id },
            data: {
              balance: { increment: pointsEarned },
              lifetimeEarned: { increment: pointsEarned },
              updatedAt: new Date()
            }
          });
        }
        
        // Create transaction record
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyPointsId: loyalty.id,
            customerId: order.customerId,
            orderId: order.id,
            type: 'EARNED',
            points: pointsEarned,
            balanceAfter: loyalty.balance,
            description: `Points earned from order #${order.orderNumber}`,
            metadata: {
              orderNumber: order.orderNumber,
              orderTotal: order.grandTotal,
              pointsPerThousand: 1
            }
          }
        });
        
        // Update order with points earned
        await tx.onlineOrder.update({
          where: { id: order.id },
          data: { pointsEarned: pointsEarned }
        });
        
        return loyalty;
      });
      
      return successResponse(res, 'Points credited successfully', {
        pointsEarned,
        newBalance: result.balance,
        orderNumber: order.orderNumber,
        customerId: order.customerId
      });
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },

  // 4. Get transaction history
  async getLoyaltyTransactions(req, res) {
    try {
      const { id } = req.params;
      const { limit = 20 } = req.query;
      
      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { customerId: parseInt(id) },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              grandTotal: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });
      
      return successResponse(res, 'Success', transactions);
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },

  // 5. Simple initialize endpoint
  async initialize(req, res) {
    try {
      const { customerId } = req.body;
      
      const loyalty = await prisma.loyaltyPoints.upsert({
        where: { customerId: parseInt(customerId) },
        update: {},
        create: {
          customerId: parseInt(customerId),
          balance: 0,
          lifetimeEarned: 0,
          lifetimeRedeemed: 0
        }
      });
      
      return successResponse(res, 'Loyalty initialized', loyalty);
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  },

  // 6. Refund points when order is cancelled
  async refundPoints(req, res) {
    try {
      const { orderId } = req.params;
      
      const order = await prisma.onlineOrder.findUnique({
        where: { id: parseInt(orderId) },
        include: { customer: true }
      });
      
      if (!order) {
        return errorResponse(res, 'Order not found');
      }
      
      // Check if points were redeemed for this order
      if (!order.pointsRedeemed || order.pointsRedeemed <= 0) {
        return successResponse(res, 'No points to refund', {
          refunded: false,
          reason: 'No points were redeemed for this order'
        });
      }
      
      const result = await prisma.$transaction(async (tx) => {
        // Get loyalty account
        const loyalty = await tx.loyaltyPoints.findUnique({
          where: { customerId: order.customerId }
        });
        
        if (!loyalty) {
          throw new Error('Loyalty account not found');
        }
        
        const pointsToRefund = order.pointsRedeemed;
        const newBalance = loyalty.balance + pointsToRefund;
        
        // Refund points
        const updatedLoyalty = await tx.loyaltyPoints.update({
          where: { id: loyalty.id },
          data: {
            balance: newBalance,
            lifetimeRedeemed: { decrement: pointsToRefund },
            updatedAt: new Date()
          }
        });
        
        // Create refund transaction
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyPointsId: loyalty.id,
            customerId: order.customerId,
            orderId: order.id,
            type: 'REFUNDED',
            points: pointsToRefund,
            balanceAfter: newBalance,
            description: `Points refunded for cancelled order #${order.orderNumber}`,
            metadata: {
              orderNumber: order.orderNumber,
              refundType: 'order_cancellation'
            }
          }
        });
        
        // Clear redeemed points from order
        await tx.onlineOrder.update({
          where: { id: order.id },
          data: {
            pointsRedeemed: null,
            pointsRedeemedValue: null
          }
        });
        
        return updatedLoyalty;
      });
      
      return successResponse(res, 'Points refunded successfully', {
        pointsRefunded: order.pointsRedeemed,
        newBalance: result.balance,
        orderId: order.id
      });
      
    } catch (error) {
      return errorResponse(res, error.message);
    }
  }
};

module.exports = loyaltyController;
