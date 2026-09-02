import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
 
 
 
 export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || (req.headers.authorization?.startsWith("Bearer ") && req.headers.authorization.split(" ")[1]);
        
        if(!token){
            console.error("Token not found in request.");
            throw new ApiError(401, "Unauthorized");
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            console.error("User not found with id:", decodedToken?._id);
            throw new ApiError(404, "User not found");
        }
    
        req.user=user;
        next()
    } catch (error) {
        console.error("Error verifying JWT token:", error);
        throw new ApiError(401, "Unauthorized");
        
    }

 });