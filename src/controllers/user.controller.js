import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while genrating the tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //steps
    //get user details from frontend
    const { username, email, fullName, password } = req.body
    console.log("email: ", email)

    //validation
    if ([fullName, email, username, password].some((field) => field?.trim === "")) {
        throw new ApiError(400, "All Fields are required")
    }
    //check if user already exist: username, email

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email and username already exists")
    }

    //check for images, check fro avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar files required")
    }

    //upload for cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
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

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //return response
    return res
    .status(201)
    .json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

});

const loginUser = asyncHandler(async (req, res) => {

    //req-body - data
    const { email, username, password } = req.body

    if (!username && !email) {
        throw new ApiError(400, "username or password is required")
    }

    //username or email
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    //find the user
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    //password check  - we use model methods to find password , this method is store in my user details {user}
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User Credentials")
    }

    //access token and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken") // to update th user with tokens

    //send into cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser, accessToken, refreshToken
            }, "User loggedIn Successfully")
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id, {
        $set: {
            refreshToken: undefined
        }
    },
        {
            new: true
        }
    )

    //send into cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Looged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} =  await generateAccessAndRefreshToken(user?._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, {accessToken, refreshToken: newRefreshToken}, "Action Token Refresh Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Old Password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changes Successfully"))

})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetch successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All Field Required")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set:{
            fullName,
            email: email
        }
    }, {new: true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, "Account Deatils Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uplaoding on avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set: {
            avatar: avatar.url
        }
    }, {new: true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req,res) => {

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uplaoding on CoverImage")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set: {
            coverImage: coverImage.url
        }
    }, {new: true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is Missing")
    }

    const channel = User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions", // this is my model "Subscription" but we use lowercase with plural form
                localfield:"_id",
                foreignfield: "channel",
                as: "subscribers"

            }
        },
        {
            $lookup:{
                from: "subscriptions", // this is my model "Subscription" but we use lowercase with plural form
                localfield:"_id",
                foreignfield: "subscriber", 
                as: "subscribedTo"

            }
        },
        {
            $addFields:{
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]}, //in means user present or not
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user._id.toString())
              }
        },
        {
            $lookup:{
                from: "videos",
                localfield: "watchHistory",
                foreignfield: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localfield: "owner",
                            foreignfield: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]) 

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, user[0].watchHistory, "Watch History Fetch Successfully"
        )
    )
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword,  getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory}

