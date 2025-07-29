import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/vanya`);
        console.log("✅ Database Connected");
    } catch (error) {
        console.error("❌ Database Connection Error:", error);
        process.exit(1); // Exit process with failure
    }
};

// Event listeners for better debugging
mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB Disconnected");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB Connection Error:", err);
});

export default connectDB;
