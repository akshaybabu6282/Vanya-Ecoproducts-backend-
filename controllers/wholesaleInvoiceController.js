import mongoose from "mongoose";
import wholesaleInvoiceModel from "../models/wholesaleInvoiceModel.js";

function normalizeWholesaleInvoicePayload(body) {
  const {
    invoiceId,
    customerName,
    address = "",
    mobile = "",
    email = "",
    itemsOrdered,
    totalAmount,
  } = body || {};

  if (
    !invoiceId ||
    !customerName ||
    !Array.isArray(itemsOrdered) ||
    itemsOrdered.length === 0 ||
    typeof totalAmount !== "number"
  ) {
    return {
      error: "Missing or invalid wholesale invoice payload",
    };
  }

  const hasInvalidProductId = itemsOrdered.some((item) => {
    const productId = item?.productId || item?._id;
    return productId && !mongoose.Types.ObjectId.isValid(productId);
  });
  if (hasInvalidProductId) {
    return { error: "Invalid productId in itemsOrdered" };
  }

  const normalizedItems = itemsOrdered.map((item) => {
    const normalized = {
      name: item?.name,
      quantity: Number(item?.quantity),
      price: Number(item?.price),
      sourcedPrice: Number(item?.sourcedPrice) || 0,
      hsnCode: item?.hsnCode ? String(item.hsnCode).trim() : "",
    };
    const productId = item?.productId || item?._id;
    if (productId) {
      normalized.productId = productId;
    }
    return normalized;
  });

  const hasInvalidItems = normalizedItems.some(
    (item) =>
      !item.name ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      !Number.isFinite(item.sourcedPrice) ||
      item.sourcedPrice < 0
  );

  if (hasInvalidItems) {
    return {
      error: "Invalid itemsOrdered data",
    };
  }

  const sourcedTotal = normalizedItems.reduce(
    (sum, item) => sum + item.sourcedPrice * item.quantity,
    0
  );

  return {
    payload: {
      invoiceId: String(invoiceId).trim(),
      customerName: String(customerName).trim(),
      address: String(address).trim(),
      mobile: String(mobile).trim(),
      email: String(email).trim(),
      itemsOrdered: normalizedItems,
      totalAmount,
      sourcedTotal,
    },
  };
}

const createWholesaleInvoice = async (req, res) => {
  try {
    const normalized = normalizeWholesaleInvoicePayload(req.body);
    if (normalized.error) {
      return res.status(400).json({
        success: false,
        message: normalized.error,
      });
    }

    const savedInvoice = await wholesaleInvoiceModel.create(normalized.payload);
    return res.status(201).json({
      success: true,
      message: "Wholesale invoice saved successfully",
      invoice: savedInvoice,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Invoice ID already exists",
      });
    }

    console.error("Error saving wholesale invoice:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export { createWholesaleInvoice };
