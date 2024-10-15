import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type: Schema.Types.ObjectId,      //WHO is subscribing
        ref: "User"
    },
    channel:{
        type: Schema.Types.ObjectId,     // TO WHOM subscriber is subscribing
        ref: "User"
    }
}, {timestamps:true})

export const Subscription = mongoose.model("Subscription", subscriptionSchema)