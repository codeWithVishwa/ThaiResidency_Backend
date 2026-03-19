import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    checkIn: {
      type: Date,
      required: true,
      index: true,
    },
    checkOut: {
      type: Date,
      required: true,
      index: true,
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    units: {
      type: Number,
      required: true,
      min: 1,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    guestName: {
      type: String,
      required: true,
      trim: true,
    },
    guestEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
        "payment_failed",
      ],
      default: "pending_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    paymentProvider: {
      type: String,
      default: "pay_at_hotel",
    },
    paymentMode: {
      type: String,
      enum: ["pay_at_hotel", "razorpay"],
      default: "pay_at_hotel",
    },
    paymentDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    guestAddress: {
      type: String,
      required: true,
      trim: true,
    },
    idProofUrl: {
      type: String,
      default: "",
      trim: true,
    },
    sourceChannel: {
      type: String,
      default: "direct",
      trim: true,
    },
    channelManagerReference: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
