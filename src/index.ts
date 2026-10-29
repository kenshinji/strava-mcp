import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { type Props, refreshStravaToken, StravaHandler } from "./strava-handler";
import { StravaClient } from "./strava-api";

// To restrict access to specific users only, add their Strava userIDs to this Set.
// Leave it empty to allow access to all authenticated users.
const ALLOWED_USERIDS = new Set<string>([
	// For example: '1234567890',
]);

const ActivityType = [
	'AlpineSki', 'BackcountrySki', 'Canoeing', 'Crossfit', 'EBikeRide',
	'Elliptical', 'Golf', 'Handcycle', 'Hike', 'IceSkate', 'InlineSkate',
	'Kayaking', 'Kitesurf', 'NordicSki', 'Ride', 'RockClimbing', 'RollerSki',
	'Rowing', 'Run', 'Sail', 'Skateboard', 'Snowboard', 'Snowshoe', 'Soccer',
	'StairStepper', 'StandUpPaddling', 'Surfing', 'Swim', 'Velomobile',
	'VirtualRide', 'VirtualRun', 'Walk', 'WeightTraining', 'Wheelchair',
	'Windsurf', 'Workout', 'Yoga'
] as const;

type ActivityType = typeof ActivityType[number];

/**
 * Builds a server for one request. Every tool is a single authenticated call to
 * Strava, so there is nothing to keep between requests: the OAuth tokens arrive
 * with each one in `props`.
 */
function createServer(props: Props): McpServer {
	const server = new McpServer({
		name: "Strava MCP",
		version: "1.0.0",
	});

	server.tool(
		"getLoggedInAthlete",
		"Get user info from Strava",
		{},
		async () => {
			const athlete = await new StravaClient(props.accessToken).getLoggedInAthlete();
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(athlete),
					},
				],
			};
		},
	);

	// Activities
	server.tool(
		"createActivity",
		"Create a new activity on Strava",
		{
			name: z.string({ description: "The name of the activity" }),
			sport_type: z.enum(ActivityType, { description: "Sport type of the activity" }),
			start_date_local: z.string({ description: "ISO 8601 formatted date time" }),
			elapsed_time: z.number({ description: "Activity duration in seconds" }),
			distance: z.number({ description: "Distance in meters (optional)" }).optional(),
			description: z.string({ description: "Activity description (optional)" }).optional(),
		},
		async ({ name, sport_type, start_date_local, elapsed_time, distance, description }) => {
			const activity = await new StravaClient(props.accessToken).createActivity({
				name,
				sport_type,
				start_date_local,
				elapsed_time,
				distance,
				description,
			});
			return {
				content: [{
					type: "text",
					text: JSON.stringify(activity),
				}],
			};
		},
	);

	server.tool(
		"getActivity",
		"Get details of a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
		},
		async ({ id }) => {
			const activity = await new StravaClient(props.accessToken).getActivity(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(activity),
				}],
			};
		},
	);

	server.tool(
		"listAthleteActivities",
		"List authenticated athlete's activities",
		{
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
			before: z.number({ description: "Unix timestamp (optional)" }).optional(),
			after: z.number({ description: "Unix timestamp (optional)" }).optional(),
		},
		async ({ page, per_page, before, after }) => {
			const activities = await new StravaClient(props.accessToken).listAthleteActivities({
				page,
				per_page,
				before,
				after,
			});
			return {
				content: [{
					type: "text",
					text: JSON.stringify(activities),
				}],
			};
		},
	);

	// Clubs
	server.tool(
		"getClub",
		"Get details about a specific club",
		{
			id: z.number({ description: "Club ID" }),
		},
		async ({ id }) => {
			const club = await new StravaClient(props.accessToken).getClub(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(club),
				}],
			};
		},
	);

	server.tool(
		"listAthleteClubs",
		"List clubs for authenticated athlete",
		{},
		async () => {
			const clubs = await new StravaClient(props.accessToken).listAthleteClubs();
			return {
				content: [{
					type: "text",
					text: JSON.stringify(clubs),
				}],
			};
		},
	);

	// Routes
	server.tool(
		"getRoute",
		"Get details about a specific route",
		{
			id: z.number({ description: "Route ID" }),
		},
		async ({ id }) => {
			const route = await new StravaClient(props.accessToken).getRoute(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(route),
				}],
			};
		},
	);

	server.tool(
		"listAthleteRoutes",
		"List routes for authenticated athlete",
		{
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ page, per_page }) => {
			const routes = await new StravaClient(props.accessToken).listAthleteRoutes({ athleteId: props.userId, page, per_page });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(routes),
				}],
			};
		},
	);

	// Activity Details
	server.tool(
		"getActivityZones",
		"Get zones for a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
		},
		async ({ id }) => {
			const zones = await new StravaClient(props.accessToken).getActivityZones(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(zones),
				}],
			};
		},
	);

	server.tool(
		"getActivityLaps",
		"Get laps for a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
		},
		async ({ id }) => {
			const laps = await new StravaClient(props.accessToken).getActivityLaps(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(laps),
				}],
			};
		},
	);

	server.tool(
		"getActivityKudoers",
		"Get kudoers for a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ id, page, per_page }) => {
			const kudoers = await new StravaClient(props.accessToken).getActivityKudoers(id, { page, per_page });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(kudoers),
				}],
			};
		},
	);

	server.tool(
		"getActivityComments",
		"Get comments for a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ id, page, per_page }) => {
			const comments = await new StravaClient(props.accessToken).getActivityComments(id, { page, per_page });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(comments),
				}],
			};
		},
	);

	// Additional Athlete Endpoints
	server.tool(
		"getAthleteStats",
		"Get statistics for a specific athlete",
		{
			id: z.number({ description: "Athlete ID" }),
		},
		async ({ id }) => {
			const stats = await new StravaClient(props.accessToken).getAthleteStats(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(stats),
				}],
			};
		},
	);

	server.tool(
		"getAthleteZones",
		"Get heart rate and power zones for authenticated athlete",
		{},
		async () => {
			const zones = await new StravaClient(props.accessToken).getAthleteZones();
			return {
				content: [{
					type: "text",
					text: JSON.stringify(zones),
				}],
			};
		},
	);

	// Segments
	server.tool(
		"getSegment",
		"Get details about a specific segment",
		{
			id: z.number({ description: "Segment ID" }),
		},
		async ({ id }) => {
			const segment = await new StravaClient(props.accessToken).getSegment(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(segment),
				}],
			};
		},
	);

	server.tool(
		"getSegmentEfforts",
		"Get efforts for a specific segment",
		{
			segmentId: z.number({ description: "Segment ID" }),
			start_date_local: z.string({ description: "ISO 8601 formatted date time (optional)" }).optional(),
			end_date_local: z.string({ description: "ISO 8601 formatted date time (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ segmentId, start_date_local, end_date_local, per_page }) => {
			const efforts = await new StravaClient(props.accessToken).getSegmentEfforts(segmentId, {
				start_date_local,
				end_date_local,
				per_page,
			});
			return {
				content: [{
					type: "text",
					text: JSON.stringify(efforts),
				}],
			};
		},
	);

	server.tool(
		"starSegment",
		"Star or unstar a segment",
		{
			segmentId: z.number({ description: "Segment ID" }),
			starred: z.boolean({ description: "Whether to star or unstar the segment" }),
		},
		async ({ segmentId, starred }) => {
			const result = await new StravaClient(props.accessToken).starSegment(segmentId, starred);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(result),
				}],
			};
		},
	);

	// Streams
	server.tool(
		"getActivityStreams",
		"Get streams for a specific activity",
		{
			id: z.number({ description: "Activity ID" }),
			keys: z.array(z.string(), { description: "Array of stream types to return" }),
		},
		async ({ id, keys }) => {
			const streams = await new StravaClient(props.accessToken).getActivityStreams(id, keys);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(streams),
				}],
			};
		},
	);

	server.tool(
		"getSegmentStreams",
		"Get streams for a specific segment",
		{
			id: z.number({ description: "Segment ID" }),
			keys: z.array(z.string(), { description: "Array of stream types to return" }),
		},
		async ({ id, keys }) => {
			const streams = await new StravaClient(props.accessToken).getSegmentStreams(id, keys);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(streams),
				}],
			};
		},
	);

	server.tool(
		"getSegmentEffortStreams",
		"Get streams for a specific segment effort",
		{
			id: z.number({ description: "Segment Effort ID" }),
			keys: z.array(z.string(), { description: "Array of stream types to return" }),
		},
		async ({ id, keys }) => {
			const streams = await new StravaClient(props.accessToken).getSegmentEffortStreams(id, keys);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(streams),
				}],
			};
		},
	);

	// Additional Athlete Endpoints
	server.tool(
		"updateLoggedInAthlete",
		"Update the currently authenticated athlete",
		{
			weight: z.number({ description: "The weight of the athlete in kilograms" }),
		},
		async ({ weight }) => {
			const athlete = await new StravaClient(props.accessToken).updateLoggedInAthlete(weight);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(athlete),
				}],
			};
		},
	);

	server.tool(
		"getAthleteKoms",
		"Get athlete's KOMs/QOMs/CRs",
		{
			id: z.number({ description: "Athlete ID" }),
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ id, page, per_page }) => {
			const koms = await new StravaClient(props.accessToken).getAthleteKoms(id, { page, per_page });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(koms),
				}],
			};
		},
	);

	// Additional Activity Endpoints
	server.tool(
		"updateActivity",
		"Update an activity",
		{
			id: z.number({ description: "Activity ID" }),
			name: z.string({ description: "Activity name (optional)" }).optional(),
			type: z.string({ description: "Activity type (optional)" }).optional(),
			sport_type: z.string({ description: "Sport type (optional)" }).optional(),
			description: z.string({ description: "Activity description (optional)" }).optional(),
			gear_id: z.string({ description: "Gear ID (optional)" }).optional(),
			commute: z.boolean({ description: "Whether this is a commute (optional)" }).optional(),
			trainer: z.boolean({ description: "Whether this is a trainer activity (optional)" }).optional(),
		},
		async ({ id, ...params }) => {
			const activity = await new StravaClient(props.accessToken).updateActivity(id, params);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(activity),
				}],
			};
		},
	);

	server.tool(
		"getActivityPhotos",
		"Get photos from an activity",
		{
			id: z.number({ description: "Activity ID" }),
		},
		async ({ id }) => {
			const photos = await new StravaClient(props.accessToken).getActivityPhotos(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(photos),
				}],
			};
		},
	);

	server.tool(
		"getRelatedActivities",
		"Get related activities",
		{
			id: z.number({ description: "Activity ID" }),
		},
		async ({ id }) => {
			const activities = await new StravaClient(props.accessToken).getRelatedActivities(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(activities),
				}],
			};
		},
	);

	// Additional Club Endpoints
	server.tool(
		"getClubAnnouncements",
		"Get club announcements",
		{
			id: z.number({ description: "Club ID" }),
		},
		async ({ id }) => {
			const announcements = await new StravaClient(props.accessToken).getClubAnnouncements(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(announcements),
				}],
			};
		},
	);

	server.tool(
		"getClubAdmins",
		"Get club administrators",
		{
			id: z.number({ description: "Club ID" }),
		},
		async ({ id }) => {
			const admins = await new StravaClient(props.accessToken).getClubAdmins(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(admins),
				}],
			};
		},
	);

	// Additional Route Endpoints
	server.tool(
		"getRouteStreams",
		"Get route streams",
		{
			id: z.number({ description: "Route ID" }),
		},
		async ({ id }) => {
			const streams = await new StravaClient(props.accessToken).getRouteStreams(id);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(streams),
				}],
			};
		},
	);

	server.tool(
		"createRoute",
		"Create a route",
		{
			name: z.string({ description: "Route name" }),
			description: z.string({ description: "Route description (optional)" }).optional(),
			type: z.string({ description: "Route type (optional)" }).optional(),
			private: z.boolean({ description: "Whether the route is private (optional)" }).optional(),
			timestamp: z.number({ description: "Timestamp (optional)" }).optional(),
			segments: z.array(z.number(), { description: "Segment IDs (optional)" }).optional(),
		},
		async (params) => {
			const route = await new StravaClient(props.accessToken).createRoute(params);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(route),
				}],
			};
		},
	);

	server.tool(
		"exportRouteGPX",
		"Export route as GPX",
		{
			id: z.number({ description: "Route ID" }),
		},
		async ({ id }) => {
			const gpx = await new StravaClient(props.accessToken).exportRouteGPX(id);
			return {
				content: [{
					type: "text",
					text: await gpx.text(),
				}],
			};
		},
	);

	server.tool(
		"exportRouteTCX",
		"Export route as TCX",
		{
			id: z.number({ description: "Route ID" }),
		},
		async ({ id }) => {
			const tcx = await new StravaClient(props.accessToken).exportRouteTCX(id);
			return {
				content: [{
					type: "text",
					text: await tcx.text(),
				}],
			};
		},
	);

	// Additional Segment Endpoints
	server.tool(
		"exploreSegments",
		"Explore segments",
		{
			bounds: z.object({
				sw_lat: z.number({ description: "Southwest latitude" }),
				sw_lng: z.number({ description: "Southwest longitude" }),
				ne_lat: z.number({ description: "Northeast latitude" }),
				ne_lng: z.number({ description: "Northeast longitude" })
			}, { description: "Bounding box coordinates" }),
			activity_type: z.string({ description: "Activity type (optional)" }).optional(),
			min_cat: z.number({ description: "Minimum category (optional)" }).optional(),
			max_cat: z.number({ description: "Maximum category (optional)" }).optional(),
		},
		async (params) => {
			const segments = await new StravaClient(props.accessToken).exploreSegments({
				...params,
				bounds: params.bounds
			});
			return {
				content: [{
					type: "text",
					text: JSON.stringify(segments),
				}],
			};
		},
	);

	server.tool(
		"getStarredSegments",
		"List starred segments",
		{
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ page, per_page }) => {
			const segments = await new StravaClient(props.accessToken).getStarredSegments({ page, per_page });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(segments),
				}],
			};
		},
	);

	server.tool(
		"getSegmentLeaderboard",
		"Get segment leaderboard",
		{
			id: z.number({ description: "Segment ID" }),
			gender: z.string({ description: "Gender filter (optional)" }).optional(),
			age_group: z.string({ description: "Age group filter (optional)" }).optional(),
			weight_class: z.string({ description: "Weight class filter (optional)" }).optional(),
			following: z.boolean({ description: "Filter by following (optional)" }).optional(),
			club_id: z.number({ description: "Club ID filter (optional)" }).optional(),
			date_range: z.string({ description: "Date range filter (optional)" }).optional(),
			context_entries: z.number({ description: "Number of context entries (optional)" }).optional(),
			page: z.number({ description: "Page number (optional)" }).optional(),
			per_page: z.number({ description: "Items per page (optional)" }).optional(),
		},
		async ({ id, ...params }) => {
			const leaderboard = await new StravaClient(props.accessToken).getSegmentLeaderboard(id, params);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(leaderboard),
				}],
			};
		},
	);

	// Upload Endpoints
	server.tool(
		"createUpload",
		"Upload an activity",
		{
			file: z.string({ description: "Base64 encoded file data" }),
			name: z.string({ description: "Activity name (optional)" }).optional(),
			description: z.string({ description: "Activity description (optional)" }).optional(),
			trainer: z.boolean({ description: "Whether this is a trainer activity (optional)" }).optional(),
			commute: z.boolean({ description: "Whether this is a commute (optional)" }).optional(),
			data_type: z.string({ description: "Data type (optional)" }).optional(),
			external_id: z.string({ description: "External ID (optional)" }).optional(),
		},
		async (params) => {
			const file = new Blob([Uint8Array.from(atob(params.file).split('').map(c => c.charCodeAt(0)))]);
			const upload = await new StravaClient(props.accessToken).createUpload({ ...params, file });
			return {
				content: [{
					type: "text",
					text: JSON.stringify(upload),
				}],
			};
		},
	);

	server.tool(
		"getUploadStatus",
		"Get upload status",
		{
			uploadId: z.number({ description: "Upload ID" }),
		},
		async ({ uploadId }) => {
			const status = await new StravaClient(props.accessToken).getUploadStatus(uploadId);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(status),
				}],
			};
		},
	);

	return server;
}

/**
 * The MCP endpoint, served statelessly.
 *
 * `workers-oauth-provider` validates the bearer token, decrypts the Strava
 * tokens it stored at authorization time and hands them over as `ctx.props`,
 * so a plain fetch handler has everything a request needs. No Durable Object
 * is involved: nothing here outlives the response.
 */
const apiHandler = {
	async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
		const props = (ctx as ExecutionContext & { props: Props }).props;

		if (ALLOWED_USERIDS.size > 0 && !ALLOWED_USERIDS.has(props.userId)) {
			return new Response("Forbidden\n", {
				status: 403,
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		}

		const server = createServer(props);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);

		// The spec says a client must accept both application/json and
		// text/event-stream, and the SDK answers 406 when it doesn't. Some hosts
		// send only application/json; since `enableJsonResponse` means the reply is
		// JSON either way, widen the header rather than fail the call.
		const accept = request.headers.get("accept") ?? "";
		const acceptTooNarrow =
			!accept.includes("text/event-stream") || !accept.includes("application/json");

		// Claude probes with a protocol version newer than this SDK knows; the SDK
		// answers 400, which reads to the client as a broken server. Dropping the
		// header lets it reply in protocol terms (an unknown method is a JSON-RPC
		// error, not an HTTP failure) and negotiate down.
		const protocolVersion = request.headers.get("mcp-protocol-version");
		const protocolUnknown =
			protocolVersion !== null &&
			!(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(protocolVersion);

		let normalized = request;
		if (acceptTooNarrow || protocolUnknown) {
			const headers = new Headers(request.headers);
			if (acceptTooNarrow) headers.set("accept", "application/json, text/event-stream");
			if (protocolUnknown) headers.delete("mcp-protocol-version");
			normalized = new Request(request, { headers });
		}

		let parsedBody: unknown;
		if (request.method === "POST") {
			parsedBody = await normalized.clone().json();
		}

		return transport.handleRequest(
			normalized,
			parsedBody === undefined ? undefined : { parsedBody },
		);
	},
};

export default new OAuthProvider({
	apiRoute: "/mcp",
	apiHandler,
	defaultHandler: StravaHandler,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
	tokenExchangeCallback: async (options) => {
		if (options.grantType === "refresh_token") {
			return {
				...options.props,
				...await refreshStravaToken(options.props.refreshToken)
			}
		}
		return options.props
	}
});
