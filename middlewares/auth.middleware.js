import { verifyAccessToken } from "../utils/jwt.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";

const verifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json(new ApiResponse(401, null, "Unauthorized - No token provided"));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select("-password -refreshToken");

    if (!user) {
      return res.status(401).json(new ApiResponse(401, null, "Unauthorized - Invalid token"));
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json(new ApiResponse(401, null, "Unauthorized - Token expired or invalid"));
  }
};

export default verifyJWT;
