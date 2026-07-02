import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  shiprocket: {
    email:          { type: String, default: "" },
    password:       { type: String, default: "" },
    pickupLocation: { type: String, default: "Primary" },
  },
  shipping: {
    freeThreshold: { type: Number, default: 2000 },
    charge:        { type: Number, default: 150 },
    gstPercent:    { type: Number, default: 18 },
  },
  pageSeo: {
    type: Map,
    of: new mongoose.Schema({
      title:       { type: String, default: "" },
      description: { type: String, default: "" },
    }, { _id: false }),
    default: {},
  },
}, { timestamps: true });

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;
