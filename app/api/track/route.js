import { connectToDatabase } from "../../../lib/mongoose";
import { Site } from "../../../lib/models";

export async function POST(req) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { siteId, userId, events } = body;

    if (!siteId || !userId || !events) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    let site = await Site.findOne({ siteId }) || new Site({ siteId, users: [] });
    let user = site.users.find((u) => u.userId === userId);

    if (!user) {
      user = { userId, actions: [] };
      site.users.push(user);
    }

    user.actions.push(...events.map((event) => ({ ...event, timestamp: new Date(event.timestamp) })));
    await site.save();

    return new Response(JSON.stringify({ message: "Tracking data stored successfully" }), { status: 200 });
  } catch (error) {
    console.error("Error saving tracking data:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
