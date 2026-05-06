import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRouter.js';
import orderRouter from './routes/orderRoute.js';
import invoiceRouter from './routes/invoiceRoute.js';


// App config
const app = express();
const port = process.env.PORT || 4000;

connectCloudinary();

// Middlewares
app.use(express.json());
app.use(cors());

// API Endpoints
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api/invoice', invoiceRouter);

// Test API
app.get('/', (req, res) => {
    res.send("API Working");
});

const startServer = async () => {
    await connectDB();
    app.listen(port, '0.0.0.0', () =>
        console.log('Server started on PORT : ' + port)
    );
};

startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
