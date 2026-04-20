import ApiResponse from "../utils/ApiResponse.js";

const isAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json(new ApiResponse(403, null, "Admin access required"));
  }
  next();
};

export default isAdmin;
