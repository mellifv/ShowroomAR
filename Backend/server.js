import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import showroomRoutes from "./routes/showroomRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

dotenv.config();
const app = express();


app.use(express.json());
app.use(cors({
  origin: [
    'https://showroom-ar-91by.vercel.app',  // Your Vercel frontend
    'http://localhost:3000'
  ],
  credentials: true
}));
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

app.get("/", (req, res) => res.send("API is running..."));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/showrooms", showroomRoutes);
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
