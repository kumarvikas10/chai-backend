import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"})) //json appceptance limit
app.use(express.urlencoded({extended: true, limit: "16kb"})) //when url convert url into special chrachter then it is use url ecoder
app.use(express.static("public")) //use to store file or folder or pdf
app.use(cookieParser()) //use to read cookies and store cookies to user through server


//routes import

import userRouter from "./routes/user.routes.js";


//routes declaration
app.use("/api/v1/users", userRouter); //localhost:8000/api/v1/users/register or login






export {app} 