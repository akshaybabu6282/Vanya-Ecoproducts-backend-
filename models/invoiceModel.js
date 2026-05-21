import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  flatName: {
    type: String,
    required: true,
    trim: true
  },
  flatNumber: {
    type: String,
    default: "",
    trim: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    default: "",
    trim: true
  },
  email: {
    type: String,
    default: "",
    trim: true,
    lowercase: true
  },
  itemsOrdered: {
    type: [invoiceItemSchema],
    required: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0,
      message: "At least one ordered item is required"
    }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  date: {
    type: Number,
    required: true,
    default: Date.now
  }
});

const invoiceModel = mongoose.models.invoice || mongoose.model("invoice", invoiceSchema);

export default invoiceModel;
