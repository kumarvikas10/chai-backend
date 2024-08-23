import { config as configDotenv } from "dotenv";
import connectDB from "./db/index.js"; 
import {app} from './app.js'

configDotenv({
    path: './.env'
});

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`server is running at port : ${process.env.PORT}`)
    });
})
.catch((err)=> {
    console.log("Mongo DB Connection Failed", err)
})


/*
First Approch
(async()=>{
    try{
        await mongoose.connect(`${process.env.MOGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=>{
            comsole.log("Error: ", error);
            throw err
        })
        app.listen(process.env.PORT, ()=>{
            comsole.log(`App is listening on port ${process.env.PORT}`);
        })
    }catch(error){
        comsole.log("Error: ", error);
        throw err
    }
})()

*/