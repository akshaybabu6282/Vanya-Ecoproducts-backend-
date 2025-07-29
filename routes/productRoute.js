import express from 'express'
import { addProduct, listProduct, removeProduct, singleProduct, updateProduct, addReview ,getProductReviews } from '../controllers/productController.js'
import upload from '../middleware/multer.js'
import adminAuth from '../middleware/adminAuth.js'
import authUser from "../middleware/auth.js";

const productRouter = express.Router()

productRouter.post('/add', adminAuth,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]),
  addProduct
)

productRouter.post('/update/:id', adminAuth,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]),
  updateProduct
)

productRouter.post('/remove', adminAuth, removeProduct)
productRouter.post('/single', singleProduct)
productRouter.get('/list', listProduct)
productRouter.post(
  "/add-review",
  authUser,
  upload.array("images", 4), // Allow max 4 images
  addReview
);
productRouter.get("/reviews/:id", getProductReviews);

export default productRouter
