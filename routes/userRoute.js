import express from 'express';
import { adminLogin, adminSendOtp, adminVerifyOtp, loginUser, registerUser } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.post('/admin', adminLogin)
userRouter.post('/admin/send-otp', adminSendOtp)
userRouter.post('/admin/verify-otp', adminVerifyOtp)

export default userRouter;