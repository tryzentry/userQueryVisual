import { connectToDatabase } from "../../../lib/mongoose";
import { Site } from "../../../lib/models";

export async function GET(req) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return new Response(JSON.stringify({ error: "Missing siteId parameter" }), { status: 400 });
    }

    const site = await Site.findOne({ siteId });
    if (!site) {
      return new Response(JSON.stringify({ error: "Site not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(site), { status: 200 });
  } catch (error) {
    console.error("Error retrieving site data:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
