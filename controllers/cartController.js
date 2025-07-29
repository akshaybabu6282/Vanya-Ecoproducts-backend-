import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET; // Make sure this is set in your .env

// ✅ Decode token and get user ID
const getUserIdFromToken = (req) => {
  const token = req.headers.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (err) {
    return null;
  }
};

// ✅ Add product to cart
const addToCart = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { itemId, selectedOptionIndex } = req.body;

    if (!userId) return res.json({ success: false, message: "Unauthorized" });

    const user = await userModel.findById(userId);
    const cartData = user.cartData || {};

    const cartKey = `${itemId}_${selectedOptionIndex}`;

    if (cartData[cartKey]) {
      cartData[cartKey].quantity += 1;
    } else {
      cartData[cartKey] = {
        quantity: 1,
        selectedOptionIndex,
        itemId,
      };
    }

    await userModel.findByIdAndUpdate(userId, { cartData });
    res.json({ success: true, message: "Added To Cart" });
  } catch (error) {
    console.error("Add to cart failed:", error);
    res.json({ success: false, message: error.message });
  }
};

// ✅ Update cart
const updateCart = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { itemId, selectedOptionIndex, newQuantity } = req.body;

    if (!userId) return res.json({ success: false, message: "Unauthorized" });

    const user = await userModel.findById(userId);
    const cartData = user.cartData || {};

    const cartKey = `${itemId}_${selectedOptionIndex}`;

    if (newQuantity > 0) {
      cartData[cartKey] = {
        quantity: newQuantity,
        selectedOptionIndex,
        itemId,
      };
    } else {
      delete cartData[cartKey];
    }

    await userModel.findByIdAndUpdate(userId, { cartData });
    res.json({ success: true, message: "Cart Updated" });
  } catch (error) {
    console.error("Update cart failed:", error);
    res.json({ success: false, message: error.message });
  }
};

// ✅ Get cart
const getUserCart = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);

    if (!userId) return res.json({ success: false, message: "Unauthorized" });

    const user = await userModel.findById(userId);
    const cartData = user.cartData || {};

    res.json({ success: true, cartData });
  } catch (error) {
    console.error("Get cart failed:", error);
    res.json({ success: false, message: error.message });
  }
};

export { addToCart, updateCart, getUserCart };
