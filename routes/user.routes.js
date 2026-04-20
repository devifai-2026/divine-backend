import { Router } from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/user.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// All user routes require authentication
router.use(verifyJWT);

router.get("/profile", getProfile);
router.put("/profile", upload.single("avatar"), updateProfile);
router.put("/password", changePassword);

router.get("/addresses", getAddresses);
router.post("/addresses", addAddress);
router.put("/addresses/:addressId", updateAddress);
router.delete("/addresses/:addressId", deleteAddress);

export default router;
