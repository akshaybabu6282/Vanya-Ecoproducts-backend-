import { v2 as cloudinary } from 'cloudinary'
import productModel from '../models/productModel.js'
import userModel from '../models/userModel.js';

const normalizeQuantityOptions = (options) =>
    options.map((opt) => {
        const normalized = {
            label: opt.label,
            price: Number(opt.price)
        };
        if (opt.originalPrice != null && opt.originalPrice !== '') {
            normalized.originalPrice = Number(opt.originalPrice);
        }
        return normalized;
    });

// function for adding product
const addProduct = async (req, res) => {
    try {
        const { name, description, bestseller, mainDescription, quantityOptions } = req.body;

        // ✅ Parse quantityOptions string to array
        let parsedQuantityOptions;
        try {
            parsedQuantityOptions = JSON.parse(quantityOptions);
            if (!Array.isArray(parsedQuantityOptions) || parsedQuantityOptions.length === 0) {
                return res.json({ success: false, message: 'Invalid or empty quantity options.' });
            }
        } catch (err) {
            return res.json({ success: false, message: 'Failed to parse quantity options.' });
        }

        // ✅ Handle images
        const image1 = req.files.image1 && req.files.image1[0];
        const image2 = req.files.image2 && req.files.image2[0];
        const image3 = req.files.image3 && req.files.image3[0];
        const image4 = req.files.image4 && req.files.image4[0];

        const images = [image1, image2, image3, image4].filter((img) => img !== undefined);

        const imagesUrl = await Promise.all(
            images.map(async (item) => {
                const result = await cloudinary.uploader.upload(item.path, { resource_type: 'image' });
                return result.secure_url;
            })
        );

        // ✅ Create product data
        const productData = {
            name,
            description,
            mainDescription,
            bestseller: bestseller === 'true',
            quantityOptions: normalizeQuantityOptions(parsedQuantityOptions),
            image: imagesUrl,
            date: Date.now()
        };

        const product = new productModel(productData);
        await product.save();

        res.json({ success: true, message: "Product added" });

    } catch (error) {
        console.error("Add product error:", error);
        res.json({ success: false, message: error.message });
    }
};

// ✅ Update Product
const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, description, bestseller, mainDescription, quantityOptions } = req.body;

        const product = await productModel.findById(productId);
        if (!product) return res.json({ success: false, message: "Product not found" });

        let parsedQuantityOptions;
        try {
            parsedQuantityOptions = quantityOptions ? JSON.parse(quantityOptions) : product.quantityOptions;
        } catch (err) {
            return res.json({ success: false, message: 'Failed to parse quantity options.' });
        }

        const imageFields = ['image1', 'image2', 'image3', 'image4'];
        const newImages = [];

        for (const field of imageFields) {
            if (req.files[field]) {
                const uploaded = await cloudinary.uploader.upload(req.files[field][0].path, { resource_type: 'image' });
                newImages.push(uploaded.secure_url);
            }
        }

        product.name = name || product.name;
        product.description = description || product.description;
        product.mainDescription = mainDescription || product.mainDescription;
        product.bestseller = bestseller === 'true';
        product.quantityOptions = normalizeQuantityOptions(parsedQuantityOptions);
        if (newImages.length > 0) product.image = newImages;

        await product.save();
        res.json({ success: true, message: "Product updated successfully" });

    } catch (error) {
        console.error("Update product error:", error);
        res.json({ success: false, message: error.message });
    }
};



// function for list product
const listProduct = async (req, res) => {
    try {
        const products = await productModel.find({});
        res.json({ success: true, products })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// function for removing product
const removeProduct = async (req, res) => {
    try {
        await productModel.findByIdAndDelete(req.body.id)
        res.json({ success: true, message: "Product removed" })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// function for single product info
const singleProduct = async (req, res) => {
    try {
        const { productId } = req.body
        const product = await productModel.findById(productId)
        res.json({ success: true, product })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

//function for add review 
const addReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;
        const userId = req.user._id;

        const user = await userModel.findById(userId);
        if (!user) return res.json({ success: false, message: "User not found" });

        const product = await productModel.findById(productId);
        if (!product) return res.json({ success: false, message: "Product not found" });

        const alreadyReviewed = product.reviews.find(
            (r) => r.userId.toString() === userId.toString()
        );
        if (alreadyReviewed) {
            return res.json({ success: false, message: "You already reviewed this product." });
        }

        // Upload images
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            imageUrls = await Promise.all(
                req.files.map(async (file) => {
                    const uploaded = await cloudinary.uploader.upload(file.path, { resource_type: 'image' });
                    return uploaded.secure_url;
                })
            );
        }


        const review = {
            userId,
            name: user.name,
            rating: Number(rating),
            comment,
            images: imageUrls,
            date: new Date()
        };

        product.reviews.push(review);
        await product.save();

        res.json({ success: true, message: "Review submitted" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Get all reviews for a product
const getProductReviews = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, reviews: product.reviews.reverse() }); // Show latest first
    } catch (error) {
        console.error("Error fetching reviews:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch reviews" });
    }
};


export {
    addProduct,
    updateProduct,
    listProduct,
    removeProduct,
    singleProduct,
    addReview,
    getProductReviews
};