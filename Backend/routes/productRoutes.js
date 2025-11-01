import express from "express";
import {
  getProducts,
  getProductById,
  getProductsByShowroom,
  createProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/showroom/:showroomId", getProductsByShowroom);
router.post("/", protect, adminOnly, createProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
