import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // FIX: Try both 'id' and 'userId' to handle both cases
      const userId = decoded.id || decoded.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authorized, invalid token payload" });
      }
      
      req.user = await User.findById(userId).select("-password");
      
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }
      
      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      res.status(401).json({ message: "Not authorized, invalid token" });
    }
  } else {
    res.status(401).json({ message: "No token provided" });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access only" });
  }
};