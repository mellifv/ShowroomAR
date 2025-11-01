import mongoose from "mongoose";

const showroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  logo: String,
});

export default mongoose.model("Showroom", showroomSchema);
