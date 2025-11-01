import express from "express";
import {
  getShowrooms,
  createShowroom,
  deleteShowroom,
} from "../controllers/showroomController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getShowrooms);
router.post("/", protect, adminOnly, createShowroom);
router.delete("/:id", protect, adminOnly, deleteShowroom);

export default router;
