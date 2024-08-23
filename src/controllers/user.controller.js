import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'

const registerUser = asyncHandler( async (req, res) => {
    //steps
    //get user details from frontend
    const {username, email, fullName, password}  = req.body
    console.log("email: ", email)

    //validation
    if([fullName, email, username, password].some((field)=> field?.trim === "")){
        throw new ApiError(400, "All Fields are required")
    }
    //check if user already exist: username, email

    const existedUser = User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email and username already exists")
    }
    
    //check for images, check fro avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar files required")
    }    

    //upload for cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar files required")
    }

    //created user object - create entry

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select( 
        "-password -refreshToken"
    )
    
    //check for user response

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

});


export {registerUser}

