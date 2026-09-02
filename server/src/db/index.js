import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    try {
        const db_address = process.env.MONGO_URI.endsWith("/")
            ? `${process.env.MONGO_URI}${DB_NAME}`
            : `${process.env.MONGO_URI}/${DB_NAME}`; 
        const connectionInstance = await mongoose.connect(db_address)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB