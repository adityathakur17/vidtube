import { Router } from "express";
import { registerUser, loginUser, refreshAccessToken, logoutUser } from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router()

//unsecured routes
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount:1
        },{
            name: "coverImage",
            maxCount:1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

router.route("/refresh-token").post(refreshAccessToken)

//secured routes
router.route("/logout").post(verifyJWT,logoutUser)
export default router;
