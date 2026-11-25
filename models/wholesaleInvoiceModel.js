import mongoose from "mongoose";

const wholesaleInvoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    sourcedPrice: { type: Number, default: 0, min: 0 },
    hsnCode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const wholesaleInvoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    default: "",
    trim: true,
  },
  mobile: {
    type: String,
    default: "",
    trim: true,
  },
  email: {
    type: String,
    default: "",
    trim: true,
    lowercase: true,
  },
  itemsOrdered: {
    type: [wholesaleInvoiceItemSchema],
    required: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0,
      message: "At least one ordered item is required",
    },
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  sourcedTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  date: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

const wholesaleInvoiceModel =
  mongoose.models.wholesaleInvoice ||
  mongoose.model("wholesaleInvoice", wholesaleInvoiceSchema);

export default wholesaleInvoiceModel;
