import Showroom from "../models/Showroom.js";

export const getShowrooms = async (req, res) => {
  try {
    const showrooms = await Showroom.find();
    res.json(showrooms);
  } catch (error) {
    res.status(500).json({ message: "Failed to load showrooms" });
  }
};

export const createShowroom = async (req, res) => {
  try {
    const showroom = await Showroom.create(req.body);
    res.status(201).json(showroom);
  } catch (error) {
    res.status(500).json({ message: "Showroom creation failed" });
  }
};

export const deleteShowroom = async (req, res) => {
  try {
    await Showroom.findByIdAndDelete(req.params.id);
    res.json({ message: "Showroom deleted" });
  } catch (error) {
    res.status(500).json({ message: "Deletion failed" });
  }
};
