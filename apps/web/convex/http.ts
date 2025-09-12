import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { polar } from "./polar";

const http = httpRouter();

auth.addHttpRoutes(http);
polar.registerRoutes(http);

export default http;
