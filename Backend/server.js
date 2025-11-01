import cors from "cors";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(express.json());

// ✅ Allow both Vercel frontend URLs
app.use(cors({
  origin: [
    "https://showroom-ar-91by.vercel.app",
    "https://showroom-ar-91by-h58ms02ad-mellifvs-projects.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
