import Product from "../models/Product.js";

export const getProducts = async (req, res) => {
  const products = await Product.find().populate("showroom");
  res.json(products);
};

export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id).populate("showroom");
  if (product) res.json(product);
  else res.status(404).json({ message: "Product not found" });
};

export const getProductsByShowroom = async (req, res) => {
  try {
    const products = await Product.find({ showroom: req.params.showroomId })
                                  .populate("showroom"); // Add this line
    console.log(`Found ${products.length} products for showroom ${req.params.showroomId}`);
    res.json(products);
  } catch (error) {
    console.error('Error in getProductsByShowroom:', error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ message: "Product creation failed" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: "Deletion failed" });
  }
};
