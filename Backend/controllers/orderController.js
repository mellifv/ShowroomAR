import Order from "../models/Order.js";

export const createOrder = async (req, res) => {
  try {
    const { items, totalPrice } = req.body;
    const order = await Order.create({
      user: req.user._id,
      items,
      totalPrice,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Order creation failed" });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate("items.product");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to load orders" });
  }
};
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to load order", error: error.message });
  }
};