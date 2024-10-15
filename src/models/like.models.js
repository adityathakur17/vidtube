import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    // either of 'video', 'comment' or 'tweet' will be assigned others are null
    video: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default Like = mongoose.model("Like", likeSchema);
