import mongoose from "mongoose";

const UserActionSchema = new mongoose.Schema({
  siteId: String,
  userId: String,
  eventName: String,
  timestamp: Date,
  url: String,
  userAgent: String,
  screenSize: String,
  language: String,
  referrer: String,
  data: Object,
});

const SiteSchema = new mongoose.Schema({
  siteId: String,
  users: [{ userId: String, actions: [UserActionSchema] }],
});

export const Site = mongoose.models.Site || mongoose.model("Site", SiteSchema);
