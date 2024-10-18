import jwt from "jsonwebtoken"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {asyncHandler} from '../utils/asyncHandler.js'

//WHY DO WE NEED THIS MIDDLEWARE IN THE FIRST PLACE WHAT DOES IT DO
export const verifyJWT = asyncHandler( async(req, _, next)=>{
    const token = req.cookies.accessToken || req.header("Authorization")?.replace("Bearer ", "")

    if(!token){
        throw new ApiError(500, "unauthorized")
    }

    try {   
        //What do we get inside decodedToken
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if(!user){
            throw new ApiError(404, "User not found")
        }
    //    attaching the authenticated user's data (retrieved from the database) to the req (request) object.
    // This allows you to make the authenticated user's information available throughout the rest of the request's lifecycle.
        req.user = user
       

        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})
