import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  mainDescription: {
    type: String,
    required: true
  },
  image: {
    type: [String], // Ensures array of URLs
    required: true
  },
  bestseller: {
    type: Boolean,
    default: false
  },
  quantityOptions: [
    {
      label: { type: String, required: true },
      price: { type: Number, required: true }
    }
  ],
  date: {
    type: Number,
    default: Date.now // fallback to current timestamp
  },
  reviews: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      name: String,
      rating: { type: Number, required: true },
      comment: { type: String, required: true },
      images: [String], // <-- new
      date: { type: Date, default: Date.now }
    }
  ]

});

const productModel = mongoose.models.product || mongoose.model("product", productSchema);

export default productModel;
