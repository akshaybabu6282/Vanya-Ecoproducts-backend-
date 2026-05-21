import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import razorpay from "razorpay";
import dotenv from "dotenv";
import { sendMail as deliverMail } from "../utils/mailer.js";

dotenv.config();

const currency = "INR";

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const sendMail = async (to, subject, text) => {
  try {
    const info = await deliverMail(to, subject, text);
    console.log(`✅ Email sent to ${to}: ${info.response}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
  }
};

// ✅ Place Order - Cash on Delivery
const placeOrder = async (req, res) => {
  try {
    const paymentMethod = "Cash on Delivery";
    const { items, amount, address } = req.body;
    const userId = req.user._id;

    const newOrder = new orderModel({
      userId,
      items,
      amount,
      address,
      paymentMethod,
      payment: false,
      status: "Order Placed"
    });

    await newOrder.save();

    // ✅ Clear user cart in DB
    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    // ✅ Email to Customer
    const customerText = `
Thank you for your order at Vanya Ecoproducts!

Order Summary:
- Amount: ₹${amount}
- Payment Method: ${paymentMethod}
- Items: ${items.map(item => `${item.name} × ${item.quantity}`).join(", ")}

Shipping Address:
${address.firstName} ${address.lastName}
${address.street}
${address.city}, ${address.state}, ${address.country} - ${address.zipcode}
${address.email}
${address.phone}

We will contact you shortly with further updates.

Regards,  
Vanya Ecoproducts Team`;

    await sendMail(address.email, "✅ Order Confirmation - Vanya Ecoproducts", customerText);

    const adminText = `
📥 New Order Received at Vanya Ecoproducts

👤 Customer:
${address.firstName} ${address.lastName}
📧 ${address.email}
📞 ${address.phone}

💵 Amount: ₹${amount}
🧾 Payment Method: ${paymentMethod}
🛍️ Items: ${items.map(item => `${item.name} × ${item.quantity}`).join(", ")}

📍 Address:
${address.street}, ${address.city}, ${address.state}, ${address.country} - ${address.zipcode}

Check your admin dashboard for full details.
`;

    await sendMail(process.env.ADMIN_EMAIL, "📥 New Order Received - Vanya Ecoproducts", adminText);

    res.status(200).json({ success: true, message: "Order placed successfully" });
  } catch (error) {
    console.error("❌ Error placing order:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Place Order with Razorpay
const placeOrderRazorpay = async (req, res) => {
  try {
    const { items, amount, address } = req.body;
    const userId = req.user._id;


    const orderData = new orderModel({
      userId,
      items,
      amount,
      address,
      paymentMethod: "Razorpay",
      payment: false
    });

    await orderData.save();

    const options = {
      amount: amount * 100,
      currency,
      receipt: orderData._id.toString()
    };

    razorpayInstance.orders.create(options, (error, order) => {
      if (error) {
        return res.json({ success: false, message: error.message });
      }
      res.json({ success: true, order });
    });
  } catch (error) {
    console.error("❌ Error placing Razorpay order:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ✅ Verify Razorpay Payment
const verifyRazorpay = async (req, res) => {
  try {
    const paymentMethod = "Razorpay";
    const { razorpay_order_id, items, amount, address } = req.body;

    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
    if (!orderInfo) return res.status(400).json({ success: false, message: "Invalid order ID" });

    if (orderInfo.status === "paid") {
      await orderModel.findByIdAndUpdate(orderInfo.receipt, { payment: true });

      // ✅ Clear user cart in DB
      const orderDoc = await orderModel.findById(orderInfo.receipt);
      await userModel.findByIdAndUpdate(orderDoc.userId, { cartData: {} });

      const customerText = `
✅ Thank you for your payment!

🛍️ Order Summary:
- Amount: ₹${amount}
- Payment Method: ${paymentMethod}
- Items: ${items.map(item => `${item.name} × ${item.quantity}`).join(", ")}

📦 Shipping Address:
${address.firstName} ${address.lastName}
${address.street}
${address.city}, ${address.state}, ${address.country} - ${address.zipcode}
📧 ${address.email}
📞 ${address.phone}

We will contact you shortly with further updates.

Regards,  
Vanya Ecoproducts Team`;

      await sendMail(address.email, "✅ Order Confirmation - Vanya Ecoproducts", customerText);

      const adminText = `
📥 New Paid Order Received

👤 Customer:
${address.firstName} ${address.lastName}
📧 ${address.email}
📞 ${address.phone}

💵 Amount: ₹${amount}
🧾 Payment Method: ${paymentMethod}
🛍️ Items: ${items.map(item => `${item.name} × ${item.quantity}`).join(", ")}

📍 Address:
${address.street}, ${address.city}, ${address.state}, ${address.country} - ${address.zipcode}
`;

      await sendMail(process.env.ADMIN_EMAIL, "📥 Paid Order - Vanya Ecoproducts", adminText);

      res.json({ success: true, message: "✅ Payment Successful" });
    } else {
      res.json({ success: false, message: "❌ Payment Not Completed" });
    }
  } catch (error) {
    console.error("❌ Error verifying Razorpay payment:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ✅ Admin: Get All Orders
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.error("❌ Error fetching all orders:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// ✅ Get Orders by User
const userOrders = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ get from middleware
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};


// ✅ Admin: Update Order Status
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "✅ Status Updated" });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export {
  placeOrder,
  placeOrderRazorpay,
  verifyRazorpay,
  allOrders,
  userOrders,
  updateStatus
};
