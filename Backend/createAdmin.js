// createAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function createAdmin() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const name = "Admin User";
    const email = "admin@example.com";
    const password = "admin123"; // 🔒 You can change this
    const role = "admin";

    // Check if admin already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log("⚠️ Admin already exists! Deleting and recreating...");
      await User.deleteOne({ email });
      console.log("✅ Removed existing admin");
    }

    // FIX: Use plain password - the User model will hash it automatically
    const admin = await User.create({
      name,
      email,
      password: password, // NO MANUAL HASHING - let User model handle it
      role,
    });

    console.log("🎉 Admin created successfully:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);

    // Test the password immediately
    console.log("\n🔐 Testing password verification...");
    const testAdmin = await User.findOne({ email });
    const isPasswordValid = await testAdmin.comparePassword(password);
    console.log('Password test:', isPasswordValid ? '✅ SUCCESS - Login will work' : '❌ FAILED - Login will not work');

    if (isPasswordValid) {
      console.log('\n🎉 You can now login with:');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
    }
    
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

createAdmin();