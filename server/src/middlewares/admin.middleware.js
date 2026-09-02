import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const verifyAdmin = asyncHandler(async (req, _, next) => {
  try {
    if (!req.user) {
      console.error("No user found on request");
      throw new ApiError(401, "Unauthorized");
    }

    if (req.user.role !== "admin") {
      console.error(`User ${req.user.username} is not an admin`);
      throw new ApiError(403, "Admin access only");
    }

    next();
  } catch (error) {
    console.error("Error in verifyAdmin middleware:", error);
    throw new ApiError(403, "Forbidden: Admin access only");
  }
});