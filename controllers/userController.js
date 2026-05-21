import userModel from '../models/userModel.js'
import validator from 'validator'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import {
    createPendingSession,
    getPhoneOptionsForClient,
    sendOtpToPhone,
    verifyOtpCode
} from '../utils/adminOtp.js'

const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET)
}

// Route for user login
const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body

        const user = await userModel.findOne({ email })
        if (!user) {
            return res.json({ success: false, message: "User doesn't exists" })
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = createToken(user._id)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid Credentials" })
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Route for user register 
const registerUser = async (req, res) => {
    try {

        const { name, email, password } = req.body

        // checking user already exists or not
        const exists = await userModel.findOne({ email })
        if (exists) {
            return res.json({ success: false, message: "User already exists" })
        }

        // validating email format & strong password
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter valid email" })
        }
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // creating new user
        const newUser = new userModel({
            name,
            email,
            password: hashedPassword
        })
        const user = await newUser.save()

        const token = createToken(user._id)
        res.json({ success: true, token })

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

const issueAdminToken = () =>
    jwt.sign(process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD, process.env.JWT_SECRET)

// Admin login step 1: email + password → choose OTP phone
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const pendingToken = createPendingSession(email)
            res.json({
                success: true,
                requiresOtp: true,
                pendingToken,
                phones: getPhoneOptionsForClient()
            })
        } else {
            res.json({ success: false, message: "Invalid Credentials" })
        }
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Admin login step 2: send OTP to selected phone (last 4 digits shown in UI)
const adminSendOtp = async (req, res) => {
    try {
        const { pendingToken, phoneId } = req.body
        if (!pendingToken || !phoneId) {
            return res.json({ success: false, message: "Missing pending session or phone." })
        }
        const result = await sendOtpToPhone(pendingToken, phoneId)
        if (!result.ok) {
            return res.status(400).json({ success: false, message: result.message })
        }
        res.json({ success: true, message: result.message })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Admin login step 3: verify OTP → JWT
const adminVerifyOtp = async (req, res) => {
    try {
        const { pendingToken, phoneId, otp } = req.body
        if (!pendingToken || !phoneId || !otp) {
            return res.json({ success: false, message: "OTP verification details are incomplete." })
        }
        const result = verifyOtpCode(pendingToken, phoneId, otp)
        if (!result.ok) {
            return res.json({ success: false, message: result.message })
        }
        res.json({ success: true, token: issueAdminToken() })
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

export { loginUser, registerUser, adminLogin, adminSendOtp, adminVerifyOtp }