import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//helper function
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(500, "Error: User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    //assigns the newly generated refreshToken (from user.generateRefreshToken()) 
    //to the refreshToken field of the user document in the database.
    user.refreshToken = refreshToken;
    //This line saves the user document with the updated refreshToken back to the MongoDB database.
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating  access and refresh tokens"
    );
  }
};
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  //validation
  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  console.warn(req.files);
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Uploaded Avatar", avatar);
  } catch (error) {
    console.log("Error uploading avatar", error);
    throw new ApiError(500, "Failed to upload avatar");
  }

  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverLocalPath);
    console.log("Uploaded coverImage", coverImage);
  } catch (error) {
    console.log("Error uploading coverImage", error);
    throw new ApiError(500, "Failed to upload coverImage");
  }

  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering a user");
    }
    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registerd successfully"));
  } catch (error) {
    console.log("User creation failed");
    if (avatar) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFromCloudinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something went wrong while registering a user and images were deleted"
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  console.log("Request Body:", req.body);
  const { email, username, password } = req.body;
  // validation
  if (!email || !username || !password) {
    throw new ApiError(500, "All fields are required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(500, "User not found ");
  }

  //validate password

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Password");
  }
  //???
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(500, "User not found");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler( async(req, res)=>{
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken: undefined 
      }
    },
    //new is used to return new/fresh information that we changed
    {new: true}
  )
  const loggedOutUser = await User.findById(user._id).select("-password -refreshToken")
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json( new ApiResponse(200, loggedOutUser, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  //this is coming from client side
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, " Refresh token is required");
  }

  try {
    //we get the payload that was encoded in the refreshToken i.e _id
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
 

    const user = await User.findById(decodedToken?._id);


    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token - User not found");
    }
    
    if (user.refreshToken === undefined) {
      throw new ApiError(401, "User's refresh token not found in the database");
    }
    
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid Refresh Token - Token mismatch");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };


    //what is old refresh token and what is new refresh token?
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);


    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken }, //why did we write it like this?
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new ApiError(
      500,
      "Something went wrong while refreshing acess token"
    );
  }
});

const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword, newPassword} = req.body;

  user = await User.findById(req.user?._id)
  //verification
  const isPasswordValid = user.isPasswordCorrect(oldPassword)

  if(!isPasswordValid){
    throw new ApiError(401,"Old Password is incorrect")
  }

  user.password = newPassword;
  await user.save({validateBeforeSave:false})

 

  return res
    .status(200)
    .json(new ApiResponse(200,"Password changed successfully"))

  
})


const getCurrentUser = asyncHandler(async(req,res)=>{
return res
  .status(200)
  .json(new ApiResponse(200,req.user,"Current User Details"))
})


const UpdateUserDetails = asyncHandler(async(req,res)=>{
  const {fullname, email} = req.body;

  if(!fullname || !email){
    throw new ApiError(401,'Full name and email are required')
  }

   const user =  await User.findByIdAndUpdate(req.user?._id,{
      $set:{
        fullname,
        email:email
      }
    },{new:true})
}).select("-password -refreshToken")

  return res
    .status(200)
    .json(new ApiResponse(200,user,"User details updated sucessfully"))

const changeUserAvatar = asyncHandler(async(req,res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400, "File is required")
  }

  const = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError("Error while uploading the avatar")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },{new:true}
  ).select("-password -refreshToken")

  return res
    .status(200)
    .json(200, user, "Avatar updated Successfully")

})


const changeUserCoverImage = asyncHandler(async(req,res)=>{
 const coverLocalPath = req.file?.path

 if(!coverLocalPath){
  throw new ApiError(400, "File is required")
 }

 const coverImage = await uploadOnCloudinary(coverLocalPath)

 if(!coverImage.url){
  throw new ApiError("Error while uploading Cover Image")
 }

 const user = await User.findByIdAndUpdate(req.user?._id,
  {
    $set:{
      coverImage: coverImage.url
    }
  },{new:true}
 ).select("-password -refreshToken")

 return res
    .status(200)
    .json(200, user, "Cover Image updated Successfully")

})

export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken, 
  changeCurrentPassword,
  UpdateUserDetails, 
  changeUserAvatar, 
  changeUserCoverImage 
  };
