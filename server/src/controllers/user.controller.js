import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { isValidObjectId } from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken}
    } catch (error) {
        console.error("Error during token generation:", error);
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

const Signup = asyncHandler(async (req, res) => {
    const { username, fullName, password } = req.body;

    if (!username || !fullName || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
        throw new ApiError(400, "Username already exists");
    }

    

    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        password,
    });


    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "User creation failed");
    }


    return res.status(201).json(
        new ApiResponse(201, "User created successfully", { createdUser })
    );
});

const Login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;


    if (!username || !password) {
        throw new ApiError(400, "Username and password are required");
    }    

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
        throw new ApiError(401, "Invalid username");
    }

    

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
    // console.error("Invalid password for user:", user.username);
    throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);    
    
    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if (!LoggedInUser) {
        console.error("Failed to fetch logged-in user:", user._id);
        throw new ApiError(500, "Failed to fetch logged-in user");
    }
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken",refreshToken,options)
    .status(200)
    .json(
        new ApiResponse(
            200, 
            "Login successful",
            {
                user: LoggedInUser,refreshToken,accessToken
            },
        )
    );
});

const Logout = asyncHandler(async (req, res) => {
    //Step1: Delete refresh token from user
    await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );
    //Step2: Clear cookies and send response
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.
    status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    )
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            "Current user fetched successfully", 
            { user: req.user }
        )
    );
});

const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Both old and new passwords are required");
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, "Password changed successfully",user)
  );
});












export{Signup, Login, Logout, getCurrentUser, generateAccessAndRefreshTokens,changePassword};

