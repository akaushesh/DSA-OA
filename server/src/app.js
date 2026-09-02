import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();


const allowedOrigins = [
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman) or from allowedOrigins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("❌ Not allowed by CORS"));
      }
    },
    credentials: true
  })
);


app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.get("/api/ping", (req, res) => {
  console.log("✅ /ping route hit");
  res.send("pong");
});

//routes import
import userRouter from "./routes/user.routes.js"


//routes decalaration
app.use("/api/users", userRouter)


export { app }